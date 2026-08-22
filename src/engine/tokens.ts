export type TokenType = 
  | { kind: 'number'; value: number }
  | { kind: 'variable'; name: string }
  | { kind: 'constant'; name: 'pi' | 'e' | 'phi' }
  | { kind: 'plus' }
  | { kind: 'minus' }
  | { kind: 'multiply' }
  | { kind: 'divide' }
  | { kind: 'power' }
  | { kind: 'factorial' }
  | { kind: 'modulo' }
  | { kind: 'pipe' }
  | { kind: 'function'; name: MathFunctionName }
  | { kind: 'leftParen' }
  | { kind: 'rightParen' }
  | { kind: 'comma' }
  | { kind: 'equals' }
  | { kind: 'lessThan' }
  | { kind: 'lessThanOrEqual' }
  | { kind: 'greaterThan' }
  | { kind: 'greaterThanOrEqual' }
  | { kind: 'eof' };

export type MathFunctionName =
  | 'sin' | 'cos' | 'tan'
  | 'asin' | 'acos' | 'atan'
  | 'sec' | 'csc' | 'cot'
  | 'asec' | 'acsc' | 'acot'
  | 'sinh' | 'cosh' | 'tanh'
  | 'asinh' | 'acosh' | 'atanh'
  | 'ln' | 'log' | 'log10' | 'log2'
  | 'exp' | 'sqrt' | 'cbrt' | 'root' | 'nthroot'
  | 'abs' | 'sgn' | 'sign'
  | 'floor' | 'ceil' | 'round' | 'trunc'
  | 'hypot' | 'min' | 'max' | 'gcd' | 'lcm' | 'nCr' | 'nPr'
  | 'diff' | 'integrate'
  | 're' | 'im' | 'arg' | 'conj';

export interface Token {
  type: TokenType;
  text: string;
  start: number;
  end: number;
}
