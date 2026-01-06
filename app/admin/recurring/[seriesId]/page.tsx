'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { 
  ArrowLeft,
  Repeat, 
  Calendar, 
  MapPin, 
  User, 
  Clock, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Ban,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';

interface Occurrence {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: string;
  check_in_time: string | null;
}

interface SeriesDetails {
  parent: {
    id: string;
    title: string;
    description: string | null;
    start_time: string;
    end_time: string;
    recurrence_rule: {
      type: 'weekly' | 'monthly';
      daysOfWeek?: number[];
      dayOfMonth?: number;
    };
    recurrence_end_date: string;
    status: string;
    attendee_emails: string[];
    room: {
      id: string;
      name: string;
      location: {
        id: string;
        name: string;
        timezone: string;
      };
    };
    host: {
      id: string;
      name: string;
      email: string;
    } | null;
    created_at: string;
  };
  occurrences: Occurrence[];
}

export default function RecurringSeriesDetailPage() {
  const params = useParams();
  const router = useRouter();
  const seriesId = params?.seriesId as string;

  const [details, setDetails] = useState<SeriesDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingOccurrence, setCancellingOccurrence] = useState<string | null>(null);
  const [cancellingSeries, setCancellingSeries] = useState(false);
  const [showSeriesCancelConfirm, setShowSeriesCancelConfirm] = useState(false);

  useEffect(() => {
    if (seriesId) {
      fetchDetails();
    }
  }, [seriesId]);

  const fetchDetails = async () => {
    try {
      const response = await fetch(`/api/admin/recurring/${seriesId}`);
      const result = await response.json();
      
      if (result.success) {
        setDetails(result.data);
      } else {
        setError(result.error?.message || 'Failed to fetch series details');
      }
    } catch (err) {
      setError('Failed to fetch series details');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOccurrence = async (occurrenceId: string) => {
    setCancellingOccurrence(occurrenceId);
    
    try {
      const response = await fetch(`/api/admin/recurring/${seriesId}/occurrences/${occurrenceId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        await fetchDetails();
      } else {
        setError(result.error?.message || 'Failed to cancel occurrence');
      }
    } catch (err) {
      setError('Failed to cancel occurrence');
    } finally {
      setCancellingOccurrence(null);
    }
  };

  const handleCancelSeries = async () => {
    setCancellingSeries(true);
    
    try {
      const response = await fetch(`/api/admin/recurring/${seriesId}`, {
        method: 'DELETE',
      });
      
      const result = await response.json();
      
      if (result.success) {
        router.push('/admin/recurring');
      } else {
        setError(result.error?.message || 'Failed to cancel series');
        setCancellingSeries(false);
      }
    } catch (err) {
      setError('Failed to cancel series');
      setCancellingSeries(false);
    }
  };

  const formatRecurrencePattern = (rule: SeriesDetails['parent']['recurrence_rule']) => {
    if (rule.type === 'weekly' && rule.daysOfWeek) {
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const days = rule.daysOfWeek.map(d => dayNames[d]).join(', ');
      return `Every week on ${days}`;
    } else if (rule.type === 'monthly' && rule.dayOfMonth) {
      const suffix = rule.dayOfMonth === 1 ? 'st' : rule.dayOfMonth === 2 ? 'nd' : rule.dayOfMonth === 3 ? 'rd' : 'th';
      return `Every month on the ${rule.dayOfMonth}${suffix}`;
    }
    return 'Unknown pattern';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="w-3 h-3" />
            Scheduled
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3" />
            In Progress
          </span>
        );
      case 'ended':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      case 'no_show':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Ban className="w-3 h-3" />
            No Show
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/recurring">
            <Button variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Loading...</h1>
        </div>
      </div>
    );
  }

  if (error || !details) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/recurring">
            <Button variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
        </div>
        <Card>
          <div className="text-center py-10">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-red-600">{error || 'Series not found'}</p>
          </div>
        </Card>
      </div>
    );
  }

  const { parent, occurrences } = details;
  const now = new Date();
  const upcomingOccurrences = occurrences.filter(
    o => new Date(o.start_time) > now && o.status === 'scheduled'
  );
  const pastOccurrences = occurrences.filter(
    o => new Date(o.start_time) <= now || o.status !== 'scheduled'
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/recurring">
            <Button variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{parent.title}</h1>
            <p className="text-sm text-gray-500">Recurring meeting series</p>
          </div>
        </div>
        
        {showSeriesCancelConfirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Cancel entire series?</span>
            <Button
              variant="danger"
              onClick={handleCancelSeries}
              disabled={cancellingSeries}
            >
              {cancellingSeries ? 'Cancelling...' : 'Yes, Cancel All'}
            </Button>
            <Button variant="secondary" onClick={() => setShowSeriesCancelConfirm(false)}>
              No
            </Button>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setShowSeriesCancelConfirm(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Cancel Entire Series
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {/* Series Details */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Series Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{parent.room.name}</p>
                <p className="text-sm text-gray-500">{parent.room.location.name}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <User className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{parent.host?.name || 'No host'}</p>
                <p className="text-sm text-gray-500">{parent.host?.email || '-'}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Repeat className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{formatRecurrencePattern(parent.recurrence_rule)}</p>
                <p className="text-sm text-gray-500">
                  Until {format(new Date(parent.recurrence_end_date), 'MMMM d, yyyy')}
                </p>
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {format(new Date(parent.start_time), 'h:mm a')} - {format(new Date(parent.end_time), 'h:mm a')}
                </p>
                <p className="text-sm text-gray-500">{parent.room.location.timezone}</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-gray-900">{occurrences.length} occurrences</p>
                <p className="text-sm text-gray-500">
                  Created {format(new Date(parent.created_at), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {parent.attendee_emails && parent.attendee_emails.length > 0 && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Attendees</p>
                  <p className="text-sm text-gray-500">{parent.attendee_emails.join(', ')}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {parent.description && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-gray-600">{parent.description}</p>
          </div>
        )}
      </Card>

      {/* Upcoming Occurrences */}
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Upcoming Occurrences ({upcomingOccurrences.length})
        </h2>
        
        {upcomingOccurrences.length === 0 ? (
          <p className="text-gray-500 text-sm">No upcoming occurrences</p>
        ) : (
          <div className="space-y-2">
            {upcomingOccurrences.map((occ) => (
              <div
                key={occ.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(occ.start_time), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(occ.start_time), 'h:mm a')} - {format(new Date(occ.end_time), 'h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(occ.status)}
                </div>
                
                <Button
                  variant="secondary"
                  onClick={() => handleCancelOccurrence(occ.id)}
                  disabled={cancellingOccurrence === occ.id || occ.status === 'cancelled'}
                  className="text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {cancellingOccurrence === occ.id ? 'Cancelling...' : 'Cancel'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Past Occurrences */}
      {pastOccurrences.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Past & Completed ({pastOccurrences.length})
          </h2>
          
          <div className="space-y-2">
            {pastOccurrences.map((occ) => (
              <div
                key={occ.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg opacity-75"
              >
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(occ.start_time), 'EEEE, MMMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500">
                      {format(new Date(occ.start_time), 'h:mm a')} - {format(new Date(occ.end_time), 'h:mm a')}
                    </p>
                  </div>
                  {getStatusBadge(occ.status)}
                </div>
                
                {occ.check_in_time && (
                  <span className="text-xs text-gray-500">
                    Checked in at {format(new Date(occ.check_in_time), 'h:mm a')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

