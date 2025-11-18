# API Reference Guide

Complete API documentation for the Good Life Room Booking platform.

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://your-domain.com/api`

## Authentication

### Tablet Authentication
Tablets use device keys in headers:
```
X-Device-Key: room-specific-device-key
```

### Web Authentication
Web requests use NextAuth session cookies (to be implemented).

### Admin Operations
Admin endpoints use Supabase service role authentication.

---

## Rooms API

### List All Rooms
```http
GET /api/rooms?location_id={uuid}&status={active|maintenance|disabled}
```

**Query Parameters:**
- `location_id` (optional): Filter by location
- `status` (optional): Filter by status (default: "active")

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Conference Room A",
      "capacity": 10,
      "location": {
        "id": "uuid",
        "name": "Phoenix Office",
        "timezone": "America/Phoenix"
      },
      "features": {
        "tv": true,
        "camera": true,
        "whiteboard": true
      },
      "status": "active"
    }
  ]
}
```

### Get Room Details
```http
GET /api/rooms/{roomId}
```

### Create Room
```http
POST /api/rooms
Content-Type: application/json

{
  "name": "Conference Room B",
  "location_id": "uuid",
  "capacity": 8,
  "features": {
    "tv": true,
    "camera": false
  },
  "allow_walk_up_booking": true
}
```

### Update Room
```http
PATCH /api/rooms/{roomId}
Content-Type: application/json

{
  "capacity": 12,
  "status": "maintenance"
}
```

### Delete Room
```http
DELETE /api/rooms/{roomId}
```

### Get Room Status
```http
GET /api/rooms/{roomId}/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "room_id": "uuid",
    "room_name": "Conference Room A",
    "location_name": "Phoenix Office",
    "is_occupied": false,
    "current_booking": null,
    "next_bookings": [
      {
        "id": "uuid",
        "title": "Team Meeting",
        "host_name": "John Doe",
        "start_time": "2024-01-15T14:00:00Z",
        "end_time": "2024-01-15T15:00:00Z"
      }
    ],
    "available_until": "2024-01-15T14:00:00Z"
  }
}
```

---

## Bookings API

### List Bookings
```http
GET /api/bookings?room_id={uuid}&user_id={uuid}&start_date={iso}&end_date={iso}
```

**Query Parameters:**
- `room_id` (optional): Filter by room
- `user_id` (optional): Filter by host user
- `start_date` (optional): Filter bookings starting after this date
- `end_date` (optional): Filter bookings ending before this date

### Create Booking
```http
POST /api/bookings
Content-Type: application/json

{
  "room_id": "uuid",
  "host_user_id": "uuid",
  "title": "Team Standup",
  "description": "Daily standup meeting",
  "start_time": "2024-01-15T09:00:00Z",
  "end_time": "2024-01-15T09:30:00Z",
  "source": "web",
  "attendee_emails": [
    "john@example.com",
    "jane@example.com"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "room_id": "uuid",
    "title": "Team Standup",
    "start_time": "2024-01-15T09:00:00Z",
    "end_time": "2024-01-15T09:30:00Z",
    "status": "scheduled",
    "google_event_id": "google-event-id"
  }
}
```

### Quick Booking (Tablet)
```http
POST /api/bookings/quick
Content-Type: application/json
X-Device-Key: room-device-key

{
  "room_id": "uuid",
  "duration_minutes": 30,
  "source": "tablet"
}
```

Creates a booking starting immediately.

### Extend Booking
```http
POST /api/bookings/{bookingId}/extend
Content-Type: application/json

{
  "additional_minutes": 30
}
```

### Cancel Booking
```http
POST /api/bookings/{bookingId}/cancel
```

### Check In to Booking
```http
POST /api/bookings/{bookingId}/checkin
```

Marks booking as in-progress and records check-in time.

### End Booking Early
```http
POST /api/bookings/{bookingId}/end
```

---

## Admin API

### Companies

#### List Companies
```http
GET /api/admin/companies
```

#### Create Company
```http
POST /api/admin/companies
Content-Type: application/json

{
  "name": "Good Life Mortgage West",
  "primary_domain": "goodlifemortgagewest.com",
  "other_domains": ["glmw.com"]
}
```

### Locations

#### List Locations
```http
GET /api/admin/locations
```

#### Create Location
```http
POST /api/admin/locations
Content-Type: application/json

{
  "name": "Phoenix Office",
  "address": "123 Main St, Phoenix, AZ 85001",
  "timezone": "America/Phoenix",
  "metadata": {
    "building": "Main Tower",
    "floor": "3rd Floor"
  }
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": {
    "error": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {}
  }
}
```

### Common Error Codes

- `NOT_FOUND`: Resource not found (404)
- `VALIDATION_ERROR`: Invalid request data (400)
- `DATABASE_ERROR`: Database operation failed (500)
- `BOOKING_ERROR`: Booking operation failed (400)
- `INTERNAL_ERROR`: Unexpected server error (500)

---

## Data Types

### Booking Status
- `scheduled`: Booking created, not yet started
- `in_progress`: Currently ongoing
- `ended`: Completed normally
- `cancelled`: Cancelled before starting
- `no_show`: Auto-released due to no check-in

### Booking Source
- `tablet`: Created from room tablet
- `web`: Created from web interface
- `api`: Created via API
- `admin`: Created by administrator

### Room Status
- `active`: Available for booking
- `maintenance`: Temporarily unavailable
- `disabled`: Permanently unavailable

---

## Rate Limits

Currently no rate limits are enforced. For production:
- Consider implementing rate limiting
- Use caching for frequently accessed endpoints
- Implement request throttling for tablet endpoints

---

## Webhooks (Future Enhancement)

Potential webhook events:
- `booking.created`
- `booking.cancelled`
- `booking.checked_in`
- `booking.no_show`
- `room.status_changed`

---

## Testing Examples

### Using cURL

**Create a quick booking:**
```bash
curl -X POST http://localhost:3000/api/bookings/quick \
  -H "Content-Type: application/json" \
  -H "X-Device-Key: your-device-key" \
  -d '{
    "room_id": "your-room-uuid",
    "duration_minutes": 30,
    "source": "tablet"
  }'
```

**Get room status:**
```bash
curl http://localhost:3000/api/rooms/your-room-uuid/status
```

**Create a full booking:**
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "room_id": "your-room-uuid",
    "title": "Team Meeting",
    "start_time": "2024-01-15T14:00:00Z",
    "end_time": "2024-01-15T15:00:00Z",
    "source": "web",
    "attendee_emails": ["user@example.com"]
  }'
```

### Using JavaScript/Fetch

```javascript
// Create a booking
const response = await fetch('/api/bookings', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    room_id: 'room-uuid',
    title: 'My Meeting',
    start_time: new Date(Date.now() + 3600000).toISOString(),
    end_time: new Date(Date.now() + 7200000).toISOString(),
    source: 'web',
  }),
});

const result = await response.json();
if (result.success) {
  console.log('Booking created:', result.data);
} else {
  console.error('Error:', result.error);
}
```

---

## Best Practices

1. **Always check availability** before creating bookings
2. **Use proper timezone** handling (store in UTC, display in local)
3. **Handle conflicts gracefully** when extending or creating bookings
4. **Implement retry logic** for Google Calendar API calls
5. **Cache room status** on tablet displays with periodic refresh
6. **Validate input** on both client and server
7. **Log all booking operations** for audit trails

---

## Future API Additions

Potential future endpoints:
- `/api/analytics/utilization` - Room utilization stats
- `/api/analytics/no-shows` - No-show analysis
- `/api/users/sync` - Sync users from Google
- `/api/rooms/suggest` - Room suggestions based on criteria
- `/api/bookings/recurring` - Create recurring bookings
- `/api/notifications/preferences` - Manage notification settings

