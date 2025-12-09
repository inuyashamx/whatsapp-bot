/**
 * Interview Controller
 * Handles interview CRUD operations and management
 */

import type { Request, Response } from 'express';
import { interviewRepository } from '../repositories/interview.repository.js';
import { candidateRepository } from '../repositories/candidate.repository.js';
import { positionRepository } from '../repositories/position.repository.js';
import { calendarService } from '../services/calendar/calendar.service.js';
import { emailService } from '../services/email/email.service.js';
import { aiService } from '../services/ai/ai.service.js';
import { memoryService } from '../services/memory/memory.service.js';
import { logger } from '../config/logger.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import type { ApiResponse } from '../types/api.js';
import type { InterviewStatus } from '@prisma/client';

/**
 * Get all interviews with pagination
 */
export async function getInterviews(req: Request, res: Response): Promise<void> {
  const { page = '1', limit = '20', status, candidateId, positionId } = req.query;

  const { interviews, total } = await interviewRepository.findMany(
    {
      status: status as InterviewStatus | undefined,
      candidateId: candidateId as string | undefined,
      positionId: positionId as string | undefined,
    },
    {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
    }
  );

  const response: ApiResponse<typeof interviews> = {
    success: true,
    data: interviews,
    meta: {
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10),
      total,
      totalPages: Math.ceil(total / parseInt(limit as string, 10)),
    },
  };

  res.json(response);
}

/**
 * Get interview by ID
 */
export async function getInterviewById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const interview = await interviewRepository.findByIdWithRelations(id as string);

  if (!interview) {
    throw new NotFoundError(`Interview not found: ${id}`);
  }

  res.json({
    success: true,
    data: interview,
  });
}

/**
 * Create a new interview
 */
export async function createInterview(req: Request, res: Response): Promise<void> {
  const { candidateId, positionId, scheduledAt, notes } = req.body;

  // Verify candidate exists
  await candidateRepository.findByIdOrThrow(candidateId);

  // Verify position exists
  await positionRepository.findByIdOrThrow(positionId);

  // Check for existing active interview
  const existing = await interviewRepository.findActiveForCandidate(candidateId);
  if (existing) {
    throw new BadRequestError('Candidate already has an active interview');
  }

  const interview = await interviewRepository.create({
    candidateId,
    positionId,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    notes,
  });

  logger.info({ interviewId: interview.id }, 'Interview created');

  res.status(201).json({
    success: true,
    data: interview,
  });
}

/**
 * Schedule an interview with calendar event
 */
export async function scheduleInterview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    startTime,
    duration = 60,
    timeZone = 'UTC',
    includeVideoConference = true,
    attendeeEmails,
    notes,
  } = req.body;

  const interview = await interviewRepository.findByIdWithRelations(id as string);

  if (!interview) {
    throw new NotFoundError(`Interview not found: ${id}`);
  }

  // Create calendar event
  const calendarEvent = await calendarService.scheduleInterview({
    candidateId: interview.candidateId,
    positionId: interview.positionId,
    startTime: new Date(startTime),
    duration,
    timeZone,
    includeVideoConference,
    attendeeEmails,
    notes,
  });

  // Update interview with calendar info
  const updatedInterview = await interviewRepository.update(id as string, {
    status: 'SCHEDULED',
    scheduledAt: calendarEvent.startTime,
    calendarEventId: calendarEvent.eventId,
    meetingLink: calendarEvent.meetLink,
    notes,
  });

  // Send confirmation email if candidate has email
  if (interview.candidate.email) {
    try {
      await emailService.sendTemplateEmail('interview_scheduled', {
        candidateName: interview.candidate.name,
        candidateEmail: interview.candidate.email,
        positionTitle: interview.position.title,
        companyName: 'Company', // TODO: Get from config
        interviewDate: calendarEvent.startTime.toLocaleDateString(),
        interviewTime: calendarEvent.startTime.toLocaleTimeString(),
        interviewLink: calendarEvent.meetLink,
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to send confirmation email');
    }
  }

  logger.info({ interviewId: id, eventId: calendarEvent.eventId }, 'Interview scheduled');

  res.json({
    success: true,
    data: {
      interview: updatedInterview,
      calendar: calendarEvent,
    },
  });
}

/**
 * Start an interview
 */
export async function startInterview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const interview = await interviewRepository.findByIdWithRelations(id as string);

  if (!interview) {
    throw new NotFoundError(`Interview not found: ${id}`);
  }

  if (interview.status !== 'SCHEDULED' && interview.status !== 'PENDING') {
    throw new BadRequestError(`Interview cannot be started in ${interview.status} status`);
  }

  const updatedInterview = await interviewRepository.start(id as string);

  // Initialize interview context in memory
  await memoryService.saveContext(id as string, {
    candidateName: interview.candidate.name,
    positionTitle: interview.position.title,
    companyName: 'Company',
    questionsAsked: 0,
    keyPoints: [],
    redFlags: [],
    highlights: [],
  });

  logger.info({ interviewId: id }, 'Interview started');

  res.json({
    success: true,
    data: updatedInterview,
  });
}

/**
 * Complete an interview and generate summary
 */
export async function completeInterview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  const interview = await interviewRepository.findByIdWithRelations(id as string);

  if (!interview) {
    throw new NotFoundError(`Interview not found: ${id}`);
  }

  if (interview.status !== 'IN_PROGRESS') {
    throw new BadRequestError(`Interview cannot be completed in ${interview.status} status`);
  }

  // Get conversation history for summary
  const history = await memoryService.getConversationHistory(interview.candidate.phoneNumber);

  // Generate AI summary
  let summary = null;
  try {
    summary = await aiService.generateInterviewSummary(
      interview.candidate.name,
      interview.position.title,
      history
    );
  } catch (error) {
    logger.warn({ error }, 'Failed to generate interview summary');
  }

  // Complete the interview
  const updatedInterview = await interviewRepository.complete(id as string);

  // Send thank you email
  if (interview.candidate.email) {
    try {
      await emailService.sendTemplateEmail('interview_completed', {
        candidateName: interview.candidate.name,
        candidateEmail: interview.candidate.email,
        positionTitle: interview.position.title,
        companyName: 'Company',
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to send thank you email');
    }
  }

  // Clear session data
  await memoryService.clearConversation(interview.candidate.phoneNumber);
  await memoryService.deleteSession(id as string);

  logger.info({ interviewId: id }, 'Interview completed');

  res.json({
    success: true,
    data: {
      interview: updatedInterview,
      summary,
    },
  });
}

/**
 * Cancel an interview
 */
export async function cancelInterview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { reason, notifyCandidate = true } = req.body;

  const interview = await interviewRepository.findByIdWithRelations(id as string);

  if (!interview) {
    throw new NotFoundError(`Interview not found: ${id}`);
  }

  if (interview.status === 'COMPLETED' || interview.status === 'CANCELLED') {
    throw new BadRequestError(`Interview is already ${interview.status.toLowerCase()}`);
  }

  // Cancel calendar event if exists
  if (interview.calendarEventId) {
    try {
      await calendarService.cancelEvent(interview.calendarEventId, notifyCandidate);
    } catch (error) {
      logger.warn({ error }, 'Failed to cancel calendar event');
    }
  }

  // Update interview status
  const updatedInterview = await interviewRepository.cancel(id as string, reason);

  // Send cancellation email
  if (notifyCandidate && interview.candidate.email) {
    try {
      await emailService.sendTemplateEmail('interview_cancelled', {
        candidateName: interview.candidate.name,
        candidateEmail: interview.candidate.email,
        positionTitle: interview.position.title,
        companyName: 'Company',
        customMessage: reason,
      });
    } catch (error) {
      logger.warn({ error }, 'Failed to send cancellation email');
    }
  }

  logger.info({ interviewId: id }, 'Interview cancelled');

  res.json({
    success: true,
    data: updatedInterview,
  });
}

/**
 * Get upcoming interviews
 */
export async function getUpcomingInterviews(_req: Request, res: Response): Promise<void> {
  const interviews = await interviewRepository.findUpcoming(10);

  res.json({
    success: true,
    data: interviews,
  });
}

/**
 * Update interview stage
 */
export async function updateInterviewStage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { stage } = req.body;

  await interviewRepository.findByIdOrThrow(id as string);

  const updatedInterview = await interviewRepository.advanceStage(id as string, stage);

  logger.info({ interviewId: id, stage }, 'Interview stage updated');

  res.json({
    success: true,
    data: updatedInterview,
  });
}

/**
 * Add score to interview
 */
export async function scoreInterview(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const scoreData = req.body;

  await interviewRepository.findByIdOrThrow(id as string);

  const score = await interviewRepository.setScore({
    interviewId: id as string,
    ...scoreData,
  });

  logger.info({ interviewId: id }, 'Interview scored');

  res.json({
    success: true,
    data: score,
  });
}
