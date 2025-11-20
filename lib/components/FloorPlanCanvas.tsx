'use client';

import React from 'react';
import type { Floor } from '@/lib/types/database.types';

interface FloorPlanCanvasProps {
  floor: Floor;
  svgRef?: React.Ref<SVGSVGElement>;
  svgProps?: React.SVGProps<SVGSVGElement>;
  children: React.ReactNode;
}

/**
 * Shared floor-plan canvas that ensures a consistent aspect ratio, background image
 * rendering, and SVG viewBox across the editor, maps page and tablet views.
 *
 * All drawing should happen in the logical coordinate space [0,width] x [0,height]
 * via the SVG viewBox so that map_position values line up exactly regardless of
 * screen size or zoom.
 */
export default function FloorPlanCanvas({
  floor,
  svgRef,
  svgProps,
  children,
}: FloorPlanCanvasProps) {
  const baseClassName = 'absolute inset-0 w-full h-full';
  const combinedClassName = svgProps?.className
    ? `${baseClassName} ${svgProps.className}`
    : baseClassName;

  return (
    <div
      className="relative bg-white shadow-lg w-full h-full max-w-full max-h-full"
      style={{
        aspectRatio: `${floor.width} / ${floor.height}`,
      }}
    >
      {floor.image_url && (
        <img
          src={floor.image_url}
          alt={floor.name}
          className="absolute inset-0 w-full h-full object-contain opacity-50 pointer-events-none"
        />
      )}

      <svg
        ref={svgRef}
        viewBox={`0 0 ${floor.width} ${floor.height}`}
        preserveAspectRatio="xMidYMid meet"
        {...svgProps}
        className={combinedClassName}
      >
        {children}
      </svg>
    </div>
  );
}


