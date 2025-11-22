import Link from 'next/link';
import { Calendar, DoorOpen, Monitor, Shield, Map } from 'lucide-react';

export default function Home() {
  return (
    <div className="full-viewport bg-[#F7F3EC]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {/* Header */}
        <header className="text-center mb-20">
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
            Good Life Rooms
          </h1>
          <p className="text-lg md:text-2xl text-gray-700 max-w-2xl mx-auto">
            A calm control center for booking, monitoring, and managing every conference room.
          </p>
        </header>

        {/* Main Actions */}
        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Link href="/book">
            <div className="cursor-pointer rounded-3xl bg-white px-8 py-10 tablet-shadow hover:translate-y-0.5 transition-transform h-full">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-full bg-[#E3F2FF] flex items-center justify-center">
                  <Calendar className="w-7 h-7 text-[#2563EB]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-1">Book</h2>
                  <p className="text-gray-600">
                    Find a room and reserve it in a few taps.
                  </p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/tablet">
            <div className="cursor-pointer rounded-3xl bg-white px-8 py-10 tablet-shadow hover:translate-y-0.5 transition-transform h-full">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-full bg-[#E6F9EE] flex items-center justify-center">
                  <Monitor className="w-7 h-7 text-[#34CB57]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-1">Tablet mode</h2>
                  <p className="text-gray-600">
                    Live wall displays for every room, color-coded at a glance.
                  </p>
                </div>
              </div>
            </div>
          </Link>
          
          <Link href="/maps">
            <div className="cursor-pointer rounded-3xl bg-white px-8 py-10 tablet-shadow hover:translate-y-0.5 transition-transform h-full">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center">
                  <Map className="w-7 h-7 text-[#D97706]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-1">Maps</h2>
                  <p className="text-gray-600">
                    Interactive floor plans to find rooms and colleagues.
                  </p>
                </div>
              </div>
            </div>
          </Link>

          <Link href="/admin">
            <div className="cursor-pointer rounded-3xl bg-white px-8 py-10 tablet-shadow hover:translate-y-0.5 transition-transform h-full">
              <div className="flex flex-col gap-4">
                <div className="w-12 h-12 rounded-full bg-[#F4E9FF] flex items-center justify-center">
                  <Shield className="w-7 h-7 text-[#7C3AED]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900 mb-1">Admin</h2>
                  <p className="text-gray-600">
                    Configure rooms, locations, and see how spaces are used.
                  </p>
                </div>
              </div>
            </div>
          </Link>
        </main>
      </div>
    </div>
  );
}
