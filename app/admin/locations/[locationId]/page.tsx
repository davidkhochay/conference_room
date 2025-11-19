'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { ArrowLeft, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import FloorPlanEditor from '@/lib/components/admin/FloorPlanEditor';
import { Floor, Room } from '@/lib/types/database.types';

interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
}

export default function EditLocationPage() {
  const params = useParams();
  const router = useRouter();
  const locationId = params?.locationId as string;

  const [activeTab, setActiveTab] = useState<'details' | 'floorplan'>('details');
  const [location, setLocation] = useState<Location | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    timezone: 'America/Phoenix',
  });

  useEffect(() => {
    const load = async () => {
      try {
        console.log('Loading location data for:', locationId);
        
        // Load Location
        const res = await fetch(`/api/admin/locations/${locationId}`);
        const result = await res.json();
        console.log('Location result:', result);
        
        if (result.success) {
          setLocation(result.data);
          setFormData({
            name: result.data.name || '',
            address: result.data.address || '',
            timezone: result.data.timezone || 'America/Phoenix',
          });
        } else {
          setError(result.error?.message || 'Location not found');
          return;
        }

        // Load Floors
        const floorsRes = await fetch(`/api/admin/locations/${locationId}/floors`);
        const floorsData = await floorsRes.json();
        console.log('Floors result:', floorsData);
        if (floorsData.success) setFloors(floorsData.data);

        // Load Rooms
        const roomsRes = await fetch(`/api/rooms?location_id=${locationId}`);
        const roomsData = await roomsRes.json();
        console.log('Rooms result:', roomsData);
        if (roomsData.success) setRooms(roomsData.data);

      } catch (err: any) {
        console.error('Load error:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    if (locationId) load();
  }, [locationId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/locations/${locationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const result = await res.json();
      if (result.success) {
        // Stay on page or go back? Usually stay to edit more.
        alert('Location updated');
      } else {
        setError(result.error?.message || 'Failed to update location');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update location');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this location? Rooms under it will also be affected.')) return;
    try {
      const res = await fetch(`/api/admin/locations/${locationId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/admin/locations');
      }
    } catch (err) {
      console.error('Failed to delete location', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading location...</div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <div className="text-center py-8 px-8">
            <p className="text-gray-600 mb-4">{error || 'Location not found'}</p>
            <Link href="/admin/locations">
              <Button>Back to Locations</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <Link href="/admin/locations">
          <button className="inline-flex items-center px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium shadow-sm transition-all">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Locations
          </button>
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{location.name}</h1>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('details')}
            className={`${
              activeTab === 'details'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab('floorplan')}
            className={`${
              activeTab === 'floorplan'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
          >
            Floor Plan
          </button>
        </nav>
      </div>

      {activeTab === 'details' ? (
      <Card title="Edit Location">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <Input
            label="Location Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Input
            label="Address"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
            >
              <option value="America/Phoenix">America/Phoenix (MST)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              <option value="America/Denver">America/Denver (MST)</option>
              <option value="America/Chicago">America/Chicago (CST)</option>
              <option value="America/New_York">America/New_York (EST)</option>
            </select>
          </div>

          <div className="flex justify-between pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Delete
            </Button>
          </div>
        </form>
      </Card>
      ) : (
        <FloorPlanEditor
          locationId={locationId}
          initialFloors={floors}
          initialRooms={rooms}
        />
      )}
    </div>
  );
}
