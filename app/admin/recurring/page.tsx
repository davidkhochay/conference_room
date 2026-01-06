'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { 
  Repeat, 
  Calendar, 
  MapPin, 
  User, 
  Clock, 
  Trash2, 
  ChevronRight,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface RecurringSeries {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  recurrence_rule: {
    type: 'weekly' | 'monthly';
    daysOfWeek?: number[];
    dayOfMonth?: number;
  };
  recurrence_end_date: string;
  status: string;
  room: {
    id: string;
    name: string;
    location: {
      id: string;
      name: string;
    };
  };
  host: {
    id: string;
    name: string;
    email: string;
  } | null;
  occurrence_count: number;
  status_summary: {
    scheduled: number;
    completed: number;
    cancelled: number;
    no_show: number;
  };
  next_occurrence: string | null;
  created_at: string;
}

export default function RecurringMeetingsPage() {
  const [series, setSeries] = useState<RecurringSeries[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchRecurringSeries();
  }, []);

  const fetchRecurringSeries = async () => {
    try {
      const response = await fetch('/api/admin/recurring');
      const result = await response.json();
      
      if (result.success) {
        setSeries(result.data);
      } else {
        setError(result.error?.message || 'Failed to fetch recurring meetings');
      }
    } catch (err) {
      setError('Failed to fetch recurring meetings');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSeries = async (seriesId: string) => {
    setCancellingId(seriesId);
    
    try {
      const response = await fetch(`/api/admin/recurring/${seriesId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Refresh the list
        await fetchRecurringSeries();
        setShowCancelConfirm(null);
      } else {
        setError(result.error?.message || 'Failed to cancel series');
      }
    } catch (err) {
      setError('Failed to cancel series');
    } finally {
      setCancellingId(null);
    }
  };

  const formatRecurrencePattern = (rule: RecurringSeries['recurrence_rule']) => {
    if (rule.type === 'weekly' && rule.daysOfWeek) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = rule.daysOfWeek.map(d => dayNames[d]).join(', ');
      return `Weekly on ${days}`;
    } else if (rule.type === 'monthly' && rule.dayOfMonth) {
      const suffix = rule.dayOfMonth === 1 ? 'st' : rule.dayOfMonth === 2 ? 'nd' : rule.dayOfMonth === 3 ? 'rd' : 'th';
      return `Monthly on the ${rule.dayOfMonth}${suffix}`;
    }
    return 'Unknown pattern';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Recurring Meetings</h1>
        <Card>
          <div className="text-center py-10 text-gray-600">
            Loading recurring meetings...
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recurring Meetings</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage recurring meeting series. Only administrators can modify or cancel recurring bookings.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Series List */}
      {series.length === 0 ? (
        <Card>
          <div className="text-center py-10">
            <Repeat className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recurring meetings</h3>
            <p className="text-gray-500 mb-4">
              Recurring meetings will appear here once created from the booking form.
            </p>
            <Link href="/book">
              <Button>Create a Booking</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {series.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Title and Status */}
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                    {/* Room & Location */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>{item.room.name} - {item.room.location.name}</span>
                    </div>

                    {/* Host */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <User className="w-4 h-4" />
                      <span>{item.host?.name || 'No host assigned'}</span>
                    </div>

                    {/* Pattern */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Repeat className="w-4 h-4" />
                      <span>{formatRecurrencePattern(item.recurrence_rule)}</span>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4" />
                      <span>
                        {format(new Date(item.start_time), 'h:mm a')} - {format(new Date(item.end_time), 'h:mm a')}
                      </span>
                    </div>

                    {/* End Date */}
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>Until {format(new Date(item.recurrence_end_date), 'MMM d, yyyy')}</span>
                    </div>

                    {/* Next Occurrence */}
                    {item.next_occurrence && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <ChevronRight className="w-4 h-4" />
                        <span>Next: {format(new Date(item.next_occurrence), 'MMM d, h:mm a')}</span>
                      </div>
                    )}
                  </div>

                  {/* Status Summary */}
                  <div className="flex items-center gap-4 mt-4 text-xs">
                    <span className="flex items-center gap-1 text-gray-500">
                      <span className="font-medium">{item.occurrence_count}</span> total
                    </span>
                    <span className="flex items-center gap-1 text-blue-600">
                      <CheckCircle className="w-3 h-3" />
                      {item.status_summary.scheduled} scheduled
                    </span>
                    <span className="flex items-center gap-1 text-green-600">
                      <CheckCircle className="w-3 h-3" />
                      {item.status_summary.completed} completed
                    </span>
                    {item.status_summary.cancelled > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-3 h-3" />
                        {item.status_summary.cancelled} cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 ml-4">
                  <Link href={`/admin/recurring/${item.id}`}>
                    <Button variant="secondary" className="text-sm">
                      View Details
                    </Button>
                  </Link>
                  
                  {showCancelConfirm === item.id ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="danger"
                        onClick={() => handleCancelSeries(item.id)}
                        disabled={cancellingId === item.id}
                        className="text-sm"
                      >
                        {cancellingId === item.id ? 'Cancelling...' : 'Confirm'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setShowCancelConfirm(null)}
                        className="text-sm"
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={() => setShowCancelConfirm(item.id)}
                      className="text-sm"
                      disabled={item.status === 'cancelled'}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Cancel Series
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

