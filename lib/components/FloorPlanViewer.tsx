'use client';

import React from 'react';
import { Floor, Room } from '@/lib/types/database.types';
import FloorPlanCanvas from '@/lib/components/FloorPlanCanvas';
interface RoomStatus {
  roomId: string;
  isOccupied: boolean;
  nextBookingTime?: string;
}

interface FloorPlanViewerProps {
  floor: Floor;
  rooms: Room[];
  roomStatuses: Record<string, RoomStatus>;
  currentRoomId?: string;
  onRoomClick?: (roomId: string) => void;
  showTestPins?: boolean;
}

export default function FloorPlanViewer({ 
  floor, 
  rooms, 
  roomStatuses, 
  currentRoomId, 
  onRoomClick,
  showTestPins = true,
}: FloorPlanViewerProps) {
  const walls = React.useMemo(() => {
    try {
      return floor.svg_content ? JSON.parse(floor.svg_content) : [];
    } catch {
      return [];
    }
  }, [floor.svg_content]);

  const testPins = React.useMemo(() => {
    try {
      if (!floor.test_pins) return null;
      return typeof floor.test_pins === 'string' 
        ? JSON.parse(floor.test_pins) 
        : floor.test_pins;
    } catch {
      return null;
    }
  }, [floor.test_pins]);

  const centerPin = testPins ? {
    x: (testPins.tl.x + testPins.tr.x + testPins.bl.x + testPins.br.x) / 4,
    y: (testPins.tl.y + testPins.tr.y + testPins.bl.y + testPins.br.y) / 4
  } : null;

  const mappedRooms = rooms.filter(r => r.floor_id === floor.id && r.map_position);
  const currentMappedRoom = currentRoomId ? mappedRooms.find(r => r.id === currentRoomId) : null;

  return (
    <div className="relative w-full h-full bg-gray-50 flex items-center justify-center overflow-auto p-8">
      {/* Shared canvas keeps scaling identical to editor and tablet views */}
      <FloorPlanCanvas floor={floor}>
          {/* Test Pins - Saved from Editor (optional) */}
          {showTestPins && testPins && (
            <g>
              {/* Top-left */}
              <g>
                <circle cx={testPins.tl.x} cy={testPins.tl.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                <text x={testPins.tl.x} y={testPins.tl.y + 20} textAnchor="middle" className="text-xs font-bold fill-red-600">TL ({Math.round(testPins.tl.x)},{Math.round(testPins.tl.y)})</text>
              </g>
              
              {/* Top-right */}
              <g>
                <circle cx={testPins.tr.x} cy={testPins.tr.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                <text x={testPins.tr.x} y={testPins.tr.y + 20} textAnchor="middle" className="text-xs font-bold fill-red-600">TR ({Math.round(testPins.tr.x)},{Math.round(testPins.tr.y)})</text>
              </g>
              
              {/* Bottom-left */}
              <g>
                <circle cx={testPins.bl.x} cy={testPins.bl.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                <text x={testPins.bl.x} y={testPins.bl.y - 10} textAnchor="middle" className="text-xs font-bold fill-red-600">BL ({Math.round(testPins.bl.x)},{Math.round(testPins.bl.y)})</text>
              </g>
              
              {/* Bottom-right */}
              <g>
                <circle cx={testPins.br.x} cy={testPins.br.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                <text x={testPins.br.x} y={testPins.br.y - 10} textAnchor="middle" className="text-xs font-bold fill-red-600">BR ({Math.round(testPins.br.x)},{Math.round(testPins.br.y)})</text>
              </g>
              
              {/* Center (calculated) */}
              {centerPin && (
                <g>
                  <circle cx={centerPin.x} cy={centerPin.y} r="10" fill="orange" stroke="white" strokeWidth="2" />
                  <text x={centerPin.x} y={centerPin.y + 20} textAnchor="middle" className="text-xs font-bold fill-orange-600">CENTER ({Math.round(centerPin.x)},{Math.round(centerPin.y)})</text>
                </g>
              )}
            </g>
          )}

          {/* Drawn Walls */}
          {walls.map((d: string, i: number) => (
            <path key={i} d={d} fill="none" stroke="#374151" strokeWidth="4" strokeLinecap="round" />
          ))}

          {/* Rooms */}
          {mappedRooms.map(room => {
            const pos = room.map_position as any;
            const status = roomStatuses[room.id] || { isOccupied: false };
            const isCurrent = currentRoomId === room.id;
            
            let fillColor = status.isOccupied ? '#ef4444' : '#10b981';
            let strokeColor = status.isOccupied ? '#b91c1c' : '#059669';
            
            if (isCurrent) {
              fillColor = '#3b82f6';
              strokeColor = '#1d4ed8';
            }

            return (
              <g 
                key={room.id} 
                onClick={() => onRoomClick?.(room.id)}
                className={`cursor-pointer transition-all duration-200 ${onRoomClick ? 'hover:opacity-80' : ''}`}
              >
                <rect
                  x={pos.x}
                  y={pos.y}
                  width={pos.width}
                  height={pos.height}
                  fill={fillColor}
                  fillOpacity={isCurrent ? "0.5" : "0.3"}
                  stroke={strokeColor}
                  strokeWidth={isCurrent ? "4" : "2"}
                  rx="4"
                />

                <text
                  x={pos.x + pos.width / 2}
                  y={pos.y + pos.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs font-bold fill-gray-900 pointer-events-none select-none"
                  style={{ fontSize: Math.min(pos.width, pos.height) / 5 }}
                >
                  {room.name}
                </text>
                
                <circle
                  cx={pos.x + pos.width - 10}
                  cy={pos.y + 10}
                  r="4"
                  fill={status.isOccupied ? "#ef4444" : "#10b981"}
                  stroke="white"
                  strokeWidth="1"
                />
              </g>
            );
          })}
          
          {/* "You Are Here" Pin */}
          {currentMappedRoom && (() => {
            const pos = currentMappedRoom.map_position as any;
            const hasCustomYou =
              typeof pos.you_x === 'number' && typeof pos.you_y === 'number';
            const centerX = hasCustomYou ? pos.you_x : pos.x + pos.width / 2;
            const centerY = hasCustomYou ? pos.you_y : pos.y + pos.height / 2;
            const rippleRadius = Math.min(pos.width, pos.height) / 3;
            
            return (
              <g transform={`translate(${centerX}, ${centerY})`}>
                {/* Ripple is anchored exactly to the same center as the marker */}
                <circle
                  r={rippleRadius}
                  className="animate-ping"
                  fill="#2563eb"
                  opacity="0.3"
                />
                <circle r="8" fill="#2563eb" stroke="white" strokeWidth="2" />
                <text y="-15" textAnchor="middle" className="text-xs font-bold fill-blue-700">You</text>
              </g>
            );
          })()}
      </FloorPlanCanvas>
    </div>
  );
}
