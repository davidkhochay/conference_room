import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;
    const supabase = getServerAdminClient();

    // Fetch booking with all related information
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        room:rooms(
          *,
          location:locations(*)
        ),
        host:users(*)
      `)
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) {
      return NextResponse.json(
        { success: false, error: { error: 'NOT_FOUND', message: 'Booking not found' } },
        { status: 404 }
      );
    }

    // Fetch activity log for this booking
    const { data: activityLog, error: activityError } = await supabase
      .from('booking_activity_log')
      .select(`
        *,
        performed_by:users(name, email)
      `)
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (activityError) {
      console.error('Failed to fetch activity log:', activityError);
      // Continue without activity log rather than failing
    }

    // If no host but we have organizer_email, look up the user by email
    let organizer: { name: string; email: string } | null = null;
    if (!booking.host && booking.organizer_email) {
      const { data: organizerUser } = await supabase
        .from('users')
        .select('name, email')
        .eq('email', booking.organizer_email)
        .single();
      
      if (organizerUser) {
        organizer = organizerUser;
      }
    }

    // Combine the data
    const response = {
      ...booking,
      activity_log: activityLog || [],
      organizer, // Will be null if no match found or if host exists
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error: any) {
    console.error('Failed to fetch booking details:', error);
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

