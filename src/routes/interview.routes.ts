/**
 * Interview Routes
 */

import { Router } from 'express';
import { asyncHandler } from '../middleware/error.middleware.js';
import {
  validateBody,
  validateParams,
  validateQuery,
  createInterviewSchema,
  scheduleInterviewSchema,
  idParamSchema,
  paginationSchema,
} from '../middleware/validation.middleware.js';
import {
  getInterviews,
  getInterviewById,
  createInterview,
  scheduleInterview,
  startInterview,
  completeInterview,
  cancelInterview,
  getUpcomingInterviews,
  updateInterviewStage,
  scoreInterview,
} from '../controllers/interview.controller.js';

const router = Router();

// Get all interviews
router.get(
  '/',
  validateQuery(paginationSchema),
  asyncHandler(getInterviews)
);

// Get upcoming interviews
router.get('/upcoming', asyncHandler(getUpcomingInterviews));

// Get interview by ID
router.get(
  '/:id',
  validateParams(idParamSchema),
  asyncHandler(getInterviewById)
);

// Create new interview
router.post(
  '/',
  validateBody(createInterviewSchema),
  asyncHandler(createInterview)
);

// Schedule interview with calendar
router.post(
  '/:id/schedule',
  validateParams(idParamSchema),
  validateBody(scheduleInterviewSchema),
  asyncHandler(scheduleInterview)
);

// Start interview
router.post(
  '/:id/start',
  validateParams(idParamSchema),
  asyncHandler(startInterview)
);

// Complete interview
router.post(
  '/:id/complete',
  validateParams(idParamSchema),
  asyncHandler(completeInterview)
);

// Cancel interview
router.post(
  '/:id/cancel',
  validateParams(idParamSchema),
  asyncHandler(cancelInterview)
);

// Update interview stage
router.patch(
  '/:id/stage',
  validateParams(idParamSchema),
  asyncHandler(updateInterviewStage)
);

// Score interview
router.post(
  '/:id/score',
  validateParams(idParamSchema),
  asyncHandler(scoreInterview)
);

export default router;
