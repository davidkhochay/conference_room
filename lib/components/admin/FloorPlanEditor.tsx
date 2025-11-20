'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Floor, Room } from '@/lib/types/database.types';
import { Button } from '@/lib/components/ui/Button';
import { Input } from '@/lib/components/ui/Input';
import { ImageUpload } from '@/lib/components/ImageUpload';
import FloorPlanCanvas from '@/lib/components/FloorPlanCanvas';
import FloorPlanViewer from '@/lib/components/FloorPlanViewer';
import { Trash2, X } from 'lucide-react';

interface FloorPlanEditorProps {
  locationId: string;
  initialFloors: Floor[];
  initialRooms: Room[];
}

type Tool = 'select' | 'wall' | 'box' | 'room' | 'erase';

export default function FloorPlanEditor({ locationId, initialFloors, initialRooms }: FloorPlanEditorProps) {
  const [floors, setFloors] = useState<Floor[]>(initialFloors);
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(initialFloors[0]?.id || null);
  const [loading, setLoading] = useState(false);
  
  // Editor state
  const [tool, setTool] = useState<Tool>('select');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [walls, setWalls] = useState<string[]>([]); // Array of path strings
  const [drawingPath, setDrawingPath] = useState<{x: number, y: number}[]>([]);
  
  // Selection & Dragging state
  const [selectedWallIndex, setSelectedWallIndex] = useState<number | null>(null);
  const [draggingWallIndex, setDraggingWallIndex] = useState<number | null>(null);
  const [resizingHandleIndex, setResizingHandleIndex] = useState<number | null>(null);
  const [lastMousePos, setLastMousePos] = useState<{x: number, y: number} | null>(null);
  const [draggingRoomId, setDraggingRoomId] = useState<string | null>(null);
  const [selectedMappedRoomId, setSelectedMappedRoomId] = useState<string | null>(null);
  const [resizingRoomHandle, setResizingRoomHandle] = useState<{roomId: string, corner: string} | null>(null);
  const [testPins, setTestPins] = useState({
    tl: { x: 50, y: 50 },
    tr: { x: 950, y: 50 },
    bl: { x: 50, y: 750 },
    br: { x: 950, y: 750 }
  });
  const [draggingPin, setDraggingPin] = useState<string | null>(null);
  const [placingPin, setPlacingPin] = useState<string | null>(null);
  const [showTabletPreview, setShowTabletPreview] = useState(false);
  const [placingYouRoomId, setPlacingYouRoomId] = useState<string | null>(null);
  
  // Calculate center from the 4 corner pins
  const centerPin = {
    x: (testPins.tl.x + testPins.tr.x + testPins.bl.x + testPins.br.x) / 4,
    y: (testPins.tl.y + testPins.tr.y + testPins.bl.y + testPins.br.y) / 4
  };
  
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);

  const selectedFloor = floors.find(f => f.id === selectedFloorId);

  useEffect(() => {
    if (selectedFloor?.svg_content) {
      try {
        setWalls(JSON.parse(selectedFloor.svg_content));
      } catch {
        setWalls([]);
      }
    } else {
      setWalls([]);
    }

    // Load test pins
    if (selectedFloor?.test_pins) {
      try {
        const pins = typeof selectedFloor.test_pins === 'string' 
          ? JSON.parse(selectedFloor.test_pins) 
          : selectedFloor.test_pins;
        setTestPins(pins);
      } catch {
        // Keep default pins
      }
    }
  }, [selectedFloor]);

  // Ensure the logical floor width/height matches the actual floorplan image
  // aspect ratio so that the editor and tablet/map views line up perfectly.
  useEffect(() => {
    if (!selectedFloor || !selectedFloor.image_url) return;

    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;

      const aspect = img.naturalHeight / img.naturalWidth;
      const baseWidth = 1000;
      const newWidth = baseWidth;
      const newHeight = Math.round(baseWidth * aspect);

      if (selectedFloor.width === newWidth && selectedFloor.height === newHeight) {
        return;
      }

      setFloors(prev =>
        prev.map(f =>
          f.id === selectedFloor.id
            ? { ...f, width: newWidth, height: newHeight }
            : f
        )
      );
    };
    img.src = selectedFloor.image_url;
  }, [selectedFloor?.id, selectedFloor?.image_url, selectedFloor?.width, selectedFloor?.height]);

  const handleCreateFloor = async () => {
    const name = prompt('Enter floor name (e.g. "Floor 2")');
    if (!name) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/locations/${locationId}/floors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name,
          level: floors.length + 1,
          // NOTE:
          // width/height define the logical coordinate system for this floor.
          // All walls, pins and room map_position values are stored in this
          // space and any viewer should render using these dimensions as its
          // SVG viewBox (so everything scales consistently across editor,
          // /maps and tablet views).
          width: 1000,
          height: 800,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setFloors([...floors, result.data]);
        setSelectedFloorId(result.data.id);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create floor');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFloor = async (e: React.MouseEvent, floorId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this floor? All walls and room mappings on it will be lost.')) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/locations/${locationId}/floors/${floorId}`, {
        method: 'DELETE',
      });
      const result = await res.json();
      if (result.success) {
        setFloors(floors.filter(f => f.id !== floorId));
        if (selectedFloorId === floorId) {
          setSelectedFloorId(null);
        }
      } else {
        alert('Failed to delete floor');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete floor');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFloor) return;
    setLoading(true);

    try {
      // Save Floor (walls/image/test pins)
      const floorRes = await fetch(`/api/admin/locations/${locationId}/floors/${selectedFloor.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...selectedFloor,
          svg_content: JSON.stringify(walls),
          test_pins: JSON.stringify(testPins),
        }),
      });
      const floorResult = await floorRes.json();

      if (floorResult.success) {
        // Update local state with the saved floor data
        setFloors(floors.map(f => f.id === selectedFloor.id ? floorResult.data : f));
      } else {
        throw new Error(floorResult.error?.message || 'Failed to save floor');
      }

      // Save Rooms (positions)
      const roomsToUpdate = rooms.filter(r => r.floor_id === selectedFloor.id);
      await Promise.all(roomsToUpdate.map(room => 
        fetch(`/api/rooms/${room.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            floor_id: room.floor_id,
            map_position: room.map_position,
          }),
        })
      ));

      alert('Saved successfully');
    } catch (err) {
      console.error(err);
      alert('Failed to save changes');
    } finally {
      setLoading(false);
    }
  };

  const getMousePos = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const CTM = svgRef.current.getScreenCTM();
    if (!CTM) return { x: 0, y: 0 };
    return {
      x: (e.clientX - CTM.e) / CTM.a,
      y: (e.clientY - CTM.f) / CTM.d
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!selectedFloor) return;
    const { x, y } = getMousePos(e);

    // Handle placing a per-room \"You\" pin (tablet position)
    if (placingYouRoomId) {
      setRooms(prev =>
        prev.map(r => {
          if (r.id === placingYouRoomId && r.map_position) {
            const pos = r.map_position as any;
            return {
              ...r,
              map_position: {
                ...pos,
                you_x: x,
                you_y: y,
              },
            };
          }
          return r;
        })
      );
      setPlacingYouRoomId(null);
      return;
    }

    // Handle placing a test pin
    if (placingPin) {
      setTestPins(prev => ({
        ...prev,
        [placingPin]: { x, y }
      }));
      setPlacingPin(null);
      return;
    }

    // Clicking on background in select mode deselects
    if (tool === 'select') {
      setSelectedMappedRoomId(null);
      setSelectedWallIndex(null);
    }

    if (tool === 'wall') {
      setDrawingPath([{ x, y }]);
    } else if ((tool === 'room' && selectedRoomId) || tool === 'box') {
      // Start room/box mapping (rectangle)
      setDrawingPath([{ x, y }]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const { x, y } = getMousePos(e);

    // 1. Handle Resizing Rooms
    if (resizingRoomHandle !== null && lastMousePos) {
      const { roomId, corner } = resizingRoomHandle;
      const dx = x - lastMousePos.x;
      const dy = y - lastMousePos.y;

      setRooms(rooms.map(r => {
        if (r.id === roomId && r.map_position) {
          const pos = r.map_position as any;
          let newPos = { ...pos };

          switch (corner) {
            case 'tl':
              newPos.x += dx;
              newPos.y += dy;
              newPos.width -= dx;
              newPos.height -= dy;
              break;
            case 'tr':
              newPos.y += dy;
              newPos.width += dx;
              newPos.height -= dy;
              break;
            case 'bl':
              newPos.x += dx;
              newPos.width -= dx;
              newPos.height += dy;
              break;
            case 'br':
              newPos.width += dx;
              newPos.height += dy;
              break;
          }

          if (newPos.width < 20) newPos.width = 20;
          if (newPos.height < 20) newPos.height = 20;

          return { ...r, map_position: newPos };
        }
        return r;
      }));

      setLastMousePos({ x, y });
      return;
    }

    // 2. Handle Dragging Walls
    if (draggingWallIndex !== null && lastMousePos) {
      const dx = x - lastMousePos.x;
      const dy = y - lastMousePos.y;
      
      const newWalls = [...walls];
      const currentPath = newWalls[draggingWallIndex];
      
      let coordIndex = 0;
      const newPath = currentPath.replace(/-?\d+(\.\d+)?/g, (match) => {
        const val = parseFloat(match);
        const isX = coordIndex % 2 === 0;
        coordIndex++;
        return (val + (isX ? dx : dy)).toString();
      });
      
      newWalls[draggingWallIndex] = newPath;
      setWalls(newWalls);
      setLastMousePos({ x, y });
      return;
    }

    // 3. Handle Dragging Rooms
    if (draggingRoomId !== null && lastMousePos) {
      const dx = x - lastMousePos.x;
      const dy = y - lastMousePos.y;
      
      setRooms(rooms.map(r => {
        if (r.id === draggingRoomId && r.map_position) {
          const pos = r.map_position as any;
          return {
            ...r,
            map_position: {
              ...pos,
              x: pos.x + dx,
              y: pos.y + dy,
            }
          };
        }
        return r;
      }));
      
      setLastMousePos({ x, y });
      return;
    }

    // 4. Handle Dragging Test Pins (center is calculated, so only allow dragging corners)
    if (draggingPin !== null && draggingPin !== 'center') {
      setTestPins(prev => ({
        ...prev,
        [draggingPin]: { x, y }
      }));
      return;
    }

    if (drawingPath.length === 0) return;

    // Snap to 90 degrees if Shift is held (only for drawing new lines)
    let currentX = x;
    let currentY = y;
    if (e.shiftKey && drawingPath.length > 0) {
      const start = drawingPath[0];
      const dx = Math.abs(currentX - start.x);
      const dy = Math.abs(currentY - start.y);
      if (dx > dy) {
        currentY = start.y; // Horizontal
      } else {
        currentX = start.x; // Vertical
      }
    }

    if (tool === 'wall') {
      setDrawingPath(prev => [prev[0], { x: currentX, y: currentY }]);
    } else if (tool === 'room' || tool === 'box') {
      // Update rect end point
      setDrawingPath(prev => [prev[0], { x: currentX, y: currentY }]);
    }
  };

  const handleMouseUp = () => {
    // End dragging/resizing
    setDraggingWallIndex(null);
    setDraggingRoomId(null);
    setResizingRoomHandle(null);
    setDraggingPin(null);
    setLastMousePos(null);

    if (drawingPath.length === 0) return;

    if (tool === 'wall') {
      // Simplify path: just take points. For now, let's just make a polyline
      const start = drawingPath[0];
      const end = drawingPath[drawingPath.length - 1];
      const d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      setWalls([...walls, d]);
      setDrawingPath([]);
    } else if (tool === 'box') {
      // Create box path
      const start = drawingPath[0];
      const end = drawingPath[drawingPath.length - 1];
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const w = Math.abs(end.x - start.x);
      const h = Math.abs(end.y - start.y);
      
      // Draw box as a closed path
      const d = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
      setWalls([...walls, d]);
      setDrawingPath([]);
    } else if (tool === 'room' && selectedRoomId) {
      const start = drawingPath[0];
      const end = drawingPath[drawingPath.length - 1];
      
      const x = Math.min(start.x, end.x);
      const y = Math.min(start.y, end.y);
      const width = Math.abs(end.x - start.x);
      const height = Math.abs(end.y - start.y);

      // Update room
      setRooms(rooms.map(r => r.id === selectedRoomId ? {
        ...r,
        floor_id: selectedFloorId,
        map_position: { x, y, width, height, type: 'rect' }
      } : r));
      
      setDrawingPath([]);
      setSelectedRoomId(null);
      setTool('select');
    }
  };

  const updateFloorImage = (url: string) => {
    if (!selectedFloor) return;
    setFloors(floors.map(f => f.id === selectedFloor.id ? { ...f, image_url: url } : f));
  };

  return (
    <div className="flex h-[calc(100vh-100px)] bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
      {/* Sidebar */}
      <div className="w-64 border-r border-gray-200 flex flex-col bg-gray-50">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Floors</h3>
          <div className="mt-2 space-y-2">
            {floors.map(floor => (
              <div key={floor.id} className="flex items-center gap-1 group">
                <button
                  onClick={() => setSelectedFloorId(floor.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedFloorId === floor.id 
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {floor.name}
                </button>
                <button
                  onClick={(e) => handleDeleteFloor(e, floor.id)}
                  className={`p-2 rounded-md transition-all ${
                    selectedFloorId === floor.id 
                      ? 'text-blue-400 hover:text-red-600 hover:bg-red-50' 
                      : 'text-gray-300 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100'
                  }`}
                  title="Delete floor"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={handleCreateFloor} className="w-full justify-center text-xs">
              + Add Floor
            </Button>
          </div>
        </div>

        {selectedFloor && (
          <div className="p-4 flex-1 overflow-y-auto">
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Tools</h4>
              <div className="space-y-2">
                <Button 
                  variant={tool === 'select' ? 'primary' : 'secondary'} 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setTool('select')}
                >
                  Select / Move
                </Button>
                <Button 
                  variant={tool === 'wall' ? 'primary' : 'secondary'} 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setTool('wall')}
                >
                  Draw Straight Wall
                </Button>
                <Button 
                  variant={tool === 'box' ? 'primary' : 'secondary'} 
                  size="sm" 
                  className="w-full justify-start"
                  onClick={() => setTool('box')}
                >
                  Draw Box
                </Button>
                <Button 
                  variant={tool === 'erase' ? 'primary' : 'secondary'} 
                  size="sm" 
                  className="w-full justify-start text-red-600 hover:text-red-700"
                  onClick={() => setTool('erase')}
                >
                  Eraser
                </Button>
                <p className="text-[10px] text-gray-500 px-1">
                  Select tool allows dragging lines. Erase tool removes them.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Test Pins</h4>
              <div className="space-y-1">
                <button
                  onClick={() => setPlacingPin('tl')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between ${
                    placingPin === 'tl' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-red-400'
                  }`}
                >
                  <span>📍 Top-Left</span>
                  <span className="text-[10px]">({Math.round(testPins.tl.x)},{Math.round(testPins.tl.y)})</span>
                </button>
                <button
                  onClick={() => setPlacingPin('tr')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between ${
                    placingPin === 'tr' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-red-400'
                  }`}
                >
                  <span>📍 Top-Right</span>
                  <span className="text-[10px]">({Math.round(testPins.tr.x)},{Math.round(testPins.tr.y)})</span>
                </button>
                <button
                  onClick={() => setPlacingPin('bl')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between ${
                    placingPin === 'bl' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-red-400'
                  }`}
                >
                  <span>📍 Bottom-Left</span>
                  <span className="text-[10px]">({Math.round(testPins.bl.x)},{Math.round(testPins.bl.y)})</span>
                </button>
                <button
                  onClick={() => setPlacingPin('br')}
                  className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between ${
                    placingPin === 'br' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white border border-gray-200 text-gray-600 hover:border-red-400'
                  }`}
                >
                  <span>📍 Bottom-Right</span>
                  <span className="text-[10px]">({Math.round(testPins.br.x)},{Math.round(testPins.br.y)})</span>
                </button>
              </div>
              <p className="text-[10px] text-gray-500 mt-2 px-1">
                Click a pin, then click on the map to place it. Center auto-calculates.
              </p>
            </div>

            <div className="mb-6">
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Map Rooms</h4>
              <div className="space-y-1">
                {rooms.map(room => {
                  const isMapped = room.floor_id === selectedFloor.id && room.map_position;
                  return (
                    <div key={room.id} className="space-y-1">
                      <button
                        onClick={() => {
                          setTool('room');
                          setSelectedRoomId(room.id);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs flex items-center justify-between ${
                          selectedRoomId === room.id 
                            ? 'bg-blue-600 text-white' 
                            : isMapped 
                              ? 'bg-green-50 text-green-700' 
                              : 'bg-white border border-gray-200 text-gray-600'
                        }`}
                      >
                        <span>{room.name}</span>
                        {isMapped && <span className="text-[10px]">Mapped</span>}
                      </button>
                      {isMapped && (
                        <button
                          type="button"
                          onClick={() => setPlacingYouRoomId(room.id)}
                          className={`w-full text-left px-3 py-1 rounded-md text-[10px] border border-dashed ${
                            placingYouRoomId === room.id
                              ? 'border-blue-500 text-blue-600 bg-blue-50'
                              : 'border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600'
                          }`}
                        >
                          {placingYouRoomId === room.id
                            ? 'Click on the map to place tablet "You" pin'
                            : 'Set tablet "You" pin'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">Background</h4>
              <ImageUpload
                value={selectedFloor.image_url || ''}
                onChange={updateFloorImage}
                label="Floor plan image"
              />
            </div>

            <div className="mt-8 border-t border-gray-200 pt-4">
              <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                Tablet Preview
              </h4>
              <p className="text-[11px] text-gray-500 mb-2">
                Open a live preview of how this floor looks on wall tablets so you can confirm room boxes line up.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full justify-center"
                type="button"
                onClick={() => setShowTabletPreview(true)}
                disabled={!selectedFloor}
              >
                Open tablet preview
              </Button>
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-200">
          <Button onClick={handleSave} disabled={loading} className="w-full">
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="flex-1 bg-gray-100 relative overflow-auto flex items-center justify-center p-8">
        {selectedFloor ? (
          <>
            {/* Shared canvas keeps scaling identical to viewer/tablet */}
            <FloorPlanCanvas
              floor={selectedFloor}
              svgRef={svgRef}
              svgProps={{
                className: tool === 'select' ? '' : 'cursor-crosshair',
                onMouseDown: handleMouseDown,
                onMouseMove: handleMouseMove,
                onMouseUp: handleMouseUp,
                onMouseLeave: handleMouseUp,
              }}
            >
              {/* Grid lines (optional) */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="gray" strokeWidth="0.5" opacity="0.2"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />

              {/* Corner Test Pins - DRAGGABLE to verify coordinate mapping */}
              <g>
                {/* Top-left */}
                <g
                  className="cursor-move"
                  onMouseDown={(e) => {
                    if (placingYouRoomId) return;
                    e.stopPropagation();
                    setDraggingPin('tl');
                  }}
                >
                  <circle cx={testPins.tl.x} cy={testPins.tl.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                  <text x={testPins.tl.x} y={testPins.tl.y + 20} textAnchor="middle" className="text-xs font-bold fill-red-600 pointer-events-none">TL ({Math.round(testPins.tl.x)},{Math.round(testPins.tl.y)})</text>
                </g>
                
                {/* Top-right */}
                <g
                  className="cursor-move"
                  onMouseDown={(e) => {
                    if (placingYouRoomId) return;
                    e.stopPropagation();
                    setDraggingPin('tr');
                  }}
                >
                  <circle cx={testPins.tr.x} cy={testPins.tr.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                  <text x={testPins.tr.x} y={testPins.tr.y + 20} textAnchor="middle" className="text-xs font-bold fill-red-600 pointer-events-none">TR ({Math.round(testPins.tr.x)},{Math.round(testPins.tr.y)})</text>
                </g>
                
                {/* Bottom-left */}
                <g
                  className="cursor-move"
                  onMouseDown={(e) => {
                    if (placingYouRoomId) return;
                    e.stopPropagation();
                    setDraggingPin('bl');
                  }}
                >
                  <circle cx={testPins.bl.x} cy={testPins.bl.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                  <text x={testPins.bl.x} y={testPins.bl.y - 10} textAnchor="middle" className="text-xs font-bold fill-red-600 pointer-events-none">BL ({Math.round(testPins.bl.x)},{Math.round(testPins.bl.y)})</text>
                </g>
                
                {/* Bottom-right */}
                <g
                  className="cursor-move"
                  onMouseDown={(e) => {
                    if (placingYouRoomId) return;
                    e.stopPropagation();
                    setDraggingPin('br');
                  }}
                >
                  <circle cx={testPins.br.x} cy={testPins.br.y} r="10" fill="red" stroke="white" strokeWidth="2" />
                  <text x={testPins.br.x} y={testPins.br.y - 10} textAnchor="middle" className="text-xs font-bold fill-red-600 pointer-events-none">BR ({Math.round(testPins.br.x)},{Math.round(testPins.br.y)})</text>
                </g>
                
                {/* Center (calculated from corners) */}
                <g pointerEvents="none">
                  <circle cx={centerPin.x} cy={centerPin.y} r="10" fill="orange" stroke="white" strokeWidth="2" />
                  <text x={centerPin.x} y={centerPin.y + 20} textAnchor="middle" className="text-xs font-bold fill-orange-600">CENTER ({Math.round(centerPin.x)},{Math.round(centerPin.y)})</text>
                </g>
              </g>

              {/* Drawn Walls */}
              {walls.map((d, i) => (
                <path 
                  key={i} 
                  d={d} 
                  fill="none" 
                  stroke={tool === 'erase' ? '#ef4444' : (draggingWallIndex === i ? '#3b82f6' : 'black')}
                  strokeWidth="4" 
                  strokeLinecap="round"
                  className={`${
                    tool === 'erase' 
                      ? 'cursor-pointer hover:stroke-red-600 hover:stroke-[6px]' 
                      : tool === 'select' 
                        ? 'cursor-move hover:stroke-blue-500' 
                        : ''
                  } ${placingYouRoomId ? 'pointer-events-none' : ''}`}
                  onMouseDown={(e) => {
                    if (placingYouRoomId) return;
                    if (tool === 'select') {
                      e.stopPropagation();
                      setDraggingWallIndex(i);
                      setLastMousePos(getMousePos(e));
                    }
                  }}
                  onClick={(e) => {
                    if (placingYouRoomId) return;
                    if (tool === 'erase') {
                      e.stopPropagation();
                      const newWalls = [...walls];
                      newWalls.splice(i, 1);
                      setWalls(newWalls);
                    }
                  }}
                />
              ))}
              
              {/* Drawing Wall Preview */}
              {tool === 'wall' && drawingPath.length > 0 && (
                <path 
                  d={`M ${drawingPath.map(p => `${p.x} ${p.y}`).join(' L ')}`}
                  fill="none" 
                  stroke="blue" 
                  strokeWidth="4" 
                  strokeDasharray="4 4"
                />
              )}

              {/* Mapped Rooms */}
              {rooms
                .filter(r => r.floor_id === selectedFloor.id && r.map_position)
                .map(room => {
                  const pos = room.map_position as any;
                  const isDragging = draggingRoomId === room.id;
                  const isSelected = selectedMappedRoomId === room.id && tool === 'select';
                  
                  return (
                    <g key={room.id}>
                      <g 
                        className={`group transition-opacity ${
                          tool === 'erase' 
                            ? 'cursor-pointer hover:opacity-50' 
                            : tool === 'select'
                              ? 'cursor-move hover:opacity-80'
                              : 'hover:opacity-80'
                        } ${placingYouRoomId ? 'pointer-events-none' : ''}`}
                        onMouseDown={(e) => {
                          if (placingYouRoomId) return;
                          if (tool === 'select') {
                            e.stopPropagation();
                            setSelectedMappedRoomId(room.id);
                            setDraggingRoomId(room.id);
                            setLastMousePos(getMousePos(e));
                          }
                        }}
                        onClick={(e) => {
                          if (placingYouRoomId) return;
                          if (tool === 'erase') {
                            e.stopPropagation();
                            if (confirm(`Remove ${room.name} from the map?`)) {
                              setRooms(rooms.map(r => r.id === room.id ? {
                                ...r,
                                floor_id: null,
                                map_position: null
                              } : r));
                            }
                          } else if (tool === 'select') {
                            e.stopPropagation();
                            setSelectedMappedRoomId(room.id);
                          }
                        }}
                      >
                        <rect
                          x={pos.x}
                          y={pos.y}
                          width={pos.width}
                          height={pos.height}
                          fill={tool === 'erase' ? '#ef4444' : (isDragging || isSelected || selectedRoomId === room.id ? "#3b82f6" : "#10b981")}
                          fillOpacity={tool === 'erase' ? 0.5 : 0.3}
                          stroke={tool === 'erase' ? '#b91c1c' : (isDragging || isSelected || selectedRoomId === room.id ? "#2563eb" : "#059669")}
                          strokeWidth={isDragging || isSelected ? "3" : "2"}
                        />
                        <text
                          x={pos.x + pos.width / 2}
                          y={pos.y + pos.height / 2}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="text-xs font-bold fill-gray-800 pointer-events-none select-none"
                        >
                          {room.name}
                        </text>

                        {/* Optional per-room \"You\" marker inside the mapped room */}
                        {typeof pos.you_x === 'number' && typeof pos.you_y === 'number' && (
                          <g pointerEvents="none">
                            <circle
                              cx={pos.you_x}
                              cy={pos.you_y}
                              r="6"
                              fill="#2563eb"
                              stroke="white"
                              strokeWidth="2"
                            />
                            <text
                              x={pos.you_x}
                              y={pos.you_y - 12}
                              textAnchor="middle"
                              className="text-[9px] font-semibold fill-blue-700 select-none"
                            >
                              You
                            </text>
                          </g>
                        )}
                      </g>
                      
                      {/* Resize Handles (only if selected and in select mode) */}
                      {isSelected && (
                        <>
                          {/* Top-left */}
                          <circle
                            cx={pos.x}
                            cy={pos.y}
                            r="8"
                            fill="white"
                            stroke="#2563eb"
                            strokeWidth="2"
                            className="cursor-nwse-resize"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setResizingRoomHandle({ roomId: room.id, corner: 'tl' });
                              setLastMousePos(getMousePos(e));
                            }}
                          />
                          {/* Top-right */}
                          <circle
                            cx={pos.x + pos.width}
                            cy={pos.y}
                            r="8"
                            fill="white"
                            stroke="#2563eb"
                            strokeWidth="2"
                            className="cursor-nesw-resize"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setResizingRoomHandle({ roomId: room.id, corner: 'tr' });
                              setLastMousePos(getMousePos(e));
                            }}
                          />
                          {/* Bottom-left */}
                          <circle
                            cx={pos.x}
                            cy={pos.y + pos.height}
                            r="8"
                            fill="white"
                            stroke="#2563eb"
                            strokeWidth="2"
                            className="cursor-nesw-resize"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setResizingRoomHandle({ roomId: room.id, corner: 'bl' });
                              setLastMousePos(getMousePos(e));
                            }}
                          />
                          {/* Bottom-right */}
                          <circle
                            cx={pos.x + pos.width}
                            cy={pos.y + pos.height}
                            r="8"
                            fill="white"
                            stroke="#2563eb"
                            strokeWidth="2"
                            className="cursor-nwse-resize"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              setResizingRoomHandle({ roomId: room.id, corner: 'br' });
                              setLastMousePos(getMousePos(e));
                            }}
                          />
                        </>
                      )}
                    </g>
                  );
                })}

              {/* Drawing Room/Box Preview */}
              {(tool === 'room' || tool === 'box') && drawingPath.length > 1 && (
                <rect
                  x={Math.min(drawingPath[0].x, drawingPath[drawingPath.length - 1].x)}
                  y={Math.min(drawingPath[0].y, drawingPath[drawingPath.length - 1].y)}
                  width={Math.abs(drawingPath[drawingPath.length - 1].x - drawingPath[0].x)}
                  height={Math.abs(drawingPath[drawingPath.length - 1].y - drawingPath[0].y)}
                  fill="blue"
                  fillOpacity="0.2"
                  stroke="blue"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              )}
            </FloorPlanCanvas>
          </>
        ) : (
          <div className="text-gray-400 text-center">
            <p>Select or create a floor to start editing</p>
          </div>
        )}
      </div>
      {/* Tablet-style preview modal */}
      {showTabletPreview && selectedFloor && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Tablet preview</h2>
                <p className="text-xs text-gray-500">
                  This shows the same floor plan layout used on tablets so you can verify room mapping.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTabletPreview(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 bg-gray-100">
              <FloorPlanViewer
                floor={selectedFloor}
                rooms={rooms}
                roomStatuses={{}}
                showTestPins={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
