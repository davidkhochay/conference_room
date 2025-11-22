import 'dotenv/config';
import { getGoogleCalendarService } from '../lib/services/google-calendar.service';

async function main() {
  const calendarId =
    process.env.TEST_GOOGLE_CALENDAR_ID ||
    process.env.GOOGLE_TEST_ROOM_CALENDAR_ID;

  if (!calendarId) {
    console.error(
      'Please set TEST_GOOGLE_CALENDAR_ID (or GOOGLE_TEST_ROOM_CALENDAR_ID) in your environment to a room resource calendar email, e.g. c_...@resource.calendar.google.com'
    );
    process.exit(1);
  }

  const now = new Date();
  const timeMin = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1 hour ago
  const timeMax = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours ahead

  const svc = getGoogleCalendarService();

  try {
    console.log('Listing events for calendar', {
      calendarId,
      timeMin,
      timeMax,
    });
    const events = await svc.listEvents(calendarId, timeMin, timeMax);
    console.log(`Successfully fetched ${events.length} event(s).`);
    for (const ev of events) {
      console.log(
        `- ${ev.id} | ${ev.summary} | ${ev.start?.dateTime || ev.start?.date}`
      );
    }
  } catch (error: any) {
    console.error('Failed to list events from Google Calendar', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
      errors: error?.errors,
    });
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unexpected error in test-google-calendar-list', err);
  process.exit(1);
});


