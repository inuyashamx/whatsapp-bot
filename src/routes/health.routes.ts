/**
 * Health Check Routes
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  healthCheck,
  detailedHealthCheck,
  readinessCheck,
  livenessCheck,
} from '../controllers/health.controller.js';

const router = Router();

// Basic health check
router.get('/', asyncHandler(healthCheck));

// Detailed health check
router.get('/detailed', asyncHandler(detailedHealthCheck));

// Kubernetes readiness probe
router.get('/ready', asyncHandler(readinessCheck));

// Kubernetes liveness probe
router.get('/live', livenessCheck);

export default router;
