import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    
    // Check if this is a recurring booking
    const supabase = getServerAdminClient();
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('is_recurring, recurring_parent_id')
      .eq('id', bookingId)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Protect recurring bookings - they can only be cancelled via admin panel
    if (booking.is_recurring || booking.recurring_parent_id) {
      // Check if request is from admin panel (via header or referer)
      const isAdminRequest = request.headers.get('x-admin-request') === 'true' ||
        request.headers.get('referer')?.includes('/admin/');

      if (!isAdminRequest) {
        return NextResponse.json(
          { 
            success: false, 
            error: { 
              error: 'RECURRING_PROTECTED', 
              message: 'Recurring meetings can only be cancelled by an administrator. Please contact your admin.' 
            } 
          },
          { status: 403 }
        );
      }
    }

    const bookingService = getBookingService();
    await bookingService.cancelBooking(bookingId);

    // Don't sync from Google immediately after cancellation - Google Calendar
    // needs time to propagate the deletion, and syncing too early can revert
    // the local 'cancelled' status. Let the natural sync cycle handle it.

    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'CANCEL_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

