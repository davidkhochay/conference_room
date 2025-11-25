import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    const bookingService = getBookingService();
    await bookingService.endBookingEarly(bookingId);

    // Don't sync from Google immediately after release - Google Calendar needs
    // time to propagate the deletion, and syncing too early can revert the
    // local 'ended' status. Let the natural sync cycle handle it.

    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'END_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

