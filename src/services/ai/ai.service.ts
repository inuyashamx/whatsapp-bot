/**
 * AI Service using LangChain
 * Handles conversation generation and interview logic
 */

import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import {
  HumanMessage,
  SystemMessage,
  AIMessage,
  type BaseMessage,
} from '@langchain/core/messages';
import { StringOutputParser } from '@langchain/core/output_parsers';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { AIError } from '../../utils/errors.js';
import type { ChatMessage, AIGenerateResponse, TokenUsage } from '../../types/ai.js';
import type { InterviewStage } from '../../types/interview.js';
import {
  getInterviewSystemPrompt,
  getRecruiterSystemPrompt,
  getSummaryGenerationPrompt,
  type InterviewPromptVariables,
} from './prompts.js';

// Types for scheduling actions
export interface ScheduleAction {
  action: 'schedule_interview';
  candidateName: string;
  candidateEmail: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  positionTitle: string;
  timezone?: string;
}

export interface AIRecruiterResponse {
  content: string;
  action?: ScheduleAction;
  tokensUsed: number;
}

export class AIService {
  private model: BaseChatModel;
  private readonly outputParser: StringOutputParser;

  constructor() {
    this.model = this.initializeModel();
    this.outputParser = new StringOutputParser();
  }

  /**
   * Initialize the AI model based on configuration
   */
  private initializeModel(): BaseChatModel {
    if (config.ai.provider === 'anthropic') {
      return new ChatAnthropic({
        apiKey: config.ai.anthropic.apiKey,
        model: config.ai.anthropic.model,
        maxTokens: config.ai.maxTokens,
        temperature: config.ai.temperature,
      });
    }

    return new ChatOpenAI({
      apiKey: config.ai.openai.apiKey,
      model: config.ai.openai.model,
      maxTokens: config.ai.maxTokens,
      temperature: config.ai.temperature,
    });
  }

  /**
   * Convert internal message format to LangChain messages
   */
  private toBaseMessages(messages: ChatMessage[]): BaseMessage[] {
    return messages.map((msg) => {
      switch (msg.role) {
        case 'system':
          return new SystemMessage(msg.content);
        case 'user':
          return new HumanMessage(msg.content);
        case 'assistant':
          return new AIMessage(msg.content);
        default:
          return new HumanMessage(msg.content);
      }
    });
  }

  /**
   * Generate a response for the interview
   */
  async generateInterviewResponse(
    userMessage: string,
    conversationHistory: ChatMessage[],
    context: InterviewPromptVariables
  ): Promise<AIGenerateResponse> {
    const startTime = Date.now();

    try {
      // Build the system prompt
      const systemPrompt = getInterviewSystemPrompt(context);

      // Convert history to LangChain messages
      const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        ...this.toBaseMessages(conversationHistory),
        new HumanMessage(userMessage),
      ];

      // Generate response
      const response = await this.model.invoke(messages);
      const content = await this.outputParser.invoke(response);

      // Calculate token usage (estimate if not provided)
      const usage = this.estimateTokenUsage(systemPrompt, conversationHistory, userMessage, content);

      const processingTime = Date.now() - startTime;
      logger.debug({ processingTime, tokens: usage.totalTokens }, 'AI response generated');

      return {
        content,
        finishReason: 'stop',
        usage,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to generate AI response');
      throw new AIError(
        error instanceof Error ? error.message : 'Failed to generate response'
      );
    }
  }

  /**
   * Generate recruiter response with scheduling detection
   */
  async generateRecruiterResponse(
    userMessage: string,
    conversationHistory: ChatMessage[],
    context: {
      companyName: string;
      candidateName?: string;
      candidateEmail?: string;
      availablePositions?: string[];
    }
  ): Promise<AIRecruiterResponse> {
    const startTime = Date.now();

    try {
      // Build the recruiter system prompt
      const systemPrompt = getRecruiterSystemPrompt({
        companyName: context.companyName,
        candidateName: context.candidateName,
        availablePositions: context.availablePositions,
      });

      // Add scheduling detection instructions
      const enhancedPrompt = `${systemPrompt}

## IMPORTANT: Action Detection
After your response, if the conversation has confirmed ALL of the following for scheduling:
1. Candidate's name
2. Candidate's email
3. Interview date (specific date)
4. Interview time (specific time)
5. The candidate has CONFIRMED they want to schedule

Then add this JSON block at the END of your message (after a blank line):
\`\`\`json
{"action":"schedule_interview","candidateName":"Name","candidateEmail":"email@example.com","date":"YYYY-MM-DD","time":"HH:MM","positionTitle":"Position"}
\`\`\`

ONLY add this JSON when you have ALL information AND the candidate has confirmed. Otherwise, just respond normally.`;

      // Convert history to LangChain messages
      const messages: BaseMessage[] = [
        new SystemMessage(enhancedPrompt),
        ...this.toBaseMessages(conversationHistory),
        new HumanMessage(userMessage),
      ];

      // Generate response
      const response = await this.model.invoke(messages);
      let content = await this.outputParser.invoke(response);

      // Check for scheduling action in response
      let action: ScheduleAction | undefined;
      const jsonMatch = content.match(/```json\s*(\{[\s\S]*?"action"\s*:\s*"schedule_interview"[\s\S]*?\})\s*```/);

      if (jsonMatch && jsonMatch[1]) {
        try {
          action = JSON.parse(jsonMatch[1]) as ScheduleAction;
          // Remove the JSON block from the response
          content = content.replace(/\n*```json[\s\S]*?```\n*/g, '').trim();
        } catch {
          logger.warn('Failed to parse scheduling action JSON');
        }
      }

      // Calculate token usage
      const usage = this.estimateTokenUsage(enhancedPrompt, conversationHistory, userMessage, content);
      const processingTime = Date.now() - startTime;

      logger.debug({
        processingTime,
        tokens: usage.totalTokens,
        hasAction: !!action
      }, 'Recruiter response generated');

      return {
        content,
        action,
        tokensUsed: usage.totalTokens,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to generate recruiter response');
      throw new AIError(
        error instanceof Error ? error.message : 'Failed to generate response'
      );
    }
  }

  /**
   * Generate a simple response without interview context
   */
  async generateSimpleResponse(
    systemPrompt: string,
    userMessage: string,
    history: ChatMessage[] = []
  ): Promise<string> {
    try {
      const messages: BaseMessage[] = [
        new SystemMessage(systemPrompt),
        ...this.toBaseMessages(history),
        new HumanMessage(userMessage),
      ];

      const response = await this.model.invoke(messages);
      return this.outputParser.invoke(response);
    } catch (error) {
      logger.error({ error }, 'Failed to generate simple response');
      throw new AIError('Failed to generate response');
    }
  }

  /**
   * Generate interview summary
   */
  async generateInterviewSummary(
    candidateName: string,
    positionTitle: string,
    conversationHistory: ChatMessage[]
  ): Promise<string> {
    try {
      const summaryPrompt = getSummaryGenerationPrompt(candidateName, positionTitle);

      // Build conversation transcript
      const transcript = conversationHistory
        .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      const messages: BaseMessage[] = [
        new SystemMessage(summaryPrompt),
        new HumanMessage(`Here is the interview transcript:\n\n${transcript}\n\nPlease provide the assessment.`),
      ];

      const response = await this.model.invoke(messages);
      return this.outputParser.invoke(response);
    } catch (error) {
      logger.error({ error }, 'Failed to generate interview summary');
      throw new AIError('Failed to generate summary');
    }
  }

  /**
   * Determine if we should advance to next interview stage
   */
  async shouldAdvanceStage(
    currentStage: InterviewStage,
    questionsInStage: number,
    lastResponse: string
  ): Promise<{ shouldAdvance: boolean; reason: string }> {
    try {
      const prompt = `Based on the interview progress, should we move to the next stage?

Current stage: ${currentStage}
Questions asked in this stage: ${questionsInStage}
Candidate's last response: "${lastResponse}"

Typical questions per stage: 5-8

Respond with JSON: {"shouldAdvance": true/false, "reason": "brief explanation"}`;

      const messages: BaseMessage[] = [
        new SystemMessage('You are an interview flow controller. Analyze if it\'s time to move to the next stage.'),
        new HumanMessage(prompt),
      ];

      const response = await this.model.invoke(messages);
      const content = await this.outputParser.invoke(response);

      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as { shouldAdvance: boolean; reason: string };
      }

      return { shouldAdvance: questionsInStage >= 6, reason: 'Default threshold reached' };
    } catch (error) {
      logger.warn({ error }, 'Failed to determine stage advancement');
      return { shouldAdvance: questionsInStage >= 6, reason: 'Fallback to question count' };
    }
  }

  /**
   * Classify user intent
   */
  async classifyIntent(
    message: string
  ): Promise<{ intent: string; confidence: number }> {
    try {
      const prompt = `Classify the intent of this message: "${message}"

Possible intents:
- interview_response: Answering an interview question
- question: Asking about the role/company
- scheduling: About scheduling/timing
- greeting: Hello, hi, etc.
- farewell: Goodbye, thanks, etc.
- confirmation: Yes, ok, sure, etc.
- negative: No, not interested, etc.
- unclear: Can't determine intent

Respond with JSON only: {"intent": "intent_name", "confidence": 0.0-1.0}`;

      const response = await this.model.invoke([new HumanMessage(prompt)]);
      const content = await this.outputParser.invoke(response);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as { intent: string; confidence: number };
      }

      return { intent: 'unclear', confidence: 0.5 };
    } catch (error) {
      logger.warn({ error }, 'Failed to classify intent');
      return { intent: 'unclear', confidence: 0.3 };
    }
  }

  /**
   * Extract key points from a response
   */
  async extractKeyPoints(response: string): Promise<string[]> {
    try {
      const prompt = `Extract key points from this interview response: "${response}"

Return as JSON array of strings: ["point1", "point2", ...]
Maximum 3-5 points. Be concise.`;

      const aiResponse = await this.model.invoke([new HumanMessage(prompt)]);
      const content = await this.outputParser.invoke(aiResponse);

      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as string[];
      }

      return [];
    } catch (error) {
      logger.warn({ error }, 'Failed to extract key points');
      return [];
    }
  }

  /**
   * Estimate token usage (rough approximation)
   */
  private estimateTokenUsage(
    systemPrompt: string,
    history: ChatMessage[],
    userMessage: string,
    response: string
  ): TokenUsage {
    // Rough estimation: ~4 characters per token
    const charToTokenRatio = 4;

    const historyText = history.map((m) => m.content).join(' ');
    const promptTokens = Math.ceil(
      (systemPrompt.length + historyText.length + userMessage.length) / charToTokenRatio
    );
    const completionTokens = Math.ceil(response.length / charToTokenRatio);

    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  /**
   * Get current model name
   */
  getModelName(): string {
    return config.ai.provider === 'anthropic'
      ? config.ai.anthropic.model
      : config.ai.openai.model;
  }

  /**
   * Check if AI service is healthy
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    const start = Date.now();
    try {
      await this.model.invoke([new HumanMessage('Hi')]);
      return { healthy: true, latency: Date.now() - start };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
