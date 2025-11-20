'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';

export default function AdminSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [form, setForm] = useState({
    booking_hours_start: '7',
    booking_hours_end: '19',
    tablet_admin_pin: '',
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/admin/settings');
        const result = await res.json();
        if (result.success) {
          setForm({
            booking_hours_start: String(result.data.booking_hours_start ?? '7'),
            booking_hours_end: String(result.data.booking_hours_end ?? '19'),
            tablet_admin_pin: String(result.data.tablet_admin_pin ?? ''),
          });
        } else {
          setError(result.error?.message || 'Failed to load settings');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Basic validation: PIN must be 4–6 digits
    if (form.tablet_admin_pin && !/^\d{4,6}$/.test(form.tablet_admin_pin)) {
      setError('Tablet admin PIN must be 4–6 digits (numbers only).');
      setSaving(false);
      return;
    }

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await res.json();

      if (result.success) {
        setSuccess('Settings saved');
      } else {
        setError(result.error?.message || 'Failed to save settings');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="mt-2 text-gray-600">
            Configure booking rules and tablet admin access for this workspace.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_minmax(0,1fr)] gap-8">
          {/* Left sidebar nav (structure only) */}
          <aside>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 space-y-6">
              <div>
                <div className="text-xs font-semibold text-gray-400 tracking-wide mb-2">
                  WORKSPACE
                </div>
                <nav className="space-y-1">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-medium"
                  >
                    General
                  </button>
                </nav>
              </div>
            </div>
          </aside>

          {/* Main settings content */}
          <main>
            <form onSubmit={handleSave} className="space-y-8">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
                  {success}
                </div>
              )}

              {/* Booking hours panel */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Booking hours
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Control when rooms can be booked during the day.
                  </p>
                </div>
                <div className="px-6 py-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Booking hours start
                      </label>
                      <select
                        value={form.booking_hours_start}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, booking_hours_start: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                      >
                        <option value="7">7:00 AM</option>
                        <option value="8">8:00 AM</option>
                        <option value="9">9:00 AM</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Booking hours end
                      </label>
                      <select
                        value={form.booking_hours_end}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, booking_hours_end: e.target.value }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 text-sm"
                      >
                        <option value="17">5:00 PM</option>
                        <option value="18">6:00 PM</option>
                        <option value="19">7:00 PM</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tablet admin panel */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 className="text-sm font-semibold text-gray-900">
                    Tablet admin access
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Set the PIN required to open the admin controls from a room tablet.
                  </p>
                </div>
                <div className="px-6 py-5 space-y-4">
                  <Input
                    label="Tablet admin PIN"
                    type="password"
                    value={form.tablet_admin_pin}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, tablet_admin_pin: e.target.value }))
                    }
                    name="tablet-admin-pin"
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="new-password"
                    placeholder="4–6 digits"
                  />
                  <p className="text-xs text-gray-500">
                    Use 4–6 digits. This PIN is shared across all tablets in this workspace.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save changes'}
                </Button>
              </div>
            </form>
          </main>
        </div>
      </div>
    </div>
  );
}


