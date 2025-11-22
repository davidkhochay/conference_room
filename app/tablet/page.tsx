'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, Users, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface Room {
  id: string;
  name: string;
  capacity: number;
  photo_url: string | null;
  location: {
    id: string;
    name: string;
  };
  status: string;
}

export default function TabletRoomSelector() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [deviceType, setDeviceType] = useState<'computer' | 'ipad' | 'tablet10' | 'tablet8'>('ipad');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms');
      const result = await response.json();
      
      if (result.success) {
        setRooms(result.data.filter((room: Room) => room.status === 'active'));
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const locations = Array.from(new Set(rooms.map(room => room.location.name)));
  const filteredRooms = selectedLocation === 'all' 
    ? rooms 
    : rooms.filter(room => room.location.name === selectedLocation);

  if (loading) {
    return (
      <div className="full-viewport bg-[#F7F3EC] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-gray-500 animate-spin mx-auto mb-4" />
          <div className="text-gray-700 text-xl font-medium">Loading rooms…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="full-viewport bg-[#F7F3EC]">
      {/* Header */}
      <div className="max-w-5xl mx-auto px-6 pt-12 pb-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-gray-400 mb-2">
              Tablet mode
            </p>
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-2">
              Choose a room for this tablet
            </h1>
            <p className="text-gray-600 text-sm md:text-base">
              Pick an active room. We’ll keep the wall display in sync with its status.
            </p>
          </div>
          <Link href="/">
            <button className="tablet-shadow px-4 py-2 rounded-full bg-white text-gray-800 text-sm font-medium hover:bg-gray-50">
              Home
            </button>
          </Link>
        </div>
      </div>

      {/* Device selector */}
      <div className="max-w-5xl mx-auto px-6 pb-4">
        <div className="inline-flex items-center gap-2 bg-white/80 rounded-full px-2 py-1 tablet-shadow">
          {[
            { id: 'computer', label: 'Computer' },
            { id: 'ipad', label: 'iPad' },
            { id: 'tablet10', label: 'Tablet 10\"' },
            { id: 'tablet8', label: 'Tablet 8\"' },
          ].map((device) => (
            <button
              key={device.id}
              type="button"
              onClick={() => setDeviceType(device.id as 'computer' | 'ipad' | 'amazon')}
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                deviceType === device.id ? 'bg-gray-900 text-white' : 'text-gray-700'
              }`}
            >
              {device.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location Filter */}
      {locations.length > 1 && (
        <div className="max-w-5xl mx-auto px-6 pb-4">
          <div className="flex flex-wrap gap-3">
            <button
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
                onClick={() => setSelectedLocation(location)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  selectedLocation === location
                    ? 'bg-gray-900 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                {location} ({rooms.filter((r) => r.location.name === location).length})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Room Grid */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        {filteredRooms.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-16 text-center shadow-2xl">
            <div className="text-gray-500 text-2xl">No active rooms available</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map(room => (
              <Link
                key={room.id}
                href={`/tablet/${room.id}?device=${deviceType}`}
                className="group"
              >
                <div className="bg-white rounded-3xl tablet-shadow overflow-hidden hover:translate-y-0.5 transition-transform">
                  {/* Room Photo */}
                  <div className="relative h-40 overflow-hidden">
                    {room.photo_url ? (
                      <img
                        src={room.photo_url}
                        alt={room.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                    
                    {/* Room Name Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <h3 className="text-3xl font-bold text-white drop-shadow-lg">
                        {room.name}
                      </h3>
                    </div>
                  </div>

                  {/* Room Details */}
                  <div className="p-5 space-y-3">
                    <div className="flex items-center text-gray-600 text-sm">
                      <MapPin className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="font-medium">{room.location.name}</span>
                    </div>

                    <div className="flex items-center text-gray-600 text-sm">
                      <Users className="w-4 h-4 mr-2 text-gray-500" />
                      <span className="font-medium">{room.capacity} people</span>
                    </div>

                    {/* Launch Button */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between rounded-full px-4 py-3 bg-gray-900 text-white text-sm font-medium">
                        <span>Use this room</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

