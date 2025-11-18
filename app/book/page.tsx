'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Users, Clock, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface Booking {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
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
    isAvailableNow: boolean;
    availableUntil: string | null;
    currentBooking: Booking | null;
  };
}

export default function BookingPage() {
  const [rooms, setRooms] = useState<RoomWithAvailability[]>([]);
  const [loading, setLoading] = useState(true);

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
      const now = new Date();
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const response = await fetch(
        `/api/bookings?room_id=${roomId}&start_date=${now.toISOString()}&end_date=${endOfDay.toISOString()}`
      );
      
      const result = await response.json();
      
      if (result.success) {
        const activeBookings = result.data
          .filter((b: Booking) => b.status === 'scheduled' || b.status === 'confirmed')
          .sort((a: Booking, b: Booking) => 
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );

        // Check if room is currently booked
        const currentBooking = activeBookings.find((b: Booking) => {
          const start = new Date(b.start_time);
          const end = new Date(b.end_time);
          return now >= start && now < end;
        });

        if (currentBooking) {
          return {
            isAvailableNow: false,
            availableUntil: null,
            currentBooking,
          };
        }

        // Find next booking
        const nextBooking = activeBookings.find((b: Booking) => 
          new Date(b.start_time) > now
        );

        return {
          isAvailableNow: true,
          availableUntil: nextBooking ? nextBooking.start_time : null,
          currentBooking: null,
        };
      }
    } catch (error) {
      console.error('Failed to check availability:', error);
    }

    return {
      isAvailableNow: true,
      availableUntil: null,
      currentBooking: null,
    };
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-2xl font-bold text-gray-900">Book a Room</h1>
            <Link href="/">
              <Button variant="secondary" size="sm">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900">Book Your Room</h2>
          <p className="mt-2 text-gray-600">Browse available conference rooms across all locations</p>
        </div>

        {/* Rooms Grid */}
        {loading ? (
          <Card>
            <div className="text-center py-8 text-gray-600">Loading rooms...</div>
          </Card>
        ) : rooms.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-gray-600">No rooms available</p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <div key={room.id} className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="relative h-48 overflow-hidden">
                  {room.photo_url ? (
                    <img
                      src={room.photo_url}
                      alt={room.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500" />
                  )}
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                  
                  {/* Room Name Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="text-2xl font-bold drop-shadow-lg">{room.name}</h3>
                    <p className="text-white/90 drop-shadow-md">{room.location.name}</p>
                  </div>
                </div>

                <div className="p-6">
                  <div className="space-y-3">
                    {/* Availability Status */}
                    <div className={`flex items-center font-semibold text-sm ${
                      room.availability.isAvailableNow ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {room.availability.isAvailableNow ? (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          <span>
                            Available now
                            {room.availability.availableUntil && (
                              <span className="text-gray-600 font-normal">
                                {' '}until {format(new Date(room.availability.availableUntil), 'h:mm a')}
                              </span>
                            )}
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 mr-2" />
                          <span>
                            Busy
                            {room.availability.currentBooking && (
                              <span className="text-gray-600 font-normal">
                                {' '}until {format(new Date(room.availability.currentBooking.end_time), 'h:mm a')}
                              </span>
                            )}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center text-gray-600">
                      <Users className="w-5 h-5 mr-2" />
                      <span>Capacity: {room.capacity} people</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {Object.entries(room.features || {})
                        .filter(([, enabled]) => enabled)
                        .slice(0, 3)
                        .map(([feature]) => (
                          <span
                            key={feature}
                            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                          >
                            {feature}
                          </span>
                        ))}
                      {Object.entries(room.features || {}).filter(([, enabled]) => enabled).length > 3 && (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          +{Object.entries(room.features || {}).filter(([, enabled]) => enabled).length - 3}
                        </span>
                      )}
                    </div>

                    <Link href={`/book/room/${room.id}`} className="block mt-4">
                      <Button className="w-full">
                        <Clock className="w-4 h-4 mr-2 inline" />
                        Book This Room
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

