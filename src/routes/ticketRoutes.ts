import { Router } from 'express';
import { TicketController } from '../controller/TicketController';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validate';
import { CreateTicketSchema, AddMessageSchema, UpdateTicketStatusSchema, UpdateTicketPrioritySchema, GetTicketsQuerySchema } from '../validators/ticket.validator';

const router = Router();
const ticketController = new TicketController();

/**
 * @access private (admin only)
 * @route GET /admin/all
 * @desc Get all tickets with pagination and filters (admin only)
 */
router.get(
  '/admin/all',
  rateLimiter({ max: 100 }),
  authenticateToken,
  requireAdmin,
  ticketController.getAllTickets.bind(ticketController)
);

/**
 * @access private (admin only)
 * @route PATCH /admin/:ticketId/status
 * @desc Update ticket status (admin only)
 */
router.patch(
  '/admin/:ticketId/status',
  rateLimiter({ max: 50 }),
  authenticateToken,
  requireAdmin,
  validate(UpdateTicketStatusSchema),
  ticketController.updateTicketStatus.bind(ticketController)
);

/**
 * @access private (admin only)
 * @route PATCH /admin/:ticketId/priority
 * @desc Update ticket priority (admin only)
 */
router.patch(
  '/admin/:ticketId/priority',
  rateLimiter({ max: 50 }),
  authenticateToken,
  requireAdmin,
  validate(UpdateTicketPrioritySchema),
  ticketController.updateTicketPriority.bind(ticketController)
);

/**
 * @access private (admin only)
 * @route PATCH /admin/:ticketId/escalate
 * @desc Escalate ticket (admin only)
 */
router.patch(
  '/admin/:ticketId/escalate',
  rateLimiter({ max: 30 }),
  authenticateToken,
  requireAdmin,
  ticketController.escalateTicket.bind(ticketController)
);

/**
 * @access private (admin only)
 * @route POST /admin/:ticketId/messages
 * @desc Add admin reply to ticket
 */
router.post(
  '/admin/:ticketId/messages',
  rateLimiter({ max: 50 }),
  authenticateToken,
  requireAdmin,
  validate(AddMessageSchema),
  ticketController.addAdminMessage.bind(ticketController)
);

/**
 * @access private (admin only)
 * @route GET /admin/:ticketId
 * @desc Get any ticket by ID (admin only)
 */
router.get(
  '/admin/:ticketId',
  rateLimiter({ max: 100 }),
  authenticateToken,
  requireAdmin,
  ticketController.getTicketByIdAdmin.bind(ticketController)
);

/**
 * @access private (admin only)
 * @route GET /admin/stats
 * @desc Get ticket statistics (admin only)
 */
router.get(
  '/admin/stats',
  rateLimiter({ max: 50 }),
  authenticateToken,
  requireAdmin,
  ticketController.getTicketStats.bind(ticketController)
);

/**
 * @access private
 * @route POST /
 * @desc Create new support ticket
 */
router.post(
  '/',
  rateLimiter({ max: 10 }),
  authenticateToken,
  validate(CreateTicketSchema),
  ticketController.createTicket.bind(ticketController)
);

/**
 * @access private
 * @route GET /
 * @desc Get user's tickets with pagination
 */
router.get(
  '/',
  rateLimiter({ max: 100 }),
  authenticateToken,
  ticketController.getUserTickets.bind(ticketController)
);

/**
 * @access private
 * @route GET /:ticketId
 * @desc Get ticket by ID
 */
router.get(
  '/:ticketId',
  rateLimiter({ max: 100 }),
  authenticateToken,
  ticketController.getTicketById.bind(ticketController)
);

/**
 * @access private
 * @route POST /:ticketId/messages
 * @desc Add message to ticket
 */
router.post(
  '/:ticketId/messages',
  rateLimiter({ max: 50 }),
  authenticateToken,
  validate(AddMessageSchema),
  ticketController.addMessage.bind(ticketController)
);

/**
 * @access private
 * @route PATCH /:ticketId/close
 * @desc Close ticket
 */
router.patch(
  '/:ticketId/close',
  rateLimiter({ max: 20 }),
  authenticateToken,
  ticketController.closeTicket.bind(ticketController)
);

export default router;
