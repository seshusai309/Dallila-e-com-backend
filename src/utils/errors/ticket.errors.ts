import { AppError } from './app.error';

export class TicketNotFoundError extends AppError {
  constructor(message: string = 'Ticket not found') {
    super(message, 'TICKET_NOT_FOUND', 404);
  }
}

export class TicketAccessDeniedError extends AppError {
  constructor(message: string = 'Access denied') {
    super(message, 'TICKET_ACCESS_DENIED', 403);
  }
}
