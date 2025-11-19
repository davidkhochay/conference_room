import { NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = getServerAdminClient();

    // Get all mapped rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, name, floor_id, map_position')
      .not('map_position', 'is', null);

    if (roomsError) {
      return NextResponse.json({ error: roomsError.message }, { status: 500 });
    }

    // Get floor dimensions
    const { data: floors, error: floorsError } = await supabase
      .from('floors')
      .select('id, name, width, height, image_url');

    if (floorsError) {
      return NextResponse.json({ error: floorsError.message }, { status: 500 });
    }

    return NextResponse.json({
      rooms: rooms || [],
      floors: floors || []
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

