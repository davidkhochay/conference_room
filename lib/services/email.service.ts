import { Resend } from 'resend';

// Lazy-initialize Resend to avoid build-time errors when API key is not available
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resend = new Resend(apiKey);
  }
  return resend;
}

export interface OverdueReminderEmailData {
  to: string;
  hostName: string;
  roomName: string;
  startTime: string;
  endTime: string;
  extendUrl: string;
  releaseUrl: string;
}

/**
 * Format a date string for display in emails
 */
function formatTime(isoString: string, timezone?: string): string {
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    timeZone: timezone || 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Generate HTML email content for overdue room reminder
 */
function generateOverdueReminderHtml(data: OverdueReminderEmailData): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Room Reminder</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center;">
              <div style="width: 56px; height: 56px; background-color: #FEF3C7; border-radius: 50%; margin: 0 auto 16px auto; display: flex; align-items: center; justify-content: center;">
                <span style="font-size: 28px;">⏰</span>
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 600; color: #111827;">
                Forgot to release the room?
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Hey ${data.hostName},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                You booked <strong style="color: #111827;">${data.roomName}</strong> from <strong style="color: #111827;">${data.startTime}</strong> to <strong style="color: #111827;">${data.endTime}</strong>.
              </p>
              <p style="margin: 0 0 28px 0; font-size: 16px; line-height: 1.6; color: #374151;">
                We held the room 30 min extra — what's the verdict?
              </p>
            </td>
          </tr>
          
          <!-- Buttons -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="padding-right: 8px;" width="50%">
                    <a href="${data.extendUrl}" style="display: block; padding: 14px 20px; background-color: #2563EB; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 600; text-align: center; border-radius: 8px;">
                      Extend 30 min
                    </a>
                  </td>
                  <td style="padding-left: 8px;" width="50%">
                    <a href="${data.releaseUrl}" style="display: block; padding: 14px 20px; background-color: #ffffff; color: #374151; text-decoration: none; font-size: 15px; font-weight: 600; text-align: center; border-radius: 8px; border: 2px solid #E5E7EB;">
                      Release Room
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #F9FAFB; border-radius: 0 0 12px 12px; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0; font-size: 13px; color: #6B7280; text-align: center;">
                Good Life Room Booking System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Generate plain text version of overdue reminder email
 */
function generateOverdueReminderText(data: OverdueReminderEmailData): string {
  return `
Forgot to release the room?

Hey ${data.hostName},

You booked ${data.roomName} from ${data.startTime} to ${data.endTime}.

We held the room 30 min extra — what's the verdict?

Extend 30 min: ${data.extendUrl}

Release Room: ${data.releaseUrl}

---
Good Life Room Booking System
`.trim();
}

export class EmailService {
  private fromEmail: string;

  constructor() {
    // Default from email - should be configured in env
    this.fromEmail = process.env.EMAIL_FROM || 'Room Booking <rooms@goodlifegroup.com>';
  }

  /**
   * Send overdue room reminder email
   */
  async sendOverdueRoomReminder(
    data: Omit<OverdueReminderEmailData, 'startTime' | 'endTime'> & {
      startTimeIso: string;
      endTimeIso: string;
      timezone?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const emailData: OverdueReminderEmailData = {
        to: data.to,
        hostName: data.hostName,
        roomName: data.roomName,
        startTime: formatTime(data.startTimeIso, data.timezone),
        endTime: formatTime(data.endTimeIso, data.timezone),
        extendUrl: data.extendUrl,
        releaseUrl: data.releaseUrl,
      };

      const { data: result, error } = await getResendClient().emails.send({
        from: this.fromEmail,
        to: emailData.to,
        subject: 'Forgot to release the room?',
        html: generateOverdueReminderHtml(emailData),
        text: generateOverdueReminderText(emailData),
      });

      if (error) {
        console.error('Failed to send overdue reminder email:', error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: result?.id };
    } catch (error: any) {
      console.error('Email service error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }

  /**
   * Send a conflict notification when extension is not possible
   */
  async sendExtensionConflictNotification(
    to: string,
    hostName: string,
    roomName: string,
    conflictOwner: string,
    conflictStart: string,
    conflictEnd: string,
    timezone?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 500px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="padding: 32px; text-align: center;">
              <div style="width: 56px; height: 56px; background-color: #FEE2E2; border-radius: 50%; margin: 0 auto 16px auto;">
                <span style="font-size: 28px; line-height: 56px;">❌</span>
              </div>
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #111827;">
                Can't extend the room
              </h1>
              <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #374151;">
                Hey ${hostName}, we couldn't extend your booking for <strong>${roomName}</strong>.
              </p>
              <p style="margin: 16px 0 0 0; font-size: 16px; line-height: 1.6; color: #374151;">
                There is another event by <strong>${conflictOwner}</strong> from <strong>${formatTime(conflictStart, timezone)}</strong> to <strong>${formatTime(conflictEnd, timezone)}</strong>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

      const text = `
Can't extend the room

Hey ${hostName}, we couldn't extend your booking for ${roomName}.

There is another event by ${conflictOwner} from ${formatTime(conflictStart, timezone)} to ${formatTime(conflictEnd, timezone)}.
`.trim();

      const { data: result, error } = await getResendClient().emails.send({
        from: this.fromEmail,
        to,
        subject: `Can't extend ${roomName}`,
        html,
        text,
      });

      if (error) {
        console.error('Failed to send conflict notification:', error);
        return { success: false, error: error.message };
      }

      return { success: true, messageId: result?.id };
    } catch (error: any) {
      console.error('Email service error:', error);
      return { success: false, error: error.message || 'Unknown error' };
    }
  }
}

// Singleton
let emailService: EmailService;

export function getEmailService(): EmailService {
  if (!emailService) {
    emailService = new EmailService();
  }
  return emailService;
}
