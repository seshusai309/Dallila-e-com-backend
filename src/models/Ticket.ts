import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole } from './User';

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  WAITING_CUSTOMER = 'waiting_customer',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum TicketPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent'
}

export enum TicketCategory {
  ORDER = 'order',
  PAYMENT = 'payment',
  DELIVERY = 'delivery',
  REFUND = 'refund',
  TECHNICAL = 'technical',
  GENERAL = 'general'
}

export interface ITicketMessage {
  sender: Types.ObjectId;
  senderRole: UserRole;
  message: string;
  attachments?: string[];
  createdAt: Date;
}

export interface ITicket extends Document {
  ticketId: string;
  user: Types.ObjectId;
  order?: Types.ObjectId;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  messages: ITicketMessage[];
  lastResponseAt?: Date;
  isEscalated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ticketMessageSchema = new Schema<ITicketMessage>({
  sender: { type: Schema.Types.ObjectId, required: true, refPath: 'senderRole' },
  senderRole: { 
    type: String, 
    required: true, 
    enum: Object.values(UserRole) 
  },
  message: { type: String, required: true },
  attachments: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

const ticketSchema = new Schema<ITicket>({
  ticketId: { type: String, required: true, unique: true },
  user: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  order: { type: Schema.Types.ObjectId, ref: 'Order' },
  subject: { type: String, required: true, trim: true },
  category: { 
    type: String, 
    required: true, 
    enum: Object.values(TicketCategory) 
  },
  priority: { 
    type: String, 
    required: true, 
    enum: Object.values(TicketPriority),
    default: TicketPriority.MEDIUM
  },
  status: { 
    type: String, 
    required: true, 
    enum: Object.values(TicketStatus),
    default: TicketStatus.OPEN
  },
  messages: [ticketMessageSchema],
  lastResponseAt: { type: Date },
  isEscalated: { type: Boolean, default: false }
}, { timestamps: true });

// Index for efficient lookups
ticketSchema.index({ user: 1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ category: 1 });
ticketSchema.index({ priority: 1 });
ticketSchema.index({ createdAt: -1 });

// Generate unique ticket ID before saving
ticketSchema.pre('validate', function() {
  if (this.isNew && !this.ticketId) {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.ticketId = `TKT${timestamp}${random}`;
  }
});

// Update lastResponseAt when a new message is added
ticketSchema.pre('save', function() {
  if (this.isModified('messages') && this.messages.length > 0) {
    const lastMessage = this.messages[this.messages.length - 1];
    this.lastResponseAt = lastMessage.createdAt;
  }
});

export const TicketModel = mongoose.model<ITicket>('Ticket', ticketSchema);
