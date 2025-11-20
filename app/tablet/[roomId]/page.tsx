'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/lib/components/ui/Button';
import { Calendar, Clock, User, QrCode, Users, X } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase/client';

interface RoomStatus {
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
  available_until: string | null;
  ui_state?: 'free' | 'checkin' | 'busy';
}

import FloorPlanViewer from '@/lib/components/FloorPlanViewer';
import { Floor, Room } from '@/lib/types/database.types';

export default function TabletDisplay() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params?.roomId as string;
  const router = useRouter();

  const [status, setStatus] = useState<RoomStatus | null>(null);
  // ... existing state ...
  const [showMap, setShowMap] = useState(false);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [floor, setFloor] = useState<Floor | null>(null);
  const [floorRooms, setFloorRooms] = useState<Room[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<
    Record<string, { roomId: string; isOccupied: boolean; uiState?: 'free' | 'checkin' | 'busy' }>
  >({});

  // ...

  const fetchFloorData = async () => {
    if (!status) return;
    try {
      // Get room details to find location_id/floor_id
      const roomRes = await fetch(`/api/rooms/${roomId}`);
      const roomData = await roomRes.json();
      
      if (roomData.success && roomData.data.floor_id) {
        const locationId = roomData.data.location_id as string;
        const currentFloorId = roomData.data.floor_id as string;

        // Fetch all floors for this location
        const floorsRes = await fetch(
          `/api/admin/locations/${locationId}/floors`
        );
        const floorsResult = await floorsRes.json();

        if (floorsResult.success) {
          const allFloors: Floor[] = floorsResult.data;
          setFloors(allFloors);

          const effectiveFloorId =
            selectedFloorId && allFloors.some((f) => f.id === selectedFloorId)
              ? selectedFloorId
              : currentFloorId;

          const targetFloor =
            allFloors.find((f) => f.id === effectiveFloorId) ||
            allFloors[0] ||
            null;

          if (targetFloor) {
            setFloor(targetFloor);
            setSelectedFloorId(targetFloor.id);
          }

          // Fetch Rooms for this location
          const roomsRes = await fetch(`/api/rooms?location_id=${locationId}`);
          const roomsResult = await roomsRes.json();
          if (roomsResult.success) {
            setFloorRooms(roomsResult.data);

            // Fetch status for these rooms (parallel)
            const statusPromises = roomsResult.data.map((r: Room) =>
              fetch(`/api/rooms/${r.id}/status`).then((res) => res.json())
            );
            const statuses = await Promise.all(statusPromises);

            const statusMap: Record<string, any> = {};
            statuses.forEach((s: any) => {
              if (s.success) {
                const uiState = (s.data.ui_state || 'free') as
                  | 'free'
                  | 'checkin'
                  | 'busy';
                statusMap[s.data.room_id] = {
                  roomId: s.data.room_id,
                  isOccupied: uiState === 'busy' || uiState === 'checkin',
                  uiState,
                };
              }
            });
            setRoomStatuses(statusMap);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load floor map", err);
    }
  };

  useEffect(() => {
    if (showMap) {
      fetchFloorData();
    }
  }, [showMap, roomId]);


  const [currentTime, setCurrentTime] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [bookingInProgress, setBookingInProgress] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [bookingForm, setBookingForm] = useState({
    hostId: '',
    attendeeIds: [] as string[],
  });
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPin, setSettingsPin] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [hideActions, setHideActions] = useState(false);
  const eventsScrollRef = useRef<HTMLDivElement | null>(null);
  const [allBookings, setAllBookings] = useState<Array<{
    id: string;
    title: string;
    host_name: string | null;
    start_time: string;
    end_time: string;
    attendee_count: number;
  }>>([]);
  const [justReleased, setJustReleased] = useState(false);
  const [pendingRelease, setPendingRelease] = useState(false);
  const device = (searchParams.get('device') as 'computer' | 'ipad' | 'amazon') || 'ipad';
  const [bookingTarget, setBookingTarget] = useState<{
    roomId: string;
    roomName: string;
    availableMinutes: number | null;
  } | null>(null);

  useEffect(() => {
    if (roomId) {
      fetchStatus();
      fetchUsers();
      fetchBookings();
      const interval = setInterval(() => {
        fetchStatus();
        fetchBookings();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [roomId]);

  // Realtime updates: refresh this tablet whenever any booking for this room changes
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`tablet-bookings-${roomId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings', filter: `room_id=eq.${roomId}` },
        () => {
          fetchStatus();
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Simple error banner for extend / other actions
  const [banner, setBanner] = useState<{ type: 'error'; message: string } | null>(null);

  const showErrorBanner = (message: string) => {
    setBanner({ type: 'error', message });
    setTimeout(() => {
      setBanner((current) => (current?.message === message ? null : current));
    }, 7000);
  };

  // Reset "justReleased" flag once status shows room is free
  useEffect(() => {
    if (status && !status.is_occupied && justReleased) {
      setJustReleased(false);
      setPendingRelease(false);
    }
  }, [status, justReleased]);

  // Track scroll on events list to hide/show main action buttons
  useEffect(() => {
    const el = eventsScrollRef.current;
    if (!el) return;

    const onScroll = () => {
      setHideActions(el.scrollTop > 4);
    };

    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-release: if the current booking has passed its end time, end it automatically.
  useEffect(() => {
    if (!status?.current_booking || justReleased) return;

    const end = new Date(status.current_booking.end_time);
    if (currentTime > end && !pendingRelease) {
      endMeeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.current_booking?.end_time, currentTime, justReleased, pendingRelease]);

  const fetchStatus = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/status`);
      const result = await response.json();
      if (result.success) {
        setStatus(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch room status:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users');
      const result = await response.json();
      if (result.success) {
        setUsers(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      // Fetch bookings for the next 30 days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7); // Include past week
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30);

      const response = await fetch(
        `/api/bookings?room_id=${roomId}&start_date=${startDate.toISOString()}&end_date=${endDate.toISOString()}`
      );
      const result = await response.json();
      if (result.success) {
        const bookings = result.data
          .filter((b: any) => b.status === 'scheduled' || b.status === 'confirmed')
          .map((b: any) => ({
            id: b.id,
            title: b.title,
            host_name: b.host?.name || null,
            start_time: b.start_time,
            end_time: b.end_time,
            attendee_count: 1 + (Array.isArray(b.attendee_emails) ? b.attendee_emails.length : 0),
          }));
        setAllBookings(bookings);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const handleQuickBookClick = (defaultDuration: number) => {
    if (!status) return;

    const availableMinutes = computeAvailableMinutes(status);
    const allowedDurations = [15, 30, 45, 60].filter(
      (m) => availableMinutes === null || m <= availableMinutes
    );

    setBookingTarget({
      roomId,
      roomName: status.room_name,
      availableMinutes,
    });

    setSelectedDuration(
      allowedDurations.includes(defaultDuration)
        ? defaultDuration
        : allowedDurations[0] ?? null
    );
    setShowBookingForm(true);
  };

  const handleMapRoomClick = async (clickedRoomId: string) => {
    const basicStatus = roomStatuses[clickedRoomId];
    if (
      !basicStatus ||
      basicStatus.isOccupied ||
      basicStatus.uiState === 'checkin'
    ) {
      // Only allow booking for rooms that are truly free (not busy or in check-in window)
      return;
    }

    try {
      const response = await fetch(`/api/rooms/${clickedRoomId}/status`);
      const result = await response.json();
      if (!result.success) return;

      const roomStatus: RoomStatus = result.data;
      const availableMinutes = computeAvailableMinutes(roomStatus);
      const allowedDurations = [15, 30, 45, 60].filter(
        (m) => availableMinutes === null || m <= availableMinutes
      );

      setBookingTarget({
        roomId: roomStatus.room_id,
        roomName: roomStatus.room_name,
        availableMinutes,
      });

      setSelectedDuration(allowedDurations[0] ?? null);
      setShowBookingForm(true);
    } catch (err) {
      console.error('Failed to open booking from floor map', err);
    }
  };

  const handleCancelBooking = () => {
    setShowBookingForm(false);
    setSelectedDuration(null);
    setBookingTarget(null);
    setBookingForm({ hostId: '', attendeeIds: [] });
    setSearchTerm('');
    setAttendeeSearch('');
  };

  const quickBook = async () => {
    if (!selectedDuration || !bookingForm.hostId) {
      alert('Please select a host');
      return;
    }

    setBookingInProgress(true);
    try {
      const now = new Date();
      let effectiveDuration = selectedDuration;

      const availableMinutes =
        bookingTarget?.availableMinutes ?? computeAvailableMinutes(status);

      if (availableMinutes !== null) {
        if (availableMinutes <= 0) {
          alert('This room is not available for a quick booking right now.');
          setBookingInProgress(false);
          return;
        }

        if (effectiveDuration > availableMinutes) {
          effectiveDuration = availableMinutes;
        }
      }

      const endTime = new Date(now.getTime() + effectiveDuration * 60 * 1000);

      const host = users.find((u) => u.id === bookingForm.hostId);
      const attendeeUsers = bookingForm.attendeeIds
        .map((id) => users.find((u) => u.id === id))
        .filter(Boolean) as Array<{ id: string; name: string; email: string }>;

      const attendeeEmails = attendeeUsers.map((u) => u.email);

      // Build a friendly quick-book title based on host + attendees
      let title = 'Quick booking';
      if (host) {
        const hostFirst = (host.name || '').split(' ')[0] || host.name;

        if (attendeeUsers.length === 1) {
          const guestFirst =
            (attendeeUsers[0].name || '').split(' ')[0] ||
            attendeeUsers[0].name;
          title = `${hostFirst} x ${guestFirst}`;
        } else if (attendeeUsers.length > 1) {
          title = `${hostFirst} x ${attendeeUsers.length} attendees`;
        } else {
          title = `${hostFirst}'s Meeting`;
        }
      }

      const targetRoomId = bookingTarget?.roomId || roomId;

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: targetRoomId,
          host_user_id: bookingForm.hostId,
          title,
          start_time: now.toISOString(),
          end_time: endTime.toISOString(),
          source: 'tablet',
          attendee_emails: attendeeEmails,
        }),
      });

      const result = await response.json();
      if (result.success) {
        // Only refresh this tablet's status if we booked for the same room
        if (!bookingTarget || bookingTarget.roomId === roomId) {
          await fetchStatus();
          await fetchBookings();
        }
        handleCancelBooking();
      } else {
        alert(`Failed to book: ${result.error?.message}`);
      }
    } catch (error) {
      console.error('Failed to create booking:', error);
      alert('Failed to create booking');
    } finally {
      setBookingInProgress(false);
    }
  };

  const toggleAttendee = (userId: string) => {
    if (bookingForm.attendeeIds.includes(userId)) {
      setBookingForm({
        ...bookingForm,
        attendeeIds: bookingForm.attendeeIds.filter(id => id !== userId),
      });
    } else {
      setBookingForm({
        ...bookingForm,
        attendeeIds: [...bookingForm.attendeeIds, userId],
      });
    }
  };

  const endMeeting = async () => {
    if (!status?.current_booking) return;

    const now = new Date();
    const end = new Date(status.current_booking.end_time);
    const minutesToEnd = Math.round(
      (end.getTime() - now.getTime()) / (1000 * 60)
    );

    const requiresConfirm =
      Number.isFinite(minutesToEnd) && Math.abs(minutesToEnd) > 15;

    // First tap: just arm confirmation when far from the scheduled end
    if (requiresConfirm && !pendingRelease) {
      setPendingRelease(true);
      return;
    }

    try {
      const response = await fetch(
        `/api/bookings/${status.current_booking.id}/end`,
        {
        method: 'POST',
        }
      );

      if (response.ok) {
        // Mark as just released so we immediately show green even before next poll
        setJustReleased(true);
        setPendingRelease(false);
        await fetchStatus();
        await fetchBookings();
      }
    } catch (error) {
      console.error('Failed to end meeting:', error);
      setPendingRelease(false);
    }
  };

  const extendMeeting = async (additionalMinutes: number) => {
    if (!status?.current_booking) return;

    // Check for conflict with the very next booking before hitting the API
    const immediateNext = status.next_bookings[0];
    if (immediateNext) {
      const currentEnd = new Date(status.current_booking.end_time);
      const requestedEnd = new Date(
        currentEnd.getTime() + additionalMinutes * 60 * 1000
      );
      const nextStart = new Date(immediateNext.start_time);

      if (requestedEnd > nextStart) {
        const startLabel = formatTime(immediateNext.start_time);
        const endLabel = formatTime(immediateNext.end_time);
        const title = immediateNext.title || 'another meeting';
        showErrorBanner(
          `Cannot extend: "${title}" is booked from ${startLabel} to ${endLabel}.`
        );
        return;
      }
    }

    try {
      const response = await fetch(`/api/bookings/${status.current_booking.id}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additional_minutes: additionalMinutes }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchStatus();
      } else {
        showErrorBanner(result.error?.message || 'Failed to extend booking.');
      }
    } catch (error) {
      console.error('Failed to extend meeting:', error);
      showErrorBanner('Failed to extend booking.');
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Room not found</div>
      </div>
    );
  }

  const isAvailable =
    (status.ui_state ?? (status.is_occupied ? 'busy' : 'free')) === 'free' ||
    justReleased;
  const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/room/${roomId}`;

  // Check if we're within the unified check-in window (yellow state)
  const isCheckInWindow = () =>
    (status.ui_state ?? (status.is_occupied ? 'busy' : 'free')) === 'checkin';

  const handleCheckIn = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/checkin`, {
        method: 'POST',
      });

      if (!response.ok) {
        alert('Failed to check in');
        return;
      }

      // Refresh status and bookings so UI goes to red "in meeting" state
      await fetchStatus();
      await fetchBookings();
    } catch (error) {
      console.error('Failed to check in:', error);
      alert('Failed to check in');
    }
  };

  const showCheckIn = isCheckInWindow();
  const nextBooking = status.next_bookings.length > 0 ? status.next_bookings[0] : null;

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredAttendees = users.filter(user =>
    user.id !== bookingForm.hostId &&
    (user.name.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(attendeeSearch.toLowerCase()))
  );

  const selectedHost = users.find(u => u.id === bookingForm.hostId);
  const selectedAttendees = users.filter(u => bookingForm.attendeeIds.includes(u.id));

  // Swipe handlers
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    if (isLeftSwipe) {
      // Swipe left - go to next day
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      setSelectedDate(nextDay);
    }
    
    if (isRightSwipe) {
      // Swipe right - go to previous day
      const prevDay = new Date(selectedDate);
      prevDay.setDate(prevDay.getDate() - 1);
      setSelectedDate(prevDay);
    }
  };

  const goToPreviousDay = () => {
    const prevDay = new Date(selectedDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setSelectedDate(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(selectedDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setSelectedDate(nextDay);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  // Filter bookings for selected date
  const getBookingsForDate = (date: Date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const now = new Date();

    // Get bookings for the selected date
    let dayBookings = allBookings
      .filter(booking => {
        const bookingDate = new Date(booking.start_time);
        return bookingDate >= startOfDay && bookingDate <= endOfDay;
      })
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    // Find current booking (only for today)
    let currentBooking = null;
    if (isToday(date)) {
      currentBooking = dayBookings.find(booking => {
        const start = new Date(booking.start_time);
        const end = new Date(booking.end_time);
        return now >= start && now < end;
      }) || null;
    }

    // For today, hide bookings that have already ended
    if (isToday(date)) {
      dayBookings = dayBookings.filter(b => {
        const end = new Date(b.end_time);
        return end > now;
      });
    }

    // Filter out current booking from day bookings to avoid duplicates
    const upcomingBookings = currentBooking
      ? dayBookings.filter(b => b.id !== currentBooking.id)
      : dayBookings;

    return { currentBooking, dayBookings: upcomingBookings };
  };

  const { currentBooking: dateCurrentBooking, dayBookings } = getBookingsForDate(selectedDate);

  // When we're in the yellow check-in window, hide that booking from the bottom list
  const filteredDayBookings =
    showCheckIn && nextBooking
      ? dayBookings.filter((b) => b.id !== nextBooking.id)
      : dayBookings;
  const hasBookingsForDay = filteredDayBookings.length > 0;

  const handleConfirmPin = async () => {
    try {
      const pin = settingsPin.trim();
      if (!pin) {
        setSettingsError('PIN is required');
        return;
      }

      // Read the saved PIN from admin settings so we are 100% using the same value
      const response = await fetch('/api/admin/settings');
      const result = await response.json();

      if (!response.ok || !result.success) {
        setSettingsError('Unable to verify PIN. Please try again.');
        return;
      }

      const savedPin = String(result.data?.tablet_admin_pin ?? '').trim();

      if (savedPin && pin === savedPin) {
        setShowSettings(false);
        setSettingsPin('');
        setSettingsError('');
        // Send the tablet to the homepage on successful unlock
        router.push('/');
      } else {
        // Wrong PIN: show error and clear the input so user can re-type
        setSettingsError('Incorrect PIN. Try again.');
        setSettingsPin('');
      }
    } catch (error: any) {
      console.error('Failed to verify PIN', error);
      setSettingsError('Unable to verify PIN. Please try again.');
    }
  };

  // Determine background color based on room status
  const getBackgroundColor = () => {
    if (status.is_occupied && !justReleased) {
      // Red primary when in a meeting
      return 'bg-[#EC5353]';
    } else if (showCheckIn) {
      // Yellow primary during check-in window
      return 'bg-[#FFC627]';
    } else {
      // Green primary when available
      return 'bg-[#34CB57]';
    }
  };

  const getFloorMapBgColor = () => {
    if (status.is_occupied && !justReleased) {
      // Secondary red
      return 'bg-[#E87C7C]';
    } else if (showCheckIn) {
      // Secondary yellow
      return 'bg-[#FFD96D]';
    } else {
      // Secondary green
      return 'bg-[#60E07E]';
    }
  };

  const getScheduleBgColor = () => {
    if (status.is_occupied && !justReleased) {
      return 'bg-[#EC5353]';
    } else if (showCheckIn) {
      return 'bg-[#FFC627]';
    } else {
      return 'bg-[#34CB57]';
    }
  };

  const getEventCardColor = () => {
    if (status.is_occupied && !justReleased) {
      return 'bg-[#E87C7C]';
    } else if (showCheckIn) {
      return 'bg-[#FFD96D]';
    } else {
      return 'bg-[#60E07E]';
    }
  };

  const getTextColor = () => {
    if (status.is_occupied && !justReleased) {
      return 'text-white';
    } else {
      return 'text-black';
    }
  };

  const getStatusText = () => {
    // When we just released a meeting, force a clean \"Available\" state
    if (justReleased) {
      return {
        title: 'Available',
        subtitle: null,
        host: null,
      };
    }

    if (status.is_occupied && status.current_booking) {
      return {
        title: status.current_booking.title,
        subtitle: `${formatTime(status.current_booking.start_time)} - ${formatTime(status.current_booking.end_time)}`,
        host: status.current_booking.host_name
      };
    } else if (showCheckIn && nextBooking) {
      return {
        title: nextBooking.title,
        subtitle: `${formatTime(nextBooking.start_time)} - ${formatTime(nextBooking.end_time)}`,
        host: nextBooking.host_name
      };
    } else if (status.available_until) {
      const now = new Date();
      const until = new Date(status.available_until);

      const sameDay =
        now.getFullYear() === until.getFullYear() &&
        now.getMonth() === until.getMonth() &&
        now.getDate() === until.getDate();

      if (sameDay) {
        const minutesAvailable = Math.max(
          0,
          Math.round((until.getTime() - now.getTime()) / (1000 * 60))
        );

        if (minutesAvailable > 0) {
      return {
        title: `Available for ${minutesAvailable} min`,
        subtitle: null,
            host: null,
          };
        }
      }

      // Either the next booking is on a different day or the window has passed – show plain Available
      return {
        title: 'Available',
        subtitle: null,
        host: null,
      };
    } else {
      return {
        title: 'Available',
        subtitle: null,
        host: null
      };
    }
  };

  const statusInfo = getStatusText();

  const computeAvailableMinutes = (roomStatus: RoomStatus | null): number | null => {
    if (!roomStatus) return null;

     // During check-in window we treat the room as not bookable
    if ((roomStatus.ui_state ?? (roomStatus.is_occupied ? 'busy' : 'free')) === 'checkin') {
      return 0;
    }

    const now = new Date();

    if (roomStatus.available_until) {
      const until = new Date(roomStatus.available_until);
      const diffMinutes = Math.floor((until.getTime() - now.getTime()) / (1000 * 60));
      if (diffMinutes > 0) {
        return diffMinutes;
      }
    }

    if (roomStatus.next_bookings && roomStatus.next_bookings.length > 0) {
      const next = new Date(roomStatus.next_bookings[0].start_time);
      const diffMinutes = Math.floor((next.getTime() - now.getTime()) / (1000 * 60));
      if (diffMinutes > 0) {
        return diffMinutes;
      }
    }

    return null;
  };

  const currentRoomAvailableMinutes = computeAvailableMinutes(status);
  const activeAvailableMinutes =
    bookingTarget?.availableMinutes ?? currentRoomAvailableMinutes;
  const durationOptions = [15, 30, 45, 60];

  const isComputer = device === 'computer';
  const isAmazon = device === 'amazon';
  const bookingsOffsetClass = isAmazon ? 'mt-4' : isComputer ? 'mt-28' : 'mt-20';

  const releaseMinutesToEnd = status?.current_booking
    ? Math.round(
        (new Date(status.current_booking.end_time).getTime() -
          new Date().getTime()) /
          (1000 * 60)
      )
    : null;

  const requiresReleaseConfirm =
    releaseMinutesToEnd !== null && Math.abs(releaseMinutesToEnd) > 15;

  const renderFeatureBadges = (extraClasses = '') => (
    <div className={`flex gap-4 ${extraClasses} tablet-btn`}>
      {status.features?.tv && (
        <div className="px-6 py-3 border-2 border-black/40 rounded-full flex items-center gap-2 bg-transparent text-black">
          {/* Screen Mirroring / AirPlay-style icon */}
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="5" width="18" height="12" rx="2" />
            <path d="M9 19h6l-3-4z" />
          </svg>
          <span className="text-lg font-medium">Screen Mirroring</span>
        </div>
      )}

      <div className="px-6 py-3 border-2 border-black/40 rounded-full flex items-center gap-2 bg-transparent text-black">
        <Users className="w-5 h-5" />
        <span className="text-lg font-medium">{status.capacity} max</span>
      </div>

      {status.features?.whiteboard && (
        <div className="px-6 py-3 border-2 border-black/40 rounded-full flex items-center gap-2 bg-transparent text-black">
          {/* Whiteboard icon */}
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="12" rx="2" />
            <path d="M7 14l3.5-3 2 2L17 9" />
          </svg>
          <span className="text-lg font-medium">Whiteboard</span>
        </div>
      )}
    </div>
  );

  // Root + shell layout classes so we can target Amazon tablet specifically
  const rootClassName = `fixed inset-0 overflow-hidden ${getBackgroundColor()} transition-colors duration-500 tablet-btn ${
    isAmazon ? 'flex items-center justify-center' : ''
  }`;

  const shellClassName = `relative z-10 flex flex-col ${
    isAmazon ? 'w-[1920px] h-[1200px] max-w-full max-h-full aspect-[16/10]' : 'h-full'
  }`;

  return (
    <div className={rootClassName}>
      <div className={shellClassName}>
        {/* Header */}
        <div className="px-12 py-8 flex items-center justify-between gap-6 tablet-btn">
          <button
            onClick={() => setShowMap(true)}
            className={`${getFloorMapBgColor()} hover:opacity-80 text-gray-900 text-xl font-medium transition-all px-8 py-4 rounded-full tablet-shadow`}
          >
            Floor map
          </button>
          {isAmazon && (
            <div className="flex-1 flex justify-center">
              {renderFeatureBadges()}
            </div>
          )}
          <div className="text-right">
            <div className="text-3xl font-normal text-gray-900">
              {currentTime.toLocaleTimeString('en-US', {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          className={`flex-1 flex flex-col items-center px-12 tablet-btn ${
            isAmazon ? 'justify-start pt-4' : 'justify-center'
          }`}
        >
          {/* Feature / capacity badges (non-Amazon layouts) */}
          {!isAmazon && renderFeatureBadges('mb-12')}

          {/* Room Name */}
          <h1
            className={`${isComputer ? 'text-7xl' : isAmazon ? 'text-8xl' : 'text-9xl'} font-bold text-gray-900 mb-12 text-center tablet-btn`}
          >
            {status.room_name}
          </h1>

          {/* Status Info */}
        <div className="text-center mb-16 tablet-btn">
            {status.is_occupied && statusInfo.subtitle ? (
              <>
                <h2
                  className={`${isComputer ? 'text-4xl' : isAmazon ? 'text-5xl' : 'text-6xl'} font-semibold ${getTextColor()} mb-4`}
                >
                  {statusInfo.subtitle} - {statusInfo.title}
                </h2>
                {statusInfo.host && (
                  <p className={`${isComputer ? 'text-3xl' : 'text-4xl'} ${getTextColor()}`}>
                    by {statusInfo.host}
                  </p>
                )}
              </>
            ) : showCheckIn && statusInfo.title ? (
              <>
                <h2 className={`${isComputer ? 'text-4xl' : isAmazon ? 'text-5xl' : 'text-6xl'} font-semibold text-black mb-4`}>
                  {statusInfo.subtitle} - {statusInfo.title}
                </h2>
                {statusInfo.host && (
                  <p className={`${isComputer ? 'text-3xl' : 'text-4xl'} text-black`}>
                    by {statusInfo.host}
                  </p>
                )}
              </>
            ) : (
              <h2
                className={`${isComputer ? 'text-5xl' : isAmazon ? 'text-6xl' : 'text-7xl'} font-semibold text-white`}
              >
                {statusInfo.title}
              </h2>
            )}
          </div>

          {/* Action Buttons */}
          <div
            className={`flex gap-6 transition-all duration-200 tablet-btn ${
              hideActions ? 'opacity-0 translate-y-3 pointer-events-none' : 'opacity-100 translate-y-0'
            }`}
          >
            {/* Green: quick book */}
            {isAvailable && !showCheckIn && !showBookingForm && (
              <button
                onClick={() => handleQuickBookClick(30)}
                className="tablet-btn tablet-btn-xl tablet-shadow h-24 px-20 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-105"
              >
                Book Now
              </button>
            )}

            {/* Yellow: check-in for upcoming event */}
            {showCheckIn && !status.is_occupied && nextBooking && (
              <button
                onClick={() => handleCheckIn(nextBooking.id)}
                className="tablet-btn tablet-btn-xl tablet-shadow h-24 px-20 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-105"
              >
                Check in
              </button>
            )}

            {/* Red: in meeting – release / extend */}
            {!isAvailable && !showCheckIn && (
              <>
                <button
                  onClick={endMeeting}
                  className="tablet-btn tablet-btn-xl tablet-shadow h-24 px-14 bg-white/90 hover:bg-white text-red-600 rounded-full transition-all"
                >
                  {requiresReleaseConfirm && pendingRelease
                    ? 'Confirm Release'
                    : 'Release Room'}
                </button>
                <button
                  onClick={() => extendMeeting(30)}
                  className="tablet-btn tablet-btn-xl tablet-shadow h-24 px-14 bg-red-400/40 hover:bg-red-400/60 text-white rounded-full transition-all backdrop-blur-sm"
                >
                  Extend booking
                </button>
              </>
            )}
          </div>
        </div>

        {/* Bottom Section - Next Bookings */}
        <div
          className={`${getScheduleBgColor()} ${bookingsOffsetClass} backdrop-blur-sm px-12 ${
            isAmazon ? 'py-4' : 'py-8'
          } tablet-btn`}
        >
          <div
            ref={eventsScrollRef}
            className={`max-w-7xl mx-auto tablet-btn no-scrollbar ${
              hasBookingsForDay
                ? 'max-h-64 overflow-y-auto space-y-5 pb-8 pr-24'
                : 'h-40 flex items-center justify-center'
            }`}
          >
            {filteredDayBookings.map((booking) => {
              const isTapEnabled =
                isAvailable && !showCheckIn && isToday(selectedDate);

              return (
              <button
                key={booking.id}
                type="button"
                  onClick={isTapEnabled ? () => handleCheckIn(booking.id) : undefined}
                  className={`w-full text-left tablet-shadow rounded-3xl px-8 py-6 ${getEventCardColor()} ${
                    isTapEnabled ? 'active:scale-[0.99] cursor-pointer' : 'cursor-default'
                  } transition-transform`}
              >
                <div className="flex items-center gap-3 text-gray-900 text-2xl font-medium mb-1 tablet-btn">
                    <span>
                      {formatTime(booking.start_time)}-{formatTime(booking.end_time)}
                    </span>
                  <span>•</span>
                  <Users className="w-6 h-6" />
                  <span>{booking.attendee_count}</span>
                </div>
                <div className="text-gray-900 text-3xl font-bold tablet-btn">
                    {booking.title}{' '}
                    {booking.host_name && <>by {booking.host_name}</>}
                </div>
                  {isTapEnabled && (
                <div className="mt-1 text-base text-gray-900/80 tablet-btn">
                  Tap to check in
                </div>
                  )}
              </button>
              );
            })}
            {!hasBookingsForDay && (
              <div className="text-center text-gray-700 text-3xl">
                No more bookings today
              </div>
            )}
          </div>
        </div>

        {/* Floating Settings Button (bottom-right, all states) */}
        <button
          type="button"
          onClick={() => {
            setSettingsPin('');
            setSettingsError('');
            setShowSettings(true);
          }}
          className={`tablet-shadow w-16 h-16 rounded-full flex items-center justify-center ${getEventCardColor()} text-black absolute bottom-10 right-10`}
        >
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 3.4 15a1.65 1.65 0 0 0-1.51-1H2a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 3.4 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 3.4a1.65 1.65 0 0 0 1-1.51V2a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 3.4a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>

        {/* Booking Form Modal (status view) */}
        {showBookingForm && !showMap && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8">
<div className="bg-white rounded-3xl p-8 shadow-2xl max-w-2xl w-full h-[80vh] overflow-y-auto">              <div className="text-center text-3xl font-bold text-gray-900 mb-2">
                Book {bookingTarget?.roomName || status.room_name}
              </div>
              <div className="text-center text-lg text-gray-600 mb-6">
                {selectedDuration
                  ? `${selectedDuration === 60 ? '1 hour' : `${selectedDuration} minutes`} · starting now`
                  : 'Select a duration · starting now'}
              </div>

              {/* Duration selection */}
              <div className="mb-6">
                <div className="text-center text-lg font-medium text-gray-800 mb-3">
                  Duration
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  {durationOptions.map((minutes) => {
                    const disabled =
                      activeAvailableMinutes !== null &&
                      minutes > activeAvailableMinutes;
                    const isSelected = selectedDuration === minutes;

                    return (
                      <button
                        key={minutes}
                        type="button"
                        onClick={() => !disabled && setSelectedDuration(minutes)}
                        disabled={disabled}
                        className={`px-5 py-2 rounded-full border-2 text-lg font-semibold transition-colors ${
                          disabled
                            ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                            : isSelected
                            ? 'bg-gray-900 text-white border-gray-900'
                            : 'border-gray-400 text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {minutes === 60 ? '1 hr' : `${minutes} min`}
                      </button>
                    );
                  })}
                </div>
                {activeAvailableMinutes !== null && (
                  <div className="mt-3 text-center text-sm text-gray-500">
                    Available for {activeAvailableMinutes} min
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {/* Host Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Host *
                  </label>
                  {selectedHost ? (
                    <div className="flex items-center justify-between bg-green-50 border-2 border-green-500 rounded-xl p-3">
                      <div>
                        <div className="font-semibold text-gray-900">{selectedHost.name}</div>
                        <div className="text-sm text-gray-600">{selectedHost.email}</div>
                      </div>
                      <button
                        onClick={() => setBookingForm({ ...bookingForm, hostId: '' })}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by name or email..."
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:outline-none focus:border-green-500 text-gray-900 mb-2"
                        autoFocus
                      />
                      <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl">
                        {filteredUsers.slice(0, 5).map(user => (
                          <button
                            key={user.id}
                            onClick={() => {
                              setBookingForm({ ...bookingForm, hostId: user.id });
                              setSearchTerm('');
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                          >
                            <div className="font-semibold text-gray-900">{user.name}</div>
                            <div className="text-sm text-gray-600">{user.email}</div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Attendees Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Attendees (optional)
                  </label>
                  {selectedAttendees.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {selectedAttendees.map(user => (
                        <div key={user.id} className="flex items-center bg-blue-50 rounded-full px-3 py-1">
                          <span className="text-sm text-gray-900">{user.name}</span>
                          <button
                            onClick={() => toggleAttendee(user.id)}
                            className="ml-2 text-red-600 hover:text-red-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attendee search */}
                  <input
                    type="text"
                    value={attendeeSearch}
                    onChange={(e) => setAttendeeSearch(e.target.value)}
                    placeholder="Search attendees..."
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:outline-none focus:border-green-500 text-gray-900 mb-2"
                  />
                  {attendeeSearch && (
                    <div className="max-h-40 overflow-y-auto border-2 border-gray-200 rounded-xl">
                      {filteredAttendees.slice(0, 5).map(user => (
                        <button
                          key={user.id}
                          onClick={() => {
                            toggleAttendee(user.id);
                            setAttendeeSearch('');
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                        >
                          <div className="font-semibold text-gray-900">{user.name}</div>
                          <div className="text-sm text-gray-600">{user.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="pt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={handleCancelBooking}
                    className="flex-1 h-12 rounded-full border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={quickBook}
                    disabled={
                      bookingInProgress || !bookingForm.hostId || !selectedDuration
                    }
                    className="flex-1 h-12 rounded-full bg-gray-900 text-white font-medium hover:bg-black disabled:opacity-50"
                  >
                    {bookingInProgress ? 'Booking…' : 'Book now'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-8">
            <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4 text-center">
                Admin access
              </h2>
              <p className="text-gray-600 text-center mb-6">
                Enter the admin PIN to open the control panel.
              </p>

              <div className="flex justify-center mb-6">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={settingsPin}
                  onChange={(e) => setSettingsPin(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-40 text-center text-3xl tracking-[0.3em] px-4 py-3 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {settingsError && (
                <div className="mb-4 text-center text-sm text-red-600">
                  {settingsError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettings(false);
                    setSettingsPin('');
                    setSettingsError('');
                  }}
                  className="flex-1 h-12 rounded-full border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPin}
                  className="flex-1 h-12 rounded-full bg-gray-900 text-white font-medium hover:bg-black"
                  disabled={!settingsPin}
                >
                  Unlock
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Map Modal */}
        {showMap && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50 p-8">
            <div className="bg-white rounded-3xl overflow-hidden shadow-2xl w-full h-full relative flex flex-col">
              {floors.length > 1 && (
                <div className="absolute top-4 left-4 z-10 flex gap-2">
                  {floors.map((f) => {
                    const isActive = f.id === selectedFloorId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setSelectedFloorId(f.id);
                          setShowBookingForm(false);
                          setBookingTarget(null);
                          setSelectedDuration(null);
                          setFloor(f);
                        }}
                        className={`px-4 py-2 rounded-full text-sm font-medium tablet-shadow transition-colors ${
                          isActive
                            ? 'bg-gray-900 text-white'
                            : 'bg-white text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {f.name}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="absolute top-4 right-4 z-10">
                <button
                  onClick={() => {
                    // Close both the map and any map-origin booking overlay
                    setShowMap(false);
                    setShowBookingForm(false);
                    setBookingTarget(null);
                    setSelectedDuration(null);
                  }}
                  className="bg-gray-900 text-white p-4 rounded-full shadow-lg hover:bg-black transition-colors"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>

              <div className="flex-1 w-full h-full bg-gray-100">
                {floor ? (
                  <FloorPlanViewer
                    floor={floor}
                    rooms={floorRooms}
                    roomStatuses={roomStatuses}
                    currentRoomId={roomId}
                    showTestPins={false}
                    onRoomClick={handleMapRoomClick}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-3xl text-gray-400 font-medium">
                    Loading floor map...
                  </div>
                )}
              </div>

              {/* Booking overlay on top of map */}
              {showBookingForm && bookingTarget && (
                <div className="absolute inset-x-0 bottom-0 pb-10 flex justify-center pointer-events-none">
                  <div className="pointer-events-auto w-full max-w-2xl px-6">
                  <div className="bg-white rounded-3xl p-8 shadow-2xl h-[70vh] overflow-y-auto">                      <div className="text-center text-3xl font-bold text-gray-900 mb-2">
                        Book {bookingTarget.roomName}
                      </div>
                      <div className="text-center text-lg text-gray-600 mb-6">
                        {selectedDuration
                          ? `${selectedDuration === 60 ? '1 hour' : `${selectedDuration} minutes`} · starting now`
                          : 'Select a duration · starting now'}
                      </div>

                      {/* Duration selection */}
                      <div className="mb-6">
                        <div className="text-center text-lg font-medium text-gray-800 mb-3">
                          Duration
                        </div>
                        <div className="flex flex-wrap justify-center gap-3">
                          {durationOptions.map((minutes) => {
                            const disabled =
                              activeAvailableMinutes !== null &&
                              minutes > activeAvailableMinutes;
                            const isSelected = selectedDuration === minutes;

                            return (
                              <button
                                key={minutes}
                                type="button"
                                onClick={() => !disabled && setSelectedDuration(minutes)}
                                disabled={disabled}
                                className={`px-5 py-2 rounded-full border-2 text-lg font-semibold transition-colors ${
                                  disabled
                                    ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-gray-900 text-white border-gray-900'
                                    : 'border-gray-400 text-gray-800 hover:bg-gray-100'
                                }`}
                              >
                                {minutes === 60 ? '1 hr' : `${minutes} min`}
                              </button>
                            );
                          })}
                        </div>
                        {activeAvailableMinutes !== null && (
                          <div className="mt-3 text-center text-sm text-gray-500">
                            Available for {activeAvailableMinutes} min
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        {/* Host Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Host *
                          </label>
                          {selectedHost ? (
                            <div className="flex items-center justify-between bg-green-50 border-2 border-green-500 rounded-xl p-3">
                              <div>
                                <div className="font-semibold text-gray-900">{selectedHost.name}</div>
                                <div className="text-sm text-gray-600">{selectedHost.email}</div>
                              </div>
                              <button
                                onClick={() => setBookingForm({ ...bookingForm, hostId: '' })}
                                className="text-red-600 hover:text-red-800 font-semibold"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <>
                              <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name or email..."
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:outline-none focus:border-green-500 text-gray-900 mb-2"
                                autoFocus
                              />
                              <div className="max-h-48 overflow-y-auto border-2 border-gray-200 rounded-xl">
                                {filteredUsers.slice(0, 5).map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() => {
                                      setBookingForm({ ...bookingForm, hostId: user.id });
                                      setSearchTerm('');
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                  >
                                    <div className="font-semibold text-gray-900">{user.name}</div>
                                    <div className="text-sm text-gray-600">{user.email}</div>
                                  </button>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Attendees Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Attendees (optional)
                          </label>
                          {selectedAttendees.length > 0 && (
                            <div className="mb-2 flex flex-wrap gap-2">
                              {selectedAttendees.map((user) => (
                                <div
                                  key={user.id}
                                  className="flex items-center bg-blue-50 rounded-full px-3 py-1"
                                >
                                  <span className="text-sm text-gray-900">{user.name}</span>
                                  <button
                                    onClick={() => toggleAttendee(user.id)}
                                    className="ml-2 text-red-600 hover:text-red-800"
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Attendee search */}
                          <input
                            type="text"
                            value={attendeeSearch}
                            onChange={(e) => setAttendeeSearch(e.target.value)}
                            placeholder="Search attendees..."
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-lg focus:outline-none focus:border-green-500 text-gray-900 mb-2"
                          />
                          {attendeeSearch && (
                            <div className="max-h-40 overflow-y-auto border-2 border-gray-200 rounded-xl">
                              {filteredAttendees.slice(0, 5).map((user) => (
                                <button
                                  key={user.id}
                                  onClick={() => {
                                    toggleAttendee(user.id);
                                    setAttendeeSearch('');
                                  }}
                                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                >
                                  <div className="font-semibold text-gray-900">{user.name}</div>
                                  <div className="text-sm text-gray-600">{user.email}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="pt-4 flex flex-col sm:flex-row gap-3">
                          <button
                            type="button"
                            onClick={handleCancelBooking}
                            className="flex-1 h-12 rounded-full border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={quickBook}
                            disabled={bookingInProgress || !bookingForm.hostId || !selectedDuration}
                            className="flex-1 h-12 rounded-full bg-gray-900 text-white font-medium hover:bg-black disabled:opacity-50"
                          >
                            {bookingInProgress ? 'Booking…' : 'Book now'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


