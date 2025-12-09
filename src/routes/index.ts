/**
 * Main Router
 * Combines all route modules
 */

import { Router } from 'express';
import webhookRoutes from './webhook.routes.js';
import interviewRoutes from './interview.routes.js';
import healthRoutes from './health.routes.js';

const router = Router();

// Health check routes (no prefix)
router.use('/health', healthRoutes);

// API routes
router.use('/webhook', webhookRoutes);
router.use('/interviews', interviewRoutes);

// API info
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'WhatsApp Interview Bot API',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        webhook: '/webhook',
        interviews: '/interviews',
      },
    },
  });
});

export default router;
