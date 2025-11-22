import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { CreateUserSchema } from '@/lib/types/api.types';

export async function GET(request: NextRequest) {
  try {
    const supabase = getServerAdminClient();

    const url = new URL(request.url);
    const statusParam = (url.searchParams.get('status') || 'active').toLowerCase();

    let query = supabase
      .from('users')
      .select('*, company:companies(name)')
      .order('name', { ascending: true });

    if (statusParam === 'active') {
      query = query.eq('status', 'active');
    } else if (statusParam === 'inactive') {
      query = query.eq('status', 'inactive');
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
    const json = await request.json();
    const parseResult = CreateUserSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'VALIDATION_ERROR',
            message: 'Invalid user payload',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const body = parseResult.data;
    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('users')
      .insert({
        google_user_id: body.google_user_id ?? null,
        email: body.email.toLowerCase(),
        name: body.name,
        role: body.role,
        company_id: body.company_id ?? null,
        is_location_manager: body.is_location_manager,
        photo_url: body.photo_url ?? null,
        status: body.status,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 400 }
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

