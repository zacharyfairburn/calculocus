import { Token, MathFunctionName } from './tokens';

export class Lexer {
  private input: string;

  constructor(input: string) {
    this.input = input;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = this.input.length;

    while (i < len) {
      const char = this.input[i];

      // 1. Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      const startIndex = i;

      // 2. Numbers (integer, float)
      if (/[0-9]/.test(char) || (char === '.' && i + 1 < len && /[0-9]/.test(this.input[i + 1]))) {
        let numStr = '';
        let hasDot = false;
        while (i < len) {
          const c = this.input[i];
          if (/[0-9]/.test(c)) {
            numStr += c;
            i++;
          } else if (c === '.' && !hasDot) {
            hasDot = true;
            numStr += c;
            i++;
          } else {
            break;
          }
        }
        tokens.push({
          type: { kind: 'number', value: parseFloat(numStr) },
          text: numStr,
          start: startIndex,
          end: i,
        });
        continue;
      }

      // 3. Greek symbols & operators
      if (char === 'π' || (char === 'p' && i + 1 < len && this.input[i + 1] === 'i' && (i + 2 >= len || !/[a-zA-Z0-9_]/.test(this.input[i + 2])))) {
        tokens.push({ type: { kind: 'constant', name: 'pi' }, text: 'π', start: i, end: char === 'π' ? i + 1 : i + 2 });
        i += char === 'π' ? 1 : 2;
        continue;
      }
      if (char === 'θ') {
        tokens.push({ type: { kind: 'variable', name: 'theta' }, text: 'θ', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '√') {
        tokens.push({ type: { kind: 'function', name: 'sqrt' }, text: '√', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '∛') {
        tokens.push({ type: { kind: 'function', name: 'cbrt' }, text: '∛', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '|') {
        tokens.push({ type: { kind: 'pipe' }, text: '|', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '+') {
        tokens.push({ type: { kind: 'plus' }, text: '+', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '-') {
        tokens.push({ type: { kind: 'minus' }, text: '-', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '*' || char === '×' || char === '·') {
        tokens.push({ type: { kind: 'multiply' }, text: '*', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '/' || char === '÷') {
        tokens.push({ type: { kind: 'divide' }, text: '/', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '^') {
        tokens.push({ type: { kind: 'power' }, text: '^', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '!') {
        tokens.push({ type: { kind: 'factorial' }, text: '!', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '%') {
        tokens.push({ type: { kind: 'modulo' }, text: '%', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '(') {
        tokens.push({ type: { kind: 'leftParen' }, text: '(', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ')') {
        tokens.push({ type: { kind: 'rightParen' }, text: ')', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === ',') {
        tokens.push({ type: { kind: 'comma' }, text: ',', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '=') {
        tokens.push({ type: { kind: 'equals' }, text: '=', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '<') {
        if (i + 1 < len && this.input[i + 1] === '=') {
          tokens.push({ type: { kind: 'lessThanOrEqual' }, text: '<=', start: i, end: i + 2 });
          i += 2;
        } else {
          tokens.push({ type: { kind: 'lessThan' }, text: '<', start: i, end: i + 1 });
          i++;
        }
        continue;
      }
      if (char === '≤') {
        tokens.push({ type: { kind: 'lessThanOrEqual' }, text: '≤', start: i, end: i + 1 });
        i++;
        continue;
      }
      if (char === '>') {
        if (i + 1 < len && this.input[i + 1] === '=') {
          tokens.push({ type: { kind: 'greaterThanOrEqual' }, text: '>=', start: i, end: i + 2 });
          i += 2;
        } else {
          tokens.push({ type: { kind: 'greaterThan' }, text: '>', start: i, end: i + 1 });
          i++;
        }
        continue;
      }
      if (char === '≥') {
        tokens.push({ type: { kind: 'greaterThanOrEqual' }, text: '≥', start: i, end: i + 1 });
        i++;
        continue;
      }

      // 4. Identifiers (functions, constants, variables)
      if (/[a-zA-Z_]/.test(char)) {
        let ident = '';
        while (i < len && /[a-zA-Z0-9_]/.test(this.input[i])) {
          ident += this.input[i];
          i++;
        }
        const lower = ident.toLowerCase();

        const functionList: MathFunctionName[] = [
          'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
          'sec', 'csc', 'cot', 'asec', 'acsc', 'acot',
          'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh',
          'ln', 'log', 'log10', 'log2',
          'exp', 'sqrt', 'cbrt', 'root', 'nthroot',
          'abs', 'sgn', 'sign',
          'floor', 'ceil', 'round', 'trunc',
          'hypot', 'min', 'max', 'gcd', 'lcm', 'nCr', 'nPr',
          'diff', 'integrate', 're', 'im', 'arg', 'conj'
        ];

        if (functionList.includes(lower as MathFunctionName)) {
          tokens.push({ type: { kind: 'function', name: lower as MathFunctionName }, text: ident, start: startIndex, end: i });
        } else if (lower === 'pi') {
          tokens.push({ type: { kind: 'constant', name: 'pi' }, text: ident, start: startIndex, end: i });
        } else if (lower === 'theta') {
          tokens.push({ type: { kind: 'variable', name: 'theta' }, text: ident, start: startIndex, end: i });
        } else if (lower === 'e' && (i >= len || !/[a-zA-Z]/.test(this.input[i]))) {
          tokens.push({ type: { kind: 'constant', name: 'e' }, text: ident, start: startIndex, end: i });
        } else if (lower === 'phi') {
          tokens.push({ type: { kind: 'constant', name: 'phi' }, text: ident, start: startIndex, end: i });
        } else {
          tokens.push({ type: { kind: 'variable', name: ident }, text: ident, start: startIndex, end: i });
        }
        continue;
      }

      // Skip unhandled characters
      i++;
    }

    tokens.push({ type: { kind: 'eof' }, text: '', start: len, end: len });
    return tokens;
  }
}
