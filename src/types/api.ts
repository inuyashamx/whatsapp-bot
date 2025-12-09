/**
 * API request/response types
 */

import type { Request, Response, NextFunction, ParamsDictionary } from 'express-serve-static-core';
import type { ParsedQs } from 'qs';

// Express extended types
export interface TypedRequest<
  TBody = unknown,
  TParams extends ParamsDictionary = ParamsDictionary,
  TQuery extends ParsedQs = ParsedQs
> extends Request<TParams, unknown, TBody, TQuery> {}

export interface TypedResponse<TData = unknown> extends Response {
  json: (body: ApiResponse<TData>) => this;
}

export type AsyncHandler<TReq = Request, TRes = Response> = (
  req: TReq,
  res: TRes,
  next: NextFunction
) => Promise<void>;

// Standard API response
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  timestamp?: string;
  requestId?: string;
}

// Pagination
export interface PaginationQuery {
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

// Health check
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  services: ServiceHealth[];
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy';
  latency?: number;
  message?: string;
}

// Authentication
export interface JWTPayload {
  sub: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  phoneNumber: string;
  name: string;
  role: 'candidate' | 'admin';
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

// Webhook verification
export interface WebhookVerificationQuery {
  'hub.mode': string;
  'hub.verify_token': string;
  'hub.challenge': string;
}

// Error codes
export const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Business logic errors
  INTERVIEW_NOT_FOUND: 'INTERVIEW_NOT_FOUND',
  CANDIDATE_NOT_FOUND: 'CANDIDATE_NOT_FOUND',
  POSITION_NOT_FOUND: 'POSITION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INVALID_INTERVIEW_STATE: 'INVALID_INTERVIEW_STATE',
  SCHEDULING_CONFLICT: 'SCHEDULING_CONFLICT',

  // WhatsApp errors
  WHATSAPP_SEND_FAILED: 'WHATSAPP_SEND_FAILED',
  WHATSAPP_INVALID_PHONE: 'WHATSAPP_INVALID_PHONE',
  WHATSAPP_RATE_LIMITED: 'WHATSAPP_RATE_LIMITED',

  // AI errors
  AI_GENERATION_FAILED: 'AI_GENERATION_FAILED',
  AI_CONTEXT_TOO_LONG: 'AI_CONTEXT_TOO_LONG',
  AI_RATE_LIMITED: 'AI_RATE_LIMITED',

  // Google API errors
  CALENDAR_ERROR: 'CALENDAR_ERROR',
  EMAIL_ERROR: 'EMAIL_ERROR',
  GOOGLE_AUTH_ERROR: 'GOOGLE_AUTH_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
