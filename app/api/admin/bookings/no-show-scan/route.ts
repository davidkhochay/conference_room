import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';

export async function POST(_request: NextRequest) {
  try {
    const bookingService = getBookingService();
    const result = await bookingService.markNoShows();

    return NextResponse.json({
      success: true,
      data: {
        updated_count: result.updatedCount,
        grace_minutes: result.graceMinutes,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          error: 'NO_SHOW_SCAN_ERROR',
          message: error.message || 'Failed to scan for no-shows',
        },
      },
      { status: 500 }
    );
  }
}


