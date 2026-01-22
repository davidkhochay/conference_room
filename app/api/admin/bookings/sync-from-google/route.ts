import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { syncRoomFromGoogle } from '@/lib/services/google-sync.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const roomId: string | undefined = body.room_id;

    const supabase = getServerAdminClient();

    if (roomId) {
      const result = await syncRoomFromGoogle(roomId);
      return NextResponse.json({
        success: true,
        data: { room_id: roomId, synced: result.synced },
      });
    }

    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('id')
      .or('google_calendar_id.not.is.null,google_resource_id.not.is.null');

    if (error) {
      throw new Error(`Failed to load rooms for sync: ${error.message}`);
    }

    const results: Array<{ room_id: string; synced: number }> = [];

    for (const room of rooms || []) {
      const id = String((room as any).id);
      const result = await syncRoomFromGoogle(id);
      results.push({ room_id: id, synced: result.synced });
    }

    return NextResponse.json({
      success: true,
      data: {
        processed: results.length,
        results,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          error: 'GOOGLE_SYNC_ERROR',
          message: error?.message || 'Failed to sync bookings from Google',
        },
      },
      { status: 500 }
    );
  }
}


