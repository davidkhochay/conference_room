import { NextRequest, NextResponse } from 'next/server';
import { syncAllDomainsUsers } from '@/lib/services/user-sync.service';

export async function POST(request: NextRequest) {
  try {
    const result = await syncAllDomainsUsers();
    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          error: 'INTERNAL_ERROR',
          message: error.message || 'Failed to sync users from Google',
        },
      },
      { status: 500 }
    );
  }
}


