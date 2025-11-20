'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Building2, MapPin, DoorOpen, Users, Calendar, Clock } from 'lucide-react';

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  room: {
    name: string;
  } | null;
  host: {
    name: string;
  } | null;
}

function BookingColumn({
  title,
  bookings,
  renderRow,
}: {
  title: string;
  bookings: Booking[];
  renderRow: (booking: Booking) => React.ReactNode;
}) {
  const visible = bookings.slice(0, 10);

  let titleColor = 'text-gray-800';
  let laneAccent = 'border-t-4 border-t-gray-200';

  if (title === 'In use') {
    titleColor = 'text-rose-600';
    laneAccent = 'border-t-4 border-t-rose-300';
  } else if (title === 'Upcoming') {
    titleColor = 'text-amber-600';
    laneAccent = 'border-t-4 border-t-amber-300';
  } else if (title === 'Completed / cancelled') {
    titleColor = 'text-emerald-600';
    laneAccent = 'border-t-4 border-t-emerald-300';
  }

  return (
    <div>
      <h3 className={`text-sm font-semibold mb-3 ${titleColor}`}>{title}</h3>
      {visible.length === 0 ? (
        <div
          className={`text-xs text-gray-500 bg-white rounded-2xl px-3 py-3 shadow-sm border border-gray-200 ${laneAccent}`}
        >
          None
        </div>
      ) : (
        <div
          className={`bg-white rounded-2xl px-3 py-3 shadow-sm border border-gray-200 ${laneAccent}`}
        >
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {visible.map((b) => renderRow(b))}
          </div>
        </div>
      )}
    </div>
  );
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

  const getStatusStyles = (booking: Booking) => {
    const normalized = booking.status.toLowerCase();

    // Hard cancel states
    if (normalized === 'no_show') {
      return {
        label: 'no show',
        classes: 'bg-amber-50 text-amber-700 border border-amber-200',
      };
    }

    if (normalized === 'cancelled') {
      return {
        label: 'cancelled',
        classes: 'bg-rose-50 text-rose-700 border border-rose-200',
      };
    }

    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const now = new Date();

    if (end < now || normalized === 'ended' || normalized === 'completed') {
      return {
        label: 'completed',
        classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      };
    }

    if (start <= now && now < end || normalized === 'in_progress') {
      return {
        label: 'in use',
        classes: 'bg-rose-50 text-rose-700 border border-rose-200',
      };
    }

    // Default: upcoming
    return {
      label: 'upcoming',
      classes: 'bg-amber-50 text-amber-700 border border-amber-200',
    };
  };

  const getStatusBucket = (booking: Booking): 'in_use' | 'upcoming' | 'completed_cancelled' => {
    const normalized = booking.status.toLowerCase();

    if (normalized === 'no_show' || normalized === 'cancelled') {
      return 'completed_cancelled';
    }

    const start = new Date(booking.start_time);
    const end = new Date(booking.end_time);
    const now = new Date();

    if (end < now || normalized === 'ended' || normalized === 'completed') {
      return 'completed_cancelled';
    }

    if (start <= now && now < end || normalized === 'in_progress') {
      return 'in_use';
    }

    return 'upcoming';
  };

  const renderBookingRow = (booking: Booking) => {
    const { label, classes } = getStatusStyles(booking);

    return (
      <div
        key={booking.id}
        className="p-4 rounded-2xl bg-white hover:bg-gray-50 shadow-sm border border-gray-100 transition-colors"
      >
        {/* Title + status pill */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h4 className="font-semibold text-gray-900 text-sm md:text-base flex-1">
            {booking.title}
          </h4>
          <span
            className={`px-3 py-1 text-[11px] font-semibold rounded-full whitespace-nowrap ${classes}`}
          >
            {label}
          </span>
        </div>

        {/* Details row */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
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

      {/* Recent bookings - kanban-style by status */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent bookings
          </h2>
        </div>
        {loading ? (
          <div className="text-gray-600 py-4">Loading...</div>
        ) : recentBookings.length === 0 ? (
          <div className="text-gray-600 py-4">No bookings yet</div>
        ) : (() => {
          const inUse: Booking[] = [];
          const upcoming: Booking[] = [];
          const completedCancelled: Booking[] = [];

          recentBookings.forEach((booking) => {
            const bucket = getStatusBucket(booking);
            if (bucket === 'in_use') inUse.push(booking);
            else if (bucket === 'upcoming') upcoming.push(booking);
            else completedCancelled.push(booking);
          });

          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <BookingColumn
                title="In use"
                bookings={inUse}
                renderRow={renderBookingRow}
              />
              <BookingColumn
                title="Upcoming"
                bookings={upcoming}
                renderRow={renderBookingRow}
              />
              <BookingColumn
                title="Completed / cancelled"
                bookings={completedCancelled}
                renderRow={renderBookingRow}
              />
            </div>
          );
        })()}
      </section>
    </div>
  );
}

