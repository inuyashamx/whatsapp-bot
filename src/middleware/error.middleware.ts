/**
 * Global error handling middleware
 * Provides consistent error responses and logging
 */

import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { logger } from '../config/logger.js';
import { isDevelopment } from '../config/index.js';
import { AppError, isOperationalError } from '../utils/errors.js';
import { ErrorCodes } from '../types/api.js';
import type { ApiResponse, ApiError } from '../types/api.js';

/**
 * Error response builder
 */
function buildErrorResponse(error: AppError, includeStack: boolean): ApiResponse<never> {
  const apiError: ApiError = {
    code: error.code,
    message: error.message,
    details: error.details,
  };

  if (includeStack && error.stack) {
    apiError.stack = error.stack;
  }

  return {
    success: false,
    error: apiError,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Convert unknown errors to AppError
 */
function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(
      error.message,
      ErrorCodes.INTERNAL_ERROR,
      500,
      { originalError: error.name }
    );
  }

  return new AppError(
    'An unexpected error occurred',
    ErrorCodes.INTERNAL_ERROR,
    500
  );
}

/**
 * Main error handling middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const error = normalizeError(err);
  const includeStack = isDevelopment();

  // Log the error
  const logContext = {
    code: error.code,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    ...(error.details && { details: error.details }),
  };

  if (isOperationalError(err)) {
    // Operational errors are expected and handled
    logger.warn(logContext, error.message);
  } else {
    // Programming errors need attention
    logger.error({ ...logContext, stack: error.stack }, error.message);
  }

  // Send response
  const response = buildErrorResponse(error, includeStack);
  res.status(error.statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  const response: ApiResponse<never> = {
    success: false,
    error: {
      code: ErrorCodes.NOT_FOUND,
      message: `Route not found: ${req.method} ${req.path}`,
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  res.status(404).json(response);
}

/**
 * Async handler wrapper to catch async errors
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Uncaught exception handler
 */
export function setupGlobalErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ error: error.message, stack: error.stack }, 'Uncaught exception');
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal({ reason }, 'Unhandled rejection');
    process.exit(1);
  });
}
