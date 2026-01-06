import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { getServerAdminClient } from '@/lib/supabase/server';

/**
 * DELETE /api/admin/recurring/[seriesId]/occurrences/[occurrenceId]
 * Cancel a single occurrence from a recurring series (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string; occurrenceId: string }> }
) {
  try {
    const { seriesId, occurrenceId } = await params;
    const supabase = getServerAdminClient();

    // Verify the occurrence belongs to this series
    const { data: occurrence, error: fetchError } = await supabase
      .from('bookings')
      .select('id, recurring_parent_id, is_recurring, status')
      .eq('id', occurrenceId)
      .single();

    if (fetchError || !occurrence) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Occurrence not found' } },
        { status: 404 }
      );
    }

    // Check if it's part of the series
    const isPartOfSeries = 
      occurrence.id === seriesId || 
      occurrence.recurring_parent_id === seriesId ||
      occurrence.is_recurring;

    if (!isPartOfSeries) {
      return NextResponse.json(
        { success: false, error: { error: 'INVALID_REQUEST', message: 'Occurrence does not belong to this series' } },
        { status: 400 }
      );
    }

    if (occurrence.status === 'cancelled') {
      return NextResponse.json(
        { success: false, error: { error: 'ALREADY_CANCELLED', message: 'This occurrence is already cancelled' } },
        { status: 400 }
      );
    }

    // Cancel the occurrence
    const bookingService = getBookingService();
    await bookingService.cancelBooking(occurrenceId);

    return NextResponse.json({
      success: true,
      data: {
        message: 'Occurrence cancelled successfully',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'CANCEL_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

