import { NextRequest, NextResponse } from 'next/server';
import { getServerAdminClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Helper to normalize role value
const normalizeRole = (value: string | undefined | null): 'user' | 'admin' => {
  if (!value) return 'user';
  const lower = value.toLowerCase().trim();
  if (lower === 'admin') return 'admin';
  return 'user';
};

// Helper to normalize status value
const normalizeStatus = (value: string | undefined | null): 'active' | 'inactive' | 'deleted' => {
  if (!value) return 'active';
  const lower = value.toLowerCase().trim();
  if (lower === 'inactive') return 'inactive';
  if (lower === 'deleted') return 'deleted';
  return 'active';
};

// Schema for checking duplicates - more flexible with string inputs
const CheckDuplicatesSchema = z.object({
  rows: z.array(
    z.object({
      name: z.string().min(1, 'Name is required'),
      email: z.string().email('Invalid email address'),
      role: z.string().optional().transform(normalizeRole),
      company: z.string().optional(),
      status: z.string().optional().transform(normalizeStatus),
    })
  ),
  defaultCompanyId: z.string().uuid().nullable().optional(),
});

// Schema for executing import
const ExecuteImportSchema = z.object({
  toInsert: z.array(
    z.object({
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['user', 'admin']).optional(),
      company_id: z.string().uuid().nullable().optional(),
      status: z.enum(['active', 'inactive', 'deleted']).optional(),
    })
  ),
  toUpdate: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      email: z.string().email(),
      role: z.enum(['user', 'admin']).optional(),
      company_id: z.string().uuid().nullable().optional(),
      status: z.enum(['active', 'inactive', 'deleted']).optional(),
    })
  ),
});

export async function POST(request: NextRequest) {
  try {
    const json = await request.json();
    const supabase = getServerAdminClient();

    // Check if this is a duplicate check request or an execute request
    const executeResult = ExecuteImportSchema.safeParse(json);
    
    if (executeResult.success) {
      // Execute import
      const { toInsert, toUpdate } = executeResult.data;
      
      let insertedCount = 0;
      let updatedCount = 0;
      const errors: Array<{ email: string; error: string }> = [];

      // Insert new users
      if (toInsert.length > 0) {
        for (const user of toInsert) {
          const { error } = await supabase.from('users').insert({
            email: user.email.toLowerCase(),
            name: user.name,
            role: user.role || 'user',
            company_id: user.company_id || null,
            status: user.status || 'active',
            is_location_manager: false,
          });

          if (error) {
            errors.push({ email: user.email, error: error.message });
          } else {
            insertedCount++;
          }
        }
      }

      // Update existing users
      if (toUpdate.length > 0) {
        for (const user of toUpdate) {
          const { error } = await supabase
            .from('users')
            .update({
              name: user.name,
              role: user.role,
              company_id: user.company_id,
              status: user.status,
            })
            .eq('id', user.id);

          if (error) {
            errors.push({ email: user.email, error: error.message });
          } else {
            updatedCount++;
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          insertedCount,
          updatedCount,
          errors,
        },
      });
    }

    // Check duplicates request
    const checkResult = CheckDuplicatesSchema.safeParse(json);
    
    if (!checkResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            error: 'VALIDATION_ERROR',
            message: 'Invalid request payload',
            details: checkResult.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const { rows, defaultCompanyId } = checkResult.data;

    // Get all companies for name matching
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name');
    
    const companyMap = new Map<string, string>();
    if (companies) {
      for (const company of companies) {
        companyMap.set(company.name.toLowerCase(), company.id);
      }
    }

    // Get existing users by email
    const emails = rows.map((r) => r.email.toLowerCase());
    const { data: existingUsers } = await supabase
      .from('users')
      .select('id, email, name, role, company_id, status, company:companies(name)')
      .in('email', emails);

    const existingUserMap = new Map<string, NonNullable<typeof existingUsers>[number]>();
    if (existingUsers) {
      for (const user of existingUsers) {
        existingUserMap.set(user.email.toLowerCase(), user);
      }
    }

    // Categorize rows
    const duplicates: Array<{
      rowIndex: number;
      newData: {
        name: string;
        email: string;
        role: string;
        company_id: string | null;
        company_name: string | null;
        status: string;
      };
      existingUser: {
        id: string;
        name: string;
        email: string;
        role: string;
        company_id: string | null;
        company_name: string | null;
        status: string;
      };
    }> = [];

    const readyToInsert: Array<{
      name: string;
      email: string;
      role: string;
      company_id: string | null;
      status: string;
    }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = row.email.toLowerCase();
      
      // Determine company_id
      let companyId: string | null = null;
      let companyName: string | null = null;
      
      if (row.company) {
        const matchedId = companyMap.get(row.company.toLowerCase());
        if (matchedId) {
          companyId = matchedId;
          companyName = row.company;
        }
      }
      
      if (!companyId && defaultCompanyId) {
        companyId = defaultCompanyId;
        // Find company name for default
        for (const [name, id] of companyMap.entries()) {
          if (id === defaultCompanyId) {
            companyName = name;
            break;
          }
        }
      }

      const existingUser = existingUserMap.get(email);
      
      if (existingUser) {
        // Duplicate found
        duplicates.push({
          rowIndex: i,
          newData: {
            name: row.name,
            email: row.email,
            role: row.role, // Already normalized by schema transform
            company_id: companyId,
            company_name: companyName,
            status: row.status, // Already normalized by schema transform
          },
          existingUser: {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
            company_id: existingUser.company_id,
            company_name: (existingUser.company as { name: string } | null)?.name || null,
            status: existingUser.status,
          },
        });
      } else {
        // Ready to insert
        readyToInsert.push({
          name: row.name,
          email: row.email,
          role: row.role, // Already normalized by schema transform
          company_id: companyId,
          status: row.status, // Already normalized by schema transform
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        duplicates,
        readyToInsert,
      },
    });
  } catch (error: unknown) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    return NextResponse.json(
      {
        success: false,
        error: {
          error: 'INTERNAL_ERROR',
          message,
        },
      },
      { status: 500 }
    );
  }
}
