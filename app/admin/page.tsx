'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/lib/components/ui/Card';
import { Building2, MapPin, DoorOpen, Users, Calendar, Clock } from 'lucide-react';
import { bucketBookings, normalizeBookingStatus } from '@/lib/utils/bookingStatus';
import { BookingDetailsModal } from '@/lib/components/admin/BookingDetailsModal';
import { supabase } from '@/lib/supabase/client';

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  attendee_emails?: string[];
  attendee_response_statuses?: Record<string, string> | null;
  room: {
    name: string;
  } | null;
  host: {
    name: string;
  } | null;
}

interface RoomWithFloor {
  id: string;
  name: string;
  photo_url: string | null;
  floor_id: string | null;
  floor?: {
    id: string;
    name: string;
  } | null;
}

interface RoomStatus {
  roomId: string;
  uiState: 'free' | 'checkin' | 'busy';
}

// Room Status Card Component
function RoomStatusCard({
  room,
  status,
}: {
  room: RoomWithFloor;
  status: RoomStatus | undefined;
}) {
  const uiState = status?.uiState || 'free';
  
  const getStatusConfig = () => {
    switch (uiState) {
      case 'busy':
        return {
          label: 'In Use',
          bgColor: 'bg-rose-500',
          textColor: 'text-white',
        };
      case 'checkin':
        return {
          label: 'Check-in',
          bgColor: 'bg-amber-500',
          textColor: 'text-white',
        };
      case 'free':
      default:
        return {
          label: 'Available',
          bgColor: 'bg-emerald-500',
          textColor: 'text-white',
        };
    }
  };

  const { label, bgColor, textColor } = getStatusConfig();

  return (
    <div
      className="relative h-32 rounded-2xl overflow-hidden shadow-md group cursor-pointer transition-transform hover:scale-[1.02]"
    >
      {/* Background image with dark overlay */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: room.photo_url
            ? `url(${room.photo_url})`
            : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
        }}
      />
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />
      
      {/* Content */}
      <div className="relative h-full flex flex-col justify-between p-4">
        {/* Room name */}
        <h3 className="text-white font-semibold text-lg drop-shadow-md">
          {room.name}
        </h3>
        
        {/* Status badge */}
        <div className="flex justify-end">
          <span
            className={`px-3 py-1.5 rounded-full text-xs font-bold ${bgColor} ${textColor} shadow-lg`}
          >
            {label}
          </span>
        </div>
      </div>
    </div>
  );
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
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  
  // Room status state
  const [floor2Rooms, setFloor2Rooms] = useState<RoomWithFloor[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, RoomStatus>>({});
  const [roomsLoading, setRoomsLoading] = useState(true);

  // Fetch Floor 2 rooms and their statuses
  const fetchFloor2RoomsAndStatuses = async () => {
    try {
      // First get all rooms
      const roomsRes = await fetch('/api/rooms?status=all');
      const roomsData = await roomsRes.json();
      
      if (roomsData.success) {
        // Get floor data for each room to find Floor 2 rooms
        const roomsWithFloors: RoomWithFloor[] = [];
        
        for (const room of roomsData.data) {
          if (room.floor_id) {
            // Get floor info
            const floorRes = await fetch(`/api/admin/locations/${room.location_id}/floors/${room.floor_id}`);
            const floorData = await floorRes.json();
            
            if (floorData.success && floorData.data.name === 'Floor 2') {
              roomsWithFloors.push({
                ...room,
                floor: floorData.data,
              });
            }
          }
        }
        
        setFloor2Rooms(roomsWithFloors);
        
        // Fetch status for each Floor 2 room
        if (roomsWithFloors.length > 0) {
          const statusPromises = roomsWithFloors.map((r) =>
            fetch(`/api/rooms/${r.id}/status`).then((res) => res.json())
          );
          const statuses = await Promise.all(statusPromises);
          
          const statusMap: Record<string, RoomStatus> = {};
          statuses.forEach((s: any) => {
            if (s.success) {
              statusMap[s.data.room_id] = {
                roomId: s.data.room_id,
                uiState: s.data.ui_state || 'free',
              };
            }
          });
          setRoomStatuses(statusMap);
        }
      }
    } catch (error) {
      console.error('Failed to fetch Floor 2 rooms:', error);
    } finally {
      setRoomsLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Admin Dashboard | Good Life Rooms';
    fetchStats();
    fetchRecentBookings();
    fetchFloor2RoomsAndStatuses();
  }, []);

  // Realtime updates: refresh bookings and room statuses when any booking changes
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          // Refresh bookings and room statuses when any booking is created, updated, or deleted
          fetchRecentBookings();
          fetchFloor2RoomsAndStatuses();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
      href: '/admin/companies',
    },
    {
      name: 'Locations',
      value: stats.locations,
      icon: MapPin,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      href: '/admin/locations',
    },
    {
      name: 'Rooms',
      value: stats.rooms,
      icon: DoorOpen,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      href: '/admin/rooms',
    },
    {
      name: 'Users',
      value: stats.users,
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      href: '/admin/users',
    },
    {
      name: 'Total Bookings',
      value: stats.bookings,
      icon: Calendar,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      href: '/admin/bookings',
    },
  ];

  const getStatusStyles = (booking: Booking) => {
    const normalized = normalizeBookingStatus(booking);

    switch (normalized) {
      case 'no_show':
        return {
          label: 'no show',
          classes: 'bg-amber-50 text-amber-700 border border-amber-200',
        };
      case 'cancelled':
        return {
          label: 'cancelled',
          classes: 'bg-rose-50 text-rose-700 border border-rose-200',
        };
      case 'completed':
        return {
          label: 'completed',
          classes: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
        };
      case 'in_use':
        return {
          label: 'in use',
          classes: 'bg-rose-50 text-rose-700 border border-rose-200',
        };
      case 'upcoming':
      default:
        return {
          label: 'upcoming',
          classes: 'bg-amber-50 text-amber-700 border border-amber-200',
        };
    }
  };

  const renderBookingRow = (booking: Booking) => {
    const { label, classes } = getStatusStyles(booking);
    const getAttendeeStatusRingClass = (status?: string | null) => {
      switch (status) {
        case 'accepted':
          return 'ring-2 ring-emerald-500';
        case 'tentative':
          return 'ring-2 ring-amber-500';
        case 'declined':
          return 'ring-2 ring-rose-500';
        default:
          return 'ring-2 ring-gray-300';
      }
    };

    return (
      <div
        key={booking.id}
        className="p-4 rounded-2xl bg-white hover:bg-gray-50 shadow-sm border border-gray-100 transition-colors cursor-pointer"
        onClick={() => setSelectedBookingId(booking.id)}
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

        {/* Details stack */}
        <div className="flex flex-col gap-1 text-xs text-gray-600">
          {booking.room && (
            <span className="flex items-center">
              <DoorOpen className="w-4 h-4 mr-1.5" />
              {booking.room.name}
            </span>
          )}
          <span className="flex items-center">
            <Clock className="w-4 h-4 mr-1.5" />
            {formatDateTime(booking.start_time)}
          </span>
          {booking.host && (
            <div className="flex flex-col">
              <span className="flex items-center text-xs text-gray-700">
                <Users className="w-4 h-4 mr-1.5" />
                {booking.host.name}
              </span>
              {booking.attendee_emails && booking.attendee_emails.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {booking.attendee_emails.map((email) => {
                    const status = booking.attendee_response_statuses?.[email] || 'needsAction';
                    const ringClass = getAttendeeStatusRingClass(status);
                    const initial = email.charAt(0).toUpperCase();
                    return (
                      <div
                        key={email}
                        className={`w-4 h-4 rounded-full bg-white text-gray-700 text-[9px] flex items-center justify-center ${ringClass}`}
                        title={`${email} • ${status}`}
                      >
                        {initial}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
            <Link key={stat.name} href={stat.href}>
              <Card className="rounded-3xl bg-white tablet-shadow hover:translate-y-0.5 hover:shadow-lg transition-all cursor-pointer">
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
            </Link>
          );
        })}
      </div>

      {/* Current Room Status - Floor 2 */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Current room status
          </h2>
          <span className="text-sm text-gray-500">Floor 2</span>
        </div>
        {roomsLoading ? (
          <div className="text-gray-600 py-4">Loading rooms...</div>
        ) : floor2Rooms.length === 0 ? (
          <div className="text-gray-600 py-4">No rooms found on Floor 2</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {floor2Rooms.map((room) => (
              <RoomStatusCard
                key={room.id}
                room={room}
                status={roomStatuses[room.id]}
              />
            ))}
          </div>
        )}
      </section>

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
          const { in_use: inUse, upcoming, completed_cancelled: completedCancelled } =
            bucketBookings(recentBookings);

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

      {/* Booking Details Modal */}
      {selectedBookingId && (
        <BookingDetailsModal
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
        />
      )}
    </div>
  );
}

