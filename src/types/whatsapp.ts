/**
 * WhatsApp Business API types
 * Based on Meta's Cloud API documentation
 */

// Webhook payload types
export interface WhatsAppWebhookPayload {
  object: 'whatsapp_business_account';
  entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
  id: string;
  changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
  value: WhatsAppWebhookValue;
  field: 'messages';
}

export interface WhatsAppWebhookValue {
  messaging_product: 'whatsapp';
  metadata: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppMessageStatus[];
  errors?: WhatsAppError[];
}

export interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

export interface WhatsAppContact {
  profile: {
    name: string;
  };
  wa_id: string;
}

// Incoming message types
export interface WhatsAppIncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: WhatsAppMessageType;
  text?: WhatsAppTextContent;
  image?: WhatsAppMediaContent;
  audio?: WhatsAppMediaContent;
  video?: WhatsAppMediaContent;
  document?: WhatsAppDocumentContent;
  location?: WhatsAppLocationContent;
  contacts?: WhatsAppContactContent[];
  interactive?: WhatsAppInteractiveResponse;
  button?: WhatsAppButtonResponse;
  context?: WhatsAppMessageContext;
}

export type WhatsAppMessageType =
  | 'text'
  | 'image'
  | 'audio'
  | 'video'
  | 'document'
  | 'location'
  | 'contacts'
  | 'interactive'
  | 'button'
  | 'sticker'
  | 'unknown';

export interface WhatsAppTextContent {
  body: string;
}

export interface WhatsAppMediaContent {
  id: string;
  mime_type: string;
  sha256?: string;
  caption?: string;
}

export interface WhatsAppDocumentContent extends WhatsAppMediaContent {
  filename: string;
}

export interface WhatsAppLocationContent {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface WhatsAppContactContent {
  name: {
    formatted_name: string;
    first_name?: string;
    last_name?: string;
  };
  phones?: Array<{
    phone: string;
    type: string;
  }>;
  emails?: Array<{
    email: string;
    type: string;
  }>;
}

export interface WhatsAppInteractiveResponse {
  type: 'button_reply' | 'list_reply';
  button_reply?: {
    id: string;
    title: string;
  };
  list_reply?: {
    id: string;
    title: string;
    description?: string;
  };
}

export interface WhatsAppButtonResponse {
  text: string;
  payload: string;
}

export interface WhatsAppMessageContext {
  from: string;
  id: string;
}

// Message status types
export interface WhatsAppMessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: WhatsAppError[];
}

export interface WhatsAppError {
  code: number;
  title: string;
  message: string;
  error_data?: {
    details: string;
  };
}

// Outgoing message types
export interface WhatsAppSendMessageRequest {
  messaging_product: 'whatsapp';
  recipient_type: 'individual';
  to: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'template' | 'interactive';
  text?: WhatsAppTextContent;
  image?: WhatsAppOutgoingMedia;
  audio?: WhatsAppOutgoingMedia;
  video?: WhatsAppOutgoingMedia;
  document?: WhatsAppOutgoingDocument;
  template?: WhatsAppTemplate;
  interactive?: WhatsAppInteractiveMessage;
  context?: {
    message_id: string;
  };
}

export interface WhatsAppOutgoingMedia {
  id?: string;
  link?: string;
  caption?: string;
}

export interface WhatsAppOutgoingDocument extends WhatsAppOutgoingMedia {
  filename?: string;
}

export interface WhatsAppTemplate {
  name: string;
  language: {
    code: string;
  };
  components?: WhatsAppTemplateComponent[];
}

export interface WhatsAppTemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters: WhatsAppTemplateParameter[];
  sub_type?: 'quick_reply' | 'url';
  index?: number;
}

export interface WhatsAppTemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: {
    fallback_value: string;
    code: string;
    amount_1000: number;
  };
  date_time?: {
    fallback_value: string;
  };
  image?: WhatsAppOutgoingMedia;
  document?: WhatsAppOutgoingDocument;
  video?: WhatsAppOutgoingMedia;
}

export interface WhatsAppInteractiveMessage {
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: WhatsAppInteractiveHeader;
  body: {
    text: string;
  };
  footer?: {
    text: string;
  };
  action: WhatsAppInteractiveAction;
}

export interface WhatsAppInteractiveHeader {
  type: 'text' | 'image' | 'video' | 'document';
  text?: string;
  image?: WhatsAppOutgoingMedia;
  video?: WhatsAppOutgoingMedia;
  document?: WhatsAppOutgoingDocument;
}

export interface WhatsAppInteractiveAction {
  button?: string;
  buttons?: WhatsAppInteractiveButton[];
  sections?: WhatsAppInteractiveSection[];
}

export interface WhatsAppInteractiveButton {
  type: 'reply';
  reply: {
    id: string;
    title: string;
  };
}

export interface WhatsAppInteractiveSection {
  title?: string;
  rows: WhatsAppInteractiveRow[];
}

export interface WhatsAppInteractiveRow {
  id: string;
  title: string;
  description?: string;
}

// API response types
export interface WhatsAppSendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{
    input: string;
    wa_id: string;
  }>;
  messages: Array<{
    id: string;
  }>;
}

// Parsed message for internal use
export interface ParsedWhatsAppMessage {
  messageId: string;
  from: string;
  fromName: string;
  timestamp: Date;
  type: WhatsAppMessageType;
  content: string;
  mediaId?: string;
  mediaType?: string;
  replyToMessageId?: string;
  raw: WhatsAppIncomingMessage;
}
