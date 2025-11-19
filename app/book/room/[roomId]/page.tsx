'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { RoomCalendar } from '@/lib/components/RoomCalendar';
import { ArrowLeft, Calendar, Clock, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface Room {
  id: string;
  name: string;
  capacity: number;
  photo_url: string | null;
  location: {
    name: string;
    timezone: string;
  };
  features: {
    tv?: boolean;
    whiteboard?: boolean;
  };
}

export default function RoomBookingPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper to round "now" up to the next 15‑minute mark and format as HH:mm
  const getRoundedNowTime = () => {
    const now = new Date();
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    if (roundedMinutes === 60) {
      now.setHours(now.getHours() + 1);
      now.setMinutes(0);
    } else {
      now.setMinutes(roundedMinutes);
    }
    now.setSeconds(0);
    now.setMilliseconds(0);

    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    return { time: `${h}:${m}`, date: now.toISOString().split('T')[0] };
  };

  const initial = getRoundedNowTime();

  const [booking, setBooking] = useState({
    title: '',
    date: initial.date,
    startTime: initial.time,
    duration: 60,
    attendees: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [hostSearch, setHostSearch] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  useEffect(() => {
    if (roomId) {
      fetchRoom();
      fetchUsers();
    }
  }, [roomId]);

  // Keep start time from drifting into the past when booking "today"
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (booking.date === today) {
      const { time: minTime } = getRoundedNowTime();
      if (booking.startTime < minTime) {
        setBooking((b) => ({ ...b, startTime: minTime }));
      }
    }
  }, [booking.date, booking.startTime]);

  // Check availability when time/date changes
  useEffect(() => {
    if (booking.date && booking.startTime && booking.duration && roomId) {
      checkAvailability();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.date, booking.startTime, booking.duration, roomId]);

  const fetchRoom = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      const result = await response.json();
      if (result.success) {
        setRoom(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
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

  const checkAvailability = async () => {
    setCheckingAvailability(true);
    setAvailabilityMessage(null);
    
    try {
      const startDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
      const now = new Date();

      // Prevent checking/booking for times in the past (for today)
      if (startDateTime < now) {
        setAvailabilityMessage({
          type: 'error',
          text: 'Start time cannot be in the past.',
        });
        setCheckingAvailability(false);
        return;
      }

      const endDateTime = new Date(startDateTime.getTime() + booking.duration * 60 * 1000);

      // Fetch existing bookings for this time period
      const response = await fetch(
        `/api/bookings?room_id=${roomId}&start_date=${startDateTime.toISOString()}&end_date=${endDateTime.toISOString()}`
      );
      
      const result = await response.json();
      
      if (result.success) {
        const existingBookings = result.data.filter(
          (b: any) => b.status === 'scheduled' || b.status === 'confirmed'
        );

        // Check for conflicts
        const hasConflict = existingBookings.some((b: any) => {
          const bookingStart = new Date(b.start_time);
          const bookingEnd = new Date(b.end_time);
          
          // Check if times overlap
          return (
            (startDateTime >= bookingStart && startDateTime < bookingEnd) ||
            (endDateTime > bookingStart && endDateTime <= bookingEnd) ||
            (startDateTime <= bookingStart && endDateTime >= bookingEnd)
          );
        });

        if (hasConflict) {
          setAvailabilityMessage({
            type: 'error',
            text: 'This time slot is already booked. Please choose a different time.'
          });
        } else {
          setAvailabilityMessage({
            type: 'success',
            text: 'Room is available for this time slot ✓'
          });
        }
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check if there's a conflict before submitting
    if (availabilityMessage?.type === 'error') {
      setError('Cannot book: time slot is already taken');
      return;
    }
    
    setSubmitting(true);
    setError('');

    try {
      const startDateTime = new Date(`${booking.date}T${booking.startTime}:00`);
      const now = new Date();

      if (startDateTime < now) {
        setError('Start time cannot be in the past.');
        return;
      }

      const endDateTime = new Date(startDateTime.getTime() + booking.duration * 60 * 1000);

      // Combine manually entered emails, host email, and selected user emails
      const manualEmails = booking.attendees
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
      
      const hostEmail = hostUserId
        ? users.find((u) => u.id === hostUserId)?.email
        : undefined;

      const selectedEmails = selectedAttendees.map(u => u.email);
      const allEmails = [...new Set([...manualEmails, ...(hostEmail ? [hostEmail] : []), ...selectedEmails])]; // Remove duplicates

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          host_user_id: hostUserId ?? undefined,
          title: booking.title || 'Conference Room Booking',
          start_time: startDateTime.toISOString(),
          end_time: endDateTime.toISOString(),
          source: 'web',
          attendee_emails: allEmails,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setError(result.error?.message || 'Failed to create booking');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAttendee = (user: { id: string; name: string; email: string }) => {
    if (selectedAttendees.some(a => a.id === user.id)) {
      setSelectedAttendees(selectedAttendees.filter(a => a.id !== user.id));
    } else {
      setSelectedAttendees([...selectedAttendees, user]);
    }
  };

  const filteredUsers = users.filter(user =>
    attendeeSearch &&
    (user.name.toLowerCase().includes(attendeeSearch.toLowerCase()) ||
    user.email.toLowerCase().includes(attendeeSearch.toLowerCase()))
  );

  const filteredHosts = users.filter(user =>
    hostSearch &&
    (user.name.toLowerCase().includes(hostSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(hostSearch.toLowerCase()))
  );

  const selectedHost = hostUserId
    ? users.find((user) => user.id === hostUserId) ?? null
    : null;

  const handleSlotSelect = (slot: { date: string; startTime: string; durationMinutes?: number }) => {
    setBooking((prev) => ({
      ...prev,
      date: slot.date,
      startTime: slot.startTime,
      duration: slot.durationMinutes ?? prev.duration,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F3EC] flex items-center justify-center">
        <div className="text-gray-600">Loading room details...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-[#F7F3EC] flex items-center justify-center px-6">
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">Room not found</p>
            <Link href="/book">
              <Button>Back to Rooms</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3EC]">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/book">
              <button className="tablet-shadow px-4 py-2 rounded-full bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                All rooms
              </button>
            </Link>
          </div>
          <Link href="/">
            <button className="hidden sm:flex tablet-shadow px-4 py-2 rounded-full bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 items-center gap-2">
              Home
            </button>
          </Link>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 pb-16 space-y-8">
        {/* Room hero */}
        <section className="rounded-3xl bg-white tablet-shadow overflow-hidden">
          <div className="relative h-52 sm:h-64 overflow-hidden">
                {room.photo_url ? (
                  <img
                    src={room.photo_url}
                    alt={room.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
              <div className="w-full h-full bg-gray-200" />
                )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
                
            <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl sm:text-4xl font-semibold text-white drop-shadow-lg">
                    {room.name}
                  </h1>
                  <p className="text-sm sm:text-base text-white/90">
                    {room.location.name}
                  </p>
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 text-gray-900 text-sm font-medium tablet-shadow">
                  <Users className="w-4 h-4" />
                  <span>{room.capacity} people</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                    {room.features?.tv && (
                  <span className="px-3 py-1 rounded-full bg-[#E3F2FF] text-[#2563EB] font-medium">
                        TV
                      </span>
                    )}
                    {room.features?.whiteboard && (
                  <span className="px-3 py-1 rounded-full bg-[#E6F9EE] text-[#166534] font-medium">
                        Whiteboard
                      </span>
                    )}
                    {!room.features?.tv && !room.features?.whiteboard && (
                  <span className="px-3 py-1 rounded-full bg-white/20 text-white text-xs">
                    No special equipment
                  </span>
                    )}
              </div>
              </div>
          </div>
        </section>

        {/* Booking form + calendar */}
        <section className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
          {/* Form */}
          <div className="lg:col-span-3">
            <Card className="rounded-3xl bg-white tablet-shadow border-0">
              {success ? (
                <div className="text-center py-10">
                  <div className="text-green-600 text-lg font-semibold mb-2">
                    ✓ Booking created
                  </div>
                  <p className="text-gray-600 text-sm">
                    Refreshing calendar…
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                      Schedule this room
                    </h2>
                  </div>

                  {/* Title */}
                  <Input
                    label="Title"
                    placeholder="e.g., Weekly sync"
                    value={booking.title}
                    onChange={(e) =>
                      setBooking({ ...booking, title: e.target.value })
                    }
                    required
                  />

                  {/* People: host left, attendees right */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      People
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Host */}
                  <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                          Host
                    </label>
                        {selectedHost ? (
                          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                            <div>
                              <div className="text-sm font-semibold text-gray-900">
                                {selectedHost.name}
                              </div>
                              <div className="text-xs text-gray-600">
                                {selectedHost.email}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setHostUserId(null);
                                setHostSearch('');
                              }}
                              className="text-xs font-semibold text-red-600 hover:text-red-800"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <div className="relative">
                            <input
                              type="text"
                              value={hostSearch}
                              onChange={(e) => setHostSearch(e.target.value)}
                              placeholder="Search host by name or email…"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400 bg-white"
                            />
                            {hostSearch && filteredHosts.length > 0 && (
                              <div className="absolute z-10 w-full mt-1 max-h-56 overflow-y-auto bg-white border border-gray-300 rounded-xl shadow-lg">
                                {filteredHosts.slice(0, 6).map((user) => (
                                  <button
                                    key={user.id}
                                    type="button"
                                    onClick={() => {
                                      setHostUserId(user.id);
                                      setHostSearch('');
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                                  >
                                    <div className="text-sm font-semibold text-gray-900">
                                      {user.name}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {user.email}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                  </div>

                      {/* Attendees */}
                  <div>
                        <label className="block text-xs font-medium text-gray-700 mb-2 uppercase tracking-wide">
                      Attendees
                    </label>
                    
                    {selectedAttendees.length > 0 && (
                          <div className="mb-2 flex flex-wrap gap-2">
                            {selectedAttendees.map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center bg-blue-50 border border-blue-200 rounded-full px-3 py-1"
                              >
                                <span className="text-xs text-gray-900">
                                  {user.name}
                                </span>
                            <button
                              type="button"
                              onClick={() => toggleAttendee(user)}
                                  className="ml-2 text-xs text-red-600 hover:text-red-800 font-semibold"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="relative mb-3">
                      <input
                        type="text"
                        value={attendeeSearch}
                            onChange={(e) =>
                              setAttendeeSearch(e.target.value)
                            }
                            placeholder="Search people to add…"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder:text-gray-400 bg-white"
                      />
                      {attendeeSearch && filteredUsers.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 max-h-56 overflow-y-auto bg-white border border-gray-300 rounded-xl shadow-lg">
                              {filteredUsers.slice(0, 6).map((user) => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                toggleAttendee(user);
                                setAttendeeSearch('');
                              }}
                              className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0"
                            >
                                  <div className="text-sm font-semibold text-gray-900">
                                    {user.name}
                                  </div>
                                  <div className="text-xs text-gray-600">
                                    {user.email}
                                  </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                        <Input
                          label="Or enter emails (comma-separated)"
                          placeholder="john@example.com, jane@example.com"
                          value={booking.attendees}
                          onChange={(e) =>
                            setBooking({
                              ...booking,
                              attendees: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Date & duration */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Input
                      label="Date"
                      type="date"
                      value={booking.date}
                      onChange={(e) =>
                        setBooking({ ...booking, date: e.target.value })
                      }
                      required
                    />

                    <Input
                      label="Start"
                      type="time"
                      value={booking.startTime}
                      onChange={(e) =>
                        setBooking({
                          ...booking,
                          startTime: e.target.value,
                        })
                      }
                      required
                    />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Duration
                      </label>
                      <select
                        value={booking.duration}
                        onChange={(e) =>
                          setBooking({
                            ...booking,
                            duration: Number(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm bg-white"
                      >
                        <option value={15}>15 min</option>
                        <option value={30}>30 min</option>
                        <option value={45}>45 min</option>
                        <option value={60}>1 hour</option>
                        <option value={90}>1.5 hours</option>
                        <option value={120}>2 hours</option>
                        <option value={180}>3 hours</option>
                        <option value={240}>4 hours</option>
                      </select>
                    </div>
                  </div>

                  {checkingAvailability && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg text-xs">
                      Checking availability…
                    </div>
                  )}
                  
                  {availabilityMessage && !checkingAvailability && (
                    <div
                      className={`border px-4 py-3 rounded-lg text-xs font-medium ${
                      availabilityMessage.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-red-50 border-red-200 text-red-700'
                      }`}
                    >
                      {availabilityMessage.text}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-xs">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full mt-1"
                    disabled={
                      submitting ||
                      checkingAvailability ||
                      availabilityMessage?.type === 'error'
                    }
                  >
                    {submitting ? 'Creating booking…' : 'Book this room'}
                  </Button>
                </form>
              )}
            </Card>
          </div>

          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="rounded-3xl bg-white/80 tablet-shadow border-0">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900">
                  Schedule
                </h3>
        </div>
              <RoomCalendar
                roomId={roomId}
                roomName={room.name}
                embedded
                onSlotSelect={handleSlotSelect}
              />
            </Card>
        </div>
        </section>
      </main>
    </div>
  );
}

