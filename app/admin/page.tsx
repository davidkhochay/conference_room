'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Building2, MapPin, DoorOpen, Users, Calendar, Clock } from 'lucide-react';

interface Booking {
  id: string;
  title: string;
  start_time: string;
  status: string;
  room: {
    name: string;
  } | null;
  host: {
    name: string;
  } | null;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    companies: 0,
    locations: 0,
    rooms: 0,
    users: 0,
    bookings: 0,
  });
  const [recentBookings, setRecentBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    fetchRecentBookings();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchRecentBookings = async () => {
    try {
      const response = await fetch('/api/admin/recent-bookings');
      const result = await response.json();
      if (result.success) {
        setRecentBookings(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch recent bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const statCards = [
    {
      name: 'Companies',
      value: stats.companies,
      icon: Building2,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Locations',
      value: stats.locations,
      icon: MapPin,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      name: 'Rooms',
      value: stats.rooms,
      icon: DoorOpen,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Users',
      value: stats.users,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
    {
      name: 'Total Bookings',
      value: stats.bookings,
      icon: Calendar,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Overview of your Good Life Group conference room booking platform
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} className="hover:shadow-lg transition-shadow">
              <div className="flex items-center">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-8">
        <Card title="Recent Bookings">
          {loading ? (
            <div className="text-gray-600 py-4">Loading...</div>
          ) : recentBookings.length === 0 ? (
            <div className="text-gray-600 py-4">No bookings yet</div>
          ) : (
            <div className="space-y-3">
              {recentBookings.map((booking) => (
                <div key={booking.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">{booking.title}</h4>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        booking.status === 'confirmed' || booking.status === 'scheduled'
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'cancelled'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      {booking.room && (
                        <span className="flex items-center">
                          <DoorOpen className="w-4 h-4 mr-1" />
                          {booking.room.name}
                        </span>
                      )}
                      {booking.host && (
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {booking.host.name}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      {formatDateTime(booking.start_time)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

