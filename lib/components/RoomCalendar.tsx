'use client';

import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, addDays, subDays } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, User, Trash2, Calendar } from 'lucide-react';
import { Button } from './ui/Button';

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  host?: {
    name: string;
  };
}

interface RoomCalendarProps {
  roomId: string;
  roomName: string;
}

export function RoomCalendar({ roomId, roomName }: RoomCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  useEffect(() => {
    fetchBookings();
  }, [roomId, currentMonth]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

  // Mobile swipe handlers
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
      setSelectedDate(addDays(selectedDate, 1));
    }
    
    if (isRightSwipe) {
      setSelectedDate(subDays(selectedDate, 1));
    }
  };

  const goToPreviousDay = () => {
    setSelectedDate(subDays(selectedDate, 1));
  };

  const goToNextDay = () => {
    setSelectedDate(addDays(selectedDate, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
    setCurrentMonth(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getBookingsForDate = (date: Date) => {
    return bookings.filter(booking => {
      const bookingDate = new Date(booking.start_time);
      return isSameDay(bookingDate, date);
    });
  };

  const selectedDateBookings = getBookingsForDate(selectedDate);

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">
          {roomName} - Booking Calendar
        </h3>
        <p className="text-sm md:text-base text-gray-600">
          {isMobile ? 'Swipe to navigate days' : 'Click on a date to see all bookings'}
        </p>
      </div>

      {isMobile ? (
        /* Mobile Day View */
        <div
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Date Navigation Header */}
          <div className="mb-6 pb-4 border-b-2 border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={goToPreviousDay}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-gray-700" />
              </button>
              
              <div className="text-center flex-1">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <h2 className="text-lg font-bold text-gray-900">
                    {format(selectedDate, 'EEEE, MMM d, yyyy')}
                  </h2>
                </div>
                {!isToday(selectedDate) && (
                  <button
                    onClick={goToToday}
                    className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                  >
                    Jump to Today
                  </button>
                )}
              </div>

              <button
                onClick={goToNextDay}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-gray-700" />
              </button>
            </div>
          </div>

          {/* Day's Bookings */}
          <div>
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : selectedDateBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No bookings for this date
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateBookings.map(booking => (
                  <div
                    key={booking.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          {booking.title}
                        </h4>
                        
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <Clock className="w-4 h-4 mr-2" />
                          {format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}
                        </div>
                        
                        {booking.host && (
                          <div className="flex items-center text-sm text-gray-600">
                            <User className="w-4 h-4 mr-2" />
                            {booking.host.name}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            booking.status === 'confirmed' || booking.status === 'scheduled'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-600'
                              : booking.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {booking.status}
                        </span>
                        
                        {(booking.status === 'scheduled' || booking.status === 'confirmed') && (
                          <button
                            onClick={() => handleDeleteBooking(booking.id)}
                            disabled={deleting === booking.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            title="Cancel booking"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Desktop Month View */
        <>
          {/* Calendar Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            
            <h2 className="text-xl font-bold text-gray-900">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
                {day}
              </div>
            ))}
            
            {calendarDays.map((day, index) => {
              const dayBookings = getBookingsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const todayCheck = isToday(day);
              const isSelected = isSameDay(day, selectedDate);
              const hasBookings = dayBookings.length > 0;

              return (
                <button
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    relative min-h-[80px] p-2 rounded-lg border-2 transition-all
                    ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                    ${todayCheck ? 'border-blue-500' : 'border-gray-200'}
                    ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : ''}
                    ${!isCurrentMonth ? 'text-gray-400' : 'text-gray-900'}
                    hover:border-blue-300 hover:shadow-md
                  `}
                >
                  <div className="text-sm font-semibold mb-1">
                    {format(day, 'd')}
                  </div>
                  
                  {hasBookings && (
                    <div className="space-y-1">
                      {dayBookings.slice(0, 2).map(booking => (
                        <div
                          key={booking.id}
                          className={`text-xs p-1 rounded truncate ${
                            booking.status === 'confirmed' || booking.status === 'scheduled'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {format(new Date(booking.start_time), 'HH:mm')}
                        </div>
                      ))}
                      {dayBookings.length > 2 && (
                        <div className="text-xs text-gray-500 font-semibold">
                          +{dayBookings.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected Date Details */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Bookings for {format(selectedDate, 'MMMM d, yyyy')}
            </h3>
            
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading...</div>
            ) : selectedDateBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No bookings for this date
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateBookings.map(booking => (
                  <div
                    key={booking.id}
                    className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">
                          {booking.title}
                        </h4>
                        
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <Clock className="w-4 h-4 mr-2" />
                          {format(new Date(booking.start_time), 'h:mm a')} - {format(new Date(booking.end_time), 'h:mm a')}
                        </div>
                        
                        {booking.host && (
                          <div className="flex items-center text-sm text-gray-600">
                            <User className="w-4 h-4 mr-2" />
                            {booking.host.name}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${
                            booking.status === 'confirmed' || booking.status === 'scheduled'
                              ? 'bg-green-100 text-green-800'
                              : booking.status === 'cancelled'
                              ? 'bg-gray-100 text-gray-600'
                              : booking.status === 'completed'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {booking.status}
                        </span>
                        
                        {(booking.status === 'scheduled' || booking.status === 'confirmed') && (
                          <button
                            onClick={() => handleDeleteBooking(booking.id)}
                            disabled={deleting === booking.id}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                            title="Cancel booking"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
