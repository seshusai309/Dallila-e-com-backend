import { TicketRepository } from '../repository/TicketRepository';
import { OrderRepository } from '../repository/OrderRepository';
import { TicketModel, ITicket, TicketStatus, TicketPriority, TicketCategory, ITicketMessage } from '../models/Ticket';
import { UserRole } from '../models/User';
import { TicketNotFoundError, TicketAccessDeniedError } from '../utils/errors/ticket.errors';
import { logger } from '../utils/logger';

export interface CreateTicketInput {
  userId: string;
  subject: string;
  category: string;
  priority?: TicketPriority;
  message: string;
  orderId?: string;
}

export interface TicketFilters {
  status?: string;
  category?: string;
  priority?: string;
  search?: string;
}

export class TicketService {
  private ticketRepository: TicketRepository;
  private orderRepository: OrderRepository;

  constructor() {
    this.ticketRepository = new TicketRepository();
    this.orderRepository = new OrderRepository();
  }

  // Generate unique ticket ID
  generateTicketId(): string {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TKT${timestamp}${random}`;
  }

  /**
   * Create a new ticket
   */
  async createTicket(input: CreateTicketInput): Promise<ITicket> {
    const { userId, subject, category, priority, message, orderId } = input;

    // Input validation
    if (!userId) {
      const error = new Error('User ID is required');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    if (!subject || subject.trim().length === 0) {
      const error = new Error('Subject is required');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    if (subject.length > 200) {
      const error = new Error('Subject must be at most 200 characters');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    if (!category || category.trim().length === 0) {
      const error = new Error('Category is required');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    // Validate category
    const validCategories = ['order', 'payment', 'delivery', 'refund', 'technical', 'general'];
    if (!validCategories.includes(category.toLowerCase())) {
      const error = new Error(`Invalid category: ${category}`);
      (error as any).code = 'INVALID_CATEGORY';
      throw error;
    }

    // Validate priority
    if (priority) {
      const validPriorities = [TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT];
      if (!validPriorities.includes(priority)) {
        const error = new Error(`Invalid priority: ${priority}`);
        (error as any).code = 'INVALID_PRIORITY';
        throw error;
      }
    }

    if (!message || message.trim().length === 0) {
      const error = new Error('Message is required');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    if (message.length > 2000) {
      const error = new Error('Message must be at most 2000 characters');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    // Validate orderId requirement based on category
    if (category.toLowerCase() === 'order' && !orderId) {
      const error = new Error('Order ID is required for order-related tickets');
      (error as any).code = 'VALIDATION_ERROR';
      throw error;
    }

    const ticketData: any = {
      user: userId,
      subject: subject.trim(),
      category: category.toLowerCase(),
      priority: priority || TicketPriority.MEDIUM,
      ticketId: this.generateTicketId(),
      messages: [{
        sender: userId as any,
        senderRole: UserRole.USER,
        message: message.trim(),
        createdAt: new Date()
      }],
    };

    if (orderId) {
      try {
        const order = await this.orderRepository.findByOrderNumber(orderId);
        if (order) {
          ticketData.order = order._id;
        } else {
          // Order not found, but still create ticket
          logger.warn('TicketService', 'createTicket', `Order not found for orderId: ${orderId}`);
          ticketData.orderId = orderId; // Store as reference even if order not found
        }
      } catch (orderError: any) {
        // Order lookup failed, continue without order
        logger.warn('TicketService', 'createTicket', `Order lookup failed for orderId: ${orderId}: ${orderError.message}`);
        ticketData.orderId = orderId; // Store as reference even if lookup failed
      }
    }

    try {
      return await this.ticketRepository.create(ticketData);
    } catch (dbError: any) {
      logger.error('TicketService', 'createTicket', `Database error: ${dbError.message}`);
      const error = new Error('Failed to save ticket to database');
      (error as any).code = 'DATABASE_ERROR';
      throw error;
    }
  }

  /**
   * Get user's tickets
   */
  async getUserTickets(userId: string, page: number, limit: number, filters?: { status?: string; category?: string }): Promise<{ tickets: ITicket[]; total: number }> {
    const queryFilters: any = { user: userId };
    if (filters?.status) queryFilters.status = filters.status;
    if (filters?.category) queryFilters.category = filters.category;

    const tickets = await this.ticketRepository.findByUser(userId, page, limit, queryFilters);
    const total = await this.ticketRepository.countByUser(userId, queryFilters);

    return { tickets, total };
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(ticketId: string, userId?: string): Promise<ITicket> {
    const ticket = await this.ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError();
    }

    // Check ownership if userId provided
    if (userId) {
      const ticketUserId = ticket.user._id ? ticket.user._id.toString() : ticket.user.toString();
      logger.success('TicketService', 'getTicketById', `Comparing userId: ${userId} with ticketUserId: ${ticketUserId}`);
      if (ticketUserId !== userId) {
        throw new TicketAccessDeniedError();
      }
    }

    return ticket;
  }

  /**
   * Add message to ticket
   */
  async addMessage(ticketId: string, userId: string, message: string, attachments?: string[]): Promise<ITicket> {
    const ticket = await this.ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError();
    }

    // Check ownership
    const ticketUserId = ticket.user._id ? ticket.user._id.toString() : ticket.user.toString();
    if (ticketUserId !== userId) {
      throw new TicketAccessDeniedError();
    }

    // Check if ticket is closed or resolved - users cannot add messages to closed tickets
    if (ticket.status === TicketStatus.CLOSED || ticket.status === TicketStatus.RESOLVED) {
      const error = new Error('Cannot add messages to a closed or resolved ticket');
      (error as any).code = 'TICKET_CLOSED';
      throw error;
    }

    const messageData = {
      sender: userId as any,
      senderRole: UserRole.USER,
      message,
      attachments: attachments || [],
      createdAt: new Date()
    };

    const updatedTicket = await this.ticketRepository.addMessage(ticketId, messageData);
    if (!updatedTicket) {
      throw new TicketNotFoundError();
    }

    // Update status if waiting for customer
    if (ticket.status === TicketStatus.WAITING_CUSTOMER) {
      await this.ticketRepository.updateStatus(ticketId, TicketStatus.OPEN);
    }

    return updatedTicket;
  }

  /**
   * Update ticket status (admin)
   */
  async updateTicketStatus(ticketId: string, status: TicketStatus): Promise<ITicket> {
    const ticket = await this.ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError();
    }

    const updatedTicket = await this.ticketRepository.updateStatus(ticketId, status);
    if (!updatedTicket) {
      throw new TicketNotFoundError();
    }

    return updatedTicket;
  }

  /**
   * Update ticket priority (admin)
   */
  async updateTicketPriority(ticketId: string, priority: TicketPriority): Promise<ITicket> {
    const ticket = await this.ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError();
    }

    const updatedTicket = await this.ticketRepository.updatePriority(ticketId, priority);
    if (!updatedTicket) {
      throw new TicketNotFoundError();
    }

    return updatedTicket;
  }

  /**
   * Escalate ticket (admin)
   */
  async escalateTicket(ticketId: string): Promise<ITicket> {
    const ticket = await this.ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError();
    }

    const updatedTicket = await this.ticketRepository.escalate(ticketId);
    if (!updatedTicket) {
      throw new TicketNotFoundError();
    }

    return updatedTicket;
  }

  /**
   * Add admin message to ticket
   */
  async addAdminMessage(ticketId: string, adminId: string, message: string): Promise<ITicket> {
    const ticket = await this.ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError();
    }

    const messageData = {
      sender: adminId as any,
      senderRole: UserRole.ADMIN,
      message,
      createdAt: new Date()
    };

    const updatedTicket = await this.ticketRepository.addMessage(ticketId, messageData);
    if (!updatedTicket) {
      throw new TicketNotFoundError();
    }

    // Update status to waiting for customer
    if (ticket.status === TicketStatus.OPEN || ticket.status === TicketStatus.IN_PROGRESS) {
      await this.ticketRepository.updateStatus(ticketId, TicketStatus.WAITING_CUSTOMER);
    }

    return updatedTicket;
  }

  /**
   * Get all tickets (admin)
   */
  async getAllTickets(page: number, limit: number, filters?: TicketFilters): Promise<{ tickets: ITicket[]; total: number }> {
    const queryFilters: any = {};
    if (filters?.status) queryFilters.status = filters.status;
    if (filters?.category) queryFilters.category = filters.category;
    if (filters?.priority) queryFilters.priority = filters.priority;
    if (filters?.search) queryFilters.search = filters.search;

    const tickets = await this.ticketRepository.findAll(page, limit, queryFilters);
    const total = await this.ticketRepository.countAll(queryFilters);

    return { tickets, total };
  }

  /**
   * Close ticket (user)
   */
  async closeTicket(ticketId: string, userId: string): Promise<ITicket> {
    const ticket = await this.ticketRepository.findByTicketId(ticketId);
    if (!ticket) {
      throw new TicketNotFoundError();
    }

    const ticketUserId = ticket.user._id ? ticket.user._id.toString() : ticket.user.toString();
    if (ticketUserId !== userId) {
      throw new TicketAccessDeniedError();
    }

    const updatedTicket = await this.ticketRepository.updateStatus(ticketId, TicketStatus.CLOSED);
    if (!updatedTicket) {
      throw new TicketNotFoundError();
    }

    return updatedTicket;
  }

  /**
   * Get ticket statistics (admin)
   */
  async getTicketStats(): Promise<any> {
    const stats = await Promise.all([
      TicketModel.countDocuments({ status: TicketStatus.OPEN }),
      TicketModel.countDocuments({ status: TicketStatus.IN_PROGRESS }),
      TicketModel.countDocuments({ status: TicketStatus.WAITING_CUSTOMER }),
      TicketModel.countDocuments({ status: TicketStatus.RESOLVED }),
      TicketModel.countDocuments({ status: TicketStatus.CLOSED }),
      TicketModel.countDocuments({ priority: TicketPriority.URGENT }),
      TicketModel.countDocuments({ priority: TicketPriority.HIGH }),
      TicketModel.countDocuments({ priority: TicketPriority.MEDIUM }),
      TicketModel.countDocuments({ priority: TicketPriority.LOW }),
      TicketModel.countDocuments({ isEscalated: true }),
      TicketModel.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } })
    ]);

    return {
      byStatus: {
        open: stats[0],
        inProgress: stats[1],
        waitingCustomer: stats[2],
        resolved: stats[3],
        closed: stats[4]
      },
      byPriority: {
        urgent: stats[5],
        high: stats[6],
        medium: stats[7],
        low: stats[8]
      },
      escalated: stats[9],
      newToday: stats[10],
      total: stats[0] + stats[1] + stats[2] + stats[3] + stats[4]
    };
  }
}
