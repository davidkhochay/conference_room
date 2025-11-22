'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin } from 'lucide-react';
import FloorPlanViewer from '@/lib/components/FloorPlanViewer';
import { Floor, Room } from '@/lib/types/database.types';

interface Location {
  id: string;
  name: string;
}

export default function MapsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [floorRooms, setFloorRooms] = useState<Room[]>([]);
  const [roomStatuses, setRoomStatuses] = useState<
    Record<string, { roomId: string; isOccupied: boolean; uiState?: 'free' | 'checkin' | 'busy' }>
  >({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const res = await fetch('/api/admin/locations');
        const data = await res.json();
        if (data.success) {
          setLocations(data.data);
          if (data.data.length > 0) {
            setSelectedLocationId(data.data[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLocations();
  }, []);

  useEffect(() => {
    if (!selectedLocationId) return;

    const fetchFloors = async () => {
      try {
        const res = await fetch(`/api/admin/locations/${selectedLocationId}/floors`);
        const data = await res.json();
        if (data.success) {
          setFloors(data.data);
          if (data.data.length > 0) {
            setSelectedFloorId(data.data[0].id);
          } else {
            setSelectedFloorId(null);
            setFloorRooms([]);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchFloors();
  }, [selectedLocationId]);

  useEffect(() => {
    if (!selectedLocationId) return;

    // Fetch all rooms for location to pass to viewer (it filters by floor_id)
    // And fetch statuses
    const fetchRoomsAndStatus = async () => {
      try {
        const roomsRes = await fetch(`/api/rooms?location_id=${selectedLocationId}`);
        const roomsData = await roomsRes.json();
        if (roomsData.success) {
          setFloorRooms(roomsData.data);
          
          // Fetch status
          // In a real app, use a bulk status API. Here we do parallel fetch.
          const statusPromises = roomsData.data.map((r: Room) => 
            fetch(`/api/rooms/${r.id}/status`).then(res => res.json())
          );
          const statuses = await Promise.all(statusPromises);
          const statusMap: Record<string, any> = {};
          statuses.forEach((s: any) => {
            if (s.success) {
              const uiState = (s.data.ui_state || 'free') as 'free' | 'checkin' | 'busy';
              statusMap[s.data.room_id] = {
                roomId: s.data.room_id,
                // Treat both busy and check-in as not freely available on the map
                isOccupied: uiState === 'busy' || uiState === 'checkin',
                uiState,
              };
            }
          });
          setRoomStatuses(statusMap);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchRoomsAndStatus();

    // Poll status every 30s
    const interval = setInterval(fetchRoomsAndStatus, 30000);
    return () => clearInterval(interval);
  }, [selectedLocationId]);

  const selectedFloor = floors.find(f => f.id === selectedFloorId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8 flex items-center gap-4">
          <Link href="/">
            <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Floor Maps</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-8">
          {/* Sidebar */}
          <div className="space-y-8">
            {/* Locations */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                Locations
              </h2>
              <div className="space-y-2">
                {locations.map(loc => (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocationId(loc.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${
                      selectedLocationId === loc.id 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <MapPin className="w-5 h-5" />
                    {loc.name}
                  </button>
                ))}
                {locations.length === 0 && !loading && (
                  <div className="text-gray-400 text-sm">No locations found</div>
                )}
              </div>
            </div>

            {/* Floors */}
            {floors.length > 0 && (
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Floors
                </h2>
                <div className="space-y-2">
                  {floors.map(floor => (
                    <button
                      key={floor.id}
                      onClick={() => setSelectedFloorId(floor.id)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                        selectedFloorId === floor.id 
                          ? 'bg-gray-900 text-white font-medium shadow-md' 
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      {floor.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map Viewer */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden min-h-[600px]">
            {selectedFloor ? (
              <FloorPlanViewer
                floor={selectedFloor}
                rooms={floorRooms}
                roomStatuses={roomStatuses}
                showTestPins={false}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 p-12 text-center">
                <MapPin className="w-16 h-16 mb-4 opacity-20" />
                <p className="text-xl">Select a location and floor to view the map</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

