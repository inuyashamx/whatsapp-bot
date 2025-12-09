/**
 * Configuration types for the application
 */

export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  apiPrefix: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
}

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
}

export interface DatabaseConfig {
  url: string;
}

export interface RedisConfig {
  host: string;
  port: number;
  password: string;
  db: number;
  memoryTtl: number;
}

export interface WhatsAppConfig {
  apiVersion: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  verifyToken: string;
}

export type AIProvider = 'openai' | 'anthropic';

export interface AIConfig {
  provider: AIProvider;
  openai: {
    apiKey: string;
    model: string;
  };
  anthropic: {
    apiKey: string;
    model: string;
  };
  maxTokens: number;
  temperature: number;
}

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  serviceAccountEmail?: string;
  privateKey?: string;
  calendarId: string;
}

export interface EmailConfig {
  fromName: string;
  fromAddress: string;
}

export interface InterviewConfig {
  defaultLanguage: string;
  maxConversationHistory: number;
  sessionTimeout: number;
  companyName: string;
  companyWebsite: string;
}

export interface Config {
  app: AppConfig;
  security: SecurityConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  whatsapp: WhatsAppConfig;
  ai: AIConfig;
  google: GoogleConfig;
  email: EmailConfig;
  interview: InterviewConfig;
}
