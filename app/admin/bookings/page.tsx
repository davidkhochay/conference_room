'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { BookingDetailsModal } from '@/lib/components/admin/BookingDetailsModal';
import { BookingEditModal } from '@/lib/components/admin/BookingEditModal';
import {
  Search,
  Filter,
  Calendar,
  DoorOpen,
  Users,
  Clock,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  XCircle,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  ChevronDown,
  Check,
  Repeat,
} from 'lucide-react';

interface Booking {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  status: string;
  source: string;
  check_in_time: string | null;
  google_event_id: string | null;
  organizer_email: string | null;
  external_source: string | null;
  is_recurring?: boolean;
  recurring_parent_id?: string | null;
  room_id?: string | null;
  room: {
    id: string;
    name: string;
    location?: {
      id: string;
      name: string;
    } | null;
  } | null;
  host: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface RecurringGroup {
  parentId: string;
  bookings: Booking[];
  isExpanded: boolean;
}

interface Room {
  id: string;
  name: string;
}

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'ended', label: 'Ended' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];

const SOURCE_OPTIONS = [
  { value: 'web', label: 'Web' },
  { value: 'tablet', label: 'Tablet' },
  { value: 'api', label: 'API' },
  { value: 'admin', label: 'Admin' },
  { value: 'google_calendar', label: 'Google Calendar' },
];

// Multi-select dropdown component
function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const displayText = selected.length === 0
    ? placeholder
    : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label || selected[0]
      : `${selected.length} selected`;

  return (
    <div className="relative" ref={ref}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white flex items-center justify-between gap-1 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleValue(opt.value)}
              className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
            >
              <div className={`w-4 h-4 border rounded flex items-center justify-center ${selected.includes(opt.value) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                {selected.includes(opt.value) && <Check className="w-3 h-3 text-white" />}
              </div>
              {opt.label}
            </button>
          ))}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-3 py-1.5 text-left text-xs text-gray-500 hover:bg-gray-50 border-t border-gray-100 mt-1"
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters (multi-select arrays)
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<string[]>([]);
  const [sourceFilters, setSourceFilters] = useState<string[]>([]);
  const [roomFilters, setRoomFilters] = useState<string[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 25;

  // Modals
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);

  // Row selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Delete confirmation
  const [deletingBookingId, setDeletingBookingId] = useState<string | null>(null);
  const [deletingBookingInfo, setDeletingBookingInfo] = useState<{ isRecurring: boolean; parentId: string | null; occurrenceCount: number } | null>(null);
  const [deleteSeriesMode, setDeleteSeriesMode] = useState<'single' | 'series'>('single');
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Expanded recurring groups
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(limit));
      if (search) params.set('search', search);
      if (statusFilters.length > 0) params.set('status', statusFilters.join(','));
      if (sourceFilters.length > 0) params.set('source', sourceFilters.join(','));
      if (roomFilters.length > 0) params.set('room_id', roomFilters.join(','));
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);

      const response = await fetch(`/api/admin/bookings?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setBookings(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
        // Clear selection when data changes
        setSelectedIds(new Set());
      } else {
        setError(result.error?.message || 'Failed to fetch bookings');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilters, sourceFilters, roomFilters, startDate, endDate]);

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms?status=all');
      const result = await response.json();
      if (result.success) {
        setRooms(result.data);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  };

  useEffect(() => {
    document.title = 'Bookings | Admin | Good Life Rooms';
    fetchRooms();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (page !== 1) {
        setPage(1);
      } else {
        fetchBookings();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleFilterChange = () => {
    setPage(1);
  };

  const handleSaveBooking = async (bookingId: string, updates: {
    title?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
  }) => {
    const response = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error?.message || 'Failed to update booking');
    }
    fetchBookings();
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: { 'x-admin-request': 'true' },
      });
      const result = await response.json();
      if (!result.success) {
        alert(result.error?.message || 'Failed to cancel booking');
      } else {
        fetchBookings();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel booking');
    }
    setActionMenuId(null);
  };

  const startDelete = (booking: Booking) => {
    const isRecurring = booking.is_recurring || !!booking.recurring_parent_id;
    const parentId = booking.recurring_parent_id || (booking.is_recurring ? booking.id : null);
    
    // Count occurrences if this is a recurring booking
    let occurrenceCount = 1;
    if (parentId) {
      const group = groupedBookings.groups.get(parentId);
      if (group) {
        occurrenceCount = group.length;
      }
    }
    
    setDeletingBookingId(booking.id);
    setDeletingBookingInfo({ isRecurring, parentId, occurrenceCount });
    setDeleteSeriesMode('single');
  };

  const handleDeleteBooking = async () => {
    if (!deletingBookingId) return;
    setDeleting(true);
    
    try {
      if (deleteSeriesMode === 'series' && deletingBookingInfo?.parentId) {
        // Delete entire series - get all booking IDs in the series
        const parentId = deletingBookingInfo.parentId;
        const group = groupedBookings.groups.get(parentId);
        
        if (group && group.length > 0) {
          // Delete all bookings in the series
          const deletePromises = group.map(async (booking) => {
            const response = await fetch(`/api/admin/bookings/${booking.id}`, {
              method: 'DELETE',
            });
            return response.json();
          });
          
          const results = await Promise.all(deletePromises);
          const failed = results.filter(r => !r.success);
          
          if (failed.length > 0) {
            alert(`Deleted ${results.length - failed.length} of ${results.length} bookings. Some failed.`);
          }
        }
      } else {
        // Delete single booking
        const response = await fetch(`/api/admin/bookings/${deletingBookingId}`, {
          method: 'DELETE',
        });
        const result = await response.json();
        if (!result.success) {
          alert(result.error?.message || 'Failed to delete booking');
        }
      }
      
      fetchBookings();
    } catch (err: any) {
      alert(err.message || 'Failed to delete booking');
    } finally {
      setDeleting(false);
      setDeletingBookingId(null);
      setDeletingBookingInfo(null);
      setDeleteSeriesMode('single');
    }
  };

  const formatDateTime = (isoString: string) => {
    return new Date(isoString).toLocaleString('en-US', {
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
    if (durationMinutes < 60) return `${durationMinutes}m`;
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      scheduled: 'bg-amber-100 text-amber-800 border-amber-200',
      in_progress: 'bg-rose-100 text-rose-800 border-rose-200',
      ended: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      cancelled: 'bg-gray-100 text-gray-800 border-gray-200',
      no_show: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    const labels: Record<string, string> = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      ended: 'Ended',
      cancelled: 'Cancelled',
      no_show: 'No Show',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getSourceBadge = (source: string, externalSource?: string | null) => {
    const styles: Record<string, string> = {
      web: 'bg-blue-50 text-blue-700',
      tablet: 'bg-purple-50 text-purple-700',
      api: 'bg-cyan-50 text-cyan-700',
      admin: 'bg-indigo-50 text-indigo-700',
      google_calendar: 'bg-green-50 text-green-700',
    };
    const labels: Record<string, string> = {
      web: 'Web',
      tablet: 'Tablet',
      api: 'API',
      admin: 'Admin',
      google_calendar: 'Google',
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-medium rounded ${styles[source] || 'bg-gray-50 text-gray-700'}`}>
        {labels[source] || source}
        {externalSource === 'google_ui' && ' (GCal)'}
      </span>
    );
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilters([]);
    setSourceFilters([]);
    setRoomFilters([]);
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const hasFilters = search || statusFilters.length > 0 || sourceFilters.length > 0 || roomFilters.length > 0 || startDate || endDate;

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(bookings.map((b) => b.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    // Confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} booking(s)? This action cannot be undone.`
    );
    if (!confirmed) return;
    
    setBulkDeleting(true);
    const idsToDelete = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;
    
    try {
      const results = await Promise.all(
        idsToDelete.map(async (id) => {
          try {
            const response = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
            const data = await response.json();
            if (data.success) {
              successCount++;
              return { id, success: true };
            } else {
              failCount++;
              return { id, success: false, error: data.error?.message };
            }
          } catch (err) {
            failCount++;
            return { id, success: false, error: 'Network error' };
          }
        })
      );
      
      setSelectedIds(new Set());
      fetchBookings();
      
      if (failCount > 0) {
        alert(`Deleted ${successCount} booking(s). Failed to delete ${failCount} booking(s).`);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete bookings');
    } finally {
      setBulkDeleting(false);
    }
  };

  // Group bookings by recurring series
  const groupedBookings = React.useMemo(() => {
    const groups: Map<string, Booking[]> = new Map();
    const standalone: Booking[] = [];
    
    const getTimeOfDay = (iso: string) => {
      // Use HH:mm from ISO, fallback to locale time if needed
      if (iso && iso.length >= 16) {
        return iso.slice(11, 16);
      }
      return new Date(iso).toISOString().slice(11, 16);
    };

    const normalizeTitle = (title: string | null | undefined) =>
      (title || '').trim().toLowerCase();

    for (const booking of bookings) {
      // Determine the group key (parent ID for children, own ID for parents)
      let groupKey = booking.recurring_parent_id || (booking.is_recurring ? booking.id : null);
      
      // Fallback grouping for Google recurring events that don't have our internal recurring fields.
      // Google recurring instance IDs typically look like "seriesId_YYYYMMDDTHHMMSSZ".
      if (!groupKey && booking.google_event_id && booking.google_event_id.includes('_')) {
        const seriesId = booking.google_event_id.split('_')[0];
        if (seriesId) {
          groupKey = `${booking.room_id || 'room'}:${seriesId}`;
        }
      }
      
      if (groupKey) {
        const existing = groups.get(groupKey) || [];
        existing.push(booking);
        groups.set(groupKey, existing);
      } else {
        standalone.push(booking);
      }
    }
    
    // Sort each group by start_time
    for (const [key, groupBookings] of groups) {
      groupBookings.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
    }

    // Merge recurring groups that are clearly the same series (e.g., Google + Web duplicates)
    // Use a signature based on title + room + time-of-day + duration
    const mergedGroups: Map<string, Booking[]> = new Map();
    for (const groupBookings of groups.values()) {
      const first = groupBookings[0];
      const durationMinutes = Math.round(
        (new Date(first.end_time).getTime() - new Date(first.start_time).getTime()) / 60000
      );
      const signature = [
        normalizeTitle(first.title),
        first.room_id || 'room',
        getTimeOfDay(first.start_time),
        String(durationMinutes),
      ].join('|');

      const existing = mergedGroups.get(signature) || [];
      mergedGroups.set(signature, existing.concat(groupBookings));
    }

    // Re-sort merged groups after concatenation and de-duplicate identical occurrences
    for (const [key, groupBookings] of mergedGroups) {
      groupBookings.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
      const byKey = new Map<string, Booking>();
      const normalizeTime = (iso: string) => {
        if (!iso) return '';
        return new Date(iso).toISOString().slice(0, 16); // minute precision
      };
      const getRoomKey = (b: Booking) => b.room_id || b.room?.id || b.room?.name || 'room';
      const preferGoogle = (current: Booking, incoming: Booking) => {
        if (incoming.source === 'google_calendar' && current.source !== 'google_calendar') {
          return incoming;
        }
        return current;
      };
      for (const b of groupBookings) {
        const dedupeKey = `${getRoomKey(b)}:${normalizeTime(b.start_time)}:${normalizeTime(b.end_time)}`;
        if (!byKey.has(dedupeKey)) {
          byKey.set(dedupeKey, b);
        } else {
          const existing = byKey.get(dedupeKey)!;
          byKey.set(dedupeKey, preferGoogle(existing, b));
        }
      }
      mergedGroups.set(key, Array.from(byKey.values()).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()));
    }
    
    return { groups: mergedGroups, standalone };
  }, [bookings]);

  const toggleGroupExpand = (groupKey: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  // Get the representative booking for a group (first/earliest one)
  const getGroupRepresentative = (groupBookings: Booking[]): Booking => {
    return groupBookings[0];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Bookings</h1>
          <p className="text-sm text-gray-600">
            Manage and view all room bookings across the system
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
            </Button>
          )}
          <Button
            onClick={fetchBookings}
            className="bg-gray-800 hover:bg-gray-900 text-white border-0"
          >
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="bg-white rounded-xl p-3">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Search bar */}
          <div className="relative flex-[2] min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Title, host, room, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Multi-select filters */}
          <div className="flex-1 min-w-[110px]">
            <MultiSelectDropdown
              label="Status"
              options={STATUS_OPTIONS}
              selected={statusFilters}
              onChange={(v) => { setStatusFilters(v); handleFilterChange(); }}
              placeholder="All"
            />
          </div>

          <div className="flex-1 min-w-[110px]">
            <MultiSelectDropdown
              label="Source"
              options={SOURCE_OPTIONS}
              selected={sourceFilters}
              onChange={(v) => { setSourceFilters(v); handleFilterChange(); }}
              placeholder="All"
            />
          </div>

          <div className="flex-1 min-w-[110px]">
            <MultiSelectDropdown
              label="Room"
              options={rooms.map((r) => ({ value: r.id, label: r.name }))}
              selected={roomFilters}
              onChange={(v) => { setRoomFilters(v); handleFilterChange(); }}
              placeholder="All"
            />
          </div>

          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); handleFilterChange(); }}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex-1 min-w-[100px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); handleFilterChange(); }}
              className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              Clear
            </button>
          )}
        </div>
      </Card>

      {/* Results summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {loading ? 'Loading...' : `${total} booking${total !== 1 ? 's' : ''} found`}
        </span>
        {totalPages > 1 && (
          <span>Page {page} of {totalPages}</span>
        )}
      </div>

      {/* Error state */}
      {error && (
        <Card className="bg-red-50 border-red-200 text-red-700 p-4">
          {error}
        </Card>
      )}

      {/* Table */}
      <Card className="bg-white rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={bookings.length > 0 && selectedIds.size === bookings.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Title</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Room</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Host</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Time</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Duration</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Source</th>
                <th className="text-right px-3 py-2.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-500">
                    Loading bookings...
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-gray-500">
                    No bookings found
                  </td>
                </tr>
              ) : (
                <>
                  {/* Render recurring groups */}
                  {Array.from(groupedBookings.groups.entries()).map(([groupKey, groupBookings]) => {
                    const isExpanded = expandedGroups.has(groupKey);
                    const representative = getGroupRepresentative(groupBookings);
                    const occurrenceCount = groupBookings.length;
                    
                    return (
                      <React.Fragment key={`group-${groupKey}`}>
                        {/* Group header row */}
                        <tr 
                          className={`hover:bg-gray-50 transition-colors ${selectedIds.has(representative.id) ? 'bg-blue-50' : 'bg-purple-50/30'}`}
                        >
                          <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={groupBookings.every(b => selectedIds.has(b.id))}
                              onChange={() => {
                                const allSelected = groupBookings.every(b => selectedIds.has(b.id));
                                const newSet = new Set(selectedIds);
                                groupBookings.forEach(b => {
                                  if (allSelected) {
                                    newSet.delete(b.id);
                                  } else {
                                    newSet.add(b.id);
                                  }
                                });
                                setSelectedIds(newSet);
                              }}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-medium text-gray-900 truncate max-w-[160px] flex items-center gap-1.5" title={representative.title}>
                                  <Repeat className="w-3.5 h-3.5 text-purple-500" />
                                  {representative.title}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleGroupExpand(groupKey);
                                  }}
                                  className="mt-0.5 flex items-center gap-1 text-xs text-purple-600 font-medium"
                                >
                                  <span>{occurrenceCount} occurrences</span>
                                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center text-sm text-gray-700">
                              <DoorOpen className="w-3.5 h-3.5 mr-1 text-gray-400" />
                              <span className="truncate max-w-[100px]">{representative.room?.name || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="text-sm">
                              {representative.host ? (
                                <>
                                  <div className="text-gray-900 text-xs">{representative.host.name}</div>
                                  <div className="text-gray-500 text-xs truncate max-w-[130px]">{representative.host.email}</div>
                                </>
                              ) : representative.organizer_email ? (
                                <div className="text-gray-500 text-xs truncate max-w-[130px]" title={representative.organizer_email}>
                                  {representative.organizer_email}
                                </div>
                              ) : (
                                <span className="text-gray-400 italic text-xs">Walk-up</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                            <span className="text-purple-600">Recurring series</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                            {formatDuration(representative.start_time, representative.end_time)}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-purple-100 text-purple-700">
                              Recurring
                            </span>
                          </td>
                          <td className="px-3 py-2.5">
                            {getSourceBadge(representative.source, representative.external_source)}
                          </td>
                          <td className="px-3 py-2.5 text-right" />
                        </tr>
                        
                        {/* Expanded occurrences */}
                        {isExpanded && groupBookings.map((booking, idx) => (
                          <tr 
                            key={booking.id}
                            className={`hover:bg-gray-50 transition-colors ${selectedIds.has(booking.id) ? 'bg-blue-50' : 'bg-gray-50/50'}`}
                          >
                            <td className="px-3 py-2 pl-6">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(booking.id)}
                                onChange={() => toggleSelectOne(booking.id)}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                              />
                            </td>
                            <td className="px-3 py-2 pl-10">
                              <div className="font-medium text-gray-700 truncate max-w-[160px] text-sm" title={booking.title}>
                                #{idx + 1} - {formatDateTime(booking.start_time).split(',')[0]}
                              </div>
                              {booking.google_event_id && (
                                <span className="text-xs text-gray-400">Google linked</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center text-sm text-gray-600">
                                <DoorOpen className="w-3 h-3 mr-1 text-gray-400" />
                                <span className="truncate max-w-[100px]">{booking.room?.name || 'N/A'}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-xs text-gray-500">—</div>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                              {formatDateTime(booking.start_time)}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700 whitespace-nowrap">
                              {formatDuration(booking.start_time, booking.end_time)}
                            </td>
                            <td className="px-3 py-2">
                              {getStatusBadge(booking.status)}
                            </td>
                            <td className="px-3 py-2">
                              {getSourceBadge(booking.source, booking.external_source)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="relative inline-block">
                                <button
                                  onClick={() => setActionMenuId(actionMenuId === booking.id ? null : booking.id)}
                                  className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                  <MoreVertical className="w-3.5 h-3.5 text-gray-500" />
                                </button>
                                {actionMenuId === booking.id && (
                                  <div 
                                    className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[130px]"
                                    onMouseLeave={() => setActionMenuId(null)}
                                  >
                                    <button
                                      onClick={() => { setSelectedBookingId(booking.id); setActionMenuId(null); }}
                                      className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                    >
                                      <Eye className="w-3.5 h-3.5 mr-2" />
                                      View
                                    </button>
                                    <button
                                      onClick={() => { setEditingBooking(booking); setActionMenuId(null); }}
                                      className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                                    >
                                      <Edit className="w-3.5 h-3.5 mr-2" />
                                      Edit
                                    </button>
                                    {booking.status !== 'cancelled' && booking.status !== 'ended' && (
                                      <button
                                        onClick={() => handleCancelBooking(booking.id)}
                                        className="w-full px-3 py-1.5 text-left text-sm text-amber-700 hover:bg-amber-50 flex items-center"
                                      >
                                        <XCircle className="w-3.5 h-3.5 mr-2" />
                                        Cancel
                                      </button>
                                    )}
                                    <button
                                      onClick={() => { startDelete(booking); setActionMenuId(null); }}
                                      className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })}
                  
                  {/* Render standalone (non-recurring) bookings */}
                  {groupedBookings.standalone.map((booking) => (
                    <tr 
                      key={booking.id} 
                      className={`hover:bg-gray-50 transition-colors ${selectedIds.has(booking.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(booking.id)}
                          onChange={() => toggleSelectOne(booking.id)}
                          className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900 truncate max-w-[180px]" title={booking.title}>
                          {booking.title}
                        </div>
                        {booking.google_event_id && (
                          <span className="text-xs text-gray-400">Google linked</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center text-sm text-gray-700">
                          <DoorOpen className="w-3.5 h-3.5 mr-1 text-gray-400" />
                          <span className="truncate max-w-[100px]">{booking.room?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="text-sm">
                          {booking.host ? (
                            <>
                              <div className="text-gray-900 text-xs">{booking.host.name}</div>
                              <div className="text-gray-500 text-xs truncate max-w-[130px]">{booking.host.email}</div>
                            </>
                          ) : booking.organizer_email ? (
                            <div className="text-gray-500 text-xs truncate max-w-[130px]" title={booking.organizer_email}>
                              {booking.organizer_email}
                            </div>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Walk-up</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                        {formatDateTime(booking.start_time)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-gray-700 whitespace-nowrap">
                        {formatDuration(booking.start_time, booking.end_time)}
                      </td>
                      <td className="px-3 py-2.5">
                        {getStatusBadge(booking.status)}
                      </td>
                      <td className="px-3 py-2.5">
                        {getSourceBadge(booking.source, booking.external_source)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="relative inline-block">
                          <button
                            onClick={() => setActionMenuId(actionMenuId === booking.id ? null : booking.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                          {actionMenuId === booking.id && (
                            <div 
                              className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[130px]"
                              onMouseLeave={() => setActionMenuId(null)}
                            >
                              <button
                                onClick={() => { setSelectedBookingId(booking.id); setActionMenuId(null); }}
                                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                              >
                                <Eye className="w-3.5 h-3.5 mr-2" />
                                View
                              </button>
                              <button
                                onClick={() => { setEditingBooking(booking); setActionMenuId(null); }}
                                className="w-full px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                              >
                                <Edit className="w-3.5 h-3.5 mr-2" />
                                Edit
                              </button>
                              {booking.status !== 'cancelled' && booking.status !== 'ended' && (
                                <button
                                  onClick={() => handleCancelBooking(booking.id)}
                                  className="w-full px-3 py-1.5 text-left text-sm text-amber-700 hover:bg-amber-50 flex items-center"
                                >
                                  <XCircle className="w-3.5 h-3.5 mr-2" />
                                  Cancel
                                </button>
                              )}
                              <button
                                onClick={() => { startDelete(booking); setActionMenuId(null); }}
                                className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50 flex items-center"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-gray-200 px-3 py-2 flex items-center justify-between">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 flex items-center"
            >
              <ChevronLeft className="w-4 h-4 mr-0.5" />
              Prev
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 text-sm font-medium bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 disabled:opacity-50 flex items-center"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        )}
      </Card>

      {/* Booking Details Modal */}
      {selectedBookingId && (
        <BookingDetailsModal
          bookingId={selectedBookingId}
          onClose={() => setSelectedBookingId(null)}
        />
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <BookingEditModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSave={handleSaveBooking}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingBookingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => { setDeletingBookingId(null); setDeletingBookingInfo(null); }}>
          <div 
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Delete Booking</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            
            {/* Recurring series option */}
            {deletingBookingInfo?.isRecurring && deletingBookingInfo.occurrenceCount > 1 && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl">
                <p className="text-sm font-medium text-purple-800 mb-3">
                  This is part of a recurring series with {deletingBookingInfo.occurrenceCount} occurrences.
                </p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteSeriesMode === 'single'}
                      onChange={() => setDeleteSeriesMode('single')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm text-gray-700">Delete only this occurrence</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteMode"
                      checked={deleteSeriesMode === 'series'}
                      onChange={() => setDeleteSeriesMode('series')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm text-gray-700">
                      Delete entire series ({deletingBookingInfo.occurrenceCount} bookings)
                    </span>
                  </label>
                </div>
              </div>
            )}
            
            <p className="text-gray-600 mb-6">
              {deleteSeriesMode === 'series' 
                ? `Are you sure you want to permanently delete all ${deletingBookingInfo?.occurrenceCount || 1} bookings in this series? This will also remove them from Google Calendar if linked.`
                : 'Are you sure you want to permanently delete this booking? This will also remove it from Google Calendar if linked.'
              }
            </p>
            <div className="flex justify-end gap-3">
              <Button
                onClick={() => { setDeletingBookingId(null); setDeletingBookingInfo(null); }}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteBooking}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {deleting ? 'Deleting...' : (deleteSeriesMode === 'series' ? `Delete ${deletingBookingInfo?.occurrenceCount} Bookings` : 'Delete Booking')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
