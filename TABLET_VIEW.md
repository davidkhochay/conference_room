# 📱 Tablet Display View

## Overview
The tablet view is designed for iPads or Android tablets mounted outside conference rooms. It provides a clean, touch-optimized interface for quick room bookings and status display.

## Accessing Tablet View

**URL Pattern:**
```
https://your-domain.com/tablet/[ROOM_ID]
```

**Example:**
```
https://conference.goodlifegroup.com/tablet/123e4567-e89b-12d3-a456-426614174000
```

## Features

### 🎨 Visual Status
- **Green Background** = Room is available
- **Red Background** = Room is currently occupied
- Full-screen, color-coded display visible from a distance

### ⏱️ Real-Time Information
- Live clock updates every second
- Room status refreshes every 30 seconds
- Shows current booking details
- Displays up to 4 upcoming bookings

### 🚀 Quick Booking Buttons
When room is available:
- **15 minutes** - Quick standup
- **30 minutes** - Standard meeting
- **45 minutes** - Extended discussion
- **60 minutes** - Full hour

### 🔧 Meeting Management
When room is in use:
- **Extend +15 min** - Add 15 minutes to current meeting
- **Extend +30 min** - Add 30 minutes to current meeting
- **End Meeting Now** - Release the room early

### 📱 QR Code Feature
- Tap "Show QR Code" button
- Displays QR code for advanced booking
- Users scan to access full booking form on their phone
- Allows adding attendees, custom times, and meeting details

## Display Information

### Header Shows:
- Room name (large, bold)
- Location name with icon
- Room capacity
- Current time and date

### Main Status Shows:
- "AVAILABLE" or "IN USE" (large text)
- Current booking title and host (if occupied)
- End time of current booking
- "Available until" next booking time
- Room photo as subtle background overlay

### Upcoming Bookings Show:
- Next 4 scheduled meetings
- Meeting titles
- Host names
- Start and end times
- Numbered sequence (1, 2, 3, 4)

## Setup Instructions

### 1. Get Room ID
From admin panel:
- Go to `/admin/rooms`
- Click on a room
- Copy the Room ID from the URL

### 2. Configure Tablet
- Set up your iPad/Android tablet in kiosk mode
- Navigate to `/tablet/[ROOM_ID]`
- Enable full-screen mode
- Disable sleep mode
- Mount tablet outside the conference room

### 3. Recommended Settings
- **Screen brightness:** 70-80%
- **Orientation:** Landscape (horizontal)
- **Refresh:** Auto-refresh every 30 seconds
- **Touch:** Enabled for interactions
- **Sleep:** Disabled

### 4. Kiosk Mode Setup

**iPad:**
- Settings > Accessibility > Guided Access
- Enable Guided Access
- Set passcode
- Open browser to tablet view
- Triple-click home button to start

**Android:**
- Settings > Security > Screen pinning
- Enable screen pinning
- Open browser to tablet view
- Tap Overview > Pin icon

## Touch Interactions

- ✅ **Tap booking buttons** - Instant room reservation
- ✅ **Tap QR code button** - Show/hide QR code for advanced booking
- ✅ **Tap extend buttons** - Add time to current meeting
- ✅ **Tap end button** - End meeting early (with confirmation)

## Design Highlights

### Visual Features:
- **Clean, modern UI** with rounded corners and shadows
- **Large, touch-friendly buttons** (minimum 32px touch targets)
- **High contrast text** for readability from distance
- **Smooth transitions** between available/busy states
- **Responsive layout** adapts to different tablet sizes
- **Professional gradients** and backdrop blur effects

### Accessibility:
- Color-coded states (green/red)
- Large fonts (up to 6xl for status)
- Clear icons for all actions
- Confirmation dialogs for destructive actions
- High contrast for visibility

## Troubleshooting

### Room not showing?
- Verify room ID is correct
- Check room is marked as "active" in admin panel
- Ensure internet connection is stable

### Status not updating?
- Refresh the page manually
- Check browser console for errors
- Verify API endpoints are accessible

### Bookings not working?
- Ensure room allows walk-up bookings
- Check if room has upcoming conflicts
- Verify tablet has internet access

### Display looks wrong?
- Check tablet orientation (should be landscape)
- Clear browser cache
- Ensure screen zoom is at 100%
- Try full-screen mode

## URL Parameters (Optional)

Currently, no URL parameters are supported, but future enhancements may include:
- `?theme=dark` - Dark mode variant
- `?size=compact` - Smaller display for small tablets
- `?lang=es` - Language selection

## Integration with Google Calendar

Once Google Calendar integration is set up:
- Bookings automatically sync to Google Calendar
- Attendees receive email invitations
- Room resources are added to events
- Calendar conflicts are detected in real-time

## Security Notes

- Tablet view is read-only for status display
- Booking actions are rate-limited
- No authentication required (public kiosk mode)
- Room IDs are not sensitive information
- All bookings are logged with source "tablet"

---

**Need Help?**
Contact your system administrator or refer to the main README for more information.

