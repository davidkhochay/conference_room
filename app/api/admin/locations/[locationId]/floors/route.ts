import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('floors')
      .select('*')
      .eq('location_id', locationId)
      .order('level', { ascending: true });

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ locationId: string }> }
) {
  try {
    const { locationId } = await params;
    const body = await request.json();
    // Simple validation - should use Zod ideally but keeping it simple as per prompt "Plan mode"
    if (!body.name) {
      return NextResponse.json(
        { success: false, error: { error: 'VALIDATION_ERROR', message: 'Name is required' } },
        { status: 400 }
      );
    }

    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('floors')
      .insert({
        location_id: locationId,
        name: body.name,
        level: body.level || 1,
        image_url: body.image_url,
        width: body.width || 1000,
        height: body.height || 1000,
        svg_content: body.svg_content,
      })
      .select()
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
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

