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
  features: Record<string, boolean>;
}

export default function RoomBookingPage() {
  const params = useParams();
  const roomId = params?.roomId as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    duration: 60,
    attendees: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [quickBookDuration, setQuickBookDuration] = useState<number | null>(null);
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedAttendees, setSelectedAttendees] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');

  useEffect(() => {
    if (roomId) {
      fetchRoom();
      fetchUsers();
    }
  }, [roomId]);

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
      const endDateTime = new Date(startDateTime.getTime() + booking.duration * 60 * 1000);

      // Combine manually entered emails and selected user emails
      const manualEmails = booking.attendees
        .split(',')
        .map((email) => email.trim())
        .filter(Boolean);
      
      const selectedEmails = selectedAttendees.map(u => u.email);
      const allEmails = [...new Set([...manualEmails, ...selectedEmails])]; // Remove duplicates

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
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

  const handleQuickBook = async (duration: number) => {
    setQuickBookDuration(duration);
    setError('');

    try {
      const now = new Date();
      const endTime = new Date(now.getTime() + duration * 60 * 1000);

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          title: `Quick Booking - ${duration} min`,
          start_time: now.toISOString(),
          end_time: endTime.toISOString(),
          source: 'web',
          attendee_emails: [],
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
      setQuickBookDuration(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading room details...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
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
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center">
            <Link href="/book">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Room Details */}
          <div className="lg:col-span-2">
            <Card className="overflow-hidden p-0 h-full">
              <div className="relative h-56 overflow-hidden">
                {room.photo_url ? (
                  <img
                    src={room.photo_url}
                    alt={room.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-600" />
                )}
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                
                {/* Room Name Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <h2 className="text-3xl font-bold drop-shadow-lg mb-1">{room.name}</h2>
                  <p className="text-base text-white/90 drop-shadow-md">{room.location.name}</p>
                </div>
              </div>

              <div className="p-6">

              <div className="space-y-4">
                <div className="flex items-center text-gray-600">
                  <Users className="w-5 h-5 mr-3" />
                  <span>Capacity: {room.capacity} people</span>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Features:</h3>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(room.features || {})
                      .filter(([, enabled]) => enabled)
                      .map(([feature]) => (
                        <span
                          key={feature}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full"
                        >
                          {feature}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
              </div>
            </Card>
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Quick Book Section */}
            <Card title="Quick Book - Start Now">
              <div className="space-y-4">
                <p className="text-sm text-gray-600">Book this room immediately for:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[15, 30, 45, 60].map((duration) => (
                    <Button
                      key={duration}
                      onClick={() => handleQuickBook(duration)}
                      disabled={quickBookDuration !== null || success}
                      variant="secondary"
                      className="w-full"
                    >
                      {quickBookDuration === duration ? (
                        <span className="text-sm">Booking...</span>
                      ) : (
                        <>
                          <Clock className="w-4 h-4 mr-1" />
                          <span className="text-sm font-semibold">{duration} min</span>
                        </>
                      )}
                    </Button>
                  ))}
                </div>
                {error && !submitting && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded text-sm">
                    {error}
                  </div>
                )}
              </div>
            </Card>

            {/* Regular Booking Form */}
            <Card title="Schedule for Later">
              {success ? (
                <div className="text-center py-8">
                  <div className="text-green-600 text-xl font-semibold mb-2">
                    ✓ Booking Created Successfully!
                  </div>
                  <p className="text-gray-600">Refreshing calendar...</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Meeting Title"
                    placeholder="e.g., Team Standup"
                    value={booking.title}
                    onChange={(e) => setBooking({ ...booking, title: e.target.value })}
                    required
                  />

                  <Input
                    label="Date"
                    type="date"
                    value={booking.date}
                    onChange={(e) => setBooking({ ...booking, date: e.target.value })}
                    required
                  />

                  <Input
                    label="Start Time"
                    type="time"
                    value={booking.startTime}
                    onChange={(e) => setBooking({ ...booking, startTime: e.target.value })}
                    required
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Duration
                    </label>
                    <select
                      value={booking.duration}
                      onChange={(e) =>
                        setBooking({ ...booking, duration: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                    >
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={90}>1.5 hours</option>
                      <option value={120}>2 hours</option>
                      <option value={180}>3 hours</option>
                      <option value={240}>4 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Attendees
                    </label>
                    
                    {/* Selected Attendees */}
                    {selectedAttendees.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2">
                        {selectedAttendees.map(user => (
                          <div key={user.id} className="flex items-center bg-blue-50 border border-blue-200 rounded-full px-3 py-1">
                            <span className="text-sm text-gray-900">{user.name}</span>
                            <button
                              type="button"
                              onClick={() => toggleAttendee(user)}
                              className="ml-2 text-red-600 hover:text-red-800 font-bold"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Search Users */}
                    <div className="relative mb-3">
                      <input
                        type="text"
                        value={attendeeSearch}
                        onChange={(e) => setAttendeeSearch(e.target.value)}
                        placeholder="Search users to add..."
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400"
                      />
                      {attendeeSearch && filteredUsers.length > 0 && (
                        <div className="absolute z-10 w-full mt-1 max-h-60 overflow-y-auto bg-white border border-gray-300 rounded-md shadow-lg">
                          {filteredUsers.slice(0, 5).map(user => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => {
                                toggleAttendee(user);
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

                    {/* Manual Email Entry */}
                    <Input
                      label="Or enter emails manually (comma-separated)"
                      placeholder="john@example.com, jane@example.com"
                      value={booking.attendees}
                      onChange={(e) => setBooking({ ...booking, attendees: e.target.value })}
                    />
                  </div>

                  {/* Availability Check Message */}
                  {checkingAvailability && (
                    <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">
                      Checking availability...
                    </div>
                  )}
                  
                  {availabilityMessage && !checkingAvailability && (
                    <div className={`border px-4 py-3 rounded text-sm font-medium ${
                      availabilityMessage.type === 'success' 
                        ? 'bg-green-50 border-green-200 text-green-700' 
                        : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                      {availabilityMessage.text}
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={submitting || checkingAvailability || availabilityMessage?.type === 'error'}
                  >
                    {submitting ? 'Creating Booking...' : 'Book Room'}
                  </Button>
                </form>
              )}
            </Card>
          </div>
        </div>

        {/* Calendar View */}
        <div className="mt-8">
          <RoomCalendar roomId={roomId} roomName={room.name} />
        </div>
      </main>
    </div>
  );
}

