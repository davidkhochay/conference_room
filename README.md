# Good Life Group Conference Room Booking Platform

An internal conference room booking platform for Good Life Group, supporting multiple Google Workspace domains and companies under one umbrella organization.

## Features

- **Multi-Domain Support**: Integrate multiple Google Workspace domains under one platform
- **Google Calendar Integration**: Seamless sync with Google Calendar for room resources and events
- **Web Booking**: User-friendly web interface for booking rooms with calendar integration
- **Tablet Display**: Touch-screen interfaces mounted outside rooms for quick booking
- **Admin Panel**: Comprehensive management for rooms, users, locations, and analytics
- **Real-Time Status**: Live room availability and instant booking confirmation

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: Supabase (PostgreSQL)
- **APIs**: Google Calendar API, Google Admin SDK / Directory API
- **Authentication**: NextAuth.js with Google OAuth

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase account and project
- Google Cloud project with Calendar API and Admin SDK enabled
- Google Service Account with domain-wide delegation

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd conference_room_glc
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Google Service Account
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account-email
GOOGLE_PRIVATE_KEY=your-private-key
GOOGLE_PROJECT_ID=your-project-id

# NextAuth (for Google OAuth)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-a-secret-here
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

4. Set up the database:

Run the SQL schema in your Supabase SQL Editor:
```bash
cat supabase/schema.sql
```

Copy and execute the contents in Supabase.

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
conference_room_glc/
├── app/                      # Next.js app directory
│   ├── admin/               # Admin panel pages
│   ├── api/                 # API routes
│   ├── book/                # Booking interface
│   └── tablet/              # Tablet display
├── lib/                     # Shared libraries
│   ├── components/          # React components
│   ├── services/            # Business logic services
│   ├── supabase/            # Supabase clients
│   └── types/               # TypeScript types
├── supabase/                # Database schema
└── public/                  # Static assets
```

## Core Concepts

### Data Model

- **Company**: Represents a Good Life Group company with one or more domains
- **DomainIntegration**: Links Google Workspace domains to companies
- **User**: Synced from Google, tagged with company and role
- **Location**: Physical office locations with rooms
- **Room**: Conference rooms with capacity, features, and Google resource linkage
- **Booking**: Room reservations with Google Calendar event sync
- **Setting/Policy**: Configurable rules and limits

### User Flows

#### Web Booking
1. Browse available rooms by location and features
2. Select a room and time slot
3. Add attendees and meeting details
4. System creates booking and Google Calendar event

#### Tablet Quick Booking
1. Tablet displays room status (available/occupied)
2. User taps quick duration button (15/30/45/60 minutes)
3. System checks availability and creates immediate booking
4. Room status updates in real-time

#### Admin Management
1. Manage companies and domain integrations
2. CRUD operations for rooms and locations
3. View and manage users
4. Configure policies and view analytics

## API Endpoints

### Rooms
- `GET /api/rooms` - List all rooms
- `POST /api/rooms` - Create a room
- `GET /api/rooms/[roomId]` - Get room details
- `PATCH /api/rooms/[roomId]` - Update room
- `DELETE /api/rooms/[roomId]` - Delete room
- `GET /api/rooms/[roomId]/status` - Get room status and bookings

### Bookings
- `GET /api/bookings` - List bookings
- `POST /api/bookings` - Create a booking
- `POST /api/bookings/quick` - Quick booking (tablet)
- `POST /api/bookings/[bookingId]/extend` - Extend booking
- `POST /api/bookings/[bookingId]/cancel` - Cancel booking
- `POST /api/bookings/[bookingId]/checkin` - Check in to booking
- `POST /api/bookings/[bookingId]/end` - End booking early

### Admin
- `GET /api/admin/companies` - List companies
- `POST /api/admin/companies` - Create company
- `GET /api/admin/locations` - List locations
- `POST /api/admin/locations` - Create location

## Google Integration

### Service Account Setup

1. Create a service account in Google Cloud Console
2. Enable Calendar API and Admin SDK
3. Create and download JSON key
4. Configure domain-wide delegation in Google Workspace
5. Add the service account email with required scopes

### Required Scopes

- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/admin.directory.user.readonly`
- `https://www.googleapis.com/auth/admin.directory.resource.calendar`

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Configure environment variables
4. Deploy

### Other Platforms

The application can be deployed to any platform supporting Next.js:
- AWS Amplify
- Netlify
- Docker container

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
npm start
```

## Contributing

This is an internal Good Life Group project. For questions or contributions, contact the platform team.

## License

Proprietary - Good Life Group Internal Use Only

## Support

For support, please contact the IT team or create an issue in the internal project tracker.
