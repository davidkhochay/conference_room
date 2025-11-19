import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ floorId: string }> }
) {
  try {
    const { floorId } = await params;
    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('floors')
      .select('*')
      .eq('id', floorId)
      .single();

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ floorId: string }> }
) {
  try {
    const { floorId } = await params;
    const body = await request.json();
    const supabase = getServerAdminClient();

    console.log('PUT /floors/[floorId] - Received:', {
      floorId,
      body,
    });

    const updateData = {
      name: body.name,
      level: body.level,
      image_url: body.image_url,
      width: body.width,
      height: body.height,
      svg_content: body.svg_content,
      test_pins: body.test_pins || null,
      updated_at: new Date().toISOString(),
    };

    console.log('Updating floor with:', updateData);

    const { data, error } = await supabase
      .from('floors')
      .update(updateData)
      .eq('id', floorId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    console.log('Floor updated successfully:', data);
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('PUT /floors/[floorId] error:', error);
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ floorId: string }> }
) {
  try {
    const { floorId } = await params;
    const supabase = getServerAdminClient();

    const { error } = await supabase
      .from('floors')
      .delete()
      .eq('id', floorId);

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

