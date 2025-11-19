'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { ImageUpload } from '@/lib/components/ImageUpload';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

interface Location {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  location_id: string;
  capacity: number;
  photo_url: string | null;
  allow_walk_up_booking: boolean;
  status: string;
  features: Record<string, boolean>;
}

export default function EditRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params?.roomId as string;

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    location_id: '',
    capacity: 8,
    photo_url: '',
    status: 'active',
    allow_walk_up_booking: true,
    features: {
      tv: false,
      whiteboard: false,
    },
  });

  useEffect(() => {
    fetchLocations();
    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  const fetchLocations = async () => {
    try {
      const response = await fetch('/api/admin/locations');
      const result = await response.json();
      if (result.success) {
        setLocations(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch locations:', error);
    }
  };

  const fetchRoom = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      const result = await response.json();
      
      if (result.success) {
        const room: Room = result.data;
        setFormData({
          name: room.name,
          location_id: room.location_id,
          capacity: room.capacity,
          photo_url: room.photo_url || '',
          status: room.status,
          allow_walk_up_booking: room.allow_walk_up_booking,
          features: {
            tv: room.features?.tv ?? false,
            whiteboard: room.features?.whiteboard ?? false,
          },
        });
      } else {
        setError('Room not found');
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
      setError('Failed to load room');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        router.push('/admin/rooms');
      } else {
        setError(result.error?.message || 'Failed to update room');
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [feature]: !prev.features[feature as keyof typeof prev.features],
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading room...</div>
      </div>
    );
  }

  if (error && !formData.name) {
    return (
      <div>
        <div className="mb-8">
          <Link href="/admin/rooms">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Rooms
            </Button>
          </Link>
        </div>
        <Card>
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Room Not Found</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link href="/admin/rooms">
              <Button>Back to Rooms</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/admin/rooms">
          <button className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium shadow-sm transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rooms
          </button>
        </Link>
      </div>

      <div className="max-w-5xl">
        <Card title="Edit Room">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Main fields in two columns on desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left column: name, location, features, capacity */}
              <div className="space-y-4">
                <Input
                  label="Room Name"
                  placeholder="e.g., Conference Room A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="font-medium"
                  required
                />

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location *
                  </label>
                  <select
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                    required
                  >
                    <option value="" className="text-gray-500">Select a location</option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id} className="text-gray-900">
                        {location.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Features</label>
                  <div className="grid grid-cols-1 gap-3">
                    <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.features.tv}
                        onChange={() => toggleFeature('tv')}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        TV / Screen Mirroring
                      </span>
                    </label>
                    <label className="flex items-center space-x-3 p-3 border border-gray-300 rounded-md hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.features.whiteboard}
                        onChange={() => toggleFeature('whiteboard')}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        Whiteboard
                      </span>
                    </label>
                  </div>
                </div>

                <Input
                  label="Capacity"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="font-medium"
                  required
                />
              </div>

              {/* Right column: status, photo, allow walk-up */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 font-medium"
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>

                <ImageUpload
                  label="Room Photo (optional)"
                  value={formData.photo_url}
                  onChange={(url) => setFormData({ ...formData, photo_url: url })}
                />

                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="walk_up"
                    checked={formData.allow_walk_up_booking}
                    onChange={(e) =>
                      setFormData({ ...formData, allow_walk_up_booking: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="walk_up" className="text-sm text-gray-700 cursor-pointer">
                    Allow walk-up bookings (tablet quick booking)
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={submitting} className="flex-1">
                {submitting ? 'Saving Changes...' : 'Save Changes'}
              </Button>
              <Link href="/admin/rooms" className="flex-1">
                <Button type="button" variant="secondary" className="w-full">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}

