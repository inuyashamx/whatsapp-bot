/**
 * Application configuration
 * Loads and validates environment variables, then exports a typed config object
 */

import { config as dotenvConfig } from 'dotenv';
import { validateEnv } from './env.schema.js';
import type { Config } from '../types/config.js';

// Load environment variables from .env file
dotenvConfig();

// Validate and get environment variables
const env = validateEnv();

/**
 * Application configuration object
 * All configuration values are validated and typed
 */
export const config: Config = {
  app: {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    logLevel: env.LOG_LEVEL,
  },

  security: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    corsOrigins: env.CORS_ORIGINS,
    rateLimitWindowMs: env.RATE_LIMIT_WINDOW_MS,
    rateLimitMaxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  database: {
    url: env.DATABASE_URL,
  },

  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
    memoryTtl: env.REDIS_MEMORY_TTL,
  },

  whatsapp: {
    apiVersion: env.WHATSAPP_API_VERSION,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    verifyToken: env.WHATSAPP_VERIFY_TOKEN,
  },

  ai: {
    provider: env.AI_PROVIDER,
    openai: {
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY,
      model: env.ANTHROPIC_MODEL,
    },
    maxTokens: env.AI_MAX_TOKENS,
    temperature: env.AI_TEMPERATURE,
  },

  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    serviceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    calendarId: env.GOOGLE_CALENDAR_ID,
  },

  email: {
    fromName: env.EMAIL_FROM_NAME,
    fromAddress: env.EMAIL_FROM_ADDRESS ?? '',
  },

  interview: {
    defaultLanguage: env.DEFAULT_LANGUAGE,
    maxConversationHistory: env.MAX_CONVERSATION_HISTORY,
    sessionTimeout: env.INTERVIEW_SESSION_TIMEOUT,
    companyName: env.COMPANY_NAME,
    companyWebsite: env.COMPANY_WEBSITE,
  },
};

/**
 * Check if running in production
 */
export const isProduction = (): boolean => config.app.nodeEnv === 'production';

/**
 * Check if running in development
 */
export const isDevelopment = (): boolean => config.app.nodeEnv === 'development';

/**
 * Check if running in test
 */
export const isTest = (): boolean => config.app.nodeEnv === 'test';

export default config;
