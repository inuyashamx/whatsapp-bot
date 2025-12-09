/**
 * Candidate repository
 * Handles all database operations for candidates
 */

import type { Candidate, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { CandidateNotFoundError } from '../utils/errors.js';

export interface CreateCandidateInput {
  phoneNumber: string;
  name: string;
  email?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  notes?: string;
}

export interface UpdateCandidateInput {
  name?: string;
  email?: string;
  resumeUrl?: string;
  linkedinUrl?: string;
  notes?: string;
  isActive?: boolean;
}

export interface CandidateFilters {
  isActive?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class CandidateRepository {
  /**
   * Create a new candidate
   */
  async create(data: CreateCandidateInput): Promise<Candidate> {
    return prisma.candidate.create({
      data: {
        phoneNumber: data.phoneNumber,
        name: data.name,
        email: data.email,
        resumeUrl: data.resumeUrl,
        linkedinUrl: data.linkedinUrl,
        notes: data.notes,
      },
    });
  }

  /**
   * Find candidate by ID
   */
  async findById(id: string): Promise<Candidate | null> {
    return prisma.candidate.findUnique({
      where: { id },
    });
  }

  /**
   * Find candidate by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<Candidate> {
    const candidate = await this.findById(id);
    if (!candidate) {
      throw new CandidateNotFoundError(id);
    }
    return candidate;
  }

  /**
   * Find candidate by phone number
   */
  async findByPhoneNumber(phoneNumber: string): Promise<Candidate | null> {
    return prisma.candidate.findUnique({
      where: { phoneNumber },
    });
  }

  /**
   * Find candidate by email
   */
  async findByEmail(email: string): Promise<Candidate | null> {
    return prisma.candidate.findUnique({
      where: { email },
    });
  }

  /**
   * Find or create candidate by phone number
   */
  async findOrCreate(phoneNumber: string, name: string): Promise<Candidate> {
    const existing = await this.findByPhoneNumber(phoneNumber);
    if (existing) {
      return existing;
    }

    return this.create({ phoneNumber, name });
  }

  /**
   * Update candidate
   */
  async update(id: string, data: UpdateCandidateInput): Promise<Candidate> {
    await this.findByIdOrThrow(id);

    return prisma.candidate.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete candidate (soft delete by setting isActive to false)
   */
  async softDelete(id: string): Promise<Candidate> {
    return this.update(id, { isActive: false });
  }

  /**
   * Permanently delete candidate
   */
  async hardDelete(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await prisma.candidate.delete({
      where: { id },
    });
  }

  /**
   * Find all candidates with pagination and filtering
   */
  async findMany(
    filters: CandidateFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{ candidates: Candidate[]; total: number }> {
    const where: Prisma.CandidateWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phoneNumber: { contains: filters.search } },
      ];
    }

    const [candidates, total] = await Promise.all([
      prisma.candidate.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: {
          [pagination.sortBy ?? 'createdAt']: pagination.sortOrder ?? 'desc',
        },
      }),
      prisma.candidate.count({ where }),
    ]);

    return { candidates, total };
  }

  /**
   * Get candidate with their interviews
   */
  async findWithInterviews(id: string): Promise<Candidate & { interviews: unknown[] }> {
    const candidate = await prisma.candidate.findUnique({
      where: { id },
      include: {
        interviews: {
          include: {
            position: true,
            score: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!candidate) {
      throw new CandidateNotFoundError(id);
    }

    return candidate;
  }

  /**
   * Count candidates
   */
  async count(filters: CandidateFilters = {}): Promise<number> {
    const where: Prisma.CandidateWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return prisma.candidate.count({ where });
  }
}

// Export singleton instance
export const candidateRepository = new CandidateRepository();
