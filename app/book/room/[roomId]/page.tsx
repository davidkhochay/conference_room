'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { RoomCalendar } from '@/lib/components/RoomCalendar';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';

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

interface DatePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function DatePickerField({ label, value, onChange }: DatePickerFieldProps) {
  const parsed = value ? new Date(value) : new Date();
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    new Date(parsed.getFullYear(), parsed.getMonth(), 1)
  );

  const startOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth(),
    1
  );
  const endOfMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  );

  const firstDayOfWeek = startOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = endOfMonth.getDate();

  const days: Array<Date | null> = [];
  for (let i = 0; i < firstDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    );
  }

  const monthLabel = currentMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const selectedDate = value ? new Date(value) : null;
  const today = new Date();

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const displayValue = selectedDate
    ? selectedDate.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Pick a date';

  const handleSelect = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    onChange(`${year}-${month}-${day}`);
    setOpen(false);
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <span className="text-sm text-gray-900">
            {displayValue}
          </span>
          <Calendar className="w-4 h-4 text-gray-500" />
        </button>

        {open && (
          <div className="absolute z-20 mt-2 w-72 rounded-2xl border border-gray-200 bg-white shadow-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <button
                type="button"
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() - 1,
                      1
                    )
                  )
                }
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <div className="text-sm font-medium text-gray-900">
                {monthLabel}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCurrentMonth(
                    new Date(
                      currentMonth.getFullYear(),
                      currentMonth.getMonth() + 1,
                      1
                    )
                  )
                }
                className="p-1 rounded-md hover:bg-gray-100"
              >
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-[11px] text-gray-500 mb-1">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className="text-center">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1 text-xs">
              {days.map((date, idx) => {
                if (!date) {
                  return <div key={idx} />;
                }

                const isSelected =
                  selectedDate && isSameDay(date, selectedDate);
                const isTodayDate = isSameDay(date, today);

                let classes =
                  'w-8 h-8 flex items-center justify-center rounded-full cursor-pointer';

                if (isSelected) {
                  classes += ' bg-gray-900 text-white';
                } else if (isTodayDate) {
                  classes +=
                    ' border border-gray-300 text-gray-900';
                } else {
                  classes +=
                    ' text-gray-800 hover:bg-gray-100';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelect(date)}
                    className={classes}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-blue-600">
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
                className="hover:underline"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(
                    2,
                    '0'
                  );
                  const day = String(now.getDate()).padStart(2, '0');
                  onChange(`${year}-${month}-${day}`);
                  setCurrentMonth(
                    new Date(now.getFullYear(), now.getMonth(), 1)
                  );
                  setOpen(false);
                }}
                className="hover:underline"
              >
                Today
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface TimePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

// Parse flexible time input (e.g. "10:30", "10:30am", "3 pm") into "HH:mm"
function parseTimeInput(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;

  const ampmMatch = raw.match(/\b(am|pm)\b/);
  const isPM = ampmMatch?.[1] === 'pm';

  // Keep only digits and colon for the numeric portion
  const numeric = raw.replace(/[^0-9:]/g, '');
  if (!numeric) return null;

  const [hStr, mStr = '0'] = numeric.split(':');
  const hours = parseInt(hStr, 10);
  const minutes = parseInt(mStr, 10);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  let h = hours;
  if (ampmMatch) {
    if (h === 12) {
      h = isPM ? 12 : 0;
    } else if (isPM) {
      h += 12;
    }
  }

  if (h < 0 || h > 23) return null;

  const hh = String(h).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  return `${hh}:${mm}`;
}

// Format "HH:mm" into a friendly 12‑hour display, e.g. "10:30 AM"
function formatTimeDisplay(value: string): string {
  if (!value) return '';
  const [hStr, mStr = '00'] = value.split(':');
  const h24 = parseInt(hStr, 10);
  if (Number.isNaN(h24)) return '';
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${mStr.padStart(2, '0')} ${suffix}`;
}

function TimePickerField({ label, value, onChange }: TimePickerFieldProps) {
  const [text, setText] = useState<string>(() => formatTimeDisplay(value));

  // Keep local text in sync if the canonical value changes externally
  useEffect(() => {
    setText(formatTimeDisplay(value));
  }, [value]);

  const commit = () => {
    if (!text.trim()) {
      onChange('');
      return;
    }
    const parsed = parseTimeInput(text);
    if (!parsed) {
      // Revert to last valid value
      setText(formatTimeDisplay(value));
      return;
    }
    if (parsed !== value) {
      onChange(parsed);
    }
    setText(formatTimeDisplay(parsed));
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <div className="relative">
        <Clock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
          placeholder="e.g. 10:30 AM"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 placeholder:text-gray-400 bg-white"
        />
      </div>
    </div>
  );
}

interface DurationSelectProps {
  value: number;
  onChange: (value: number) => void;
}

function DurationSelect({ value, onChange }: DurationSelectProps) {
  const [open, setOpen] = useState(false);

  const options: { value: number; label: string }[] = [
    { value: 15, label: '15 min' },
    { value: 30, label: '30 min' },
    { value: 45, label: '45 min' },
    { value: 60, label: '1 hour' },
    { value: 90, label: '1.5 hours' },
    { value: 120, label: '2 hours' },
    { value: 180, label: '3 hours' },
    { value: 240, label: '4 hours' },
  ];

  const selected =
    options.find((opt) => opt.value === value)?.label || 'Select duration';

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Duration
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <span className="text-sm text-gray-900">{selected}</span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </button>

        {open && (
          <div className="absolute z-20 mt-2 w-full max-h-64 overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-lg py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm ${
                  opt.value === value
                    ? 'bg-gray-900 text-white'
                    : 'text-gray-800 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function RoomBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params?.roomId as string;
  const from = searchParams.get('from');
  const backHref = from === 'public' ? '/book/public' : '/book';

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
        const existingBookings = result.data.filter((b: any) => {
          const status = (b.status || '').toLowerCase();

          // No-shows and cancelled bookings should not block new bookings
          if (status === 'no_show' || status === 'cancelled') {
            return false;
          }

          // Treat scheduled / confirmed / in_progress as blocking
          return (
            status === 'scheduled' ||
            status === 'confirmed' ||
            status === 'in_progress'
          );
        });

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
            <Link href={backHref}>
              <Button>Back to Rooms</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F3EC] overflow-y-auto">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={backHref}>
              <button className="tablet-shadow px-4 py-2 rounded-full bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                All rooms
              </button>
            </Link>
          </div>
         
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
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form */}
          <div className="lg:col-span-4">
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

                  {/* People: single column */}
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-gray-900">
                      People
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
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

                  {/* Date & duration - single column */}
                  <div className="grid grid-cols-1 gap-4">
                    <DatePickerField
                      label="Date"
                      value={booking.date}
                      onChange={(value) =>
                        setBooking({ ...booking, date: value })
                      }
                    />

                    <TimePickerField
                      label="Start"
                      value={booking.startTime}
                      onChange={(value) =>
                        setBooking({
                          ...booking,
                          startTime: value,
                        })
                      }
                    />

                    <DurationSelect
                      value={booking.duration}
                      onChange={(value) =>
                        setBooking({
                          ...booking,
                          duration: value,
                        })
                      }
                    />
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
          <div className="lg:col-span-8">
            <Card className="rounded-3xl bg-white/80 tablet-shadow border-0 h-full">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">
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

