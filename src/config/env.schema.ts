/**
 * Environment variable schema with Zod validation
 * Ensures all required configuration is present and correctly typed
 */

import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().min(1).max(65535)).default('3000'),
  API_PREFIX: z.string().default('/api/v1'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Security
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .transform((val) => val.split(',').map((s) => s.trim()))
    .default(''),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.string().transform(Number).default('0'),
  REDIS_MEMORY_TTL: z.string().transform(Number).default('86400'),

  // WhatsApp
  WHATSAPP_API_VERSION: z.string().default('v18.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1, 'WHATSAPP_PHONE_NUMBER_ID is required'),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().min(1, 'WHATSAPP_BUSINESS_ACCOUNT_ID is required'),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1, 'WHATSAPP_ACCESS_TOKEN is required'),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1, 'WHATSAPP_VERIFY_TOKEN is required'),

  // AI Provider
  AI_PROVIDER: z.enum(['openai', 'anthropic']).default('anthropic'),
  OPENAI_API_KEY: z.string().default(''),
  OPENAI_MODEL: z.string().default('gpt-4-turbo-preview'),
  ANTHROPIC_API_KEY: z.string().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-3-5-sonnet-20241022'),
  AI_MAX_TOKENS: z.string().transform(Number).default('4096'),
  AI_TEMPERATURE: z
    .string()
    .transform(Number)
    .pipe(z.number().min(0).max(2))
    .default('0.7'),

  // Google APIs
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  GOOGLE_REDIRECT_URI: z.string().default(''),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().default('primary'),

  // Email
  EMAIL_FROM_NAME: z.string().default('Interview Bot'),
  EMAIL_FROM_ADDRESS: z.string().email().optional().or(z.literal('')),

  // Interview Config
  DEFAULT_LANGUAGE: z.string().default('en'),
  MAX_CONVERSATION_HISTORY: z.string().transform(Number).default('20'),
  INTERVIEW_SESSION_TIMEOUT: z.string().transform(Number).default('60'),
  COMPANY_NAME: z.string().default(''),
  COMPANY_WEBSITE: z.string().default(''),
});

export type EnvSchema = z.infer<typeof envSchema>;

export function validateEnv(): EnvSchema {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors
      .map((err) => `  - ${err.path.join('.')}: ${err.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${errors}`);
  }

  // Additional validation: ensure AI provider has the corresponding API key
  const env = result.data;
  if (env.AI_PROVIDER === 'openai' && !env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is required when AI_PROVIDER is "openai"');
  }
  if (env.AI_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required when AI_PROVIDER is "anthropic"');
  }

  return env;
}
