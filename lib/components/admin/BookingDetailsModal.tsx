'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { X, User, Users, Calendar, Clock, LogIn, Maximize2, CheckCircle, XCircle, History } from 'lucide-react';

interface BookingActivity {
  id: string;
  action: 'created' | 'checked_in' | 'extended' | 'ended_early' | 'cancelled' | 'no_show';
  created_at: string;
  performed_by: {
    name: string;
    email: string;
  } | null;
  metadata: Record<string, any>;
}

interface BookingDetails {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  check_in_time: string | null;
  extended_count: number;
  attendee_emails: string[];
  created_at: string;
  source: string;
  room: {
    name: string;
    location: {
      name: string;
    };
  };
  host: {
    name: string;
    email: string;
  } | null;
  activity_log: BookingActivity[];
}

interface BookingDetailsModalProps {
  bookingId: string | null;
  onClose: () => void;
}

export function BookingDetailsModal({ bookingId, onClose }: BookingDetailsModalProps) {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bookingId) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    if (!bookingId) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}`);
      const result = await response.json();
      
      if (result.success) {
        setBooking(result.data);
      } else {
        setError(result.error?.message || 'Failed to load booking details');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load booking details');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDuration = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60));
    
    if (durationMinutes < 60) {
      return `${durationMinutes} minutes`;
    } else {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles: Record<string, { label: string; classes: string }> = {
      scheduled: { label: 'Upcoming', classes: 'bg-amber-100 text-amber-800 border-amber-300' },
      in_progress: { label: 'In Use', classes: 'bg-rose-100 text-rose-800 border-rose-300' },
      ended: { label: 'Completed', classes: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      cancelled: { label: 'Cancelled', classes: 'bg-gray-100 text-gray-800 border-gray-300' },
      no_show: { label: 'No Show', classes: 'bg-orange-100 text-orange-800 border-orange-300' },
    };

    const style = statusStyles[status] || { label: status, classes: 'bg-gray-100 text-gray-800 border-gray-300' };
    
    return (
      <span className={`px-3 py-1 text-xs font-semibold rounded-full border ${style.classes}`}>
        {style.label}
      </span>
    );
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created':
        return <Calendar className="w-4 h-4 text-blue-600" />;
      case 'checked_in':
        return <LogIn className="w-4 h-4 text-green-600" />;
      case 'extended':
        return <Maximize2 className="w-4 h-4 text-purple-600" />;
      case 'ended_early':
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'no_show':
        return <XCircle className="w-4 h-4 text-orange-600" />;
      default:
        return <History className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created':
        return 'Booking Created';
      case 'checked_in':
        return 'Checked In';
      case 'extended':
        return 'Extended';
      case 'ended_early':
        return 'Ended Early (Released)';
      case 'cancelled':
        return 'Cancelled';
      case 'no_show':
        return 'Marked as No Show';
      default:
        return action;
    }
  };

  if (!bookingId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
          <h2 className="text-2xl font-bold text-gray-900">Booking Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="text-center py-12 text-gray-600">Loading booking details...</div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={onClose}>Close</Button>
            </div>
          ) : booking ? (
            <>
              {/* Title and Status */}
              <div>
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h3 className="text-xl font-semibold text-gray-900 flex-1">{booking.title}</h3>
                  {getStatusBadge(booking.status)}
                </div>
                {booking.description && (
                  <p className="text-sm text-gray-600">{booking.description}</p>
                )}
              </div>

              {/* Room and Location */}
              <Card className="bg-gray-50">
                <div className="space-y-2">
                  <div className="flex items-center text-gray-700">
                    <Calendar className="w-5 h-5 mr-3 text-gray-500" />
                    <span className="font-medium">{booking.room.name}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <div className="w-5 h-5 mr-3"></div>
                    <span>{booking.room.location.name}</span>
                  </div>
                </div>
              </Card>

              {/* Host Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                  <User className="w-4 h-4 mr-2" />
                  Host
                </h4>
                <Card className="bg-blue-50 border-blue-200">
                  {booking.host ? (
                    <div>
                      <p className="font-medium text-gray-900">{booking.host.name}</p>
                      <p className="text-sm text-gray-600">{booking.host.email}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">No host assigned (walk-up booking)</p>
                  )}
                </Card>
              </div>

              {/* Attendees */}
              {booking.attendee_emails && booking.attendee_emails.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                    <Users className="w-4 h-4 mr-2" />
                    Attendees ({booking.attendee_emails.length})
                  </h4>
                  <Card className="bg-purple-50 border-purple-200">
                    <div className="space-y-1">
                      {booking.attendee_emails.map((email, idx) => (
                        <p key={idx} className="text-sm text-gray-700">{email}</p>
                      ))}
                    </div>
                  </Card>
                </div>
              )}

              {/* Time Information */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Time Details
                </h4>
                <Card>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Start Time:</span>
                      <span className="text-sm font-medium text-gray-900 text-right">{formatDateTime(booking.start_time)}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">End Time:</span>
                      <span className="text-sm font-medium text-gray-900 text-right">{formatDateTime(booking.end_time)}</span>
                    </div>
                    <div className="flex justify-between items-start pt-2 border-t border-gray-200">
                      <span className="text-sm text-gray-600">Duration:</span>
                      <span className="text-sm font-semibold text-blue-600">{formatDuration(booking.start_time, booking.end_time)}</span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Booking Metadata */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3">
                  Booking Information
                </h4>
                <Card>
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Booking Created:</span>
                      <span className="text-sm font-medium text-gray-900 text-right">{formatDateTime(booking.created_at)}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Source:</span>
                      <span className="text-sm font-medium text-gray-900 capitalize">{booking.source}</span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Check-in Time:</span>
                      <span className="text-sm font-medium text-gray-900 text-right">
                        {booking.check_in_time ? formatDateTime(booking.check_in_time) : (
                          <span className="text-gray-500 italic">Not checked in</span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-start">
                      <span className="text-sm text-gray-600">Extensions:</span>
                      <span className="text-sm font-medium text-gray-900">
                        {booking.extended_count > 0 ? `${booking.extended_count} time${booking.extended_count > 1 ? 's' : ''}` : 'None'}
                      </span>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Activity Timeline */}
              {booking.activity_log && booking.activity_log.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-3 flex items-center">
                    <History className="w-4 h-4 mr-2" />
                    Activity Timeline
                  </h4>
                  <Card>
                    <div className="space-y-4">
                      {booking.activity_log.map((activity, idx) => (
                        <div key={activity.id} className="flex gap-3">
                          <div className="flex-shrink-0 mt-1">
                            {getActionIcon(activity.action)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-gray-900">
                                {getActionLabel(activity.action)}
                              </p>
                              <span className="text-xs text-gray-500 whitespace-nowrap">
                                {new Date(activity.created_at).toLocaleTimeString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </span>
                            </div>
                            {activity.performed_by && (
                              <p className="text-xs text-gray-600 mt-0.5">
                                by {activity.performed_by.name}
                              </p>
                            )}
                            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                {activity.metadata.additional_minutes && (
                                  <span>Extended by {activity.metadata.additional_minutes} minutes</span>
                                )}
                                {activity.metadata.source && activity.action === 'created' && (
                                  <span>Source: {activity.metadata.source}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end rounded-b-3xl">
          <Button onClick={onClose} className="bg-gray-900 hover:bg-gray-800 text-white px-6">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

