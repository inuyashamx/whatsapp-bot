/**
 * Interview repository
 * Handles all database operations for interviews
 */

import type {
  Interview,
  InterviewStatus,
  InterviewStage,
  InterviewResponse,
  InterviewScore,
  Prisma,
} from '@prisma/client';
import { prisma } from './prisma.js';
import { InterviewNotFoundError } from '../utils/errors.js';

export interface CreateInterviewInput {
  candidateId: string;
  positionId: string;
  scheduledAt?: Date;
  notes?: string;
}

export interface UpdateInterviewInput {
  status?: InterviewStatus;
  currentStage?: InterviewStage;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  calendarEventId?: string;
  meetingLink?: string;
  notes?: string;
}

export interface CreateInterviewResponseInput {
  interviewId: string;
  question: string;
  answer: string;
  score?: number;
  feedback?: string;
  category?: string;
}

export interface CreateInterviewScoreInput {
  interviewId: string;
  overall: number;
  technicalSkills: number;
  communication: number;
  problemSolving: number;
  cultureFit: number;
  enthusiasm: number;
  recommendation?: string;
  strengths?: string[];
  improvements?: string[];
  summary?: string;
}

export interface InterviewFilters {
  candidateId?: string;
  positionId?: string;
  status?: InterviewStatus;
  scheduledAfter?: Date;
  scheduledBefore?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export type InterviewWithRelations = Interview & {
  candidate: { id: string; name: string; phoneNumber: string; email: string | null };
  position: { id: string; title: string; department: string };
  score: InterviewScore | null;
  responses: InterviewResponse[];
};

export class InterviewRepository {
  /**
   * Create a new interview
   */
  async create(data: CreateInterviewInput): Promise<Interview> {
    return prisma.interview.create({
      data: {
        candidateId: data.candidateId,
        positionId: data.positionId,
        scheduledAt: data.scheduledAt,
        notes: data.notes,
        status: data.scheduledAt ? 'SCHEDULED' : 'PENDING',
      },
    });
  }

  /**
   * Find interview by ID
   */
  async findById(id: string): Promise<Interview | null> {
    return prisma.interview.findUnique({
      where: { id },
    });
  }

  /**
   * Find interview by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<Interview> {
    const interview = await this.findById(id);
    if (!interview) {
      throw new InterviewNotFoundError(id);
    }
    return interview;
  }

  /**
   * Find interview with all relations
   */
  async findByIdWithRelations(id: string): Promise<InterviewWithRelations | null> {
    return prisma.interview.findUnique({
      where: { id },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
          },
        },
        position: {
          select: {
            id: true,
            title: true,
            department: true,
          },
        },
        score: true,
        responses: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  }

  /**
   * Update interview
   */
  async update(id: string, data: UpdateInterviewInput): Promise<Interview> {
    await this.findByIdOrThrow(id);

    return prisma.interview.update({
      where: { id },
      data,
    });
  }

  /**
   * Start an interview (set status to IN_PROGRESS)
   */
  async start(id: string): Promise<Interview> {
    return this.update(id, {
      status: 'IN_PROGRESS',
      startedAt: new Date(),
    });
  }

  /**
   * Complete an interview
   */
  async complete(id: string): Promise<Interview> {
    return this.update(id, {
      status: 'COMPLETED',
      completedAt: new Date(),
      currentStage: 'CLOSING',
    });
  }

  /**
   * Cancel an interview
   */
  async cancel(id: string, reason?: string): Promise<Interview> {
    return this.update(id, {
      status: 'CANCELLED',
      notes: reason,
    });
  }

  /**
   * Advance to next interview stage
   */
  async advanceStage(id: string, stage: InterviewStage): Promise<Interview> {
    return this.update(id, {
      currentStage: stage,
    });
  }

  /**
   * Find active interview for candidate
   */
  async findActiveForCandidate(candidateId: string): Promise<Interview | null> {
    return prisma.interview.findFirst({
      where: {
        candidateId,
        status: {
          in: ['PENDING', 'SCHEDULED', 'IN_PROGRESS'],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Find all interviews with pagination and filtering
   */
  async findMany(
    filters: InterviewFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{ interviews: InterviewWithRelations[]; total: number }> {
    const where: Prisma.InterviewWhereInput = {};

    if (filters.candidateId) {
      where.candidateId = filters.candidateId;
    }

    if (filters.positionId) {
      where.positionId = filters.positionId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.scheduledAfter || filters.scheduledBefore) {
      where.scheduledAt = {};
      if (filters.scheduledAfter) {
        where.scheduledAt.gte = filters.scheduledAfter;
      }
      if (filters.scheduledBefore) {
        where.scheduledAt.lte = filters.scheduledBefore;
      }
    }

    const [interviews, total] = await Promise.all([
      prisma.interview.findMany({
        where,
        include: {
          candidate: {
            select: {
              id: true,
              name: true,
              phoneNumber: true,
              email: true,
            },
          },
          position: {
            select: {
              id: true,
              title: true,
              department: true,
            },
          },
          score: true,
          responses: {
            orderBy: { timestamp: 'asc' },
          },
        },
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: {
          [pagination.sortBy ?? 'createdAt']: pagination.sortOrder ?? 'desc',
        },
      }),
      prisma.interview.count({ where }),
    ]);

    return { interviews, total };
  }

  /**
   * Get upcoming interviews
   */
  async findUpcoming(limit = 10): Promise<InterviewWithRelations[]> {
    return prisma.interview.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: {
          gte: new Date(),
        },
      },
      include: {
        candidate: {
          select: {
            id: true,
            name: true,
            phoneNumber: true,
            email: true,
          },
        },
        position: {
          select: {
            id: true,
            title: true,
            department: true,
          },
        },
        score: true,
        responses: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Add interview response
   */
  async addResponse(data: CreateInterviewResponseInput): Promise<InterviewResponse> {
    return prisma.interviewResponse.create({
      data,
    });
  }

  /**
   * Get all responses for an interview
   */
  async getResponses(interviewId: string): Promise<InterviewResponse[]> {
    return prisma.interviewResponse.findMany({
      where: { interviewId },
      orderBy: { timestamp: 'asc' },
    });
  }

  /**
   * Create or update interview score
   */
  async setScore(data: CreateInterviewScoreInput): Promise<InterviewScore> {
    return prisma.interviewScore.upsert({
      where: { interviewId: data.interviewId },
      update: {
        overall: data.overall,
        technicalSkills: data.technicalSkills,
        communication: data.communication,
        problemSolving: data.problemSolving,
        cultureFit: data.cultureFit,
        enthusiasm: data.enthusiasm,
        recommendation: data.recommendation,
        strengths: data.strengths ?? [],
        improvements: data.improvements ?? [],
        summary: data.summary,
      },
      create: {
        interviewId: data.interviewId,
        overall: data.overall,
        technicalSkills: data.technicalSkills,
        communication: data.communication,
        problemSolving: data.problemSolving,
        cultureFit: data.cultureFit,
        enthusiasm: data.enthusiasm,
        recommendation: data.recommendation,
        strengths: data.strengths ?? [],
        improvements: data.improvements ?? [],
        summary: data.summary,
      },
    });
  }

  /**
   * Delete interview
   */
  async delete(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await prisma.interview.delete({
      where: { id },
    });
  }

  /**
   * Count interviews
   */
  async count(filters: InterviewFilters = {}): Promise<number> {
    const where: Prisma.InterviewWhereInput = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.candidateId) {
      where.candidateId = filters.candidateId;
    }

    return prisma.interview.count({ where });
  }
}

// Export singleton instance
export const interviewRepository = new InterviewRepository();
