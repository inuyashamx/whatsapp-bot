/**
 * Custom error classes for the application
 * Provides consistent error handling across all services
 */

import { ErrorCodes, type ErrorCode } from '../types/api.js';

/**
 * Base application error class
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: ErrorCode = ErrorCodes.INTERNAL_ERROR,
    statusCode = 500,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Bad request error (400)
 */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: Record<string, unknown>) {
    super(message, ErrorCodes.BAD_REQUEST, 400, details);
  }
}

/**
 * Validation error (400)
 */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed', details?: Record<string, unknown>) {
    super(message, ErrorCodes.VALIDATION_ERROR, 400, details);
  }
}

/**
 * Unauthorized error (401)
 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', details?: Record<string, unknown>) {
    super(message, ErrorCodes.UNAUTHORIZED, 401, details);
  }
}

/**
 * Forbidden error (403)
 */
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', details?: Record<string, unknown>) {
    super(message, ErrorCodes.FORBIDDEN, 403, details);
  }
}

/**
 * Not found error (404)
 */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details?: Record<string, unknown>) {
    super(message, ErrorCodes.NOT_FOUND, 404, details);
  }
}

/**
 * Conflict error (409)
 */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: Record<string, unknown>) {
    super(message, ErrorCodes.CONFLICT, 409, details);
  }
}

/**
 * Rate limit error (429)
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details?: Record<string, unknown>) {
    super(message, ErrorCodes.RATE_LIMITED, 429, details);
  }
}

/**
 * Internal server error (500)
 */
export class InternalError extends AppError {
  constructor(message = 'Internal server error', details?: Record<string, unknown>) {
    super(message, ErrorCodes.INTERNAL_ERROR, 500, details);
  }
}

/**
 * Service unavailable error (503)
 */
export class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', details?: Record<string, unknown>) {
    super(message, ErrorCodes.SERVICE_UNAVAILABLE, 503, details);
  }
}

/**
 * External service error (502)
 */
export class ExternalServiceError extends AppError {
  constructor(serviceName: string, message?: string, details?: Record<string, unknown>) {
    super(
      message ?? `External service error: ${serviceName}`,
      ErrorCodes.EXTERNAL_SERVICE_ERROR,
      502,
      { service: serviceName, ...details }
    );
  }
}

/**
 * WhatsApp specific errors
 */
export class WhatsAppError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.WHATSAPP_SEND_FAILED) {
    super(message, code, 502);
  }
}

/**
 * AI service errors
 */
export class AIError extends AppError {
  constructor(message: string, code: ErrorCode = ErrorCodes.AI_GENERATION_FAILED) {
    super(message, code, 502);
  }
}

/**
 * Interview not found error
 */
export class InterviewNotFoundError extends NotFoundError {
  constructor(interviewId: string) {
    super(`Interview not found: ${interviewId}`, {
      interviewId,
    });
    this.code = ErrorCodes.INTERVIEW_NOT_FOUND;
  }
}

/**
 * Candidate not found error
 */
export class CandidateNotFoundError extends NotFoundError {
  constructor(identifier: string) {
    super(`Candidate not found: ${identifier}`, {
      identifier,
    });
    this.code = ErrorCodes.CANDIDATE_NOT_FOUND;
  }
}

/**
 * Session expired error
 */
export class SessionExpiredError extends AppError {
  constructor(message = 'Session has expired') {
    super(message, ErrorCodes.SESSION_EXPIRED, 401);
  }
}

/**
 * Check if error is an operational error (expected, safe to return to client)
 */
export function isOperationalError(error: unknown): error is AppError {
  return error instanceof AppError && error.isOperational;
}
