# Good Life Room Booking - Setup Guide

## Quick Start

Your Good Life Room Booking platform is now set up! Follow these steps to complete the configuration and launch.

## 1. Environment Variables

You need to create a `.env.local` file in the root directory. Here's what you need:

```bash
# Supabase Configuration (Already configured)
NEXT_PUBLIC_SUPABASE_URL=https://xpzzvuaqiytgnaychoea.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwenp2dWFxaXl0Z25heWNob2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMzOTk5NDAsImV4cCI6MjA3ODk3NTk0MH0.Jiun1vyCwkv629gdTeosrS5_QJTlw-6UXJDi0dnOMCo
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhwenp2dWFxaXl0Z25heWNob2VhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzM5OTk0MCwiZXhwIjoyMDc4OTc1OTQwfQ._tidyr0I8EStrDzYikrYHt5PqKvT07WbxEyNesGkaLI

# Google Service Account (Already configured)
GOOGLE_SERVICE_ACCOUNT_EMAIL=room-booking-service@good-life-room-booking.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDKqoX5C6PB5QuV\nqQsYcySLEkCoqr7ceVZnakvTvM9o5sqO8Sg8COxhxY/XSuSsDgJGNVVG2reZyrVx\nPcCnK5ESd3mYAVD5mPtXtK2Vngq1/B5UL21zii7tpFA6xV6Vp4NePJVnlPB2/DNp\nRt50O8m5t+MTsgAQz5TWVtmXsOnv65iUddeRa0elegaZgr3NReZqgW+M9e3oh2Qc\nrfqmDNj4lon+N5NR4jgmao1dmUvTn00bnSnUVg0wWiybemBmxgAYl/ZMsU2SjSmO\naWFNI0ihJLrQPYsCEHMSOo1p+RbPhFrmN1rBsynL7NpNgUMg2x4MHltuoJzLMkyJ\nf19UfbYvAgMBAAECggEAD8XStG27+nClhKnJ08bOTsaGYrobLZSB7X1/1kRJDhx8\nIkDRhU6aeweBqNtKzbsvYSBweRm3lVAJ6/zG3BvPaBUFURe1Ih/OW+aTZeQNaFlt\nUNb6GTZlbZhOqCxJLrOBTVnAtPWJ+3CoXaam1Hv8uKf/k75UM/q71iyfNaeOpV3Y\npZaljRxmsI9JzD0wJTrUHubicPfLSA6535PSVwr2I9vFQisZgR7TL4PM3ociNinR\nUofTfJ5R0+NIzyBibL46BcXNg9Q8AIUCE2ZGw9XxpQIMvnr2cD5ohhEX4D62wsCm\n4Au4mS+4bMJo79OgiXbo606C61mX3kLFqPpSban5TQKBgQDoKLjcUUPvUjzqgpuo\n1dRqq2Dk+w1R4s/9HKNeB2bjQdCIGcExFWJRTrjIVCEZtjAV3jIoXnPVPYD5ZVdA\nuPm7taLvIaEvTWoG5kF/2mvjnAtNmFaCxaV13L89SFF3Eisk/NIaAghp9KeHUnTx\nxCWNclBmPNd9+ypht8SwUdRQHQKBgQDfenRfeCtezUEoQmtKjLz6d7rco9Cn3/jn\nwBaPujaTkv3dQYYilTiW/xhdwJEUHGEDLJi0MaiTozB/Z/ehaqjeeTNZ2f3h2i3r\n9ACFxLFyrKCt3PIaeFqWmCbRrtaG/0D8qKTjWPwnYuLDkpjcItdstAhrTR00ZvLd\ntPIMl68luwKBgBnVtkSmMnYmY6sBH8tZCEtaiOzSVzgekmCrWC61iiiOAWOz4gDR\nTWCY7w0z938B/DXixRgi8qbvMjQOp/gG3Zua6efMiUBXUA42f2F37/ujOMrIwg/J\naNFF4G40ZwRmHDEAhWzpfwAzfpUbgvIIjtk/uFy4No7JbXz0U0n/wS2tAoGAPiBB\nt8Slce5nnbSRNSFY69xbEzlrKTAndu28l+oxf+cOMfMkQfrvx3JVKML+0fNtuL8u\nGHHxplFoixKxEaugFHDnKKRkYuQPfhfQCV/74KBC7vKMT3WD4Xec2w/azZ6qR1Lu\nu9EiECT6W1omqpP5BVwrNwEyDD5OZ/oEjCGi7D8CgYAFfxdlUvkGZbYqw3h878mU\nop8FgX7wcdp3nDYacUy0/nZwxLWBeNkGMdeC9flCI00Y94YT8uTptfjHFsLx4khj\npCs1AEcQcdYPcqeKSjpWnu+6mrm2iq3PLjlBzFaH8hQQcwC56hGx9COVNDPv4teQ\n9VmYHPrIsrbuJBEUwwCSlA==\n-----END PRIVATE KEY-----\n"
GOOGLE_PROJECT_ID=good-life-room-booking

# NextAuth (Need to configure)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-change-this-in-production
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
```

### To generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

## 2. Database Setup

1. Go to your Supabase dashboard: https://supabase.com/dashboard/project/xpzzvuaqiytgnaychoea

2. Navigate to SQL Editor

3. Copy and paste the entire contents of `supabase/schema.sql`

4. Execute the SQL to create all tables, indexes, and triggers

## 3. Google Cloud Setup

### Domain-Wide Delegation (Required for user/room sync)

Your service account is already created. Now you need to set up domain-wide delegation:

1. Go to Google Workspace Admin Console
2. Navigate to Security > API Controls > Domain-wide delegation
3. Add your service account client ID: `101097704595236323461`
4. Add these scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/admin.directory.user.readonly`
   - `https://www.googleapis.com/auth/admin.directory.resource.calendar`

### Google OAuth (For web authentication)

1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials?project=good-life-room-booking
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (development)
   - `https://your-production-domain.com/api/auth/callback/google` (production)
4. Copy the Client ID and Client Secret to your `.env.local`

## 4. Initial Data Setup

Once the database is set up, you'll need to add initial data:

### Add a Location
```sql
INSERT INTO locations (name, address, timezone) VALUES
('Phoenix Office', '123 Main St, Phoenix, AZ', 'America/Phoenix');
```

### Add a Company
```sql
INSERT INTO companies (name, primary_domain) VALUES
('Good Life Mortgage West', 'goodlifemortgagewest.com');
```

### Add a Room
```sql
INSERT INTO rooms (name, location_id, capacity, features, status)
SELECT 
  'Conference Room A',
  id,
  10,
  '{"tv": true, "camera": true, "whiteboard": true}'::jsonb,
  'active'
FROM locations WHERE name = 'Phoenix Office';
```

## 5. Run the Application

```bash
npm run dev
```

Open http://localhost:3000 in your browser!

## 6. Access Different Interfaces

### Home Page
http://localhost:3000

### Web Booking
http://localhost:3000/book

### Admin Panel
http://localhost:3000/admin

### Tablet Display (for a specific room)
http://localhost:3000/tablet/[ROOM_ID]

Replace [ROOM_ID] with actual room UUID from database.

## 7. Next Steps

1. **Add Companies & Domains**: Use admin panel to add all 7 Good Life companies
2. **Sync Users**: Create a sync job or use Google Directory API to import users
3. **Add All Rooms**: Use admin panel to add conference rooms for each location
4. **Configure Room Tablets**: 
   - Set up device keys for each room
   - Install tablets with kiosk mode browsers
   - Point them to `/tablet/[room-id]`
5. **Set Up Policies**: Configure booking rules in admin settings
6. **Enable Authentication**: Set up NextAuth for user login (optional for booking)

## Troubleshooting

### Database Connection Issues
- Verify Supabase credentials in `.env.local`
- Check Supabase project is active
- Verify RLS policies allow service role access

### Google API Issues
- Ensure service account has domain-wide delegation
- Verify all required scopes are added
- Check that Calendar API and Admin SDK are enabled in Google Cloud

### Build Errors
- Run `npm install --legacy-peer-deps` if dependency issues occur
- Clear `.next` folder: `rm -rf .next`
- Rebuild: `npm run build`

## Production Deployment

### Environment Variables for Production
Update these for production:
- `NEXTAUTH_URL`: Your production domain
- `NEXTAUTH_SECRET`: Generate a new strong secret
- Add production OAuth redirect URLs

### Recommended Hosting
- **Vercel** (easiest for Next.js)
- **AWS Amplify**
- **Netlify**
- **Docker** on any cloud provider

### Security Checklist
- [ ] Rotate all secrets from development
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Set up authentication for admin panel
- [ ] Review and tighten RLS policies
- [ ] Set up monitoring and logging
- [ ] Configure backup for Supabase

## Support

For issues or questions:
- Check the main README.md
- Review API documentation in code comments
- Contact the development team

Happy booking! 🎉

