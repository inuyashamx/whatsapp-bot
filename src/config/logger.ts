/**
 * Application logger configuration using Pino
 * Provides structured JSON logging with request context
 */

import pino from 'pino';
import { config, isDevelopment } from './index.js';

/**
 * Create base logger instance with environment-appropriate configuration
 */
export const logger = pino({
  level: config.app.logLevel,
  ...(isDevelopment()
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        formatters: {
          level: (label) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
  base: {
    service: 'whatsapp-interview-bot',
    version: process.env['npm_package_version'] ?? '1.0.0',
  },
});

/**
 * Create a child logger with additional context
 */
export function createChildLogger(context: Record<string, unknown>): pino.Logger {
  return logger.child(context);
}

/**
 * Create a request-scoped logger
 */
export function createRequestLogger(requestId: string, phoneNumber?: string): pino.Logger {
  return logger.child({
    requestId,
    ...(phoneNumber && { phoneNumber: maskPhoneNumber(phoneNumber) }),
  });
}

/**
 * Mask phone number for logging (privacy)
 */
function maskPhoneNumber(phone: string): string {
  if (phone.length < 8) {
    return '***';
  }
  return `${phone.slice(0, 3)}***${phone.slice(-3)}`;
}

export default logger;
