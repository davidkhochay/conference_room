'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/lib/components/ui/Button';
import { Calendar, Clock, User, QrCode, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface RoomStatus {
  room_id: string;
  room_name: string;
  location_name: string;
  photo_url: string | null;
  capacity: number;
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
}

export default function TabletDisplay() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const [status, setStatus] = useState<RoomStatus | null>(null);
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
  const [allBookings, setAllBookings] = useState<Array<{
    id: string;
    title: string;
    host_name: string | null;
    start_time: string;
    end_time: string;
  }>>([]);

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

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
          }));
        setAllBookings(bookings);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const handleQuickBookClick = (duration: number) => {
    setSelectedDuration(duration);
    setShowBookingForm(true);
  };

  const handleCancelBooking = () => {
    setShowBookingForm(false);
    setSelectedDuration(null);
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
      const endTime = new Date(now.getTime() + selectedDuration * 60 * 1000);

      const host = users.find(u => u.id === bookingForm.hostId);
      const attendeeEmails = bookingForm.attendeeIds
        .map(id => users.find(u => u.id === id)?.email)
        .filter(Boolean) as string[];

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          host_user_id: bookingForm.hostId,
          title: `${host?.name}'s Meeting`,
          start_time: now.toISOString(),
          end_time: endTime.toISOString(),
          source: 'tablet',
          attendee_emails: attendeeEmails,
        }),
      });

      const result = await response.json();
      if (result.success) {
        await fetchStatus();
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
    if (!confirm('Are you sure you want to end this meeting early?')) return;

    try {
      const response = await fetch(`/api/bookings/${status.current_booking.id}/end`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
      }
    } catch (error) {
      console.error('Failed to end meeting:', error);
    }
  };

  const extendMeeting = async (additionalMinutes: number) => {
    if (!status?.current_booking) return;

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
        alert(`Failed to extend: ${result.error?.message}`);
      }
    } catch (error) {
      console.error('Failed to extend meeting:', error);
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

  const isAvailable = !status.is_occupied;
  const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/room/${roomId}`;

  // Check if we're within ±10 minutes of an event start time
  const isCheckInWindow = () => {
    if (!status.current_booking && status.next_bookings.length > 0) {
      const now = new Date();
      const nextBooking = status.next_bookings[0];
      const startTime = new Date(nextBooking.start_time);
      const timeDiff = (startTime.getTime() - now.getTime()) / (1000 * 60); // minutes
      
      // Within 10 minutes before the event
      return timeDiff >= -10 && timeDiff <= 10;
    }
    return false;
  };

  const handleCheckIn = async () => {
    if (!status.next_bookings.length) return;
    
    const nextBooking = status.next_bookings[0];
    try {
      const response = await fetch(`/api/bookings/${nextBooking.id}/checkin`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchStatus();
      } else {
        alert('Failed to check in');
      }
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
    const dayBookings = allBookings
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

    // Filter out current booking from day bookings to avoid duplicates
    const upcomingBookings = currentBooking
      ? dayBookings.filter(b => b.id !== currentBooking.id)
      : dayBookings;

    return { currentBooking, dayBookings: upcomingBookings };
  };

  const { currentBooking: dateCurrentBooking, dayBookings } = getBookingsForDate(selectedDate);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Link 
                href="/tablet"
                className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
              >
                ← Change Room
              </Link>
              <div className="h-6 w-px bg-gray-300" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{status.room_name}</h1>
                <div className="flex items-center gap-4 text-gray-600 text-sm">
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {status.location_name}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {status.capacity} people
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-4xl font-bold text-gray-900">
                {currentTime.toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true,
                })}
              </div>
              <div className="text-gray-600 text-sm">
                {currentTime.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Split Layout */}
        <div className="flex h-[calc(100vh-100px)]">
          {/* Left Side - Room Photo */}
          <div className="w-1/2 relative">
            {status.photo_url ? (
              <img
                src={status.photo_url}
                alt={status.room_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500" />
            )}
            
            {/* Status Overlay */}
            <div className="absolute top-8 left-8">
              <div className={`px-8 py-4 rounded-2xl backdrop-blur-md border-4 ${
                isAvailable ? 'bg-green-500/90 border-green-300' : 'bg-red-500/90 border-red-300'
              }`}>
                <div className="text-white text-4xl font-bold">
                  {isAvailable ? 'AVAILABLE' : 'IN USE'}
                </div>
              </div>
            </div>

            {/* Current Booking Info Overlay */}
            {status.current_booking && (
              <div className="absolute bottom-8 left-8 right-8 bg-black/80 backdrop-blur-md rounded-2xl p-6 text-white">
                <div className="text-2xl font-bold mb-2">{status.current_booking.title}</div>
                {status.current_booking.host_name && (
                  <div className="flex items-center text-lg mb-2">
                    <User className="w-5 h-5 mr-2" />
                    {status.current_booking.host_name}
                  </div>
                )}
                <div className="flex items-center text-lg">
                  <Clock className="w-5 h-5 mr-2" />
                  Until {formatTime(status.current_booking.end_time)}
                </div>
              </div>
            )}
          </div>

                  {/* Right Side - Calendar & Actions */}
                  <div 
                    className="w-1/2 bg-white overflow-y-auto"
                    onTouchStart={onTouchStart}
                    onTouchMove={onTouchMove}
                    onTouchEnd={onTouchEnd}
                  >
                    <div className="p-8">
                      {/* Date Navigation Header */}
                      <div className="mb-6 pb-4 border-b-2 border-gray-200">
                        <div className="flex items-center justify-between mb-4">
                          <button
                            onClick={goToPreviousDay}
                            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                          </button>
                          
                          <div className="text-center flex-1">
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <Calendar className="w-6 h-6 text-blue-600" />
                              <h2 className="text-2xl font-bold text-gray-900">
                                {selectedDate.toLocaleDateString('en-US', { 
                                  weekday: 'long',
                                  month: 'long', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </h2>
                            </div>
                            {!isToday(selectedDate) && (
                              <button
                                onClick={goToToday}
                                className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                              >
                                Jump to Today
                              </button>
                            )}
                          </div>

                          <button
                            onClick={goToNextDay}
                            className="p-3 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        </div>
                        
                        <div className="text-center text-sm text-gray-500">
                          Swipe left or right to change days
                        </div>
                      </div>

                      {/* Check-in Section */}
                      {showCheckIn && nextBooking && !isAvailable && isToday(selectedDate) && (
                <div className="mb-8 bg-blue-50 border-2 border-blue-500 rounded-2xl p-8">
                  <div className="text-center mb-6">
                    <div className="text-2xl font-bold text-gray-900 mb-2">
                      Your meeting is about to start!
                    </div>
                    <div className="text-xl text-gray-700 mb-1">{nextBooking.title}</div>
                    <div className="text-lg text-gray-600">
                      {formatTime(nextBooking.start_time)} - {formatTime(nextBooking.end_time)}
                    </div>
                  </div>
                  <button
                    onClick={handleCheckIn}
                    className="w-full h-24 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-2xl text-3xl font-bold shadow-xl transition-all transform hover:scale-105 active:scale-95"
                  >
                    Check In
                  </button>
                </div>
              )}

                      {/* Quick Book Buttons */}
                      {isAvailable && !showCheckIn && !showBookingForm && isToday(selectedDate) && (
                <div className="mb-8">
                  <div className="text-center text-2xl font-bold text-gray-900 mb-6">
                    Book Now
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[15, 30, 45, 60].map((duration) => (
                      <button
                        key={duration}
                        onClick={() => handleQuickBookClick(duration)}
                        className="h-28 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-2xl text-3xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95"
                      >
                        {duration} min
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking Form */}
              {showBookingForm && (
                <div className="mb-8 bg-white border-2 border-green-500 rounded-2xl p-6 shadow-xl max-h-[600px] overflow-y-auto">
                  <div className="text-center text-2xl font-bold text-gray-900 mb-2">
                    Book for {selectedDuration} minutes
                  </div>
                  <div className="text-center text-sm text-gray-600 mb-6">
                    Starting now
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

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleCancelBooking}
                        className="flex-1 h-16 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-xl text-lg font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={quickBook}
                        disabled={bookingInProgress || !bookingForm.hostId}
                        className="flex-1 h-16 bg-green-600 hover:bg-green-700 active:bg-green-800 text-white rounded-xl text-lg font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {bookingInProgress ? 'Booking...' : 'Confirm Booking'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

                      {/* Meeting Controls */}
                      {!isAvailable && !showCheckIn && isToday(selectedDate) && (
                <div className="mb-8">
                  <div className="text-center text-xl font-bold text-gray-900 mb-4">
                    Meeting Controls
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => extendMeeting(15)}
                      className="h-20 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xl font-bold shadow-lg transition-all"
                    >
                      +15 min
                    </button>
                    <button
                      onClick={() => extendMeeting(30)}
                      className="h-20 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl text-xl font-bold shadow-lg transition-all"
                    >
                      +30 min
                    </button>
                  </div>
                  <button
                    onClick={endMeeting}
                    className="w-full h-16 mt-4 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl text-xl font-bold shadow-lg transition-all"
                  >
                    End Meeting Now
                  </button>
                </div>
              )}

                      {/* Day Calendar */}
                      <div className="space-y-3">
                        {dayBookings.length === 0 && !dateCurrentBooking ? (
                          <div className="text-center py-12 text-gray-500 text-lg">
                            No bookings scheduled for this day
                          </div>
                        ) : (
                          <>
                            {dateCurrentBooking && isToday(selectedDate) && (
                              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="text-lg font-bold text-gray-900">{dateCurrentBooking.title}</div>
                                    {dateCurrentBooking.host_name && (
                                      <div className="text-sm text-gray-600 mt-1">
                                        <User className="w-4 h-4 inline mr-1" />
                                        {dateCurrentBooking.host_name}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="text-sm font-semibold text-red-600">NOW</div>
                                    <div className="text-sm text-gray-600">
                                      {formatTime(dateCurrentBooking.start_time)} - {formatTime(dateCurrentBooking.end_time)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                            {dayBookings.map((booking) => (
                              <div key={booking.id} className="bg-gray-50 border-l-4 border-blue-500 p-4 rounded-lg hover:bg-gray-100 transition-colors">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="text-lg font-bold text-gray-900">{booking.title}</div>
                                    {booking.host_name && (
                                      <div className="text-sm text-gray-600 mt-1">
                                        <User className="w-4 h-4 inline mr-1" />
                                        {booking.host_name}
                                      </div>
                                    )}
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="text-lg font-bold text-gray-900">
                                      {formatTime(booking.start_time)}
                                    </div>
                                    <div className="text-sm text-gray-600">
                                      {formatTime(booking.end_time)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

