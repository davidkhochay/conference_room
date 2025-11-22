import { getServerAdminClient } from '../supabase/server';
import {
  DomainIntegration,
  User,
} from '../types/database.types';
import {
  createDirectoryServiceForIntegration,
} from './google-directory.service';

type SyncUserStats = {
  integration_id: string;
  domain: string;
  totalGoogleUsers: number;
  inserted: number;
  updated: number;
  skippedWithoutEmail: number;
};

const supabase = getServerAdminClient();

/**
 * Map a Google Directory user into the internal User shape used for upsert.
 * This does NOT decide the final status; that is handled by mergeStatus.
 */
function mapGoogleUserToPartialUser(
  gUser: any,
  integration: DomainIntegration
): Pick<
  User,
  'google_user_id' | 'email' | 'name' | 'company_id' | 'photo_url'
> & { rawStatusHint: 'active' | 'inactive' | 'deleted' } {
  const email: string | undefined = gUser.primaryEmail;

  if (!email) {
    throw new Error('Google user missing primaryEmail');
  }

  const fullName: string | undefined = gUser.name?.fullName;
  const thumbnail: string | undefined = gUser.thumbnailPhotoUrl;

  // Basic status mapping from Google Directory flags
  const suspended: boolean = !!gUser.suspended;
  const archived: boolean = !!(gUser as any).archived;
  const deletionTime: string | undefined = (gUser as any).deletionTime;

  let rawStatusHint: 'active' | 'inactive' | 'deleted' = 'active';
  if (deletionTime) {
    rawStatusHint = 'deleted';
  } else if (suspended || archived) {
    rawStatusHint = 'inactive';
  }

  return {
    google_user_id: gUser.id || null,
    email: email.toLowerCase(),
    name: fullName || email,
    company_id: integration.company_id,
    photo_url: thumbnail || null,
    rawStatusHint,
  };
}

/**
 * Merge the "hint" from Google with the existing local status, making sure
 * we never auto-reactivate someone the admin explicitly inactivated.
 */
function mergeStatus(
  existingStatus: User['status'] | null,
  rawStatusHint: 'active' | 'inactive' | 'deleted'
): User['status'] {
  if (!existingStatus) {
    return rawStatusHint;
  }

  // Admin-chosen inactive/deleted should win over Google hints
  if (existingStatus === 'inactive' || existingStatus === 'deleted') {
    return existingStatus;
  }

  // Existing active user: allow Google to downgrade to inactive/deleted
  return rawStatusHint;
}

/**
 * Sync users for a single domain integration from Google Directory into the
 * internal users table.
 */
export async function syncDomainUsers(
  integration: DomainIntegration
): Promise<SyncUserStats> {
  if (!integration.domain) {
    throw new Error('DomainIntegration.domain is required');
  }
  if (!integration.google_admin_email) {
    throw new Error(
      `DomainIntegration.google_admin_email is required for domain ${integration.domain}`
    );
  }

  const directory = createDirectoryServiceForIntegration(integration);
  const googleUsers =
    await directory.listUsers(integration.domain, integration.google_admin_email);

  const stats: SyncUserStats = {
    integration_id: integration.id,
    domain: integration.domain,
    totalGoogleUsers: googleUsers.length,
    inserted: 0,
    updated: 0,
    skippedWithoutEmail: 0,
  };

  if (!googleUsers.length) {
    return stats;
  }

  // Filter/transform Google users into a normalized shape and collect emails
  const partials = [];
  for (const gUser of googleUsers) {
    if (!gUser.primaryEmail) {
      stats.skippedWithoutEmail += 1;
      continue;
    }
    partials.push(mapGoogleUserToPartialUser(gUser, integration));
  }

  if (!partials.length) {
    return stats;
  }

  const emails = partials.map((u) => u.email);

  // Load existing users for this company and these emails so we can preserve status
  const { data: existing, error: existingError } = await supabase
    .from('users')
    .select('id, email, status')
    .in('email', emails)
    .eq('company_id', integration.company_id);

  if (existingError) {
    throw new Error(
      `Failed to load existing users for domain ${integration.domain}: ${existingError.message}`
    );
  }

  const existingByEmail = new Map<string, { id: string; status: User['status'] }>();
  (existing || []).forEach((row: any) => {
    if (row.email) {
      existingByEmail.set(String(row.email).toLowerCase(), {
        id: row.id,
        status: row.status as User['status'],
      });
    }
  });

  const upserts: Array<Partial<User>> = [];

  for (const partial of partials) {
    const existingEntry = existingByEmail.get(partial.email);
    const status = mergeStatus(
      existingEntry?.status ?? null,
      partial.rawStatusHint
    );

    upserts.push({
      google_user_id: partial.google_user_id,
      email: partial.email,
      name: partial.name,
      company_id: partial.company_id,
      photo_url: partial.photo_url,
      status,
    });

    if (existingEntry) {
      stats.updated += 1;
    } else {
      stats.inserted += 1;
    }
  }

  const { error: upsertError } = await supabase
    .from('users')
    .upsert(upserts, { onConflict: 'email' });

  if (upsertError) {
    throw new Error(
      `Failed to upsert users for domain ${integration.domain}: ${upsertError.message}`
    );
  }

  return stats;
}

export type SyncAllDomainsResult = {
  processed: number;
  results: Array<
    SyncUserStats & {
      error?: string;
    }
  >;
};

/**
 * Sync users for all active domain integrations.
 */
export async function syncAllDomainsUsers(): Promise<SyncAllDomainsResult> {
  const { data: integrations, error } = await supabase
    .from('domain_integrations')
    .select('*')
    .eq('status', 'active');

  if (error) {
    throw new Error(`Failed to load domain integrations: ${error.message}`);
  }

  const results: SyncAllDomainsResult['results'] = [];

  for (const integration of integrations || []) {
    const typedIntegration = integration as DomainIntegration;
    try {
      const stats = await syncDomainUsers(typedIntegration);

      await supabase
        .from('domain_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_error: null,
        })
        .eq('id', typedIntegration.id);

      results.push(stats);
    } catch (e: any) {
      const message = e?.message || String(e);

      await supabase
        .from('domain_integrations')
        .update({
          last_sync_at: new Date().toISOString(),
          sync_error: message,
          status: 'error',
        })
        .eq('id', typedIntegration.id);

      results.push({
        integration_id: typedIntegration.id,
        domain: typedIntegration.domain,
        totalGoogleUsers: 0,
        inserted: 0,
        updated: 0,
        skippedWithoutEmail: 0,
        error: message,
      });
    }
  }

  return {
    processed: results.length,
    results,
  };
}


