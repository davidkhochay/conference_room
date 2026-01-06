// Database types matching Supabase schema

export type Company = {
  id: string;
  name: string;
  primary_domain: string;
  other_domains: string[];
  created_at: string;
  updated_at: string;
};

export type DomainIntegration = {
  id: string;
  company_id: string;
  domain: string;
  google_customer_id: string | null;
  google_admin_email: string | null;
  oauth_refresh_token: string | null;
  service_account_config: Record<string, any> | null;
  status: 'pending' | 'active' | 'error' | 'disabled';
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: string;
  /**
   * Google Directory user ID. Nullable so we can support manually created
   * internal users and keep existing rows even if the Google user is removed.
   */
  google_user_id: string | null;
  /**
   * Primary email address for the user. This is the unique key we use for
   * sync/upsert from Google Directory.
   */
  email: string;
  name: string;
  /**
   * Company the user belongs to. Nullable to support users that are not yet
   * mapped or are shared across companies.
   */
  company_id: string | null;
  /**
   * Role in the app – kept separate from Google admin roles.
   */
  role: 'user' | 'admin';
  is_location_manager: boolean;
  photo_url: string | null;
  /**
   * active   – normal user; can be picked in UI and used as host.
   * inactive – only visible in admin; treated as if they don't exist in
   *            booking/search flows.
   * deleted  – reserved for hard removals / historical records.
   */
  status: 'active' | 'inactive' | 'deleted';
  created_at: string;
  updated_at: string;
};

export type Location = {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
};

export type Floor = {
  id: string;
  location_id: string;
  name: string;
  level: number;
  image_url: string | null;
  width: number;
  height: number;
  svg_content: string | null;
  test_pins: string | null;
  created_at: string;
  updated_at: string;
};

export type RoomFeatures = {
  tv?: boolean;
  camera?: boolean;
  whiteboard?: boolean;
  projector?: boolean;
  video_conference?: boolean;
  phone?: boolean;
  [key: string]: boolean | undefined;
};

export type Room = {
  id: string;
  name: string;
  location_id: string;
  floor_id: string | null;
  map_position: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    points?: Array<{x: number; y: number}>;
    type?: 'rect' | 'polygon';
    // Optional \"You are here\" marker position inside the room, in floor coordinates.
    you_x?: number;
    you_y?: number;
  } | null;
  google_resource_id: string | null;
  google_calendar_id: string | null;
  capacity: number;
  photo_url: string | null;
  features: RoomFeatures;
  allow_walk_up_booking: boolean;
  max_booking_duration_minutes: number | null;
  device_key: string | null;
  qr_code_url: string | null;
  status: 'active' | 'maintenance' | 'disabled';
  created_at: string;
  updated_at: string;
};

/**
 * Recurrence rule for recurring bookings.
 * - type: 'weekly' or 'monthly'
 * - daysOfWeek: For weekly, array of day numbers (0=Sunday, 1=Monday, etc.)
 * - dayOfMonth: For monthly, which day of the month (1-31)
 */
export type RecurrenceRule = {
  type: 'weekly' | 'monthly';
  daysOfWeek?: number[]; // 0-6, for weekly recurrence
  dayOfMonth?: number;   // 1-31, for monthly recurrence
};

export type Booking = {
  id: string;
  room_id: string;
  host_user_id: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  google_event_id: string | null;
  google_calendar_id: string | null;
  source: 'tablet' | 'web' | 'api' | 'admin' | 'google_calendar';
  status: 'scheduled' | 'in_progress' | 'ended' | 'cancelled' | 'no_show';
  check_in_time: string | null;
  extended_count: number;
  attendee_emails: string[];
  /**
   * Optional metadata for events that originated outside this app, e.g.
   * meetings created directly in the Google Calendar UI.
   */
  external_source?: string | null;
  organizer_email?: string | null;
  last_synced_at?: string | null;
  /**
   * Recurring booking fields
   */
  is_recurring: boolean;
  recurrence_rule?: RecurrenceRule | null;
  recurrence_end_date?: string | null;
  recurring_parent_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type Setting = {
  id: string;
  key: string;
  value: any;
  scope: 'global' | 'location' | 'room';
  scope_id: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type FeatureRequest = {
  id: string;
  user_id: string | null;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'shipped' | 'declined';
  votes: number;
  created_at: string;
  updated_at: string;
};

export type BookingActivityLog = {
  id: string;
  booking_id: string;
  action: 'created' | 'checked_in' | 'extended' | 'ended_early' | 'cancelled' | 'no_show';
  performed_by_user_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
};

// Extended types with relations
export type RoomWithLocation = Room & {
  location: Location;
};

export type BookingWithDetails = Booking & {
  room: RoomWithLocation;
  host?: User;
};

export type UserWithCompany = User & {
  company: Company;
};

