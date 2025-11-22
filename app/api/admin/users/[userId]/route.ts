import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { UpdateUserSchema } from '@/lib/types/api.types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('users')
      .select('*, company:companies(name)')
      .eq('id', userId)
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 404 }
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
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('users')
      .update({
        name: body.name,
        email: body.email,
        role: body.role,
        company_id: body.company_id || null,
        photo_url: body.photo_url || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 400 }
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const json = await request.json();
    const parseResult = UpdateUserSchema.safeParse(json);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'VALIDATION_ERROR',
            message: 'Invalid user update payload',
            details: parseResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const body = parseResult.data;

    // Only allow toggling between active and inactive via this route.
    if (
      body.status &&
      body.status !== 'active' &&
      body.status !== 'inactive'
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'VALIDATION_ERROR',
            message: 'Only active/inactive status can be set via this endpoint',
          },
        },
        { status: 400 }
      );
    }

    const supabase = getServerAdminClient();

    const { data: userBefore, error: loadError } = await supabase
      .from('users')
      .select('id, role, status')
      .eq('id', userId)
      .single();

    if (loadError || !userBefore) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'NOT_FOUND',
            message: 'User not found',
          },
        },
        { status: 404 }
      );
    }

    // Optional safety: prevent deactivating the last active admin
    if (body.status === 'inactive' && userBefore.role === 'admin') {
      const { count, error: countError } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'admin')
        .eq('status', 'active');

      if (countError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error: 'DATABASE_ERROR',
              message: countError.message,
            },
          },
          { status: 500 }
        );
      }

      if ((count || 0) <= 1) {
        return NextResponse.json(
          {
            success: false,
            error: {
              error: 'BUSINESS_RULE',
              message: 'Cannot deactivate the last active admin user',
            },
          },
          { status: 400 }
        );
      }
    }

    const updatePayload: any = {};
    if (body.status) {
      updatePayload.status = body.status;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 400 }
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = getServerAdminClient();

    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 400 }
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

