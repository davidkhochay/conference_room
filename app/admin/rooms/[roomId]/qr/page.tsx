'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Card } from '@/lib/components/ui/Card';
import { Button } from '@/lib/components/ui/Button';
import { ArrowLeft, Download, Printer } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import QRCode from 'qrcode';

interface Room {
  id: string;
  name: string;
  location: {
    name: string;
  };
}

export default function RoomQRPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrGenerated, setQrGenerated] = useState(false);

  useEffect(() => {
    if (roomId) {
      fetchRoom();
    }
  }, [roomId]);

  const fetchRoom = async () => {
    try {
      const response = await fetch(`/api/rooms/${roomId}`);
      const result = await response.json();

      if (result.success) {
        setRoom(result.data);
        generateQR(result.data.id);
      }
    } catch (error) {
      console.error('Failed to fetch room:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQR = async (id: string) => {
    if (!canvasRef.current) return;

    const bookingUrl = `${window.location.origin}/book/room/${id}`;
    
    try {
      await QRCode.toCanvas(canvasRef.current, bookingUrl, {
        width: 400,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });
      setQrGenerated(true);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `room-qr-${room?.name.replace(/\s+/g, '-').toLowerCase()}.png`;
    link.href = url;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!room) {
    return (
      <div>
        <div className="mb-8">
          <Link href="/admin/rooms">
            <Button variant="secondary" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Rooms
            </Button>
          </Link>
        </div>
        <Card>
          <div className="text-center py-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Room Not Found</h2>
            <Link href="/admin/rooms">
              <Button>Back to Rooms</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const bookingUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/book/room/${roomId}`;

  return (
    <div>
      <div className="mb-8 print:hidden">
        <Link href="/admin/rooms">
          <Button variant="secondary" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Rooms
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
        <Card>
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{room.name}</h1>
            <p className="text-gray-600 mb-8">{room.location.name}</p>

            {qrGenerated && (
              <div className="mb-8">
                <div className="inline-block p-8 bg-white rounded-lg shadow-lg border-4 border-gray-200">
                  <canvas ref={canvasRef} className="mx-auto" />
                </div>
              </div>
            )}

            <div className="mb-6">
              <p className="text-sm text-gray-600 mb-2">Scan to book this room:</p>
              <p className="text-xs text-gray-500 font-mono break-all bg-gray-50 p-3 rounded">
                {bookingUrl}
              </p>
            </div>

            <div className="flex gap-3 justify-center print:hidden">
              <Button onClick={handleDownload} disabled={!qrGenerated}>
                <Download className="w-4 h-4 mr-2" />
                Download PNG
              </Button>
              <Button variant="secondary" onClick={handlePrint} disabled={!qrGenerated}>
                <Printer className="w-4 h-4 mr-2" />
                Print
              </Button>
            </div>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg text-left">
              <h3 className="font-semibold text-gray-900 mb-2">💡 Usage Tips:</h3>
              <ul className="text-sm text-gray-700 space-y-1">
                <li>• Print and mount near the room entrance</li>
                <li>• Users can scan to instantly book this room</li>
                <li>• Download PNG for digital displays or signage</li>
                <li>• QR code links directly to this room's booking page</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible;
          }
          canvas {
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}

