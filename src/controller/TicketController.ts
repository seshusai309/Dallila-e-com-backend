import { Request, Response } from 'express';
import { TicketService } from '../services/ticket.service';
import { TicketStatus, TicketPriority } from '../models/Ticket';
import { logger } from '../utils/logger';
import { plainToInstance } from 'class-transformer';
import { TicketResponseDto, TicketStatsDto, AdminTicketDto } from '../dtos/ticket.dto';
import { createPaginatedResponse, parsePaginationParams } from '../utils/pagination';
import { TicketNotFoundError, TicketAccessDeniedError } from '../utils/errors/ticket.errors';

export class TicketController {
  private ticketService: TicketService;

  constructor() {
    this.ticketService = new TicketService();
  }

  // Create a new ticket
  async createTicket(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User authentication required'
          }
        });
        return;
      }
      
      const { subject, category, priority, message, orderId } = req.body;

      const ticket = await this.ticketService.createTicket({
        userId: userId.toString(),
        subject,
        category,
        priority: priority || TicketPriority.MEDIUM,
        message,
        orderId
      });

      logger.success(userId.toString(), 'createTicket', `Created ticket: ${ticket._id}`);

      const ticketDto = plainToInstance(TicketResponseDto, ticket, { excludeExtraneousValues: true });

      res.status(201).json({
        success: true,
        code: 'TICKET_CREATED',
        message: 'Ticket created successfully',
        data: ticketDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'createTicket', `Failed to create ticket: ${error.message}`);
      
      // Handle specific error types
      if (error.code === 'VALIDATION_ERROR') {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data',
            details: error.message
          }
        });
        return;
      }
      
      if (error.code === 'TICKET_LIMIT_EXCEEDED') {
        res.status(429).json({
          success: false,
          error: {
            code: 'TICKET_LIMIT_EXCEEDED',
            message: 'You have reached the maximum number of tickets. Please wait before creating more.',
            details: 'Maximum 5 tickets per hour allowed'
          }
        });
        return;
      }
      
      if (error.code === 'INVALID_CATEGORY') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CATEGORY',
            message: 'Invalid ticket category',
            details: `Valid categories: order, payment, delivery, refund, technical, general`
          }
        });
        return;
      }
      
      if (error.code === 'INVALID_PRIORITY') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PRIORITY',
            message: 'Invalid ticket priority',
            details: `Valid priorities: low, medium, high, urgent`
          }
        });
        return;
      }
      
      if (error.code === 'DATABASE_ERROR') {
        res.status(503).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: 'Database service unavailable',
            details: 'Unable to save ticket. Please try again later.'
          }
        });
        return;
      }
      
      if (error.code === 'USER_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: {
            code: 'USER_NOT_FOUND',
            message: 'User account not found',
            details: 'Please log in again or contact support'
          }
        });
        return;
      }
      
      // Generic error for unexpected issues
      res.status(500).json({
        success: false,
        error: {
          code: 'CREATE_TICKET_ERROR',
          message: 'Failed to create ticket',
          details: error.message || 'An unexpected error occurred. Please try again.',
          suggestion: 'Check your input data and try again. If the problem persists, contact support.'
        }
      });
    }
  }

  // Get user's tickets
  async getUserTickets(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }

      const { page, limit } = parsePaginationParams(req.query as any, 10, 100);
      const { status, category } = req.query;

      const result = await this.ticketService.getUserTickets(
        userId.toString(), 
        page, 
        limit, 
        { status: status as string, category: category as string }
      );

      logger.success(userId.toString(), 'getUserTickets', `Retrieved ${result.tickets.length} tickets`);

      const ticketsDto = result.tickets.map(ticket => plainToInstance(TicketResponseDto, ticket, { excludeExtraneousValues: true }));
      const paginatedResponse = createPaginatedResponse(ticketsDto, result.total, page, limit);

      res.status(200).json({
        success: true,
        code: 'TICKETS_RETRIEVED',
        message: 'Tickets retrieved successfully',
        ...paginatedResponse
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'anonymous', 'getUserTickets', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'TICKETS_ERROR', message: 'Failed to retrieve tickets. Please try again.' }
      });
    }
  }

  // Get ticket by ID
  async getTicketById(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }
      
      const { ticketId } = req.params;
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const ticket = await this.ticketService.getTicketById(ticketIdStr, userId.toString());

      logger.success(userId.toString(), 'getTicketById', `Retrieved ticket: ${ticketIdStr}`);

      const ticketDto = plainToInstance(TicketResponseDto, ticket, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'TICKET_RETRIEVED',
        message: 'Ticket retrieved successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      if (error instanceof TicketAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Access denied' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'anonymous', 'getTicketById', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'TICKET_ERROR', message: 'Failed to retrieve ticket. Please try again.' }
      });
    }
  }

  // Add message to ticket
  async addMessage(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }
      
      const { ticketId } = req.params;
      const { message, attachments } = req.body;
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const updatedTicket = await this.ticketService.addMessage(
        ticketIdStr, 
        userId.toString(), 
        message, 
        attachments
      );

      logger.success(userId.toString(), 'addMessage', `Added message to ticket: ${ticketIdStr}`);

      const ticketDto = plainToInstance(TicketResponseDto, updatedTicket.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'MESSAGE_ADDED',
        message: 'Message added successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error.code === 'TICKET_CLOSED') {
        res.status(400).json({
          success: false,
          error: { code: 'TICKET_CLOSED', message: error.message }
        });
        return;
      }
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      if (error instanceof TicketAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Access denied' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'anonymous', 'addMessage', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'MESSAGE_ERROR', message: 'Failed to add message. Please try again.' }
      });
    }
  }

  // Update ticket status (admin only)
  async updateTicketStatus(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { status } = req.body;
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const updatedTicket = await this.ticketService.updateTicketStatus(ticketIdStr, status);

      logger.success(req.user?._id?.toString() || 'admin', 'updateTicketStatus', `Updated ticket ${ticketIdStr} status to ${status}`);

      const ticketDto = plainToInstance(TicketResponseDto, updatedTicket.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'STATUS_UPDATED',
        message: 'Ticket status updated successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'admin', 'updateTicketStatus', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'STATUS_UPDATE_ERROR', message: 'Failed to update status. Please try again.' }
      });
    }
  }

  // Update ticket priority (admin only)
  async updateTicketPriority(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { priority } = req.body;
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const updatedTicket = await this.ticketService.updateTicketPriority(ticketIdStr, priority);

      logger.success(req.user?._id?.toString() || 'admin', 'updateTicketPriority', `Updated ticket ${ticketIdStr} priority to ${priority}`);

      const ticketDto = plainToInstance(TicketResponseDto, updatedTicket.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'PRIORITY_UPDATED',
        message: 'Ticket priority updated successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'admin', 'updateTicketPriority', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'PRIORITY_UPDATE_ERROR', message: 'Failed to update priority. Please try again.' }
      });
    }
  }

  // Escalate ticket (admin only)
  async escalateTicket(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const updatedTicket = await this.ticketService.escalateTicket(ticketIdStr);

      logger.success(req.user?._id?.toString() || 'admin', 'escalateTicket', `Escalated ticket: ${ticketIdStr}`);

      const ticketDto = plainToInstance(TicketResponseDto, updatedTicket.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'TICKET_ESCALATED',
        message: 'Ticket escalated successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'admin', 'escalateTicket', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'ESCALATE_ERROR', message: 'Failed to escalate ticket. Please try again.' }
      });
    }
  }

  // Add admin message to ticket
  async addAdminMessage(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const { message } = req.body;
      const adminId = req.user?._id?.toString() || 'admin';
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const updatedTicket = await this.ticketService.addAdminMessage(
        ticketIdStr, 
        adminId, 
        message
      );

      logger.success(adminId, 'addAdminMessage', `Admin replied to ticket: ${ticketIdStr}`);

      const ticketDto = plainToInstance(TicketResponseDto, updatedTicket.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'ADMIN_MESSAGE_ADDED',
        message: 'Reply added successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'admin', 'addAdminMessage', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'MESSAGE_ERROR', message: 'Failed to add reply. Please try again.' }
      });
    }
  }

  // Get ticket by ID (admin only - no ownership check)
  async getTicketByIdAdmin(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const ticket = await this.ticketService.getTicketById(ticketIdStr);

      logger.success(req.user?._id?.toString() || 'admin', 'getTicketByIdAdmin', `Retrieved ticket: ${ticketIdStr}`);

      const ticketDto = plainToInstance(TicketResponseDto, ticket, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'TICKET_RETRIEVED',
        message: 'Ticket retrieved successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'admin', 'getTicketByIdAdmin', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'TICKET_ERROR', message: 'Failed to retrieve ticket. Please try again.' }
      });
    }
  }

  // Get all tickets (admin only)
  async getAllTickets(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit } = parsePaginationParams(req.query as any, 10, 100);
      const { status, category, priority, search } = req.query;

      const result = await this.ticketService.getAllTickets(page, limit, {
        status: status as string,
        category: category as string,
        priority: priority as string,
        search: search as string
      });

      logger.success(req.user?._id?.toString() || 'admin', 'getAllTickets', `Retrieved ${result.tickets.length} tickets`);

      const ticketsDto = result.tickets.map(ticket => plainToInstance(AdminTicketDto, ticket, { excludeExtraneousValues: true }));
      const paginatedResponse = createPaginatedResponse(ticketsDto, result.total, page, limit);

      res.status(200).json({
        success: true,
        ...paginatedResponse
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'admin', 'getAllTickets', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'TICKETS_ERROR', message: 'Failed to retrieve tickets. Please try again.' }
      });
    }
  }

  // Close ticket (user)
  async closeTicket(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?._id;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'User authentication required' }
        });
        return;
      }
      
      const { ticketId } = req.params;
      const ticketIdStr = Array.isArray(ticketId) ? ticketId[0] : ticketId;

      const updatedTicket = await this.ticketService.closeTicket(ticketIdStr, userId.toString());

      logger.success(userId.toString(), 'closeTicket', `Closed ticket: ${ticketIdStr}`);

      const ticketDto = plainToInstance(TicketResponseDto, updatedTicket.toObject(), { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'TICKET_CLOSED',
        message: 'Ticket closed successfully',
        data: ticketDto
      });
    } catch (error: any) {
      if (error instanceof TicketNotFoundError) {
        res.status(404).json({
          success: false,
          error: { code: 'TICKET_NOT_FOUND', message: 'Ticket not found' }
        });
        return;
      }
      if (error instanceof TicketAccessDeniedError) {
        res.status(403).json({
          success: false,
          error: { code: 'ACCESS_DENIED', message: 'Access denied' }
        });
        return;
      }
      logger.error(req.user?._id?.toString() || 'anonymous', 'closeTicket', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'CLOSE_ERROR', message: 'Failed to close ticket. Please try again.' }
      });
    }
  }

  // Get ticket statistics (admin only)
  async getTicketStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await this.ticketService.getTicketStats();

      logger.success(req.user?._id?.toString() || 'admin', 'getTicketStats', 'Retrieved ticket statistics');

      const statsDto = plainToInstance(TicketStatsDto, stats, { excludeExtraneousValues: true });

      res.status(200).json({
        success: true,
        code: 'STATS_RETRIEVED',
        message: 'Ticket statistics retrieved successfully',
        data: statsDto
      });
    } catch (error: any) {
      logger.error(req.user?._id?.toString() || 'admin', 'getTicketStats', `Failed: ${error.message}`);
      res.status(500).json({
        success: false,
        error: { code: 'STATS_ERROR', message: 'Failed to retrieve statistics. Please try again.' }
      });
    }
  }
}
