import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { getServerAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/recurring/[seriesId]
 * Get details of a specific recurring series including all occurrences
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const supabase = getServerAdminClient();

    // Get the parent booking
    const { data: parent, error: parentError } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(id, name, location:locations(id, name, timezone)),
        host:users(id, name, email)
      `)
      .eq('id', seriesId)
      .single();

    if (parentError || !parent) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Recurring series not found' } },
        { status: 404 }
      );
    }

    if (!parent.is_recurring) {
      return NextResponse.json(
        { success: false, error: { error: 'INVALID_REQUEST', message: 'This is not a recurring booking' } },
        { status: 400 }
      );
    }

    // Get all occurrences
    const { data: occurrences, error: occError } = await supabase
      .from('bookings')
      .select('id, title, start_time, end_time, status, check_in_time')
      .or(`id.eq.${seriesId},recurring_parent_id.eq.${seriesId}`)
      .order('start_time', { ascending: true });

    if (occError) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: occError.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        parent,
        occurrences: occurrences || [],
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/recurring/[seriesId]
 * Cancel an entire recurring series (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params;
    const bookingService = getBookingService();

    const result = await bookingService.cancelRecurringSeries(seriesId);

    return NextResponse.json({
      success: true,
      data: {
        cancelled_count: result.cancelledCount,
        message: `Cancelled ${result.cancelledCount} booking(s) in the series`,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'CANCEL_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

