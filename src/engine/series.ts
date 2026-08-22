import { Parser } from './parser';
import { evaluateAST, ExpressionNode } from './ast';

export interface SeriesPreset {
  id: string;
  name: string;
  category: 'Taylor / Maclaurin' | 'Fourier' | 'Power Series' | 'Sequences';
  term: string;
  varName: string;
  from: number;
  defaultN: number;
  maxN: number;
  formulaLatex: string;
  description: string;
}

export const SERIES_PRESETS: SeriesPreset[] = [
  {
    id: 'exp',
    name: 'Exponential e^x',
    category: 'Taylor / Maclaurin',
    term: '(x^n) / (n!)',
    varName: 'n',
    from: 0,
    defaultN: 5,
    maxN: 20,
    formulaLatex: 'e^x = \\sum_{n=0}^N \\frac{x^n}{n!}',
    description: 'Maclaurin series expansion for exponential function e^x',
  },
  {
    id: 'sin',
    name: 'Sine sin(x)',
    category: 'Taylor / Maclaurin',
    term: '((-1)^n * x^(2*n + 1)) / ((2*n + 1)!)',
    varName: 'n',
    from: 0,
    defaultN: 4,
    maxN: 15,
    formulaLatex: '\\sin(x) = \\sum_{n=0}^N \\frac{(-1)^n x^{2n+1}}{(2n+1)!}',
    description: 'Alternating odd-power Taylor series for sine',
  },
  {
    id: 'cos',
    name: 'Cosine cos(x)',
    category: 'Taylor / Maclaurin',
    term: '((-1)^n * x^(2*n)) / ((2*n)!)',
    varName: 'n',
    from: 0,
    defaultN: 4,
    maxN: 15,
    formulaLatex: '\\cos(x) = \\sum_{n=0}^N \\frac{(-1)^n x^{2n}}{(2n)!}',
    description: 'Alternating even-power Taylor series for cosine',
  },
  {
    id: 'ln1p',
    name: 'Natural Log ln(1+x)',
    category: 'Taylor / Maclaurin',
    term: '((-1)^(n + 1) * x^n) / n',
    varName: 'n',
    from: 1,
    defaultN: 6,
    maxN: 30,
    formulaLatex: '\\ln(1+x) = \\sum_{n=1}^N \\frac{(-1)^{n+1} x^n}{n}',
    description: 'Mercator series for natural logarithm (valid |x| < 1)',
  },
  {
    id: 'geom',
    name: 'Geometric 1/(1-x)',
    category: 'Power Series',
    term: 'x^n',
    varName: 'n',
    from: 0,
    defaultN: 5,
    maxN: 25,
    formulaLatex: '\\frac{1}{1-x} = \\sum_{n=0}^N x^n',
    description: 'Infinite geometric series with ratio x',
  },
  {
    id: 'arctan',
    name: 'Arctangent arctan(x)',
    category: 'Taylor / Maclaurin',
    term: '((-1)^n * x^(2*n + 1)) / (2*n + 1)',
    varName: 'n',
    from: 0,
    defaultN: 6,
    maxN: 30,
    formulaLatex: '\\arctan(x) = \\sum_{n=0}^N \\frac{(-1)^n x^{2n+1}}{2n+1}',
    description: 'Gregory-Leibniz series for inverse tangent',
  },
  {
    id: 'fourier_square',
    name: 'Fourier Square Wave',
    category: 'Fourier',
    term: '(4 / pi) * (sin((2*n - 1) * x) / (2*n - 1))',
    varName: 'n',
    from: 1,
    defaultN: 5,
    maxN: 35,
    formulaLatex: 'f(x) = \\frac{4}{\\pi}\\sum_{n=1}^N \\frac{\\sin((2n-1)x)}{2n-1}',
    description: 'Harmonic reconstruction of a periodic square wave',
  },
  {
    id: 'fourier_sawtooth',
    name: 'Fourier Sawtooth Wave',
    category: 'Fourier',
    term: '(2 / pi) * (((-1)^(n + 1)) * sin(n * x) / n)',
    varName: 'n',
    from: 1,
    defaultN: 6,
    maxN: 35,
    formulaLatex: 'f(x) = \\frac{2}{\\pi}\\sum_{n=1}^N \\frac{(-1)^{n+1}\\sin(nx)}{n}',
    description: 'Fourier expansion for a periodic sawtooth ramp wave',
  },
  {
    id: 'fourier_triangle',
    name: 'Fourier Triangle Wave',
    category: 'Fourier',
    term: '(8 / (pi^2)) * (((-1)^n) * sin((2*n + 1) * x) / ((2*n + 1)^2))',
    varName: 'n',
    from: 0,
    defaultN: 4,
    maxN: 25,
    formulaLatex: 'f(x) = \\frac{8}{\\pi^2}\\sum_{n=0}^N \\frac{(-1)^n\\sin((2n+1)x)}{(2n+1)^2}',
    description: 'Rapidly converging triangle wave Fourier series',
  },
  {
    id: 'harmonic_seq',
    name: 'Harmonic Sequence 1/n',
    category: 'Sequences',
    term: '1 / n',
    varName: 'n',
    from: 1,
    defaultN: 15,
    maxN: 50,
    formulaLatex: 'a_n = \\frac{1}{n}, \\quad S_N = \\sum_{n=1}^N \\frac{1}{n}',
    description: 'Discrete harmonic sequence and partial harmonic sums',
  },
];

export class SeriesEvaluator {
  private astCache: Map<string, ExpressionNode> = new Map();

  private getAst(term: string): ExpressionNode {
    let ast = this.astCache.get(term);
    if (!ast) {
      ast = Parser.parse(term);
      this.astCache.set(term, ast);
    }
    return ast;
  }

  /**
   * Evaluates the partial sum S_N(x) = sum_{n=from}^to a_n(x)
   */
  public evaluatePartialSum(
    term: string,
    x: number,
    from: number,
    to: number,
    varName = 'n',
    context: Record<string, number> = {}
  ): number {
    try {
      const ast = this.getAst(term);
      let sum = 0;
      const startN = Math.max(0, Math.floor(from));
      const endN = Math.min(startN + 150, Math.floor(to)); // Safety cap to avoid infinite loops

      for (let n = startN; n <= endN; n++) {
        const evalCtx = { ...context, x, [varName]: n, n, t: x };
        const val = evaluateAST(ast, evalCtx);
        if (isNaN(val) || !isFinite(val)) {
          return NaN;
        }
        sum += val;
      }
      return sum;
    } catch {
      return NaN;
    }
  }

  /**
   * Computes discrete sequence terms a_n for n in [from, to]
   */
  public evaluateSequenceTerms(
    term: string,
    from: number,
    to: number,
    varName = 'n',
    context: Record<string, number> = {}
  ): { n: number; val: number; partialSum: number }[] {
    try {
      const ast = this.getAst(term);
      const startN = Math.max(0, Math.floor(from));
      const endN = Math.min(startN + 100, Math.floor(to));
      const results: { n: number; val: number; partialSum: number }[] = [];
      let runningSum = 0;

      for (let n = startN; n <= endN; n++) {
        const evalCtx = { ...context, [varName]: n, n, x: n };
        const val = evaluateAST(ast, evalCtx);
        if (!isNaN(val) && isFinite(val)) {
          runningSum += val;
          results.push({ n, val, partialSum: runningSum });
        }
      }
      return results;
    } catch {
      return [];
    }
  }
}

/**
 * Parses raw series input such as:
 * - "sum(((-1)^n * x^(2*n+1))/((2*n+1)!), n=0..5)"
 * - "sum(1/n^2, n=1..20)"
 * - "sum(x^n / n!, n=0 to 10)"
 * - "sum((x^n)/(n!))"
 * - or bare term "((-1)^n * x^(2*n+1))/((2*n+1)!)"
 */
export function parseSeriesExpression(
  rawInput: string,
  fallbackTerm?: string,
  fallbackFrom?: number,
  fallbackTo?: number,
  fallbackVar?: string
): { term: string; from: number; to: number; varName: string } {
  let term = fallbackTerm || '((-1)^n * x^(2*n+1))/((2*n+1)!)';
  let from = fallbackFrom ?? 0;
  let to = fallbackTo ?? 5;
  let varName = fallbackVar || 'n';

  if (!rawInput || !rawInput.trim()) {
    return { term, from, to, varName };
  }

  const s = rawInput.trim();

  // Check for sum(...) syntax
  const sumMatch = s.match(/^sum\s*\(\s*(.+?)\s*(?:,\s*([a-zA-Z])\s*=\s*(-?\d+)\s*(?:\.\.|\s+to\s+)\s*(\d+))?\s*\)$/i);
  if (sumMatch) {
    term = sumMatch[1].trim();
    if (sumMatch[2]) varName = sumMatch[2];
    if (sumMatch[3] !== undefined) from = parseInt(sumMatch[3], 10);
    if (sumMatch[4] !== undefined) to = parseInt(sumMatch[4], 10);
    return { term, from, to, varName };
  }

  // Check if rawInput is just a formula term
  if (s.startsWith('sum(') && s.endsWith(')')) {
    term = s.slice(4, -1).trim();
  } else {
    term = s;
  }

  return { term, from, to, varName };
}

export const globalSeriesEvaluator = new SeriesEvaluator();
