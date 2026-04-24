import express from 'express';
import http from 'http';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';

import { env } from './config/env';
import { prisma } from './config/database';
import { redis } from './config/redis';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { setupSocketHandlers } from './socket/handler';

// Route imports
import { authRoutes } from './modules/auth';
import { riderRoutes } from './modules/rider';
import { driverRoutes } from './modules/driver';
import { rideRoutes } from './modules/ride';
import { paymentRoutes } from './modules/payment';
import { notificationRoutes } from './modules/notification';
import { adminRoutes } from './modules/admin';
import { mapsRoutes } from './modules/maps/maps.routes';
import { whatsappRoutes, whatsappService } from './modules/whatsapp';
import { subscriptionRoutes } from './modules/payment/subscription.routes';

const app = express();
const server = http.createServer(app);

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Security
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: true, credentials: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests' } },
});
app.use(limiter);

// OTP rate limiting (stricter)
const otpLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many OTP requests. Try again in a minute.' } },
});

// Body parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: env.API_VERSION,
      uptime: process.uptime(),
    });
  } catch (err) {
    res.status(503).json({ status: 'unhealthy', error: (err as Error).message });
  }
});

// API routes
const apiPrefix = `/api/${env.API_VERSION}`;

app.use(`${apiPrefix}/auth/send-otp`, otpLimiter);
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/rider`, riderRoutes);
app.use(`${apiPrefix}/driver`, driverRoutes);
app.use(`${apiPrefix}/rides`, rideRoutes);
app.use(`${apiPrefix}/payments`, paymentRoutes);
app.use(`${apiPrefix}/subscription`, subscriptionRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/admin`, adminRoutes);
app.use(`${apiPrefix}/maps`, mapsRoutes);
app.use(`${apiPrefix}/whatsapp`, whatsappRoutes);

// Serve static web apps (demo dashboard, driver console)
// In Docker: cwd is /app/server, public is at /app/public
// Locally: cwd is /project/server, public would be at /project/public
const publicDir = path.resolve(process.cwd(), '..', 'public');
app.use('/driver-console', express.static(path.join(publicDir, 'driver-console')));
app.use('/rider', express.static(path.join(publicDir, 'rider')));

// Legacy /demo → serves apps/demo-dashboard directly
const appsDir = path.resolve(process.cwd(), '..', 'apps');
app.use('/demo', express.static(path.join(appsDir, 'demo-dashboard')));

// Root redirect
app.get('/', (_req, res) => {
  res.redirect('/rider');
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: { code: 'NOT_FOUND', message: 'Route not found' },
  });
});

// Error handler
app.use(errorHandler);

// Socket.io handlers
setupSocketHandlers(io);

// WhatsApp ride-event listener (separate Redis subscriber)
whatsappService.setupRideEventListener();

// Start server
const PORT = env.PORT;

server.listen(PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════════╗
  ║                                           ║
  ║   🛺  Hey Auto Server                     ║
  ║                                           ║
  ║   Port:    ${PORT}                          ║
  ║   Env:     ${env.NODE_ENV.padEnd(25)}  ║
  ║   API:     /api/${env.API_VERSION.padEnd(25)}  ║
  ║   City:    Taliparamba, Kannur            ║
  ║                                           ║
  ╚═══════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed');
  });

  io.close(() => {
    logger.info('Socket.io server closed');
  });

  await prisma.$disconnect();
  await redis.quit();

  logger.info('All connections closed');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server, io };
// deployed Sun Apr 19 09:25:39 IST 2026
