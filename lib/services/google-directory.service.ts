import { google, admin_directory_v1 } from 'googleapis';
import { JWT } from 'google-auth-library';

type ServiceAccountConfig = {
  clientEmail?: string;
  privateKey?: string;
};

export class GoogleDirectoryService {
  private admin: admin_directory_v1.Admin;
  private auth: JWT;

  constructor(config?: ServiceAccountConfig) {
    const clientEmail =
      config?.clientEmail || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const rawKey =
      config?.privateKey || process.env.GOOGLE_PRIVATE_KEY || '';

    if (!clientEmail || !rawKey) {
      throw new Error(
        'GoogleDirectoryService is missing service account credentials'
      );
    }

    this.auth = new JWT({
      email: clientEmail,
      key: rawKey.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/admin.directory.user.readonly',
        'https://www.googleapis.com/auth/admin.directory.resource.calendar',
      ],
    });

    this.admin = google.admin({ version: 'directory_v1', auth: this.auth });
  }

  /**
   * Set domain-wide delegation subject (admin user to impersonate)
   */
  setSubject(email: string) {
    this.auth.subject = email;
  }

  /**
   * List all users in a domain
   */
  async listUsers(domain: string, adminEmail: string): Promise<admin_directory_v1.Schema$User[]> {
    // Set subject to admin email for domain-wide delegation
    this.setSubject(adminEmail);

    const users: admin_directory_v1.Schema$User[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.admin.users.list({
        domain,
        maxResults: 500,
        pageToken,
        projection: 'full',
      });

      if (response.data.users) {
        users.push(...response.data.users);
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return users;
  }

  /**
   * Get a specific user by email
   */
  async getUser(userKey: string, adminEmail: string): Promise<admin_directory_v1.Schema$User> {
    this.setSubject(adminEmail);

    const response = await this.admin.users.get({
      userKey,
    });

    return response.data;
  }

  /**
   * List calendar resources (rooms) in a domain
   */
  async listCalendarResources(
    customerId: string,
    adminEmail: string
  ): Promise<admin_directory_v1.Schema$CalendarResource[]> {
    this.setSubject(adminEmail);

    const resources: admin_directory_v1.Schema$CalendarResource[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.admin.resources.calendars.list({
        customer: customerId,
        maxResults: 500,
        pageToken,
      });

      if (response.data.items) {
        resources.push(...response.data.items);
      }

      pageToken = response.data.nextPageToken || undefined;
    } while (pageToken);

    return resources;
  }

  /**
   * Get a specific calendar resource
   */
  async getCalendarResource(
    customerId: string,
    calendarResourceId: string,
    adminEmail: string
  ): Promise<admin_directory_v1.Schema$CalendarResource> {
    this.setSubject(adminEmail);

    const response = await this.admin.resources.calendars.get({
      customer: customerId,
      calendarResourceId,
    });

    return response.data;
  }

  /**
   * Create a calendar resource
   */
  async createCalendarResource(
    customerId: string,
    adminEmail: string,
    resourceData: {
      resourceName: string;
      resourceType?: string;
      capacity?: number;
      buildingId?: string;
      floorName?: string;
      userVisibleDescription?: string;
    }
  ): Promise<admin_directory_v1.Schema$CalendarResource> {
    this.setSubject(adminEmail);

    const response = await this.admin.resources.calendars.insert({
      customer: customerId,
      requestBody: {
        resourceName: resourceData.resourceName,
        resourceType: resourceData.resourceType || 'CONFERENCE_ROOM',
        capacity: resourceData.capacity,
        buildingId: resourceData.buildingId,
        floorName: resourceData.floorName,
        userVisibleDescription: resourceData.userVisibleDescription,
      },
    });

    return response.data;
  }

  /**
   * Update a calendar resource
   */
  async updateCalendarResource(
    customerId: string,
    calendarResourceId: string,
    adminEmail: string,
    resourceData: Partial<{
      resourceName: string;
      capacity: number;
      buildingId: string;
      floorName: string;
      userVisibleDescription: string;
    }>
  ): Promise<admin_directory_v1.Schema$CalendarResource> {
    this.setSubject(adminEmail);

    const response = await this.admin.resources.calendars.patch({
      customer: customerId,
      calendarResourceId,
      requestBody: resourceData,
    });

    return response.data;
  }
}

// Singleton instance
let googleDirectoryService: GoogleDirectoryService;

export function getGoogleDirectoryService(): GoogleDirectoryService {
  if (!googleDirectoryService) {
    googleDirectoryService = new GoogleDirectoryService();
  }
  return googleDirectoryService;
}

/**
 * Factory helper that builds a Google Directory client for a specific
 * domain integration. If no per-domain service account config is present,
 * it falls back to the global singleton.
 */
export function createDirectoryServiceForIntegration(integration: {
  service_account_config?: Record<string, any> | null;
}): GoogleDirectoryService {
  const cfg = integration.service_account_config as
    | {
        client_email?: string;
        private_key?: string;
      }
    | null
    | undefined;

  if (cfg?.client_email && cfg?.private_key) {
    return new GoogleDirectoryService({
      clientEmail: cfg.client_email,
      privateKey: cfg.private_key,
    });
  }

  return getGoogleDirectoryService();
}

