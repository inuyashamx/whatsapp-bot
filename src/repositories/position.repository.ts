/**
 * Job Position repository
 * Handles all database operations for job positions
 */

import type { JobPosition, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { NotFoundError } from '../utils/errors.js';

export interface CreatePositionInput {
  title: string;
  department: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  location: string;
  isRemote?: boolean;
}

export interface UpdatePositionInput {
  title?: string;
  department?: string;
  description?: string;
  requirements?: string[];
  responsibilities?: string[];
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  location?: string;
  isRemote?: boolean;
  isActive?: boolean;
}

export interface PositionFilters {
  isActive?: boolean;
  department?: string;
  isRemote?: boolean;
  search?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class PositionRepository {
  /**
   * Create a new position
   */
  async create(data: CreatePositionInput): Promise<JobPosition> {
    return prisma.jobPosition.create({
      data: {
        title: data.title,
        department: data.department,
        description: data.description,
        requirements: data.requirements,
        responsibilities: data.responsibilities,
        salaryMin: data.salaryMin,
        salaryMax: data.salaryMax,
        salaryCurrency: data.salaryCurrency ?? 'USD',
        location: data.location,
        isRemote: data.isRemote ?? false,
      },
    });
  }

  /**
   * Find position by ID
   */
  async findById(id: string): Promise<JobPosition | null> {
    return prisma.jobPosition.findUnique({
      where: { id },
    });
  }

  /**
   * Find position by ID or throw error
   */
  async findByIdOrThrow(id: string): Promise<JobPosition> {
    const position = await this.findById(id);
    if (!position) {
      throw new NotFoundError(`Position not found: ${id}`);
    }
    return position;
  }

  /**
   * Update position
   */
  async update(id: string, data: UpdatePositionInput): Promise<JobPosition> {
    await this.findByIdOrThrow(id);

    return prisma.jobPosition.update({
      where: { id },
      data,
    });
  }

  /**
   * Deactivate position
   */
  async deactivate(id: string): Promise<JobPosition> {
    return this.update(id, { isActive: false });
  }

  /**
   * Activate position
   */
  async activate(id: string): Promise<JobPosition> {
    return this.update(id, { isActive: true });
  }

  /**
   * Delete position
   */
  async delete(id: string): Promise<void> {
    await this.findByIdOrThrow(id);
    await prisma.jobPosition.delete({
      where: { id },
    });
  }

  /**
   * Find all positions with pagination and filtering
   */
  async findMany(
    filters: PositionFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 20 }
  ): Promise<{ positions: JobPosition[]; total: number }> {
    const where: Prisma.JobPositionWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.department) {
      where.department = filters.department;
    }

    if (filters.isRemote !== undefined) {
      where.isRemote = filters.isRemote;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
        { department: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [positions, total] = await Promise.all([
      prisma.jobPosition.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: {
          [pagination.sortBy ?? 'createdAt']: pagination.sortOrder ?? 'desc',
        },
      }),
      prisma.jobPosition.count({ where }),
    ]);

    return { positions, total };
  }

  /**
   * Find all active positions
   */
  async findActive(): Promise<JobPosition[]> {
    return prisma.jobPosition.findMany({
      where: { isActive: true },
      orderBy: { title: 'asc' },
    });
  }

  /**
   * Get unique departments
   */
  async getDepartments(): Promise<string[]> {
    const departments = await prisma.jobPosition.findMany({
      where: { isActive: true },
      select: { department: true },
      distinct: ['department'],
    });

    return departments.map((d) => d.department);
  }

  /**
   * Count positions
   */
  async count(filters: PositionFilters = {}): Promise<number> {
    const where: Prisma.JobPositionWhereInput = {};

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return prisma.jobPosition.count({ where });
  }
}

// Export singleton instance
export const positionRepository = new PositionRepository();
