/**
 * Interactive Canvas Viewer for Unit Square Packings
 * 
 * Features:
 * - High-DPI canvas rendering
 * - Smooth pan and zoom with mouse wheel and drag
 * - Precise rotated square rendering with orientation markers
 * - Container boundary box and dimension labels
 * - Collision highlighting for overlapping squares
 * - Hover inspector tooltip showing square coordinates, angle, and AABB
 * - Fit-to-screen and reset view controls
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Packing, UnitSquare, CollisionPair } from '../types';
import { computeSquareGeometry, LOCAL_UNIT_VERTICES } from '../geometry/sat';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Crosshair,
  Camera,
  Hand,
  Move,
} from 'lucide-react';

interface CanvasViewerProps {
  packing: Packing | null;
  candidateSquares?: UnitSquare[] | null;
  candidateL?: number | null;
  collisions?: CollisionPair[];
  isOptimizing?: boolean;
  onUpdateSquares?: (squares: UnitSquare[]) => void;
}

export const CanvasViewer: React.FC<CanvasViewerProps> = ({
  packing,
  candidateSquares,
  candidateL,
  collisions = [],
  isOptimizing = false,
  onUpdateSquares,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Pan and zoom state (in screen pixels)
  const [transform, setTransform] = useState<{ scale: number; offsetX: number; offsetY: number }>({
    scale: 60, // 60 pixels per unit
    offsetX: 100,
    offsetY: 100,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [hoveredSquareId, setHoveredSquareId] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // Active squares to render: during optimization we display live candidate squares if available!
  const activeSquares = candidateSquares || packing?.squares || [];
  const currentL = candidateL ?? packing?.containerLength ?? 1;

  // Collision set for fast lookup
  const collidingIds = new Set<number>();
  for (const c of collisions) {
    collidingIds.add(c.squareA);
    collidingIds.add(c.squareB);
  }

  // Auto-fit view when packing or n changes
  const fitToView = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || activeSquares.length === 0) return;
    const { clientWidth, clientHeight } = containerRef.current;
    if (clientWidth === 0 || clientHeight === 0) return;

    // Compute bounding box in world coordinates
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const sq of activeSquares) {
      const geom = computeSquareGeometry(sq);
      minX = Math.min(minX, geom.aabb.minX);
      maxX = Math.max(maxX, geom.aabb.maxX);
      minY = Math.min(minY, geom.aabb.minY);
      maxY = Math.max(maxY, geom.aabb.maxY);
    }

    if (!Number.isFinite(minX)) {
      minX = 0; maxX = currentL; minY = 0; maxY = currentL;
    }

    const worldWidth = Math.max(0.5, maxX - minX);
    const worldHeight = Math.max(0.5, maxY - minY);

    const padding = 60;
    const availW = clientWidth - padding * 2;
    const availH = clientHeight - padding * 2;

    const scale = Math.min(availW / worldWidth, availH / worldHeight);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const offsetX = clientWidth / 2 - centerX * scale;
    // Canvas y goes downward; we invert y so positive y points up
    const offsetY = clientHeight / 2 + centerY * scale;

    setTransform({ scale, offsetX, offsetY });
  }, [activeSquares, currentL]);

  // Initial fit when n changes
  useEffect(() => {
    fitToView();
  }, [packing?.n, fitToView]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        const dpr = window.devicePixelRatio || 1;
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        canvasRef.current.width = w * dpr;
        canvasRef.current.height = h * dpr;
        canvasRef.current.style.width = `${w}px`;
        canvasRef.current.style.height = `${h}px`;
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // World to screen coordinate transforms (inverted Y so standard Cartesian space)
    const worldToScreenX = (x: number) => transform.offsetX + x * transform.scale;
    const worldToScreenY = (y: number) => transform.offsetY - y * transform.scale;

    // 1. Draw subtle background grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#1e293b'; // slate-800
    const step = transform.scale >= 40 ? 1 : transform.scale >= 15 ? 5 : 10;

    const minWorldX = Math.floor((0 - transform.offsetX) / transform.scale);
    const maxWorldX = Math.ceil((w - transform.offsetX) / transform.scale);
    const minWorldY = Math.floor((transform.offsetY - h) / transform.scale);
    const maxWorldY = Math.ceil(transform.offsetY / transform.scale);

    ctx.beginPath();
    for (let gx = minWorldX; gx <= maxWorldX; gx += step) {
      const sx = worldToScreenX(gx);
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
    }
    for (let gy = minWorldY; gy <= maxWorldY; gy += step) {
      const sy = worldToScreenY(gy);
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
    }
    ctx.stroke();

    // 2. Draw origin axes
    const originX = worldToScreenX(0);
    const originY = worldToScreenY(0);

    ctx.beginPath();
    ctx.strokeStyle = '#334155'; // slate-700
    ctx.lineWidth = 1.5;
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, h);
    ctx.moveTo(0, originY);
    ctx.lineTo(w, originY);
    ctx.stroke();

    if (activeSquares.length > 0) {
      // 3. Compute overall bounding box for container rendering
      let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
      for (const sq of activeSquares) {
        const geom = computeSquareGeometry(sq);
        bMinX = Math.min(bMinX, geom.aabb.minX);
        bMaxX = Math.max(bMaxX, geom.aabb.maxX);
        bMinY = Math.min(bMinY, geom.aabb.minY);
        bMaxY = Math.max(bMaxY, geom.aabb.maxY);
      }

      const spanX = bMaxX - bMinX;
      const spanY = bMaxY - bMinY;
      const L = Math.max(spanX, spanY);

      // Draw container box
      // Place square container of side L anchored at (bMinX, bMinY)
      const cLeft = worldToScreenX(bMinX);
      const cTop = worldToScreenY(bMinY + L);
      const cWidth = L * transform.scale;
      const cHeight = L * transform.scale;

      ctx.save();
      ctx.strokeStyle = '#38bdf8'; // sky-400
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(cLeft, cTop, cWidth, cHeight);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.03)';
      ctx.fillRect(cLeft, cTop, cWidth, cHeight);
      ctx.restore();

      // Dimension labels
      ctx.fillStyle = '#38bdf8';
      ctx.font = '12px ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(`Container L = ${L.toFixed(5)}  [W = ${spanX.toFixed(4)}, H = ${spanY.toFixed(4)}]`, cLeft + 6, cTop - 8);

      // Height (H) and Width (W) indicators on container edges
      ctx.fillStyle = '#0ea5e9';
      ctx.font = '11px ui-monospace, SFMono-Regular, monospace';
      ctx.fillText(`H = ${spanY.toFixed(4)}`, cLeft + cWidth + 6, cTop + cHeight / 2);
      ctx.fillText(`W = ${spanX.toFixed(4)}`, cLeft + cWidth / 2 - 24, cTop + cHeight + 15);

      // 4. Draw rotated unit squares
      for (const sq of activeSquares) {
        const isHovered = sq.id === hoveredSquareId;
        const isColliding = collidingIds.has(sq.id);

        const geom = computeSquareGeometry(sq);
        const v0 = geom.vertices[0];
        const v1 = geom.vertices[1];
        const v2 = geom.vertices[2];
        const v3 = geom.vertices[3];

        ctx.beginPath();
        ctx.moveTo(worldToScreenX(v0.x), worldToScreenY(v0.y));
        ctx.lineTo(worldToScreenX(v1.x), worldToScreenY(v1.y));
        ctx.lineTo(worldToScreenX(v2.x), worldToScreenY(v2.y));
        ctx.lineTo(worldToScreenX(v3.x), worldToScreenY(v3.y));
        ctx.closePath();

        // Styling based on state
        if (isColliding) {
          ctx.fillStyle = isHovered ? 'rgba(239, 68, 68, 0.65)' : 'rgba(239, 68, 68, 0.35)';
          ctx.strokeStyle = '#ef4444'; // red-500
          ctx.lineWidth = 2.5;
        } else if (isHovered) {
          ctx.fillStyle = 'rgba(6, 182, 212, 0.45)'; // cyan-500
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.5;
        } else if (packing?.isProvenOptimal) {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.18)'; // emerald-500
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 1.5;
        } else if (packing?.status === 'improved') {
          ctx.fillStyle = 'rgba(147, 51, 234, 0.22)'; // purple-500
          ctx.strokeStyle = '#a855f7';
          ctx.lineWidth = 1.5;
        } else {
          ctx.fillStyle = 'rgba(100, 116, 139, 0.2)'; // slate-500
          ctx.strokeStyle = '#64748b';
          ctx.lineWidth = 1.2;
        }

        ctx.fill();
        ctx.stroke();

        // Center dot
        const cx = worldToScreenX(sq.x);
        const cy = worldToScreenY(sq.y);
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(1.5, Math.min(3.5, transform.scale * 0.05)), 0, Math.PI * 2);
        ctx.fillStyle = isColliding ? '#fca5a5' : isHovered ? '#67e8f9' : '#cbd5e1';
        ctx.fill();

        // Orientation pointer: small line from center pointing along angle
        if (transform.scale > 20) {
          const pointerLen = 0.35; // world units
          const tipX = sq.x + Math.cos(sq.angle) * pointerLen;
          const tipY = sq.y + Math.sin(sq.angle) * pointerLen;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(worldToScreenX(tipX), worldToScreenY(tipY));
          ctx.strokeStyle = isColliding ? '#ef4444' : isHovered ? '#22d3ee' : '#94a3b8';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Draw square ID if scale is sufficiently large
        if (transform.scale > 38 && activeSquares.length <= 150) {
          ctx.fillStyle = isHovered ? '#ffffff' : '#94a3b8';
          ctx.font = `${Math.max(9, Math.min(13, transform.scale * 0.2))}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${sq.id}`, cx, cy);
        }
      }
    }

    ctx.restore();
  }, [activeSquares, currentL, transform, hoveredSquareId, collidingIds, packing]);

  const [isManualEditMode, setIsManualEditMode] = useState(false);
  const [selectedSquareId, setSelectedSquareId] = useState<number | null>(null);
  const [cursorWorld, setCursorWorld] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Handle Export Canvas as High-Res PNG
  const handleExportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `squarepack_n${activeSquares.length}_L${currentL.toFixed(4)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Mouse wheel zoom or rotate when dragging square in edit mode
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (isManualEditMode && selectedSquareId !== null && onUpdateSquares) {
      // Rotate selected square by 5 degrees (0.087 rad)
      const deltaAngle = e.deltaY < 0 ? 0.087266 : -0.087266;
      const updated = activeSquares.map((sq) => {
        if (sq.id === selectedSquareId) {
          const newAng = sq.angle + deltaAngle;
          return { ...sq, angle: Math.atan2(Math.sin(newAng), Math.cos(newAng)) };
        }
        return sq;
      });
      onUpdateSquares(updated);
      return;
    }

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform((prev) => {
      const newScale = Math.max(4, Math.min(600, prev.scale * zoomFactor));
      const scaleRatio = newScale / prev.scale;
      const newOffsetX = mouseX - (mouseX - prev.offsetX) * scaleRatio;
      const newOffsetY = mouseY - (mouseY - prev.offsetY) * scaleRatio;
      return { scale: newScale, offsetX: newOffsetX, offsetY: newOffsetY };
    });
  };

  // Drag pan or move square handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // only left click
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isManualEditMode && hoveredSquareId !== null && onUpdateSquares) {
      setSelectedSquareId(hoveredSquareId);
      setIsDragging(true);
      setDragStart({ x: mouseX, y: mouseY });
      return;
    }

    setSelectedSquareId(null);
    setIsDragging(true);
    setDragStart({ x: e.clientX - transform.offsetX, y: e.clientY - transform.offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const worldX = (mouseX - transform.offsetX) / transform.scale;
    const worldY = (transform.offsetY - mouseY) / transform.scale;
    setCursorWorld({ x: worldX, y: worldY });

    if (isDragging) {
      if (isManualEditMode && selectedSquareId !== null && onUpdateSquares) {
        // Move selected square directly
        const updated = activeSquares.map((sq) => {
          if (sq.id === selectedSquareId) {
            return { ...sq, x: worldX, y: worldY };
          }
          return sq;
        });
        onUpdateSquares(updated);
      } else {
        setTransform((prev) => ({
          ...prev,
          offsetX: e.clientX - dragStart.x,
          offsetY: e.clientY - dragStart.y,
        }));
      }
    } else {
      // Hit testing for hover tooltip
      let foundId: number | null = null;
      for (const sq of activeSquares) {
        const cos = Math.cos(-sq.angle);
        const sin = Math.sin(-sq.angle);
        const dx = worldX - sq.x;
        const dy = worldY - sq.y;
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        if (Math.abs(localX) <= 0.5 && Math.abs(localY) <= 0.5) {
          foundId = sq.id;
          break;
        }
      }

      setHoveredSquareId(foundId);
      if (foundId !== null) {
        setTooltipPos({ x: mouseX + 15, y: mouseY + 15 });
      } else {
        setTooltipPos(null);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setSelectedSquareId(null);
  };

  const hoveredSquare = activeSquares.find((s) => s.id === hoveredSquareId);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 select-none"
    >
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoveredSquareId(null);
          setSelectedSquareId(null);
          setTooltipPos(null);
        }}
        className={`w-full h-full block ${
          isDragging ? 'cursor-grabbing' : isManualEditMode ? 'cursor-crosshair' : 'cursor-grab'
        }`}
      />

      {/* Viewport Control Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-lg border border-slate-800 shadow-lg z-10">
        {onUpdateSquares && (
          <button
            onClick={() => setIsManualEditMode(!isManualEditMode)}
            className={`p-1.5 rounded transition-colors ${
              isManualEditMode
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'hover:bg-slate-800 text-slate-300 hover:text-white'
            }`}
            title={isManualEditMode ? 'Exit Manual Edit Mode' : 'Enter Manual Edit Mode (Drag to move, scroll wheel to rotate)'}
          >
            <Move className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleExportPng}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Export High-Resolution Canvas Snapshot (PNG)"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            setTransform((p) => ({
              ...p,
              scale: Math.min(600, p.scale * 1.25),
            }))
          }
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() =>
            setTransform((p) => ({
              ...p,
              scale: Math.max(4, p.scale * 0.8),
            }))
          }
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={fitToView}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Fit to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={() => setTransform({ scale: 60, offsetX: 100, offsetY: 300 })}
          className="p-1.5 hover:bg-slate-800 text-slate-300 hover:text-white rounded transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Status & Scale Indicator */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-slate-400 pointer-events-none z-10">
        <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
        <span>Scale: {transform.scale.toFixed(1)} px/unit</span>
        <span>•</span>
        <span>XY: ({cursorWorld.x.toFixed(2)}, {cursorWorld.y.toFixed(2)})</span>
        <span>•</span>
        <span>Squares: {activeSquares.length}</span>
        {isManualEditMode && (
          <>
            <span>•</span>
            <span className="text-cyan-300 font-bold">Manual Drag Active (Wheel to rotate)</span>
          </>
        )}
        {isOptimizing && (
          <>
            <span>•</span>
            <span className="flex items-center gap-1 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
              Live Simulated Annealing
            </span>
          </>
        )}
      </div>

      {/* Hover Inspector Tooltip */}
      {hoveredSquare && tooltipPos && (
        <div
          className="absolute pointer-events-none z-20 bg-slate-900/95 backdrop-blur-md border border-cyan-500/50 shadow-2xl rounded-lg p-2.5 text-xs font-mono text-slate-200"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="font-semibold text-cyan-400 flex items-center gap-1.5 border-b border-slate-800 pb-1 mb-1">
            <span>Square #{hoveredSquare.id}</span>
            {collidingIds.has(hoveredSquare.id) && (
              <span className="bg-red-500/20 text-red-400 text-[10px] px-1 py-0.5 rounded font-bold">
                COLLISION
              </span>
            )}
          </div>
          <div>Center X: {hoveredSquare.x.toFixed(6)}</div>
          <div>Center Y: {hoveredSquare.y.toFixed(6)}</div>
          <div>
            Angle: {hoveredSquare.angle.toFixed(5)} rad (
            {((hoveredSquare.angle * 180) / Math.PI).toFixed(1)}°)
          </div>
        </div>
      )}
    </div>
  );
};
