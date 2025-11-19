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

  const getStatusStyles = (status: string) => {
    const now = new Date();
    const normalized = status.toLowerCase();

    if (normalized === 'in_progress') {
      return { label: 'in use', classes: 'bg-green-100 text-green-800' };
    }

    if (normalized === 'scheduled') {
      return { label: 'upcoming', classes: 'bg-blue-100 text-blue-800' };
    }

    if (normalized === 'ended' || normalized === 'completed') {
      return { label: 'completed', classes: 'bg-gray-100 text-gray-600' };
    }

    if (normalized === 'cancelled') {
      return { label: 'cancelled', classes: 'bg-red-100 text-red-700' };
    }

    return { label: normalized, classes: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="space-y-10">
    <div>
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Admin dashboard</h1>
        <p className="mt-2 text-gray-600 max-w-2xl">
          Get a quick view of how your rooms, locations, and teams are being used today.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.name} className="rounded-3xl bg-white tablet-shadow hover:translate-y-0.5 transition-transform">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card title="Recent bookings">
          {loading ? (
            <div className="text-gray-600 py-4">Loading...</div>
          ) : recentBookings.length === 0 ? (
            <div className="text-gray-600 py-4">No bookings yet</div>
          ) : (
            <div className="space-y-3">
            {recentBookings.map((booking) => {
              const { label, classes } = getStatusStyles(booking.status);

              return (
                <div
                  key={booking.id}
                  className="p-4 rounded-2xl bg-white/80 hover:bg-white tablet-shadow transition-colors"
                >
                  {/* Title + status pill */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900 text-base md:text-lg flex-1">
                      {booking.title}
                    </h4>
                    <span
                      className={`px-3 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap ${classes}`}
                    >
                      {label}
                    </span>
                  </div>
                  
                  {/* Details row */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                    {booking.room && (
                      <span className="flex items-center">
                        <DoorOpen className="w-4 h-4 mr-1.5" />
                        {booking.room.name}
                      </span>
                    )}
                    {booking.host && (
                      <span className="flex items-center">
                        <Users className="w-4 h-4 mr-1.5" />
                        {booking.host.name}
                      </span>
                    )}
                    <span className="flex items-center">
                      <Clock className="w-4 h-4 mr-1.5" />
                      {formatDateTime(booking.start_time)}
                    </span>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </Card>
    </div>
  );
}

