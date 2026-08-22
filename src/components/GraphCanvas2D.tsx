import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Viewport2D, MathItem, CriticalPoint, DataTable } from '../types';
import { Parser } from '../engine/parser';
import { evaluateAST, ExpressionNode } from '../engine/ast';
import { SymbolicDifferentiator } from '../engine/differentiator';
import { NumericalSolvers } from '../engine/solvers';
import { splitFormulaAndDomain, cleanFormula, parseDomainRestriction, DomainRestriction, parseParametricExpression } from '../engine/domain';
import { normalizeFunctionInput } from '../engine/analyzer';
import { globalSeriesEvaluator, parseSeriesExpression } from '../engine/series';
import { parseAndEvaluateComplex, Complex } from '../engine/complex';
import { Crosshair, Compass } from 'lucide-react';

export interface AnalysisFeaturePoint {
  x: number;
  y: number;
  label: string;
  type: 'focus' | 'center' | 'vertex' | 'co-vertex' | 'zero' | 'extrema' | 'inflection' | 'intercept' | string;
}

export interface AnalysisFeatureLine {
  type: 'vertical' | 'horizontal' | 'slant';
  x?: number;
  y?: number;
  m?: number;
  b?: number;
  label: string;
  color?: string;
}

export interface AnalysisOverlayData {
  points?: AnalysisFeaturePoint[];
  lines?: AnalysisFeatureLine[];
}

interface GraphCanvas2DProps {
  items: MathItem[];
  viewport: Viewport2D;
  onViewportChange: (newViewport: Viewport2D) => void;
  criticalPoints: CriticalPoint[];
  hoveredPoint: CriticalPoint | null;
  onHoverPoint: (point: CriticalPoint | null) => void;
  showTangentAtX?: number | null;
  tracePoint?: { x: number; y: number } | null;
  onSelectCoordinate?: (x: number, y: number) => void;
  dataTables?: DataTable[];
  analysisOverlay?: AnalysisOverlayData | null;
  globalParameters?: Record<string, number>;
  coordinateMode?: 'cartesian' | 'polar';
  angleMode?: 'RAD' | 'DEG';
  theme?: 'dark' | 'light';
  onInteractionStart?: () => void;
}

function isExplicitFormula(str: string): boolean {
  const parts = str.split('=');
  if (parts.length !== 2) return false;
  const lhs = parts[0].trim().toLowerCase();
  const rhs = parts[1].trim().toLowerCase();
  if (/^(?:y|y\s*\(\s*x\s*\)|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\)|h\s*\(\s*x\s*\))$/.test(lhs) && !rhs.includes('y')) {
    return true;
  }
  if (/^(?:r|r\s*\(\s*(?:theta|θ)\s*\))$/.test(lhs) && !rhs.includes('r')) {
    return true;
  }
  if (/^z$/.test(lhs) && !rhs.includes('z')) {
    return true;
  }
  return false;
}

export const GraphCanvas2D: React.FC<GraphCanvas2DProps> = ({
  items,
  viewport,
  onViewportChange,
  criticalPoints,
  hoveredPoint,
  onHoverPoint,
  showTangentAtX,
  tracePoint,
  onSelectCoordinate,
  dataTables = [],
  analysisOverlay = null,
  globalParameters = {},
  coordinateMode = 'cartesian',
  angleMode = 'RAD',
  theme = 'dark',
  onInteractionStart,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [touchPinchDist, setTouchPinchDist] = useState<number | null>(null);
  const [cursorCoord, setCursorCoord] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 400 });

  const isLight = theme === 'light';

  const adjViewport = useMemo(() => {
    const { width, height } = canvasSize;
    if (width === 0 || height === 0) return viewport;

    const xCenter = (viewport.xMin + viewport.xMax) / 2;
    const yCenter = (viewport.yMin + viewport.yMax) / 2;

    const screenRatio = width / height;
    const worldWidth = viewport.xMax - viewport.xMin;
    const worldHeight = viewport.yMax - viewport.yMin;
    const worldRatio = worldWidth / worldHeight;

    let xMin = viewport.xMin;
    let xMax = viewport.xMax;
    let yMin = viewport.yMin;
    let yMax = viewport.yMax;

    if (screenRatio > worldRatio) {
      // Screen is wider than the world aspect ratio. Expand world width.
      const newWorldWidth = screenRatio * worldHeight;
      xMin = xCenter - newWorldWidth / 2;
      xMax = xCenter + newWorldWidth / 2;
    } else {
      // Screen is taller than the world aspect ratio. Expand world height.
      const newWorldHeight = worldWidth / screenRatio;
      yMin = yCenter - newWorldHeight / 2;
      yMax = yCenter + newWorldHeight / 2;
    }

    return { xMin, xMax, yMin, yMax };
  }, [viewport, canvasSize]);

  // Main Canvas Render
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    const { xMin, xMax, yMin, yMax } = adjViewport;

    // Coordinate conversions
    const toScreenX = (wx: number) => ((wx - xMin) / (xMax - xMin)) * width;
    const toScreenY = (wy: number) => height - ((wy - yMin) / (yMax - yMin)) * height;
    const toWorldX = (sx: number) => xMin + (sx / width) * (xMax - xMin);
    const toWorldY = (sy: number) => yMin + ((height - sy) / height) * (yMax - yMin);

    // 1. Clear background
    ctx.fillStyle = isLight ? '#FFFFFF' : '#000000';
    ctx.fillRect(0, 0, width, height);

    const originX = toScreenX(0);
    const originY = toScreenY(0);

    // 2. GRID RENDERING (Cartesian vs Polar)
    if (coordinateMode === 'polar') {
      // POLAR COORDINATE GRID
      const maxR = Math.max(
        Math.hypot(xMin, yMin),
        Math.hypot(xMax, yMin),
        Math.hypot(xMin, yMax),
        Math.hypot(xMax, yMax)
      );

      const targetRSteps = 8;
      const rawStepR = maxR / targetRSteps;
      const stepR = getNiceStep(rawStepR);

      // Minor Concentric Circles
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const minorStepR = stepR / 2;
      for (let r = minorStepR; r <= maxR; r += minorStepR) {
        const radiusPx = (r / (xMax - xMin)) * width;
        ctx.moveTo(originX + radiusPx, originY);
        ctx.arc(originX, originY, radiusPx, 0, Math.PI * 2);
      }
      ctx.stroke();

      // Major Concentric Circles
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let r = stepR; r <= maxR; r += stepR) {
        const radiusPx = (r / (xMax - xMin)) * width;
        ctx.moveTo(originX + radiusPx, originY);
        ctx.arc(originX, originY, radiusPx, 0, Math.PI * 2);
      }
      ctx.stroke();

      // Radial Rays (every 15 degrees, with key angles at 30, 45, 60, 90...)
      const rayAngles = [
        { angle: 0, radLabel: '0', degLabel: '0°', isMajor: true },
        { angle: Math.PI / 12, radLabel: 'π/12', degLabel: '15°', isMajor: false },
        { angle: Math.PI / 6, radLabel: 'π/6', degLabel: '30°', isMajor: true },
        { angle: Math.PI / 4, radLabel: 'π/4', degLabel: '45°', isMajor: true },
        { angle: Math.PI / 3, radLabel: 'π/3', degLabel: '60°', isMajor: true },
        { angle: (5 * Math.PI) / 12, radLabel: '5π/12', degLabel: '75°', isMajor: false },
        { angle: Math.PI / 2, radLabel: 'π/2', degLabel: '90°', isMajor: true },
        { angle: (7 * Math.PI) / 12, radLabel: '7π/12', degLabel: '105°', isMajor: false },
        { angle: (2 * Math.PI) / 3, radLabel: '2π/3', degLabel: '120°', isMajor: true },
        { angle: (3 * Math.PI) / 4, radLabel: '3π/4', degLabel: '135°', isMajor: true },
        { angle: (5 * Math.PI) / 6, radLabel: '5π/6', degLabel: '150°', isMajor: true },
        { angle: (11 * Math.PI) / 12, radLabel: '11π/12', degLabel: '165°', isMajor: false },
        { angle: Math.PI, radLabel: 'π', degLabel: '180°', isMajor: true },
        { angle: (13 * Math.PI) / 12, radLabel: '13π/12', degLabel: '195°', isMajor: false },
        { angle: (7 * Math.PI) / 6, radLabel: '7π/6', degLabel: '210°', isMajor: true },
        { angle: (5 * Math.PI) / 4, radLabel: '5π/4', degLabel: '225°', isMajor: true },
        { angle: (4 * Math.PI) / 3, radLabel: '4π/3', degLabel: '240°', isMajor: true },
        { angle: (17 * Math.PI) / 12, radLabel: '17π/12', degLabel: '255°', isMajor: false },
        { angle: (3 * Math.PI) / 2, radLabel: '3π/2', degLabel: '270°', isMajor: true },
        { angle: (19 * Math.PI) / 12, radLabel: '19π/12', degLabel: '285°', isMajor: false },
        { angle: (5 * Math.PI) / 3, radLabel: '5π/3', degLabel: '300°', isMajor: true },
        { angle: (7 * Math.PI) / 4, radLabel: '7π/4', degLabel: '315°', isMajor: true },
        { angle: (11 * Math.PI) / 6, radLabel: '11π/6', degLabel: '330°', isMajor: true },
        { angle: (23 * Math.PI) / 12, radLabel: '23π/12', degLabel: '345°', isMajor: false },
      ];

      // Draw minor rays
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      rayAngles.filter((r) => !r.isMajor).forEach((r) => {
        const farLen = maxR * 1.5;
        const wx = farLen * Math.cos(r.angle);
        const wy = farLen * Math.sin(r.angle);
        ctx.moveTo(originX, originY);
        ctx.lineTo(toScreenX(wx), toScreenY(wy));
      });
      ctx.stroke();

      // Draw major rays
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      rayAngles.filter((r) => r.isMajor).forEach((r) => {
        const farLen = maxR * 1.5;
        const wx = farLen * Math.cos(r.angle);
        const wy = farLen * Math.sin(r.angle);
        ctx.moveTo(originX, originY);
        ctx.lineTo(toScreenX(wx), toScreenY(wy));
      });
      ctx.stroke();

      // Principal Axes (0°/180° and 90°/270°)
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, originY);
      ctx.lineTo(width, originY);
      ctx.moveTo(originX, 0);
      ctx.lineTo(originX, height);
      ctx.stroke();

      // Angle Labels around the outer visible perimeter
      ctx.font = '10px "STIX Two Math", "Fira Code", monospace';
      ctx.fillStyle = isLight ? '#00693E' : '#4ade80';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const labelDist = Math.min(width, height) * 0.44;
      rayAngles.filter((r) => r.isMajor).forEach((r) => {
        const lx = originX + labelDist * Math.cos(r.angle);
        const ly = originY - labelDist * Math.sin(r.angle);
        if (lx >= 16 && lx <= width - 16 && ly >= 14 && ly <= height - 14) {
          const text = angleMode === 'DEG' ? r.degLabel : r.radLabel;
          // Background pill
          ctx.fillStyle = isLight ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)';
          const tm = ctx.measureText(text);
          ctx.fillRect(lx - tm.width / 2 - 3, ly - 7, tm.width + 6, 14);
          ctx.fillStyle = isLight ? '#00693E' : '#4ade80';
          ctx.fillText(text, lx, ly);
        }
      });

      // Radius Labels along horizontal positive and negative axis
      ctx.font = '10px "STIX Two Math", "Fira Code", monospace';
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.75)';
      for (let r = stepR; r <= maxR; r += stepR) {
        const sxPos = toScreenX(r);
        const sxNeg = toScreenX(-r);
        const ly = Math.min(Math.max(originY + 12, 16), height - 16);

        if (sxPos >= 20 && sxPos <= width - 20) {
          ctx.fillStyle = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
          ctx.fillRect(sxPos - 12, ly - 8, 24, 14);
          ctx.fillStyle = isLight ? '#000000' : '#ffffff';
          ctx.fillText(`r=${formatNumber(r)}`, sxPos, ly);
        }
        if (sxNeg >= 20 && sxNeg <= width - 20) {
          ctx.fillStyle = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)';
          ctx.fillRect(sxNeg - 12, ly - 8, 24, 14);
          ctx.fillStyle = isLight ? '#000000' : '#ffffff';
          ctx.fillText(`r=${formatNumber(r)}`, sxNeg, ly);
        }
      }
    } else {
      // CARTESIAN RECTANGULAR GRID
      const targetSteps = 10;
      const rawStepX = (xMax - xMin) / targetSteps;
      const rawStepY = (yMax - yMin) / targetSteps;
      const tickStepX = getNiceStep(rawStepX);
      const tickStepY = getNiceStep(rawStepY);

      // Minor Grid Lines
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      const minorStepX = tickStepX / 5;
      let startX = Math.floor(xMin / minorStepX) * minorStepX;
      while (startX <= xMax) {
        const sx = toScreenX(startX);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
        startX += minorStepX;
      }

      const minorStepY = tickStepY / 5;
      let startY = Math.floor(yMin / minorStepY) * minorStepY;
      while (startY <= yMax) {
        const sy = toScreenY(startY);
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
        startY += minorStepY;
      }
      ctx.stroke();

      // Major Grid Lines
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.09)';
      ctx.lineWidth = 1;
      ctx.beginPath();

      startX = Math.floor(xMin / tickStepX) * tickStepX;
      while (startX <= xMax) {
        const sx = toScreenX(startX);
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, height);
        startX += tickStepX;
      }

      startY = Math.floor(yMin / tickStepY) * tickStepY;
      while (startY <= yMax) {
        const sy = toScreenY(startY);
        ctx.moveTo(0, sy);
        ctx.lineTo(width, sy);
        startY += tickStepY;
      }
      ctx.stroke();

      // Primary Axes (X and Y = 0)
      ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (originX >= 0 && originX <= width) {
        ctx.moveTo(originX, 0);
        ctx.lineTo(originX, height);
      }
      if (originY >= 0 && originY <= height) {
        ctx.moveTo(0, originY);
        ctx.lineTo(width, originY);
      }
      ctx.stroke();

      // Axis Tick Labels
      ctx.font = '10px "STIX Two Math", "Fira Code", monospace';
      ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.65)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      startX = Math.floor(xMin / tickStepX) * tickStepX;
      while (startX <= xMax) {
        if (Math.abs(startX) > 1e-6) {
          const sx = toScreenX(startX);
          const labelY = Math.min(Math.max(originY + 4, 4), height - 16);
          ctx.fillText(formatNumber(startX), sx, labelY);
        }
        startX += tickStepX;
      }

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      startY = Math.floor(yMin / tickStepY) * tickStepY;
      while (startY <= yMax) {
        if (Math.abs(startY) > 1e-6) {
          const sy = toScreenY(startY);
          const labelX = Math.min(Math.max(originX - 6, 26), width - 6);
          ctx.fillText(formatNumber(startY), labelX, sy);
        }
        startY += tickStepY;
      }
    }

    // Origin Badge (0,0)
    if (originX >= 10 && originX <= width - 10 && originY >= 10 && originY <= height - 10) {
      ctx.fillStyle = isLight ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(originX, originY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. RENDER CURVES, POLAR PLOTS, IMPLICIT EQUATIONS & CALCULUS VISUALIZERS
    items.forEach((item) => {
      if (!item.visible) return;

      try {
        const { formula, domainStr } = splitFormulaAndDomain(item.rawInput);
        const effectiveDomainStr = item.domainRaw || domainStr;
        const evalContext = { ...globalParameters, ...(item.parameterValues || {}) };
        const cleanExpr = cleanFormula(formula);

        const isImplicit =
          item.type === 'implicit' ||
          (formula.includes('=') && !isExplicitFormula(formula)) ||
          (item.type === 'cartesian' && formula.includes('y') && formula.includes('x'));

        if (isImplicit) {
          // Render Implicit Relation (Circles, Ellipses, Hyperbolas, non-function curves)
          const norm = normalizeFunctionInput(formula);
          const ast = Parser.parse(norm.expression);
          const domain = parseDomainRestriction(effectiveDomainStr, 'x');
          renderImplicitRelation(ctx, ast, adjViewport, width, height, item.color, toScreenX, toScreenY, domain, evalContext);
        } else if (item.type === 'cartesian') {
          const domain = parseDomainRestriction(effectiveDomainStr, 'x');
          const ast = Parser.parse(cleanExpr);

          // Integral Area / Riemann Sums rendering
          if (item.isIntegralVisible && item.integralRange) {
            const [iA, iB] = item.integralRange;
            const rMode = item.riemannMode || 'none';
            const rN = item.riemannN || 8;

            if (rMode !== 'none') {
              const rSum = NumericalSolvers.computeRiemannSum(ast, iA, iB, rN, rMode);
              rSum.rectangles.forEach((rect) => {
                const rx1 = toScreenX(rect.x);
                const rx2 = toScreenX(rect.x + rect.width);
                const ry = toScreenY(rect.height);
                const rZero = toScreenY(0);
                const rw = rx2 - rx1;
                const rh = rZero - ry;

                ctx.fillStyle = `${item.color}33`;
                ctx.strokeStyle = `${item.color}99`;
                ctx.lineWidth = 1;
                ctx.fillRect(rx1, ry < rZero ? ry : rZero, rw, Math.abs(rh));
                ctx.strokeRect(rx1, ry < rZero ? ry : rZero, rw, Math.abs(rh));
              });
            } else {
              // Smooth definite integral shading
              ctx.fillStyle = `${item.color}25`;
              ctx.beginPath();
              const startSx = toScreenX(iA);
              ctx.moveTo(startSx, toScreenY(0));

              const intSteps = 150;
              for (let s = 0; s <= intSteps; s++) {
                const wx = iA + (s / intSteps) * (iB - iA);
                const wy = evaluateAST(ast, { ...evalContext, x: wx });
                if (!isNaN(wy) && isFinite(wy)) {
                  ctx.lineTo(toScreenX(wx), toScreenY(wy));
                }
              }
              ctx.lineTo(toScreenX(iB), toScreenY(0));
              ctx.closePath();
              ctx.fill();

              // Boundary vertical lines
              ctx.strokeStyle = `${item.color}80`;
              ctx.lineWidth = 1;
              ctx.setLineDash([3, 3]);
              ctx.beginPath();
              ctx.moveTo(toScreenX(iA), toScreenY(0));
              ctx.lineTo(toScreenX(iA), toScreenY(evaluateAST(ast, { ...evalContext, x: iA })));
              ctx.moveTo(toScreenX(iB), toScreenY(0));
              ctx.lineTo(toScreenX(iB), toScreenY(evaluateAST(ast, { ...evalContext, x: iB })));
              ctx.stroke();
              ctx.setLineDash([]);
            }
          }

          // Main Function Curve with Domain Check
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();

          const steps = width * 1.5;
          let isStarted = false;
          let prevY = 0;

          for (let i = 0; i <= steps; i++) {
            const sx = (i / steps) * width;
            const wx = toWorldX(sx);

            // Domain filter: only render if wx strictly satisfies domain constraint
            if (domain && !domain.check(wx, evalContext)) {
              isStarted = false;
              continue;
            }

            const wy = evaluateAST(ast, { ...evalContext, x: wx });

            if (isNaN(wy) || !isFinite(wy) || Math.abs(wy) > 1e6) {
              isStarted = false;
              continue;
            }

            const sy = toScreenY(wy);
            if (isStarted && Math.abs(sy - prevY) > height * 0.8) {
              isStarted = false;
            }

            if (!isStarted) {
              ctx.moveTo(sx, sy);
              isStarted = true;
            } else {
              ctx.lineTo(sx, sy);
            }
            prevY = sy;
          }
          ctx.stroke();

          // Render domain endpoint markers if domain is restricted (e.g. {0 < x <= 2})
          if (domain && domain.isRestricted) {
            const endpoints = [
              { val: domain.min, inclusive: domain.minInclusive },
              { val: domain.max, inclusive: domain.maxInclusive },
            ];

            endpoints.forEach((ep) => {
              if (ep.val !== -Infinity && ep.val !== Infinity && ep.val >= xMin && ep.val <= xMax) {
                const epY = evaluateAST(ast, { ...evalContext, x: ep.val });
                if (!isNaN(epY) && isFinite(epY)) {
                  const epSx = toScreenX(ep.val);
                  const epSy = toScreenY(epY);

                  ctx.beginPath();
                  ctx.arc(epSx, epSy, 5, 0, Math.PI * 2);
                  if (ep.inclusive) {
                    // Closed filled dot for <= or >=
                    ctx.fillStyle = item.color;
                    ctx.fill();
                    ctx.strokeStyle = isLight ? '#ffffff' : '#000000';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                  } else {
                    // Open hollow circle for < or >
                    ctx.fillStyle = isLight ? '#ffffff' : '#000000';
                    ctx.fill();
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                  }
                }
              }
            });
          }

          // Definite Integral Area Shading
          if (item.isIntegralVisible) {
            const [intA, intB] = item.integralRange || [0, 2];
            const startX = Math.min(intA, intB);
            const endX = Math.max(intA, intB);
            ctx.fillStyle = `${item.color}33`;
            ctx.beginPath();
            ctx.moveTo(toScreenX(startX), toScreenY(0));
            const intSteps = 300;
            for (let i = 0; i <= intSteps; i++) {
              const currX = startX + (i / intSteps) * (endX - startX);
              if (domain && !domain.check(currX, evalContext)) continue;
              const currY = evaluateAST(ast, { ...evalContext, x: currX });
              if (!isNaN(currY) && isFinite(currY)) {
                ctx.lineTo(toScreenX(currX), toScreenY(currY));
              }
            }
            ctx.lineTo(toScreenX(endX), toScreenY(0));
            ctx.closePath();
            ctx.fill();

            // Boundary vertical lines
            ctx.strokeStyle = `${item.color}aa`;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            const yA = evaluateAST(ast, { ...evalContext, x: startX });
            const yB = evaluateAST(ast, { ...evalContext, x: endX });
            if (!isNaN(yA)) {
              ctx.moveTo(toScreenX(startX), toScreenY(0));
              ctx.lineTo(toScreenX(startX), toScreenY(yA));
            }
            if (!isNaN(yB)) {
              ctx.moveTo(toScreenX(endX), toScreenY(0));
              ctx.lineTo(toScreenX(endX), toScreenY(yB));
            }
            ctx.stroke();
            ctx.setLineDash([]);
          }

          // Derivative Curve f'(x)
          if (item.isDerivativeVisible) {
            const dAst = SymbolicDifferentiator.diff(ast, 'x');
            ctx.strokeStyle = `${item.color}99`;
            ctx.lineWidth = 1.8;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();

            let dStarted = false;
            for (let i = 0; i <= steps; i++) {
              const sx = (i / steps) * width;
              const wx = toWorldX(sx);
              if (domain && !domain.check(wx, evalContext)) {
                dStarted = false;
                continue;
              }
              const dWy = evaluateAST(dAst, { ...evalContext, x: wx });

              if (isNaN(dWy) || !isFinite(dWy)) {
                dStarted = false;
                continue;
              }

              const sy = toScreenY(dWy);
              if (!dStarted) {
                ctx.moveTo(sx, sy);
                dStarted = true;
              } else {
                ctx.lineTo(sx, sy);
              }
            }
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else if (item.type === 'polar') {
          const ast = Parser.parse(cleanExpr);
          const domain = parseDomainRestriction(effectiveDomainStr, 'theta');
          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();

          const polarSteps = 1000;
          const thetaMin = domain && domain.min !== -Infinity ? domain.min : 0;
          const thetaMax = domain && domain.max !== Infinity ? domain.max : Math.PI * 6;
          let isStarted = false;

          for (let i = 0; i <= polarSteps; i++) {
            const theta = thetaMin + (i / polarSteps) * (thetaMax - thetaMin);
            if (domain && !domain.check(theta, evalContext)) {
              isStarted = false;
              continue;
            }
            const r = evaluateAST(ast, { ...evalContext, theta, t: theta, x: theta });
            if (isNaN(r) || !isFinite(r)) {
              isStarted = false;
              continue;
            }

            const wx = r * Math.cos(theta);
            const wy = r * Math.sin(theta);
            const sx = toScreenX(wx);
            const sy = toScreenY(wy);

            if (!isStarted) {
              ctx.moveTo(sx, sy);
              isStarted = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          ctx.stroke();

          // Polar domain endpoint markers
          if (domain && domain.isRestricted) {
            [
              { val: domain.min, inc: domain.minInclusive },
              { val: domain.max, inc: domain.maxInclusive },
            ].forEach((ep) => {
              if (ep.val !== -Infinity && ep.val !== Infinity) {
                const r = evaluateAST(ast, { ...evalContext, theta: ep.val, t: ep.val, x: ep.val });
                if (!isNaN(r) && isFinite(r)) {
                  const wx = r * Math.cos(ep.val);
                  const wy = r * Math.sin(ep.val);
                  const sx = toScreenX(wx);
                  const sy = toScreenY(wy);

                  ctx.beginPath();
                  ctx.arc(sx, sy, 5, 0, Math.PI * 2);
                  if (ep.inc) {
                    ctx.fillStyle = item.color;
                    ctx.fill();
                    ctx.strokeStyle = isLight ? '#ffffff' : '#000000';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                  } else {
                    ctx.fillStyle = isLight ? '#ffffff' : '#000000';
                    ctx.fill();
                    ctx.strokeStyle = item.color;
                    ctx.lineWidth = 2.5;
                    ctx.stroke();
                  }
                }
              }
            });
          }
        } else if (item.type === 'parametric') {
          const { xExpr, yExpr, domainStr: paramDomainStr } = parseParametricExpression(
            item.rawInput,
            item.parametricX || 'cos(t)',
            item.parametricY || 'sin(t)'
          );
          const astX = Parser.parse(cleanFormula(xExpr));
          const astY = Parser.parse(cleanFormula(yExpr));
          const domain = parseDomainRestriction(effectiveDomainStr || paramDomainStr, 't');

          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();

          const paramSteps = 1200;
          const tMin = domain && domain.min !== -Infinity ? domain.min : (item.parametricTMin ?? -10);
          const tMax = domain && domain.max !== Infinity ? domain.max : (item.parametricTMax ?? 10);
          let isStarted = false;

          for (let i = 0; i <= paramSteps; i++) {
            const t = tMin + (i / paramSteps) * (tMax - tMin);
            if (domain && !domain.check(t, evalContext)) {
              isStarted = false;
              continue;
            }
            const wx = evaluateAST(astX, { ...evalContext, t });
            const wy = evaluateAST(astY, { ...evalContext, t });

            if (isNaN(wx) || isNaN(wy) || !isFinite(wx) || !isFinite(wy)) {
              isStarted = false;
              continue;
            }

            const sx = toScreenX(wx);
            const sy = toScreenY(wy);

            if (!isStarted) {
              ctx.moveTo(sx, sy);
              isStarted = true;
            } else {
              ctx.lineTo(sx, sy);
            }
          }
          ctx.stroke();

          // Parametric Simulator Tracer Particle & Velocity Vector
          const curT = item.parametricTCurrent ?? tMin;
          const curWx = evaluateAST(astX, { ...evalContext, t: curT });
          const curWy = evaluateAST(astY, { ...evalContext, t: curT });

          if (!isNaN(curWx) && !isNaN(curWy) && isFinite(curWx) && isFinite(curWy)) {
            const curSx = toScreenX(curWx);
            const curSy = toScreenY(curWy);

            // Velocity Vector v(t) = (x'(t), y'(t))
            if (item.showVelocityVector !== false) {
              try {
                const dAstX = SymbolicDifferentiator.diff(astX, 't');
                const dAstY = SymbolicDifferentiator.diff(astY, 't');
                const vx = evaluateAST(dAstX, { ...evalContext, t: curT });
                const vy = evaluateAST(dAstY, { ...evalContext, t: curT });

                if (!isNaN(vx) && !isNaN(vy) && isFinite(vx) && isFinite(vy)) {
                  const speed = Math.sqrt(vx * vx + vy * vy);
                  const scaleFactor = 0.5; // Visual arrow scale
                  const endSx = toScreenX(curWx + vx * scaleFactor);
                  const endSy = toScreenY(curWy + vy * scaleFactor);

                  // Velocity Arrow Body
                  ctx.strokeStyle = '#f59e0b';
                  ctx.fillStyle = '#f59e0b';
                  ctx.lineWidth = 2;
                  ctx.beginPath();
                  ctx.moveTo(curSx, curSy);
                  ctx.lineTo(endSx, endSy);
                  ctx.stroke();

                  // Arrowhead
                  const angle = Math.atan2(endSy - curSy, endSx - curSx);
                  const headLen = 8;
                  ctx.beginPath();
                  ctx.moveTo(endSx, endSy);
                  ctx.lineTo(endSx - headLen * Math.cos(angle - Math.PI / 6), endSy - headLen * Math.sin(angle - Math.PI / 6));
                  ctx.lineTo(endSx - headLen * Math.cos(angle + Math.PI / 6), endSy - headLen * Math.sin(angle + Math.PI / 6));
                  ctx.closePath();
                  ctx.fill();

                  // Label: |v|
                  ctx.font = '10px monospace';
                  ctx.fillStyle = '#f59e0b';
                  ctx.textAlign = 'left';
                  ctx.fillText(`v(t): |v|=${speed.toFixed(2)}`, endSx + 4, endSy - 4);
                }
              } catch {
                // Ignore differentiation error for velocity vector
              }
            }

            // Glowing Active Particle
            ctx.fillStyle = item.color;
            ctx.beginPath();
            ctx.arc(curSx, curSy, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = isLight ? '#ffffff' : '#000000';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Particle Halo
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(curSx, curSy, 10, 0, Math.PI * 2);
            ctx.stroke();

            // Position & Parameter HUD Badge
            ctx.font = '10px monospace';
            ctx.fillStyle = isLight ? '#000000' : '#ffffff';
            ctx.textAlign = 'left';
            ctx.fillText(`P(t=${curT.toFixed(2)}) = (${curWx.toFixed(2)}, ${curWy.toFixed(2)})`, curSx + 12, curSy + 4);
          }
        } else if (item.type === 'series') {
          const { term, from: sFrom, to: sTo, varName: sVar } = parseSeriesExpression(
            item.rawInput,
            item.seriesTerm,
            item.seriesFrom,
            item.seriesTo,
            item.seriesVar
          );

          if (item.seriesMode === 'sequence_plot') {
            // Discrete Sequence plot: (n, a_n) and partial sums S_n
            const seriesPoints = globalSeriesEvaluator.evaluateSequenceTerms(
              term,
              sFrom,
              sTo,
              sVar,
              evalContext
            );

            ctx.strokeStyle = item.color;
            ctx.fillStyle = item.color;
            ctx.lineWidth = 1.5;

            seriesPoints.forEach((pt) => {
              const sx = toScreenX(pt.n);
              const sy = toScreenY(pt.val);
              const syPart = toScreenY(pt.partialSum);

              // Stem to x-axis
              ctx.setLineDash([2, 2]);
              ctx.beginPath();
              ctx.moveTo(sx, toScreenY(0));
              ctx.lineTo(sx, sy);
              ctx.stroke();
              ctx.setLineDash([]);

              // Dot for term a_n
              ctx.beginPath();
              ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
              ctx.fill();

              // Partial sum dot S_n
              ctx.fillStyle = `${item.color}88`;
              ctx.beginPath();
              ctx.arc(sx, syPart, 2.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.fillStyle = item.color;
            });
          } else {
            // Partial sum function S_N(x) = sum_{n=from}^N a_n(x) plotted as a continuous curve across screen
            ctx.strokeStyle = item.color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.beginPath();

            const seriesCurveSteps = width * 1.5;
            let isStarted = false;
            let prevY = 0;

            for (let i = 0; i <= seriesCurveSteps; i++) {
              const sx = (i / seriesCurveSteps) * width;
              const wx = toWorldX(sx);
              const wy = globalSeriesEvaluator.evaluatePartialSum(term, wx, sFrom, sTo, sVar, evalContext);

              if (isNaN(wy) || !isFinite(wy) || Math.abs(wy) > 1e6) {
                isStarted = false;
                continue;
              }

              const sy = toScreenY(wy);
              if (isStarted && Math.abs(sy - prevY) > height * 0.8) {
                isStarted = false;
              }

              if (!isStarted) {
                ctx.moveTo(sx, sy);
                isStarted = true;
              } else {
                ctx.lineTo(sx, sy);
              }
              prevY = sy;
            }
            ctx.stroke();
          }
        } else if (item.type === 'complex') {
          const formula = item.rawInput;
          const cleanExpr = cleanFormula(formula);
          const hasTheta = cleanExpr.includes('theta') || cleanExpr.includes('θ');
          const hasT = cleanExpr.includes('t');

          ctx.strokeStyle = item.color;
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          if (hasTheta || hasT) {
            // Plot parametric / polar complex-valued curve: z(t) or z(theta)
            ctx.beginPath();
            const steps = 1000;
            const tMin = hasTheta ? 0 : (item.parametricTMin ?? -10);
            const tMax = hasTheta ? Math.PI * 2 : (item.parametricTMax ?? 10);
            let isStarted = false;

            for (let i = 0; i <= steps; i++) {
              const tVal = tMin + (i / steps) * (tMax - tMin);
              const vars: Record<string, any> = {};
              if (hasTheta) {
                vars['theta'] = tVal;
                vars['θ'] = tVal;
              }
              if (hasT) {
                vars['t'] = tVal;
              }

              const z = parseAndEvaluateComplex(cleanExpr, vars);
              if (z.isFinite()) {
                const sx = toScreenX(z.re);
                const sy = toScreenY(z.im);
                if (!isStarted) {
                  ctx.moveTo(sx, sy);
                  isStarted = true;
                } else {
                  ctx.lineTo(sx, sy);
                }
              } else {
                isStarted = false;
              }
            }
            ctx.stroke();
          } else {
            // Plot single complex number z_0 as a point and vector
            const z = parseAndEvaluateComplex(cleanExpr, evalContext);
            if (z.isFinite()) {
              const sx = toScreenX(z.re);
              const sy = toScreenY(z.im);
              const originSx = toScreenX(0);
              const originSy = toScreenY(0);

              // 1. Draw subtle dashed/solid vector starting from (0,0)
              ctx.strokeStyle = `${item.color}bb`;
              ctx.lineWidth = 2;

              // Draw vector line from origin
              ctx.beginPath();
              ctx.moveTo(originSx, originSy);
              ctx.lineTo(sx, sy);
              ctx.stroke();

              // Draw arrowhead if it is not at the origin
              const dist = Math.hypot(sx - originSx, sy - originSy);
              if (dist > 5) {
                const angle = Math.atan2(sy - originSy, sx - originSx);
                const arrowLength = 10;
                ctx.fillStyle = item.color;
                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(
                  sx - arrowLength * Math.cos(angle - Math.PI / 6),
                  sy - arrowLength * Math.sin(angle - Math.PI / 6)
                );
                ctx.lineTo(
                  sx - arrowLength * Math.cos(angle + Math.PI / 6),
                  sy - arrowLength * Math.sin(angle + Math.PI / 6)
                );
                ctx.closePath();
                ctx.fill();
              }

              // 2. Draw point dot
              ctx.fillStyle = item.color;
              ctx.beginPath();
              ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.strokeStyle = isLight ? '#ffffff' : '#000000';
              ctx.lineWidth = 1.5;
              ctx.stroke();

              // 3. Draw text label
              ctx.font = '11px sans-serif';
              ctx.fillStyle = isLight ? '#222' : '#eee';
              ctx.textAlign = 'left';

              const mod = z.abs();
              const arg = z.arg();
              const deg = (arg * 180) / Math.PI;
              const labelText = `${z.toString(2)} (r=${mod.toFixed(2)}, θ=${deg.toFixed(0)}°)`;

              ctx.fillText(labelText, sx + 10, sy - 6);
            }
          }
        }
      } catch {
        // Continue loop if formula fails to parse
      }
    });

    // 4. Data Tables Plotting
    dataTables.forEach((table) => {
      if (!table.visible) return;

      // Draw connected lines if enabled
      if (table.connectLines && table.points.length > 1) {
        ctx.strokeStyle = table.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        let first = true;
        table.points.forEach((pt) => {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);
          if (first) {
            ctx.moveTo(sx, sy);
            first = false;
          } else {
            ctx.lineTo(sx, sy);
          }
        });
        ctx.stroke();
      }

      // Draw scatter points if enabled
      if (table.showScatter !== false) {
        ctx.fillStyle = table.color;
        ctx.strokeStyle = isLight ? '#ffffff' : '#000000';
        ctx.lineWidth = 1.5;

        table.points.forEach((pt) => {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);
          if (sx >= -10 && sx <= width + 10 && sy >= -10 && sy <= height + 10) {
            const style = table.pointStyle || 'circle';
            ctx.beginPath();
            if (style === 'circle') {
              ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            } else if (style === 'square') {
              const size = 8;
              ctx.rect(sx - size / 2, sy - size / 2, size, size);
              ctx.fill();
              ctx.stroke();
            } else if (style === 'diamond') {
              const size = 5;
              ctx.moveTo(sx, sy - size);
              ctx.lineTo(sx + size, sy);
              ctx.lineTo(sx, sy + size);
              ctx.lineTo(sx - size, sy);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            } else if (style === 'cross') {
              const size = 4;
              ctx.moveTo(sx - size, sy);
              ctx.lineTo(sx + size, sy);
              ctx.moveTo(sx, sy - size);
              ctx.lineTo(sx, sy + size);
              ctx.stroke();
            }
          }
        });
      }
    });

    // 5. Tangent Line at X if requested
    if (showTangentAtX !== null && showTangentAtX !== undefined) {
      const activeCartesian = items.find((it) => it.visible && it.type === 'cartesian' && it.rawInput.trim());
      if (activeCartesian) {
        try {
          const { formula } = splitFormulaAndDomain(activeCartesian.rawInput);
          const ast = Parser.parse(cleanFormula(formula));
          const fPrimeAst = SymbolicDifferentiator.diff(ast, 'x');

          const tX = showTangentAtX;
          const tY = evaluateAST(ast, { x: tX });
          const slope = evaluateAST(fPrimeAst, { x: tX });

          if (!isNaN(tY) && !isNaN(slope) && isFinite(slope)) {
            const x1 = xMin;
            const y1 = tY + slope * (x1 - tX);
            const x2 = xMax;
            const y2 = tY + slope * (x2 - tX);

            ctx.strokeStyle = '#fa7d19';
            ctx.lineWidth = 1.8;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(toScreenX(x1), toScreenY(y1));
            ctx.lineTo(toScreenX(x2), toScreenY(y2));
            ctx.stroke();
            ctx.setLineDash([]);

            // Point of tangency dot
            const pSx = toScreenX(tX);
            const pSy = toScreenY(tY);
            ctx.fillStyle = '#fa7d19';
            ctx.beginPath();
            ctx.arc(pSx, pSy, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } catch {
          // Ignore
        }
      }
    }

    // 6. Trace Point Indicator
    if (tracePoint) {
      const sx = toScreenX(tracePoint.x);
      const sy = toScreenY(tracePoint.y);
      ctx.strokeStyle = '#2d6fb4';
      ctx.fillStyle = '#2d6fb4';
      ctx.lineWidth = 2;

      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sx, sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // 7. Analysis Overlay (Conic Foci, Directrices, Vertices, Asymptotes)
    if (analysisOverlay) {
      if (analysisOverlay.lines) {
        analysisOverlay.lines.forEach((line) => {
          ctx.strokeStyle = line.color || '#fa7d19';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();

          if (line.type === 'vertical' && line.x !== undefined) {
            const sx = toScreenX(line.x);
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, height);
          } else if (line.type === 'horizontal' && line.y !== undefined) {
            const sy = toScreenY(line.y);
            ctx.moveTo(0, sy);
            ctx.lineTo(width, sy);
          } else if (line.type === 'slant' && line.m !== undefined && line.b !== undefined) {
            const x1 = xMin;
            const y1 = line.m * x1 + line.b;
            const x2 = xMax;
            const y2 = line.m * x2 + line.b;
            ctx.moveTo(toScreenX(x1), toScreenY(y1));
            ctx.lineTo(toScreenX(x2), toScreenY(y2));
          }
          ctx.stroke();
          ctx.setLineDash([]);
        });
      }

      if (analysisOverlay.points && analysisOverlay.points.length > 0) {
        // 7.1 Group nearby / coincident points into clusters
        interface PointCluster {
          anchorSx: number;
          anchorSy: number;
          primaryColor: string;
          items: { x: number; y: number; label: string; type: string; color: string }[];
        }

        const getColorForType = (type: string): string => {
          switch (type) {
            case 'vertex':
              return '#00693E'; // Dartmouth Green
            case 'focus':
              return '#c84442'; // Crimson
            case 'center':
              return '#6042a6'; // Purple
            case 'co-vertex':
              return '#2d6fb4'; // Blue
            case 'intercept':
              return '#d97706'; // Amber / Orange
            case 'zero':
              return '#00693E';
            case 'extrema':
              return '#2d6fb4';
            case 'inflection':
              return '#9333ea';
            default:
              return '#2d6fb4';
          }
        };

        const clusters: PointCluster[] = [];
        const clusterThreshold = 8; // Screen pixel proximity threshold

        analysisOverlay.points.forEach((pt) => {
          const sx = toScreenX(pt.x);
          const sy = toScreenY(pt.y);

          // Only consider points reasonably near the visible screen
          if (sx < -100 || sx > width + 100 || sy < -100 || sy > height + 100) return;

          const color = getColorForType(pt.type);
          const item = { x: pt.x, y: pt.y, label: pt.label, type: pt.type, color };

          // Find existing cluster
          let matchedCluster = clusters.find(
            (c) => Math.hypot(c.anchorSx - sx, c.anchorSy - sy) <= clusterThreshold
          );

          if (matchedCluster) {
            matchedCluster.items.push(item);
            // Prioritize colors: vertex > focus > center > intercept > co-vertex
            if (pt.type === 'vertex' || (!matchedCluster.primaryColor && color)) {
              matchedCluster.primaryColor = color;
            }
          } else {
            clusters.push({
              anchorSx: sx,
              anchorSy: sy,
              primaryColor: color,
              items: [item],
            });
          }
        });

        // 7.2 Draw point markers (dots) for each cluster
        clusters.forEach((cluster) => {
          const { anchorSx: sx, anchorSy: sy, primaryColor } = cluster;

          // Outer halo / border
          ctx.beginPath();
          ctx.arc(sx, sy, 5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Inner colored core
          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = primaryColor;
          ctx.fill();
        });

        // 7.3 Multi-directional Anti-Collision Placement for Labels
        interface PlacedBadgeBox {
          x: number;
          y: number;
          w: number;
          h: number;
          anchorSx: number;
          anchorSy: number;
          lines: string[];
          primaryColor: string;
        }

        const placedBadges: PlacedBadgeBox[] = [];

        ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

        clusters.forEach((cluster) => {
          const { anchorSx, anchorSy, items, primaryColor } = cluster;

          // Deduplicate label text lines
          const uniqueLines: string[] = [];
          items.forEach((it) => {
            if (!uniqueLines.includes(it.label)) {
              uniqueLines.push(it.label);
            }
          });

          if (uniqueLines.length === 0) return;

          const padX = 6;
          const padY = 4;
          const lineH = 13;
          const accentW = 3.5;

          let maxLineWidth = 20;
          uniqueLines.forEach((line) => {
            const tm = ctx.measureText(line);
            if (tm.width > maxLineWidth) maxLineWidth = tm.width;
          });

          const boxW = Math.ceil(maxLineWidth + padX * 2 + accentW + 2);
          const boxH = uniqueLines.length * lineH + padY * 2;

          // 12 Candidate placement positions ordered by natural preference
          const candidates = [
            { x: anchorSx + 10, y: anchorSy - boxH - 4 }, // 1. Top-Right
            { x: anchorSx + 10, y: anchorSy + 6 }, // 2. Bottom-Right
            { x: anchorSx - boxW - 10, y: anchorSy - boxH - 4 }, // 3. Top-Left
            { x: anchorSx - boxW - 10, y: anchorSy + 6 }, // 4. Bottom-Left
            { x: anchorSx - boxW / 2, y: anchorSy - boxH - 16 }, // 5. Elevated Top-Center
            { x: anchorSx - boxW / 2, y: anchorSy + 18 }, // 6. Lowered Bottom-Center
            { x: anchorSx + 14, y: anchorSy - boxH / 2 }, // 7. Right-Center
            { x: anchorSx - boxW - 14, y: anchorSy - boxH / 2 }, // 8. Left-Center
            { x: anchorSx + 14, y: anchorSy - boxH - 26 }, // 9. High Top-Right
            { x: anchorSx + 14, y: anchorSy + 28 }, // 10. Low Bottom-Right
            { x: anchorSx - boxW - 14, y: anchorSy - boxH - 26 }, // 11. High Top-Left
            { x: anchorSx - boxW - 14, y: anchorSy + 28 }, // 12. Low Bottom-Left
          ];

          let bestCand = candidates[0];
          let bestScore = Infinity;

          for (const cand of candidates) {
            // Keep safely inside screen bounds
            const clampedX = Math.min(Math.max(cand.x, 8), width - boxW - 8);
            const clampedY = Math.min(Math.max(cand.y, 8), height - boxH - 8);

            let penalty = 0;

            // Check overlap with all previously placed badges
            for (const pb of placedBadges) {
              const overlapX = Math.max(
                0,
                Math.min(clampedX + boxW, pb.x + pb.w + 6) - Math.max(clampedX, pb.x - 6)
              );
              const overlapY = Math.max(
                0,
                Math.min(clampedY + boxH, pb.y + pb.h + 6) - Math.max(clampedY, pb.y - 6)
              );

              if (overlapX > 0 && overlapY > 0) {
                penalty += overlapX * overlapY * 6000;
              }
            }

            // Distance from anchor point
            const dist = Math.hypot(clampedX + boxW / 2 - anchorSx, clampedY + boxH / 2 - anchorSy);
            penalty += dist;

            if (penalty < bestScore) {
              bestScore = penalty;
              bestCand = { x: clampedX, y: clampedY };
            }
          }

          // If dense overlap, displace downwards to find free vertical room
          let finalX = bestCand.x;
          let finalY = bestCand.y;

          if (bestScore >= 6000 && placedBadges.length > 0) {
            const maxY = Math.max(...placedBadges.map((b) => b.y + b.h));
            if (maxY + boxH + 8 < height) {
              finalY = maxY + 6;
            }
          }

          placedBadges.push({
            x: finalX,
            y: finalY,
            w: boxW,
            h: boxH,
            anchorSx,
            anchorSy,
            lines: uniqueLines,
            primaryColor,
          });
        });

        // 7.4 Render Badges and Leader Lines
        placedBadges.forEach((badge) => {
          const { x: boxX, y: boxY, w: boxW, h: boxH, anchorSx, anchorSy, lines, primaryColor } = badge;

          const badgeCenterX = boxX + boxW / 2;
          const badgeCenterY = boxY + boxH / 2;
          const distToAnchor = Math.hypot(badgeCenterX - anchorSx, badgeCenterY - anchorSy);

          // Draw leader line if displaced from dot
          if (distToAnchor > 22) {
            const closestX = Math.min(Math.max(anchorSx, boxX), boxX + boxW);
            const closestY = Math.min(Math.max(anchorSy, boxY), boxY + boxH);

            ctx.save();
            ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.28)' : 'rgba(255, 255, 255, 0.35)';
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 2]);
            ctx.beginPath();
            ctx.moveTo(anchorSx, anchorSy);
            ctx.lineTo(closestX, closestY);
            ctx.stroke();
            ctx.restore();
          }

          // Badge Container Box
          ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(15, 17, 23, 0.95)';
          ctx.fillRect(boxX, boxY, boxW, boxH);

          ctx.strokeStyle = isLight ? 'rgba(0, 0, 0, 0.18)' : 'rgba(255, 255, 255, 0.22)';
          ctx.lineWidth = 1;
          ctx.strokeRect(boxX, boxY, boxW, boxH);

          // Colored Left Accent Bar
          ctx.fillStyle = primaryColor;
          ctx.fillRect(boxX, boxY, 3.5, boxH);

          // Text Lines
          ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
          ctx.fillStyle = isLight ? '#0f172a' : '#f8fafc';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          const padX = 6;
          const padY = 4;
          const lineH = 13;
          const accentW = 3.5;

          lines.forEach((line, idx) => {
            ctx.fillText(line, boxX + accentW + padX, boxY + padY + idx * lineH);
          });
        });
      }
    }

    // 8. Critical Points & Intersections (when not overlapping with analysis overlay)
    criticalPoints.forEach((pt) => {
      const sx = toScreenX(pt.x);
      const sy = toScreenY(pt.y);

      if (sx >= 0 && sx <= width && sy >= 0 && sy <= height) {
        // Skip duplicate dots if analysis point is already at this exact spot
        const hasOverlayPt = analysisOverlay?.points?.some(
          (ap) => Math.hypot(toScreenX(ap.x) - sx, toScreenY(ap.y) - sy) <= 5
        );
        if (!hasOverlayPt) {
          ctx.fillStyle = pt.type === 'zero' ? '#00693E' : pt.type === 'intersection' ? '#6042a6' : '#2d6fb4';
          ctx.beginPath();
          ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }
    });

    // 9. Hovered Point Tooltip
    if (hoveredPoint) {
      const sx = toScreenX(hoveredPoint.x);
      const sy = toScreenY(hoveredPoint.y);

      ctx.fillStyle = '#fa7d19';
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      const label = `${hoveredPoint.label}: (${hoveredPoint.x.toFixed(2)}, ${hoveredPoint.y.toFixed(2)})`;
      ctx.font = '11px "STIX Two Math", monospace';
      const tm = ctx.measureText(label);
      const pad = 4;
      const bW = tm.width + pad * 2;
      const bH = 18;
      const bX = Math.min(Math.max(sx - bW / 2, 4), width - bW - 4);
      const bY = sy > 30 ? sy - bH - 8 : sy + 12;

      ctx.fillStyle = isLight ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.95)';
      ctx.strokeStyle = '#fa7d19';
      ctx.lineWidth = 1;
      ctx.fillRect(bX, bY, bW, bH);
      ctx.strokeRect(bX, bY, bW, bH);

      ctx.fillStyle = isLight ? '#000000' : '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bX + bW / 2, bY + bH / 2);
    }
  }, [
    items,
    adjViewport,
    criticalPoints,
    hoveredPoint,
    showTangentAtX,
    tracePoint,
    dataTables,
    analysisOverlay,
    globalParameters,
    coordinateMode,
    angleMode,
    isLight,
  ]);

  // Window Resize & Canvas Setup with ResizeObserver
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      canvas.width = rect.width;
      canvas.height = rect.height;
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    handleResize();

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', handleResize);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    render();
  }, [render]);

  // Mouse & Touch Interactions
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
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const { xMin, xMax, yMin, yMax } = adjViewport;
    const wx = xMin + (sx / canvas.width) * (xMax - xMin);
    const wy = yMin + ((canvas.height - sy) / canvas.height) * (yMax - yMin);

    setCursorCoord({ x: wx, y: wy });

    if (isDragging && dragStart) {
      const dxPx = e.clientX - dragStart.x;
      const dyPx = e.clientY - dragStart.y;
      const dxWorld = (dxPx / canvas.width) * (xMax - xMin);
      const dyWorld = (dyPx / canvas.height) * (yMax - yMin);

      onViewportChange({
        xMin: viewport.xMin - dxWorld,
        xMax: viewport.xMax - dxWorld,
        yMin: viewport.yMin + dyWorld,
        yMax: viewport.yMax + dyWorld,
      });

      setDragStart({ x: e.clientX, y: e.clientY });
    } else {
      // Hover detection on critical points and analysis overlay points
      const threshold = 12;
      let found: CriticalPoint | null = null;

      for (const pt of criticalPoints) {
        const ptSx = ((pt.x - xMin) / (xMax - xMin)) * canvas.width;
        const ptSy = canvas.height - ((pt.y - yMin) / (yMax - yMin)) * canvas.height;
        const dist = Math.hypot(sx - ptSx, sy - ptSy);
        if (dist <= threshold) {
          found = pt;
          break;
        }
      }

      if (!found && analysisOverlay?.points) {
        for (const pt of analysisOverlay.points) {
          const ptSx = ((pt.x - xMin) / (xMax - xMin)) * canvas.width;
          const ptSy = canvas.height - ((pt.y - yMin) / (yMax - yMin)) * canvas.height;
          const dist = Math.hypot(sx - ptSx, sy - ptSy);
          if (dist <= threshold) {
            found = {
              x: pt.x,
              y: pt.y,
              type: pt.type === 'zero' ? 'zero' : 'intersection',
              label: pt.label.includes(':') ? pt.label.split(':')[0] : pt.label,
            };
            break;
          }
        }
      }

      onHoverPoint(found);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      if (onInteractionStart) {
        onInteractionStart();
      }
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
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
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.touches.length === 1 && isDragging && dragStart) {
      const dxPx = e.touches[0].clientX - dragStart.x;
      const dyPx = e.touches[0].clientY - dragStart.y;
      const dxWorld = (dxPx / canvas.width) * (adjViewport.xMax - adjViewport.xMin);
      const dyWorld = (dyPx / canvas.height) * (adjViewport.yMax - adjViewport.yMin);

      onViewportChange({
        xMin: viewport.xMin - dxWorld,
        xMax: viewport.xMax - dxWorld,
        yMin: viewport.yMin + dyWorld,
        yMax: viewport.yMax + dyWorld,
      });

      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2 && touchPinchDist) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = touchPinchDist / dist;
      if (Math.abs(factor - 1) > 0.02) {
        zoom(factor);
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
    const factor = e.deltaY > 0 ? 1.12 : 0.88;
    zoom(factor);
  };

  const zoom = (factor: number) => {
    const xCenter = (viewport.xMin + viewport.xMax) / 2;
    const yCenter = (viewport.yMin + viewport.yMax) / 2;
    const xHalf = ((viewport.xMax - viewport.xMin) * factor) / 2;
    const yHalf = ((viewport.yMax - viewport.yMin) * factor) / 2;

    onViewportChange({
      xMin: xCenter - xHalf,
      xMax: xCenter + xHalf,
      yMin: yCenter - yHalf,
      yMax: yCenter + yHalf,
    });
  };

  // Polar coordinates calculation for HUD
  const cursorR = cursorCoord ? Math.hypot(cursorCoord.x, cursorCoord.y) : 0;
  let cursorThetaRad = cursorCoord ? Math.atan2(cursorCoord.y, cursorCoord.x) : 0;
  if (cursorThetaRad < 0) cursorThetaRad += 2 * Math.PI;
  const cursorThetaDeg = (cursorThetaRad * 180) / Math.PI;

  return (
    <div
      ref={containerRef}
      id="graph-canvas-container"
      className={`relative w-full h-full select-none overflow-hidden touch-none ${
        isLight ? 'bg-white' : 'bg-black'
      }`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setCursorCoord(null);
        onHoverPoint(null);
      }}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={canvasRef} id="graph-2d-canvas" className="w-full h-full cursor-crosshair block" />

      {/* Live Coordinate Inspector HUD with Sharp Corners */}
      {cursorCoord && (
        <div
          className={`absolute bottom-3 left-3 px-2.5 py-1 border text-[11px] font-mono flex items-center gap-2 pointer-events-none shadow-xl z-10 rounded-none ${
            isLight
              ? 'bg-white/95 text-black border-neutral-300'
              : 'bg-black/90 text-white border-neutral-800'
          }`}
        >
          {coordinateMode === 'polar' ? (
            <>
              <Compass className="w-3 h-3 text-[#2d6fb4]" />
              <span>
                r: <strong className={isLight ? 'text-black' : 'text-white'}>{cursorR.toFixed(2)}</strong>
              </span>
              <span className="opacity-40">|</span>
              <span>
                θ:{' '}
                <strong className={isLight ? 'text-black' : 'text-white'}>
                  {angleMode === 'DEG'
                    ? `${cursorThetaDeg.toFixed(1)}°`
                    : `${cursorThetaRad.toFixed(2)} rad (${cursorThetaDeg.toFixed(0)}°)`}
                </strong>
              </span>
            </>
          ) : (
            <>
              <Crosshair className="w-3 h-3 text-[#00693E]" />
              <span>
                x: <strong className={isLight ? 'text-black' : 'text-white'}>{cursorCoord.x.toFixed(2)}</strong>
              </span>
              <span className="opacity-40">|</span>
              <span>
                y: <strong className={isLight ? 'text-black' : 'text-white'}>{cursorCoord.y.toFixed(2)}</strong>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Marching Squares Contour Algorithm for implicit equations & conics (circles, ellipses, hyperbolas, etc.)
 */
function renderImplicitRelation(
  ctx: CanvasRenderingContext2D,
  ast: ExpressionNode,
  viewport: Viewport2D,
  width: number,
  height: number,
  color: string,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  domain?: DomainRestriction | null,
  evalContext: Record<string, number> = {}
) {
  const { xMin, xMax, yMin, yMax } = viewport;
  const Nx = 160;
  const Ny = 110;
  const dx = (xMax - xMin) / Nx;
  const dy = (yMax - yMin) / Ny;

  const grid: number[][] = [];
  for (let i = 0; i <= Nx; i++) {
    grid[i] = [];
    const wx = xMin + i * dx;
    for (let j = 0; j <= Ny; j++) {
      const wy = yMin + j * dy;
      const val = evaluateAST(ast, { ...evalContext, x: wx, y: wy });
      grid[i][j] = isNaN(val) || !isFinite(val) ? 1e9 : val;
    }
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  // Edge interpolation helper
  const interp = (x0: number, y0: number, v0: number, x1: number, y1: number, v1: number) => {
    if (Math.abs(v1 - v0) < 1e-12) return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
    const t = Math.max(0, Math.min(1, -v0 / (v1 - v0)));
    return { x: x0 + t * (x1 - x0), y: y0 + t * (y1 - y0) };
  };

  for (let i = 0; i < Nx; i++) {
    const wx0 = xMin + i * dx;
    const wx1 = wx0 + dx;
    for (let j = 0; j < Ny; j++) {
      const wy0 = yMin + j * dy;
      const wy1 = wy0 + dy;

      const v0 = grid[i][j];         // Bottom-Left
      const v1 = grid[i + 1][j];     // Bottom-Right
      const v2 = grid[i + 1][j + 1]; // Top-Right
      const v3 = grid[i][j + 1];     // Top-Left

      // Filter non-finite cells
      if (Math.abs(v0) > 1e8 || Math.abs(v1) > 1e8 || Math.abs(v2) > 1e8 || Math.abs(v3) > 1e8) {
        continue;
      }

      let cellMask = 0;
      if (v0 > 0) cellMask |= 1;
      if (v1 > 0) cellMask |= 2;
      if (v2 > 0) cellMask |= 4;
      if (v3 > 0) cellMask |= 8;

      if (cellMask === 0 || cellMask === 15) continue;

      const bottom = interp(wx0, wy0, v0, wx1, wy0, v1);
      const right = interp(wx1, wy0, v1, wx1, wy1, v2);
      const top = interp(wx0, wy1, v3, wx1, wy1, v2);
      const left = interp(wx0, wy0, v0, wx0, wy1, v3);

      const drawSeg = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
        if (domain && (!domain.check(p1.x, evalContext) || !domain.check(p2.x, evalContext))) {
          return;
        }
        ctx.moveTo(toScreenX(p1.x), toScreenY(p1.y));
        ctx.lineTo(toScreenX(p2.x), toScreenY(p2.y));
      };

      switch (cellMask) {
        case 1:
        case 14:
          drawSeg(left, bottom);
          break;
        case 2:
        case 13:
          drawSeg(bottom, right);
          break;
        case 3:
        case 12:
          drawSeg(left, right);
          break;
        case 4:
        case 11:
          drawSeg(right, top);
          break;
        case 5:
          drawSeg(left, top);
          drawSeg(bottom, right);
          break;
        case 10:
          drawSeg(left, bottom);
          drawSeg(right, top);
          break;
        case 6:
        case 9:
          drawSeg(bottom, top);
          break;
        case 7:
        case 8:
          drawSeg(left, top);
          break;
      }
    }
  }

  ctx.stroke();
}

function getNiceStep(target: number): number {
  if (target <= 0 || !isFinite(target)) return 1;
  const exponent = Math.floor(Math.log10(target));
  const fraction = target / Math.pow(10, exponent);
  let niceFraction: number;

  if (fraction < 1.5) niceFraction = 1;
  else if (fraction < 3) niceFraction = 2;
  else if (fraction < 7) niceFraction = 5;
  else niceFraction = 10;

  return niceFraction * Math.pow(10, exponent);
}

function formatNumber(num: number): string {
  if (Math.abs(num) < 1e-6) return '0';
  if (Math.abs(num) >= 1000 || (Math.abs(num) <= 0.01 && num !== 0)) {
    return num.toExponential(1);
  }
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
}
