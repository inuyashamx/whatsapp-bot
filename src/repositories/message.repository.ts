/**
 * Message repository
 * Handles all database operations for messages
 */

import type { Message, MessageRole, MessageDirection, Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export interface CreateMessageInput {
  candidateId: string;
  interviewId?: string;
  whatsappMessageId?: string;
  role: MessageRole;
  direction: MessageDirection;
  content: string;
  messageType?: string;
  mediaUrl?: string;
  tokensUsed?: number;
  aiModel?: string;
  processingTimeMs?: number;
  metadata?: Record<string, unknown>;
}

export interface MessageFilters {
  candidateId?: string;
  interviewId?: string;
  role?: MessageRole;
  direction?: MessageDirection;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortOrder?: 'asc' | 'desc';
}

export class MessageRepository {
  /**
   * Create a new message
   */
  async create(data: CreateMessageInput): Promise<Message> {
    return prisma.message.create({
      data: {
        candidateId: data.candidateId,
        interviewId: data.interviewId,
        whatsappMessageId: data.whatsappMessageId,
        role: data.role,
        direction: data.direction,
        content: data.content,
        messageType: data.messageType ?? 'text',
        mediaUrl: data.mediaUrl,
        tokensUsed: data.tokensUsed,
        aiModel: data.aiModel,
        processingTimeMs: data.processingTimeMs,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  /**
   * Create user message
   */
  async createUserMessage(
    candidateId: string,
    content: string,
    whatsappMessageId?: string,
    interviewId?: string
  ): Promise<Message> {
    return this.create({
      candidateId,
      interviewId,
      whatsappMessageId,
      role: 'USER',
      direction: 'INBOUND',
      content,
    });
  }

  /**
   * Create assistant message
   */
  async createAssistantMessage(
    candidateId: string,
    content: string,
    options: {
      interviewId?: string;
      whatsappMessageId?: string;
      tokensUsed?: number;
      aiModel?: string;
      processingTimeMs?: number;
    } = {}
  ): Promise<Message> {
    return this.create({
      candidateId,
      interviewId: options.interviewId,
      whatsappMessageId: options.whatsappMessageId,
      role: 'ASSISTANT',
      direction: 'OUTBOUND',
      content,
      tokensUsed: options.tokensUsed,
      aiModel: options.aiModel,
      processingTimeMs: options.processingTimeMs,
    });
  }

  /**
   * Find message by ID
   */
  async findById(id: string): Promise<Message | null> {
    return prisma.message.findUnique({
      where: { id },
    });
  }

  /**
   * Find message by WhatsApp message ID
   */
  async findByWhatsAppId(whatsappMessageId: string): Promise<Message | null> {
    return prisma.message.findUnique({
      where: { whatsappMessageId },
    });
  }

  /**
   * Check if message already processed (deduplication)
   */
  async exists(whatsappMessageId: string): Promise<boolean> {
    const message = await this.findByWhatsAppId(whatsappMessageId);
    return message !== null;
  }

  /**
   * Get conversation history for a candidate
   */
  async getConversationHistory(
    candidateId: string,
    limit = 20,
    interviewId?: string
  ): Promise<Message[]> {
    const where: Prisma.MessageWhereInput = { candidateId };

    if (interviewId) {
      where.interviewId = interviewId;
    }

    return prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    }).then((messages) => messages.reverse());
  }

  /**
   * Find messages with pagination and filtering
   */
  async findMany(
    filters: MessageFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 50 }
  ): Promise<{ messages: Message[]; total: number }> {
    const where: Prisma.MessageWhereInput = {};

    if (filters.candidateId) {
      where.candidateId = filters.candidateId;
    }

    if (filters.interviewId) {
      where.interviewId = filters.interviewId;
    }

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.direction) {
      where.direction = filters.direction;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate;
      }
    }

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
        orderBy: { createdAt: pagination.sortOrder ?? 'desc' },
      }),
      prisma.message.count({ where }),
    ]);

    return { messages, total };
  }

  /**
   * Get message count for candidate
   */
  async countForCandidate(candidateId: string): Promise<number> {
    return prisma.message.count({
      where: { candidateId },
    });
  }

  /**
   * Get message count for interview
   */
  async countForInterview(interviewId: string): Promise<number> {
    return prisma.message.count({
      where: { interviewId },
    });
  }

  /**
   * Get total tokens used for interview
   */
  async getTotalTokensForInterview(interviewId: string): Promise<number> {
    const result = await prisma.message.aggregate({
      where: { interviewId },
      _sum: { tokensUsed: true },
    });

    return result._sum.tokensUsed ?? 0;
  }

  /**
   * Update message status
   */
  async updateStatus(id: string, status: string): Promise<Message> {
    return prisma.message.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Delete messages for candidate
   */
  async deleteForCandidate(candidateId: string): Promise<number> {
    const result = await prisma.message.deleteMany({
      where: { candidateId },
    });
    return result.count;
  }

  /**
   * Delete messages for interview
   */
  async deleteForInterview(interviewId: string): Promise<number> {
    const result = await prisma.message.deleteMany({
      where: { interviewId },
    });
    return result.count;
  }
}

// Export singleton instance
export const messageRepository = new MessageRepository();
