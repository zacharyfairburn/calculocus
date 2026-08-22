import { Parser } from './parser';
import { evaluateAST, ExpressionNode } from './ast';

export interface DomainRestriction {
  raw: string;
  varName: string;
  min: number;
  max: number;
  minInclusive: boolean;
  maxInclusive: boolean;
  forbiddenValues?: number[];
  isRestricted: boolean;
  check: (val: number, context?: Record<string, number>) => boolean;
  toLatex: () => string;
}

/**
 * Splits an expression string like "sin(x) {0 < x < 2}", "y = x^2 {-3 <= x <= 3}",
 * "cos(x) for 0 < x < pi", "x^2, 0 <= x <= 2", or "sin(x) [0, pi]"
 * into formula and domain condition string.
 */
export function splitFormulaAndDomain(rawInput: string): { formula: string; domainStr: string | null } {
  if (!rawInput) return { formula: '', domainStr: null };

  let trimmed = rawInput.trim();

  // 1. Match trailing LaTeX or standard {...} block: e.g. "sin(x) {0 < x < 2}" or "\left\{ 0 < x < 2 \right\}"
  const latexBraceMatch = trimmed.match(/^(.*?)\s*(?:\\left\s*\\\{|\\\{|\{)\s*([^}]+?)\s*(?:\\right\s*\\\}|\\\}|\})\s*$/i);
  if (latexBraceMatch && latexBraceMatch[2].trim()) {
    return {
      formula: latexBraceMatch[1].trim(),
      domainStr: latexBraceMatch[2].trim(),
    };
  }

  // 2. Match "for 0 < x < 2" or "where 0 < x < 2" or "| 0 < x < 2"
  const keywordMatch = trimmed.match(/^(.*?)\s+(?:for|where|with|\||;)\s+([a-zA-Z0-9_\s<>=≤≥\.\+\-\*\/\\piθt\(\)]+)$/i);
  if (keywordMatch && keywordMatch[2].trim()) {
    const candidateDomain = keywordMatch[2].trim();
    if (/[<>=≤≥]|in|\\in/.test(candidateDomain)) {
      return {
        formula: keywordMatch[1].trim(),
        domainStr: candidateDomain,
      };
    }
  }

  // 3. Match comma-separated condition e.g. "sin(x), 0 < x < 2" or "x^2, x in [0, 2]"
  const commaMatch = trimmed.match(/^(.*?)\s*,\s*([a-zA-Z0-9_\s<>=≤≥\.\+\-\*\/\\piθt\(\)\[\]]+)$/i);
  if (commaMatch && commaMatch[2].trim()) {
    const candidateDomain = commaMatch[2].trim();
    if (/[<>=≤≥]|in|\\in|\[|\(/.test(candidateDomain)) {
      return {
        formula: commaMatch[1].trim(),
        domainStr: candidateDomain,
      };
    }
  }

  return { formula: trimmed, domainStr: null };
}

/**
 * Strips 'y =', 'f(x) =', 'r =', 'r(theta) =', 'z =' and trailing domain blocks
 * to produce clean algebraic expression for evaluation.
 */
export function cleanFormula(raw: string): string {
  if (!raw) return '';
  const { formula } = splitFormulaAndDomain(raw);
  let cleaned = formula.trim();

  // Strip leading function prefixes
  cleaned = cleaned.replace(/^(?:y\s*\(\s*x\s*\)|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\)|h\s*\(\s*x\s*\)|y|r\s*\(\s*(?:theta|θ)\s*\)|r|z)\s*=\s*/i, '').trim();
  return cleaned;
}

/**
 * Safely evaluates a numeric boundary string like "2*pi", "-3", "pi/2", "sqrt(2)"
 */
export function evalBoundString(str: string, context?: Record<string, number>): number {
  if (!str) return NaN;
  let s = str.trim().toLowerCase();

  if (s === 'inf' || s === 'infinity' || s === '+inf' || s === '+infinity') return Infinity;
  if (s === '-inf' || s === '-infinity') return -Infinity;
  if (s === 'pi' || s === '\\pi') return Math.PI;
  if (s === '-pi' || s === '-\\pi') return -Math.PI;
  if (s === '2pi' || s === '2*pi' || s === '2\\pi' || s === '2*\\pi') return 2 * Math.PI;
  if (s === '-2pi' || s === '-2*pi' || s === '-2\\pi') return -2 * Math.PI;
  if (s === 'pi/2' || s === '\\pi/2') return Math.PI / 2;
  if (s === '-pi/2' || s === '-\\pi/2') return -Math.PI / 2;

  try {
    const cleaned = str
      .replace(/\\pi/gi, 'pi')
      .replace(/\\sqrt\{([^}]+)\}/gi, 'sqrt($1)')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/gi, '($1)/($2)');
    const ast = Parser.parse(cleaned);
    return evaluateAST(ast, context || {});
  } catch {
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  }
}

/**
 * Robustly parses a domain restriction string (e.g., "0 < x < 2", "x > 0", "-1 <= x <= 4", "{0 <= x <= 2*pi}", "[0, 2]", "x in [-1, 3]")
 */
export function parseDomainRestriction(rawDomainStr: string | null | undefined, defaultVar = 'x'): DomainRestriction | null {
  if (!rawDomainStr) return null;

  // Clean raw LaTeX or brackets
  let clean = rawDomainStr
    .replace(/\\left\s*\\\{|\\right\s*\\\}|\\\{|\\\}|^\{|\}$/gi, '')
    .replace(/\\le(q)?/gi, '<=')
    .replace(/\\ge(q)?/gi, '>=')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/\\neq|≠/g, '!=')
    .trim();

  if (!clean) return null;

  let min = -Infinity;
  let max = Infinity;
  let minInclusive = false;
  let maxInclusive = false;
  const forbiddenValues: number[] = [];
  let varName = defaultVar;
  let isMatched = false;

  // 1. Interval notation: "[a, b]", "(a, b)", "[a, b)", "(-inf, 5]", "x in [0, 2]", "x \in (0, pi]"
  const intervalRegex = /^(?:([a-zA-Zθt_]+)\s*(?:in|\\in|∈)\s*)?([\[\(])\s*(.+?)\s*,\s*(.+?)\s*([\]\)])$/i;
  const intervalMatch = clean.match(intervalRegex);
  if (intervalMatch) {
    if (intervalMatch[1]) varName = intervalMatch[1];
    const leftBracket = intervalMatch[2];
    const leftStr = intervalMatch[3];
    const rightStr = intervalMatch[4];
    const rightBracket = intervalMatch[5];

    min = evalBoundString(leftStr);
    max = evalBoundString(rightStr);
    minInclusive = leftBracket === '[';
    maxInclusive = rightBracket === ']';
    isMatched = true;
  }

  // 2. Compound range: A (<|<=) x (<|<=) B (e.g. "0 < x < 2", "-3 <= x <= 5", "0 <= theta <= 2 * pi", "-pi/2 < t < pi/2")
  if (!isMatched) {
    const compoundRegex = /^(.+?)\s*(<=|<)\s*([a-zA-Zθt_]+)\s*(<=|<)\s*(.+)$/i;
    const compoundMatch = clean.match(compoundRegex);

    if (compoundMatch) {
      const leftValStr = compoundMatch[1].trim();
      const leftOp = compoundMatch[2];
      varName = compoundMatch[3].trim();
      const rightOp = compoundMatch[4];
      const rightValStr = compoundMatch[5].trim();

      min = evalBoundString(leftValStr);
      max = evalBoundString(rightValStr);
      minInclusive = leftOp === '<=';
      maxInclusive = rightOp === '<=';
      isMatched = true;
    }
  }

  // 3. Reversed Compound range: B (>|>=) x (>|>=) A (e.g. "5 >= x > 0")
  if (!isMatched) {
    const revCompoundRegex = /^(.+?)\s*(>=|>)\s*([a-zA-Zθt_]+)\s*(>=|>)\s*(.+)$/i;
    const revMatch = clean.match(revCompoundRegex);
    if (revMatch) {
      const topValStr = revMatch[1].trim();
      const topOp = revMatch[2];
      varName = revMatch[3].trim();
      const botOp = revMatch[4];
      const botValStr = revMatch[5].trim();

      max = evalBoundString(topValStr);
      min = evalBoundString(botValStr);
      maxInclusive = topOp === '>=';
      minInclusive = botOp === '>=';
      isMatched = true;
    }
  }

  // 4. Single variable inequality on left: "x > A", "x >= A", "x < B", "x <= B", "x != C"
  if (!isMatched) {
    const singleVarLeftRegex = /^([a-zA-Zθt_]+)\s*(<=|<|>=|>|!=|==)\s*(.+)$/i;
    const singleMatch = clean.match(singleVarLeftRegex);
    if (singleMatch) {
      varName = singleMatch[1].trim();
      const op = singleMatch[2];
      const val = evalBoundString(singleMatch[3].trim());

      if (op === '>' || op === '>=') {
        min = val;
        minInclusive = op === '>=';
        isMatched = true;
      } else if (op === '<' || op === '<=') {
        max = val;
        maxInclusive = op === '<=';
        isMatched = true;
      } else if (op === '!=' || op === '!==') {
        forbiddenValues.push(val);
        isMatched = true;
      }
    }
  }

  // 5. Single number on left: "A < x", "A <= x", "B > x", "B >= x"
  if (!isMatched) {
    const singleNumLeftRegex = /^(.+?)\s*(<=|<|>=|>)\s*([a-zA-Zθt_]+)$/i;
    const numLeftMatch = clean.match(singleNumLeftRegex);
    if (numLeftMatch) {
      const val = evalBoundString(numLeftMatch[1].trim());
      const op = numLeftMatch[2];
      varName = numLeftMatch[3].trim();

      if (op === '<' || op === '<=') {
        min = val;
        minInclusive = op === '<=';
        isMatched = true;
      } else if (op === '>' || op === '>=') {
        max = val;
        maxInclusive = op === '>=';
        isMatched = true;
      }
    }
  }

  // Swap if min > max
  if (min > max && min !== -Infinity && max !== Infinity) {
    const tmp = min;
    min = max;
    max = tmp;
    const tmpInc = minInclusive;
    minInclusive = maxInclusive;
    maxInclusive = tmpInc;
  }

  // Fallback: evaluate arbitrary boolean condition using AST
  let conditionAst: ExpressionNode | null = null;
  if (!isMatched) {
    try {
      conditionAst = Parser.parse(clean);
    } catch {
      // Failed to parse condition
    }
  }

  return {
    raw: clean,
    varName,
    min,
    max,
    minInclusive,
    maxInclusive,
    forbiddenValues,
    isRestricted: min !== -Infinity || max !== Infinity || forbiddenValues.length > 0 || conditionAst !== null,
    check: (val: number, context: Record<string, number> = {}): boolean => {
      if (isNaN(val) || !isFinite(val)) return false;

      // Check min bound with tolerance
      if (min !== -Infinity) {
        if (minInclusive) {
          if (val < min - 1e-9) return false;
        } else {
          if (val <= min + 1e-9) return false;
        }
      }

      // Check max bound with tolerance
      if (max !== Infinity) {
        if (maxInclusive) {
          if (val > max + 1e-9) return false;
        } else {
          if (val >= max - 1e-9) return false;
        }
      }

      // Check forbidden values (e.g. x != 0)
      for (const fb of forbiddenValues) {
        if (Math.abs(val - fb) < 1e-7) return false;
      }

      // Check AST condition if present
      if (conditionAst) {
        try {
          const evalCtx = { ...context, [varName]: val, x: val, t: val, theta: val };
          const res = evaluateAST(conditionAst, evalCtx);
          return Boolean(res);
        } catch {
          return true;
        }
      }

      return true;
    },
    toLatex: (): string => {
      if (min !== -Infinity && max !== Infinity) {
        const leftOp = minInclusive ? '\\le' : '<';
        const rightOp = maxInclusive ? '\\le' : '<';
        const formatB = (v: number) =>
          Math.abs(v - Math.PI) < 1e-4
            ? '\\pi'
            : Math.abs(v - 2 * Math.PI) < 1e-4
            ? '2\\pi'
            : Math.abs(v - Math.PI / 2) < 1e-4
            ? '\\frac{\\pi}{2}'
            : Number.isInteger(v)
            ? v.toString()
            : v.toFixed(2);
        return `\\{${formatB(min)} ${leftOp} ${varName} ${rightOp} ${formatB(max)}\\}`;
      }
      if (min !== -Infinity) {
        const op = minInclusive ? '\\ge' : '>';
        const minStr = Math.abs(min - Math.PI) < 1e-4 ? '\\pi' : Number.isInteger(min) ? min.toString() : min.toFixed(2);
        return `\\{${varName} ${op} ${minStr}\\}`;
      }
      if (max !== Infinity) {
        const op = maxInclusive ? '\\le' : '<';
        const maxStr = Math.abs(max - Math.PI) < 1e-4 ? '\\pi' : Number.isInteger(max) ? max.toString() : max.toFixed(2);
        return `\\{${varName} ${op} ${maxStr}\\}`;
      }
      return `\\{${clean}\\}`;
    },
  };
}

/**
 * Extracts parametric component expressions x(t) and y(t) from strings like:
 * - "(cos(t), sin(t))"
 * - "[3*cos(t), 2*sin(t)]"
 * - "cos(t), sin(t)"
 * - "x = cos(t), y = sin(t)"
 * - "x(t) = cos(t); y(t) = sin(t)"
 * - or fallbacks
 */
export function parseParametricExpression(
  rawInput: string,
  fallbackX = 'cos(t)',
  fallbackY = 'sin(t)'
): { xExpr: string; yExpr: string; domainStr: string | null } {
  if (!rawInput || !rawInput.trim()) {
    return { xExpr: fallbackX, yExpr: fallbackY, domainStr: null };
  }

  const { formula, domainStr } = splitFormulaAndDomain(rawInput);
  let cleaned = formula.trim();

  // Strip enclosing ( ) or [ ]
  if ((cleaned.startsWith('(') && cleaned.endsWith(')')) || (cleaned.startsWith('[') && cleaned.endsWith(']'))) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Split by comma or semicolon
  const parts = cleaned.split(/[,;]/);
  if (parts.length >= 2) {
    let p0 = parts[0].trim().replace(/^(?:x\s*\(\s*t\s*\)|x)\s*=\s*/i, '').trim();
    let p1 = parts[1].trim().replace(/^(?:y\s*\(\s*t\s*\)|y)\s*=\s*/i, '').trim();
    return {
      xExpr: p0 || fallbackX,
      yExpr: p1 || fallbackY,
      domainStr,
    };
  }

  return {
    xExpr: fallbackX,
    yExpr: fallbackY,
    domainStr,
  };
}
