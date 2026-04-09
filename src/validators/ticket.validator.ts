import { z } from 'zod';
import { TicketPriority } from '../models/Ticket';

// Create Ticket validation schema
export const CreateTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject must be at most 200 characters'),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum([TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT]).optional().default(TicketPriority.MEDIUM),
  message: z.string().min(1, 'Message is required'),
  orderId: z.string().optional(),
});

// Add Message to Ticket validation schema
export const AddMessageSchema = z.object({
  message: z.string().min(1, 'Message is required'),
});

// Update Ticket Status validation schema
export const UpdateTicketStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed'], {
    message: 'Invalid status. Valid statuses: open, in_progress, resolved, closed',
  }),
});

// Update Ticket Priority validation schema
export const UpdateTicketPrioritySchema = z.object({
  priority: z.enum([TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH, TicketPriority.URGENT], {
    message: 'Invalid priority. Valid priorities: low, medium, high, urgent',
  }),
});

// Get Tickets Query validation schema
export const GetTicketsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.string().optional(),
  category: z.string().optional(),
});

// Export types
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;
export type AddMessageInput = z.infer<typeof AddMessageSchema>;
export type UpdateTicketStatusInput = z.infer<typeof UpdateTicketStatusSchema>;
export type UpdateTicketPriorityInput = z.infer<typeof UpdateTicketPrioritySchema>;
export type GetTicketsQueryInput = z.infer<typeof GetTicketsQuerySchema>;
