import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

const SUPPORTED_KEYS = [
  'booking_hours_start',
  'booking_hours_end',
  'tablet_admin_pin',
] as const;

type SupportedKey = (typeof SUPPORTED_KEYS)[number];

export async function GET() {
  try {
    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('settings')
      .select('key, value')
      .eq('scope', 'global')
      .in('key', SUPPORTED_KEYS as unknown as string[]);

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    const map: Record<string, any> = {};
    (data || []).forEach((row: any) => {
      map[row.key] = row.value;
    });

    return NextResponse.json({
      success: true,
      data: {
        booking_hours_start: map['booking_hours_start'] ?? '7',
        booking_hours_end: map['booking_hours_end'] ?? '19',
        tablet_admin_pin: map['tablet_admin_pin'] ?? '',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = getServerAdminClient();
    const body = await request.json();

    const rows: Array<{ key: SupportedKey; value: any; scope: 'global' }> = [];

    SUPPORTED_KEYS.forEach((key) => {
      if (body[key] !== undefined && body[key] !== null) {
        let value = body[key];

        // Normalize tablet PIN to a trimmed string
        if (key === 'tablet_admin_pin') {
          value = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
        }

        rows.push({
          key,
          value,
          scope: 'global',
        });
      }
    });

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: null });
    }

    const { error } = await supabase
      .from('settings')
      .upsert(rows as any, { onConflict: 'key,scope,scope_id' });

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: null });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}


