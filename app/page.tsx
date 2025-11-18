import Link from 'next/link';
import { Button } from '@/lib/components/ui/Button';
import { Calendar, DoorOpen, Monitor, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600">
      <div className="min-h-screen bg-black/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-16">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-6xl font-bold text-white mb-4">
              Good Life Room Booking
            </h1>
            <p className="text-2xl text-white/90">
              Conference room management across all Good Life Group companies
            </p>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <Link href="/book">
              <div className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all hover:scale-105 cursor-pointer h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                    <Calendar className="w-8 h-8 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Book a Room</h2>
                  <p className="text-gray-600">
                    Find and book conference rooms across all locations
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/admin">
              <div className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all hover:scale-105 cursor-pointer h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Admin Panel</h2>
                  <p className="text-gray-600">
                    Manage rooms, users, and view analytics
                  </p>
                </div>
              </div>
            </Link>

            <Link href="/tablet">
              <div className="bg-white rounded-2xl p-8 shadow-2xl hover:shadow-3xl transition-all hover:scale-105 cursor-pointer h-full">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <Monitor className="w-8 h-8 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Tablet Display</h2>
                  <p className="text-gray-600">
                    View room status and quick book from tablets
                  </p>
                </div>
              </div>
            </Link>

            <div className="bg-white rounded-2xl p-8 shadow-2xl">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <DoorOpen className="w-8 h-8 text-orange-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Quick Stats</h2>
                <div className="text-left w-full mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active Rooms:</span>
                    <span className="font-semibold">24</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Locations:</span>
                    <span className="font-semibold">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Companies:</span>
                    <span className="font-semibold">7</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold text-white mb-12">Platform Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
                <h3 className="text-xl font-bold mb-2">Google Calendar Integration</h3>
                <p className="text-white/80">
                  Seamlessly sync with Google Calendar and manage room resources
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
                <h3 className="text-xl font-bold mb-2">Multi-Domain Support</h3>
                <p className="text-white/80">
                  Connect multiple Google Workspace domains under one platform
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-white">
                <h3 className="text-xl font-bold mb-2">Real-Time Status</h3>
                <p className="text-white/80">
                  Live room availability and instant booking confirmation
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
