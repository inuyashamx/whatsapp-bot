/**
 * Gmail API Service
 * Handles email operations for interview communications
 */

import { google, type gmail_v1 } from 'googleapis';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { ExternalServiceError } from '../../utils/errors.js';
import type {
  SendEmailRequest,
  SendEmailResponse,
  EmailTemplateType,
  EmailTemplateData,
} from '../../types/email.js';

export class EmailService {
  private gmail: gmail_v1.Gmail | null = null;

  /**
   * Initialize Gmail API client
   */
  private async getGmailClient(): Promise<gmail_v1.Gmail> {
    if (this.gmail) {
      return this.gmail;
    }

    try {
      let auth;

      if (config.google.privateKey && config.google.serviceAccountEmail) {
        auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: config.google.serviceAccountEmail,
            private_key: config.google.privateKey,
          },
          scopes: [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose',
          ],
        });
      } else {
        auth = new google.auth.OAuth2(
          config.google.clientId,
          config.google.clientSecret,
          config.google.redirectUri
        );
      }

      this.gmail = google.gmail({ version: 'v1', auth });
      return this.gmail;
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Gmail client');
      throw new ExternalServiceError('Gmail', 'Failed to initialize');
    }
  }

  /**
   * Send an email
   */
  async sendEmail(request: SendEmailRequest): Promise<SendEmailResponse> {
    try {
      const gmail = await this.getGmailClient();

      const toAddresses = Array.isArray(request.to) ? request.to : [request.to];
      const message = this.createMimeMessage({
        to: toAddresses,
        cc: request.cc,
        bcc: request.bcc,
        subject: request.subject,
        body: request.body,
        htmlBody: request.htmlBody,
        replyTo: request.replyToMessageId,
      });

      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const response = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: request.replyToMessageId,
        },
      });

      logger.info(
        {
          messageId: response.data.id,
          to: toAddresses[0],
        },
        'Email sent successfully'
      );

      return {
        messageId: response.data.id ?? '',
        threadId: response.data.threadId ?? '',
        labelIds: response.data.labelIds ?? [],
      };
    } catch (error) {
      logger.error({ error }, 'Failed to send email');
      throw new ExternalServiceError('Gmail', 'Failed to send email');
    }
  }

  /**
   * Create a MIME message
   */
  private createMimeMessage(options: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    body: string;
    htmlBody?: string;
    replyTo?: string;
  }): string {
    const boundary = `boundary_${Date.now()}`;
    const fromAddress = `${config.email.fromName} <${config.email.fromAddress}>`;

    let message = [
      `From: ${fromAddress}`,
      `To: ${options.to.join(', ')}`,
    ];

    if (options.cc?.length) {
      message.push(`Cc: ${options.cc.join(', ')}`);
    }

    if (options.bcc?.length) {
      message.push(`Bcc: ${options.bcc.join(', ')}`);
    }

    message = message.concat([
      `Subject: ${options.subject}`,
      'MIME-Version: 1.0',
    ]);

    if (options.htmlBody) {
      message = message.concat([
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        options.body,
        '',
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        '',
        options.htmlBody,
        '',
        `--${boundary}--`,
      ]);
    } else {
      message = message.concat([
        'Content-Type: text/plain; charset="UTF-8"',
        '',
        options.body,
      ]);
    }

    return message.join('\r\n');
  }

  /**
   * Send email using a template
   */
  async sendTemplateEmail(
    templateType: EmailTemplateType,
    data: EmailTemplateData
  ): Promise<SendEmailResponse> {
    const template = this.getEmailTemplate(templateType, data);

    return this.sendEmail({
      to: data.candidateEmail,
      subject: template.subject,
      body: template.body,
      htmlBody: template.htmlBody,
    });
  }

  /**
   * Get email template content
   */
  private getEmailTemplate(
    type: EmailTemplateType,
    data: EmailTemplateData
  ): { subject: string; body: string; htmlBody: string } {
    const templates: Record<
      EmailTemplateType,
      { subject: string; body: string; htmlBody: string }
    > = {
      interview_scheduled: {
        subject: `Interview Scheduled - ${data.positionTitle} at ${data.companyName}`,
        body: `Dear ${data.candidateName},

Your interview for the ${data.positionTitle} position at ${data.companyName} has been scheduled.

Date: ${data.interviewDate}
Time: ${data.interviewTime}
${data.interviewLink ? `Join Link: ${data.interviewLink}` : ''}

Please confirm your attendance by replying to this email.

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Interview Scheduled</h2>
          <p>Dear ${data.candidateName},</p>
          <p>Your interview for the <strong>${data.positionTitle}</strong> position at ${data.companyName} has been scheduled.</p>
          <table style="margin: 20px 0;">
            <tr><td><strong>Date:</strong></td><td>${data.interviewDate}</td></tr>
            <tr><td><strong>Time:</strong></td><td>${data.interviewTime}</td></tr>
            ${data.interviewLink ? `<tr><td><strong>Join Link:</strong></td><td><a href="${data.interviewLink}">${data.interviewLink}</a></td></tr>` : ''}
          </table>
          <p>Please confirm your attendance by replying to this email.</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },

      interview_reminder: {
        subject: `Reminder: Interview Tomorrow - ${data.positionTitle}`,
        body: `Dear ${data.candidateName},

This is a friendly reminder about your upcoming interview for the ${data.positionTitle} position.

Date: ${data.interviewDate}
Time: ${data.interviewTime}
${data.interviewLink ? `Join Link: ${data.interviewLink}` : ''}

We look forward to speaking with you!

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Interview Reminder</h2>
          <p>Dear ${data.candidateName},</p>
          <p>This is a friendly reminder about your upcoming interview for the <strong>${data.positionTitle}</strong> position.</p>
          <table style="margin: 20px 0;">
            <tr><td><strong>Date:</strong></td><td>${data.interviewDate}</td></tr>
            <tr><td><strong>Time:</strong></td><td>${data.interviewTime}</td></tr>
            ${data.interviewLink ? `<tr><td><strong>Join Link:</strong></td><td><a href="${data.interviewLink}">${data.interviewLink}</a></td></tr>` : ''}
          </table>
          <p>We look forward to speaking with you!</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },

      interview_rescheduled: {
        subject: `Interview Rescheduled - ${data.positionTitle}`,
        body: `Dear ${data.candidateName},

Your interview for the ${data.positionTitle} position has been rescheduled.

New Date: ${data.interviewDate}
New Time: ${data.interviewTime}
${data.interviewLink ? `Join Link: ${data.interviewLink}` : ''}

We apologize for any inconvenience.

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Interview Rescheduled</h2>
          <p>Dear ${data.candidateName},</p>
          <p>Your interview for the <strong>${data.positionTitle}</strong> position has been rescheduled.</p>
          <table style="margin: 20px 0;">
            <tr><td><strong>New Date:</strong></td><td>${data.interviewDate}</td></tr>
            <tr><td><strong>New Time:</strong></td><td>${data.interviewTime}</td></tr>
            ${data.interviewLink ? `<tr><td><strong>Join Link:</strong></td><td><a href="${data.interviewLink}">${data.interviewLink}</a></td></tr>` : ''}
          </table>
          <p>We apologize for any inconvenience.</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },

      interview_cancelled: {
        subject: `Interview Cancelled - ${data.positionTitle}`,
        body: `Dear ${data.candidateName},

We regret to inform you that your interview for the ${data.positionTitle} position has been cancelled.

${data.customMessage ?? 'We will be in touch regarding next steps.'}

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Interview Cancelled</h2>
          <p>Dear ${data.candidateName},</p>
          <p>We regret to inform you that your interview for the <strong>${data.positionTitle}</strong> position has been cancelled.</p>
          <p>${data.customMessage ?? 'We will be in touch regarding next steps.'}</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },

      interview_completed: {
        subject: `Thank You - ${data.positionTitle} Interview`,
        body: `Dear ${data.candidateName},

Thank you for taking the time to interview for the ${data.positionTitle} position at ${data.companyName}.

We appreciate your interest in joining our team. We will review your application and be in touch soon regarding next steps.

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Thank You</h2>
          <p>Dear ${data.candidateName},</p>
          <p>Thank you for taking the time to interview for the <strong>${data.positionTitle}</strong> position at ${data.companyName}.</p>
          <p>We appreciate your interest in joining our team. We will review your application and be in touch soon regarding next steps.</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },

      thank_you: {
        subject: `Thank You for Applying - ${data.companyName}`,
        body: `Dear ${data.candidateName},

Thank you for your interest in the ${data.positionTitle} position at ${data.companyName}.

We have received your application and will review it carefully. If your qualifications match our requirements, we will be in touch to schedule an interview.

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Thank You for Applying</h2>
          <p>Dear ${data.candidateName},</p>
          <p>Thank you for your interest in the <strong>${data.positionTitle}</strong> position at ${data.companyName}.</p>
          <p>We have received your application and will review it carefully. If your qualifications match our requirements, we will be in touch to schedule an interview.</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },

      rejection: {
        subject: `Application Update - ${data.positionTitle}`,
        body: `Dear ${data.candidateName},

Thank you for your interest in the ${data.positionTitle} position at ${data.companyName} and for taking the time to go through our interview process.

After careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.

We encourage you to apply for future positions that match your skills and experience.

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Application Update</h2>
          <p>Dear ${data.candidateName},</p>
          <p>Thank you for your interest in the <strong>${data.positionTitle}</strong> position at ${data.companyName} and for taking the time to go through our interview process.</p>
          <p>After careful consideration, we have decided to move forward with other candidates whose experience more closely aligns with our current needs.</p>
          <p>We encourage you to apply for future positions that match your skills and experience.</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },

      offer: {
        subject: `Job Offer - ${data.positionTitle} at ${data.companyName}`,
        body: `Dear ${data.candidateName},

Congratulations! We are pleased to offer you the position of ${data.positionTitle} at ${data.companyName}.

${data.customMessage ?? 'Please find the offer details attached. We look forward to having you join our team!'}

Best regards,
${data.companyName} Recruitment Team`,
        htmlBody: this.wrapInHtmlTemplate(`
          <h2>Congratulations!</h2>
          <p>Dear ${data.candidateName},</p>
          <p>We are pleased to offer you the position of <strong>${data.positionTitle}</strong> at ${data.companyName}.</p>
          <p>${data.customMessage ?? 'Please find the offer details attached. We look forward to having you join our team!'}</p>
          <p>Best regards,<br>${data.companyName} Recruitment Team</p>
        `),
      },
    };

    return templates[type];
  }

  /**
   * Wrap content in HTML email template
   */
  private wrapInHtmlTemplate(content: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    h2 { color: #2563eb; }
    table { border-collapse: collapse; }
    td { padding: 8px 16px 8px 0; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <div class="container">
    ${content}
  </div>
</body>
</html>`;
  }
}

// Export singleton instance
export const emailService = new EmailService();
