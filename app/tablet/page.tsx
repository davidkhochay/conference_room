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
      <div className="min-h-screen bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-16 h-16 text-white animate-spin mx-auto mb-4" />
          <div className="text-white text-2xl font-semibold">Loading rooms...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-md border-b border-white/20 p-8 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-3">
            Tablet Display Setup
          </h1>
          <p className="text-white/90 text-2xl">
            Select a room to display on this tablet
          </p>
        </div>
      </div>

      {/* Location Filter */}
      {locations.length > 1 && (
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-4 overflow-x-auto">
              <button
                onClick={() => setSelectedLocation('all')}
                className={`px-6 py-3 rounded-xl font-semibold text-lg transition-all whitespace-nowrap ${
                  selectedLocation === 'all'
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                All Locations ({rooms.length})
              </button>
              {locations.map(location => (
                <button
                  key={location}
                  onClick={() => setSelectedLocation(location)}
                  className={`px-6 py-3 rounded-xl font-semibold text-lg transition-all whitespace-nowrap ${
                    selectedLocation === location
                      ? 'bg-blue-600 text-white shadow-lg scale-105'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {location} ({rooms.filter(r => r.location.name === location).length})
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Room Grid */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        {filteredRooms.length === 0 ? (
          <div className="bg-white/95 backdrop-blur-sm rounded-3xl p-16 text-center shadow-2xl">
            <div className="text-gray-500 text-2xl">No active rooms available</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredRooms.map(room => (
              <Link
                key={room.id}
                href={`/tablet/${room.id}`}
                className="group"
              >
                <div className="bg-white/98 backdrop-blur-sm rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transition-all transform hover:scale-105 active:scale-100 border-4 border-white/50">
                  {/* Room Photo */}
                  <div className="relative h-48 overflow-hidden">
                    {room.photo_url ? (
                      <img
                        src={room.photo_url}
                        alt={room.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500" />
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
                  <div className="p-6 space-y-4">
                    <div className="flex items-center text-gray-600 text-lg">
                      <MapPin className="w-5 h-5 mr-3 text-blue-600" />
                      <span className="font-medium">{room.location.name}</span>
                    </div>

                    <div className="flex items-center text-gray-600 text-lg">
                      <Users className="w-5 h-5 mr-3 text-blue-600" />
                      <span className="font-medium">Capacity: {room.capacity} people</span>
                    </div>

                    {/* Launch Button */}
                    <div className="pt-4">
                      <div className="flex items-center justify-between bg-blue-600 text-white rounded-2xl px-6 py-4 group-hover:bg-blue-700 transition-colors">
                        <span className="text-xl font-bold">Display This Room</span>
                        <ArrowRight className="w-6 h-6 group-hover:translate-x-2 transition-transform" />
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer Help Text */}
      <div className="max-w-7xl mx-auto px-8 pb-8">
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl text-center">
          <p className="text-gray-700 text-lg">
            💡 <strong>Tip:</strong> Once you select a room, bookmark the page or set it as your tablet's home screen for easy access
          </p>
        </div>
      </div>
    </div>
  );
}

