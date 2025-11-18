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
  google_user_id: string;
  primary_email: string;
  name: string;
  company_id: string;
  is_admin: boolean;
  is_location_manager: boolean;
  photo_url: string | null;
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
  source: 'tablet' | 'web' | 'api' | 'admin';
  status: 'scheduled' | 'in_progress' | 'ended' | 'cancelled' | 'no_show';
  check_in_time: string | null;
  extended_count: number;
  attendee_emails: string[];
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

