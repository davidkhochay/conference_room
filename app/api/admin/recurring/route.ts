import { NextRequest, NextResponse } from 'next/server';
import { getBookingService } from '@/lib/services/booking.service';
import { getServerAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/recurring
 * List all recurring booking series
 */
export async function GET() {
  try {
    const supabase = getServerAdminClient();
    
    // Get all parent recurring bookings with room and host details
    const { data: recurringBookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(id, name, location:locations(id, name)),
        host:users(id, name, email)
      `)
      .eq('is_recurring', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    // Get occurrence counts and status summary for each series
    const enrichedData = await Promise.all(
      (recurringBookings || []).map(async (parent) => {
        // Get all occurrences for this series
        const { data: occurrences } = await supabase
          .from('bookings')
          .select('id, status, start_time')
          .or(`id.eq.${parent.id},recurring_parent_id.eq.${parent.id}`)
          .order('start_time', { ascending: true });

        const allOccurrences = occurrences || [];
        const scheduled = allOccurrences.filter(o => o.status === 'scheduled').length;
        const completed = allOccurrences.filter(o => o.status === 'ended' || o.status === 'in_progress').length;
        const cancelled = allOccurrences.filter(o => o.status === 'cancelled').length;
        const noShow = allOccurrences.filter(o => o.status === 'no_show').length;

        // Find next upcoming occurrence
        const now = new Date().toISOString();
        const nextOccurrence = allOccurrences.find(
          o => o.start_time > now && o.status === 'scheduled'
        );

        return {
          ...parent,
          occurrence_count: allOccurrences.length,
          status_summary: {
            scheduled,
            completed,
            cancelled,
            no_show: noShow,
          },
          next_occurrence: nextOccurrence?.start_time || null,
        };
      })
    );

    return NextResponse.json({ success: true, data: enrichedData });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

