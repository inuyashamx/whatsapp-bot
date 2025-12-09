/**
 * Calendar-related types for Google Calendar integration
 */

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: CalendarDateTime;
  end: CalendarDateTime;
  attendees?: CalendarAttendee[];
  reminders?: CalendarReminders;
  conferenceData?: ConferenceData;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'default' | 'public' | 'private';
  transparency?: 'opaque' | 'transparent';
}

export interface CalendarDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface CalendarAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
  organizer?: boolean;
  self?: boolean;
}

export interface CalendarReminders {
  useDefault: boolean;
  overrides?: CalendarReminder[];
}

export interface CalendarReminder {
  method: 'email' | 'popup';
  minutes: number;
}

export interface ConferenceData {
  createRequest?: {
    requestId: string;
    conferenceSolutionKey: {
      type: 'hangoutsMeet' | 'addOn';
    };
  };
  entryPoints?: ConferenceEntryPoint[];
  conferenceSolution?: {
    key: {
      type: string;
    };
    name: string;
    iconUri: string;
  };
  conferenceId?: string;
}

export interface ConferenceEntryPoint {
  entryPointType: 'video' | 'phone' | 'sip' | 'more';
  uri: string;
  label?: string;
  pin?: string;
  accessCode?: string;
  meetingCode?: string;
  passcode?: string;
  password?: string;
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

export interface AvailabilityRequest {
  startDate: Date;
  endDate: Date;
  duration: number;
  timeZone: string;
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
  timeZone: string;
}

export interface ScheduleInterviewRequest {
  candidateId: string;
  positionId: string;
  startTime: Date;
  duration: number;
  timeZone: string;
  includeVideoConference: boolean;
  attendeeEmails?: string[];
  notes?: string;
}

export interface ScheduleInterviewResponse {
  eventId: string;
  eventLink: string;
  meetLink?: string;
  startTime: Date;
  endTime: Date;
  confirmationSent: boolean;
}

export interface RescheduleRequest {
  eventId: string;
  newStartTime: Date;
  reason?: string;
  notifyAttendees: boolean;
}

export interface CancelEventRequest {
  eventId: string;
  reason?: string;
  notifyAttendees: boolean;
}
