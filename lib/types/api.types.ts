// API request and response types

import { z } from 'zod';

// Booking request schemas
export const CreateBookingSchema = z.object({
  room_id: z.string().uuid(),
  host_user_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  source: z.enum(['tablet', 'web', 'api', 'admin']),
  attendee_emails: z.array(z.string().email()).optional(),
});

export type CreateBookingRequest = z.infer<typeof CreateBookingSchema>;

export const QuickBookingSchema = z.object({
  room_id: z.string().uuid(),
  duration_minutes: z.number().int().positive().max(240),
  source: z.enum(['tablet', 'web']).default('tablet'),
});

export type QuickBookingRequest = z.infer<typeof QuickBookingSchema>;

export const ExtendBookingSchema = z.object({
  booking_id: z.string().uuid(),
  additional_minutes: z.number().int().positive().max(120),
});

export type ExtendBookingRequest = z.infer<typeof ExtendBookingSchema>;

// Room request schemas
export const CreateRoomSchema = z.object({
  name: z.string().min(1).max(100),
  location_id: z.string().uuid(),
  google_resource_id: z.string().optional(),
  google_calendar_id: z.string().optional(),
  capacity: z.number().int().positive(),
  photo_url: z.string().url().optional(),
  features: z.record(z.boolean()).optional(),
  allow_walk_up_booking: z.boolean().default(true),
  status: z.enum(['active', 'maintenance', 'disabled']).default('active'),
  max_booking_duration_minutes: z.number().int().positive().optional(),
  floor_id: z.string().uuid().optional(),
  map_position: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    type: z.enum(['rect', 'polygon']).optional(),
    // Optional \"You are here\" marker inside the room, in floor coordinates
    you_x: z.number().optional(),
    you_y: z.number().optional(),
  }).optional(),
});

export type CreateRoomRequest = z.infer<typeof CreateRoomSchema>;

export const UpdateRoomSchema = CreateRoomSchema.partial();
export type UpdateRoomRequest = z.infer<typeof UpdateRoomSchema>;

// Room status response
export type RoomStatusResponse = {
  room_id: string;
  room_name: string;
  location_name: string;
  photo_url: string | null;
  capacity: number;
  features?: {
    tv: boolean;
    whiteboard: boolean;
  };
  is_occupied: boolean;
  current_booking: {
    id: string;
    title: string;
    host_name: string | null;
    start_time: string;
    end_time: string;
  } | null;
  next_bookings: Array<{
    id: string;
    title: string;
    host_name: string | null;
    start_time: string;
    end_time: string;
  }>;
  available_until: string | null; // ISO datetime or null if not currently available
  ui_state: 'free' | 'checkin' | 'busy'; // unified UI state for maps, tablets, and overlays
};

// Room availability request
export const CheckAvailabilitySchema = z.object({
  room_ids: z.array(z.string().uuid()).optional(),
  location_id: z.string().uuid().optional(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  min_capacity: z.number().int().positive().optional(),
  required_features: z.array(z.string()).optional(),
});

export type CheckAvailabilityRequest = z.infer<typeof CheckAvailabilitySchema>;

export type RoomAvailability = {
  room_id: string;
  room_name: string;
  location_name: string;
  capacity: number;
  features: Record<string, boolean>;
  is_available: boolean;
  conflicting_bookings: Array<{
    start_time: string;
    end_time: string;
  }>;
};

// User request schemas (internal app users, not raw Google objects)
export const CreateUserSchema = z.object({
  google_user_id: z.string().optional(),
  email: z.string().email(),
  name: z.string(),
  company_id: z.string().uuid().nullable().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  is_location_manager: z.boolean().default(false),
  photo_url: z.string().url().optional(),
  status: z.enum(['active', 'inactive', 'deleted']).default('active'),
});

export type CreateUserRequest = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  name: z.string().optional(),
  email: z.string().email().optional(),
  company_id: z.string().uuid().nullable().optional(),
  role: z.enum(['user', 'admin']).optional(),
  is_location_manager: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'deleted']).optional(),
  photo_url: z.string().url().optional(),
});

export type UpdateUserRequest = z.infer<typeof UpdateUserSchema>;

// Company request schemas
export const CreateCompanySchema = z.object({
  name: z.string().min(1).max(200),
  primary_domain: z.string(),
  other_domains: z.array(z.string()).optional(),
});

export type CreateCompanyRequest = z.infer<typeof CreateCompanySchema>;

// Location request schemas
export const CreateLocationSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().optional(),
  timezone: z.string().default('America/Phoenix'),
  metadata: z.record(z.any()).optional(),
});

export type CreateLocationRequest = z.infer<typeof CreateLocationSchema>;

// Analytics types
export type RoomUtilizationData = {
  room_id: string;
  room_name: string;
  location_name: string;
  total_hours_available: number;
  total_hours_booked: number;
  utilization_percentage: number;
  total_bookings: number;
  no_show_count: number;
  source_breakdown: {
    tablet: number;
    web: number;
    api: number;
    admin: number;
  };
};

export type LocationUtilizationData = {
  location_id: string;
  location_name: string;
  rooms: RoomUtilizationData[];
  aggregate_utilization: number;
};

// Error response
export type ApiError = {
  error: string;
  message: string;
  details?: any;
};

// Success response wrapper
export type ApiResponse<T> = {
  success: true;
  data: T;
} | {
  success: false;
  error: ApiError;
};

