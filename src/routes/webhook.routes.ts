/**
 * WhatsApp Webhook Routes
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  validateWebhookSignature,
  webhookRateLimiter,
} from '../middleware/security.middleware.js';
import { validateBody, sendMessageSchema } from '../middleware/validation.middleware.js';
import {
  verifyWebhook,
  handleWebhook,
  sendTestMessage,
} from '../controllers/webhook.controller.js';

const router = Router();

// Webhook verification (Meta sends GET request)
router.get('/', asyncHandler(verifyWebhook));

// Incoming webhook messages (Meta sends POST request)
router.post(
  '/',
  webhookRateLimiter,
  validateWebhookSignature,
  asyncHandler(handleWebhook)
);

// Test endpoint for sending messages (development only)
router.post(
  '/test',
  validateBody(sendMessageSchema),
  asyncHandler(sendTestMessage)
);

export default router;
