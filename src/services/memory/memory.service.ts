/**
 * Memory service for conversation context
 * Uses Redis for fast access and automatic TTL management
 */

import type { ChatMessage, ConversationMemory } from '../../types/ai.js';
import type { InterviewSession, InterviewContext } from '../../types/interview.js';
import { getRedisClient } from './redis.client.js';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';

// Redis key prefixes for organization
const KEYS = {
  CONVERSATION: 'conv:',
  SESSION: 'session:',
  CONTEXT: 'context:',
  LOCK: 'lock:',
} as const;

export class MemoryService {
  private readonly ttl: number;

  constructor() {
    this.ttl = config.redis.memoryTtl;
  }

  private get redis() {
    return getRedisClient();
  }

  // ============================================================================
  // CONVERSATION MEMORY
  // ============================================================================

  /**
   * Get conversation key for a phone number
   */
  private getConversationKey(phoneNumber: string): string {
    return `${KEYS.CONVERSATION}${phoneNumber}`;
  }

  /**
   * Save a message to conversation history
   */
  async addMessage(phoneNumber: string, message: ChatMessage): Promise<void> {
    const key = this.getConversationKey(phoneNumber);

    const messageWithTimestamp: ChatMessage = {
      ...message,
      timestamp: message.timestamp ?? new Date(),
    };

    await this.redis.rpush(key, JSON.stringify(messageWithTimestamp));

    // Trim to max conversation history
    const maxHistory = config.interview.maxConversationHistory;
    await this.redis.ltrim(key, -maxHistory, -1);

    // Reset TTL
    await this.redis.expire(key, this.ttl);

    logger.debug({ phoneNumber, role: message.role }, 'Message added to conversation');
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    phoneNumber: string,
    limit?: number
  ): Promise<ChatMessage[]> {
    const key = this.getConversationKey(phoneNumber);
    const effectiveLimit = limit ?? config.interview.maxConversationHistory;

    const messages = await this.redis.lrange(key, -effectiveLimit, -1);

    return messages.map((msg) => JSON.parse(msg) as ChatMessage);
  }

  /**
   * Clear conversation history
   */
  async clearConversation(phoneNumber: string): Promise<void> {
    const key = this.getConversationKey(phoneNumber);
    await this.redis.del(key);
    logger.debug({ phoneNumber }, 'Conversation cleared');
  }

  /**
   * Get conversation memory object
   */
  async getConversationMemory(phoneNumber: string): Promise<ConversationMemory | null> {
    const messages = await this.getConversationHistory(phoneNumber);

    if (messages.length === 0) {
      return null;
    }

    const firstMessage = messages[0];
    const lastMessage = messages[messages.length - 1];

    return {
      sessionId: phoneNumber,
      messages,
      createdAt: firstMessage?.timestamp ?? new Date(),
      updatedAt: lastMessage?.timestamp ?? new Date(),
    };
  }

  // ============================================================================
  // INTERVIEW SESSION
  // ============================================================================

  /**
   * Get session key for an interview
   */
  private getSessionKey(interviewId: string): string {
    return `${KEYS.SESSION}${interviewId}`;
  }

  /**
   * Save interview session
   */
  async saveSession(session: InterviewSession): Promise<void> {
    const key = this.getSessionKey(session.interviewId);
    await this.redis.setex(key, this.ttl, JSON.stringify(session));
    logger.debug({ interviewId: session.interviewId }, 'Session saved');
  }

  /**
   * Get interview session
   */
  async getSession(interviewId: string): Promise<InterviewSession | null> {
    const key = this.getSessionKey(interviewId);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as InterviewSession;
  }

  /**
   * Update session activity timestamp
   */
  async touchSession(interviewId: string): Promise<void> {
    const session = await this.getSession(interviewId);
    if (session) {
      session.lastActivityAt = new Date();
      await this.saveSession(session);
    }
  }

  /**
   * Delete interview session
   */
  async deleteSession(interviewId: string): Promise<void> {
    const key = this.getSessionKey(interviewId);
    await this.redis.del(key);
    logger.debug({ interviewId }, 'Session deleted');
  }

  /**
   * Check if session is expired
   */
  async isSessionExpired(interviewId: string): Promise<boolean> {
    const session = await this.getSession(interviewId);
    if (!session) {
      return true;
    }

    const timeoutMs = config.interview.sessionTimeout * 60 * 1000;
    const lastActivity = new Date(session.lastActivityAt).getTime();
    const now = Date.now();

    return now - lastActivity > timeoutMs;
  }

  // ============================================================================
  // INTERVIEW CONTEXT
  // ============================================================================

  /**
   * Get context key for an interview
   */
  private getContextKey(interviewId: string): string {
    return `${KEYS.CONTEXT}${interviewId}`;
  }

  /**
   * Save interview context
   */
  async saveContext(interviewId: string, context: InterviewContext): Promise<void> {
    const key = this.getContextKey(interviewId);
    await this.redis.setex(key, this.ttl, JSON.stringify(context));
  }

  /**
   * Get interview context
   */
  async getContext(interviewId: string): Promise<InterviewContext | null> {
    const key = this.getContextKey(interviewId);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    return JSON.parse(data) as InterviewContext;
  }

  /**
   * Update interview context
   */
  async updateContext(
    interviewId: string,
    updates: Partial<InterviewContext>
  ): Promise<InterviewContext | null> {
    const context = await this.getContext(interviewId);
    if (!context) {
      return null;
    }

    const updatedContext = { ...context, ...updates };
    await this.saveContext(interviewId, updatedContext);
    return updatedContext;
  }

  /**
   * Add key point to context
   */
  async addKeyPoint(interviewId: string, point: string): Promise<void> {
    const context = await this.getContext(interviewId);
    if (context) {
      context.keyPoints.push(point);
      await this.saveContext(interviewId, context);
    }
  }

  /**
   * Add red flag to context
   */
  async addRedFlag(interviewId: string, flag: string): Promise<void> {
    const context = await this.getContext(interviewId);
    if (context) {
      context.redFlags.push(flag);
      await this.saveContext(interviewId, context);
    }
  }

  /**
   * Add highlight to context
   */
  async addHighlight(interviewId: string, highlight: string): Promise<void> {
    const context = await this.getContext(interviewId);
    if (context) {
      context.highlights.push(highlight);
      await this.saveContext(interviewId, context);
    }
  }

  // ============================================================================
  // LOCKING (for distributed processing)
  // ============================================================================

  /**
   * Acquire a lock for processing
   */
  async acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
    const lockKey = `${KEYS.LOCK}${key}`;
    const result = await this.redis.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
    return result === 'OK';
  }

  /**
   * Release a lock
   */
  async releaseLock(key: string): Promise<void> {
    const lockKey = `${KEYS.LOCK}${key}`;
    await this.redis.del(lockKey);
  }

  /**
   * Execute with lock
   */
  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: { ttl?: number; waitMs?: number; maxAttempts?: number } = {}
  ): Promise<T> {
    const { ttl = 30, waitMs = 100, maxAttempts = 50 } = options;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (await this.acquireLock(key, ttl)) {
        try {
          return await fn();
        } finally {
          await this.releaseLock(key);
        }
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    throw new Error(`Failed to acquire lock for key: ${key}`);
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    return this.redis.ttl(key);
  }

  /**
   * Clear all data for a phone number (GDPR compliance)
   */
  async clearAllUserData(phoneNumber: string): Promise<void> {
    const patterns = [
      this.getConversationKey(phoneNumber),
    ];

    for (const pattern of patterns) {
      await this.redis.del(pattern);
    }

    logger.info({ phoneNumber: phoneNumber.slice(0, 5) + '***' }, 'User data cleared');
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
