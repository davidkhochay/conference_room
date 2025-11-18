import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { CreateCompanySchema } from '@/lib/types/api.types';

export async function GET() {
  try {
    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('companies')
      .select('*')
      .order('name');

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
    const validatedData = CreateCompanySchema.parse(body);

    const supabase = getServerAdminClient();

    const { data, error } = await supabase
      .from('companies')
      .insert(validatedData)
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
      { success: false, error: { error: 'VALIDATION_ERROR', message: error.message } },
      { status: 400 }
    );
  }
}

