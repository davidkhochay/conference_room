import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const { pin: rawPin } = await request.json();
    const pin = typeof rawPin === 'string' ? rawPin.trim() : '';

    if (!pin) {
      return NextResponse.json(
        { success: false, error: { error: 'BAD_REQUEST', message: 'PIN is required' } },
        { status: 400 }
      );
    }

    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('scope', 'global')
      .eq('key', 'tablet_admin_pin')
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { success: false, error: { error: 'DATABASE_ERROR', message: error.message } },
        { status: 500 }
      );
    }

    const stored = data?.value ?? '';
    const storedPin = typeof stored === 'string' ? stored.trim() : String(stored).trim();
    const valid = storedPin && pin === storedPin;

    return NextResponse.json({ success: true, data: { valid } }, { status: valid ? 200 : 401 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { error: 'INTERNAL_ERROR', message: error.message } },
      { status: 500 }
    );
  }
}


