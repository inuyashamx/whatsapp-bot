/**
 * AI-related types for LangChain integration
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  messageId?: string;
  interviewId?: string;
  stage?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  intent?: string;
  entities?: Record<string, string>;
  tokens?: number;
}

export interface ConversationMemory {
  sessionId: string;
  messages: ChatMessage[];
  summary?: string;
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface AIGenerateRequest {
  sessionId: string;
  userMessage: string;
  systemPrompt?: string;
  context?: AIContext;
  options?: AIGenerateOptions;
}

export interface AIContext {
  candidateName?: string;
  positionTitle?: string;
  companyName?: string;
  interviewStage?: string;
  previousResponses?: string[];
  customInstructions?: string;
  tools?: AITool[];
}

export interface AIGenerateOptions {
  maxTokens?: number;
  temperature?: number;
  stopSequences?: string[];
  stream?: boolean;
}

export interface AIGenerateResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_use' | 'error';
  usage: TokenUsage;
  toolCalls?: AIToolCall[];
  metadata?: Record<string, unknown>;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AITool {
  name: string;
  description: string;
  parameters: AIToolParameters;
}

export interface AIToolParameters {
  type: 'object';
  properties: Record<string, AIToolProperty>;
  required?: string[];
}

export interface AIToolProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[];
  items?: AIToolProperty;
}

export interface AIToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface AIToolResult {
  toolCallId: string;
  result: unknown;
  error?: string;
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  variables: string[];
  category: 'interview' | 'scheduling' | 'followup' | 'general';
}

export interface InterviewPromptContext {
  candidateName: string;
  positionTitle: string;
  positionDescription: string;
  positionRequirements: string[];
  companyName: string;
  companyDescription: string;
  interviewStage: string;
  previousQuestions: string[];
  candidateResponses: string[];
  timeRemaining?: number;
  specialInstructions?: string;
}

export interface SentimentAnalysis {
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
  aspects: SentimentAspect[];
}

export interface SentimentAspect {
  aspect: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  keywords: string[];
}

export interface IntentClassification {
  intent: string;
  confidence: number;
  entities: IntentEntity[];
}

export interface IntentEntity {
  name: string;
  value: string;
  type: string;
  start: number;
  end: number;
}

export interface AIStreamChunk {
  type: 'content' | 'tool_call' | 'error' | 'done';
  content?: string;
  toolCall?: Partial<AIToolCall>;
  error?: string;
}
