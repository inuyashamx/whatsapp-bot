/**
 * WhatsApp Webhook Controller
 * Handles incoming messages and webhook verification
 */

import type { Request, Response } from 'express';
import { whatsAppService } from '../services/whatsapp/whatsapp.service.js';
import { aiService } from '../services/ai/ai.service.js';
import { memoryService } from '../services/memory/memory.service.js';
import { candidateRepository } from '../repositories/candidate.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { interviewRepository } from '../repositories/interview.repository.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import type { WhatsAppWebhookPayload, ParsedWhatsAppMessage } from '../types/whatsapp.js';
import type { ChatMessage } from '../types/ai.js';
import type { InterviewStage } from '../types/interview.js';

/**
 * Handle webhook verification (GET request from Meta)
 */
export async function verifyWebhook(req: Request, res: Response): Promise<void> {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;

  const result = whatsAppService.verifyWebhook(mode, token, challenge);

  if (result) {
    res.status(200).send(result);
  } else {
    res.status(403).send('Verification failed');
  }
}

/**
 * Handle incoming webhook messages (POST request from Meta)
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Immediately respond to acknowledge receipt
  res.status(200).send('EVENT_RECEIVED');

  try {
    const payload = req.body as WhatsAppWebhookPayload;
    const messages = whatsAppService.parseWebhookPayload(payload);

    // Process each message
    for (const message of messages) {
      await processMessage(message);
    }
  } catch (error) {
    logger.error({ error }, 'Error processing webhook');
  }
}

/**
 * Process a single incoming message
 */
async function processMessage(message: ParsedWhatsAppMessage): Promise<void> {
  const startTime = Date.now();

  try {
    // Check for duplicate messages
    const exists = await messageRepository.exists(message.messageId);
    if (exists) {
      logger.debug({ messageId: message.messageId }, 'Duplicate message, skipping');
      return;
    }

    // Mark message as read
    await whatsAppService.markAsRead(message.messageId);

    // Find or create candidate
    const candidate = await candidateRepository.findOrCreate(
      message.from,
      message.fromName
    );

    // Save incoming message
    await messageRepository.createUserMessage(
      candidate.id,
      message.content,
      message.messageId
    );

    // Check for active interview
    let interview = await interviewRepository.findActiveForCandidate(candidate.id);

    // Add message to conversation memory
    await memoryService.addMessage(message.from, {
      role: 'user',
      content: message.content,
      timestamp: message.timestamp,
    });

    // Get conversation history
    const history = await memoryService.getConversationHistory(message.from);

    // Generate AI response
    const aiResponse = await generateResponse(
      message.content,
      history,
      candidate.name,
      interview?.currentStage
    );

    // Save AI response to memory
    await memoryService.addMessage(message.from, {
      role: 'assistant',
      content: aiResponse.content,
      timestamp: new Date(),
    });

    // Send response via WhatsApp
    const sentMessage = await whatsAppService.sendTextMessage(
      message.from,
      aiResponse.content
    );

    // Save outgoing message
    await messageRepository.createAssistantMessage(candidate.id, aiResponse.content, {
      interviewId: interview?.id,
      whatsappMessageId: sentMessage.messages[0]?.id,
      tokensUsed: aiResponse.tokensUsed,
      aiModel: aiService.getModelName(),
      processingTimeMs: Date.now() - startTime,
    });

    logger.info(
      {
        from: message.from,
        processingTime: Date.now() - startTime,
      },
      'Message processed successfully'
    );
  } catch (error) {
    logger.error({ error, messageId: message.messageId }, 'Failed to process message');

    // Send error message to user
    try {
      await whatsAppService.sendTextMessage(
        message.from,
        "I apologize, but I'm having trouble processing your message. Please try again in a moment."
      );
    } catch {
      logger.error('Failed to send error message to user');
    }
  }
}

/**
 * Generate AI response for the message
 */
async function generateResponse(
  userMessage: string,
  history: ChatMessage[],
  candidateName: string,
  currentStage?: InterviewStage
): Promise<{ content: string; tokensUsed: number }> {
  // Build interview context
  const context = {
    candidateName,
    positionTitle: 'Software Engineer', // TODO: Get from active interview
    positionDescription: 'Building amazing software products',
    positionRequirements: 'Experience with TypeScript, Node.js, and cloud services',
    companyName: config.interview.companyName,
    currentStage: currentStage ?? 'introduction',
    questionsAsked: history.filter((m) => m.role === 'assistant').length,
  };

  const response = await aiService.generateInterviewResponse(
    userMessage,
    history,
    context
  );

  return {
    content: response.content,
    tokensUsed: response.usage.totalTokens,
  };
}

/**
 * Send a test message (for debugging)
 */
export async function sendTestMessage(req: Request, res: Response): Promise<void> {
  try {
    const { to, message } = req.body as { to: string; message: string };

    const result = await whatsAppService.sendTextMessage(to, message);

    res.json({
      success: true,
      data: {
        messageId: result.messages[0]?.id,
      },
    });
  } catch (error) {
    logger.error({ error }, 'Failed to send test message');
    res.status(500).json({
      success: false,
      error: { message: 'Failed to send message' },
    });
  }
}
