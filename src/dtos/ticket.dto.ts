import { Expose, Transform } from 'class-transformer';
import { BaseDto } from './base.dto';
import { TicketStatus, TicketPriority } from '../models/Ticket';
import { UserRole } from '../models/User';

// Ticket Message DTO
export class TicketMessageDto {
  @Expose()
  @Transform(({ obj }) => {
    // Handle both populated object and ObjectId
    if (obj.sender) {
      if (typeof obj.sender === 'object' && obj.sender._id) {
        return obj.sender._id.toString();
      }
      if (obj.sender.toString) {
        return obj.sender.toString();
      }
    }
    return obj.sender;
  })
  sender!: string;

  @Expose()
  senderRole!: UserRole;

  @Expose()
  message!: string;

  @Expose()
  attachments!: string[];

  @Expose()
  createdAt!: Date;
}

// Ticket Response DTO
export class TicketResponseDto extends BaseDto {
  @Expose()
  ticketId!: string;

  @Expose()
  @Transform(({ obj }) => {
    // Handle both populated user object and ObjectId
    if (obj.user) {
      if (typeof obj.user === 'object' && obj.user._id) {
        return obj.user._id.toString();
      }
      if (obj.user.toString) {
        return obj.user.toString();
      }
    }
    return obj.user;
  })
  userId!: string;

  @Expose()
  subject!: string;

  @Expose()
  category!: string;

  @Expose()
  priority!: TicketPriority;

  @Expose()
  status!: TicketStatus;

  @Expose()
  isEscalated!: boolean;

  @Expose()
  @Transform(({ obj }) => {
    // Transform nested messages properly
    if (Array.isArray(obj.messages)) {
      return obj.messages.map((msg: any) => ({
        sender: msg.sender?.toString ? msg.sender.toString() : msg.sender,
        senderRole: msg.senderRole,
        message: msg.message,
        attachments: msg.attachments || [],
        createdAt: msg.createdAt
      }));
    }
    return obj.messages;
  })
  messages!: TicketMessageDto[];

  @Expose()
  @Transform(({ obj }) => {
    // Handle both populated order object and ObjectId
    if (obj.order) {
      if (typeof obj.order === 'object' && obj.order._id) {
        return obj.order._id.toString();
      }
      if (obj.order.toString) {
        return obj.order.toString();
      }
    }
    return obj.order;
  })
  orderId?: string;

  @Expose()
  assignedTo?: string;

  @Expose()
  escalationLevel!: number;

  @Expose()
  resolvedAt?: Date;

  @Expose()
  get messageCount(): number {
    return this.messages?.length || 0;
  }
}

// Admin Ticket DTO (simplified for admin endpoints)
export class AdminTicketDto extends BaseDto {
  @Expose()
  ticketId!: string;

  @Expose()
  subject!: string;

  @Expose()
  category!: string;

  @Expose()
  priority!: TicketPriority;

  @Expose()
  isEscalated!: boolean;

  @Expose()
  status!: TicketStatus;

  @Expose()
  createdAt!: Date;
}

// Ticket Stats DTO
export class TicketStatsDto {
  @Expose()
  totalTickets!: number;

  @Expose()
  openTickets!: number;

  @Expose()
  inProgressTickets!: number;

  @Expose()
  resolvedTickets!: number;

  @Expose()
  closedTickets!: number;

  @Expose()
  escalatedTickets!: number;
}
