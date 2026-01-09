'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Plus, Pencil, Trash2, QrCode, Users, Monitor } from 'lucide-react';
import Link from 'next/link';

interface Room {
  id: string;
  name: string;
  capacity: number;
  status: string;
  photo_url: string | null;
  location: {
    name: string;
  };
  features: Record<string, boolean>;
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Rooms | Good Life Rooms';
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      // Admin panel should show ALL rooms, including disabled ones
      const response = await fetch('/api/rooms?status=all');
      const result = await response.json();
      if (result.success) {
        setRooms(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!confirm('Are you sure you want to delete this room?')) return;

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setRooms(rooms.filter((r) => r.id !== roomId));
      }
    } catch (error) {
      console.error('Failed to delete room:', error);
    }
  };

  return (
    <div>
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rooms</h1>
          <p className="mt-2 text-gray-600">Manage conference rooms across all locations</p>
        </div>
        <Link href="/admin/rooms/new">
          <Button>
            <Plus className="w-4 h-4 mr-2 inline" />
            Add Room
          </Button>
        </Link>
      </div>

      {loading ? (
        <Card>
          <div className="text-center py-8 text-gray-600">Loading rooms...</div>
        </Card>
      ) : rooms.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-gray-600 mb-4">No rooms found</p>
            <Link href="/admin/rooms/new">
              <Button>
                <Plus className="w-4 h-4 mr-2 inline" />
                Add Your First Room
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-3xl tablet-shadow border border-gray-100 overflow-hidden hover:translate-y-0.5 transition-transform"
            >
              {/* Room Photo Background */}
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
                
                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full backdrop-blur-sm ${
                      room.status === 'active'
                        ? 'bg-green-500/90 text-white'
                        : room.status === 'maintenance'
                        ? 'bg-orange-500/90 text-white'
                        : 'bg-red-500/90 text-white'
                    }`}
                  >
                    {room.status}
                  </span>
                </div>

                {/* Room Details Overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="text-xl font-bold mb-1 drop-shadow-lg">{room.name}</h3>
                  <p className="text-sm text-white/90 drop-shadow-md flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    {room.location.name}
                  </p>
                </div>

                {/* Action buttons (bottom-right on image) */}
                <div className="absolute bottom-3 right-3 flex gap-2">
                  <Link
                    href={`/tablet/${room.id}?device=computer`}
                    target="_blank"
                    title="View Tablet Display"
                  >
                    <button className="w-10 h-10 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow-md hover:bg-white transition">
                      <Monitor className="w-4 h-4" />
                    </button>
                  </Link>
                  <Link
                    href={`/admin/rooms/${room.id}/qr`}
                    title="View QR Code"
                  >
                    <button className="w-10 h-10 rounded-full bg-white/90 text-gray-800 flex items-center justify-center shadow-md hover:bg-white transition">
                      <QrCode className="w-4 h-4" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Room Info Section */}
              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 flex items-center">
                    <Users className="w-4 h-4 mr-1 text-gray-500" />
                    <span className="font-medium text-gray-900">{room.capacity} people</span>
                  </p>
                  <span className="text-xs uppercase tracking-wide text-gray-400">
                    {room.status}
                  </span>
                </div>

                {/* Features (tv / whiteboard only) */}
                <div className="flex flex-wrap gap-2 min-h-[2rem]">
                  {room.features?.tv && (
                    <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-800 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-sm bg-gray-700" />
                      tv
                    </span>
                  )}
                  {room.features?.whiteboard && (
                    <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-800 flex items-center gap-1">
                      <span className="inline-block w-3 h-3 rounded-sm border border-gray-700" />
                      whiteboard
                    </span>
                  )}
                  {!room.features?.tv && !room.features?.whiteboard && (
                    <span className="text-xs text-gray-400 italic py-1">No features</span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 items-center">
                  <Link href={`/admin/rooms/${room.id}`} className="flex-1">
                    <Button variant="secondary" size="sm" className="w-full">
                      <Pencil className="w-3 h-3 mr-1 inline" />
                      Edit
                    </Button>
                  </Link>
                  <button
                    onClick={() => handleDelete(room.id)}
                    className="w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 flex items-center justify-center transition-colors border border-red-200"
                    title="Delete room"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

