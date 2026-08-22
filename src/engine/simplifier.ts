import { ExpressionNode, astToString } from './ast';

export class Simplifier {
  public static simplify(expr: ExpressionNode): ExpressionNode {
    let current = expr;
    for (let i = 0; i < 10; i++) {
      const next = Simplifier.step(current);
      if (astToString(next) === astToString(current)) break;
      current = next;
    }
    return current;
  }

  private static step(node: ExpressionNode): ExpressionNode {
    switch (node.type) {
      case 'number':
      case 'variable':
      case 'constant':
        return node;

      case 'negate': {
        const u = Simplifier.step(node.expr);
        if (u.type === 'number') return { type: 'number', value: -u.value };
        if (u.type === 'negate') return u.expr;
        return { type: 'negate', expr: u };
      }

      case 'add': {
        const lhs = Simplifier.step(node.lhs);
        const rhs = Simplifier.step(node.rhs);

        // Constant folding
        if (lhs.type === 'number' && rhs.type === 'number') {
          return { type: 'number', value: lhs.value + rhs.value };
        }
        // Additive identities: 0 + x = x, x + 0 = x
        if (lhs.type === 'number' && lhs.value === 0) return rhs;
        if (rhs.type === 'number' && rhs.value === 0) return lhs;

        // x + (-y) => x - y
        if (rhs.type === 'negate') {
          return Simplifier.step({ type: 'subtract', lhs, rhs: rhs.expr });
        }

        // Like terms: x + x => 2*x
        if (astToString(lhs) === astToString(rhs)) {
          return Simplifier.step({ type: 'multiply', lhs: { type: 'number', value: 2 }, rhs: lhs });
        }

        return { type: 'add', lhs, rhs };
      }

      case 'subtract': {
        const lhs = Simplifier.step(node.lhs);
        const rhs = Simplifier.step(node.rhs);

        if (lhs.type === 'number' && rhs.type === 'number') {
          return { type: 'number', value: lhs.value - rhs.value };
        }
        if (rhs.type === 'number' && rhs.value === 0) return lhs;
        if (lhs.type === 'number' && lhs.value === 0) {
          return Simplifier.step({ type: 'negate', expr: rhs });
        }

        // x - x => 0
        if (astToString(lhs) === astToString(rhs)) {
          return { type: 'number', value: 0 };
        }

        return { type: 'subtract', lhs, rhs };
      }

      case 'multiply': {
        const lhs = Simplifier.step(node.lhs);
        const rhs = Simplifier.step(node.rhs);

        if (lhs.type === 'number' && rhs.type === 'number') {
          return { type: 'number', value: lhs.value * rhs.value };
        }
        // Absorbing element: 0 * x = 0
        if ((lhs.type === 'number' && lhs.value === 0) || (rhs.type === 'number' && rhs.value === 0)) {
          return { type: 'number', value: 0 };
        }
        // Identity: 1 * x = x, x * 1 = x
        if (lhs.type === 'number' && lhs.value === 1) return rhs;
        if (rhs.type === 'number' && rhs.value === 1) return lhs;

        // Negative identity: -1 * x = -x
        if (lhs.type === 'number' && lhs.value === -1) {
          return Simplifier.step({ type: 'negate', expr: rhs });
        }

        // Exponent rule: x * x => x^2
        if (astToString(lhs) === astToString(rhs)) {
          return { type: 'power', base: lhs, exponent: { type: 'number', value: 2 } };
        }

        return { type: 'multiply', lhs, rhs };
      }

      case 'divide': {
        const lhs = Simplifier.step(node.lhs);
        const rhs = Simplifier.step(node.rhs);

        if (lhs.type === 'number' && rhs.type === 'number' && rhs.value !== 0) {
          return { type: 'number', value: lhs.value / rhs.value };
        }
        if (lhs.type === 'number' && lhs.value === 0) return { type: 'number', value: 0 };
        if (rhs.type === 'number' && rhs.value === 1) return lhs;
        if (astToString(lhs) === astToString(rhs)) return { type: 'number', value: 1 };

        return { type: 'divide', lhs, rhs };
      }

      case 'power': {
        const base = Simplifier.step(node.base);
        const exp = Simplifier.step(node.exponent);

        if (base.type === 'number' && exp.type === 'number') {
          return { type: 'number', value: Math.pow(base.value, exp.value) };
        }
        // x^0 = 1
        if (exp.type === 'number' && exp.value === 0) return { type: 'number', value: 1 };
        // x^1 = x
        if (exp.type === 'number' && exp.value === 1) return base;
        // 0^x = 0 (for positive)
        if (base.type === 'number' && base.value === 0) return { type: 'number', value: 0 };
        // 1^x = 1
        if (base.type === 'number' && base.value === 1) return { type: 'number', value: 1 };

        return { type: 'power', base, exponent: exp };
      }

      case 'call': {
        const sArgs = node.args.map(Simplifier.step);
        const first = sArgs[0];
        if (first && first.type === 'number') {
          const val = first.value;
          if (node.name === 'sin' && val === 0) return { type: 'number', value: 0 };
          if (node.name === 'cos' && val === 0) return { type: 'number', value: 1 };
          if (node.name === 'exp' && val === 0) return { type: 'number', value: 1 };
          if (node.name === 'ln' && val === 1) return { type: 'number', value: 0 };
          if (node.name === 'sqrt' && val >= 0) {
            const sq = Math.sqrt(val);
            if (Number.isInteger(sq)) return { type: 'number', value: sq };
          }
        }
        return { type: 'call', name: node.name, args: sArgs };
      }

      default:
        return node;
    }
  }
}
