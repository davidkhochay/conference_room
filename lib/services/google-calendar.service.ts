import { google, calendar_v3 } from 'googleapis';
import { JWT } from 'google-auth-library';

export class GoogleCalendarService {
  private calendar: calendar_v3.Calendar;
  private auth: JWT;

  constructor() {
    this.auth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/admin.directory.resource.calendar',
      ],
    });

    this.calendar = google.calendar({ version: 'v3', auth: this.auth });
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
    }
  ): Promise<calendar_v3.Schema$Event> {
    const response = await this.calendar.events.insert({
      calendarId,
      requestBody: eventData,
      sendUpdates: 'all',
    });

    return response.data;
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
    const response = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
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

