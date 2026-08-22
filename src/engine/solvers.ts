import { ExpressionNode, evaluateAST } from './ast';
import { SymbolicDifferentiator } from './differentiator';
import { SymbolicIntegrator } from './integrator';
import { CriticalPoint } from '../types';

export class NumericalSolvers {
  public static newtonRaphson(
    expr: ExpressionNode,
    deriv: ExpressionNode,
    initialGuess: number,
    maxIter = 60,
    tol = 1e-10,
    v = 'x'
  ): number | null {
    let x = initialGuess;
    for (let i = 0; i < maxIter; i++) {
      const fx = evaluateAST(expr, { [v]: x });
      const fPrimeX = evaluateAST(deriv, { [v]: x });

      if (Math.abs(fPrimeX) < 1e-14 || isNaN(fPrimeX)) return null;
      const xNext = x - fx / fPrimeX;

      if (Math.abs(xNext - x) < tol) {
        return xNext;
      }
      x = xNext;
    }
    return null;
  }

  public static brentDekker(
    f: (x: number) => number,
    bracketA: number,
    bracketB: number,
    tol = 1e-9,
    maxIter = 100
  ): number | null {
    let a = bracketA;
    let b = bracketB;
    let fa = f(a);
    let fb = f(b);

    if (fa * fb > 0) return null;

    if (Math.abs(fa) < Math.abs(fb)) {
      [a, b] = [b, a];
      [fa, fb] = [fb, fa];
    }

    let c = a;
    let fc = fa;
    let mflag = true;
    let s = b;
    let fs = fb;
    let d = 0;

    for (let i = 0; i < maxIter; i++) {
      if (Math.abs(b - a) < tol || fb === 0) {
        return b;
      }

      if (fa !== fc && fb !== fc) {
        // Inverse quadratic interpolation
        s =
          (a * fb * fc) / ((fa - fb) * (fa - fc)) +
          (b * fa * fc) / ((fb - fa) * (fb - fc)) +
          (c * fa * fb) / ((fc - fa) * (fc - fb));
      } else {
        // Secant method
        s = b - fb * ((b - a) / (fb - fa));
      }

      const cond1 = (s < (3 * a + b) / 4 && s > b) || (s > (3 * a + b) / 4 && s < b);
      const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
      const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
      const cond4 = mflag && Math.abs(b - c) < tol;
      const cond5 = !mflag && Math.abs(c - d) < tol;

      if (cond1 || cond2 || cond3 || cond4 || cond5) {
        s = (a + b) / 2;
        mflag = true;
      } else {
        mflag = false;
      }

      fs = f(s);
      d = c;
      c = b;
      fc = fb;

      if (fa * fs < 0) {
        b = s;
        fb = fs;
      } else {
        a = s;
        fa = fs;
      }

      if (Math.abs(fa) < Math.abs(fb)) {
        [a, b] = [b, a];
        [fa, fb] = [fb, fa];
      }
    }

    return b;
  }

  public static findCriticalPoints(
    expr: ExpressionNode,
    xMin: number,
    xMax: number,
    samples = 150
  ): CriticalPoint[] {
    const points: CriticalPoint[] = [];
    const fPrime = SymbolicDifferentiator.diff(expr, 'x');
    const fDoublePrime = SymbolicDifferentiator.diff(fPrime, 'x');

    const f = (x: number) => evaluateAST(expr, { x });
    const f1 = (x: number) => evaluateAST(fPrime, { x });
    const f2 = (x: number) => evaluateAST(fDoublePrime, { x });

    // 1. Y-Intercept
    const y0 = f(0);
    if (!isNaN(y0) && isFinite(y0)) {
      points.push({
        x: 0,
        y: y0,
        type: 'y-intercept',
        label: `Y-Int: (0, ${y0.toFixed(2)})`,
      });
    }

    const step = (xMax - xMin) / samples;
    let prevX = xMin;
    let prevY = f(prevX);
    let prevF1 = f1(prevX);
    let prevF2 = f2(prevX);

    const foundRoots = new Set<string>();
    const foundExtrema = new Set<string>();

    for (let i = 1; i <= samples; i++) {
      const curX = xMin + i * step;
      const curY = f(curX);
      const curF1 = f1(curX);
      const curF2 = f2(curX);

      // Root detection
      if (prevY * curY <= 0 && !isNaN(prevY) && !isNaN(curY)) {
        const rootX = NumericalSolvers.brentDekker(f, prevX, curX);
        if (rootX !== null && isFinite(rootX)) {
          const key = rootX.toFixed(3);
          if (!foundRoots.has(key)) {
            foundRoots.add(key);
            points.push({
              x: rootX,
              y: 0,
              type: 'zero',
              label: `Root: x = ${rootX.toFixed(3)}`,
            });
          }
        }
      }

      // Extrema detection (f' sign change)
      if (prevF1 * curF1 <= 0 && !isNaN(prevF1) && !isNaN(curF1)) {
        if (Math.abs(prevF1) > 1e-9 || Math.abs(curF1) > 1e-9) {
          const extX = NumericalSolvers.brentDekker(f1, prevX, curX);
          if (extX !== null && isFinite(extX)) {
            // Verify that f1 actually changes sign across this point (true local max/min)
            const delta = Math.min(step * 0.1, 1e-4);
            const f1Left = f1(extX - delta);
            const f1Right = f1(extX + delta);
            if (!isNaN(f1Left) && !isNaN(f1Right) && f1Left * f1Right < 0) {
              const extY = f(extX);
              const curv = f2(extX);
              const pType = curv > 0 ? 'min' : 'max';
              const key = `${extX.toFixed(2)},${extY.toFixed(2)}`;
              if (!foundExtrema.has(key)) {
                foundExtrema.add(key);
                points.push({
                  x: extX,
                  y: extY,
                  type: pType,
                  label: `${pType === 'min' ? 'Local Min' : 'Local Max'}: (${extX.toFixed(2)}, ${extY.toFixed(2)})`,
                });
              }
            }
          }
        }
      }

      // Inflection points (f'' sign change)
      if (prevF2 * curF2 <= 0 && !isNaN(prevF2) && !isNaN(curF2)) {
        // Ensure second derivative is not identically zero on this subinterval (e.g. for straight lines)
        if (Math.abs(prevF2) > 1e-9 || Math.abs(curF2) > 1e-9) {
          const inflX = NumericalSolvers.brentDekker(f2, prevX, curX);
          if (inflX !== null && isFinite(inflX)) {
            // Verify that f2 actually changes sign across this point (concavity change)
            const delta = Math.min(step * 0.1, 1e-4);
            const f2Left = f2(inflX - delta);
            const f2Right = f2(inflX + delta);
            if (!isNaN(f2Left) && !isNaN(f2Right) && f2Left * f2Right < 0) {
              const inflY = f(inflX);
              const key = inflX.toFixed(3);
              if (!foundRoots.has('inf_' + key)) {
                foundRoots.add('inf_' + key);
                points.push({
                  x: inflX,
                  y: inflY,
                  type: 'inflection',
                  label: `Inflection: (${inflX.toFixed(2)}, ${inflY.toFixed(2)})`,
                });
              }
            }
          }
        }
      }

      prevX = curX;
      prevY = curY;
      prevF1 = curF1;
      prevF2 = curF2;
    }

    return points;
  }

  // Intersections between two functions f1(x) and f2(x)
  public static findIntersections(
    expr1: ExpressionNode,
    expr2: ExpressionNode,
    xMin: number,
    xMax: number,
    samples = 150
  ): Array<{ x: number; y: number; label: string }> {
    const diffFn = (x: number) => {
      const y1 = evaluateAST(expr1, { x });
      const y2 = evaluateAST(expr2, { x });
      return y1 - y2;
    };

    const intersections: Array<{ x: number; y: number; label: string }> = [];
    const step = (xMax - xMin) / samples;
    let prevX = xMin;
    let prevVal = diffFn(prevX);
    const seen = new Set<string>();

    for (let i = 1; i <= samples; i++) {
      const curX = xMin + i * step;
      const curVal = diffFn(curX);

      if (prevVal * curVal <= 0 && !isNaN(prevVal) && !isNaN(curVal)) {
        const rootX = NumericalSolvers.brentDekker(diffFn, prevX, curX);
        if (rootX !== null && isFinite(rootX)) {
          const y = evaluateAST(expr1, { x: rootX });
          const key = `${rootX.toFixed(2)},${y.toFixed(2)}`;
          if (!seen.has(key)) {
            seen.add(key);
            intersections.push({
              x: rootX,
              y,
              label: `Intersect: (${rootX.toFixed(2)}, ${y.toFixed(2)})`,
            });
          }
        }
      }
      prevX = curX;
      prevVal = curVal;
    }

    return intersections;
  }

  // Riemann Sum computation
  public static computeRiemannSum(
    expr: ExpressionNode,
    a: number,
    b: number,
    n: number,
    method: 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson'
  ): { value: number; rectangles: Array<{ x: number; width: number; height: number; y: number }> } {
    const dx = (b - a) / n;
    const f = (x: number) => {
      const val = evaluateAST(expr, { x });
      return isNaN(val) || !isFinite(val) ? 0 : val;
    };

    let sum = 0;
    const rectangles: Array<{ x: number; width: number; height: number; y: number }> = [];

    for (let i = 0; i < n; i++) {
      const xLeft = a + i * dx;
      const xRight = a + (i + 1) * dx;
      let sampleX = xLeft;

      if (method === 'left') {
        sampleX = xLeft;
        const h = f(sampleX);
        sum += h * dx;
        rectangles.push({ x: xLeft, width: dx, height: h, y: h });
      } else if (method === 'right') {
        sampleX = xRight;
        const h = f(sampleX);
        sum += h * dx;
        rectangles.push({ x: xLeft, width: dx, height: h, y: h });
      } else if (method === 'midpoint') {
        sampleX = (xLeft + xRight) / 2;
        const h = f(sampleX);
        sum += h * dx;
        rectangles.push({ x: xLeft, width: dx, height: h, y: h });
      } else if (method === 'trapezoid') {
        const yL = f(xLeft);
        const yR = f(xRight);
        sum += 0.5 * (yL + yR) * dx;
        rectangles.push({ x: xLeft, width: dx, height: (yL + yR) / 2, y: yL });
      }
    }

    if (method === 'simpson') {
      sum = SymbolicIntegrator.adaptiveSimpson(expr, a, b);
    }

    return { value: sum, rectangles };
  }

  // Arc Length calculation: L = ∫ √(1 + (f'(x))^2) dx
  public static computeArcLength(
    expr: ExpressionNode,
    a: number,
    b: number,
    samples = 100
  ): number {
    const fPrime = SymbolicDifferentiator.diff(expr, 'x');
    const integrand = (x: number) => {
      const dy = evaluateAST(fPrime, { x });
      return Math.sqrt(1 + dy * dy);
    };

    // Composite Simpson's 1/3
    const n = samples % 2 === 0 ? samples : samples + 1;
    const h = (b - a) / n;
    let sum = integrand(a) + integrand(b);

    for (let i = 1; i < n; i++) {
      const x = a + i * h;
      sum += (i % 2 === 0 ? 2 : 4) * integrand(x);
    }

    return (h / 3) * sum;
  }
}

