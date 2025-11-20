'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

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

export default function BookingPage() {
  const [rooms, setRooms] = useState<RoomWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const roomsRes = await fetch('/api/rooms');
      const roomsData = await roomsRes.json();

      if (roomsData.success) {
        // Fetch availability for each room
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

        // Use unified ui_state from the status API so cards, tablets, and maps agree
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
      {/* Header */}
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
              <Link href="/">
            <button className="tablet-shadow px-4 py-2 rounded-full bg-white text-gray-800 text-sm font-medium hover:bg-gray-50 flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
                  Home
            </button>
              </Link>
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

              const statusChipClasses = isAvailable
                ? 'bg-[#E6F9EE] text-[#166534]'
                : isBusy
                ? 'bg-[#FEE2E2] text-[#991B1B]'
                : 'bg-[#FEF3C7] text-[#92400E]';

              return (
                <Link
                  key={room.id}
                  href={`/book/room/${room.id}`}
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
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  
                      {/* Name + status */}
                      <div className="absolute bottom-0 left-0 right-0 p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-2xl font-semibold text-white drop-shadow-lg">
                            {room.name}
                          </h3>
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium tablet-shadow ${statusChipClasses}`}
                          >
                            {isAvailable && (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                <span>Available</span>
                              </>
                            )}
                            {isBusy && (
                              <>
                                <XCircle className="w-4 h-4" />
                                <span>In use</span>
                              </>
                            )}
                            {isStartingSoon && (
                              <>
                                <Clock className="w-4 h-4" />
                                <span>Starting soon</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="flex items-center text-white/90 text-xs">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span className="font-medium">
                            {room.location.name}
                          </span>
                        </div>
                  </div>
                </div>

                    {/* Details */}
                    <div className="p-5 space-y-3">
                      <div className="flex items-center text-gray-700 text-sm">
                        <Users className="w-4 h-4 mr-2 text-gray-500" />
                        <span className="font-medium">
                          {room.capacity} people
                        </span>
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
                      </div>

                      {/* Availability snippet */}
                      <div className="mt-2 text-xs text-gray-600 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {isAvailable && room.availability.availableUntil && (
                          <span>
                            Free until{' '}
                            {format(
                              new Date(room.availability.availableUntil),
                              'h:mm a'
                            )}
                          </span>
                      )}
                        {isBusy &&
                          room.availability.currentBooking &&
                          room.availability.currentBooking.end_time && (
                          <span>
                              Busy until{' '}
                              {format(
                                new Date(
                                  room.availability.currentBooking.end_time
                                ),
                                'h:mm a'
                              )}
                            </span>
                      )}
                        {isStartingSoon &&
                          room.availability.currentBooking &&
                          room.availability.currentBooking.start_time && (
                            <span>
                              Starts at{' '}
                              {format(
                                new Date(
                                  room.availability.currentBooking.start_time
                                ),
                                'h:mm a'
                              )}
                            </span>
                          )}
                        {!room.availability.availableUntil &&
                          !room.availability.currentBooking && (
                            <span>See details</span>
                        )}
                    </div>

                      {/* CTA */}
                      <div className="pt-3">
                        <div className="flex items-center justify-between rounded-full px-4 py-3 bg-gray-900 text-white text-sm font-medium">
                          <span>Book this room</span>
                          <Clock className="w-4 h-4" />
                        </div>
                    </div>
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

