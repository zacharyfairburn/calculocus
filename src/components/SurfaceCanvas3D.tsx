import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Viewport3D, MathItem } from '../types';
import { ExpressionNode, evaluateAST } from '../engine/ast';
import { Parser } from '../engine/parser';
import { Box, Sliders, Waves, Eye } from 'lucide-react';
import { BoundsModal3D } from './BoundsModal3D';
import { generateContourMapData, getContourColor } from '../engine/contour';

interface SurfaceCanvas3DProps {
  items?: MathItem[];
  expressionString?: string;
  viewport?: Viewport3D;
  viewport3D?: Viewport3D;
  onViewportChange?: (vp: Viewport3D) => void;
  onViewport3DChange?: (vp: Viewport3D) => void;
  onAddSurface?: (expr: string) => void;
  theme?: 'dark' | 'light';
  isBoundsModalOpen?: boolean;
  onOpenBoundsModal?: () => void;
  onCloseBoundsModal?: () => void;
  isContourMode?: boolean;
  onToggleContourMode?: () => void;
  onInteractionStart?: () => void;
}

const DEFAULT_VIEWPORT_3D: Viewport3D = {
  xMin: -1,
  xMax: 1,
  yMin: -1,
  yMax: 1,
  zMin: -1,
  zMax: 1,
  rotX: 0.6,
  rotY: 0.8,
  zoom: 120,
  wireframe: false,
};

// Normalize 3D vector
function normalize3D(x: number, y: number, z: number): [number, number, number] {
  const len = Math.hypot(x, y, z);
  if (len < 1e-9) return [0, 0, 1];
  return [x / len, y / len, z / len];
}

// Cross product of two 3D vectors
function cross3D(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number
): [number, number, number] {
  return [ay * bz - az * by, az * bx - ax * bz, ax * by - ay * bx];
}

// Convert HSL with lightness modulation to CSS color
function hslShade(hue: number, sat: number, lightness: number, lightFactor: number, alpha = 1): string {
  const effectiveLight = Math.max(10, Math.min(92, lightness * lightFactor));
  if (alpha < 1) {
    return `hsla(${Math.round(hue)}, ${sat}%, ${Math.round(effectiveLight)}%, ${alpha})`;
  }
  return `hsl(${Math.round(hue)}, ${sat}%, ${Math.round(effectiveLight)}%)`;
}

interface MeshQuad {
  p0: { sx: number; sy: number };
  p1: { sx: number; sy: number };
  p2: { sx: number; sy: number };
  p3: { sx: number; sy: number };
  avgZ: number;
  avgDepth: number;
  normal: [number, number, number];
}

export const SurfaceCanvas3D: React.FC<SurfaceCanvas3DProps> = ({
  items = [],
  expressionString,
  viewport,
  viewport3D,
  onViewportChange,
  onViewport3DChange,
  theme = 'dark',
  isBoundsModalOpen: externalBoundsOpen,
  onOpenBoundsModal: externalOpenBounds,
  onCloseBoundsModal: externalCloseBounds,
  isContourMode: externalContourMode,
  onToggleContourMode: externalToggleContour,
  onInteractionStart,
}) => {
  const currentViewport = viewport || viewport3D || DEFAULT_VIEWPORT_3D;
  const updateViewport = onViewportChange || onViewport3DChange || (() => {});
  const isLight = theme === 'light';

  const [internalBoundsOpen, setInternalBoundsOpen] = useState(false);
  const isBoundsOpen = externalBoundsOpen !== undefined ? externalBoundsOpen : internalBoundsOpen;
  const handleOpenBounds = externalOpenBounds || (() => setInternalBoundsOpen(true));
  const handleCloseBounds = externalCloseBounds || (() => setInternalBoundsOpen(false));

  const [internalContourMode, setInternalContourMode] = useState(false);
  const isContourMode = externalContourMode !== undefined ? externalContourMode : internalContourMode;
  const handleToggleContour = externalToggleContour || (() => setInternalContourMode((prev) => !prev));

  // Contour map customization states
  const [showContourHeatmap, setShowContourHeatmap] = useState(true);
  const [numContourLevels] = useState(14);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number; z: number } | null>(null);

  // Determine active 3D surface expression
  let activeExpr = expressionString;
  if (!activeExpr && items.length > 0) {
    const surfaceItem =
      items.find((it) => it.type === 'surface3d' && it.visible) ||
      items.find((it) => it.type === 'surface3d') ||
      items[0];
    if (surfaceItem) {
      activeExpr = surfaceItem.rawInput;
    }
  }

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    const {
      xMin = -1,
      xMax = 1,
      yMin = -1,
      yMax = 1,
      zMin = -1,
      zMax = 1,
      rotX = 0.6,
      rotY = 0.8,
      zoom = 120,
      wireframe = false,
    } = currentViewport;

    // ==========================================
    // 1. TOP-DOWN CONTOUR MAP MODE
    // ==========================================
    if (isContourMode) {
      ctx.fillStyle = isLight ? '#FFFFFF' : '#000000';
      ctx.fillRect(0, 0, width, height);

      const left = 76;
      const right = width < 680 ? 110 : 160; // Room for elevation colorbar and legend
      const top = 56; // Room for top header title and formula
      const bottom = 88; // Room for X-axis ticks, labels, and bottom bar clearance
      const plotWidth = Math.max(50, width - left - right);
      const plotHeight = Math.max(50, height - top - bottom);

      let parsedAST: ExpressionNode | null = null;

      if (activeExpr && activeExpr.trim()) {
        try {
          let cleanInput = activeExpr.trim();
          if (cleanInput.startsWith('z=')) {
            cleanInput = cleanInput.slice(2).trim();
          } else if (cleanInput.includes('=')) {
            const [lhs, rhs] = cleanInput.split('=');
            cleanInput = `(${lhs}) - (${rhs})`;
          }
          parsedAST = Parser.parse(cleanInput);
        } catch {
          // AST parse error
        }
      }

      if (!parsedAST) {
        ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.2)';
        ctx.strokeRect(left, top, plotWidth, plotHeight);
        return;
      }

      // Generate contour data using Marching Squares
      const contourData = generateContourMapData(
        parsedAST,
        xMin,
        xMax,
        yMin,
        yMax,
        zMin,
        zMax,
        numContourLevels,
        70
      );

      const toScreenX = (x: number) => left + ((x - xMin) / (xMax - xMin)) * plotWidth;
      const toScreenY = (y: number) => top + ((yMax - y) / (yMax - yMin)) * plotHeight;

      // 1.1 Draw Heatmap Gradient Fill (if enabled)
      if (showContourHeatmap) {
        const { gridN, gridValues, zMin: effZMin, zMax: effZMax } = contourData;
        const cellW = plotWidth / gridN;
        const cellH = plotHeight / gridN;
        const zRange = effZMax - effZMin || 1;

        for (let i = 0; i < gridN; i++) {
          for (let j = 0; j < gridN; j++) {
            const val = gridValues[i][j];
            if (!isNaN(val)) {
              const norm = (val - effZMin) / zRange;
              ctx.fillStyle = getContourColor(norm, 0.85);
              const sx = left + i * cellW;
              const sy = top + (gridN - 1 - j) * cellH;
              ctx.fillRect(sx - 0.5, sy - 0.5, cellW + 1, cellH + 1);
            }
          }
        }
      }

      // 1.2 Plot Box Frame
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(left, top, plotWidth, plotHeight);

      // 1.3 Subdivided Coordinate Grid
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      const xDivs = 6;
      const yDivs = 6;
      for (let k = 1; k < xDivs; k++) {
        const gx = left + (k / xDivs) * plotWidth;
        ctx.beginPath();
        ctx.moveTo(gx, top);
        ctx.lineTo(gx, top + plotHeight);
        ctx.stroke();
      }
      for (let k = 1; k < yDivs; k++) {
        const gy = top + (k / yDivs) * plotHeight;
        ctx.beginPath();
        ctx.moveTo(left, gy);
        ctx.lineTo(left + plotWidth, gy);
        ctx.stroke();
      }

      // 1.4 Coordinate Axes (x=0 Coral Red, y=0 Dartmouth Green)
      if (xMin <= 0 && xMax >= 0) {
        const zeroSX = toScreenX(0);
        ctx.strokeStyle = '#c84442';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(zeroSX, top);
        ctx.lineTo(zeroSX, top + plotHeight);
        ctx.stroke();
      }
      if (yMin <= 0 && yMax >= 0) {
        const zeroSY = toScreenY(0);
        ctx.strokeStyle = '#00693E';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(left, zeroSY);
        ctx.lineTo(left + plotWidth, zeroSY);
        ctx.stroke();
      }

      // 1.5 Draw Contour Isolines
      contourData.levels.forEach((lvl, lIdx) => {
        if (lvl.segments.length === 0) return;
        ctx.strokeStyle = showContourHeatmap
          ? (isLight ? 'rgba(0, 0, 0, 0.85)' : 'rgba(255, 255, 255, 0.9)')
          : lvl.color;
        ctx.lineWidth = lIdx % 3 === 0 ? 1.8 : 1.1;
        ctx.beginPath();

        lvl.segments.forEach((seg) => {
          const p1x = toScreenX(seg.p1.x);
          const p1y = toScreenY(seg.p1.y);
          const p2x = toScreenX(seg.p2.x);
          const p2y = toScreenY(seg.p2.y);
          ctx.moveTo(p1x, p1y);
          ctx.lineTo(p2x, p2y);
        });
        ctx.stroke();

        // Level numeric label along segment
        if (lvl.segments.length > 2 && lIdx % 2 === 0) {
          const midSeg = lvl.segments[Math.floor(lvl.segments.length / 2)];
          const mx = (toScreenX(midSeg.p1.x) + toScreenX(midSeg.p2.x)) / 2;
          const my = (toScreenY(midSeg.p1.y) + toScreenY(midSeg.p2.y)) / 2;

          if (mx > left + 15 && mx < left + plotWidth - 15 && my > top + 10 && my < top + plotHeight - 10) {
            const txt = `${lvl.level >= 0 ? '+' : ''}${lvl.level.toFixed(2)}`;
            ctx.font = 'bold 9px monospace';
            const tw = ctx.measureText(txt).width;

            ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.88)';
            ctx.fillRect(mx - tw / 2 - 3, my - 6, tw + 6, 12);
            ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(mx - tw / 2 - 3, my - 6, tw + 6, 12);

            ctx.fillStyle = isLight ? '#000000' : '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(txt, mx, my);
          }
        }
      });

      // 1.6 Axis Ticks & Numerical Labels
      ctx.font = '10px monospace';
      ctx.fillStyle = isLight ? '#4b5563' : '#9ca3af';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      for (let k = 0; k <= xDivs; k++) {
        const val = xMin + (k / xDivs) * (xMax - xMin);
        const sx = left + (k / xDivs) * plotWidth;
        ctx.fillText(val.toFixed(1), sx, top + plotHeight + 6);
      }
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('X Axis (Domain)', left + plotWidth / 2, top + plotHeight + 24);

      // Y Axis Ticks
      ctx.font = '10px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let k = 0; k <= yDivs; k++) {
        const val = yMax - (k / yDivs) * (yMax - yMin);
        const sy = top + (k / yDivs) * plotHeight;
        ctx.fillText(val.toFixed(1), left - 8, sy);
      }
      ctx.save();
      ctx.translate(left - 46, top + plotHeight / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Y Axis (Domain)', 0, 0);
      ctx.restore();

      // 1.7 Elevation Colorbar Legend (Right side)
      const cbLeft = left + plotWidth + 18;
      const cbWidth = 14;
      const cbTop = top;
      const cbHeight = plotHeight;

      const cbGrad = ctx.createLinearGradient(0, cbTop, 0, cbTop + cbHeight);
      for (let st = 0; st <= 10; st++) {
        const norm = 1 - st / 10;
        cbGrad.addColorStop(st / 10, getContourColor(norm));
      }
      ctx.fillStyle = cbGrad;
      ctx.fillRect(cbLeft, cbTop, cbWidth, cbHeight);
      ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(cbLeft, cbTop, cbWidth, cbHeight);

      // Colorbar Ticks and Labels
      ctx.font = '9px monospace';
      ctx.fillStyle = isLight ? '#374151' : '#d1d5db';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const numCBTicks = 5;
      for (let ct = 0; ct <= numCBTicks; ct++) {
        const ratio = ct / numCBTicks;
        const cy = cbTop + ratio * cbHeight;
        const zVal = contourData.zMax - ratio * (contourData.zMax - contourData.zMin);
        ctx.fillText(zVal.toFixed(1), cbLeft + cbWidth + 5, cy);

        ctx.beginPath();
        ctx.moveTo(cbLeft + cbWidth, cy);
        ctx.lineTo(cbLeft + cbWidth + 3, cy);
        ctx.stroke();
      }

      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('z (Elev)', cbLeft + cbWidth / 2, cbTop - 14);

      // 1.8 Header Title & Active Formula
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = isLight ? '#111827' : '#F9FAFB';
      ctx.fillText('Top-Down Contour Map', left, top - 24);

      ctx.font = 'bold 11px monospace';
      ctx.fillStyle = '#00693E';
      ctx.fillText(`z = ${activeExpr}`, left + 160, top - 24);

      // 1.9 Interactive Hover Tooltip & Crosshair
      if (hoverCoord) {
        const hx = toScreenX(hoverCoord.x);
        const hy = toScreenY(hoverCoord.y);

        if (hx >= left && hx <= left + plotWidth && hy >= top && hy <= top + plotHeight) {
          ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.45)' : 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.moveTo(left, hy);
          ctx.lineTo(left + plotWidth, hy);
          ctx.moveTo(hx, top);
          ctx.lineTo(hx, top + plotHeight);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#00693E';
          ctx.beginPath();
          ctx.arc(hx, hy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          const badgeTxt = `(${hoverCoord.x.toFixed(2)}, ${hoverCoord.y.toFixed(2)}) → z = ${hoverCoord.z.toFixed(3)}`;
          ctx.font = 'bold 10px monospace';
          const btw = ctx.measureText(badgeTxt).width;
          const bpad = 6;
          let bx = hx + 12;
          let by = hy - 24;
          if (bx + btw + bpad * 2 > left + plotWidth) {
            bx = hx - btw - bpad * 2 - 12;
          }
          if (by < top) {
            by = hy + 12;
          }

          ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.88)' : 'rgba(255, 255, 255, 0.95)';
          ctx.fillRect(bx, by, btw + bpad * 2, 20);
          ctx.strokeStyle = '#00693E';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, btw + bpad * 2, 20);

          ctx.fillStyle = isLight ? '#FFFFFF' : '#000000';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(badgeTxt, bx + bpad, by + 10);
        }
      }
      return;
    }

    // ==========================================
    // 2. STANDARD 3D ORTHOGRAPHIC PERSPECTIVE MODE
    // ==========================================
    const cx = width / 2;
    const cy = height / 2;

    ctx.fillStyle = isLight ? '#FFFFFF' : '#000000';
    ctx.fillRect(0, 0, width, height);

    const xMid = (xMin + xMax) / 2;
    const yMid = (yMin + yMax) / 2;
    const zMid = (zMin + zMax) / 2;

    const cosY = Math.cos(rotY),
      sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX),
      sinX = Math.sin(rotX);

    // Isotropic 3D Orthographic Projection Matrix
    // Right vector:  ( cosY, -sinY, 0)
    // Forward (look):(-sinY*cosX, -cosY*cosX, -sinX)
    // Up vector:     (-sinY*sinX, -cosY*sinX,  cosX)
    const project = (x: number, y: number, z: number) => {
      const dx = x - xMid;
      const dy = y - yMid;
      const dz = z - zMid;

      // 1. Azimuth rotation in XY ground plane
      const x1 = dx * cosY - dy * sinY;
      const y1 = dx * sinY + dy * cosY;
      const z1 = dz;

      // 2. Camera Elevation Tilt
      // Screen X: projection along horizontal camera axis
      // Screen Y: projection along vertical camera axis (inverted for canvas Y)
      // Depth: distance along line of sight for painter's depth sorting
      const screenX = cx + x1 * zoom;
      const screenY = cy - (z1 * cosX - y1 * sinX) * zoom;
      const depth = y1 * cosX + z1 * sinX;

      return { sx: screenX, sy: screenY, depth };
    };

    // 1. Draw 3D Bounding Box Cage & Grid Lines
    ctx.lineWidth = 1;
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.09)' : 'rgba(255, 255, 255, 0.08)';

    // Ground Grid at zMin
    const gridDivs = 4;
    const xStepGrid = (xMax - xMin) / gridDivs;
    const yStepGrid = (yMax - yMin) / gridDivs;

    ctx.beginPath();
    for (let i = 0; i <= gridDivs; i++) {
      const gx = xMin + i * xStepGrid;
      const p1 = project(gx, yMin, zMin);
      const p2 = project(gx, yMax, zMin);
      ctx.moveTo(p1.sx, p1.sy);
      ctx.lineTo(p2.sx, p2.sy);

      const gy = yMin + i * yStepGrid;
      const p3 = project(xMin, gy, zMin);
      const p4 = project(xMax, gy, zMin);
      ctx.moveTo(p3.sx, p3.sy);
      ctx.lineTo(p4.sx, p4.sy);
    }
    ctx.stroke();

    // Cage Boundary Edges
    ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.16)' : 'rgba(255, 255, 255, 0.14)';
    const corners = [
      [xMin, yMin, zMin],
      [xMax, yMin, zMin],
      [xMax, yMax, zMin],
      [xMin, yMax, zMin],
      [xMin, yMin, zMax],
      [xMax, yMin, zMax],
      [xMax, yMax, zMax],
      [xMin, yMax, zMax],
    ].map(([x, y, z]) => project(x, y, z));

    const cageEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // Bottom
      [4, 5], [5, 6], [6, 7], [7, 4], // Top
      [0, 4], [1, 5], [2, 6], [3, 7], // Pillars
    ];

    ctx.beginPath();
    cageEdges.forEach(([i, j]) => {
      ctx.moveTo(corners[i].sx, corners[i].sy);
      ctx.lineTo(corners[j].sx, corners[j].sy);
    });
    ctx.stroke();

    // 2. Draw Principal Coordinate Axes (X: Coral, Y: Green, Z: Blue)
    const oProj = project(0, 0, 0);
    const xClampMin = Math.min(0, xMin);
    const xClampMax = Math.max(0, xMax);
    const yClampMin = Math.min(0, yMin);
    const yClampMax = Math.max(0, yMax);
    const zClampMin = Math.min(0, zMin);
    const zClampMax = Math.max(0, zMax);

    const axXMin = project(xClampMin, 0, 0);
    const axXMax = project(xClampMax, 0, 0);
    const axYMin = project(0, yClampMin, 0);
    const axYMax = project(0, yClampMax, 0);
    const axZMin = project(0, 0, zClampMin);
    const axZMax = project(0, 0, zClampMax);

    ctx.lineWidth = 1.5;

    // X Axis (#c84442 Coral Red)
    ctx.strokeStyle = '#c84442';
    ctx.beginPath();
    ctx.moveTo(axXMin.sx, axXMin.sy);
    ctx.lineTo(axXMax.sx, axXMax.sy);
    ctx.stroke();

    // Y Axis (#00693E Dartmouth Green)
    ctx.strokeStyle = '#00693E';
    ctx.beginPath();
    ctx.moveTo(axYMin.sx, axYMin.sy);
    ctx.lineTo(axYMax.sx, axYMax.sy);
    ctx.stroke();

    // Z Axis (#2d6fb4 Deep Blue)
    ctx.strokeStyle = '#2d6fb4';
    ctx.beginPath();
    ctx.moveTo(axZMin.sx, axZMin.sy);
    ctx.lineTo(axZMax.sx, axZMax.sy);
    ctx.stroke();

    // Axis Labels & Numerical Bounds Markers
    ctx.font = 'bold 11px "STIX Two Math", "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.fillStyle = '#c84442';
    ctx.fillText(`X (${xMax})`, axXMax.sx + 14, axXMax.sy);

    ctx.fillStyle = '#00693E';
    ctx.fillText(`Y (${yMax})`, axYMax.sx, axYMax.sy - 12);

    ctx.fillStyle = '#2d6fb4';
    ctx.fillText(`Z (${zMax})`, axZMax.sx, axZMax.sy - 14);

    if (!activeExpr || !activeExpr.trim()) {
      return;
    }

    // Clean and Parse Active Expression
    let cleanInput = activeExpr.trim();
    cleanInput = cleanInput
      .replace(/^z\s*=\s*/i, '')
      .replace(/^f\s*\(\s*x\s*,\s*y\s*\)\s*=\s*/i, '')
      .replace(/^z\s*\(\s*x\s*,\s*y\s*\)\s*=\s*/i, '');

    let ast: ExpressionNode;
    try {
      ast = Parser.parse(activeExpr);
    } catch {
      try {
        ast = Parser.parse(cleanInput);
      } catch {
        return;
      }
    }

    // Determine if expression is explicit z = f(x, y) or an implicit relation F(x, y, z) = 0
    let isExplicit = true;
    let explicitAST: ExpressionNode = ast;

    if (ast.type === 'equation') {
      const lhsIsZ = ast.lhs.type === 'variable' && ast.lhs.name === 'z';
      const rhsIsZ = ast.rhs.type === 'variable' && ast.rhs.name === 'z';

      if (lhsIsZ) {
        explicitAST = ast.rhs;
        isExplicit = true;
      } else if (rhsIsZ) {
        explicitAST = ast.lhs;
        isExplicit = true;
      } else {
        isExplicit = false;
      }
    }

    // Directional light vector (top-front-right)
    const [lx, ly, lz] = normalize3D(0.45, 0.55, 0.7);

    const quads: MeshQuad[] = [];
    const gridN = 40;
    const xStep = (xMax - xMin) / gridN;
    const yStep = (yMax - yMin) / gridN;

    if (isExplicit) {
      // 1. EXPLICIT SURFACE EVALUATION z = f(x, y)
      const heightGrid: number[][] = [];
      for (let i = 0; i <= gridN; i++) {
        heightGrid[i] = [];
        const x = xMin + i * xStep;
        for (let j = 0; j <= gridN; j++) {
          const y = yMin + j * yStep;
          let z = evaluateAST(explicitAST, { x, y });
          if (isNaN(z) || !isFinite(z) || z < zMin - 0.05 || z > zMax + 0.05) {
            z = NaN;
          }
          heightGrid[i][j] = z;
        }
      }

      // Generate Quads
      for (let i = 0; i < gridN; i++) {
        for (let j = 0; j < gridN; j++) {
          const x0 = xMin + i * xStep;
          const x1 = x0 + xStep;
          const y0 = yMin + j * yStep;
          const y1 = y0 + yStep;

          const z00 = heightGrid[i][j];
          const z10 = heightGrid[i + 1][j];
          const z11 = heightGrid[i + 1][j + 1];
          const z01 = heightGrid[i][j + 1];

          if (isNaN(z00) || isNaN(z10) || isNaN(z11) || isNaN(z01)) continue;

          const proj00 = project(x0, y0, z00);
          const proj10 = project(x1, y0, z10);
          const proj11 = project(x1, y1, z11);
          const proj01 = project(x0, y1, z01);

          const avgZ = (z00 + z10 + z11 + z01) / 4;
          const avgDepth = (proj00.depth + proj10.depth + proj11.depth + proj01.depth) / 4;

          // Analytical Surface Normal in 3D world space
          const [uX, uY, uZ] = [x1 - x0, 0, z10 - z00];
          const [vX, vY, vZ] = [0, y1 - y0, z01 - z00];
          const [normX, normY, normZ] = normalize3D(...cross3D(uX, uY, uZ, vX, vY, vZ));

          quads.push({
            p0: proj00,
            p1: proj10,
            p2: proj11,
            p3: proj01,
            avgZ,
            avgDepth,
            normal: [normX, normY, normZ],
          });
        }
      }
    } else {
      // 2. IMPLICIT RELATION F(x, y, z) = 0 (Sphere, Ellipsoid, Cylinder, etc.)
      const topSheet: number[][] = [];
      const bottomSheet: number[][] = [];

      const zSamples = 32;
      const zSpan = zMax - zMin;
      const zStep = zSpan / zSamples;

      for (let i = 0; i <= gridN; i++) {
        topSheet[i] = [];
        bottomSheet[i] = [];
        const x = xMin + i * xStep;

        for (let j = 0; j <= gridN; j++) {
          const y = yMin + j * yStep;
          const foundRoots: number[] = [];

          let prevVal = evaluateAST(ast, { x, y, z: zMin });
          for (let k = 1; k <= zSamples; k++) {
            const zTest = zMin + k * zStep;
            const curVal = evaluateAST(ast, { x, y, z: zTest });

            if (isNaN(curVal) || isNaN(prevVal)) {
              prevVal = curVal;
              continue;
            }

            if (curVal === 0) {
              foundRoots.push(zTest);
            } else if (prevVal * curVal < 0) {
              // Sign change: refine root with bisection
              let zA = zTest - zStep;
              let zB = zTest;
              for (let it = 0; it < 8; it++) {
                const zMid = (zA + zB) / 2;
                const valMid = evaluateAST(ast, { x, y, z: zMid });
                if (Math.abs(valMid) < 1e-5) {
                  zA = zMid;
                  break;
                }
                if (valMid * prevVal < 0) {
                  zB = zMid;
                } else {
                  zA = zMid;
                }
              }
              foundRoots.push((zA + zB) / 2);
            }
            prevVal = curVal;
          }

          if (foundRoots.length >= 2) {
            topSheet[i][j] = Math.max(...foundRoots);
            bottomSheet[i][j] = Math.min(...foundRoots);
          } else if (foundRoots.length === 1) {
            topSheet[i][j] = foundRoots[0];
            bottomSheet[i][j] = foundRoots[0];
          } else {
            topSheet[i][j] = NaN;
            bottomSheet[i][j] = NaN;
          }
        }
      }

      // Build Quads for Upper & Lower Sheets
      const sheets = [
        { grid: topSheet, sign: 1 },
        { grid: bottomSheet, sign: -1 },
      ];

      sheets.forEach(({ grid, sign }) => {
        for (let i = 0; i < gridN; i++) {
          for (let j = 0; j < gridN; j++) {
            const x0 = xMin + i * xStep;
            const x1 = x0 + xStep;
            const y0 = yMin + j * yStep;
            const y1 = y0 + yStep;

            const z00 = grid[i][j];
            const z10 = grid[i + 1][j];
            const z11 = grid[i + 1][j + 1];
            const z01 = grid[i][j + 1];

            if (isNaN(z00) || isNaN(z10) || isNaN(z11) || isNaN(z01)) continue;

            const proj00 = project(x0, y0, z00);
            const proj10 = project(x1, y0, z10);
            const proj11 = project(x1, y1, z11);
            const proj01 = project(x0, y1, z01);

            const avgZ = (z00 + z10 + z11 + z01) / 4;
            const avgDepth = (proj00.depth + proj10.depth + proj11.depth + proj01.depth) / 4;

            const [uX, uY, uZ] = [x1 - x0, 0, z10 - z00];
            const [vX, vY, vZ] = [0, y1 - y0, z01 - z00];
            const [normX, normY, normZ] = normalize3D(
              ...(sign > 0 ? cross3D(uX, uY, uZ, vX, vY, vZ) : cross3D(vX, vY, vZ, uX, uY, uZ))
            );

            quads.push({
              p0: proj00,
              p1: proj10,
              p2: proj11,
              p3: proj01,
              avgZ,
              avgDepth,
              normal: [normX, normY, normZ],
            });
          }
        }
      });

      // Connect Rim Boundary Skirt
      for (let i = 0; i < gridN; i++) {
        for (let j = 0; j < gridN; j++) {
          const zT = topSheet[i][j];
          const zB = bottomSheet[i][j];
          if (isNaN(zT) || isNaN(zB)) continue;

          const neighbors = [
            { ni: i + 1, nj: j },
            { ni: i, nj: j + 1 },
          ];

          neighbors.forEach(({ ni, nj }) => {
            if (ni <= gridN && nj <= gridN) {
              const nT = topSheet[ni][nj];
              const nB = bottomSheet[ni][nj];
              if (isNaN(nT) && Math.abs(zT - zB) > 0.02) {
                const x0 = xMin + i * xStep;
                const y0 = yMin + j * yStep;
                const pTop = project(x0, y0, zT);
                const pBot = project(x0, y0, zB);

                quads.push({
                  p0: pTop,
                  p1: pBot,
                  p2: pBot,
                  p3: pTop,
                  avgZ: (zT + zB) / 2,
                  avgDepth: (pTop.depth + pBot.depth) / 2,
                  normal: [1, 0, 0],
                });
              }
            }
          });
        }
      }
    }

    // Painter's Algorithm Depth Sort: Back-to-front rendering
    quads.sort((a, b) => b.avgDepth - a.avgDepth);

    // Rasterize Quads with Directional Shading and Scientific Colormap
    const zRange = Math.max(1e-4, zMax - zMin);

    quads.forEach((quad) => {
      ctx.beginPath();
      ctx.moveTo(quad.p0.sx, quad.p0.sy);
      ctx.lineTo(quad.p1.sx, quad.p1.sy);
      ctx.lineTo(quad.p2.sx, quad.p2.sy);
      ctx.lineTo(quad.p3.sx, quad.p3.sy);
      ctx.closePath();

      // Lambertian Diffuse Lighting
      const dotLight = quad.normal[0] * lx + quad.normal[1] * ly + quad.normal[2] * lz;
      const lightFactor = 0.35 + 0.65 * Math.abs(dotLight);

      // Colormap normalized to z bounds: Dartmouth Green (#00693E) -> Deep Blue (#2d6fb4) -> Amber
      const normZ = Math.max(0, Math.min(1, (quad.avgZ - zMin) / zRange));
      const hue = 145 - normZ * 125 + (normZ > 0.5 ? (normZ - 0.5) * 200 : 0);
      const sat = 80;
      const baseLightness = isLight ? 48 : 50;

      if (!wireframe) {
        ctx.fillStyle = hslShade(hue, sat, baseLightness, lightFactor, 0.94);
        ctx.fill();
      }

      ctx.strokeStyle = wireframe
        ? hslShade(hue, 90, isLight ? 40 : 65, 1)
        : isLight
        ? 'rgba(0, 0, 0, 0.15)'
        : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = wireframe ? 1.2 : 0.6;
      ctx.stroke();
    });
  }, [activeExpr, currentViewport, isLight, isContourMode, showContourHeatmap, numContourLevels, hoverCoord]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      render();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [render]);

  useEffect(() => {
    render();
  }, [render]);

  // Mouse drag orbit handlers & contour hover/pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (onInteractionStart) {
      onInteractionStart();
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    if (isContourMode) {
      const left = 76;
      const right = canvas.width < 680 ? 110 : 160;
      const top = 56;
      const bottom = 88;
      const plotWidth = Math.max(50, canvas.width - left - right);
      const plotHeight = Math.max(50, canvas.height - top - bottom);

      const { xMin = -1, xMax = 1, yMin = -1, yMax = 1 } = currentViewport;

      if (clientX >= left && clientX <= left + plotWidth && clientY >= top && clientY <= top + plotHeight) {
        const xVal = xMin + ((clientX - left) / plotWidth) * (xMax - xMin);
        const yVal = yMax - ((clientY - top) / plotHeight) * (yMax - yMin);

        let zVal = 0;
        if (activeExpr && activeExpr.trim()) {
          try {
            let clean = activeExpr.trim();
            if (clean.startsWith('z=')) clean = clean.slice(2).trim();
            const ast = Parser.parse(clean);
            zVal = evaluateAST(ast, { x: xVal, y: yVal, z: 0 });
          } catch {
            zVal = 0;
          }
        }
        setHoverCoord({ x: xVal, y: yVal, z: isNaN(zVal) ? 0 : zVal });
      } else {
        setHoverCoord(null);
      }

      // Pan bounds if dragging
      if (isDragging && dragStart) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        const xSpan = xMax - xMin;
        const ySpan = yMax - yMin;
        const xShift = (-dx / plotWidth) * xSpan;
        const yShift = (dy / plotHeight) * ySpan;

        updateViewport({
          ...currentViewport,
          xMin: xMin + xShift,
          xMax: xMax + xShift,
          yMin: yMin + yShift,
          yMax: yMax + yShift,
        });
        setDragStart({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    if (!isDragging || !dragStart) return;
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    updateViewport({
      ...currentViewport,
      rotY: (currentViewport.rotY || 0.8) + dx * 0.008,
      rotX: Math.max(-1.4, Math.min(1.4, (currentViewport.rotX || 0.6) + dy * 0.008)),
    });
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if (onInteractionStart) {
        onInteractionStart();
      }
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
      setTouchPinchDist(null);
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setTouchPinchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging && dragStart) {
      const dx = e.touches[0].clientX - dragStart.x;
      const dy = e.touches[0].clientY - dragStart.y;

      if (isContourMode) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { xMin = -1, xMax = 1, yMin = -1, yMax = 1 } = currentViewport;
        const xSpan = xMax - xMin;
        const ySpan = yMax - yMin;
        const xShift = (-dx / canvas.width) * xSpan;
        const yShift = (dy / canvas.height) * ySpan;

        updateViewport({
          ...currentViewport,
          xMin: xMin + xShift,
          xMax: xMax + xShift,
          yMin: yMin + yShift,
          yMax: yMax + yShift,
        });
      } else {
        updateViewport({
          ...currentViewport,
          rotY: (currentViewport.rotY || 0.8) + dx * 0.008,
          rotX: Math.max(-1.4, Math.min(1.4, (currentViewport.rotX || 0.6) + dy * 0.008)),
        });
      }
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2 && touchPinchDist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / touchPinchDist;
      if (Math.abs(factor - 1) > 0.02) {
        updateViewport({
          ...currentViewport,
          zoom: Math.max(10, Math.min(250, (currentViewport.zoom || 120) * factor)),
        });
        setTouchPinchDist(dist);
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setDragStart(null);
    setTouchPinchDist(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (onInteractionStart) {
      onInteractionStart();
    }
    const factor = e.deltaY > 0 ? 0.9 : 1.1;

    if (isContourMode) {
      const { xMin = -1, xMax = 1, yMin = -1, yMax = 1 } = currentViewport;
      const xMid = (xMin + xMax) / 2;
      const yMid = (yMin + yMax) / 2;
      const xHalf = ((xMax - xMin) * (1 / factor)) / 2;
      const yHalf = ((yMax - yMin) * (1 / factor)) / 2;

      updateViewport({
        ...currentViewport,
        xMin: xMid - xHalf,
        xMax: xMid + xHalf,
        yMin: yMid - yHalf,
        yMax: yMid + yHalf,
      });
    } else {
      updateViewport({
        ...currentViewport,
        zoom: Math.max(10, Math.min(250, (currentViewport.zoom || 120) * factor)),
      });
    }
  };

  const boundsSummary = `${currentViewport.xMin ?? -1}≤x≤${currentViewport.xMax ?? 1}, ${currentViewport.yMin ?? -1}≤y≤${currentViewport.yMax ?? 1}, ${currentViewport.zMin ?? -1}≤z≤${currentViewport.zMax ?? 1}`;

  return (
    <div
      ref={containerRef}
      id="surface-3d-container"
      className={`relative w-full h-full select-none overflow-hidden touch-none ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHoverCoord(null);
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        id="graph-3d-canvas"
        className={`w-full h-full block ${isContourMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
      />

      {/* Bottom controls: Bounds, Contour toggle, and Heatmap toggle */}
      <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-1.5 z-10 pointer-events-auto max-w-[calc(100%-24px)]">
        {activeExpr && !isContourMode && (
          <div
            className={`px-2.5 py-1 border text-xs font-mono flex items-center gap-1.5 shadow-xl rounded-none shrink-0 ${
              isLight
                ? 'bg-white/95 text-black border-neutral-300'
                : 'bg-black/90 text-white border-neutral-800'
            }`}
          >
            <Box className="w-3.5 h-3.5 text-[#6042a6] shrink-0" />
            <span className="truncate max-w-[160px] sm:max-w-xs">
              <strong className="font-serif">z = {activeExpr}</strong>
            </span>
          </div>
        )}

        <button
          onClick={handleOpenBounds}
          className={`px-2.5 py-1 border text-[11px] font-mono flex items-center gap-1.5 shadow-xl rounded-none transition-colors shrink-0 ${
            isLight
              ? 'bg-white/95 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
              : 'bg-black/90 text-neutral-200 border-neutral-800 hover:bg-neutral-900'
          }`}
          title="Click to adjust 3D Graph Bounds"
        >
          <Sliders className="w-3 h-3 text-[#6042a6] shrink-0" />
          <span className="truncate">Bounds: {boundsSummary}</span>
        </button>

        <button
          onClick={handleToggleContour}
          className={`px-2.5 py-1 border text-[11px] font-mono flex items-center gap-1.5 shadow-xl rounded-none transition-colors shrink-0 ${
            isContourMode
              ? 'bg-[#00693E] text-white border-[#00693E]'
              : isLight
              ? 'bg-white/95 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
              : 'bg-black/90 text-neutral-200 border-neutral-800 hover:bg-neutral-900'
          }`}
          title="Toggle Top-Down Contour Map (Level Curves & Isoclines)"
        >
          <Waves className={`w-3 h-3 ${isContourMode ? 'text-white' : 'text-[#00693E]'} shrink-0`} />
          <span>{isContourMode ? 'Contour (Active)' : 'Contour'}</span>
        </button>

        {isContourMode && (
          <button
            onClick={() => setShowContourHeatmap((prev) => !prev)}
            className={`px-2.5 py-1 border text-[11px] font-mono flex items-center gap-1.5 shadow-xl rounded-none transition-colors shrink-0 ${
              showContourHeatmap
                ? 'bg-[#2d6fb4] text-white border-[#2d6fb4]'
                : isLight
                ? 'bg-white/95 text-neutral-800 border-neutral-300 hover:bg-neutral-100'
                : 'bg-black/90 text-neutral-200 border-neutral-800 hover:bg-neutral-900'
            }`}
            title="Toggle heatmap color fill gradient"
          >
            <Eye className="w-3 h-3" />
            <span>{showContourHeatmap ? 'Heatmap: On' : 'Lines Only'}</span>
          </button>
        )}
      </div>

      {/* Empty prompt without preset examples */}
      {!activeExpr && (
        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 text-center space-y-2 z-10">
          <div
            className={`p-4 border max-w-xs shadow-2xl space-y-1.5 pointer-events-auto rounded-none ${
              isLight
                ? 'bg-white text-black border-neutral-300'
                : 'bg-black text-white border-neutral-800'
            }`}
          >
            <Box className="w-6 h-6 text-[#6042a6] mx-auto" />
            <p className="text-xs font-semibold">No 3D Surface Function</p>
            <p className={`text-[11px] leading-relaxed ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Enter a 3D function or relationship to plot.
            </p>
          </div>
        </div>
      )}

      {/* 3D Bounds Settings Modal */}
      <BoundsModal3D
        isOpen={isBoundsOpen}
        onClose={handleCloseBounds}
        viewport={currentViewport}
        onChange={updateViewport}
        theme={theme}
      />
    </div>
  );
};
