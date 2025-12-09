/**
 * Prisma client singleton
 * Ensures single database connection throughout the application
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger.js';
import { isDevelopment } from '../config/index.js';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create Prisma client with logging configuration
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: isDevelopment()
      ? [
          { level: 'query', emit: 'event' },
          { level: 'error', emit: 'stdout' },
          { level: 'warn', emit: 'stdout' },
        ]
      : [{ level: 'error', emit: 'stdout' }],
  });
}

/**
 * Prisma client singleton instance
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Log queries in development
if (isDevelopment()) {
  prisma.$on('query' as never, (event: { query: string; duration: number }) => {
    logger.debug({
      query: event.query,
      duration: `${event.duration}ms`,
    }, 'Database query executed');
  });
}

// Prevent multiple instances in development
if (isDevelopment()) {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error({ error }, 'Failed to connect to database');
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error({ error }, 'Error disconnecting from database');
    throw error;
  }
}

export default prisma;
