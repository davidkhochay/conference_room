'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { MapPin, Users, Clock } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase/client';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status?: string;
  title?: string;
  host_name?: string | null;
}

interface Room {
  id: string;
  name: string;
  capacity: number;
  photo_url: string | null;
  status: 'active' | 'maintenance' | 'disabled';
  location: {
    id: string;
    name: string;
  };
  features: Record<string, boolean>;
}

interface RoomWithAvailability extends Room {
  availability: {
    state: 'available' | 'busy' | 'starting_soon';
    isAvailableNow: boolean;
    availableUntil: string | null;
    currentBooking: Booking | null;
    nextBookingStart: string | null;
  };
}

export default function PublicBookingPage() {
  const [rooms, setRooms] = useState<RoomWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  // Realtime updates: refresh availability when any booking changes
  useEffect(() => {
    const channel = supabase
      .channel('public-booking-page-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          // Refresh room availability when any booking is created, updated, or deleted
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchData = async () => {
    try {
      const roomsRes = await fetch('/api/rooms');
      const roomsData = await roomsRes.json();

      if (roomsData.success) {
        const roomsWithAvailability = await Promise.all(
          roomsData.data.map(async (room: Room) => {
            const availability = await checkRoomAvailability(room.id);
            return { ...room, availability };
          })
        );
        setRooms(roomsWithAvailability);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkRoomAvailability = async (roomId: string) => {
    try {
      const response = await fetch(`/api/rooms/${roomId}/status`);
      const result = await response.json();

      if (response.ok && result.success && result.data) {
        const status = result.data;
        const next =
          status.next_bookings && status.next_bookings.length > 0
            ? status.next_bookings[0]
            : null;

        const uiState = (status.ui_state || (status.is_occupied ? 'busy' : 'free')) as
          | 'free'
          | 'checkin'
          | 'busy';

        let state: RoomWithAvailability['availability']['state'] = 'available';
        if (uiState === 'busy') {
          state = 'busy';
        } else if (uiState === 'checkin') {
          state = 'starting_soon';
        }

        const currentBooking: Booking | null =
          status.current_booking
            ? {
                id: status.current_booking.id,
                start_time: status.current_booking.start_time,
                end_time: status.current_booking.end_time,
                title: status.current_booking.title,
                host_name: status.current_booking.host_name,
              }
            : uiState === 'checkin' && next
            ? {
                id: next.id,
                start_time: next.start_time,
                end_time: next.end_time,
                title: next.title,
                host_name: next.host_name,
              }
            : null;

        return {
          state,
          isAvailableNow: uiState === 'free',
          availableUntil: uiState === 'free' ? status.available_until : null,
          currentBooking,
          nextBookingStart: next ? next.start_time : null,
        };
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
    }

    return {
      state: 'available',
      isAvailableNow: true,
      availableUntil: null,
      currentBooking: null,
      nextBookingStart: null,
    };
  };

  const locations = Array.from(new Set(rooms.map((room) => room.location.name)));
  const filteredRooms =
    selectedLocation === 'all'
      ? rooms
      : rooms.filter((room) => room.location.name === selectedLocation);

  return (
    <div className="min-h-screen bg-[#F7F3EC]">
      {/* Header (no Home button) */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-2">
              Booking
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
              Find a room
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Browse rooms across locations and see what’s free right now.
            </p>
          </div>
        </div>
      </div>

      {/* Location Filter */}
      {locations.length > 1 && (
        <div className="max-w-5xl mx-auto px-6 pb-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedLocation('all')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                selectedLocation === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              All locations ({rooms.length})
            </button>
            {locations.map((location) => (
              <button
                key={location}
                type="button"
                onClick={() => setSelectedLocation(location)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedLocation === location
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {location} (
                {rooms.filter((room) => room.location.name === location).length})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rooms */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        {loading ? (
          <Card>
            <div className="text-center py-10 text-gray-600 text-base">
              Loading rooms…
            </div>
          </Card>
        ) : rooms.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-gray-700 text-base">No rooms available</p>
            </div>
          </Card>
        ) : filteredRooms.length === 0 ? (
          <Card>
            <div className="text-center py-10">
              <p className="text-gray-700 text-base">
                No rooms in this location yet.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map((room) => {
              const isAvailable = room.availability.state === 'available';
              const isBusy = room.availability.state === 'busy';
              const isStartingSoon = room.availability.state === 'starting_soon';
              const isMaintenance = room.status === 'maintenance';

              const statusChipClasses = isMaintenance
                ? 'bg-[#FED7AA] text-[#9A3412]'
                : isAvailable
                ? 'bg-[#E6F9EE] text-[#166534]'
                : isBusy
                ? 'bg-[#FEE2E2] text-[#991B1B]'
                : 'bg-[#FEF3C7] text-[#92400E]';

              return (
                <Link
                  key={room.id}
                  href={`/book/room/${room.id}?from=public`}
                  className="group"
                >
                  <div className="bg-white rounded-3xl tablet-shadow overflow-hidden hover:translate-y-0.5 transition-transform">
                    {/* Photo */}
                    <div className="relative h-40 overflow-hidden">
                      {room.photo_url ? (
                        <img
                          src={room.photo_url}
                          alt={room.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-200" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />
                      
                      {/* Maintenance stripe overlay */}
                      {isMaintenance && (
                        <div className="absolute inset-0 pointer-events-none">
                          <svg className="w-full h-full" preserveAspectRatio="none">
                            <defs>
                              <pattern id={`maintenance-public-${room.id}`} patternUnits="userSpaceOnUse" width="40" height="40" patternTransform="rotate(45)">
                                <line x1="0" y1="0" x2="0" y2="40" stroke="#F97316" strokeWidth="8" opacity="0.3" />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill={`url(#maintenance-public-${room.id})`} />
                          </svg>
                        </div>
                      )}

                      <div className="absolute top-3 right-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusChipClasses}`}>
                          {isMaintenance
                            ? 'Maintenance'
                            : isAvailable
                            ? 'Available'
                            : isBusy
                            ? 'In use'
                            : 'Starting soon'}
                        </span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-gray-900 mb-1">
                            {room.name}
                          </h3>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {room.location.name}
                          </p>
                        </div>
                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gray-100 text-[11px] text-gray-700">
                          <Users className="w-3 h-3" />
                          <span>{room.capacity}</span>
                        </div>
                      </div>

                      {/* Booking info */}
                      {room.availability.currentBooking ? (
                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>
                            In use until{' '}
                            {format(
                              new Date(room.availability.currentBooking.end_time),
                              'h:mm a'
                            )}
                          </span>
                        </div>
                      ) : room.availability.nextBookingStart ? (
                        <div className="mt-1 flex items-center gap-1 text-xs text-gray-600">
                          <Clock className="w-3 h-3" />
                          <span>
                            Next at{' '}
                            {format(
                              new Date(room.availability.nextBookingStart),
                              'h:mm a'
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="mt-1 text-xs text-gray-500">
                          No upcoming bookings.
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


