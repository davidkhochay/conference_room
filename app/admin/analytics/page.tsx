'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Clock, PieChart as PieChartIcon, BarChart3, AlertTriangle } from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

type BookingStatus =
  | 'scheduled'
  | 'in_progress'
  | 'ended'
  | 'cancelled'
  | 'no_show';

type BookingSource = 'tablet' | 'web' | 'api' | 'admin' | 'google_calendar' | string;

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
  const [sourceChartView, setSourceChartView] = useState<'bar' | 'pie'>('bar');

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
        limit: '0', // No limit for analytics - we need all bookings
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

      // Use local date components for comparison (avoids UTC timezone issues)
      const targetYear = d.getFullYear();
      const targetMonth = d.getMonth();
      const targetDay = d.getDate();

      let total = 0;
      let checked_in = 0;
      let no_show = 0;
      let cancelled = 0;

      bookings.forEach((b) => {
        const bd = new Date(b.start_time);
        // Compare using local date components
        if (
          bd.getFullYear() === targetYear &&
          bd.getMonth() === targetMonth &&
          bd.getDate() === targetDay
        ) {
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
          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={timeline}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="gradientTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientCheckedIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientNoShow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientCancelled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  interval={timeRange === '7d' ? 0 : 'preserveStartEnd'}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                />
                {enabledSeries.total && (
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="#111827"
                    strokeWidth={2}
                    fill="url(#gradientTotal)"
                  />
                )}
                {enabledSeries.checked_in && (
                  <Area
                    type="monotone"
                    dataKey="checked_in"
                    name="Checked in"
                    stroke="#059669"
                    strokeWidth={2}
                    fill="url(#gradientCheckedIn)"
                  />
                )}
                {enabledSeries.no_show && (
                  <Area
                    type="monotone"
                    dataKey="no_show"
                    name="No show"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fill="url(#gradientNoShow)"
                  />
                )}
                {enabledSeries.cancelled && (
                  <Area
                    type="monotone"
                    dataKey="cancelled"
                    name="Cancelled"
                    stroke="#e11d48"
                    strokeWidth={2}
                    fill="url(#gradientCancelled)"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
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
            <PieChartIcon className="w-4 h-4 text-gray-400" />
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
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Bookings by source
              </h2>
              <p className="text-xs text-gray-500">{timeRangeLabel}</p>
            </div>
            {/* Toggle switch */}
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                type="button"
                onClick={() => setSourceChartView('bar')}
                className={`p-1.5 rounded-md transition-colors ${
                  sourceChartView === 'bar'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Bar chart"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setSourceChartView('pie')}
                className={`p-1.5 rounded-md transition-colors ${
                  sourceChartView === 'pie'
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Pie chart"
              >
                <PieChartIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {sourceBars.length === 0 ? (
            <p className="text-xs text-gray-500">No bookings in this period.</p>
          ) : sourceChartView === 'bar' ? (
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={sourceBars.map((item) => ({
                    name:
                      item.key === 'tablet'
                        ? 'Tablet'
                        : item.key === 'web'
                        ? 'Web'
                        : item.key === 'admin'
                        ? 'Admin'
                        : item.key === 'api' || item.key === 'google_calendar'
                        ? 'Google Calendar'
                        : 'Other',
                    value: item.count,
                    percent: item.percent,
                  }))}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#374151' }}
                    width={75}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, _name: string, props: { payload: { percent: number } }) => [
                      `${value} bookings (${props.payload.percent}%)`,
                      '',
                    ]}
                    labelStyle={{ fontWeight: 600, marginBottom: '4px' }}
                  />
                  <Bar
                    dataKey="value"
                    fill="#111827"
                    radius={[0, 4, 4, 0]}
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="w-full h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceBars.map((item, index) => ({
                      name:
                        item.key === 'tablet'
                          ? 'Tablet'
                          : item.key === 'web'
                          ? 'Web'
                          : item.key === 'admin'
                          ? 'Admin'
                          : item.key === 'api' || item.key === 'google_calendar'
                          ? 'Google Calendar'
                          : 'Other',
                      value: item.count,
                      percent: item.percent,
                      color: ['#111827', '#3b82f6', '#059669', '#f59e0b', '#e11d48'][index % 5],
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                    label={({ name, percent }) => `${name} ${percent}%`}
                    labelLine={false}
                  >
                    {sourceBars.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={['#111827', '#3b82f6', '#059669', '#f59e0b', '#e11d48'][index % 5]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                    }}
                    formatter={(value: number, _name: string, props: { payload: { percent: number } }) => [
                      `${value} bookings (${props.payload.percent}%)`,
                      '',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
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


