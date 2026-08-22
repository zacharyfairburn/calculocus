import { ExpressionNode, evaluateAST, registerComplexEvaluator } from './ast';
import { Parser } from './parser';

export class Complex {
  readonly re: number;
  readonly im: number;

  constructor(re: number, im = 0) {
    this.re = re;
    this.im = im;
  }

  static fromPolar(r: number, theta: number): Complex {
    return new Complex(r * Math.cos(theta), r * Math.sin(theta));
  }

  add(other: Complex): Complex {
    return new Complex(this.re + other.re, this.im + other.im);
  }

  sub(other: Complex): Complex {
    return new Complex(this.re - other.re, this.im - other.im);
  }

  mul(other: Complex): Complex {
    return new Complex(
      this.re * other.re - this.im * other.im,
      this.re * other.im + this.im * other.re
    );
  }

  div(other: Complex): Complex {
    const denom = other.re * other.re + other.im * other.im;
    if (denom === 0) {
      return new Complex(NaN, NaN);
    }
    return new Complex(
      (this.re * other.re + this.im * other.im) / denom,
      (this.im * other.re - this.re * other.im) / denom
    );
  }

  neg(): Complex {
    return new Complex(-this.re, -this.im);
  }

  conj(): Complex {
    return new Complex(this.re, -this.im);
  }

  abs(): number {
    return Math.hypot(this.re, this.im);
  }

  arg(): number {
    return Math.atan2(this.im, this.re);
  }

  exp(): Complex {
    const expRe = Math.exp(this.re);
    return new Complex(expRe * Math.cos(this.im), expRe * Math.sin(this.im));
  }

  ln(): Complex {
    return new Complex(Math.log(this.abs()), this.arg());
  }

  sqrt(): Complex {
    const r = this.abs();
    if (r === 0) return new Complex(0, 0);
    const realPart = Math.sqrt((r + this.re) / 2);
    const imagPart = Math.sign(this.im || 1) * Math.sqrt((r - this.re) / 2);
    return new Complex(realPart, imagPart);
  }

  sin(): Complex {
    return new Complex(
      Math.sin(this.re) * Math.cosh(this.im),
      Math.cos(this.re) * Math.sinh(this.im)
    );
  }

  cos(): Complex {
    return new Complex(
      Math.cos(this.re) * Math.cosh(this.im),
      -Math.sin(this.re) * Math.sinh(this.im)
    );
  }

  tan(): Complex {
    const s = this.sin();
    const c = this.cos();
    return s.div(c);
  }

  sinh(): Complex {
    return new Complex(
      Math.sinh(this.re) * Math.cos(this.im),
      Math.cosh(this.re) * Math.sin(this.im)
    );
  }

  cosh(): Complex {
    return new Complex(
      Math.cosh(this.re) * Math.cos(this.im),
      Math.sinh(this.re) * Math.sin(this.im)
    );
  }

  tanh(): Complex {
    const sh = this.sinh();
    const ch = this.cosh();
    return sh.div(ch);
  }

  pow(exponent: Complex): Complex {
    if (this.re === 0 && this.im === 0) {
      if (exponent.re === 0 && exponent.im === 0) {
        return new Complex(1, 0);
      }
      return new Complex(0, 0);
    }
    // z^w = exp(w * ln(z))
    return exponent.mul(this.ln()).exp();
  }

  isFinite(): boolean {
    return (
      !isNaN(this.re) &&
      isFinite(this.re) &&
      !isNaN(this.im) &&
      isFinite(this.im)
    );
  }

  toString(precision = 3): string {
    if (!this.isFinite()) return 'NaN';
    const reStr = this.re.toFixed(precision);
    const imStr = Math.abs(this.im).toFixed(precision);
    const reNum = parseFloat(reStr);
    const imNum = parseFloat(imStr);

    if (imNum === 0) return `${reNum}`;
    if (reNum === 0) {
      if (this.im < 0) return `-${imNum === 1 ? '' : imNum}i`;
      return `${imNum === 1 ? '' : imNum}i`;
    }
    const op = this.im < 0 ? '-' : '+';
    return `${reNum} ${op} ${imNum === 1 ? '' : imNum}i`;
  }
}

/**
 * Preprocesses angle notation like "5 ∠ (pi/6)" into "(5) * exp(i * (pi/6))"
 */
export function preprocessAngleNotation(input: string): string {
  let str = input;
  // Replace the ∠ sign and angle notation
  while (str.includes('∠')) {
    const idx = str.indexOf('∠');

    // Find left operand boundary
    let leftStart = idx - 1;
    let parenLevel = 0;
    while (leftStart >= 0) {
      const char = str[leftStart];
      if (char === ')') parenLevel++;
      else if (char === '(') parenLevel--;

      if (parenLevel === 0) {
        if (['+', '-', '=', '<', '>', ',', ';'].includes(char)) {
          leftStart++;
          break;
        }
      }
      leftStart--;
    }
    if (leftStart < 0) leftStart = 0;

    // Find right operand boundary
    let rightEnd = idx + 1;
    parenLevel = 0;
    while (rightEnd < str.length) {
      const char = str[rightEnd];
      if (char === '(') parenLevel++;
      else if (char === ')') parenLevel--;

      if (parenLevel === 0) {
        if (['+', '-', '=', '<', '>', ',', ';'].includes(char)) {
          break;
        }
      }
      rightEnd++;
    }

    const leftExpr = str.substring(leftStart, idx).trim();
    const rightExpr = str.substring(idx + 1, rightEnd).trim();

    // Rewrite A ∠ B as (A) * exp(i * (B))
    const replacement = `(${leftExpr || '1'}) * exp(i * (${rightExpr}))`;
    str = str.substring(0, leftStart) + replacement + str.substring(rightEnd);
  }
  return str;
}

/**
 * Evaluates an AST node with complex values
 */
export function evaluateComplexAST(
  node: ExpressionNode,
  ctx: Record<string, Complex>
): Complex {
  switch (node.type) {
    case 'number':
      return new Complex(node.value, 0);
    case 'variable':
      if (node.name === 'i') {
        return new Complex(0, 1);
      }
      if (ctx[node.name] !== undefined) {
        const val = ctx[node.name];
        if (val instanceof Complex) return val;
        if (typeof val === 'number') return new Complex(val, 0);
      }
      // If it is another variable, treat as 0 or check if it matches in real numbers
      return new Complex(0, 0);
    case 'constant':
      if (node.name === 'pi') return new Complex(Math.PI, 0);
      if (node.name === 'e') return new Complex(Math.E, 0);
      if (node.name === 'phi') return new Complex(1.618033988749895, 0);
      return new Complex(0, 0);
    case 'add':
      return evaluateComplexAST(node.lhs, ctx).add(
        evaluateComplexAST(node.rhs, ctx)
      );
    case 'subtract':
      return evaluateComplexAST(node.lhs, ctx).sub(
        evaluateComplexAST(node.rhs, ctx)
      );
    case 'multiply':
      return evaluateComplexAST(node.lhs, ctx).mul(
        evaluateComplexAST(node.rhs, ctx)
      );
    case 'divide':
      return evaluateComplexAST(node.lhs, ctx).div(
        evaluateComplexAST(node.rhs, ctx)
      );
    case 'negate':
      return evaluateComplexAST(node.expr, ctx).neg();
    case 'power':
      return evaluateComplexAST(node.base, ctx).pow(
        evaluateComplexAST(node.exponent, ctx)
      );
    case 'factorial':
      return complexFactorial(evaluateComplexAST(node.expr, ctx));
    case 'modulo': {
      const lhs = evaluateComplexAST(node.lhs, ctx);
      const rhs = evaluateComplexAST(node.rhs, ctx);
      return new Complex(lhs.re % rhs.re, 0);
    }
    case 'equation':
    case 'inequality': {
      const lhs = evaluateComplexAST(node.lhs, ctx);
      const rhs = evaluateComplexAST(node.rhs, ctx);
      return lhs.sub(rhs);
    }
    case 'call': {
      const args = node.args.map((arg) => evaluateComplexAST(arg, ctx));
      if (args.length === 0) return new Complex(0);
      const arg = args[0];
      switch (node.name) {
        case 'sin':
          return arg.sin();
        case 'cos':
          return arg.cos();
        case 'tan':
          return arg.tan();
        case 'exp':
          return arg.exp();
        case 'sqrt':
          return arg.sqrt();
        case 'ln':
          return arg.ln();
        case 'log':
          return arg.ln();
        case 'log10':
          return arg.ln().div(new Complex(Math.LN10));
        case 'log2':
          return arg.ln().div(new Complex(Math.LN2));
        case 'abs':
          return new Complex(arg.abs(), 0);
        case 'sinh':
          return arg.sinh();
        case 'cosh':
          return arg.cosh();
        case 'tanh':
          return arg.tanh();
        case 'sgn':
        case 'sign': {
          const m = arg.abs();
          return m === 0 ? new Complex(0) : arg.div(new Complex(m));
        }
        case 'conj':
          return arg.conj();
        case 're':
          return new Complex(arg.re, 0);
        case 'im':
          return new Complex(arg.im, 0);
        case 'arg':
          return new Complex(arg.arg(), 0);
        default:
          return arg;
      }
    }
    default:
      return new Complex(0, 0);
  }
}

export function complexGamma(z: Complex): Complex {
  // If z is a negative integer, Gamma is infinite/NaN
  if (z.im === 0 && z.re <= 0 && Number.isInteger(z.re)) {
    return new Complex(NaN, NaN);
  }
  
  // Reflection formula for Re(z) < 0.5
  if (z.re < 0.5) {
    const piZ = z.mul(new Complex(Math.PI, 0));
    const sinPiZ = piZ.sin();
    const oneMinusZ = new Complex(1, 0).sub(z);
    const g = complexGamma(oneMinusZ);
    return new Complex(Math.PI, 0).div(sinPiZ.mul(g));
  }

  // Lanczos approximation parameters (g=7, n=9)
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.5073811400933,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];

  const g = 6.07715;
  let x = new Complex(p[0], 0);
  const zMinusOne = z.sub(new Complex(1, 0));
  for (let i = 1; i < p.length; i++) {
    x = x.add(new Complex(p[i], 0).div(zMinusOne.add(new Complex(i, 0))));
  }

  const t = zMinusOne.add(new Complex(g + 0.5, 0));
  const sqrt2Pi = Math.sqrt(2 * Math.PI);
  const term1 = new Complex(sqrt2Pi, 0);
  const term2 = t.pow(zMinusOne.add(new Complex(0.5, 0)));
  const term3 = t.neg().exp();

  return term1.mul(term2).mul(term3).mul(x);
}

export function complexFactorial(z: Complex): Complex {
  // If z is a non-negative integer, let's use exact integer factorial for precision and speed
  if (Math.abs(z.im) < 1e-10 && z.re >= 0 && Math.abs(z.re - Math.round(z.re)) < 1e-10) {
    const n = Math.round(z.re);
    if (n > 170) return new Complex(Infinity, 0);
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return new Complex(res, 0);
  }
  // z! = Gamma(z + 1)
  return complexGamma(z.add(new Complex(1, 0)));
}

/**
 * Parses and evaluates a complex expression string
 */
export function parseAndEvaluateComplex(
  exprStr: string,
  variables: Record<string, number | Complex> = {}
): Complex {
  try {
    const preprocessed = preprocessAngleNotation(exprStr);
    const ast = Parser.parse(preprocessed);

    // Build the evaluation context
    const ctx: Record<string, Complex> = {};
    for (const [key, val] of Object.entries(variables)) {
      if (val instanceof Complex) {
        ctx[key] = val;
      } else {
        ctx[key] = new Complex(val, 0);
      }
    }

    return evaluateComplexAST(ast, ctx);
  } catch (e) {
    return new Complex(NaN, NaN);
  }
}

// Register complex fallback evaluator for real math engine
registerComplexEvaluator((node, ctx) => {
  const complexCtx: Record<string, Complex> = {};
  for (const [key, val] of Object.entries(ctx)) {
    complexCtx[key] = new Complex(val, 0);
  }
  return evaluateComplexAST(node, complexCtx);
});
