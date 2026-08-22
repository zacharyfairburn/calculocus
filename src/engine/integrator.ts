import { ExpressionNode, evaluateAST } from './ast';
import { Simplifier } from './simplifier';

interface LinearForm {
  isLinear: boolean;
  a: number; // coefficient of v
  b: number; // constant offset
}

export class SymbolicIntegrator {
  private static getLinearForm(node: ExpressionNode, v = 'x'): LinearForm {
    switch (node.type) {
      case 'variable':
        if (node.name === v) return { isLinear: true, a: 1, b: 0 };
        return { isLinear: true, a: 0, b: 0 };
      case 'number':
        return { isLinear: true, a: 0, b: node.value };
      case 'constant':
        return { isLinear: true, a: 0, b: 0 };
      case 'negate': {
        const inner = SymbolicIntegrator.getLinearForm(node.expr, v);
        if (inner.isLinear) return { isLinear: true, a: -inner.a, b: -inner.b };
        return { isLinear: false, a: 0, b: 0 };
      }
      case 'add': {
        const l = SymbolicIntegrator.getLinearForm(node.lhs, v);
        const r = SymbolicIntegrator.getLinearForm(node.rhs, v);
        if (l.isLinear && r.isLinear) return { isLinear: true, a: l.a + r.a, b: l.b + r.b };
        return { isLinear: false, a: 0, b: 0 };
      }
      case 'subtract': {
        const l = SymbolicIntegrator.getLinearForm(node.lhs, v);
        const r = SymbolicIntegrator.getLinearForm(node.rhs, v);
        if (l.isLinear && r.isLinear) return { isLinear: true, a: l.a - r.a, b: l.b - r.b };
        return { isLinear: false, a: 0, b: 0 };
      }
      case 'multiply': {
        const l = SymbolicIntegrator.getLinearForm(node.lhs, v);
        const r = SymbolicIntegrator.getLinearForm(node.rhs, v);
        if (l.isLinear && l.a === 0 && r.isLinear) {
          return { isLinear: true, a: l.b * r.a, b: l.b * r.b };
        }
        if (r.isLinear && r.a === 0 && l.isLinear) {
          return { isLinear: true, a: r.b * l.a, b: r.b * l.b };
        }
        return { isLinear: false, a: 0, b: 0 };
      }
      default:
        return { isLinear: false, a: 0, b: 0 };
    }
  }

  public static integrate(expr: ExpressionNode, v = 'x'): ExpressionNode | null {
    const s = Simplifier.simplify(expr);

    switch (s.type) {
      case 'number':
        return { type: 'multiply', lhs: { type: 'number', value: s.value }, rhs: { type: 'variable', name: v } };

      case 'constant':
        return { type: 'multiply', lhs: s, rhs: { type: 'variable', name: v } };

      case 'variable':
        if (s.name === v) {
          // int(x dx) = x^2 / 2
          return {
            type: 'divide',
            lhs: { type: 'power', base: { type: 'variable', name: v }, exponent: { type: 'number', value: 2 } },
            rhs: { type: 'number', value: 2 },
          };
        } else {
          return { type: 'multiply', lhs: s, rhs: { type: 'variable', name: v } };
        }

      case 'negate': {
        const intE = SymbolicIntegrator.integrate(s.expr, v);
        if (intE) return Simplifier.simplify({ type: 'negate', expr: intE });
        return null;
      }

      case 'add': {
        const intL = SymbolicIntegrator.integrate(s.lhs, v);
        const intR = SymbolicIntegrator.integrate(s.rhs, v);
        if (intL && intR) return Simplifier.simplify({ type: 'add', lhs: intL, rhs: intR });
        return null;
      }

      case 'subtract': {
        const intL = SymbolicIntegrator.integrate(s.lhs, v);
        const intR = SymbolicIntegrator.integrate(s.rhs, v);
        if (intL && intR) return Simplifier.simplify({ type: 'subtract', lhs: intL, rhs: intR });
        return null;
      }

      case 'multiply': {
        if (!SymbolicIntegrator.containsVar(s.lhs, v)) {
          const intR = SymbolicIntegrator.integrate(s.rhs, v);
          if (intR) return Simplifier.simplify({ type: 'multiply', lhs: s.lhs, rhs: intR });
        }
        if (!SymbolicIntegrator.containsVar(s.rhs, v)) {
          const intL = SymbolicIntegrator.integrate(s.lhs, v);
          if (intL) return Simplifier.simplify({ type: 'multiply', lhs: s.rhs, rhs: intL });
        }

        // Integration by parts for x * exp(a*x)
        if (s.lhs.type === 'variable' && s.lhs.name === v && s.rhs.type === 'call' && s.rhs.name === 'exp') {
          const lin = SymbolicIntegrator.getLinearForm(s.rhs.args[0], v);
          if (lin.isLinear && lin.a !== 0) {
            // int(x * e^(ax+b)) = (ax - 1)/(a^2) * e^(ax+b)
            return Simplifier.simplify({
              type: 'multiply',
              lhs: {
                type: 'divide',
                lhs: {
                  type: 'subtract',
                  lhs: { type: 'multiply', lhs: { type: 'number', value: lin.a }, rhs: { type: 'variable', name: v } },
                  rhs: { type: 'number', value: 1 },
                },
                rhs: { type: 'number', value: lin.a * lin.a },
              },
              rhs: s.rhs,
            });
          }
        }
        return null;
      }

      case 'divide': {
        if (!SymbolicIntegrator.containsVar(s.rhs, v)) {
          const intL = SymbolicIntegrator.integrate(s.lhs, v);
          if (intL) return Simplifier.simplify({ type: 'divide', lhs: intL, rhs: s.rhs });
        }
        // k / (a*x + b)
        const linDen = SymbolicIntegrator.getLinearForm(s.rhs, v);
        if (linDen.isLinear && linDen.a !== 0 && !SymbolicIntegrator.containsVar(s.lhs, v)) {
          const coeff: ExpressionNode = { type: 'divide', lhs: s.lhs, rhs: { type: 'number', value: linDen.a } };
          return Simplifier.simplify({
            type: 'multiply',
            lhs: coeff,
            rhs: { type: 'call', name: 'ln', args: [{ type: 'call', name: 'abs', args: [s.rhs] }] },
          });
        }
        return null;
      }

      case 'power': {
        // (a*x + b)^n
        const linBase = SymbolicIntegrator.getLinearForm(s.base, v);
        if (linBase.isLinear && linBase.a !== 0 && s.exponent.type === 'number') {
          const n = s.exponent.value;
          if (n === -1) {
            return Simplifier.simplify({
              type: 'multiply',
              lhs: { type: 'divide', lhs: { type: 'number', value: 1 }, rhs: { type: 'number', value: linBase.a } },
              rhs: { type: 'call', name: 'ln', args: [{ type: 'call', name: 'abs', args: [s.base] }] },
            });
          } else {
            const newExp = n + 1;
            const denom = linBase.a * newExp;
            return Simplifier.simplify({
              type: 'divide',
              lhs: { type: 'power', base: s.base, exponent: { type: 'number', value: newExp } },
              rhs: { type: 'number', value: denom },
            });
          }
        }
        return null;
      }

      case 'call': {
        if (s.args.length === 1) {
          const linArg = SymbolicIntegrator.getLinearForm(s.args[0], v);
          if (linArg.isLinear && linArg.a !== 0) {
            const a = linArg.a;
            switch (s.name) {
              case 'sin':
                return Simplifier.simplify({
                  type: 'divide',
                  lhs: { type: 'negate', expr: { type: 'call', name: 'cos', args: [s.args[0]] } },
                  rhs: { type: 'number', value: a },
                });
              case 'cos':
                return Simplifier.simplify({
                  type: 'divide',
                  lhs: { type: 'call', name: 'sin', args: [s.args[0]] },
                  rhs: { type: 'number', value: a },
                });
              case 'exp':
                return Simplifier.simplify({
                  type: 'divide',
                  lhs: { type: 'call', name: 'exp', args: [s.args[0]] },
                  rhs: { type: 'number', value: a },
                });
              case 'sinh':
                return Simplifier.simplify({
                  type: 'divide',
                  lhs: { type: 'call', name: 'cosh', args: [s.args[0]] },
                  rhs: { type: 'number', value: a },
                });
              case 'cosh':
                return Simplifier.simplify({
                  type: 'divide',
                  lhs: { type: 'call', name: 'sinh', args: [s.args[0]] },
                  rhs: { type: 'number', value: a },
                });
              case 'tan':
                return Simplifier.simplify({
                  type: 'divide',
                  lhs: {
                    type: 'negate',
                    expr: {
                      type: 'call',
                      name: 'ln',
                      args: [{ type: 'call', name: 'abs', args: [{ type: 'call', name: 'cos', args: [s.args[0]] }] }],
                    },
                  },
                  rhs: { type: 'number', value: a },
                });
              case 'ln':
                if (a === 1 && linArg.b === 0) {
                  return Simplifier.simplify({
                    type: 'subtract',
                    lhs: {
                      type: 'multiply',
                      lhs: { type: 'variable', name: v },
                      rhs: { type: 'call', name: 'ln', args: [{ type: 'variable', name: v }] },
                    },
                    rhs: { type: 'variable', name: v },
                  });
                }
                break;
            }
          }
        }
        return null;
      }

      default:
        return null;
    }
  }

  private static containsVar(node: ExpressionNode, v: string): boolean {
    switch (node.type) {
      case 'variable': return node.name === v;
      case 'add':
      case 'subtract':
      case 'multiply':
      case 'divide':
        return SymbolicIntegrator.containsVar(node.lhs, v) || SymbolicIntegrator.containsVar(node.rhs, v);
      case 'power':
        return SymbolicIntegrator.containsVar(node.base, v) || SymbolicIntegrator.containsVar(node.exponent, v);
      case 'negate':
      case 'factorial':
        return SymbolicIntegrator.containsVar(node.expr, v);
      case 'call':
        return node.args.some(a => SymbolicIntegrator.containsVar(a, v));
      default:
        return false;
    }
  }

  // MARK: - Adaptive Simpson's Rule
  public static adaptiveSimpson(
    expr: ExpressionNode,
    a: number,
    b: number,
    eps = 1e-7,
    maxDepth = 20,
    v = 'x'
  ): number {
    if (a > b) {
      return -SymbolicIntegrator.adaptiveSimpson(expr, b, a, eps, maxDepth, v);
    }
    if (Math.abs(a - b) < 1e-12) return 0;

    const f = (x: number) => {
      const res = evaluateAST(expr, { [v]: x });
      return isNaN(res) || !isFinite(res) ? 0 : res;
    };

    const c = (a + b) / 2;
    const h = b - a;
    const fa = f(a), fb = f(b), fc = f(c);
    const s = (h / 6) * (fa + 4 * fc + fb);

    return SymbolicIntegrator.recursiveSimpson(f, a, b, eps, s, fa, fb, fc, maxDepth);
  }

  private static recursiveSimpson(
    f: (x: number) => number,
    a: number,
    b: number,
    eps: number,
    s: number,
    fa: number,
    fb: number,
    fc: number,
    depth: number
  ): number {
    const c = (a + b) / 2;
    const h = b - a;
    const d = (a + c) / 2;
    const e = (c + b) / 2;
    const fd = f(d), fe = f(e);

    const sLeft = (h / 12) * (fa + 4 * fd + fc);
    const sRight = (h / 12) * (fc + 4 * fe + fb);
    const s2 = sLeft + sRight;

    if (depth <= 0 || Math.abs(s2 - s) <= 15 * eps) {
      return s2 + (s2 - s) / 15;
    }

    return (
      SymbolicIntegrator.recursiveSimpson(f, a, c, eps / 2, sLeft, fa, fc, fd, depth - 1) +
      SymbolicIntegrator.recursiveSimpson(f, c, b, eps / 2, sRight, fc, fb, fe, depth - 1)
    );
  }
}
