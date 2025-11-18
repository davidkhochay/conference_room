import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { QuickBookingSchema } from '@/lib/types/api.types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = QuickBookingSchema.parse(body);

    // Get device key from headers for tablet authentication
    const deviceKey = request.headers.get('x-device-key') || undefined;

    const bookingService = getBookingService();
    const booking = await bookingService.createQuickBooking(validatedData, deviceKey);

    return NextResponse.json({ success: true, data: booking }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'BOOKING_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

