/**
 * WhatsApp Webhook Controller
 * Handles incoming messages and webhook verification
 */

import type { Request, Response } from 'express';
import { whatsAppService } from '../services/whatsapp/whatsapp.service.js';
import { aiService, type ScheduleAction } from '../services/ai/ai.service.js';
import { memoryService } from '../services/memory/memory.service.js';
import { calendarService } from '../services/calendar/calendar.service.js';
import { emailService } from '../services/email/email.service.js';
import { candidateRepository } from '../repositories/candidate.repository.js';
import { messageRepository } from '../repositories/message.repository.js';
import { logger } from '../config/logger.js';
import { config } from '../config/index.js';
import type { WhatsAppWebhookPayload, ParsedWhatsAppMessage } from '../types/whatsapp.js';

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

  logger.info({ from: message.from, content: message.content }, 'Processing incoming message');

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

    // Add message to conversation memory
    await memoryService.addMessage(message.from, {
      role: 'user',
      content: message.content,
      timestamp: message.timestamp,
    });

    // Get conversation history
    const history = await memoryService.getConversationHistory(message.from);

    // Generate AI recruiter response
    const aiResponse = await aiService.generateRecruiterResponse(
      message.content,
      history,
      {
        companyName: config.interview.companyName,
        candidateName: candidate.name !== 'Unknown' ? candidate.name : undefined,
        candidateEmail: candidate.email ?? undefined,
        availablePositions: ['Software Engineer', 'Product Manager', 'Data Analyst'],
      }
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
      whatsappMessageId: sentMessage.messages[0]?.id,
      tokensUsed: aiResponse.tokensUsed,
      aiModel: aiService.getModelName(),
      processingTimeMs: Date.now() - startTime,
    });

    // Handle scheduling action if detected
    if (aiResponse.action) {
      await handleSchedulingAction(message.from, candidate.id, aiResponse.action);
    }

    logger.info(
      {
        from: message.from,
        processingTime: Date.now() - startTime,
        hasAction: !!aiResponse.action,
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
 * Handle scheduling action - create calendar event and send email
 */
async function handleSchedulingAction(
  phoneNumber: string,
  candidateId: string,
  action: ScheduleAction
): Promise<void> {
  try {
    logger.info({ action }, 'Processing scheduling action');

    // Parse date and time
    const dateParts = action.date.split('-').map(Number);
    const timeParts = action.time.split(':').map(Number);
    const year = dateParts[0] ?? 2024;
    const month = dateParts[1] ?? 1;
    const day = dateParts[2] ?? 1;
    const hour = timeParts[0] ?? 9;
    const minute = timeParts[1] ?? 0;
    const timezone = action.timezone ?? 'America/Mexico_City';

    // Create interview start time
    const startTime = new Date(year, month - 1, day, hour, minute);

    // Create calendar event
    const calendarResult = await calendarService.scheduleInterview({
      candidateId,
      positionId: 'default',
      startTime,
      duration: 60, // 1 hour interview
      timeZone: timezone,
      attendeeEmails: [action.candidateEmail],
      includeVideoConference: true,
      notes: `Interview with ${action.candidateName} for ${action.positionTitle}`,
    });

    logger.info({ eventId: calendarResult.eventId }, 'Calendar event created');

    // Format date for email
    const formattedDate = startTime.toLocaleDateString('es-MX', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = startTime.toLocaleTimeString('es-MX', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Send confirmation email
    await emailService.sendTemplateEmail('interview_scheduled', {
      candidateName: action.candidateName,
      candidateEmail: action.candidateEmail,
      positionTitle: action.positionTitle,
      companyName: config.interview.companyName,
      interviewDate: formattedDate,
      interviewTime: formattedTime,
      interviewLink: calendarResult.meetLink,
    });

    logger.info({ email: action.candidateEmail }, 'Confirmation email sent');

    // Update candidate email if not set
    await candidateRepository.update(candidateId, {
      email: action.candidateEmail,
      name: action.candidateName,
    });

    // Send confirmation via WhatsApp
    const confirmationMessage = `✅ ¡Listo! Tu entrevista ha sido agendada.

📅 ${formattedDate}
🕐 ${formattedTime}
💼 Posición: ${action.positionTitle}

${calendarResult.meetLink ? `📹 Link de Google Meet: ${calendarResult.meetLink}` : ''}

Te envié un correo de confirmación a ${action.candidateEmail} con todos los detalles.

¡Nos vemos pronto! 🎉`;

    await whatsAppService.sendTextMessage(phoneNumber, confirmationMessage);

  } catch (error) {
    logger.error({ error, action }, 'Failed to process scheduling action');

    // Notify user of the error
    await whatsAppService.sendTextMessage(
      phoneNumber,
      'Hubo un problema al agendar la entrevista. Por favor intenta de nuevo o contacta a nuestro equipo directamente.'
    );
  }
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
