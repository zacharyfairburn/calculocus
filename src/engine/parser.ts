import { Token } from './tokens';
import { Lexer } from './lexer';
import { ExpressionNode } from './ast';

export class Parser {
  private tokens: Token[];
  private cursor = 0;

  constructor(tokens: Token[]) {
    this.tokens = Parser.insertImplicitMultiplication(tokens);
  }

  public static parse(input: string): ExpressionNode {
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parseExpression();
  }

  private static insertImplicitMultiplication(rawTokens: Token[]): Token[] {
    if (rawTokens.length <= 1) return rawTokens;
    const result: Token[] = [];

    for (let i = 0; i < rawTokens.length - 1; i++) {
      const cur = rawTokens[i];
      const next = rawTokens[i + 1];
      result.push(cur);

      let shouldMultiply = false;

      const isCurAtomic =
        cur.type.kind === 'number' ||
        cur.type.kind === 'variable' ||
        cur.type.kind === 'constant' ||
        cur.type.kind === 'rightParen' ||
        cur.type.kind === 'factorial';

      const isNextAtomic =
        next.type.kind === 'variable' ||
        next.type.kind === 'constant' ||
        next.type.kind === 'function' ||
        next.type.kind === 'leftParen';

      if (isCurAtomic && isNextAtomic) {
        shouldMultiply = true;
      } else if (cur.type.kind === 'number' && next.type.kind === 'number') {
        shouldMultiply = false;
      } else if (cur.type.kind === 'rightParen' && next.type.kind === 'number') {
        shouldMultiply = true;
      }

      if (shouldMultiply) {
        result.push({
          type: { kind: 'multiply' },
          text: '*',
          start: cur.end,
          end: next.start,
        });
      }
    }

    if (rawTokens.length > 0) {
      result.push(rawTokens[rawTokens.length - 1]);
    }

    return result;
  }

  public parseExpression(minPrec = 0): ExpressionNode {
    let lhs = this.parsePrimary();

    while (this.cursor < this.tokens.length) {
      const token = this.tokens[this.cursor];

      // Postfix factorial
      if (token.type.kind === 'factorial') {
        this.cursor++;
        lhs = { type: 'factorial', expr: lhs };
        continue;
      }

      const precInfo = this.getPrecedence(token.type.kind);
      if (!precInfo || precInfo.prec < minPrec) break;

      this.cursor++;
      const nextMinPrec = precInfo.rightAssoc ? precInfo.prec : precInfo.prec + 1;
      const rhs = this.parseExpression(nextMinPrec);

      switch (token.type.kind) {
        case 'plus':
          lhs = { type: 'add', lhs, rhs };
          break;
        case 'minus':
          lhs = { type: 'subtract', lhs, rhs };
          break;
        case 'multiply':
          lhs = { type: 'multiply', lhs, rhs };
          break;
        case 'divide':
          lhs = { type: 'divide', lhs, rhs };
          break;
        case 'modulo':
          lhs = { type: 'modulo', lhs, rhs };
          break;
        case 'power':
          lhs = { type: 'power', base: lhs, exponent: rhs };
          break;
        case 'equals':
          lhs = { type: 'equation', lhs, rhs };
          break;
        case 'lessThan':
          lhs = { type: 'inequality', lhs, op: '<', rhs };
          break;
        case 'lessThanOrEqual':
          lhs = { type: 'inequality', lhs, op: '<=', rhs };
          break;
        case 'greaterThan':
          lhs = { type: 'inequality', lhs, op: '>', rhs };
          break;
        case 'greaterThanOrEqual':
          lhs = { type: 'inequality', lhs, op: '>=', rhs };
          break;
      }
    }

    return lhs;
  }

  private parsePrimary(): ExpressionNode {
    if (this.cursor >= this.tokens.length) {
      throw new Error('Unexpected end of input');
    }

    const token = this.tokens[this.cursor++];
    const kind = token.type.kind;

    if (kind === 'number') {
      return { type: 'number', value: (token.type as { value: number }).value };
    }
    if (kind === 'variable') {
      return { type: 'variable', name: (token.type as { name: string }).name };
    }
    if (kind === 'constant') {
      return { type: 'constant', name: (token.type as { name: 'pi' | 'e' | 'phi' }).name };
    }
    if (kind === 'minus') {
      const expr = this.parsePrimary();
      return { type: 'negate', expr };
    }
    if (kind === 'plus') {
      return this.parsePrimary();
    }
    if (kind === 'pipe') {
      // Parse absolute value |...|
      const innerExpr = this.parseExpression(0);
      if (this.cursor < this.tokens.length && this.tokens[this.cursor].type.kind === 'pipe') {
        this.cursor++;
      }
      return { type: 'call', name: 'abs', args: [innerExpr] };
    }
    if (kind === 'leftParen') {
      const expr = this.parseExpression(0);
      if (this.cursor < this.tokens.length && this.tokens[this.cursor].type.kind === 'rightParen') {
        this.cursor++;
      }
      return expr;
    }
    if (kind === 'function') {
      const fnName = (token.type as { name: any }).name;
      const args: ExpressionNode[] = [];
      if (this.cursor < this.tokens.length && this.tokens[this.cursor].type.kind === 'leftParen') {
        this.cursor++;
        if (this.cursor < this.tokens.length && this.tokens[this.cursor].type.kind !== 'rightParen') {
          while (true) {
            args.push(this.parseExpression(0));
            if (this.cursor < this.tokens.length && this.tokens[this.cursor].type.kind === 'comma') {
              this.cursor++;
            } else {
              break;
            }
          }
        }
        if (this.cursor < this.tokens.length && this.tokens[this.cursor].type.kind === 'rightParen') {
          this.cursor++;
        }
      } else {
        // e.g. sin x or ln x without parens
        args.push(this.parsePrimary());
      }
      return { type: 'call', name: fnName, args };
    }

    throw new Error(`Unexpected token: ${token.text}`);
  }

  private getPrecedence(kind: string): { prec: number; rightAssoc: boolean } | null {
    switch (kind) {
      case 'equals':
      case 'lessThan':
      case 'lessThanOrEqual':
      case 'greaterThan':
      case 'greaterThanOrEqual':
        return { prec: 1, rightAssoc: false };
      case 'plus':
      case 'minus':
        return { prec: 2, rightAssoc: false };
      case 'multiply':
      case 'divide':
      case 'modulo':
        return { prec: 3, rightAssoc: false };
      case 'power':
        return { prec: 4, rightAssoc: true };
      default:
        return null;
    }
  }
}
