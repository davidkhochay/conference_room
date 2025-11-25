import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { ExtendBookingSchema } from '@/lib/types/api.types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const body = await request.json();
    const validatedData = ExtendBookingSchema.parse({ ...body, booking_id: bookingId });

    const bookingService = getBookingService();
    const booking = await bookingService.extendBooking(
      validatedData.booking_id,
      validatedData.additional_minutes
    );

    // Don't sync from Google immediately after extension - let the natural
    // sync cycle handle it to avoid timing conflicts.

    return NextResponse.json({ success: true, data: booking });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'EXTEND_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

