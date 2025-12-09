/**
 * WhatsApp Business API Service
 * Handles all communication with Meta's WhatsApp Cloud API
 */

import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { WhatsAppError } from '../../utils/errors.js';
import type {
  WhatsAppWebhookPayload,
  WhatsAppIncomingMessage,
  WhatsAppSendMessageRequest,
  WhatsAppSendMessageResponse,
  WhatsAppInteractiveMessage,
  ParsedWhatsAppMessage,
  WhatsAppContact,
} from '../../types/whatsapp.js';

export class WhatsAppService {
  private readonly client: AxiosInstance;
  private readonly phoneNumberId: string;
  private readonly verifyToken: string;

  constructor() {
    this.phoneNumberId = config.whatsapp.phoneNumberId;
    this.verifyToken = config.whatsapp.verifyToken;

    this.client = axios.create({
      baseURL: `https://graph.facebook.com/${config.whatsapp.apiVersion}`,
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Request interceptor for logging
    this.client.interceptors.request.use((request) => {
      logger.debug(
        {
          method: request.method,
          url: request.url,
        },
        'WhatsApp API request'
      );
      return request;
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const errorData = error.response?.data as Record<string, unknown> | undefined;
        logger.error(
          {
            status: error.response?.status,
            data: errorData,
          },
          'WhatsApp API error'
        );
        throw error;
      }
    );
  }

  // ============================================================================
  // WEBHOOK VERIFICATION
  // ============================================================================

  /**
   * Verify webhook subscription (called by Meta)
   */
  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.verifyToken) {
      logger.info('Webhook verified successfully');
      return challenge;
    }

    logger.warn({ mode, token }, 'Webhook verification failed');
    return null;
  }

  // ============================================================================
  // MESSAGE PARSING
  // ============================================================================

  /**
   * Parse incoming webhook payload
   */
  parseWebhookPayload(payload: WhatsAppWebhookPayload): ParsedWhatsAppMessage[] {
    const messages: ParsedWhatsAppMessage[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.field !== 'messages') {
          continue;
        }

        const value = change.value;
        const incomingMessages = value.messages ?? [];
        const contacts = value.contacts ?? [];

        for (const message of incomingMessages) {
          const contact = contacts.find((c) => c.wa_id === message.from);
          const parsed = this.parseMessage(message, contact);
          if (parsed) {
            messages.push(parsed);
          }
        }
      }
    }

    return messages;
  }

  /**
   * Parse a single incoming message
   */
  private parseMessage(
    message: WhatsAppIncomingMessage,
    contact?: WhatsAppContact
  ): ParsedWhatsAppMessage | null {
    let content = '';
    let mediaId: string | undefined;
    let mediaType: string | undefined;

    switch (message.type) {
      case 'text':
        content = message.text?.body ?? '';
        break;

      case 'image':
        content = message.image?.caption ?? '[Image]';
        mediaId = message.image?.id;
        mediaType = message.image?.mime_type;
        break;

      case 'audio':
        content = '[Audio message]';
        mediaId = message.audio?.id;
        mediaType = message.audio?.mime_type;
        break;

      case 'video':
        content = message.video?.caption ?? '[Video]';
        mediaId = message.video?.id;
        mediaType = message.video?.mime_type;
        break;

      case 'document':
        content = `[Document: ${message.document?.filename ?? 'unknown'}]`;
        mediaId = message.document?.id;
        mediaType = message.document?.mime_type;
        break;

      case 'location':
        content = `[Location: ${message.location?.name ?? 'Shared location'}]`;
        break;

      case 'interactive':
        if (message.interactive?.type === 'button_reply') {
          content = message.interactive.button_reply?.title ?? '';
        } else if (message.interactive?.type === 'list_reply') {
          content = message.interactive.list_reply?.title ?? '';
        }
        break;

      case 'button':
        content = message.button?.text ?? '';
        break;

      default:
        logger.warn({ type: message.type }, 'Unknown message type');
        return null;
    }

    return {
      messageId: message.id,
      from: message.from,
      fromName: contact?.profile.name ?? 'Unknown',
      timestamp: new Date(parseInt(message.timestamp) * 1000),
      type: message.type,
      content,
      mediaId,
      mediaType,
      replyToMessageId: message.context?.id,
      raw: message,
    };
  }

  // ============================================================================
  // SENDING MESSAGES
  // ============================================================================

  /**
   * Send a text message
   */
  async sendTextMessage(to: string, text: string): Promise<WhatsAppSendMessageResponse> {
    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
    };

    return this.sendMessage(payload);
  }

  /**
   * Send a message with reply context
   */
  async sendReplyMessage(
    to: string,
    text: string,
    replyToMessageId: string
  ): Promise<WhatsAppSendMessageResponse> {
    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text },
      context: { message_id: replyToMessageId },
    };

    return this.sendMessage(payload);
  }

  /**
   * Send an interactive button message
   */
  async sendButtonMessage(
    to: string,
    body: string,
    buttons: Array<{ id: string; title: string }>,
    header?: string,
    footer?: string
  ): Promise<WhatsAppSendMessageResponse> {
    const interactive: WhatsAppInteractiveMessage = {
      type: 'button',
      body: { text: body },
      action: {
        buttons: buttons.map((btn) => ({
          type: 'reply',
          reply: { id: btn.id, title: btn.title },
        })),
      },
    };

    if (header) {
      interactive.header = { type: 'text', text: header };
    }

    if (footer) {
      interactive.footer = { text: footer };
    }

    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    };

    return this.sendMessage(payload);
  }

  /**
   * Send an interactive list message
   */
  async sendListMessage(
    to: string,
    body: string,
    buttonText: string,
    sections: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>,
    header?: string,
    footer?: string
  ): Promise<WhatsAppSendMessageResponse> {
    const interactive: WhatsAppInteractiveMessage = {
      type: 'list',
      body: { text: body },
      action: {
        button: buttonText,
        sections,
      },
    };

    if (header) {
      interactive.header = { type: 'text', text: header };
    }

    if (footer) {
      interactive.footer = { text: footer };
    }

    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive,
    };

    return this.sendMessage(payload);
  }

  /**
   * Send a template message
   */
  async sendTemplateMessage(
    to: string,
    templateName: string,
    languageCode: string,
    components?: Array<{
      type: 'header' | 'body' | 'button';
      parameters: Array<{ type: 'text'; text: string }>;
    }>
  ): Promise<WhatsAppSendMessageResponse> {
    const payload: WhatsAppSendMessageRequest = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    };

    return this.sendMessage(payload);
  }

  /**
   * Send a generic message
   */
  private async sendMessage(
    payload: WhatsAppSendMessageRequest
  ): Promise<WhatsAppSendMessageResponse> {
    try {
      const response = await this.client.post<WhatsAppSendMessageResponse>(
        `/${this.phoneNumberId}/messages`,
        payload
      );

      logger.info(
        {
          to: payload.to,
          messageId: response.data.messages[0]?.id,
        },
        'Message sent successfully'
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorData = error.response?.data as { error?: { message?: string } } | undefined;
        const message = errorData?.error?.message ?? 'Failed to send message';
        throw new WhatsAppError(message);
      }
      throw error;
    }
  }

  // ============================================================================
  // MEDIA HANDLING
  // ============================================================================

  /**
   * Get media URL from media ID
   */
  async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await this.client.get<{ url: string }>(`/${mediaId}`);
      return response.data.url;
    } catch (error) {
      logger.error({ mediaId, error }, 'Failed to get media URL');
      throw new WhatsAppError('Failed to retrieve media');
    }
  }

  /**
   * Download media content
   */
  async downloadMedia(mediaUrl: string): Promise<Buffer> {
    try {
      const response = await axios.get<ArrayBuffer>(mediaUrl, {
        headers: {
          Authorization: `Bearer ${config.whatsapp.accessToken}`,
        },
        responseType: 'arraybuffer',
      });

      return Buffer.from(response.data);
    } catch (error) {
      logger.error({ error }, 'Failed to download media');
      throw new WhatsAppError('Failed to download media');
    }
  }

  // ============================================================================
  // UTILITY
  // ============================================================================

  /**
   * Mark message as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      });

      logger.debug({ messageId }, 'Message marked as read');
    } catch (error) {
      // Non-critical, just log
      logger.warn({ messageId, error }, 'Failed to mark message as read');
    }
  }

  /**
   * Send typing indicator
   */
  async sendTypingIndicator(to: string): Promise<void> {
    // Note: WhatsApp Cloud API doesn't support typing indicators directly
    // This is a placeholder for future implementation or alternative methods
    logger.debug({ to }, 'Typing indicator (not supported by Cloud API)');
  }

  /**
   * Validate phone number format
   */
  isValidPhoneNumber(phone: string): boolean {
    // WhatsApp expects numbers without + prefix, only digits
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  /**
   * Format phone number for WhatsApp API
   */
  formatPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
  }
}

// Export singleton instance
export const whatsAppService = new WhatsAppService();
