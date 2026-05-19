// Load environment variables first
import "reflect-metadata";
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { logger } from "./utils/logger";
import connectDB from "./config/db";
import userRoutes from "./routes/userRoutes";
import addressRoutes from "./routes/addressRoutes";
import productRoutes from "./routes/productRoutes";
import cartRoutes from "./routes/cartRoutes";
import wishlistRoutes from "./routes/wishlistRoutes";
import orderRoutes from "./routes/orderRoutes";
import ticketRoutes from "./routes/ticketRoutes";
import reviewRoutes from "./routes/reviewRoutes";
import familyRoutes from "./routes/familyRoutes";
import webhookRoutes from "./routes/webhookRoutes";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimiter } from "./middleware/rateLimiter";

const app = express();
const PORT = process.env.PORT || 3001;

// Required for express-rate-limit to correctly identify client IPs
app.set("trust proxy", 1);

// Connect to database
connectDB();

// CORS middleware
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // 1. Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }
      // 2. Allow exact matches from env
      if (allowedOrigins.includes(origin)) {
        return callback(null, origin);
      }
      // 3. Allow wildcard (optional)
      if (allowedOrigins.includes("*")) {
        return callback(null, origin);
      }
      // 4. Allow local dev & hybrid apps
      if (
        origin.startsWith("http://localhost") ||
        origin.startsWith("http://127.0.0.1") ||
        origin.startsWith("capacitor://") ||
        origin.startsWith("ionic://")
      ) {
        return callback(null, origin);
      }
      // 5. Block everything else
      return callback(new Error(`CORS blocked: ${origin} not allowed`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    exposedHeaders: ["Set-Cookie"],
  }),
);
// Cookie parser middleware
app.use(cookieParser());

// Raw body parsing for Stripe webhooks (must be before express.json)
app.use(
  "/api/webhooks/stripe",
  express.raw({
    type: "application/json",
  }),
);

// Middleware
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);
app.use("/api/addresses", addressRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/tickets", ticketRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/family", familyRoutes);

// Webhook routes (must be after raw body middleware)
app.use("/api/webhooks", webhookRoutes);

// Health check endpoint with rate limiting
const rateLimitWindowMs = parseInt(process.env.RATE_LIMIT ?? "", 20) || 60000;
const rateLimitMax = parseInt(process.env.RATE_MAX ?? "", 10) || 20;

logger.success(
  "system",
  "rateLimitConfig",
  `Rate limit config — windowMs: ${rateLimitWindowMs}, max: ${rateLimitMax}`,
);

app.get(
  "/health",
  rateLimiter({ windowMs: rateLimitWindowMs, max: rateLimitMax }),
  (_req, res) => {
    logger.success("system", "healthCheck", "Health check endpoint accessed");
    res.status(200).json({
      success: true,
      status: "UP",
      timestamp: new Date().toISOString().split("T")[0],
      message: "E-commerce Inventory Backend API is healthy",
    });
  },
);

const server = app.listen(PORT, () => {
  logger.success(
    "system",
    "serverStart",
    `Server started successfully on port ${PORT}`,
  );
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err: any) => {
  logger.error(
    "system",
    "unhandledRejection",
    `Unhandled Rejection! Shutting down... ${err.message}`,
  );
  server.close(() => {
    logger.success(
      "system",
      "unhandledRejection",
      "Server closed after unhandled rejection",
    );
    process.exit(1);
  });
});

// Handle SIGTERM
process.on("SIGTERM", () => {
  logger.success(
    "system",
    "SIGTERM",
    "SIGTERM RECEIVED. Shutting down gracefully",
  );
  server.close(() => {
    logger.success("system", "SIGTERM", "Process terminated!");
    process.exit(0);
  });
});

// Handle SIGINT (Ctrl+C)
process.on("SIGINT", () => {
  logger.success(
    "system",
    "SIGINT",
    "SIGINT RECEIVED. Shutting down gracefully",
  );
  server.close(() => {
    logger.success("system", "SIGINT", "Process terminated!");
    process.exit(0);
  });
});
