/**
 * Google Calendar Service
 * Handles calendar operations for interview scheduling
 */

import { google, type calendar_v3 } from 'googleapis';
import { config } from '../../config/index.js';
import { logger } from '../../config/logger.js';
import { ExternalServiceError } from '../../utils/errors.js';
import type {
  CalendarEvent,
  ScheduleInterviewRequest,
  ScheduleInterviewResponse,
  TimeSlot,
  AvailabilityRequest,
} from '../../types/calendar.js';

export class CalendarService {
  private calendar: calendar_v3.Calendar | null = null;

  /**
   * Initialize Google Calendar API client
   */
  private async getCalendarClient(): Promise<calendar_v3.Calendar> {
    if (this.calendar) {
      return this.calendar;
    }

    try {
      let auth;

      // Use service account if available, otherwise OAuth
      if (config.google.privateKey && config.google.serviceAccountEmail) {
        auth = new google.auth.GoogleAuth({
          credentials: {
            client_email: config.google.serviceAccountEmail,
            private_key: config.google.privateKey,
          },
          scopes: ['https://www.googleapis.com/auth/calendar'],
        });
      } else {
        // For OAuth flow, you'd need to implement token management
        auth = new google.auth.OAuth2(
          config.google.clientId,
          config.google.clientSecret,
          config.google.redirectUri
        );
      }

      this.calendar = google.calendar({ version: 'v3', auth });
      return this.calendar;
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Calendar client');
      throw new ExternalServiceError('Google Calendar', 'Failed to initialize');
    }
  }

  /**
   * Create a calendar event for an interview
   */
  async scheduleInterview(
    request: ScheduleInterviewRequest
  ): Promise<ScheduleInterviewResponse> {
    try {
      const calendar = await this.getCalendarClient();
      const endTime = new Date(request.startTime.getTime() + request.duration * 60000);

      const event: calendar_v3.Schema$Event = {
        summary: `Interview - ${request.candidateId}`,
        description: `Interview for position ${request.positionId}\n\n${request.notes ?? ''}`,
        start: {
          dateTime: request.startTime.toISOString(),
          timeZone: request.timeZone,
        },
        end: {
          dateTime: endTime.toISOString(),
          timeZone: request.timeZone,
        },
        attendees: request.attendeeEmails?.map((email) => ({ email })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 60 },
            { method: 'popup', minutes: 15 },
          ],
        },
      };

      // Add Google Meet if requested
      if (request.includeVideoConference) {
        event.conferenceData = {
          createRequest: {
            requestId: `interview-${Date.now()}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        };
      }

      const response = await calendar.events.insert({
        calendarId: config.google.calendarId,
        requestBody: event,
        conferenceDataVersion: request.includeVideoConference ? 1 : 0,
        sendUpdates: 'all',
      });

      const createdEvent = response.data;
      const meetLink = createdEvent.conferenceData?.entryPoints?.find(
        (e) => e.entryPointType === 'video'
      )?.uri;

      logger.info(
        {
          eventId: createdEvent.id,
          candidateId: request.candidateId,
        },
        'Interview scheduled'
      );

      return {
        eventId: createdEvent.id ?? '',
        eventLink: createdEvent.htmlLink ?? '',
        meetLink: meetLink ?? undefined,
        startTime: request.startTime,
        endTime,
        confirmationSent: true,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to schedule interview');
      throw new ExternalServiceError('Google Calendar', 'Failed to create event');
    }
  }

  /**
   * Get available time slots
   */
  async getAvailability(request: AvailabilityRequest): Promise<TimeSlot[]> {
    try {
      const calendar = await this.getCalendarClient();

      // Get existing events in the time range
      const response = await calendar.events.list({
        calendarId: config.google.calendarId,
        timeMin: request.startDate.toISOString(),
        timeMax: request.endDate.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items ?? [];
      const busySlots = events.map((event) => ({
        start: new Date(event.start?.dateTime ?? event.start?.date ?? ''),
        end: new Date(event.end?.dateTime ?? event.end?.date ?? ''),
      }));

      // Generate available slots
      const slots: TimeSlot[] = [];
      const slotDuration = request.duration * 60000; // Convert to ms
      let currentTime = new Date(request.startDate);

      // Working hours: 9 AM - 6 PM
      const workingHoursStart = 9;
      const workingHoursEnd = 18;

      while (currentTime < request.endDate) {
        const hour = currentTime.getHours();
        const slotEnd = new Date(currentTime.getTime() + slotDuration);

        // Check if within working hours
        if (hour >= workingHoursStart && hour < workingHoursEnd) {
          // Check if slot conflicts with existing events
          const isAvailable = !busySlots.some(
            (busy) => currentTime < busy.end && slotEnd > busy.start
          );

          slots.push({
            start: new Date(currentTime),
            end: slotEnd,
            available: isAvailable,
          });
        }

        // Move to next slot (30-minute increments)
        currentTime = new Date(currentTime.getTime() + 30 * 60000);

        // Skip to next day if past working hours
        if (currentTime.getHours() >= workingHoursEnd) {
          currentTime.setDate(currentTime.getDate() + 1);
          currentTime.setHours(workingHoursStart, 0, 0, 0);
        }
      }

      return slots.filter((slot) => slot.available);
    } catch (error) {
      logger.error({ error }, 'Failed to get availability');
      throw new ExternalServiceError('Google Calendar', 'Failed to get availability');
    }
  }

  /**
   * Get event by ID
   */
  async getEvent(eventId: string): Promise<CalendarEvent | null> {
    try {
      const calendar = await this.getCalendarClient();

      const response = await calendar.events.get({
        calendarId: config.google.calendarId,
        eventId,
      });

      const event = response.data;

      return {
        id: event.id ?? undefined,
        summary: event.summary ?? '',
        description: event.description ?? undefined,
        location: event.location ?? undefined,
        start: {
          dateTime: event.start?.dateTime ?? undefined,
          date: event.start?.date ?? undefined,
          timeZone: event.start?.timeZone ?? undefined,
        },
        end: {
          dateTime: event.end?.dateTime ?? undefined,
          date: event.end?.date ?? undefined,
          timeZone: event.end?.timeZone ?? undefined,
        },
        status: event.status as 'confirmed' | 'tentative' | 'cancelled' | undefined,
      };
    } catch (error) {
      logger.warn({ eventId, error }, 'Event not found');
      return null;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(
    eventId: string,
    updates: Partial<CalendarEvent>
  ): Promise<CalendarEvent | null> {
    try {
      const calendar = await this.getCalendarClient();

      const event: calendar_v3.Schema$Event = {};

      if (updates.summary) {
        event.summary = updates.summary;
      }
      if (updates.description) {
        event.description = updates.description;
      }
      if (updates.start) {
        event.start = {
          dateTime: updates.start.dateTime,
          date: updates.start.date,
          timeZone: updates.start.timeZone,
        };
      }
      if (updates.end) {
        event.end = {
          dateTime: updates.end.dateTime,
          date: updates.end.date,
          timeZone: updates.end.timeZone,
        };
      }

      const response = await calendar.events.patch({
        calendarId: config.google.calendarId,
        eventId,
        requestBody: event,
        sendUpdates: 'all',
      });

      logger.info({ eventId }, 'Event updated');

      return this.getEvent(response.data.id ?? eventId);
    } catch (error) {
      logger.error({ eventId, error }, 'Failed to update event');
      throw new ExternalServiceError('Google Calendar', 'Failed to update event');
    }
  }

  /**
   * Cancel/delete an event
   */
  async cancelEvent(eventId: string, notifyAttendees = true): Promise<void> {
    try {
      const calendar = await this.getCalendarClient();

      await calendar.events.delete({
        calendarId: config.google.calendarId,
        eventId,
        sendUpdates: notifyAttendees ? 'all' : 'none',
      });

      logger.info({ eventId }, 'Event cancelled');
    } catch (error) {
      logger.error({ eventId, error }, 'Failed to cancel event');
      throw new ExternalServiceError('Google Calendar', 'Failed to cancel event');
    }
  }

  /**
   * Get upcoming events
   */
  async getUpcomingEvents(maxResults = 10): Promise<CalendarEvent[]> {
    try {
      const calendar = await this.getCalendarClient();

      const response = await calendar.events.list({
        calendarId: config.google.calendarId,
        timeMin: new Date().toISOString(),
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return (response.data.items ?? []).map((event) => ({
        id: event.id ?? undefined,
        summary: event.summary ?? '',
        description: event.description ?? undefined,
        start: {
          dateTime: event.start?.dateTime ?? undefined,
          date: event.start?.date ?? undefined,
        },
        end: {
          dateTime: event.end?.dateTime ?? undefined,
          date: event.end?.date ?? undefined,
        },
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to get upcoming events');
      throw new ExternalServiceError('Google Calendar', 'Failed to list events');
    }
  }
}

// Export singleton instance
export const calendarService = new CalendarService();
