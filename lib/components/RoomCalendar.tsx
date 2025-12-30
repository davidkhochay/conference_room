"use client";

import { useState, useEffect } from "react";
import {
  format,
  isSameDay,
  addDays,
  subDays,
  isToday,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, Clock, User, Trash2, Calendar } from "lucide-react";
import { normalizeBookingStatus } from "@/lib/utils/bookingStatus";

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  google_event_id?: string | null;
  google_calendar_id?: string | null;
  external_source?: string | null;
  host?: {
    name: string;
  };
}

interface RoomCalendarProps {
  roomId: string;
  roomName: string;
  embedded?: boolean;
  initialDate?: string; // yyyy-MM-dd format from parent
  onSlotSelect?: (slot: { date: string; startTime: string; durationMinutes?: number }) => void;
}

export function RoomCalendar({ roomId, roomName, embedded = false, initialDate, onSlotSelect }: RoomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Sync selectedDate with parent's initialDate prop
  useEffect(() => {
    if (initialDate) {
      // Parse yyyy-MM-dd as local date (not UTC)
      const [year, month, day] = initialDate.split('-').map(Number);
      const newDate = new Date(year, month - 1, day);
      setSelectedDate(newDate);
      setCurrentMonth(newDate);
    }
  }, [initialDate]);

  useEffect(() => {
    fetchBookings();
  }, [roomId, currentMonth]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const start = startOfMonth(currentMonth).toISOString();
      const end = endOfMonth(currentMonth).toISOString();
      
      const response = await fetch(
        `/api/bookings?room_id=${roomId}&start_date=${start}&end_date=${end}`
      );
      
      if (response.ok) {
        const result = await response.json();
        setBookings(result.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) {
      return;
    }

    setDeleting(bookingId);
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
      });

      if (response.ok) {
        await fetchBookings();
      } else {
        alert('Failed to cancel booking');
      }
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      alert('Failed to cancel booking');
    } finally {
      setDeleting(null);
    }
  };

  const goToPreviousDay = () => {
    const prev = subDays(selectedDate, 1);
    setSelectedDate(prev);
    setCurrentMonth(prev);
  };

  const goToNextDay = () => {
    const next = addDays(selectedDate, 1);
    setSelectedDate(next);
    setCurrentMonth(next);
  };

  const goToToday = () => {
    const today = new Date();
    setSelectedDate(today);
    setCurrentMonth(today);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(booking => {
      // Parse the ISO string and compare in local timezone
      const bookingDate = new Date(booking.start_time);
      // Compare year, month, and day in local timezone to avoid UTC offset issues
      return (
        bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate()
      );
    });
  };

  const selectedDateBookings = getBookingsForDate(selectedDate).sort(
    (a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
  );

  const handleAddForDay = () => {
    if (!onSlotSelect) return;

    const baseDate = new Date(selectedDate);
    const now = new Date();
    const start = isToday(selectedDate) ? now : new Date(baseDate);

    start.setSeconds(0);
    start.setMilliseconds(0);

    const minutes = start.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    if (roundedMinutes === 60) {
      start.setHours(start.getHours() + 1, 0, 0, 0);
    } else {
      start.setMinutes(roundedMinutes, 0, 0);
    }

    const date = format(start, 'yyyy-MM-dd');
    const startTime = format(start, 'HH:mm');

    onSlotSelect({ date, startTime, durationMinutes: 60 });
  };
  return (
    <div
      className={
        embedded
          ? ''
          : 'bg-white rounded-lg shadow-md border border-gray-200 p-4 md:p-6'
      }
    >
      {!embedded && (
      <div className="mb-4 md:mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          {roomName} - Booking Calendar
        </h3>
        <p className="text-sm md:text-base text-gray-600">
            See all bookings for this day and add a new one.
        </p>
      </div>
      )}

      {/* Date navigation */}
      <div className="mb-4 pb-3 border-b border-gray-200 flex items-center justify-between gap-3">
              <button
                onClick={goToPreviousDay}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
          <ChevronLeft className="w-5 h-5 text-gray-700" />
              </button>
              
        <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-2 mb-1">
            <Calendar className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm md:text-base font-semibold text-gray-900">
                    {format(selectedDate, 'EEEE, MMM d, yyyy')}
                  </h2>
                </div>
                {!isToday(selectedDate) && (
                  <button
                    onClick={goToToday}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
              Jump to today
                  </button>
                )}
              </div>

        <div className="flex items-center gap-2">
          {onSlotSelect && !embedded && (
            <button
              type="button"
              onClick={handleAddForDay}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-gray-900 text-white hover:bg-black"
            >
              New booking
            </button>
          )}
              <button
                onClick={goToNextDay}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
            <ChevronRight className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>

      {/* Day events */}
            {loading ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          Loading…
        </div>
            ) : selectedDateBookings.length === 0 ? (
        <div className="text-center py-8 text-xs text-gray-500">
          No bookings for this date.
        </div>
        ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {selectedDateBookings.map((booking) => {
            const start = new Date(booking.start_time);
            const end = new Date(booking.end_time);
            const now = new Date();
            const normalized = normalizeBookingStatus(booking, now);

            let statusLabel:
              | "in use"
              | "upcoming"
              | "completed"
              | "cancelled"
              | "no show" = "upcoming";
            let chipClasses =
              "bg-blue-100 text-blue-800 border border-blue-200";

            if (normalized === "no_show") {
              statusLabel = "no show";
              chipClasses =
                "bg-amber-50 text-amber-700 border border-amber-200";
            } else if (normalized === "cancelled") {
              statusLabel = "cancelled";
              chipClasses =
                "bg-gray-100 text-gray-600 border border-gray-200";
            } else if (normalized === "completed") {
              statusLabel = "completed";
              chipClasses =
                "bg-gray-100 text-gray-600 border border-gray-200";
            } else if (normalized === "in_use") {
              statusLabel = "in use";
              chipClasses =
                "bg-green-100 text-green-800 border border-green-200";
            } else {
              statusLabel = "upcoming";
              chipClasses =
                "bg-blue-100 text-blue-800 border border-blue-200";
            }

            const isGoogleImported = booking.external_source === 'google_ui';
            const canCancelInApp =
              !isGoogleImported &&
              (booking.status === 'scheduled' ||
                (booking.status as string) === 'confirmed');

              return (
              <div
                key={booking.id}
                className="w-full rounded-xl px-3 py-2 border bg-gray-50 flex items-start justify-between gap-3"
              >
                <div className="flex-1">
                  <div className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>
                      {format(start, 'h:mm a')} – {format(end, 'h:mm a')}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-gray-900">
                    {booking.title}
                  </div>
                  {isGoogleImported && (
                    <div className="mt-0.5 text-[10px] uppercase tracking-wide text-blue-600">
                      From Google Calendar
                    </div>
                  )}
                  {booking.host && (
                    <div className="mt-0.5 flex items-center text-[11px] text-gray-600">
                      <User className="w-3 h-3 mr-1" />
                      <span>{booking.host.name}</span>
                    </div>
                  )}
          </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${chipClasses}`}
                        >
                    {statusLabel}
                        </span>
                  {canCancelInApp && (
                          <button
                            onClick={() => handleDeleteBooking(booking.id)}
                            disabled={deleting === booking.id}
                      className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            title="Cancel booking"
                          >
                      <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
              </div>
            );
          })}
          </div>
      )}
    </div>
  );
}
