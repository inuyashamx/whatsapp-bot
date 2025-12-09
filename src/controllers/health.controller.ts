/**
 * Health Check Controller
 * Provides system health status and monitoring endpoints
 */

import type { Request, Response } from 'express';
import { prisma } from '../repositories/prisma.js';
import { checkRedisHealth } from '../services/memory/redis.client.js';
import { aiService } from '../services/ai/ai.service.js';
import type { HealthCheckResponse, ServiceHealth } from '../types/api.js';

const startTime = Date.now();

/**
 * Basic health check (for load balancers)
 */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Detailed health check with service status
 */
export async function detailedHealthCheck(_req: Request, res: Response): Promise<void> {
  const services: ServiceHealth[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // Check database
  const dbHealth = await checkDatabaseHealth();
  services.push(dbHealth);
  if (dbHealth.status === 'unhealthy') {
    overallStatus = 'unhealthy';
  }

  // Check Redis
  const redisHealth = await checkRedisServiceHealth();
  services.push(redisHealth);
  if (redisHealth.status === 'unhealthy') {
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
  }

  // Check AI service
  const aiHealth = await checkAIServiceHealth();
  services.push(aiHealth);
  if (aiHealth.status === 'unhealthy') {
    overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus;
  }

  const response: HealthCheckResponse = {
    status: overallStatus,
    version: process.env['npm_package_version'] ?? '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services,
  };

  const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;
  res.status(statusCode).json(response);
}

/**
 * Check database connectivity
 */
async function checkDatabaseHealth(): Promise<ServiceHealth> {
  const start = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: 'database',
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

/**
 * Check Redis connectivity
 */
async function checkRedisServiceHealth(): Promise<ServiceHealth> {
  const result = await checkRedisHealth();

  return {
    name: 'redis',
    status: result.healthy ? 'healthy' : 'unhealthy',
    latency: result.latency,
    message: result.error,
  };
}

/**
 * Check AI service connectivity
 */
async function checkAIServiceHealth(): Promise<ServiceHealth> {
  const result = await aiService.healthCheck();

  return {
    name: 'ai',
    status: result.healthy ? 'healthy' : 'unhealthy',
    latency: result.latency,
    message: result.error,
  };
}

/**
 * Readiness probe (for Kubernetes)
 */
export async function readinessCheck(_req: Request, res: Response): Promise<void> {
  try {
    // Check critical services
    await prisma.$queryRaw`SELECT 1`;
    await checkRedisHealth();

    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'not ready' });
  }
}

/**
 * Liveness probe (for Kubernetes)
 */
export function livenessCheck(_req: Request, res: Response): void {
  res.status(200).json({ status: 'alive' });
}
