'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Clock, PieChart, BarChart3, AlertTriangle } from 'lucide-react';

type BookingStatus =
  | 'scheduled'
  | 'in_progress'
  | 'ended'
  | 'cancelled'
  | 'no_show';

type BookingSource = 'tablet' | 'web' | 'api' | 'admin' | string;

interface Booking {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  source: BookingSource;
  room?: {
    name: string;
    location?: {
      name: string;
    };
  };
}

type TimeRange = '7d' | '30d' | '12m';

type SeriesKey = 'total' | 'checked_in' | 'no_show' | 'cancelled';

export default function AdminAnalyticsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [enabledSeries, setEnabledSeries] = useState<Record<SeriesKey, boolean>>({
    total: true,
    checked_in: true,
    no_show: true,
    cancelled: false,
  });

  useEffect(() => {
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const days =
        timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 365;
      const now = new Date();
      const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const params = new URLSearchParams({
        start_date: start.toISOString(),
      });

      const response = await fetch(`/api/bookings?${params.toString()}`);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || 'Failed to load analytics');
      }

      setBookings(result.data || []);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const totalBookings = bookings.length;

  const totalBookedHours = bookings.reduce((sum, b) => {
    const start = new Date(b.start_time).getTime();
    const end = new Date(b.end_time).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return sum;
    }
    const hours = (end - start) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);

  const statusCounts = bookings.reduce(
    (acc, b) => {
      acc[b.status] = (acc[b.status] || 0) + 1;
      return acc;
    },
    {} as Record<BookingStatus, number>
  );

  const totalForRates =
    (statusCounts.scheduled || 0) +
    (statusCounts.in_progress || 0) +
    (statusCounts.ended || 0) +
    (statusCounts.cancelled || 0) +
    (statusCounts.no_show || 0);

  const noShowRate =
    totalForRates === 0
      ? 0
      : Math.round(((statusCounts.no_show || 0) / totalForRates) * 100);

  const cancelledRate =
    totalForRates === 0
      ? 0
      : Math.round(((statusCounts.cancelled || 0) / totalForRates) * 100);

  const sourceCounts = bookings.reduce(
    (acc, b) => {
      const key = (b.source || 'unknown') as BookingSource;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    },
    {} as Record<BookingSource, number>
  );

  const locationCounts = bookings.reduce(
    (acc, b) => {
      const name =
        b.room?.location?.name || b.room?.name || 'Unassigned / unknown';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const formatHours = (hours: number) => {
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    if (hours < 10) {
      return `${hours.toFixed(1)} h`;
    }
    return `${Math.round(hours)} h`;
  };

  const timeRangeLabel =
    timeRange === '7d'
      ? 'Last 7 days'
      : timeRange === '30d'
      ? 'Last 30 days'
      : 'Last 12 months';

  const buildBars = (
    data: Record<string, number>
  ): Array<{ key: string; count: number; percent: number }> => {
    const entries = Object.entries(data);
    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([key, count]) => ({
        key,
        count,
        percent: total === 0 ? 0 : Math.round((count / total) * 100),
      }));
  };

  const sourceBars = buildBars(sourceCounts);
  const locationBars = buildBars(locationCounts);

  // Timeline data (for line chart)
  type TimelinePoint = {
    label: string;
    total: number;
    checked_in: number;
    no_show: number;
    cancelled: number;
  };

  const buildTimeline = (): TimelinePoint[] => {
    if (bookings.length === 0) return [];

    const now = new Date();

    if (timeRange === '12m') {
      const points: TimelinePoint[] = [];
      // 11 months ago up to this month
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const keyYear = d.getFullYear();
        const keyMonth = d.getMonth();

        const label = d.toLocaleDateString(undefined, {
          month: 'short',
          year: i === 11 || keyMonth === 0 ? '2-digit' : undefined,
        });

        let total = 0;
        let checked_in = 0;
        let no_show = 0;
        let cancelled = 0;

        bookings.forEach((b) => {
          const bd = new Date(b.start_time);
          if (bd.getFullYear() === keyYear && bd.getMonth() === keyMonth) {
            total += 1;
            if (b.status === 'no_show') no_show += 1;
            else if (b.status === 'cancelled') cancelled += 1;
            else if (b.status === 'in_progress' || b.status === 'ended') {
              checked_in += 1;
            }
          }
        });

        points.push({ label, total, checked_in, no_show, cancelled });
      }
      return points;
    }

    // 7d / 30d: bucket by day
    const days =
      timeRange === '7d' ? 7 : 30;
    const points: TimelinePoint[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - i
      );

      const label = d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });

      const dayStr = d.toISOString().split('T')[0];

      let total = 0;
      let checked_in = 0;
      let no_show = 0;
      let cancelled = 0;

      bookings.forEach((b) => {
        const bdStr = b.start_time.split('T')[0];
        if (bdStr === dayStr) {
          total += 1;
          if (b.status === 'no_show') no_show += 1;
          else if (b.status === 'cancelled') cancelled += 1;
          else if (b.status === 'in_progress' || b.status === 'ended') {
            checked_in += 1;
          }
        }
      });

      points.push({ label, total, checked_in, no_show, cancelled });
    }

    return points;
  };

  const timeline = buildTimeline();

  const maxTimelineY =
    timeline.length === 0
      ? 0
      : Math.max(
          ...timeline.map((p) =>
            Math.max(
              enabledSeries.total ? p.total : 0,
              enabledSeries.checked_in ? p.checked_in : 0,
              enabledSeries.no_show ? p.no_show : 0,
              enabledSeries.cancelled ? p.cancelled : 0
            )
          )
        );

  const seriesMeta: Record<
    SeriesKey,
    { label: string; color: string; strokeDasharray?: string }
  > = {
    total: { label: 'Total', color: '#111827' }, // gray-900
    checked_in: { label: 'Checked in', color: '#059669' }, // emerald-600
    no_show: { label: 'No show', color: '#f59e0b' }, // amber-500
    cancelled: { label: 'Cancelled', color: '#e11d48' }, // rose-600
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Analytics
          </h1>
          <p className="mt-2 text-gray-600 max-w-2xl">
            Understand how your rooms are being used over time: booking volume,
            no‑shows, and where bookings are coming from.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.2em] text-gray-500">
            Time range
          </span>
          <div className="inline-flex rounded-full bg-white shadow-sm border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setTimeRange('7d')}
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                timeRange === '7d'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              7 days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                timeRange === '30d'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              30 days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('12m')}
              className={`px-3 py-1 text-xs font-semibold rounded-full ${
                timeRange === '12m'
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              12 months
            </button>
          </div>
        </div>
      </div>

      {/* Timeline chart */}
      <Card className="rounded-3xl bg-white tablet-shadow border-0 md:-mx-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Booking trend
            </h2>
            <p className="text-xs text-gray-500">
              Daily / monthly booking volume by outcome.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {(Object.keys(seriesMeta) as SeriesKey[]).map((key) => {
              const meta = seriesMeta[key];
              const active = enabledSeries[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    setEnabledSeries((prev) => ({
                      ...prev,
                      [key]: !prev[key],
                    }))
                  }
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] ${
                    active
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        {timeline.length === 0 || maxTimelineY === 0 ? (
          <p className="text-xs text-gray-500">
            Not enough data in this period to show a trend.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="w-full h-48">
              <svg viewBox="0 0 100 40" className="w-full h-full">
                {/* Grid lines */}
                <line
                  x1="0"
                  y1="35"
                  x2="100"
                  y2="35"
                  stroke="#e5e7eb"
                  strokeWidth="0.3"
                />
                <line
                  x1="0"
                  y1="20"
                  x2="100"
                  y2="20"
                  stroke="#e5e7eb"
                  strokeWidth="0.3"
                />
                <line
                  x1="0"
                  y1="5"
                  x2="100"
                  y2="5"
                  stroke="#e5e7eb"
                  strokeWidth="0.3"
                />

                {(Object.keys(seriesMeta) as SeriesKey[]).map((key) => {
                  if (!enabledSeries[key]) return null;
                  const meta = seriesMeta[key];

                  const path = timeline
                    .map((point, index) => {
                      const x =
                        timeline.length === 1
                          ? 50
                          : (index / (timeline.length - 1)) * 100;
                      const value = point[key];
                      const y =
                        35 -
                        (value / (maxTimelineY || 1)) * 25; // 5..35 area
                      const cmd = index === 0 ? 'M' : 'L';
                      return `${cmd}${x},${y}`;
                    })
                    .join(' ');

                  return (
                    <path
                      key={key}
                      d={path}
                      fill="none"
                      stroke={meta.color}
                      strokeWidth={1.2}
                    />
                  );
                })}
              </svg>
            </div>

            {/* X-axis labels */}
            <div className="flex justify-between text-[11px] text-gray-500">
              {timeline.map((point, index) => {
                const isEdge =
                  index === 0 ||
                  index === timeline.length - 1 ||
                  (timeRange !== '7d' && index % 3 === 0);
                if (!isEdge) return <span key={point.label} />;
                return <span key={point.label}>{point.label}</span>;
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="rounded-3xl bg-white tablet-shadow border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
              Total bookings
            </p>
            <BarChart3 className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {loading ? '—' : totalBookings}
          </p>
          <p className="mt-1 text-xs text-gray-500">{timeRangeLabel}</p>
        </Card>

        <Card className="rounded-3xl bg-white tablet-shadow border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
              Booked time
            </p>
            <Clock className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {loading ? '—' : formatHours(totalBookedHours)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Sum of all booking durations
          </p>
        </Card>

        <Card className="rounded-3xl bg-white tablet-shadow border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
              No‑show rate
            </p>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {loading ? '—' : `${noShowRate}%`}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Based on bookings marked as <span className="font-semibold">no_show</span>
          </p>
        </Card>

        <Card className="rounded-3xl bg-white tablet-shadow border-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.15em] text-gray-500">
              Cancelled
            </p>
            <PieChart className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-semibold text-gray-900">
            {loading ? '—' : `${cancelledRate}%`}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Share of bookings cancelled in {timeRangeLabel.toLowerCase()}
          </p>
        </Card>
      </div>

      {/* Distribution sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* By source */}
        <Card className="rounded-3xl bg-white tablet-shadow border-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Bookings by source
            </h2>
            <span className="text-xs text-gray-500">{timeRangeLabel}</span>
          </div>

          {sourceBars.length === 0 ? (
            <p className="text-xs text-gray-500">No bookings in this period.</p>
          ) : (
            <div className="space-y-3">
              {sourceBars.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-800">
                      {item.key === 'tablet'
                        ? 'Tablet'
                        : item.key === 'web'
                        ? 'Web'
                        : item.key === 'admin'
                        ? 'Admin'
                        : item.key === 'api'
                        ? 'API'
                        : 'Other'}
                    </span>
                    <span className="text-gray-500">
                      {item.count} · {item.percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gray-900"
                      style={{ width: `${item.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* By location */}
        <Card className="rounded-3xl bg-white tablet-shadow border-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">
              Bookings by location
            </h2>
            <span className="text-xs text-gray-500">{timeRangeLabel}</span>
          </div>

          {locationBars.length === 0 ? (
            <p className="text-xs text-gray-500">No bookings in this period.</p>
          ) : (
            <div className="space-y-3">
              {locationBars.map((item) => (
                <div key={item.key} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-800">
                      {item.key}
                    </span>
                    <span className="text-gray-500">
                      {item.count} · {item.percent}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500"
                      style={{ width: `${item.percent}%` }}
                    />
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


