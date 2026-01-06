import { google, calendar_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private auth: JWT;
  private adminEmail: string;

  constructor() {
    this.adminEmail = process.env.GOOGLE_CALENDAR_ADMIN_EMAIL || '';
    
    this.auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/admin.directory.resource.calendar',
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
      ],
      subject: this.adminEmail,
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
  }

  /**
   * Get the admin email used as the organizer for calendar events
   */
  getOrganizerEmail(): string {
    return this.adminEmail;
  }

  /**
   * Create a new calendar client impersonating a specific user.
   * This allows creating events where that user is the organizer.
   */
  private createClientForUser(userEmail: string): calendar_v3.Calendar {
    const userAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
      ],
      subject: userEmail,
    });

    return google.calendar({ version: 'v3', auth: userAuth });
  }

  /**
   * Create a calendar event as a specific user (they become the organizer).
   * The event is created on the user's primary calendar.
   * Falls back to admin if impersonation fails.
   */
  async createEventAsUser(
    organizerEmail: string,
    eventData: {
      summary: string;
      description?: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees?: Array<{ email: string; resource?: boolean }>;
      conferenceData?: any;
    },
    privateExtendedProps?: Record<string, string>
  ): Promise<{ event: calendar_v3.Schema$Event; organizerUsed: string }> {
    // Try to create event as the specified user
    try {
      const userCalendar = this.createClientForUser(organizerEmail);
      
      const response = await userCalendar.events.insert({
        calendarId: 'primary', // User's primary calendar
        requestBody: {
          ...eventData,
          extendedProperties: privateExtendedProps
            ? { private: privateExtendedProps }
            : undefined,
        },
        sendUpdates: 'all',
      });

      return { event: response.data, organizerUsed: organizerEmail };
    } catch (error: any) {
      console.error(`Failed to create event as ${organizerEmail}, falling back to admin`, {
        message: error?.message,
        code: error?.code,
      });

      // Fall back to admin email
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          ...eventData,
          extendedProperties: privateExtendedProps
            ? { private: privateExtendedProps }
            : undefined,
        },
        sendUpdates: 'all',
      });

      return { event: response.data, organizerUsed: this.adminEmail };
    }
  }

  /**
   * Check free/busy status for rooms
   */
  async checkFreeBusy(
    calendarIds: string[],
    timeMin: string,
    timeMax: string
  ): Promise<calendar_v3.Schema$FreeBusyResponse> {
    const response = await this.calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: calendarIds.map(id => ({ id })),
      },
    });

    return response.data;
  }

  /**
   * Create a calendar event for a booking
   */
  async createEvent(
    calendarId: string,
    eventData: {
      summary: string;
      description?: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees?: Array<{ email: string; resource?: boolean }>;
      conferenceData?: any;
      recurrence?: string[]; // RRULE strings for recurring events
    },
    privateExtendedProps?: Record<string, string>
  ): Promise<calendar_v3.Schema$Event> {
    const response = await this.calendar.events.insert({
      calendarId,
      requestBody: {
        ...eventData,
        extendedProperties: privateExtendedProps
          ? {
              private: privateExtendedProps,
            }
          : eventData && (eventData as any).extendedProperties,
      },
      sendUpdates: 'all',
    });

    return response.data;
  }

  /**
   * Create a recurring calendar event
   * Returns the parent event which Google will expand into occurrences
   */
  async createRecurringEvent(
    calendarId: string,
    eventData: {
      summary: string;
      description?: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees?: Array<{ email: string; resource?: boolean }>;
      recurrence: string[]; // RRULE strings, e.g., ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260401T000000Z"]
    },
    privateExtendedProps?: Record<string, string>
  ): Promise<calendar_v3.Schema$Event> {
    const response = await this.calendar.events.insert({
      calendarId,
      requestBody: {
        ...eventData,
        extendedProperties: privateExtendedProps
          ? { private: privateExtendedProps }
          : undefined,
      },
      sendUpdates: 'all',
    });

    return response.data;
  }

  /**
   * Create a recurring event as a specific user (they become the organizer)
   */
  async createRecurringEventAsUser(
    organizerEmail: string,
    eventData: {
      summary: string;
      description?: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees?: Array<{ email: string; resource?: boolean }>;
      recurrence: string[];
    },
    privateExtendedProps?: Record<string, string>
  ): Promise<{ event: calendar_v3.Schema$Event; organizerUsed: string }> {
    try {
      const userCalendar = this.createClientForUser(organizerEmail);
      
      const response = await userCalendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          ...eventData,
          extendedProperties: privateExtendedProps
            ? { private: privateExtendedProps }
            : undefined,
        },
        sendUpdates: 'all',
      });

      return { event: response.data, organizerUsed: organizerEmail };
    } catch (error: any) {
      console.error(`Failed to create recurring event as ${organizerEmail}, falling back to admin`, {
        message: error?.message,
        code: error?.code,
      });

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        requestBody: {
          ...eventData,
          extendedProperties: privateExtendedProps
            ? { private: privateExtendedProps }
            : undefined,
        },
        sendUpdates: 'all',
      });

      return { event: response.data, organizerUsed: this.adminEmail };
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    eventData: Partial<{
      summary: string;
      description: string;
      start: { dateTime: string; timeZone: string };
      end: { dateTime: string; timeZone: string };
      attendees: Array<{ email: string; resource?: boolean }>;
    }>
  ): Promise<calendar_v3.Schema$Event> {
    const response = await this.calendar.events.patch({
      calendarId,
      eventId,
      requestBody: eventData,
      sendUpdates: 'all',
    });

    return response.data;
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all',
    });
  }

  /**
   * Get a specific event
   */
  async getEvent(
    calendarId: string,
    eventId: string
  ): Promise<calendar_v3.Schema$Event> {
    const response = await this.calendar.events.get({
      calendarId,
      eventId,
    });

    return response.data;
  }

  /**
   * List events in a time range
   */
  async listEvents(
    calendarId: string,
    timeMin: string,
    timeMax: string
  ): Promise<calendar_v3.Schema$Event[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        showDeleted: true,
        singleEvents: true,
        orderBy: 'startTime',
      });

      return response.data.items || [];
    } catch (error: any) {
      // Surface rich diagnostics to the server log so 404/permission issues are
      // easy to understand when wiring up new rooms or domains.
      console.error('GoogleCalendarService.listEvents failed', {
        calendarId,
        timeMin,
        timeMax,
        message: error?.message,
        code: error?.code,
        status: error?.status,
        errors: error?.errors,
      });
      throw error;
    }
  }

  /**
   * Create a room resource calendar
   */
  async createRoomResource(
    customerId: string,
    resourceData: {
      resourceName: string;
      resourceEmail?: string;
      capacity?: number;
      buildingId?: string;
      floorName?: string;
    }
  ): Promise<any> {
    const admin = google.admin({ version: 'directory_v1', auth: this.auth });
    
    const response = await admin.resources.calendars.insert({
      customer: customerId,
      requestBody: {
        resourceName: resourceData.resourceName,
        resourceEmail: resourceData.resourceEmail,
        capacity: resourceData.capacity,
        buildingId: resourceData.buildingId,
        floorName: resourceData.floorName,
      },
    });

    return response.data;
  }

  /**
   * Find available time slots
   */
  findAvailableSlots(
    busyTimes: Array<{ start: string; end: string }>,
    searchStart: Date,
    searchEnd: Date,
    slotDuration: number // in minutes
  ): Array<{ start: Date; end: Date }> {
    const slots: Array<{ start: Date; end: Date }> = [];
    const slotMs = slotDuration * 60 * 1000;

    // Sort busy times
    const sortedBusy = [...busyTimes]
      .map(b => ({
        start: new Date(b.start),
        end: new Date(b.end),
      }))
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    let currentTime = new Date(searchStart);

    for (const busy of sortedBusy) {
      // If there's a gap before this busy period
      if (currentTime < busy.start) {
        const availableEnd = new Date(Math.min(busy.start.getTime(), searchEnd.getTime()));
        const availableMs = availableEnd.getTime() - currentTime.getTime();
        
        if (availableMs >= slotMs) {
          slots.push({
            start: new Date(currentTime),
            end: new Date(currentTime.getTime() + slotMs),
          });
        }
      }
      currentTime = new Date(Math.max(currentTime.getTime(), busy.end.getTime()));
    }

    // Check for availability after the last busy period
    if (currentTime < searchEnd) {
      const availableMs = searchEnd.getTime() - currentTime.getTime();
      if (availableMs >= slotMs) {
        slots.push({
          start: new Date(currentTime),
          end: new Date(currentTime.getTime() + slotMs),
        });
      }
    }

    return slots;
  }
}

// Singleton instance
let googleCalendarService: GoogleCalendarService;

export function getGoogleCalendarService(): GoogleCalendarService {
  if (!googleCalendarService) {
    googleCalendarService = new GoogleCalendarService();
  }
  return googleCalendarService;
}

