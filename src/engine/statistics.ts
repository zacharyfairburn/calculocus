// Mathematical & Statistical Engine for Calculocus
// Summary Statistics, 6 Non-linear Regressions, Combinatorics & Probability Distributions

export interface Point2D {
  x: number;
  y: number;
}

export interface OneVarStats {
  n: number;
  sum: number;
  sumSq: number;
  mean: number;
  varianceSample: number;
  variancePop: number;
  stdevSample: number;
  stdevPop: number;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  iqr: number;
  range: number;
  modes: number[];
}

export interface TwoVarStats {
  n: number;
  xStats: OneVarStats;
  yStats: OneVarStats;
  sumXY: number;
  covarianceSample: number;
  covariancePop: number;
  pearsonR: number;
  rSquared: number;
}

export interface RegressionResult {
  type: 'linear' | 'quadratic' | 'cubic' | 'exponential' | 'power' | 'sinusoidal';
  name: string;
  formula: string;
  latexFormula: string;
  rawExpression: string; // Ready for Parser.parse(rawExpression)
  parameters: Record<string, number>;
  rSquared: number;
  pearsonR?: number;
  rmse: number;
  evaluate: (x: number) => number;
  valid: boolean;
  errorMessage?: string;
}

// ----------------------------------------------------
// Combinatorics & Factorials
// ----------------------------------------------------

export function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) {
    res *= i;
    if (!isFinite(res)) return Infinity;
  }
  return res;
}

export function doubleFactorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n === 0 || n === 1) return 1;
  let res = 1;
  for (let i = n; i >= 2; i -= 2) {
    res *= i;
  }
  return res;
}

export function nPr(n: number, r: number): number {
  if (n < 0 || r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return 0;
  let res = 1;
  for (let i = 0; i < r; i++) {
    res *= n - i;
  }
  return res;
}

export function nCr(n: number, r: number): number {
  if (n < 0 || r < 0 || r > n || !Number.isInteger(n) || !Number.isInteger(r)) return 0;
  if (r === 0 || r === n) return 1;
  const k = Math.min(r, n - r);
  let num = 1;
  let den = 1;
  for (let i = 1; i <= k; i++) {
    num *= n - i + 1;
    den *= i;
  }
  return Math.round(num / den);
}

// ----------------------------------------------------
// Probability Distributions
// ----------------------------------------------------

// Error function approximation (Abramowitz and Stegun)
export function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);

  // Constants
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

export function normalPDF(x: number, mean = 0, std = 1): number {
  if (std <= 0) return NaN;
  const z = (x - mean) / std;
  return (1 / (std * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * z * z);
}

export function normalCDF(x: number, mean = 0, std = 1): number {
  if (std <= 0) return NaN;
  const z = (x - mean) / (std * Math.sqrt(2));
  return 0.5 * (1 + erf(z));
}

export function normalRangeCDF(a: number, b: number, mean = 0, std = 1): number {
  return normalCDF(b, mean, std) - normalCDF(a, mean, std);
}

export function binomialPDF(n: number, k: number, p: number): number {
  if (p < 0 || p > 1 || k < 0 || k > n || !Number.isInteger(n) || !Number.isInteger(k)) return 0;
  return nCr(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

export function binomialCDF(n: number, k: number, p: number): number {
  if (p < 0 || p > 1 || !Number.isInteger(n)) return 0;
  let sum = 0;
  const maxK = Math.min(n, Math.floor(k));
  for (let i = 0; i <= maxK; i++) {
    sum += binomialPDF(n, i, p);
  }
  return Math.min(1, Math.max(0, sum));
}

export function poissonPDF(k: number, lambda: number): number {
  if (lambda <= 0 || k < 0 || !Number.isInteger(k)) return 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export function poissonCDF(k: number, lambda: number): number {
  if (lambda <= 0 || k < 0) return 0;
  let sum = 0;
  const maxK = Math.floor(k);
  for (let i = 0; i <= maxK; i++) {
    sum += poissonPDF(i, lambda);
  }
  return Math.min(1, Math.max(0, sum));
}

export function geometricPDF(k: number, p: number): number {
  if (p <= 0 || p > 1 || k < 1 || !Number.isInteger(k)) return 0;
  return Math.pow(1 - p, k - 1) * p;
}

// ----------------------------------------------------
// Descriptive Statistics (1-Var & 2-Var)
// ----------------------------------------------------

export function compute1VarStats(rawValues: number[]): OneVarStats {
  const values = rawValues.filter((v) => !isNaN(v) && isFinite(v)).sort((a, b) => a - b);
  const n = values.length;

  if (n === 0) {
    return {
      n: 0,
      sum: 0,
      sumSq: 0,
      mean: 0,
      varianceSample: 0,
      variancePop: 0,
      stdevSample: 0,
      stdevPop: 0,
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      iqr: 0,
      range: 0,
      modes: [],
    };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  const sumSq = values.reduce((a, b) => a + b * b, 0);
  const mean = sum / n;

  const min = values[0];
  const max = values[n - 1];
  const range = max - min;

  // Percentiles & Quartiles
  const getPercentile = (p: number) => {
    if (n === 1) return values[0];
    const index = (n - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return values[lower] * (1 - weight) + values[upper] * weight;
  };

  const q1 = getPercentile(0.25);
  const median = getPercentile(0.5);
  const q3 = getPercentile(0.75);
  const iqr = q3 - q1;

  // Variances & Standard Deviations
  const ss = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  const variancePop = ss / n;
  const varianceSample = n > 1 ? ss / (n - 1) : 0;
  const stdevPop = Math.sqrt(variancePop);
  const stdevSample = Math.sqrt(varianceSample);

  // Mode Calculation
  const counts = new Map<number, number>();
  let maxCount = 0;
  for (const v of values) {
    const rounded = Math.round(v * 1e10) / 1e10;
    const count = (counts.get(rounded) || 0) + 1;
    counts.set(rounded, count);
    if (count > maxCount) {
      maxCount = count;
    }
  }

  const modes: number[] = [];
  if (maxCount > 1) {
    let allSame = true;
    for (const count of counts.values()) {
      if (count !== maxCount) {
        allSame = false;
        break;
      }
    }
    if (!(allSame && counts.size > 1)) {
      for (const [val, count] of counts.entries()) {
        if (count === maxCount) {
          modes.push(val);
        }
      }
    }
  }
  modes.sort((a, b) => a - b);

  return {
    n,
    sum,
    sumSq,
    mean,
    varianceSample,
    variancePop,
    stdevSample,
    stdevPop,
    min,
    q1,
    median,
    q3,
    max,
    iqr,
    range,
    modes,
  };
}

export function compute2VarStats(rawPoints: Point2D[]): TwoVarStats {
  const points = rawPoints.filter(
    (p) => !isNaN(p.x) && !isNaN(p.y) && isFinite(p.x) && isFinite(p.y)
  );
  const n = points.length;

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);

  const xStats = compute1VarStats(xs);
  const yStats = compute1VarStats(ys);

  if (n === 0) {
    return {
      n: 0,
      xStats,
      yStats,
      sumXY: 0,
      covarianceSample: 0,
      covariancePop: 0,
      pearsonR: 0,
      rSquared: 0,
    };
  }

  const sumXY = points.reduce((acc, p) => acc + p.x * p.y, 0);
  const meanX = xStats.mean;
  const meanY = yStats.mean;

  const covPop = points.reduce((acc, p) => acc + (p.x - meanX) * (p.y - meanY), 0) / n;
  const covSample = n > 1 ? (covPop * n) / (n - 1) : 0;

  let pearsonR = 0;
  if (xStats.stdevPop > 0 && yStats.stdevPop > 0) {
    pearsonR = covPop / (xStats.stdevPop * yStats.stdevPop);
    pearsonR = Math.max(-1, Math.min(1, pearsonR));
  }
  const rSquared = pearsonR * pearsonR;

  return {
    n,
    xStats,
    yStats,
    sumXY,
    covarianceSample: covSample,
    covariancePop: covPop,
    pearsonR,
    rSquared,
  };
}

// ----------------------------------------------------
// Linear Algebra Helper: Solve Linear System A * x = B via Gauss-Jordan
// ----------------------------------------------------
function solveLinearSystem(A: number[][], B: number[]): number[] | null {
  const n = B.length;
  // Augmented matrix
  const M: number[][] = A.map((row, i) => [...row, B[i]]);

  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    let maxVal = Math.abs(M[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(M[row][col]) > maxVal) {
        maxVal = Math.abs(M[row][col]);
        maxRow = row;
      }
    }

    if (maxVal < 1e-12) {
      return null; // Singular matrix
    }

    // Swap pivot row
    if (maxRow !== col) {
      const temp = M[col];
      M[col] = M[maxRow];
      M[maxRow] = temp;
    }

    // Normalize pivot row
    const pivot = M[col][col];
    for (let j = col; j <= n; j++) {
      M[col][j] /= pivot;
    }

    // Eliminate other rows
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = M[row][col];
        for (let j = col; j <= n; j++) {
          M[row][j] -= factor * M[col][j];
        }
      }
    }
  }

  return M.map((row) => row[n]);
}

// Format floating numbers cleanly
function fmt(num: number, digits = 4): string {
  if (isNaN(num)) return 'NaN';
  if (!isFinite(num)) return num > 0 ? 'Infinity' : '-Infinity';
  const str = num.toFixed(digits);
  return parseFloat(str).toString();
}

function computeMetrics(
  points: Point2D[],
  evalFn: (x: number) => number
): { rSquared: number; rmse: number } {
  if (points.length === 0) return { rSquared: 0, rmse: 0 };
  const ys = points.map((p) => p.y);
  const meanY = ys.reduce((a, b) => a + b, 0) / points.length;

  let ssTot = 0;
  let ssRes = 0;

  for (const p of points) {
    const yPred = evalFn(p.x);
    if (isNaN(yPred) || !isFinite(yPred)) {
      return { rSquared: 0, rmse: Infinity };
    }
    ssTot += (p.y - meanY) ** 2;
    ssRes += (p.y - yPred) ** 2;
  }

  const rSquared = ssTot > 1e-9 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;
  const rmse = Math.sqrt(ssRes / points.length);

  return { rSquared, rmse };
}

// ----------------------------------------------------
// Regression Algorithms
// ----------------------------------------------------

// 1. Linear Regression: y = a*x + b
export function fitLinearRegression(points: Point2D[]): RegressionResult {
  const valid = points.filter((p) => isFinite(p.x) && isFinite(p.y));
  if (valid.length < 2) {
    return {
      type: 'linear',
      name: 'Linear Regression',
      formula: 'y = a·x + b',
      latexFormula: 'y = ax + b',
      rawExpression: '0',
      parameters: { a: 0, b: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'At least 2 points required.',
    };
  }

  const n = valid.length;
  const sumX = valid.reduce((a, p) => a + p.x, 0);
  const sumY = valid.reduce((a, p) => a + p.y, 0);
  const sumX2 = valid.reduce((a, p) => a + p.x * p.x, 0);
  const sumXY = valid.reduce((a, p) => a + p.x * p.y, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 1e-12) {
    return {
      type: 'linear',
      name: 'Linear Regression',
      formula: 'y = a·x + b',
      latexFormula: 'y = ax + b',
      rawExpression: '0',
      parameters: { a: 0, b: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'All X values are identical (vertical line).',
    };
  }

  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  const evaluate = (x: number) => a * x + b;
  const { rSquared, rmse } = computeMetrics(valid, evaluate);
  const stats2 = compute2VarStats(valid);

  const bSign = b >= 0 ? `+ ${fmt(b)}` : `- ${fmt(Math.abs(b))}`;
  const rawExpression = `${a}*x + ${b}`;

  return {
    type: 'linear',
    name: 'Linear Regression',
    formula: `y = ${fmt(a)}x ${bSign}`,
    latexFormula: `y = ${fmt(a)}x ${bSign}`,
    rawExpression,
    parameters: { a, b, slope: a, intercept: b },
    rSquared,
    pearsonR: stats2.pearsonR,
    rmse,
    evaluate,
    valid: true,
  };
}

// 2. Quadratic Regression: y = a*x^2 + b*x + c
export function fitQuadraticRegression(points: Point2D[]): RegressionResult {
  const valid = points.filter((p) => isFinite(p.x) && isFinite(p.y));
  if (valid.length < 3) {
    return {
      type: 'quadratic',
      name: 'Quadratic Regression',
      formula: 'y = a·x² + b·x + c',
      latexFormula: 'y = ax^2 + bx + c',
      rawExpression: '0',
      parameters: { a: 0, b: 0, c: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'At least 3 points required.',
    };
  }

  const n = valid.length;
  let sumX = 0,
    sumX2 = 0,
    sumX3 = 0,
    sumX4 = 0;
  let sumY = 0,
    sumXY = 0,
    sumX2Y = 0;

  for (const p of valid) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    sumX += x;
    sumX2 += x2;
    sumX3 += x2 * x;
    sumX4 += x2 * x2;
    sumY += y;
    sumXY += x * y;
    sumX2Y += x2 * y;
  }

  const A = [
    [sumX4, sumX3, sumX2],
    [sumX3, sumX2, sumX],
    [sumX2, sumX, n],
  ];
  const B = [sumX2Y, sumXY, sumY];

  const sol = solveLinearSystem(A, B);
  if (!sol) {
    return {
      type: 'quadratic',
      name: 'Quadratic Regression',
      formula: 'y = a·x² + b·x + c',
      latexFormula: 'y = ax^2 + bx + c',
      rawExpression: '0',
      parameters: { a: 0, b: 0, c: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'Matrix system is singular.',
    };
  }

  const [a, b, c] = sol;
  const evaluate = (x: number) => a * x * x + b * x + c;
  const { rSquared, rmse } = computeMetrics(valid, evaluate);

  const bSign = b >= 0 ? `+ ${fmt(b)}` : `- ${fmt(Math.abs(b))}`;
  const cSign = c >= 0 ? `+ ${fmt(c)}` : `- ${fmt(Math.abs(c))}`;
  const rawExpression = `${a}*x^2 + ${b}*x + ${c}`;

  return {
    type: 'quadratic',
    name: 'Quadratic Regression',
    formula: `y = ${fmt(a)}x² ${bSign}x ${cSign}`,
    latexFormula: `y = ${fmt(a)}x^2 ${bSign}x ${cSign}`,
    rawExpression,
    parameters: { a, b, c },
    rSquared,
    rmse,
    evaluate,
    valid: true,
  };
}

// 3. Cubic Regression: y = a*x^3 + b*x^2 + c*x + d
export function fitCubicRegression(points: Point2D[]): RegressionResult {
  const valid = points.filter((p) => isFinite(p.x) && isFinite(p.y));
  if (valid.length < 4) {
    return {
      type: 'cubic',
      name: 'Cubic Regression',
      formula: 'y = a·x³ + b·x² + c·x + d',
      latexFormula: 'y = ax^3 + bx^2 + cx + d',
      rawExpression: '0',
      parameters: { a: 0, b: 0, c: 0, d: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'At least 4 points required.',
    };
  }

  const n = valid.length;
  let sX = 0,
    sX2 = 0,
    sX3 = 0,
    sX4 = 0,
    sX5 = 0,
    sX6 = 0;
  let sY = 0,
    sXY = 0,
    sX2Y = 0,
    sX3Y = 0;

  for (const p of valid) {
    const x = p.x;
    const y = p.y;
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x3 * x;
    const x5 = x4 * x;
    const x6 = x5 * x;

    sX += x;
    sX2 += x2;
    sX3 += x3;
    sX4 += x4;
    sX5 += x5;
    sX6 += x6;

    sY += y;
    sXY += x * y;
    sX2Y += x2 * y;
    sX3Y += x3 * y;
  }

  const A = [
    [sX6, sX5, sX4, sX3],
    [sX5, sX4, sX3, sX2],
    [sX4, sX3, sX2, sX],
    [sX3, sX2, sX, n],
  ];
  const B = [sX3Y, sX2Y, sXY, sY];

  const sol = solveLinearSystem(A, B);
  if (!sol) {
    return {
      type: 'cubic',
      name: 'Cubic Regression',
      formula: 'y = a·x³ + b·x² + c·x + d',
      latexFormula: 'y = ax^3 + bx^2 + cx + d',
      rawExpression: '0',
      parameters: { a: 0, b: 0, c: 0, d: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'Matrix system is singular.',
    };
  }

  const [a, b, c, d] = sol;
  const evaluate = (x: number) => a * x * x * x + b * x * x + c * x + d;
  const { rSquared, rmse } = computeMetrics(valid, evaluate);

  const bSign = b >= 0 ? `+ ${fmt(b)}` : `- ${fmt(Math.abs(b))}`;
  const cSign = c >= 0 ? `+ ${fmt(c)}` : `- ${fmt(Math.abs(c))}`;
  const dSign = d >= 0 ? `+ ${fmt(d)}` : `- ${fmt(Math.abs(d))}`;
  const rawExpression = `${a}*x^3 + ${b}*x^2 + ${c}*x + ${d}`;

  return {
    type: 'cubic',
    name: 'Cubic Regression',
    formula: `y = ${fmt(a)}x³ ${bSign}x² ${cSign}x ${dSign}`,
    latexFormula: `y = ${fmt(a)}x^3 ${bSign}x^2 ${cSign}x ${dSign}`,
    rawExpression,
    parameters: { a, b, c, d },
    rSquared,
    rmse,
    evaluate,
    valid: true,
  };
}

// 4. Exponential Regression: y = a * b^x (or y = a * e^(k*x))
export function fitExponentialRegression(points: Point2D[]): RegressionResult {
  const valid = points.filter((p) => isFinite(p.x) && isFinite(p.y) && p.y > 0);
  if (valid.length < 2) {
    return {
      type: 'exponential',
      name: 'Exponential Regression',
      formula: 'y = a·bˣ',
      latexFormula: 'y = a \\cdot b^x',
      rawExpression: '0',
      parameters: { a: 0, b: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'Requires at least 2 points with y > 0.',
    };
  }

  // Transform: ln(y) = ln(a) + x * ln(b)
  const transformed = valid.map((p) => ({ x: p.x, y: Math.log(p.y) }));
  const lin = fitLinearRegression(transformed);

  if (!lin.valid) {
    return {
      type: 'exponential',
      name: 'Exponential Regression',
      formula: 'y = a·bˣ',
      latexFormula: 'y = a \\cdot b^x',
      rawExpression: '0',
      parameters: { a: 0, b: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: lin.errorMessage,
    };
  }

  const lnA = lin.parameters.intercept;
  const lnB = lin.parameters.slope;

  const a = Math.exp(lnA);
  const b = Math.exp(lnB);

  const evaluate = (x: number) => a * Math.pow(b, x);
  const { rSquared, rmse } = computeMetrics(valid, evaluate);

  const rawExpression = `${a} * (${b})^x`;

  return {
    type: 'exponential',
    name: 'Exponential Regression',
    formula: `y = ${fmt(a)} · (${fmt(b)})ˣ`,
    latexFormula: `y = ${fmt(a)} \\cdot (${fmt(b)})^x`,
    rawExpression,
    parameters: { a, b, lnA, lnB },
    rSquared,
    rmse,
    evaluate,
    valid: true,
  };
}

// 5. Power Regression: y = a * x^b
export function fitPowerRegression(points: Point2D[]): RegressionResult {
  const valid = points.filter((p) => isFinite(p.x) && isFinite(p.y) && p.x > 0 && p.y > 0);
  if (valid.length < 2) {
    return {
      type: 'power',
      name: 'Power Regression',
      formula: 'y = a·xᵇ',
      latexFormula: 'y = a \\cdot x^b',
      rawExpression: '0',
      parameters: { a: 0, b: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'Requires at least 2 points with x > 0 and y > 0.',
    };
  }

  // Transform: ln(y) = ln(a) + b * ln(x)
  const transformed = valid.map((p) => ({ x: Math.log(p.x), y: Math.log(p.y) }));
  const lin = fitLinearRegression(transformed);

  if (!lin.valid) {
    return {
      type: 'power',
      name: 'Power Regression',
      formula: 'y = a·xᵇ',
      latexFormula: 'y = a \\cdot x^b',
      rawExpression: '0',
      parameters: { a: 0, b: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: lin.errorMessage,
    };
  }

  const lnA = lin.parameters.intercept;
  const b = lin.parameters.slope;
  const a = Math.exp(lnA);

  const evaluate = (x: number) => (x > 0 ? a * Math.pow(x, b) : NaN);
  const { rSquared, rmse } = computeMetrics(valid, evaluate);

  const rawExpression = `${a} * (x)^(${b})`;

  return {
    type: 'power',
    name: 'Power Regression',
    formula: `y = ${fmt(a)} · x^(${fmt(b)})`,
    latexFormula: `y = ${fmt(a)} \\cdot x^{${fmt(b)}}`,
    rawExpression,
    parameters: { a, b },
    rSquared,
    rmse,
    evaluate,
    valid: true,
  };
}

// 6. Sinusoidal Regression: y = a * sin(b * x + c) + d
export function fitSinusoidalRegression(points: Point2D[]): RegressionResult {
  const valid = points
    .filter((p) => isFinite(p.x) && isFinite(p.y))
    .sort((p1, p2) => p1.x - p2.x);

  if (valid.length < 4) {
    return {
      type: 'sinusoidal',
      name: 'Sinusoidal Regression',
      formula: 'y = a·sin(b·x + c) + d',
      latexFormula: 'y = a\\sin(bx + c) + d',
      rawExpression: '0',
      parameters: { a: 0, b: 0, c: 0, d: 0 },
      rSquared: 0,
      rmse: 0,
      evaluate: () => 0,
      valid: false,
      errorMessage: 'At least 4 points required.',
    };
  }

  const ys = valid.map((p) => p.y);
  const xs = valid.map((p) => p.x);

  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);

  // Initial estimations
  let aEst = (maxY - minY) / 2;
  if (aEst < 1e-6) aEst = 1;
  const dEst = (maxY + minY) / 2;

  // Approximate period via peak-trough distance or x-span
  const xSpan = maxX - minX;
  // Estimate fundamental frequency b from approximate cycle
  let bEst = (2 * Math.PI) / (xSpan > 0 ? xSpan : 1);

  // Grid search fine-tuning over a, b, c, d parameter space
  let bestA = aEst;
  let bestB = bEst;
  let bestC = 0;
  let bestD = dEst;
  let bestError = Infinity;

  const bCandidates = [bEst * 0.5, bEst, bEst * 1.5, bEst * 2, bEst * 3, 1, 2, Math.PI];
  const cCandidates = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -Math.PI / 2];

  for (const bTry of bCandidates) {
    for (const cTry of cCandidates) {
      let err = 0;
      for (const p of valid) {
        const pred = aEst * Math.sin(bTry * p.x + cTry) + dEst;
        err += (p.y - pred) ** 2;
      }
      if (err < bestError) {
        bestError = err;
        bestB = bTry;
        bestC = cTry;
      }
    }
  }

  // Refine with gradient step iteration
  let curA = bestA;
  let curB = bestB;
  let curC = bestC;
  let curD = bestD;
  const lr = 0.001;

  for (let iter = 0; iter < 120; iter++) {
    let gradA = 0;
    let gradB = 0;
    let gradC = 0;
    let gradD = 0;

    for (const p of valid) {
      const angle = curB * p.x + curC;
      const s = Math.sin(angle);
      const c = Math.cos(angle);
      const diff = curA * s + curD - p.y;

      gradA += 2 * diff * s;
      gradB += 2 * diff * curA * c * p.x;
      gradC += 2 * diff * curA * c;
      gradD += 2 * diff;
    }

    curA -= (lr * gradA) / valid.length;
    curB -= (lr * gradB) / valid.length;
    curC -= (lr * gradC) / valid.length;
    curD -= (lr * gradD) / valid.length;
  }

  const evaluate = (x: number) => curA * Math.sin(curB * x + curC) + curD;
  const { rSquared, rmse } = computeMetrics(valid, evaluate);

  const cSign = curC >= 0 ? `+ ${fmt(curC)}` : `- ${fmt(Math.abs(curC))}`;
  const dSign = curD >= 0 ? `+ ${fmt(curD)}` : `- ${fmt(Math.abs(curD))}`;
  const rawExpression = `${curA} * sin(${curB}*x + ${curC}) + ${curD}`;

  return {
    type: 'sinusoidal',
    name: 'Sinusoidal Regression',
    formula: `y = ${fmt(curA)}·sin(${fmt(curB)}x ${cSign}) ${dSign}`,
    latexFormula: `y = ${fmt(curA)}\\sin(${fmt(curB)}x ${cSign}) ${dSign}`,
    rawExpression,
    parameters: { a: curA, b: curB, c: curC, d: curD },
    rSquared,
    rmse,
    evaluate,
    valid: true,
  };
}
