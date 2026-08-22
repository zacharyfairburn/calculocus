import { MathFunctionName } from './tokens';

export type ExpressionNode =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'constant'; name: 'pi' | 'e' | 'phi' }
  | { type: 'add'; lhs: ExpressionNode; rhs: ExpressionNode }
  | { type: 'subtract'; lhs: ExpressionNode; rhs: ExpressionNode }
  | { type: 'multiply'; lhs: ExpressionNode; rhs: ExpressionNode }
  | { type: 'divide'; lhs: ExpressionNode; rhs: ExpressionNode }
  | { type: 'modulo'; lhs: ExpressionNode; rhs: ExpressionNode }
  | { type: 'power'; base: ExpressionNode; exponent: ExpressionNode }
  | { type: 'negate'; expr: ExpressionNode }
  | { type: 'factorial'; expr: ExpressionNode }
  | { type: 'call'; name: MathFunctionName; args: ExpressionNode[] }
  | { type: 'equation'; lhs: ExpressionNode; rhs: ExpressionNode }
  | { type: 'inequality'; lhs: ExpressionNode; op: '<' | '<=' | '>' | '>='; rhs: ExpressionNode };

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a;
}

function lcm(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return Math.abs(Math.round(a * b)) / gcd(a, b);
}

function factorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function nCr(n: number, r: number): number {
  n = Math.round(n);
  r = Math.round(r);
  if (r < 0 || r > n) return 0;
  return Math.round(factorial(n) / (factorial(r) * factorial(n - r)));
}

function nPr(n: number, r: number): number {
  n = Math.round(n);
  r = Math.round(r);
  if (r < 0 || r > n) return 0;
  return Math.round(factorial(n) / factorial(n - r));
}

let complexEvaluator: ((node: ExpressionNode, ctx: Record<string, number>) => { re: number; im: number }) | null = null;

export function registerComplexEvaluator(evaluator: typeof complexEvaluator) {
  complexEvaluator = evaluator;
}

export function hasImaginaryUnit(node: ExpressionNode | null): boolean {
  if (!node) return false;
  switch (node.type) {
    case 'number':
    case 'constant':
      return false;
    case 'variable':
      return node.name === 'i';
    case 'negate':
    case 'factorial':
      return hasImaginaryUnit(node.expr);
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
    case 'modulo':
    case 'equation':
      return hasImaginaryUnit(node.lhs) || hasImaginaryUnit(node.rhs);
    case 'power':
      return hasImaginaryUnit(node.base) || hasImaginaryUnit(node.exponent);
    case 'inequality':
      return hasImaginaryUnit(node.lhs) || hasImaginaryUnit(node.rhs);
    case 'call':
      return node.args.some(hasImaginaryUnit);
    default:
      return false;
  }
}

export function evaluateAST(
  node: ExpressionNode,
  ctx: Record<string, number> = {},
  angleMode: 'RAD' | 'DEG' = 'RAD'
): number {
  if (complexEvaluator && hasImaginaryUnit(node)) {
    const res = complexEvaluator(node, ctx);
    if (res && typeof res.re === 'number') {
      return res.re;
    }
  }

  const toRad = (val: number) => (angleMode === 'DEG' ? (val * Math.PI) / 180 : val);
  const fromRad = (val: number) => (angleMode === 'DEG' ? (val * 180) / Math.PI : val);

  switch (node.type) {
    case 'number':
      return node.value;
    case 'variable':
      return ctx[node.name] !== undefined ? ctx[node.name] : NaN;
    case 'constant':
      if (node.name === 'pi') return Math.PI;
      if (node.name === 'e') return Math.E;
      if (node.name === 'phi') return (1 + Math.sqrt(5)) / 2;
      return NaN;
    case 'add':
      return evaluateAST(node.lhs, ctx, angleMode) + evaluateAST(node.rhs, ctx, angleMode);
    case 'subtract':
      return evaluateAST(node.lhs, ctx, angleMode) - evaluateAST(node.rhs, ctx, angleMode);
    case 'multiply':
      return evaluateAST(node.lhs, ctx, angleMode) * evaluateAST(node.rhs, ctx, angleMode);
    case 'divide': {
      const den = evaluateAST(node.rhs, ctx, angleMode);
      if (den === 0) return NaN;
      return evaluateAST(node.lhs, ctx, angleMode) / den;
    }
    case 'modulo': {
      const den = evaluateAST(node.rhs, ctx, angleMode);
      if (den === 0) return NaN;
      return evaluateAST(node.lhs, ctx, angleMode) % den;
    }
    case 'power': {
      const b = evaluateAST(node.base, ctx, angleMode);
      const e = evaluateAST(node.exponent, ctx, angleMode);
      // Handle negative base with fractional exponents like (-8)^(1/3)
      if (b < 0 && Math.abs(e - Math.round(e)) > 1e-9) {
        const inv = 1 / e;
        if (Math.abs(inv - Math.round(inv)) < 1e-5 && Math.round(inv) % 2 !== 0) {
          return -Math.pow(-b, e);
        }
      }
      return Math.pow(b, e);
    }
    case 'negate':
      return -evaluateAST(node.expr, ctx, angleMode);
    case 'factorial': {
      const n = evaluateAST(node.expr, ctx, angleMode);
      return factorial(n);
    }
    case 'call': {
      const evaluatedArgs = node.args.map((a) => evaluateAST(a, ctx, angleMode));
      const first = evaluatedArgs[0];
      if (first === undefined || isNaN(first)) return NaN;

      switch (node.name) {
        // Trigonometric
        case 'sin':
          return Math.sin(toRad(first));
        case 'cos':
          return Math.cos(toRad(first));
        case 'tan':
          return Math.tan(toRad(first));
        case 'sec': {
          const c = Math.cos(toRad(first));
          return c === 0 ? NaN : 1 / c;
        }
        case 'csc': {
          const s = Math.sin(toRad(first));
          return s === 0 ? NaN : 1 / s;
        }
        case 'cot': {
          const t = Math.tan(toRad(first));
          return t === 0 ? NaN : 1 / t;
        }
        case 'asin':
          return fromRad(Math.asin(first));
        case 'acos':
          return fromRad(Math.acos(first));
        case 'atan':
          return fromRad(Math.atan(first));
        case 'asec':
          return fromRad(Math.acos(1 / first));
        case 'acsc':
          return fromRad(Math.asin(1 / first));
        case 'acot':
          return fromRad(Math.atan(1 / first));

        // Hyperbolic
        case 'sinh':
          return Math.sinh(first);
        case 'cosh':
          return Math.cosh(first);
        case 'tanh':
          return Math.tanh(first);
        case 'asinh':
          return Math.asinh(first);
        case 'acosh':
          return Math.acosh(first);
        case 'atanh':
          return Math.atanh(first);

        // Logarithmic
        case 'ln':
          return Math.log(first);
        case 'log': {
          // If 2 args: log(base, value)
          if (evaluatedArgs.length >= 2) {
            const base = evaluatedArgs[0];
            const val = evaluatedArgs[1];
            return Math.log(val) / Math.log(base);
          }
          // Default single arg log(x) is base 10
          return Math.log10(first);
        }
        case 'log10':
          return Math.log10(first);
        case 'log2':
          return Math.log2(first);
        case 'exp':
          return Math.exp(first);

        // Algebraic & Roots
        case 'sqrt':
          return Math.sqrt(first);
        case 'cbrt':
          return Math.cbrt(first);
        case 'root':
        case 'nthroot': {
          if (evaluatedArgs.length >= 2) {
            const n = evaluatedArgs[0];
            const val = evaluatedArgs[1];
            if (val < 0 && Math.round(n) % 2 !== 0) {
              return -Math.pow(-val, 1 / n);
            }
            return Math.pow(val, 1 / n);
          }
          return Math.sqrt(first);
        }
        case 'abs':
          return Math.abs(first);
        case 'sgn':
        case 'sign':
          return Math.sign(first);
        case 'floor':
          return Math.floor(first);
        case 'ceil':
          return Math.ceil(first);
        case 'round':
          return Math.round(first);
        case 'trunc':
          return Math.trunc(first);
        case 'hypot':
          return Math.hypot(first, evaluatedArgs[1] ?? 0);
        case 'min':
          return Math.min(...evaluatedArgs);
        case 'max':
          return Math.max(...evaluatedArgs);
        case 'gcd':
          return evaluatedArgs.length >= 2 ? gcd(first, evaluatedArgs[1]) : Math.abs(first);
        case 'lcm':
          return evaluatedArgs.length >= 2 ? lcm(first, evaluatedArgs[1]) : Math.abs(first);
        case 'nCr':
          return evaluatedArgs.length >= 2 ? nCr(first, evaluatedArgs[1]) : NaN;
        case 'nPr':
          return evaluatedArgs.length >= 2 ? nPr(first, evaluatedArgs[1]) : NaN;

        case 'diff': {
          // Numerical derivative d/dx at x=first
          const h = 1e-6;
          const xVal = first;
          const fPlus = evaluateAST(node.args[0], { ...ctx, x: xVal + h }, angleMode);
          const fMinus = evaluateAST(node.args[0], { ...ctx, x: xVal - h }, angleMode);
          return (fPlus - fMinus) / (2 * h);
        }
        case 'integrate': {
          // Numerical definite integral: integrate(expr, a, b)
          const a = evaluatedArgs[1] ?? 0;
          const b = evaluatedArgs[2] ?? 1;
          const N = 100;
          const h = (b - a) / N;
          let sum = 0;
          for (let i = 0; i <= N; i++) {
            const x = a + i * h;
            const y = evaluateAST(node.args[0], { ...ctx, x }, angleMode);
            const w = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;
            sum += w * y;
          }
          return (h / 3) * sum;
        }

        default:
          return NaN;
      }
    }
    case 'equation': {
      // Evaluate difference LHS - RHS for zero-crossing analysis in implicit graphs
      const lhsVal = evaluateAST(node.lhs, ctx, angleMode);
      const rhsVal = evaluateAST(node.rhs, ctx, angleMode);
      return lhsVal - rhsVal;
    }
    case 'inequality':
      return NaN;
  }
}

export function astToLatex(node: ExpressionNode): string {
  switch (node.type) {
    case 'number':
      return Number.isInteger(node.value)
        ? node.value.toString()
        : node.value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    case 'variable':
      return node.name === 'theta' ? '\\theta' : node.name;
    case 'constant':
      if (node.name === 'pi') return '\\pi';
      if (node.name === 'phi') return '\\phi';
      return 'e';
    case 'add':
      return `${astToLatex(node.lhs)} + ${astToLatex(node.rhs)}`;
    case 'subtract':
      return `${astToLatex(node.lhs)} - ${astToLatex(node.rhs)}`;
    case 'multiply': {
      if (
        node.lhs.type === 'number' &&
        (node.rhs.type === 'variable' || node.rhs.type === 'call' || node.rhs.type === 'constant')
      ) {
        return `${astToLatex(node.lhs)}${astToLatex(node.rhs)}`;
      }
      return `${astToLatex(node.lhs)} \\cdot ${astToLatex(node.rhs)}`;
    }
    case 'divide':
      return `\\frac{${astToLatex(node.lhs)}}{${astToLatex(node.rhs)}}`;
    case 'modulo':
      return `${astToLatex(node.lhs)} \\bmod ${astToLatex(node.rhs)}`;
    case 'power':
      return `{${astToLatex(node.base)}}^{${astToLatex(node.exponent)}}`;
    case 'negate':
      return `-${astToLatex(node.expr)}`;
    case 'factorial':
      return `${astToLatex(node.expr)}!`;
    case 'call': {
      const args = node.args.map(astToLatex);
      if (node.name === 'sqrt') return `\\sqrt{${args[0] || ''}}`;
      if (node.name === 'cbrt') return `\\sqrt[3]{${args[0] || ''}}`;
      if (node.name === 'root' || node.name === 'nthroot') {
        return `\\sqrt[${args[0] || ''}]{${args[1] || ''}}`;
      }
      if (node.name === 'abs') return `\\left|${args[0] || ''}\\right|`;
      if (node.name === 'ln') return `\\ln\\left(${args.join(', ')}\\right)`;
      if (node.name === 'log10') return `\\log_{10}\\left(${args[0] || ''}\\right)`;
      if (node.name === 'log2') return `\\log_{2}\\left(${args[0] || ''}\\right)`;
      if (node.name === 'log') {
        if (args.length >= 2) return `\\log_{${args[0]}}\\left(${args[1]}\\right)`;
        return `\\log\\left(${args[0] || ''}\\right)`;
      }
      if (node.name === 'floor') return `\\lfloor ${args[0] || ''} \\rfloor`;
      if (node.name === 'ceil') return `\\lceil ${args[0] || ''} \\rceil`;
      if (node.name === 're') return `\\operatorname{Re}\\left(${args[0] || ''}\\right)`;
      if (node.name === 'im') return `\\operatorname{Im}\\left(${args[0] || ''}\\right)`;
      if (node.name === 'arg') return `\\operatorname{arg}\\left(${args[0] || ''}\\right)`;
      if (node.name === 'conj') return `\\overline{${args[0] || ''}}`;
      return `\\${node.name}\\left(${args.join(', ')}\\right)`;
    }
    case 'equation':
      return `${astToLatex(node.lhs)} = ${astToLatex(node.rhs)}`;
    case 'inequality': {
      const opLatex = node.op === '<=' ? '\\le' : node.op === '>=' ? '\\ge' : node.op;
      return `${astToLatex(node.lhs)} ${opLatex} ${astToLatex(node.rhs)}`;
    }
  }
}

export function astToString(node: ExpressionNode): string {
  switch (node.type) {
    case 'number':
      return node.value.toString();
    case 'variable':
      return node.name;
    case 'constant':
      return node.name;
    case 'add':
      return `(${astToString(node.lhs)} + ${astToString(node.rhs)})`;
    case 'subtract':
      return `(${astToString(node.lhs)} - ${astToString(node.rhs)})`;
    case 'multiply':
      return `(${astToString(node.lhs)} * ${astToString(node.rhs)})`;
    case 'divide':
      return `(${astToString(node.lhs)} / ${astToString(node.rhs)})`;
    case 'modulo':
      return `(${astToString(node.lhs)} % ${astToString(node.rhs)})`;
    case 'power':
      return `(${astToString(node.base)} ^ ${astToString(node.exponent)})`;
    case 'negate':
      return `(-${astToString(node.expr)})`;
    case 'factorial':
      return `${astToString(node.expr)}!`;
    case 'call':
      return `${node.name}(${node.args.map(astToString).join(', ')})`;
    case 'equation':
      return `${astToString(node.lhs)} = ${astToString(node.rhs)}`;
    case 'inequality':
      return `${astToString(node.lhs)} ${node.op} ${astToString(node.rhs)}`;
  }
}

export function astToExpression(node: ExpressionNode, parentPrecedence = 0): string {
  switch (node.type) {
    case 'number': {
      if (Number.isInteger(node.value)) return node.value.toString();
      return parseFloat(node.value.toFixed(6)).toString();
    }
    case 'variable':
      return node.name;
    case 'constant':
      return node.name;
    case 'add': {
      const expr = `${astToExpression(node.lhs, 1)} + ${astToExpression(node.rhs, 1)}`;
      return parentPrecedence > 1 ? `(${expr})` : expr;
    }
    case 'subtract': {
      const expr = `${astToExpression(node.lhs, 1)} - ${astToExpression(node.rhs, 2)}`;
      return parentPrecedence > 1 ? `(${expr})` : expr;
    }
    case 'multiply': {
      let expr: string;
      if (node.lhs.type === 'number' && (node.rhs.type === 'variable' || node.rhs.type === 'call')) {
        expr = `${astToExpression(node.lhs, 3)}*${astToExpression(node.rhs, 3)}`;
      } else {
        expr = `${astToExpression(node.lhs, 2)} * ${astToExpression(node.rhs, 2)}`;
      }
      return parentPrecedence > 2 ? `(${expr})` : expr;
    }
    case 'divide': {
      const expr = `${astToExpression(node.lhs, 3)} / ${astToExpression(node.rhs, 3)}`;
      return parentPrecedence > 2 ? `(${expr})` : expr;
    }
    case 'modulo': {
      const expr = `${astToExpression(node.lhs, 3)} % ${astToExpression(node.rhs, 3)}`;
      return parentPrecedence > 2 ? `(${expr})` : expr;
    }
    case 'power': {
      const expr = `${astToExpression(node.base, 4)}^${astToExpression(node.exponent, 4)}`;
      return parentPrecedence > 3 ? `(${expr})` : expr;
    }
    case 'negate': {
      const expr = `-${astToExpression(node.expr, 3)}`;
      return parentPrecedence > 3 ? `(${expr})` : expr;
    }
    case 'factorial':
      return `${astToExpression(node.expr, 4)}!`;
    case 'call':
      return `${node.name}(${node.args.map((a) => astToExpression(a, 0)).join(', ')})`;
    case 'equation':
      return `${astToExpression(node.lhs, 0)} = ${astToExpression(node.rhs, 0)}`;
    case 'inequality':
      return `${astToExpression(node.lhs, 0)} ${node.op} ${astToExpression(node.rhs, 0)}`;
  }
}
