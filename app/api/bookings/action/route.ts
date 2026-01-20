import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';

/**
 * Format a date string for display
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
 * Generate HTML response page
 */
function htmlResponse(
  title: string,
  message: string,
  success: boolean,
  details?: string
): NextResponse {
  const icon = success ? '✅' : '❌';
  const bgColor = success ? '#DCFCE7' : '#FEE2E2';
  const textColor = success ? '#166534' : '#991B1B';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 40px 20px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      padding: 40px;
      max-width: 440px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      background: ${bgColor};
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 24px auto;
      font-size: 36px;
    }
    h1 {
      margin: 0 0 16px 0;
      font-size: 24px;
      font-weight: 600;
      color: #111827;
    }
    p {
      margin: 0 0 12px 0;
      font-size: 16px;
      line-height: 1.6;
      color: #4B5563;
    }
    .details {
      margin-top: 20px;
      padding: 16px;
      background: #F9FAFB;
      border-radius: 8px;
      font-size: 14px;
      color: ${textColor};
    }
    .close-btn {
      display: inline-block;
      margin-top: 24px;
      padding: 12px 32px;
      background: #2563EB;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      font-size: 15px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${details ? `<div class="details">${details}</div>` : ''}
    <a href="javascript:window.close();" class="close-btn">Close this page</a>
  </div>
</body>
</html>
`;

  return new NextResponse(html, {
    status: success ? 200 : 400,
    headers: { 'Content-Type': 'text/html' },
  });
}

/**
 * Handle email action links for extend/release room
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const action = searchParams.get('action');

  // Validate params
  if (!token) {
    return htmlResponse(
      'Invalid Link',
      'This link is missing required information.',
      false
    );
  }

  if (action !== 'extend' && action !== 'release') {
    return htmlResponse(
      'Invalid Action',
      'The requested action is not recognized.',
      false
    );
  }

  const bookingService = getBookingService();

  // Look up booking by token
  const result = await bookingService.getBookingByActionToken(token);

  if (!result) {
    return htmlResponse(
      'Link Expired',
      'This action link has already been used or has expired.',
      false
    );
  }

  const { booking } = result;
  const timezone = booking.room?.location?.timezone || 'America/New_York';

  // Check if booking is still active
  if (booking.status === 'ended' || booking.status === 'cancelled' || booking.status === 'no_show') {
    return htmlResponse(
      'Booking Already Ended',
      `This booking for ${booking.room.name} has already been ${booking.status === 'cancelled' ? 'cancelled' : 'ended'}.`,
      false
    );
  }

  try {
    if (action === 'release') {
      // End the booking early
      await bookingService.endBookingEarly(booking.id, booking.host_user_id || undefined);
      await bookingService.invalidateActionToken(booking.id);

      return htmlResponse(
        'Room Released',
        `${booking.room.name} has been released and is now available for others.`,
        true,
        `Booking ended at ${formatTime(new Date().toISOString(), timezone)}`
      );
    }

    if (action === 'extend') {
      // Check if extension is possible
      const extensionCheck = await bookingService.checkExtensionAvailability(booking.id, 30);

      if (!extensionCheck.canExtend) {
        const conflict = extensionCheck.conflict;
        const conflictInfo = conflict
          ? `<strong>${conflict.organizer || 'Someone'}</strong> has ${booking.room.name} booked from <strong>${formatTime(conflict.start, timezone)}</strong> to <strong>${formatTime(conflict.end, timezone)}</strong>.`
          : 'There is another booking immediately after yours.';

        return htmlResponse(
          "Can't Extend",
          `We couldn't extend your booking for ${booking.room.name}.`,
          false,
          conflictInfo
        );
      }

      // Extend the booking
      const extended = await bookingService.extendBooking(
        booking.id,
        30,
        booking.host_user_id || undefined
      );
      await bookingService.invalidateActionToken(booking.id);

      return htmlResponse(
        'Room Extended',
        `${booking.room.name} has been extended by 30 minutes.`,
        true,
        `New end time: ${formatTime(extended.end_time, timezone)}`
      );
    }
  } catch (error: any) {
    console.error('Action error:', error);
    return htmlResponse(
      'Something Went Wrong',
      error.message || 'An unexpected error occurred. Please try again.',
      false
    );
  }

  return htmlResponse('Unknown Error', 'Something unexpected happened.', false);
}
