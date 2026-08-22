import { ExpressionNode, evaluateAST, astToLatex } from './ast';
import { Parser } from './parser';
import { SymbolicDifferentiator } from './differentiator';
import { NumericalSolvers } from './solvers';
import { splitFormulaAndDomain } from './domain';

export interface ConicAnalysisResult {
  isConic: boolean;
  type: 'circle' | 'ellipse' | 'hyperbola' | 'parabola' | 'lines' | 'point' | 'none';
  typeName: string;
  generalFormLatex: string;
  standardFormLatex: string;
  center?: { x: number; y: number };
  foci?: Array<{ x: number; y: number; label: string }>;
  vertices?: Array<{ x: number; y: number; label: string }>;
  coVertices?: Array<{ x: number; y: number; label: string }>;
  eccentricity?: number;
  directrices?: Array<{ equation: string; type: 'vertical' | 'horizontal' | 'line'; val?: number; m?: number; b?: number }>;
  asymptotes?: Array<{ equation: string; m: number; b: number }>;
  axisOfSymmetry?: string[];
  semiMajorAxis?: number; // a
  semiMinorAxis?: number; // b
  focalDistance?: number;  // c or p
  semiLatusRectum?: number; // l
  radius?: number; // for circle
  orientation?: 'horizontal' | 'vertical' | 'rotated' | 'standard';
  details: Array<{ label: string; value: string; math?: string }>;
}

export interface FunctionAnalysisResult {
  rawInput: string;
  cleanFormula: string;
  latexFormula: string;
  isConic: boolean;
  conic?: ConicAnalysisResult;
  asymptotes: {
    vertical: Array<{ x: number; equation: string; label: string }>;
    horizontal: Array<{ y: number; equation: string; label: string }>;
    oblique: Array<{ m: number; b: number; equation: string; label: string }>;
  };
  symmetry: 'even' | 'odd' | 'periodic' | 'none';
  symmetryDescription: string;
  domain: string;
  range: string;
  period?: number;
  amplitude?: number;
  yIntercept?: { x: number; y: number; latex: string };
  zeros: Array<{ x: number; y: number; latex: string }>;
  extrema: Array<{ x: number; y: number; type: 'min' | 'max'; label: string }>;
  inflections: Array<{ x: number; y: number; label: string }>;
  fPrimeLatex?: string;
  fDoublePrimeLatex?: string;
}

/**
 * Normalizes user input by removing 'y =', 'f(x) =', etc.
 */
export function normalizeFunctionInput(input: string): { expression: string; isEquation: boolean; lhs?: string; rhs?: string } {
  let trimmed = input.trim();
  if (!trimmed) return { expression: '0', isEquation: false };

  // Strip trailing domain block e.g. {0 < x < 2} or [0, 2]
  const { formula } = splitFormulaAndDomain(trimmed);
  trimmed = formula.trim();
  if (!trimmed) return { expression: '0', isEquation: false };

  // Remove trailing semicolons
  trimmed = trimmed.replace(/;+$/, '').trim();

  // Explicit function pattern: y = ... or f(x) = ... or g(x) = ...
  const funcMatch = trimmed.match(/^(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\)|h\s*\(\s*x\s*\))\s*=\s*(.+)$/i);
  if (funcMatch) {
    return { expression: funcMatch[1].trim(), isEquation: false, lhs: 'y', rhs: funcMatch[1].trim() };
  }

  // Polar equation: r = ... or r(theta) = ...
  const polarMatch = trimmed.match(/^(?:r|r\s*\(\s*θ\s*\)|r\s*\(\s*theta\s*\))\s*=\s*(.+)$/i);
  if (polarMatch) {
    return { expression: polarMatch[1].trim(), isEquation: false, lhs: 'r', rhs: polarMatch[1].trim() };
  }

  // General equation with '=' (e.g. x^2 + y^2 = 25)
  if (trimmed.includes('=')) {
    const parts = trimmed.split('=');
    if (parts.length === 2) {
      return {
        expression: `(${parts[0].trim()}) - (${parts[1].trim()})`,
        isEquation: true,
        lhs: parts[0].trim(),
        rhs: parts[1].trim(),
      };
    }
  }

  return { expression: trimmed, isEquation: false };
}

export class CurveAnalyzer {
  /**
   * Main analysis pipeline for any expression or equation
   */
  public static analyze(rawInput: string): FunctionAnalysisResult {
    const norm = normalizeFunctionInput(rawInput);
    let ast: ExpressionNode | null = null;

    try {
      ast = Parser.parse(norm.expression);
    } catch {
      // Fallback
    }

    const conic = CurveAnalyzer.analyzeConic(rawInput);
    const asymptotes = CurveAnalyzer.findAsymptotes(rawInput, ast);
    const zeros = CurveAnalyzer.findZeros(ast);
    const extrema = CurveAnalyzer.findExtrema(ast);
    const inflections = CurveAnalyzer.findInflectionPoints(ast);
    const yIntercept = CurveAnalyzer.findYIntercept(ast);
    const symmetryInfo = CurveAnalyzer.detectSymmetry(ast);
    const domainRange = CurveAnalyzer.estimateDomainAndRange(rawInput, ast, asymptotes, conic);
    const waveProps = CurveAnalyzer.detectWaveProperties(ast);

    let fPrimeLatex = '';
    let fDoublePrimeLatex = '';
    if (ast && !norm.isEquation) {
      try {
        const fp = SymbolicDifferentiator.diff(ast, 'x');
        fPrimeLatex = astToLatex(fp);
        const fpp = SymbolicDifferentiator.diff(fp, 'x');
        fDoublePrimeLatex = astToLatex(fpp);
      } catch {
        // Ignore
      }
    }

    return {
      rawInput,
      cleanFormula: norm.expression,
      latexFormula: ast ? astToLatex(ast) : rawInput,
      isConic: conic.isConic,
      conic,
      asymptotes,
      symmetry: symmetryInfo.type,
      symmetryDescription: symmetryInfo.description,
      domain: domainRange.domain,
      range: domainRange.range,
      period: waveProps?.period,
      amplitude: waveProps?.amplitude,
      yIntercept,
      zeros,
      extrema,
      inflections,
      fPrimeLatex,
      fDoublePrimeLatex,
    };
  }

  /**
   * Complete Conic Section Identification & Feature Extraction
   * Handles circles, ellipses, hyperbolas, parabolas (both centered & translated)
   */
  public static analyzeConic(rawInput: string): ConicAnalysisResult {
    const clean = rawInput.trim();
    
    // Check for explicit standard forms first via pattern matching and algebraic extraction
    const circleMatch = clean.match(/^\(?\s*x\s*(?:([+-])\s*([0-9.]+))?\s*\)?\^2\s*\+\s*\(?\s*y\s*(?:([+-])\s*([0-9.]+))?\s*\)?\^2\s*=\s*([0-9.]+)\s*$/i);
    if (circleMatch) {
      const hSign = circleMatch[1] === '+' ? -1 : 1;
      const h = circleMatch[2] ? hSign * parseFloat(circleMatch[2]) : 0;
      const kSign = circleMatch[3] === '+' ? -1 : 1;
      const k = circleMatch[4] ? kSign * parseFloat(circleMatch[4]) : 0;
      const r2 = parseFloat(circleMatch[5]);
      const r = Math.sqrt(Math.max(0, r2));

      return {
        isConic: true,
        type: 'circle',
        typeName: 'Circle',
        generalFormLatex: `(x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})^2 + (y ${k >= 0 ? '-' : '+'} ${Math.abs(k)})^2 = ${r2}`,
        standardFormLatex: `(x ${h >= 0 ? '-' : '+'} ${Math.abs(h)})^2 + (y ${k >= 0 ? '-' : '+'} ${Math.abs(k)})^2 = ${r.toFixed(2)}^2`,
        center: { x: h, y: k },
        radius: r,
        eccentricity: 0,
        foci: [{ x: h, y: k, label: `Center/Focus: (${h.toFixed(2)}, ${k.toFixed(2)})` }],
        details: [
          { label: 'Classification', value: 'Circle (e = 0)' },
          { label: 'Center (h, k)', value: `(${h.toFixed(3)}, ${k.toFixed(3)})` },
          { label: 'Radius (r)', value: `${r.toFixed(4)} (r² = ${r2})` },
          { label: 'Diameter', value: `${(2 * r).toFixed(4)}` },
          { label: 'Circumference', value: `${(2 * Math.PI * r).toFixed(4)}` },
          { label: 'Area', value: `${(Math.PI * r2).toFixed(4)}` },
          { label: 'Eccentricity (e)', value: '0' },
        ],
      };
    }

    // Try fitting a second-degree polynomial: F(x, y) = A x^2 + B xy + C y^2 + D x + E y + F = 0
    const coeffs = CurveAnalyzer.extractConicCoefficients(rawInput);
    if (!coeffs) {
      return {
        isConic: false,
        type: 'none',
        typeName: 'Non-Conic / General Curve',
        generalFormLatex: '',
        standardFormLatex: '',
        details: [],
      };
    }

    const { A, B, C, D, E, F } = coeffs;
    // Discriminant Delta = B^2 - 4AC
    const disc = B * B - 4 * A * C;

    // Check if it's non-trivial 2nd degree
    if (Math.abs(A) < 1e-7 && Math.abs(B) < 1e-7 && Math.abs(C) < 1e-7) {
      // Linear relation / Line
      return {
        isConic: false,
        type: 'none',
        typeName: 'Linear Relation',
        generalFormLatex: `${D.toFixed(2)}x + ${E.toFixed(2)}y + ${F.toFixed(2)} = 0`,
        standardFormLatex: '',
        details: [{ label: 'Type', value: 'Linear Equation' }],
      };
    }

    // 1. ELLIPSE OR CIRCLE (disc < -1e-5)
    if (disc < -1e-5) {
      // Find center by solving: 2Ax + By + D = 0 and Bx + 2Cy + E = 0
      const det = 4 * A * C - B * B; // -disc > 0
      const h = (B * E - 2 * C * D) / det;
      const k = (B * D - 2 * A * E) / det;

      // Constant term after shifting: F' = A h^2 + B h k + C k^2 + D h + E k + F
      const Fprime = -(A * h * h + B * h * k + C * k * k + D * h + E * k + F);

      if (Fprime <= 0) {
        return {
          isConic: true,
          type: 'point',
          typeName: 'Degenerate Ellipse (Single Point)',
          generalFormLatex: `${A}x^2 + ${C}y^2 ... = 0`,
          standardFormLatex: `(x - ${h.toFixed(2)})^2 + (y - ${k.toFixed(2)})^2 = 0`,
          center: { x: h, y: k },
          eccentricity: 0,
          details: [{ label: 'Point', value: `(${h.toFixed(2)}, ${k.toFixed(2)})` }],
        };
      }

      if (Math.abs(B) < 1e-5) {
        // Axis-aligned ellipse or circle
        const a2 = Fprime / A;
        const b2 = Fprime / C;

        if (a2 <= 0 || b2 <= 0) {
          return { isConic: false, type: 'none', typeName: 'Imaginary Conic', generalFormLatex: '', standardFormLatex: '', details: [] };
        }

        const isCircle = Math.abs(a2 - b2) < 1e-4;
        if (isCircle) {
          const r = Math.sqrt(a2);
          return {
            isConic: true,
            type: 'circle',
            typeName: 'Circle',
            generalFormLatex: `(x - ${h.toFixed(2)})^2 + (y - ${k.toFixed(2)})^2 = ${a2.toFixed(2)}`,
            standardFormLatex: `(x - ${h.toFixed(2)})^2 + (y - ${k.toFixed(2)})^2 = ${r.toFixed(2)}^2`,
            center: { x: h, y: k },
            radius: r,
            eccentricity: 0,
            foci: [{ x: h, y: k, label: `Center: (${h.toFixed(2)}, ${k.toFixed(2)})` }],
            details: [
              { label: 'Classification', value: 'Circle' },
              { label: 'Center (h, k)', value: `(${h.toFixed(3)}, ${k.toFixed(3)})` },
              { label: 'Radius (r)', value: `${r.toFixed(4)}` },
              { label: 'Eccentricity (e)', value: '0' },
              { label: 'Area', value: `${(Math.PI * a2).toFixed(4)}` },
            ],
          };
        }

        const isHorizontal = a2 >= b2;
        const majorA2 = isHorizontal ? a2 : b2;
        const minorB2 = isHorizontal ? b2 : a2;
        const a = Math.sqrt(majorA2);
        const b = Math.sqrt(minorB2);
        const c = Math.sqrt(majorA2 - minorB2);
        const e = c / a;

        const foci = isHorizontal
          ? [
              { x: h - c, y: k, label: `Focus 1: (${(h - c).toFixed(3)}, ${k.toFixed(3)})` },
              { x: h + c, y: k, label: `Focus 2: (${(h + c).toFixed(3)}, ${k.toFixed(3)})` },
            ]
          : [
              { x: h, y: k - c, label: `Focus 1: (${h.toFixed(3)}, ${(k - c).toFixed(3)})` },
              { x: h, y: k + c, label: `Focus 2: (${h.toFixed(3)}, ${(k + c).toFixed(3)})` },
            ];

        const vertices = isHorizontal
          ? [
              { x: h - a, y: k, label: `Vertex 1: (${(h - a).toFixed(3)}, ${k.toFixed(3)})` },
              { x: h + a, y: k, label: `Vertex 2: (${(h + a).toFixed(3)}, ${k.toFixed(3)})` },
            ]
          : [
              { x: h, y: k - a, label: `Vertex 1: (${h.toFixed(3)}, ${(k - a).toFixed(3)})` },
              { x: h, y: k + a, label: `Vertex 2: (${h.toFixed(3)}, ${(k + a).toFixed(3)})` },
            ];

        const coVertices = isHorizontal
          ? [
              { x: h, y: k - b, label: `Co-Vertex 1: (${h.toFixed(3)}, ${(k - b).toFixed(3)})` },
              { x: h, y: k + b, label: `Co-Vertex 2: (${h.toFixed(3)}, ${(k + b).toFixed(3)})` },
            ]
          : [
              { x: h - b, y: k, label: `Co-Vertex 1: (${(h - b).toFixed(3)}, ${k.toFixed(3)})` },
              { x: h + b, y: k, label: `Co-Vertex 2: (${(h + b).toFixed(3)}, ${k.toFixed(3)})` },
            ];

        const directrixDist = majorA2 / c;
        const directrices = isHorizontal
          ? [
              { equation: `x = ${(h - directrixDist).toFixed(3)}`, type: 'vertical' as const, val: h - directrixDist },
              { equation: `x = ${(h + directrixDist).toFixed(3)}`, type: 'vertical' as const, val: h + directrixDist },
            ]
          : [
              { equation: `y = ${(k - directrixDist).toFixed(3)}`, type: 'horizontal' as const, val: k - directrixDist },
              { equation: `y = ${(k + directrixDist).toFixed(3)}`, type: 'horizontal' as const, val: k + directrixDist },
            ];

        const semiLatusRectum = minorB2 / a;

        return {
          isConic: true,
          type: 'ellipse',
          typeName: isHorizontal ? 'Horizontal Ellipse' : 'Vertical Ellipse',
          generalFormLatex: `${A}x^2 + ${C}y^2 + ${D}x + ${E}y + ${F} = 0`,
          standardFormLatex: `\\frac{(x ${h >= 0 ? '-' : '+'} ${Math.abs(h).toFixed(2)})^2}{${a2.toFixed(2)}} + \\frac{(y ${k >= 0 ? '-' : '+'} ${Math.abs(k).toFixed(2)})^2}{${b2.toFixed(2)}} = 1`,
          center: { x: h, y: k },
          foci,
          vertices,
          coVertices,
          eccentricity: e,
          directrices,
          semiMajorAxis: a,
          semiMinorAxis: b,
          focalDistance: c,
          semiLatusRectum,
          orientation: isHorizontal ? 'horizontal' : 'vertical',
          details: [
            { label: 'Conic Classification', value: `Ellipse (0 < e = ${e.toFixed(4)} < 1)` },
            { label: 'Center (h, k)', value: `(${h.toFixed(3)}, ${k.toFixed(3)})` },
            { label: 'Eccentricity (e = c/a)', value: `${e.toFixed(4)}` },
            { label: 'Foci F₁, F₂', value: isHorizontal ? `(${ (h - c).toFixed(3)}, ${k.toFixed(3)}), (${(h + c).toFixed(3)}, ${k.toFixed(3)})` : `(${h.toFixed(3)}, ${(k - c).toFixed(3)}), (${h.toFixed(3)}, ${(k + c).toFixed(3)})` },
            { label: 'Directrix Lines', value: directrices.map(d => d.equation).join(', ') },
            { label: 'Major Axis Length (2a)', value: `${(2 * a).toFixed(4)} (Semi-major a = ${a.toFixed(4)})` },
            { label: 'Minor Axis Length (2b)', value: `${(2 * b).toFixed(4)} (Semi-minor b = ${b.toFixed(4)})` },
            { label: 'Focal Distance (c)', value: `${c.toFixed(4)} (c² = a² - b²)` },
            { label: 'Semi-Latus Rectum (l = b²/a)', value: `${semiLatusRectum.toFixed(4)}` },
            { label: 'Area (πab)', value: `${(Math.PI * a * b).toFixed(4)}` },
          ],
        };
      }
    }

    // 2. HYPERBOLA (disc > 1e-5)
    if (disc > 1e-5) {
      if (Math.abs(B) < 1e-5) {
        // Standard horizontal or vertical hyperbola: A and C have opposite signs
        const det = 4 * A * C;
        const h = -D / (2 * A);
        const k = -E / (2 * C);
        const Fprime = -(A * h * h + C * k * k + F);

        const isHorizontal = (A > 0 && Fprime > 0) || (A < 0 && Fprime < 0);
        const a2 = isHorizontal ? Math.abs(Fprime / A) : Math.abs(Fprime / C);
        const b2 = isHorizontal ? Math.abs(Fprime / C) : Math.abs(Fprime / A);
        const a = Math.sqrt(a2);
        const b = Math.sqrt(b2);
        const c = Math.sqrt(a2 + b2);
        const e = c / a;

        const foci = isHorizontal
          ? [
              { x: h - c, y: k, label: `Focus 1: (${(h - c).toFixed(3)}, ${k.toFixed(3)})` },
              { x: h + c, y: k, label: `Focus 2: (${(h + c).toFixed(3)}, ${k.toFixed(3)})` },
            ]
          : [
              { x: h, y: k - c, label: `Focus 1: (${h.toFixed(3)}, ${(k - c).toFixed(3)})` },
              { x: h, y: k + c, label: `Focus 2: (${h.toFixed(3)}, ${(k + c).toFixed(3)})` },
            ];

        const vertices = isHorizontal
          ? [
              { x: h - a, y: k, label: `Vertex 1: (${(h - a).toFixed(3)}, ${k.toFixed(3)})` },
              { x: h + a, y: k, label: `Vertex 2: (${(h + a).toFixed(3)}, ${k.toFixed(3)})` },
            ]
          : [
              { x: h, y: k - a, label: `Vertex 1: (${h.toFixed(3)}, ${(k - a).toFixed(3)})` },
              { x: h, y: k + a, label: `Vertex 2: (${h.toFixed(3)}, ${(k + a).toFixed(3)})` },
            ];

        const directrixDist = a2 / c;
        const directrices = isHorizontal
          ? [
              { equation: `x = ${(h - directrixDist).toFixed(3)}`, type: 'vertical' as const, val: h - directrixDist },
              { equation: `x = ${(h + directrixDist).toFixed(3)}`, type: 'vertical' as const, val: h + directrixDist },
            ]
          : [
              { equation: `y = ${(k - directrixDist).toFixed(3)}`, type: 'horizontal' as const, val: k - directrixDist },
              { equation: `y = ${(k + directrixDist).toFixed(3)}`, type: 'horizontal' as const, val: k + directrixDist },
            ];

        // Asymptotes: y - k = ± (b/a)(x - h) for horizontal, y - k = ± (a/b)(x - h) for vertical
        const slope = isHorizontal ? b / a : a / b;
        const asymptotes = [
          { equation: `y = ${slope.toFixed(3)}x ${k - slope * h >= 0 ? '+' : '-'} ${Math.abs(k - slope * h).toFixed(3)}`, m: slope, b: k - slope * h },
          { equation: `y = ${(-slope).toFixed(3)}x ${k + slope * h >= 0 ? '+' : '-'} ${Math.abs(k + slope * h).toFixed(3)}`, m: -slope, b: k + slope * h },
        ];

        return {
          isConic: true,
          type: 'hyperbola',
          typeName: isHorizontal ? 'Horizontal Hyperbola' : 'Vertical Hyperbola',
          generalFormLatex: `${A}x^2 + ${C}y^2 + ${D}x + ${E}y + ${F} = 0`,
          standardFormLatex: isHorizontal
            ? `\\frac{(x - ${h.toFixed(2)})^2}{${a2.toFixed(2)}} - \\frac{(y - ${k.toFixed(2)})^2}{${b2.toFixed(2)}} = 1`
            : `\\frac{(y - ${k.toFixed(2)})^2}{${a2.toFixed(2)}} - \\frac{(x - ${h.toFixed(2)})^2}{${b2.toFixed(2)}} = 1`,
          center: { x: h, y: k },
          foci,
          vertices,
          eccentricity: e,
          directrices,
          asymptotes,
          semiMajorAxis: a,
          semiMinorAxis: b,
          focalDistance: c,
          semiLatusRectum: b2 / a,
          orientation: isHorizontal ? 'horizontal' : 'vertical',
          details: [
            { label: 'Conic Classification', value: `Hyperbola (e = ${e.toFixed(4)} > 1)` },
            { label: 'Center (h, k)', value: `(${h.toFixed(3)}, ${k.toFixed(3)})` },
            { label: 'Eccentricity (e = c/a)', value: `${e.toFixed(4)}` },
            { label: 'Foci F₁, F₂', value: isHorizontal ? `(${ (h - c).toFixed(3)}, ${k.toFixed(3)}), (${(h + c).toFixed(3)}, ${k.toFixed(3)})` : `(${h.toFixed(3)}, ${(k - c).toFixed(3)}), (${h.toFixed(3)}, ${(k + c).toFixed(3)})` },
            { label: 'Vertices V₁, V₂', value: isHorizontal ? `(${ (h - a).toFixed(3)}, ${k.toFixed(3)}), (${(h + a).toFixed(3)}, ${k.toFixed(3)})` : `(${h.toFixed(3)}, ${(k - a).toFixed(3)}), (${h.toFixed(3)}, ${(k + a).toFixed(3)})` },
            { label: 'Asymptotes', value: asymptotes.map(a => a.equation).join(' and ') },
            { label: 'Directrix Lines', value: directrices.map(d => d.equation).join(', ') },
            { label: 'Transverse Axis (2a)', value: `${(2 * a).toFixed(4)}` },
            { label: 'Conjugate Axis (2b)', value: `${(2 * b).toFixed(4)}` },
            { label: 'Focal Distance (c)', value: `${c.toFixed(4)} (c² = a² + b²)` },
          ],
        };
      }
    }

    // 3. PARABOLA (disc ~ 0)
    if (Math.abs(disc) < 1e-4) {
      if (Math.abs(A) > 1e-5 && Math.abs(C) < 1e-5) {
        // Vertical parabola: y = ax^2 + bx + c or (x-h)^2 = 4p(y-k)
        // A x^2 + D x + E y + F = 0 => y = -(A x^2 + D x + F)/E
        if (Math.abs(E) > 1e-5) {
          const aCoeff = -A / E;
          const bCoeff = -D / E;
          const cCoeff = -F / E;
          const h = -bCoeff / (2 * aCoeff);
          const k = aCoeff * h * h + bCoeff * h + cCoeff;
          const p = 1 / (4 * aCoeff);

          const focus = { x: h, y: k + p, label: `Focus: (${h.toFixed(3)}, ${(k + p).toFixed(3)})` };
          const directrix = { equation: `y = ${(k - p).toFixed(3)}`, type: 'horizontal' as const, val: k - p };

          return {
            isConic: true,
            type: 'parabola',
            typeName: aCoeff > 0 ? 'Vertical Parabola (Opens Up)' : 'Vertical Parabola (Opens Down)',
            generalFormLatex: `${A}x^2 + ${D}x + ${E}y + ${F} = 0`,
            standardFormLatex: `(x - ${h.toFixed(2)})^2 = ${(4 * p).toFixed(2)}(y - ${k.toFixed(2)})`,
            center: { x: h, y: k }, // Vertex
            vertices: [{ x: h, y: k, label: `Vertex: (${h.toFixed(3)}, ${k.toFixed(3)})` }],
            foci: [focus],
            eccentricity: 1.0,
            directrices: [directrix],
            focalDistance: Math.abs(p),
            semiLatusRectum: 2 * Math.abs(p),
            axisOfSymmetry: [`x = ${h.toFixed(3)}`],
            orientation: 'vertical',
            details: [
              { label: 'Conic Classification', value: 'Parabola (e = 1.0000)' },
              { label: 'Vertex (h, k)', value: `(${h.toFixed(3)}, ${k.toFixed(3)})` },
              { label: 'Focus (h, k + p)', value: `(${focus.x.toFixed(3)}, ${focus.y.toFixed(3)})` },
              { label: 'Directrix', value: directrix.equation },
              { label: 'Focal Parameter (p)', value: `${p.toFixed(4)}` },
              { label: 'Latus Rectum Length (4|p|)', value: `${Math.abs(4 * p).toFixed(4)}` },
              { label: 'Axis of Symmetry', value: `x = ${h.toFixed(3)}` },
              { label: 'Eccentricity (e)', value: '1' },
            ],
          };
        }
      } else if (Math.abs(C) > 1e-5 && Math.abs(A) < 1e-5) {
        // Horizontal parabola: x = ay^2 + by + c or (y-k)^2 = 4p(x-h)
        if (Math.abs(D) > 1e-5) {
          const aCoeff = -C / D;
          const bCoeff = -E / D;
          const cCoeff = -F / D;
          const k = -bCoeff / (2 * aCoeff);
          const h = aCoeff * k * k + bCoeff * k + cCoeff;
          const p = 1 / (4 * aCoeff);

          const focus = { x: h + p, y: k, label: `Focus: (${(h + p).toFixed(3)}, ${k.toFixed(3)})` };
          const directrix = { equation: `x = ${(h - p).toFixed(3)}`, type: 'vertical' as const, val: h - p };

          return {
            isConic: true,
            type: 'parabola',
            typeName: aCoeff > 0 ? 'Horizontal Parabola (Opens Right)' : 'Horizontal Parabola (Opens Left)',
            generalFormLatex: `${C}y^2 + ${D}x + ${E}y + ${F} = 0`,
            standardFormLatex: `(y - ${k.toFixed(2)})^2 = ${(4 * p).toFixed(2)}(x - ${h.toFixed(2)})`,
            center: { x: h, y: k }, // Vertex
            vertices: [{ x: h, y: k, label: `Vertex: (${h.toFixed(3)}, ${k.toFixed(3)})` }],
            foci: [focus],
            eccentricity: 1.0,
            directrices: [directrix],
            focalDistance: Math.abs(p),
            semiLatusRectum: 2 * Math.abs(p),
            axisOfSymmetry: [`y = ${k.toFixed(3)}`],
            orientation: 'horizontal',
            details: [
              { label: 'Conic Classification', value: 'Parabola (e = 1.0000)' },
              { label: 'Vertex (h, k)', value: `(${h.toFixed(3)}, ${k.toFixed(3)})` },
              { label: 'Focus (h + p, k)', value: `(${focus.x.toFixed(3)}, ${focus.y.toFixed(3)})` },
              { label: 'Directrix', value: directrix.equation },
              { label: 'Focal Parameter (p)', value: `${p.toFixed(4)}` },
              { label: 'Latus Rectum Length (4|p|)', value: `${Math.abs(4 * p).toFixed(4)}` },
              { label: 'Axis of Symmetry', value: `y = ${k.toFixed(3)}` },
              { label: 'Eccentricity (e)', value: '1' },
            ],
          };
        }
      }
    }

    return {
      isConic: false,
      type: 'none',
      typeName: 'General Curve',
      generalFormLatex: '',
      standardFormLatex: '',
      details: [],
    };
  }

  /**
   * Samples 2D equation grid to extract quadratic coefficients A, B, C, D, E, F
   */
  private static extractConicCoefficients(input: string): { A: number; B: number; C: number; D: number; E: number; F: number } | null {
    const norm = normalizeFunctionInput(input);
    let ast: ExpressionNode | null = null;
    try {
      ast = Parser.parse(norm.expression);
    } catch {
      return null;
    }
    if (!ast) return null;

    const f = (x: number, y: number) => {
      const val = evaluateAST(ast!, { x, y });
      return isNaN(val) ? 0 : val;
    };

    // Evaluate at basis coordinates to solve for A, B, C, D, E, F
    // F(0, 0) = F
    const F = f(0, 0);

    // F(1, 0) = A + D + F
    // F(-1, 0) = A - D + F
    const f1_0 = f(1, 0);
    const fm1_0 = f(-1, 0);
    const A = (f1_0 + fm1_0 - 2 * F) / 2;
    const D = (f1_0 - fm1_0) / 2;

    // F(0, 1) = C + E + F
    // F(0, -1) = C - E + F
    const f0_1 = f(0, 1);
    const f0_m1 = f(0, -1);
    const C = (f0_1 + f0_m1 - 2 * F) / 2;
    const E = (f0_1 - f0_m1) / 2;

    // F(1, 1) = A + B + C + D + E + F
    const f1_1 = f(1, 1);
    const B = f1_1 - (A + C + D + E + F);

    // Test validity at a few random points (2, 3), (-2, 2)
    const test1Actual = f(2, 3);
    const test1Expected = A * 4 + B * 6 + C * 9 + D * 2 + E * 3 + F;
    if (Math.abs(test1Actual - test1Expected) > 1e-3) {
      // Non-quadratic function
      return null;
    }

    return { A, B, C, D, E, F };
  }

  /**
   * Computes Vertical, Horizontal, and Oblique (Slant) Asymptotes
   */
  public static findAsymptotes(
    rawInput: string,
    ast: ExpressionNode | null
  ): {
    vertical: Array<{ x: number; equation: string; label: string }>;
    horizontal: Array<{ y: number; equation: string; label: string }>;
    oblique: Array<{ m: number; b: number; equation: string; label: string }>;
  } {
    const vertical: Array<{ x: number; equation: string; label: string }> = [];
    const horizontal: Array<{ y: number; equation: string; label: string }> = [];
    const oblique: Array<{ m: number; b: number; equation: string; label: string }> = [];

    if (!ast) return { vertical, horizontal, oblique };

    const norm = normalizeFunctionInput(rawInput);
    const vars = CurveAnalyzer.getVariables(ast);
    const isPolar = norm.lhs === 'r' || vars.has('theta') || vars.has('θ');

    const evalPolar = (theta: number) => {
      try {
        return evaluateAST(ast, { x: theta, theta, θ: theta, t: theta });
      } catch {
        return NaN;
      }
    };

    if (isPolar) {
      // Polar asymptotes detection
      // Scan [0, 2pi] for infinite discontinuities of r = f(theta)
      const pSteps = 500;
      const pMin = 0;
      const pMax = 2 * Math.PI;
      const pStep = (pMax - pMin) / pSteps;
      const foundPoles = new Set<string>();

      for (let i = 0; i < pSteps; i++) {
        const t1 = pMin + i * pStep;
        const t2 = t1 + pStep;
        const r1 = evalPolar(t1);
        const r2 = evalPolar(t2);

        // Check if there is a massive jump or pole between t1 and t2
        if (!isNaN(r1) && !isNaN(r2) && isFinite(r1) && isFinite(r2)) {
          if (Math.abs(r1 - r2) > 50 && (r1 * r2 < 0 || Math.abs(r1) > 30 || Math.abs(r2) > 30)) {
            // Bisect to find exact theta pole
            let left = t1;
            let right = t2;
            for (let b = 0; b < 20; b++) {
              const mid = (left + right) / 2;
              const rm = evalPolar(mid);
              if (isNaN(rm) || !isFinite(rm) || Math.abs(rm) > 1e4) {
                left = mid - 1e-5;
                right = mid + 1e-5;
                break;
              }
              if (Math.abs(evalPolar(left)) > Math.abs(evalPolar(right))) {
                right = mid;
              } else {
                left = mid;
              }
            }
            const poleTheta = (left + right) / 2;
            const key = poleTheta.toFixed(2);

            if (!foundPoles.has(key)) {
              foundPoles.add(key);

              // Analyze Cartesian parametric limit as theta -> poleTheta
              const eps = 1e-6;
              const rLeft = evalPolar(poleTheta - eps);
              const rRight = evalPolar(poleTheta + eps);

              const xLeft = isFinite(rLeft) ? rLeft * Math.cos(poleTheta - eps) : NaN;
              const xRight = isFinite(rRight) ? rRight * Math.cos(poleTheta + eps) : NaN;
              const yLeft = isFinite(rLeft) ? rLeft * Math.sin(poleTheta - eps) : NaN;
              const yRight = isFinite(rRight) ? rRight * Math.sin(poleTheta + eps) : NaN;

              const getValidAbs = (v: number) => isNaN(v) || !isFinite(v) ? Infinity : Math.abs(v);
              const getValidValue = (v1: number, v2: number) => {
                const a1 = getValidAbs(v1);
                const a2 = getValidAbs(v2);
                if (a1 < a2) return v1;
                return v2;
              };

              const xVal = getValidValue(xLeft, xRight);
              const yVal = getValidValue(yLeft, yRight);

              const xFinite = isFinite(xVal) && Math.abs(xVal) < 1000;
              const yFinite = isFinite(yVal) && Math.abs(yVal) < 1000;

              if (xFinite && !yFinite) {
                // Vertical Asymptote
                vertical.push({
                  x: xVal,
                  equation: `x = ${xVal.toFixed(3)}`,
                  label: `Polar Asymptote: x = ${xVal.toFixed(3)} (θ → ${poleTheta.toFixed(3)})`,
                });
              } else if (yFinite && !xFinite) {
                // Horizontal Asymptote
                horizontal.push({
                  y: yVal,
                  equation: `y = ${yVal.toFixed(3)}`,
                  label: `Polar Asymptote: y = ${yVal.toFixed(3)} (θ → ${poleTheta.toFixed(3)})`,
                });
              } else if (xFinite && yFinite) {
                // Discontinuity is removable or finite gap
              } else {
                // Both infinite - check for slant asymptote
                const m = Math.tan(poleTheta);
                if (isFinite(m) && Math.abs(m) < 1000) {
                  const bLeft = isFinite(rLeft) ? rLeft * Math.sin(-eps) / Math.cos(poleTheta) : NaN;
                  const bRight = isFinite(rRight) ? rRight * Math.sin(eps) / Math.cos(poleTheta) : NaN;
                  const bVal = getValidValue(bLeft, bRight);
                  if (isFinite(bVal) && Math.abs(bVal) < 1000) {
                    oblique.push({
                      m,
                      b: bVal,
                      equation: `y = ${m.toFixed(3)}x ${bVal >= 0 ? '+' : '-'} ${Math.abs(bVal).toFixed(3)}`,
                      label: `Polar Slant Asymptote: y = ${m.toFixed(3)}x ${bVal >= 0 ? '+' : '-'} ${Math.abs(bVal).toFixed(3)}`,
                    });
                  }
                }
              }
            }
          }
        }
      }

      return { vertical, horizontal, oblique };
    }

    const f = (x: number) => {
      const res = evaluateAST(ast, { x });
      return res;
    };

    // 1. Detect Vertical Asymptotes (Poles / infinite discontinuities)
    // Scan [-20, 20] with fine steps
    const vSteps = 400;
    const vMin = -20;
    const vMax = 20;
    const step = (vMax - vMin) / vSteps;
    const foundV = new Set<string>();

    for (let i = 0; i < vSteps; i++) {
      const x1 = vMin + i * step;
      const x2 = x1 + step;
      const y1 = f(x1);
      const y2 = f(x2);

      // Sign change with huge magnitude jump
      if (!isNaN(y1) && !isNaN(y2) && isFinite(y1) && isFinite(y2)) {
        if (Math.abs(y1 - y2) > 50 && (y1 * y2 < 0 || Math.abs(y1) > 30 || Math.abs(y2) > 30)) {
          // Bisect to find pole
          let left = x1;
          let right = x2;
          for (let b = 0; b < 20; b++) {
            const mid = (left + right) / 2;
            const ym = f(mid);
            if (isNaN(ym) || !isFinite(ym) || Math.abs(ym) > 1e4) {
              left = mid - 1e-5;
              right = mid + 1e-5;
              break;
            }
            if (Math.abs(f(left)) > Math.abs(f(right))) {
              right = mid;
            } else {
              left = mid;
            }
          }
          const poleX = (left + right) / 2;
          const key = poleX.toFixed(2);
          
          // Verify if poleX is an actual vertical asymptote by checking values extremely close to the candidate point
          const getValidAbs = (val: number) => {
            if (isNaN(val) || !isFinite(val)) return 0;
            return Math.abs(val);
          };
          
          const yCloseLeft = getValidAbs(f(poleX - 1e-6));
          const yCloseRight = getValidAbs(f(poleX + 1e-6));
          const yClose = Math.max(yCloseLeft, yCloseRight);

          const yFarLeft = getValidAbs(f(poleX - 1e-3));
          const yFarRight = getValidAbs(f(poleX + 1e-3));
          const yFar = Math.max(yFarLeft, yFarRight);

          // A true pole has extremely large values very close to it (e.g., > 150)
          // and grows significantly larger as we approach the pole (e.g., yClose > 1.2 * yFar)
          // unless both are already astronomical (yClose > 1e4).
          const isTrueAsymptote = yClose > 150 && (yClose > 1.2 * yFar || yClose > 1e4);

          if (!foundV.has(key) && isTrueAsymptote) {
            foundV.add(key);
            vertical.push({
              x: poleX,
              equation: `x = ${poleX.toFixed(3)}`,
              label: `Vertical Asymptote at x = ${poleX.toFixed(3)}`,
            });
          }
        }
      }
    }

    // 2. Detect Horizontal Asymptotes: lim_{x -> +inf} f(x) and lim_{x -> -inf} f(x)
    const infPos1 = f(1e4);
    const infPos2 = f(1e5);
    if (!isNaN(infPos1) && !isNaN(infPos2) && isFinite(infPos1) && Math.abs(infPos2 - infPos1) < 1e-3 && Math.abs(infPos2) < 1e5) {
      const yVal = infPos2;
      horizontal.push({
        y: yVal,
        equation: `y = ${yVal.toFixed(3)}`,
        label: `Horizontal Asymptote as x → +∞ (y = ${yVal.toFixed(3)})`,
      });
    }

    const infNeg1 = f(-1e4);
    const infNeg2 = f(-1e5);
    if (!isNaN(infNeg1) && !isNaN(infNeg2) && isFinite(infNeg1) && Math.abs(infNeg2 - infNeg1) < 1e-3 && Math.abs(infNeg2) < 1e5) {
      const yVal = infNeg2;
      const key = yVal.toFixed(2);
      if (!horizontal.some(h => Math.abs(h.y - yVal) < 1e-2)) {
        horizontal.push({
          y: yVal,
          equation: `y = ${yVal.toFixed(3)}`,
          label: `Horizontal Asymptote as x → -∞ (y = ${yVal.toFixed(3)})`,
        });
      }
    }

    // 3. Detect Oblique / Slant Asymptotes: m = lim f(x)/x, b = lim (f(x) - mx)
    if (horizontal.length === 0) {
      const xLarge = 1e4;
      const yLarge = f(xLarge);
      if (!isNaN(yLarge) && isFinite(yLarge)) {
        const m = yLarge / xLarge;
        const b = yLarge - m * xLarge;
        const xLarge2 = 2e4;
        const yLarge2 = f(xLarge2);
        const m2 = yLarge2 / xLarge2;
        const b2 = yLarge2 - m2 * xLarge2;

        if (Math.abs(m - m2) < 1e-3 && Math.abs(b - b2) < 0.1 && Math.abs(m) > 1e-4 && isFinite(m) && isFinite(b)) {
          oblique.push({
            m,
            b,
            equation: `y = ${m.toFixed(3)}x ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(3)}`,
            label: `Slant Asymptote: y = ${m.toFixed(3)}x ${b >= 0 ? '+' : '-'} ${Math.abs(b).toFixed(3)}`,
          });
        }
      }
    }

    return { vertical, horizontal, oblique };
  }

  public static findZeros(ast: ExpressionNode | null): Array<{ x: number; y: number; latex: string }> {
    if (!ast) return [];
    const critical = NumericalSolvers.findCriticalPoints(ast, -15, 15, 200);
    return critical
      .filter((p) => p.type === 'zero')
      .map((p) => ({
        x: p.x,
        y: 0,
        latex: `(${p.x.toFixed(4)}, 0)`,
      }));
  }

  public static findExtrema(ast: ExpressionNode | null): Array<{ x: number; y: number; type: 'min' | 'max'; label: string }> {
    if (!ast) return [];
    const critical = NumericalSolvers.findCriticalPoints(ast, -15, 15, 200);
    return critical
      .filter((p) => p.type === 'min' || p.type === 'max')
      .map((p) => ({
        x: p.x,
        y: p.y,
        type: p.type as 'min' | 'max',
        label: `${p.type === 'min' ? 'Local Min' : 'Local Max'}: (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`,
      }));
  }

  public static findInflectionPoints(ast: ExpressionNode | null): Array<{ x: number; y: number; label: string }> {
    if (!ast) return [];
    const critical = NumericalSolvers.findCriticalPoints(ast, -15, 15, 200);
    return critical
      .filter((p) => p.type === 'inflection')
      .map((p) => ({
        x: p.x,
        y: p.y,
        label: `Inflection Point: (${p.x.toFixed(3)}, ${p.y.toFixed(3)})`,
      }));
  }

  public static findYIntercept(ast: ExpressionNode | null): { x: number; y: number; latex: string } | undefined {
    if (!ast) return undefined;
    const y0 = evaluateAST(ast, { x: 0 });
    if (!isNaN(y0) && isFinite(y0)) {
      return { x: 0, y: y0, latex: `(0, ${y0.toFixed(4)})` };
    }
    return undefined;
  }

  public static detectSymmetry(ast: ExpressionNode | null): { type: 'even' | 'odd' | 'periodic' | 'none'; description: string } {
    if (!ast) return { type: 'none', description: 'No symmetry detected' };

    // 1. Gather candidate x0 centers
    const candidatesSet = new Set<number>();
    candidatesSet.add(0); // Standard y-axis or origin

    // Get critical points
    const critical = NumericalSolvers.findCriticalPoints(ast, -15, 15, 200);
    const criticalXs = critical.map((p) => p.x);

    for (const cx of criticalXs) {
      if (!isNaN(cx) && isFinite(cx)) {
        candidatesSet.add(cx);
      }
    }

    // Add midpoints between all pairs of critical points
    for (let i = 0; i < criticalXs.length; i++) {
      for (let j = i + 1; j < criticalXs.length; j++) {
        const mid = (criticalXs[i] + criticalXs[j]) / 2;
        if (!isNaN(mid) && isFinite(mid)) {
          candidatesSet.add(mid);
        }
      }
    }

    // Convert to unique candidates array
    const candidates = Array.from(candidatesSet).sort((a, b) => a - b);

    // Helper to evaluate and verify symmetry at a specific center x0
    const checkSymmetryAt = (x0: number): { even: boolean; odd: boolean; y0: number } => {
      let even = true;
      let odd = true;
      const y0 = evaluateAST(ast, { x: x0 });
      if (isNaN(y0) || !isFinite(y0)) {
        return { even: false, odd: false, y0: 0 };
      }
      const offsets = [0.4, 1.1, 2.3, 3.7, 5.3];
      for (const h of offsets) {
        const f1 = evaluateAST(ast, { x: x0 - h });
        const f2 = evaluateAST(ast, { x: x0 + h });
        if (isNaN(f1) || isNaN(f2) || !isFinite(f1) || !isFinite(f2)) {
          even = false;
          odd = false;
          break;
        }
        if (Math.abs(f1 - f2) > 1e-4) even = false;
        if (Math.abs(f1 + f2 - 2 * y0) > 1e-4) odd = false;
      }
      return { even, odd, y0 };
    };

    // First check candidate x0 = 0 (origin / standard y-axis) for cleaner output
    const originCheck = checkSymmetryAt(0);
    if (originCheck.even) {
      return { type: 'even', description: 'Even Function: Symmetric across y-axis' };
    }
    if (originCheck.odd) {
      return { type: 'odd', description: 'Odd Function: Rotational symmetry about (0,0)' };
    }

    // Then check shifted candidates
    for (const x0 of candidates) {
      if (Math.abs(x0) < 1e-5) continue; // Already checked origin
      const check = checkSymmetryAt(x0);
      if (check.even) {
        const xStr = x0.toFixed(3).replace(/\.?0+$/, '');
        return {
          type: 'even',
          description: `Symmetric across line x = ${xStr}`
        };
      }
      if (check.odd) {
        const xStr = x0.toFixed(3).replace(/\.?0+$/, '');
        const yStr = check.y0.toFixed(3).replace(/\.?0+$/, '');
        return {
          type: 'odd',
          description: `Rotational symmetry about (${xStr}, ${yStr})`
        };
      }
    }

    return { type: 'none', description: 'Asymmetric (No symmetry detected)' };
  }

  public static detectWaveProperties(ast: ExpressionNode | null): { period?: number; amplitude?: number } | null {
    if (!ast) return null;
    // Test for periodic function
    const sample = (x: number) => evaluateAST(ast, { x });
    const y0 = sample(0);
    if (isNaN(y0) || !isFinite(y0)) return null;

    // Scan for period T in [0.1, 40]
    for (let T = 0.5; T <= 25; T += 0.05) {
      let match = true;
      for (const offset of [0.3, 1.1, 2.2]) {
        const v1 = sample(offset);
        const v2 = sample(offset + T);
        if (isNaN(v1) || isNaN(v2) || Math.abs(v1 - v2) > 1e-3) {
          match = false;
          break;
        }
      }
      if (match) {
        // Find amplitude
        let minVal = Infinity;
        let maxVal = -Infinity;
        for (let s = 0; s < 50; s++) {
          const val = sample((s / 50) * T);
          if (!isNaN(val)) {
            minVal = Math.min(minVal, val);
            maxVal = Math.max(maxVal, val);
          }
        }
        const amp = (maxVal - minVal) / 2;
        return { period: T, amplitude: amp };
      }
    }

    return null;
  }

  public static getVariables(node: ExpressionNode | null): Set<string> {
    const vars = new Set<string>();
    if (!node) return vars;
    function walk(n: ExpressionNode) {
      if (!n) return;
      if (n.type === 'variable') {
        vars.add(n.name.toLowerCase());
      } else if (n.type === 'add' || n.type === 'subtract' || n.type === 'multiply' || n.type === 'divide' || n.type === 'modulo' || n.type === 'equation') {
        walk(n.lhs);
        walk(n.rhs);
      } else if (n.type === 'power') {
        walk(n.base);
        walk(n.exponent);
      } else if (n.type === 'negate' || n.type === 'factorial') {
        walk(n.expr);
      } else if (n.type === 'call') {
        if (n.args) {
          n.args.forEach(walk);
        }
      } else if (n.type === 'inequality') {
        walk(n.lhs);
        walk(n.rhs);
      }
    }
    walk(node);
    return vars;
  }

  public static estimateDomainAndRange(
    rawInput: string,
    ast: ExpressionNode | null,
    asymptotes: { vertical: Array<{ x: number }> },
    conic?: ConicAnalysisResult
  ): { domain: string; range: string } {
    const norm = normalizeFunctionInput(rawInput);
    const vars = CurveAnalyzer.getVariables(ast);
    const isPolar = norm.lhs === 'r' || vars.has('theta') || vars.has('θ');

    if (isPolar) {
      // Polar Domain and Range
      // Domain is the set of theta values for which r is defined.
      const pSteps = 500;
      const pMin = 0;
      const pMax = 2 * Math.PI;
      const pStep = (pMax - pMin) / pSteps;

      const evalPolar = (theta: number) => {
        try {
          return evaluateAST(ast, { x: theta, theta, θ: theta, t: theta });
        } catch {
          return NaN;
        }
      };

      let definedCount = 0;
      let minR = Infinity;
      let maxR = -Infinity;

      for (let i = 0; i <= pSteps; i++) {
        const theta = pMin + i * pStep;
        const rVal = evalPolar(theta);
        if (!isNaN(rVal) && isFinite(rVal)) {
          definedCount++;
          if (rVal < minR) minR = rVal;
          if (rVal > maxR) maxR = rVal;
        }
      }

      if (definedCount === 0) {
        return {
          domain: 'None / Complex',
          range: 'None'
        };
      }

      // Check if there are poles (discontinuities)
      let domainStr = 'θ ∈ ℝ';
      const polarPoles: number[] = [];

      // Scan for poles
      for (let i = 0; i < pSteps; i++) {
        const t1 = pMin + i * pStep;
        const t2 = t1 + pStep;
        const r1 = evalPolar(t1);
        const r2 = evalPolar(t2);
        if (!isNaN(r1) && !isNaN(r2) && isFinite(r1) && isFinite(r2)) {
          if (Math.abs(r1 - r2) > 50 && (r1 * r2 < 0 || Math.abs(r1) > 30 || Math.abs(r2) > 30)) {
            let left = t1;
            let right = t2;
            for (let b = 0; b < 15; b++) {
              const mid = (left + right) / 2;
              const rm = evalPolar(mid);
              if (isNaN(rm) || !isFinite(rm) || Math.abs(rm) > 1e4) {
                left = mid - 1e-4;
                right = mid + 1e-4;
                break;
              }
              if (Math.abs(evalPolar(left)) > Math.abs(evalPolar(right))) {
                right = mid;
              } else {
                left = mid;
              }
            }
            const poleVal = (left + right) / 2;
            if (!polarPoles.some(p => Math.abs(p - poleVal) < 0.1)) {
              polarPoles.push(poleVal);
            }
          }
        }
      }

      if (polarPoles.length > 0) {
        polarPoles.sort((a, b) => a - b);
        const exclusions = polarPoles.map(p => `θ ≠ ${p.toFixed(2)}`).join(', ');
        domainStr = `{ θ ∈ ℝ | ${exclusions} }`;
      } else if (definedCount < pSteps * 0.95) {
        // Domain is restricted (e.g. sqrt(cos(theta)))
        const intervals: Array<{ start: number; end: number }> = [];
        let inInterval = false;
        let startVal = 0;
        for (let i = 0; i <= pSteps; i++) {
          const theta = pMin + i * pStep;
          const defined = !isNaN(evalPolar(theta));
          if (defined && !inInterval) {
            inInterval = true;
            startVal = theta;
          } else if (!defined && inInterval) {
            inInterval = false;
            intervals.push({ start: startVal, end: theta - pStep });
          }
        }
        if (inInterval) {
          intervals.push({ start: startVal, end: pMax });
        }
        if (intervals.length > 0) {
          domainStr = intervals.map(inter => `[${inter.start.toFixed(2)}, ${inter.end.toFixed(2)}]`).join(' ∪ ');
        }
      }

      // Range of r
      let rangeStr = 'r ∈ ℝ';
      const isInfiniteRange = maxR > 100 || minR < -100;
      if (isInfiniteRange) {
        if (minR > -10 && maxR > 100) {
          rangeStr = `r ∈ [${minR.toFixed(2)}, +∞)`;
        } else if (maxR < 10 && minR < -100) {
          rangeStr = `r ∈ (-∞, ${maxR.toFixed(2)}]`;
        } else {
          rangeStr = 'r ∈ ℝ';
        }
      } else {
        rangeStr = `r ∈ [${minR.toFixed(2)}, ${maxR.toFixed(2)}]`;
      }

      return { domain: domainStr, range: rangeStr };
    }

    if (conic && conic.isConic) {
      const center = conic.center || { x: 0, y: 0 };
      const h = center.x;
      const k = center.y;

      if (conic.type === 'circle') {
        const r = conic.radius || 1;
        return {
          domain: `[${(h - r).toFixed(2)}, ${(h + r).toFixed(2)}]`,
          range: `[${(k - r).toFixed(2)}, ${(k + r).toFixed(2)}]`
        };
      }

      if (conic.type === 'ellipse') {
        const a = conic.semiMajorAxis || 1;
        const b = conic.semiMinorAxis || 1;
        const isHorizontal = conic.typeName.toLowerCase().includes('horizontal');
        if (isHorizontal) {
          return {
            domain: `[${(h - a).toFixed(2)}, ${(h + a).toFixed(2)}]`,
            range: `[${(k - b).toFixed(2)}, ${(k + b).toFixed(2)}]`
          };
        } else {
          return {
            domain: `[${(h - b).toFixed(2)}, ${(h + b).toFixed(2)}]`,
            range: `[${(k - a).toFixed(2)}, ${(k + a).toFixed(2)}]`
          };
        }
      }

      if (conic.type === 'hyperbola') {
        const a = conic.semiMajorAxis || 1;
        const isHorizontal = conic.typeName.toLowerCase().includes('horizontal');
        if (isHorizontal) {
          return {
            domain: `(-∞, ${(h - a).toFixed(2)}] ∪ [${(h + a).toFixed(2)}, +∞)`,
            range: 'ℝ'
          };
        } else {
          return {
            domain: 'ℝ',
            range: `(-∞, ${(k - a).toFixed(2)}] ∪ [${(k + a).toFixed(2)}, +∞)`
          };
        }
      }

      if (conic.type === 'parabola') {
        const isVertical = conic.typeName.toLowerCase().includes('vertical');
        if (isVertical) {
          const isUp = conic.typeName.toLowerCase().includes('up');
          return {
            domain: 'ℝ',
            range: isUp ? `[${k.toFixed(2)}, +∞)` : `(-∞, ${k.toFixed(2)}]`
          };
        } else {
          const isRight = conic.typeName.toLowerCase().includes('right');
          return {
            domain: isRight ? `[${h.toFixed(2)}, +∞)` : `(-∞, ${h.toFixed(2)}]`,
            range: 'ℝ'
          };
        }
      }

      if (conic.type === 'point') {
        return {
          domain: `{ ${h.toFixed(2)} }`,
          range: `{ ${k.toFixed(2)} }`
        };
      }

      if (conic.type === 'lines') {
        return { domain: 'ℝ', range: 'ℝ' };
      }
    }

    if (!ast) return { domain: 'ℝ', range: 'ℝ' };

    // Check if both x and y are present (implicit non-function expression)
    const hasY = vars.has('y');
    const hasZ = vars.has('z');

    if (hasY || hasZ) {
      return {
        domain: 'Implicit Relation (Varies by branch)',
        range: 'Implicit Relation (Varies by branch)'
      };
    }

    // Explicit single-variable function f(x)
    let domainStr = 'ℝ';
    if (asymptotes.vertical.length > 0) {
      const poles = asymptotes.vertical.map(v => `x ≠ ${v.x.toFixed(2)}`).join(', ');
      domainStr = `{ x ∈ ℝ | ${poles} }`;
    }

    // High-density sampling to detect Domain and Range boundaries
    const samplePoints = 201;
    const xMin = -10;
    const xMax = 10;
    const step = (xMax - xMin) / (samplePoints - 1);
    
    let definedCount = 0;
    let minXDefined = Infinity;
    let maxXDefined = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    let definedFarLeft = false;
    let definedFarRight = false;

    try {
      const yFarLeft = evaluateAST(ast, { x: -100 });
      definedFarLeft = !isNaN(yFarLeft) && isFinite(yFarLeft);
    } catch (_) {}

    try {
      const yFarRight = evaluateAST(ast, { x: 100 });
      definedFarRight = !isNaN(yFarRight) && isFinite(yFarRight);
    } catch (_) {}

    for (let i = 0; i < samplePoints; i++) {
      const xVal = xMin + i * step;
      try {
        const yVal = evaluateAST(ast, { x: xVal });
        if (!isNaN(yVal) && isFinite(yVal)) {
          definedCount++;
          if (xVal < minXDefined) minXDefined = xVal;
          if (xVal > maxXDefined) maxXDefined = xVal;
          if (yVal < minY) minY = yVal;
          if (yVal > maxY) maxY = yVal;
        }
      } catch (_) {}
    }

    if (definedCount === 0) {
      return { domain: 'None / Complex', range: 'None' };
    }

    // Bounded domain refinement
    if (asymptotes.vertical.length === 0) {
      if (!definedFarLeft && !definedFarRight) {
        if (Math.abs(minXDefined - (-1)) < 0.25 && Math.abs(maxXDefined - 1) < 0.25) {
          domainStr = '[-1, 1]';
        } else {
          domainStr = `[${minXDefined.toFixed(2)}, ${maxXDefined.toFixed(2)}]`;
        }
      } else if (!definedFarLeft && definedFarRight) {
        if (Math.abs(minXDefined) < 0.25) {
          let isZeroDefined = false;
          try {
            const y0 = evaluateAST(ast, { x: 0 });
            isZeroDefined = !isNaN(y0) && isFinite(y0);
          } catch (_) {}
          domainStr = isZeroDefined ? '[0, +∞)' : '(0, +∞)';
        } else {
          domainStr = `[${minXDefined.toFixed(2)}, +∞)`;
        }
      } else if (definedFarLeft && !definedFarRight) {
        if (Math.abs(maxXDefined) < 0.25) {
          let isZeroDefined = false;
          try {
            const y0 = evaluateAST(ast, { x: 0 });
            isZeroDefined = !isNaN(y0) && isFinite(y0);
          } catch (_) {}
          domainStr = isZeroDefined ? '(-∞, 0]' : '(-∞, 0)';
        } else {
          domainStr = `(-∞, ${maxXDefined.toFixed(2)}]`;
        }
      }
    }

    // Range refinement
    let rangeStr = 'ℝ';
    let definedFarLeftY = NaN;
    let definedFarRightY = NaN;

    try {
      definedFarLeftY = evaluateAST(ast, { x: -1000 });
    } catch (_) {}
    try {
      definedFarRightY = evaluateAST(ast, { x: 1000 });
    } catch (_) {}

    const isLeftYFinite = !isNaN(definedFarLeftY) && isFinite(definedFarLeftY) && Math.abs(definedFarLeftY) < 1e5;
    const isRightYFinite = !isNaN(definedFarRightY) && isFinite(definedFarRightY) && Math.abs(definedFarRightY) < 1e5;

    if (Math.abs(minY - maxY) < 1e-4) {
      rangeStr = `{ ${minY.toFixed(2)} }`;
    } else if (isLeftYFinite && isRightYFinite) {
      if (Math.abs(minY - (-1)) < 0.05 && Math.abs(maxY - 1) < 0.05) {
        rangeStr = '[-1, 1]';
      } else {
        rangeStr = `[${minY.toFixed(2)}, ${maxY.toFixed(2)}]`;
      }
    } else if (!isLeftYFinite && isRightYFinite) {
      rangeStr = `[${minY.toFixed(2)}, +∞)`;
    } else {
      if (minY >= -0.1 && minY < 0.1) {
        rangeStr = '[0, +∞)';
      } else if (minY > 0.1 && minY < 10 && minY !== Infinity) {
        rangeStr = '[0, +∞) or (0, +∞)';
      } else if (minY !== Infinity && minY > -1e4 && maxY < 1e4) {
        rangeStr = `[${minY.toFixed(2)}, +∞)`;
      } else if (maxY !== -Infinity && maxY < 1e4 && minY < -1e4) {
        rangeStr = `(-∞, ${maxY.toFixed(2)}]`;
      }
    }

    return { domain: domainStr, range: rangeStr };
  }
}
