/**
 * Request validation middleware using Zod
 * Provides type-safe validation for request bodies, params, and queries
 */

import type { Request, Response, NextFunction } from 'express';
import { z, type ZodSchema, type ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

/**
 * Validation target types
 */
type ValidationTarget = 'body' | 'params' | 'query';

/**
 * Format Zod errors into a readable structure
 */
function formatZodErrors(error: ZodError): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.join('.') || 'root';
    if (!errors[path]) {
      errors[path] = [];
    }
    errors[path].push(issue.message);
  }

  return errors;
}

/**
 * Create validation middleware for a specific target
 */
export function validate<T extends ZodSchema>(
  schema: T,
  target: ValidationTarget = 'body'
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = req[target];
      const result = schema.safeParse(data);

      if (!result.success) {
        const errors = formatZodErrors(result.error);
        throw new ValidationError(`Validation failed for ${target}`, { errors });
      }

      // Replace with parsed/transformed data
      req[target] = result.data;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Validate request body
 */
export function validateBody<T extends ZodSchema>(
  schema: T
): (req: Request, res: Response, next: NextFunction) => void {
  return validate(schema, 'body');
}

/**
 * Validate request params
 */
export function validateParams<T extends ZodSchema>(
  schema: T
): (req: Request, res: Response, next: NextFunction) => void {
  return validate(schema, 'params');
}

/**
 * Validate request query
 */
export function validateQuery<T extends ZodSchema>(
  schema: T
): (req: Request, res: Response, next: NextFunction) => void {
  return validate(schema, 'query');
}

// ============================================================================
// COMMON VALIDATION SCHEMAS
// ============================================================================

/**
 * UUID validation
 */
export const uuidSchema = z.string().uuid('Invalid UUID format');

/**
 * Phone number validation (E.164 format)
 */
export const phoneNumberSchema = z
  .string()
  .regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format');

/**
 * Email validation
 */
export const emailSchema = z.string().email('Invalid email format');

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().min(1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20))
    .pipe(z.number().min(1).max(100)),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

/**
 * ID param schema
 */
export const idParamSchema = z.object({
  id: uuidSchema,
});

/**
 * WhatsApp webhook payload schema
 */
export const whatsappWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          value: z.object({
            messaging_product: z.literal('whatsapp'),
            metadata: z.object({
              display_phone_number: z.string(),
              phone_number_id: z.string(),
            }),
            contacts: z
              .array(
                z.object({
                  profile: z.object({
                    name: z.string(),
                  }),
                  wa_id: z.string(),
                })
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string(),
                  type: z.string(),
                  text: z.object({ body: z.string() }).optional(),
                  image: z.object({ id: z.string() }).optional(),
                  audio: z.object({ id: z.string() }).optional(),
                  interactive: z.object({}).passthrough().optional(),
                  button: z.object({ text: z.string() }).optional(),
                })
              )
              .optional(),
            statuses: z.array(z.object({}).passthrough()).optional(),
          }),
          field: z.literal('messages'),
        })
      ),
    })
  ),
});

/**
 * Create candidate schema
 */
export const createCandidateSchema = z.object({
  phoneNumber: phoneNumberSchema,
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: emailSchema.optional(),
  resumeUrl: z.string().url('Invalid URL').optional(),
  linkedinUrl: z.string().url('Invalid URL').optional(),
});

/**
 * Update candidate schema
 */
export const updateCandidateSchema = z.object({
  name: z.string().min(2).optional(),
  email: emailSchema.optional(),
  resumeUrl: z.string().url().optional(),
  linkedinUrl: z.string().url().optional(),
  notes: z.string().optional(),
});

/**
 * Create interview schema
 */
export const createInterviewSchema = z.object({
  candidateId: uuidSchema,
  positionId: uuidSchema,
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

/**
 * Schedule interview schema
 */
export const scheduleInterviewSchema = z.object({
  candidateId: uuidSchema,
  positionId: uuidSchema,
  startTime: z.string().datetime('Invalid datetime format'),
  duration: z.number().min(15).max(120).default(60),
  timeZone: z.string().default('UTC'),
  includeVideoConference: z.boolean().default(true),
  attendeeEmails: z.array(emailSchema).optional(),
  notes: z.string().optional(),
});

/**
 * Create position schema
 */
export const createPositionSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  department: z.string().min(2),
  description: z.string().min(10),
  requirements: z.array(z.string()).min(1),
  responsibilities: z.array(z.string()).min(1),
  salaryMin: z.number().positive().optional(),
  salaryMax: z.number().positive().optional(),
  salaryCurrency: z.string().length(3).default('USD'),
  location: z.string().min(2),
  isRemote: z.boolean().default(false),
});

/**
 * Send message schema
 */
export const sendMessageSchema = z.object({
  to: phoneNumberSchema,
  message: z.string().min(1, 'Message cannot be empty').max(4096),
});
