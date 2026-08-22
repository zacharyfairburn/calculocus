import { ExpressionNode, evaluateAST } from './ast';

export interface ContourPoint {
  x: number;
  y: number;
}

export interface ContourSegment {
  p1: ContourPoint;
  p2: ContourPoint;
  level: number;
  normalizedLevel: number; // 0 to 1
}

export interface ContourLevel {
  level: number;
  normalizedLevel: number; // 0 to 1
  color: string;
  segments: ContourSegment[];
}

export interface ContourMapData {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  gridN: number;
  gridValues: number[][]; // gridValues[i][j] where i is x index, j is y index
  levels: ContourLevel[];
}

/**
 * Turbo / Spectral elevation colormap generator for smooth scientific contour maps
 */
export function getContourColor(t: number, alpha = 1): string {
  const clampedT = Math.max(0, Math.min(1, t));

  // Multi-stop smooth viridis-plasma-spectral gradient
  // t=0.0: Deep Blue/Violet (rgb: 40, 20, 120)
  // t=0.25: Teal/Cyan (rgb: 25, 140, 165)
  // t=0.5: Emerald Green (rgb: 30, 180, 90)
  // t=0.75: Golden Amber (rgb: 245, 170, 25)
  // t=1.0: Crimson Red (rgb: 225, 45, 55)

  let r = 0;
  let g = 0;
  let b = 0;

  if (clampedT < 0.25) {
    const s = clampedT / 0.25;
    r = 40 + (25 - 40) * s;
    g = 20 + (140 - 20) * s;
    b = 120 + (165 - 120) * s;
  } else if (clampedT < 0.5) {
    const s = (clampedT - 0.25) / 0.25;
    r = 25 + (30 - 25) * s;
    g = 140 + (180 - 140) * s;
    b = 165 + (90 - 165) * s;
  } else if (clampedT < 0.75) {
    const s = (clampedT - 0.5) / 0.25;
    r = 30 + (245 - 30) * s;
    g = 180 + (170 - 180) * s;
    b = 90 + (25 - 90) * s;
  } else {
    const s = (clampedT - 0.75) / 0.25;
    r = 245 + (225 - 245) * s;
    g = 170 + (45 - 170) * s;
    b = 25 + (55 - 25) * s;
  }

  r = Math.round(r);
  g = Math.round(g);
  b = Math.round(b);

  if (alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Generate 2D Grid and Contour Lines using Marching Squares
 */
export function generateContourMapData(
  ast: ExpressionNode,
  xMin: number,
  xMax: number,
  yMin: number,
  yMax: number,
  zMin: number,
  zMax: number,
  numLevels: number = 14,
  gridResolution: number = 60
): ContourMapData {
  const gridN = Math.max(20, Math.min(120, gridResolution));
  const xStep = (xMax - xMin) / gridN;
  const yStep = (yMax - yMin) / gridN;

  const gridValues: number[][] = [];
  let minFound = Infinity;
  let maxFound = -Infinity;

  // Evaluate scalar field
  for (let i = 0; i <= gridN; i++) {
    gridValues[i] = [];
    const x = xMin + i * xStep;
    for (let j = 0; j <= gridN; j++) {
      const y = yMin + j * yStep;
      let val = evaluateAST(ast, { x, y, z: 0 });
      if (isNaN(val) || !isFinite(val)) {
        val = NaN;
      } else {
        if (val < minFound) minFound = val;
        if (val > maxFound) maxFound = val;
      }
      gridValues[i][j] = val;
    }
  }

  // Use bounds for z if valid, or adapt if found values are reasonable
  const effectiveZMin = isFinite(zMin) ? zMin : isFinite(minFound) ? minFound : -1;
  const effectiveZMax = isFinite(zMax) ? zMax : isFinite(maxFound) ? maxFound : 1;
  const zSpan = effectiveZMax - effectiveZMin || 1;

  // Generate discrete contour level values
  const levels: ContourLevel[] = [];
  const levelStep = zSpan / (numLevels + 1);

  for (let k = 1; k <= numLevels; k++) {
    const zLevel = effectiveZMin + k * levelStep;
    const normalizedLevel = (zLevel - effectiveZMin) / zSpan;
    const color = getContourColor(normalizedLevel);
    const segments: ContourSegment[] = [];

    // Marching squares over each cell
    for (let i = 0; i < gridN; i++) {
      const x0 = xMin + i * xStep;
      const x1 = x0 + xStep;

      for (let j = 0; j < gridN; j++) {
        const y0 = yMin + j * yStep;
        const y1 = y0 + yStep;

        // Cell corners:
        // Top-Left: (x0, y1) -> vTL
        // Top-Right: (x1, y1) -> vTR
        // Bottom-Right: (x1, y0) -> vBR
        // Bottom-Left: (x0, y0) -> vBL
        const vTL = gridValues[i][j + 1];
        const vTR = gridValues[i + 1][j + 1];
        const vBR = gridValues[i + 1][j];
        const vBL = gridValues[i][j];

        if (isNaN(vTL) || isNaN(vTR) || isNaN(vBR) || isNaN(vBL)) {
          continue;
        }

        // Bit flags: TL=8, TR=4, BR=2, BL=1
        let cellCase = 0;
        if (vTL >= zLevel) cellCase |= 8;
        if (vTR >= zLevel) cellCase |= 4;
        if (vBR >= zLevel) cellCase |= 2;
        if (vBL >= zLevel) cellCase |= 1;

        if (cellCase === 0 || cellCase === 15) {
          continue; // No line cuts through this cell
        }

        // Interpolate intersection points along 4 edges
        // Top edge (between TL and TR)
        const interpTop = (): ContourPoint => {
          const t = (zLevel - vTL) / ((vTR - vTL) || 1e-9);
          return { x: x0 + Math.max(0, Math.min(1, t)) * xStep, y: y1 };
        };
        // Right edge (between BR and TR)
        const interpRight = (): ContourPoint => {
          const t = (zLevel - vBR) / ((vTR - vBR) || 1e-9);
          return { x: x1, y: y0 + Math.max(0, Math.min(1, t)) * yStep };
        };
        // Bottom edge (between BL and BR)
        const interpBottom = (): ContourPoint => {
          const t = (zLevel - vBL) / ((vBR - vBL) || 1e-9);
          return { x: x0 + Math.max(0, Math.min(1, t)) * xStep, y: y0 };
        };
        // Left edge (between BL and TL)
        const interpLeft = (): ContourPoint => {
          const t = (zLevel - vBL) / ((vTL - vBL) || 1e-9);
          return { x: x0, y: y0 + Math.max(0, Math.min(1, t)) * yStep };
        };

        switch (cellCase) {
          case 1: // BL
          case 14:
            segments.push({ p1: interpLeft(), p2: interpBottom(), level: zLevel, normalizedLevel });
            break;
          case 2: // BR
          case 13:
            segments.push({ p1: interpBottom(), p2: interpRight(), level: zLevel, normalizedLevel });
            break;
          case 3: // BL + BR
          case 12:
            segments.push({ p1: interpLeft(), p2: interpRight(), level: zLevel, normalizedLevel });
            break;
          case 4: // TR
          case 11:
            segments.push({ p1: interpTop(), p2: interpRight(), level: zLevel, normalizedLevel });
            break;
          case 5: { // BL + TR (Saddle point resolution via cell center average)
            const vCenter = (vTL + vTR + vBR + vBL) / 4;
            if (vCenter >= zLevel) {
              segments.push({ p1: interpLeft(), p2: interpTop(), level: zLevel, normalizedLevel });
              segments.push({ p1: interpBottom(), p2: interpRight(), level: zLevel, normalizedLevel });
            } else {
              segments.push({ p1: interpLeft(), p2: interpBottom(), level: zLevel, normalizedLevel });
              segments.push({ p1: interpTop(), p2: interpRight(), level: zLevel, normalizedLevel });
            }
            break;
          }
          case 6: // TR + BR
          case 9:
            segments.push({ p1: interpTop(), p2: interpBottom(), level: zLevel, normalizedLevel });
            break;
          case 7: // BL + BR + TR
          case 8:
            segments.push({ p1: interpLeft(), p2: interpTop(), level: zLevel, normalizedLevel });
            break;
          case 10: { // TL + BR (Saddle point resolution)
            const vCenter = (vTL + vTR + vBR + vBL) / 4;
            if (vCenter >= zLevel) {
              segments.push({ p1: interpLeft(), p2: interpBottom(), level: zLevel, normalizedLevel });
              segments.push({ p1: interpTop(), p2: interpRight(), level: zLevel, normalizedLevel });
            } else {
              segments.push({ p1: interpLeft(), p2: interpTop(), level: zLevel, normalizedLevel });
              segments.push({ p1: interpBottom(), p2: interpRight(), level: zLevel, normalizedLevel });
            }
            break;
          }
        }
      }
    }

    levels.push({
      level: zLevel,
      normalizedLevel,
      color,
      segments,
    });
  }

  return {
    xMin,
    xMax,
    yMin,
    yMax,
    zMin: effectiveZMin,
    zMax: effectiveZMax,
    gridN,
    gridValues,
    levels,
  };
}
