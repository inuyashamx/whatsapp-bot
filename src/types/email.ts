/**
 * Email-related types for Gmail API integration
 */

export interface EmailMessage {
  id?: string;
  threadId?: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  from?: string;
  subject: string;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  inReplyTo?: string;
  references?: string[];
  headers?: Record<string, string>;
}

export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string | Buffer;
  contentId?: string;
  size?: number;
}

export interface SendEmailRequest {
  to: string | string[];
  subject: string;
  body: string;
  htmlBody?: string;
  cc?: string[];
  bcc?: string[];
  attachments?: EmailAttachment[];
  replyToMessageId?: string;
}

export interface SendEmailResponse {
  messageId: string;
  threadId: string;
  labelIds: string[];
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  htmlBody?: string;
  variables: string[];
}

export type EmailTemplateType =
  | 'interview_scheduled'
  | 'interview_reminder'
  | 'interview_rescheduled'
  | 'interview_cancelled'
  | 'interview_completed'
  | 'thank_you'
  | 'rejection'
  | 'offer';

export interface EmailTemplateData {
  candidateName: string;
  candidateEmail: string;
  positionTitle: string;
  companyName: string;
  interviewDate?: string;
  interviewTime?: string;
  interviewLink?: string;
  interviewerName?: string;
  customMessage?: string;
  [key: string]: string | undefined;
}

export interface EmailDraft {
  id: string;
  message: EmailMessage;
}

export interface EmailLabel {
  id: string;
  name: string;
  messageListVisibility: 'show' | 'hide';
  labelListVisibility: 'labelShow' | 'labelShowIfUnread' | 'labelHide';
  type: 'system' | 'user';
}

export interface EmailThread {
  id: string;
  historyId: string;
  messages: EmailMessage[];
}

export interface EmailSearchQuery {
  from?: string;
  to?: string;
  subject?: string;
  hasAttachment?: boolean;
  after?: Date;
  before?: Date;
  label?: string;
  query?: string;
  maxResults?: number;
}

export interface EmailSearchResult {
  messages: EmailMessage[];
  nextPageToken?: string;
  resultSizeEstimate: number;
}
