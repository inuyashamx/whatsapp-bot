/**
 * Redis client singleton
 * Provides connection management and health checks
 */

import Redis from 'ioredis';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
export function getRedisClient(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      db: config.redis.db,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 10) {
          logger.error('Redis: Max retry attempts reached');
          return null;
        }
        const delay = Math.min(times * 200, 5000);
        logger.warn({ attempt: times, delay }, 'Redis: Retrying connection');
        return delay;
      },
      reconnectOnError: (err) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    redisClient.on('connect', () => {
      logger.info('Redis: Connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis: Ready to accept commands');
    });

    redisClient.on('error', (error) => {
      logger.error({ error }, 'Redis: Connection error');
    });

    redisClient.on('close', () => {
      logger.warn('Redis: Connection closed');
    });

    redisClient.on('reconnecting', () => {
      logger.info('Redis: Reconnecting...');
    });
  }

  return redisClient;
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
  healthy: boolean;
  latency?: number;
  error?: string;
}> {
  const client = getRedisClient();
  const start = Date.now();

  try {
    const result = await client.ping();
    const latency = Date.now() - start;

    if (result === 'PONG') {
      return { healthy: true, latency };
    }

    return { healthy: false, error: 'Unexpected ping response' };
  } catch (error) {
    return {
      healthy: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis: Connection closed gracefully');
  }
}

export default getRedisClient;
