import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    const bookingService = getBookingService();
    await bookingService.cancelBooking(bookingId);

    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'CANCEL_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

