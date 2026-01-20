import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { getEmailService } from '@/lib/services/email.service';
import { randomBytes } from 'crypto';

/**
 * Generate a secure random token for action links
 */
function generateActionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get the base URL for the application
 */
function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL 
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
}

/**
 * Cron endpoint to scan for overdue bookings and send reminder emails
 * 
 * This should be called by a scheduled job (Supabase pg_cron, Vercel cron, etc.)
 * Protected by CRON_SECRET header
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const bookingService = getBookingService();
  const emailService = getEmailService();
  const baseUrl = getAppBaseUrl();

  const results: Array<{
    bookingId: string;
    email: string;
    success: boolean;
    error?: string;
  }> = [];

  try {
    // Find all overdue bookings that need reminders
    const overdueBookings = await bookingService.findOverdueBookings();

    console.log(`Found ${overdueBookings.length} overdue bookings to process`);

    for (const booking of overdueBookings) {
      try {
        // Generate a unique action token
        const actionToken = generateActionToken();

        // Build action URLs
        const extendUrl = `${baseUrl}/api/bookings/action?token=${actionToken}&action=extend`;
        const releaseUrl = `${baseUrl}/api/bookings/action?token=${actionToken}&action=release`;

        // Send the email
        const emailResult = await emailService.sendOverdueRoomReminder({
          to: booking.host.email,
          hostName: booking.host.name || booking.host.email.split('@')[0],
          roomName: booking.room.name,
          startTimeIso: booking.start_time,
          endTimeIso: booking.end_time,
          timezone: booking.room.location.timezone,
          extendUrl,
          releaseUrl,
        });

        if (emailResult.success) {
          // Mark the reminder as sent and store the token
          await bookingService.markOverdueReminderSent(booking.id, actionToken);

          results.push({
            bookingId: booking.id,
            email: booking.host.email,
            success: true,
          });
        } else {
          results.push({
            bookingId: booking.id,
            email: booking.host.email,
            success: false,
            error: emailResult.error,
          });
        }
      } catch (error: any) {
        console.error(`Failed to process booking ${booking.id}:`, error);
        results.push({
          bookingId: booking.id,
          email: booking.host.email,
          success: false,
          error: error.message,
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      data: {
        processed: overdueBookings.length,
        sent: successCount,
        failed: failureCount,
        results,
      },
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      {
        success: false,
        error: { error: 'CRON_ERROR', message: error.message },
      },
      { status: 500 }
    );
  }
}

/**
 * Also allow GET for easier testing/manual triggers
 */
export async function GET(request: NextRequest) {
  return POST(request);
}
