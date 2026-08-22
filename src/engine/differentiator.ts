import { ExpressionNode } from './ast';
import { Simplifier } from './simplifier';

export class SymbolicDifferentiator {
  public static diff(expr: ExpressionNode, v = 'x'): ExpressionNode {
    const raw = SymbolicDifferentiator.differentiate(expr, v);
    return Simplifier.simplify(raw);
  }

  public static diffOrder(expr: ExpressionNode, v = 'x', order = 1): ExpressionNode {
    let current = expr;
    for (let i = 0; i < order; i++) {
      current = SymbolicDifferentiator.diff(current, v);
    }
    return current;
  }

  private static differentiate(expr: ExpressionNode, v: string): ExpressionNode {
    switch (expr.type) {
      case 'number':
      case 'constant':
        return { type: 'number', value: 0 };

      case 'variable':
        return expr.name === v ? { type: 'number', value: 1 } : { type: 'number', value: 0 };

      case 'add':
        return {
          type: 'add',
          lhs: SymbolicDifferentiator.differentiate(expr.lhs, v),
          rhs: SymbolicDifferentiator.differentiate(expr.rhs, v),
        };

      case 'subtract':
        return {
          type: 'subtract',
          lhs: SymbolicDifferentiator.differentiate(expr.lhs, v),
          rhs: SymbolicDifferentiator.differentiate(expr.rhs, v),
        };

      case 'multiply': {
        const u = expr.lhs;
        const w = expr.rhs;
        const uPrime = SymbolicDifferentiator.differentiate(u, v);
        const wPrime = SymbolicDifferentiator.differentiate(w, v);
        return {
          type: 'add',
          lhs: { type: 'multiply', lhs: uPrime, rhs: w },
          rhs: { type: 'multiply', lhs: u, rhs: wPrime },
        };
      }

      case 'divide': {
        const u = expr.lhs;
        const w = expr.rhs;
        const uPrime = SymbolicDifferentiator.differentiate(u, v);
        const wPrime = SymbolicDifferentiator.differentiate(w, v);
        const num: ExpressionNode = {
          type: 'subtract',
          lhs: { type: 'multiply', lhs: uPrime, rhs: w },
          rhs: { type: 'multiply', lhs: u, rhs: wPrime },
        };
        const den: ExpressionNode = {
          type: 'power',
          base: w,
          exponent: { type: 'number', value: 2 },
        };
        return { type: 'divide', lhs: num, rhs: den };
      }

      case 'power': {
        const u = expr.base;
        const w = expr.exponent;
        const uPrime = SymbolicDifferentiator.differentiate(u, v);
        const wPrime = SymbolicDifferentiator.differentiate(w, v);

        if (w.type === 'number') {
          const n = w.value;
          return {
            type: 'multiply',
            lhs: {
              type: 'multiply',
              lhs: { type: 'number', value: n },
              rhs: { type: 'power', base: u, exponent: { type: 'number', value: n - 1 } },
            },
            rhs: uPrime,
          };
        }

        const term1: ExpressionNode = {
          type: 'multiply',
          lhs: wPrime,
          rhs: { type: 'call', name: 'ln', args: [u] },
        };
        const term2: ExpressionNode = {
          type: 'multiply',
          lhs: w,
          rhs: { type: 'divide', lhs: uPrime, rhs: u },
        };
        return {
          type: 'multiply',
          lhs: { type: 'power', base: u, exponent: w },
          rhs: { type: 'add', lhs: term1, rhs: term2 },
        };
      }

      case 'negate':
        return { type: 'negate', expr: SymbolicDifferentiator.differentiate(expr.expr, v) };

      case 'factorial':
        return { type: 'number', value: 0 };

      case 'call': {
        const u = expr.args[0];
        if (!u) return { type: 'number', value: 0 };
        const uPrime = SymbolicDifferentiator.differentiate(u, v);

        let outerPrime: ExpressionNode;
        switch (expr.name) {
          case 'sin':
            outerPrime = { type: 'call', name: 'cos', args: [u] };
            break;
          case 'cos':
            outerPrime = { type: 'negate', expr: { type: 'call', name: 'sin', args: [u] } };
            break;
          case 'tan':
            outerPrime = {
              type: 'power',
              base: { type: 'call', name: 'sec', args: [u] },
              exponent: { type: 'number', value: 2 },
            };
            break;
          case 'asin':
            outerPrime = {
              type: 'divide',
              lhs: { type: 'number', value: 1 },
              rhs: {
                type: 'call',
                name: 'sqrt',
                args: [{ type: 'subtract', lhs: { type: 'number', value: 1 }, rhs: { type: 'power', base: u, exponent: { type: 'number', value: 2 } } }],
              },
            };
            break;
          case 'acos':
            outerPrime = {
              type: 'negate',
              expr: {
                type: 'divide',
                lhs: { type: 'number', value: 1 },
                rhs: {
                  type: 'call',
                  name: 'sqrt',
                  args: [{ type: 'subtract', lhs: { type: 'number', value: 1 }, rhs: { type: 'power', base: u, exponent: { type: 'number', value: 2 } } }],
                },
              },
            };
            break;
          case 'atan':
            outerPrime = {
              type: 'divide',
              lhs: { type: 'number', value: 1 },
              rhs: { type: 'add', lhs: { type: 'number', value: 1 }, rhs: { type: 'power', base: u, exponent: { type: 'number', value: 2 } } },
            };
            break;
          case 'sinh':
            outerPrime = { type: 'call', name: 'cosh', args: [u] };
            break;
          case 'cosh':
            outerPrime = { type: 'call', name: 'sinh', args: [u] };
            break;
          case 'tanh':
            outerPrime = {
              type: 'divide',
              lhs: { type: 'number', value: 1 },
              rhs: { type: 'power', base: { type: 'call', name: 'cosh', args: [u] }, exponent: { type: 'number', value: 2 } },
            };
            break;
          case 'ln':
          case 'log':
            outerPrime = { type: 'divide', lhs: { type: 'number', value: 1 }, rhs: u };
            break;
          case 'log10':
            outerPrime = {
              type: 'divide',
              lhs: { type: 'number', value: 1 },
              rhs: { type: 'multiply', lhs: u, rhs: { type: 'call', name: 'ln', args: [{ type: 'number', value: 10 }] } },
            };
            break;
          case 'log2':
            outerPrime = {
              type: 'divide',
              lhs: { type: 'number', value: 1 },
              rhs: { type: 'multiply', lhs: u, rhs: { type: 'call', name: 'ln', args: [{ type: 'number', value: 2 }] } },
            };
            break;
          case 'exp':
            outerPrime = { type: 'call', name: 'exp', args: [u] };
            break;
          case 'sqrt':
            outerPrime = {
              type: 'divide',
              lhs: { type: 'number', value: 1 },
              rhs: { type: 'multiply', lhs: { type: 'number', value: 2 }, rhs: { type: 'call', name: 'sqrt', args: [u] } },
            };
            break;
          case 'cbrt':
            outerPrime = {
              type: 'divide',
              lhs: { type: 'number', value: 1 },
              rhs: { type: 'multiply', lhs: { type: 'number', value: 3 }, rhs: { type: 'power', base: u, exponent: { type: 'number', value: 2 / 3 } } },
            };
            break;
          case 'abs':
            outerPrime = { type: 'call', name: 'sgn', args: [u] };
            break;
          default:
            outerPrime = { type: 'number', value: 0 };
        }

        return {
          type: 'multiply',
          lhs: outerPrime,
          rhs: uPrime,
        };
      }

      default:
        return { type: 'number', value: 0 };
    }
  }
}
