import { TicketModel, ITicket, ITicketMessage, TicketStatus, TicketPriority } from '../models/Ticket';
import { logger } from '../utils/logger';

export class TicketRepository {
  // Create a new ticket
  async create(ticketData: Partial<ITicket>): Promise<ITicket> {
    try {
      const ticket = new TicketModel(ticketData);
      return await ticket.save();
    } catch (error: any) {
      logger.error('TicketRepository', 'create', `Failed to create ticket: ${error.message}`);
      throw error;
    }
  }

  // Find ticket by ticket ID
  async findByTicketId(ticketId: string): Promise<ITicket | null> {
    try {
      return await TicketModel.findOne({ ticketId })
        .populate('user', '_id username email')
        .populate('order', '_id orderNumber totalAmount');
    } catch (error: any) {
      logger.error('TicketRepository', 'findByTicketId', `Failed to find ticket: ${error.message}`);
      throw error;
    }
  }

  // Find tickets by user ID with pagination
  async findByUser(userId: string, page: number = 1, limit: number = 10, filters: any = {}): Promise<ITicket[]> {
    try {
      const skip = (page - 1) * limit;
      const query = { user: userId, ...filters };
      
      return await TicketModel.find(query)
        .populate('user', '_id name email')
        .populate('order', '_id orderNumber totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error: any) {
      logger.error('TicketRepository', 'findByUser', `Failed to find user tickets: ${error.message}`);
      throw error;
    }
  }

  // Count tickets by user ID
  async countByUser(userId: string, filters: any = {}): Promise<number> {
    try {
      const query = { user: userId, ...filters };
      return await TicketModel.countDocuments(query);
    } catch (error: any) {
      logger.error('TicketRepository', 'countByUser', `Failed to count user tickets: ${error.message}`);
      throw error;
    }
  }

  // Find all tickets with pagination and filters (admin only)
  async findAll(page: number = 1, limit: number = 10, filters: any = {}): Promise<ITicket[]> {
    try {
      const skip = (page - 1) * limit;
      
      // Build query based on filters
      let query: any = {};
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.priority) {
        query.priority = filters.priority;
      }
      
      if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        query.$or = [
          { ticketId: searchRegex },
          { subject: searchRegex },
          { 'messages.message': searchRegex }
        ];
      }
      
      return await TicketModel.find(query)
        .populate('user', '_id name email')
        .populate('order', '_id orderNumber totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error: any) {
      logger.error('TicketRepository', 'findAll', `Failed to find tickets: ${error.message}`);
      throw error;
    }
  }

  // Count all tickets with filters
  async countAll(filters: any = {}): Promise<number> {
    try {
      let query: any = {};
      
      if (filters.status) {
        query.status = filters.status;
      }
      
      if (filters.category) {
        query.category = filters.category;
      }
      
      if (filters.priority) {
        query.priority = filters.priority;
      }
      
      if (filters.search) {
        const searchRegex = new RegExp(filters.search, 'i');
        query.$or = [
          { ticketId: searchRegex },
          { subject: searchRegex },
          { 'messages.message': searchRegex }
        ];
      }
      
      return await TicketModel.countDocuments(query);
    } catch (error: any) {
      logger.error('TicketRepository', 'countAll', `Failed to count tickets: ${error.message}`);
      throw error;
    }
  }

  // Add message to ticket
  async addMessage(ticketId: string, messageData: ITicketMessage): Promise<ITicket | null> {
    try {
      return await TicketModel.findOneAndUpdate(
        { ticketId },
        { 
          $push: { messages: messageData },
          $set: { lastResponseAt: messageData.createdAt }
        },
        { new: true }
      )
        .populate('user', '_id username email')
        .populate('order', '_id orderNumber totalAmount');
    } catch (error: any) {
      logger.error('TicketRepository', 'addMessage', `Failed to add message: ${error.message}`);
      throw error;
    }
  }

  // Update ticket status
  async updateStatus(ticketId: string, status: TicketStatus): Promise<ITicket | null> {
    try {
      return await TicketModel.findOneAndUpdate(
        { ticketId },
        { $set: { status } },
        { new: true }
      )
        .populate('user', '_id username email')
        .populate('order', '_id orderNumber totalAmount');
    } catch (error: any) {
      logger.error('TicketRepository', 'updateStatus', `Failed to update status: ${error.message}`);
      throw error;
    }
  }

  // Update ticket priority
  async updatePriority(ticketId: string, priority: TicketPriority): Promise<ITicket | null> {
    try {
      return await TicketModel.findOneAndUpdate(
        { ticketId },
        { $set: { priority } },
        { new: true }
      )
        .populate('user', '_id username email')
        .populate('order', '_id orderNumber totalAmount');
    } catch (error: any) {
      logger.error('TicketRepository', 'updatePriority', `Failed to update priority: ${error.message}`);
      throw error;
    }
  }

  // Escalate ticket
  async escalate(ticketId: string): Promise<ITicket | null> {
    try {
      return await TicketModel.findOneAndUpdate(
        { ticketId },
        { $set: { isEscalated: true } },
        { new: true }
      )
        .populate('user', '_id username email')
        .populate('order', '_id orderNumber totalAmount');
    } catch (error: any) {
      logger.error('TicketRepository', 'escalate', `Failed to escalate ticket: ${error.message}`);
      throw error;
    }
  }

  // Get ticket statistics
  async getStats(): Promise<any> {
    try {
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
        TicketModel.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }) // Last 24 hours
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
    } catch (error: any) {
      logger.error('TicketRepository', 'getStats', `Failed to get stats: ${error.message}`);
      throw error;
    }
  }

  // Find tickets by status
  async findByStatus(status: TicketStatus, page: number = 1, limit: number = 10): Promise<ITicket[]> {
    try {
      const skip = (page - 1) * limit;
      
      return await TicketModel.find({ status })
        .populate('user', '_id name email')
        .populate('order', '_id orderNumber totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error: any) {
      logger.error('TicketRepository', 'findByStatus', `Failed to find tickets by status: ${error.message}`);
      throw error;
    }
  }

  // Find escalated tickets
  async findEscalated(page: number = 1, limit: number = 10): Promise<ITicket[]> {
    try {
      const skip = (page - 1) * limit;
      
      return await TicketModel.find({ isEscalated: true })
        .populate('user', 'name email')
        .populate('order', 'orderNumber totalAmount')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    } catch (error: any) {
      logger.error('TicketRepository', 'findEscalated', `Failed to find escalated tickets: ${error.message}`);
      throw error;
    }
  }

  // Delete ticket (soft delete by marking as inactive)
  async deleteTicket(ticketId: string): Promise<boolean> {
    try {
      const result = await TicketModel.deleteOne({ ticketId });
      return result.deletedCount > 0;
    } catch (error: any) {
      logger.error('TicketRepository', 'deleteTicket', `Failed to delete ticket: ${error.message}`);
      throw error;
    }
  }
}
