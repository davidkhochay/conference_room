import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { CreateRoomSchema } from '@/lib/types/api.types';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerAdminClient();
    const searchParams = request.nextUrl.searchParams;
    const locationId = searchParams.get('location_id');
    const status = searchParams.get('status') || 'active';

    let query = supabase
      .from('rooms')
      .select('*, location:locations(*)')
      .eq('status', status)
      .order('name');

    if (locationId) {
      query = query.eq('location_id', locationId);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = CreateRoomSchema.parse(body);

    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('rooms')
      .insert(validatedData)
      .select('*, location:locations(*)')
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'VALIDATION_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

