/**
 * Application Entry Point
 * WhatsApp Interview Bot with AI
 */

import express from 'express';
import compression from 'compression';
import { config } from './config/index.js';
import { logger } from './config/logger.js';
import { connectDatabase, disconnectDatabase } from './repositories/prisma.js';
import { closeRedisConnection } from './services/memory/redis.client.js';
import {
  helmetMiddleware,
  corsMiddleware,
  rateLimiter,
  requestIdMiddleware,
  requestLogger,
  sanitizeBody,
} from './middleware/security.middleware.js';
import {
  errorHandler,
  notFoundHandler,
  setupGlobalErrorHandlers,
} from './middleware/error.middleware.js';
import routes from './routes/index.js';

/**
 * Create and configure Express application
 */
function createApp(): express.Application {
  const app = express();

  // Trust proxy (for rate limiting behind load balancer)
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmetMiddleware);
  app.use(corsMiddleware);

  // Request processing
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request tracking and logging
  app.use(requestIdMiddleware);
  app.use(requestLogger);

  // Sanitization
  app.use(sanitizeBody);

  // Rate limiting
  app.use(rateLimiter);

  // API routes
  app.use(config.app.apiPrefix, routes);

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'WhatsApp Interview Bot',
      version: '1.0.0',
      status: 'running',
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  // Setup global error handlers
  setupGlobalErrorHandlers();

  // Connect to database
  await connectDatabase();

  // Create and start Express app
  const app = createApp();

  const server = app.listen(config.app.port, () => {
    logger.info(
      {
        port: config.app.port,
        env: config.app.nodeEnv,
        apiPrefix: config.app.apiPrefix,
      },
      'Server started successfully'
    );

    logger.info(
      {
        health: `http://localhost:${config.app.port}${config.app.apiPrefix}/health`,
        webhook: `http://localhost:${config.app.port}${config.app.apiPrefix}/webhook`,
      },
      'API endpoints available'
    );
  });

  // Graceful shutdown
  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'Shutdown signal received');

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        await disconnectDatabase();
        await closeRedisConnection();
        logger.info('All connections closed');
        process.exit(0);
      } catch (error) {
        logger.error({ error }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force exit after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

// Start the application
startServer().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
