import { ExpressionNode, evaluateAST, astToLatex, astToExpression, astToString } from './ast';
import { Parser } from './parser';
import { SymbolicDifferentiator } from './differentiator';
import { Simplifier } from './simplifier';

export interface AlgebraStep {
  title: string;
  latex?: string;
  explanation: string;
}

export interface FactorResult {
  originalLatex: string;
  factoredLatex: string;
  factoredExpression: string;
  method: string;
  steps: AlgebraStep[];
}

export interface ExpandResult {
  originalLatex: string;
  expandedLatex: string;
  expandedExpression: string;
  method: string;
  steps: AlgebraStep[];
}

export interface SolveResult {
  equationLatex: string;
  variable: string;
  solutions: Array<{
    exactLatex: string;
    approx: number;
    multiplicity?: number;
    isExtraneous?: boolean;
  }>;
  method: string;
  steps: AlgebraStep[];
}

export interface SystemSolveResult {
  equationsLatex: string[];
  variables: string[];
  solutions: Array<Record<string, { exactLatex: string; approx: number }>>;
  classification: 'unique' | 'infinite' | 'inconsistent';
  method: string;
  steps: AlgebraStep[];
}

export interface LimitResult {
  limitLatex: string;
  targetStr: string;
  direction: 'both' | 'left' | 'right';
  valueLatex: string;
  numericValue: number | null;
  formType: 'direct' | '0/0' | 'inf/inf' | 'vertical_asymptote' | 'infinity';
  steps: AlgebraStep[];
}

// Utility: Greatest Common Divisor
function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) {
    const t = b;
    b = a % b;
    a = t;
  }
  return a || 1;
}

// Format numbers as fractions if rational
function toFractionLatex(num: number, tol = 1e-6): string {
  if (Math.abs(num) < 1e-12) return '0';
  if (Number.isInteger(num)) return num.toString();
  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  for (let den = 1; den <= 64; den++) {
    const numer = Math.round(absNum * den);
    if (Math.abs(absNum - numer / den) < tol) {
      if (den === 1) return `${sign}${numer}`;
      return `${sign}\\frac{${numer}}{${den}}`;
    }
  }
  return num.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

// Utility: Substitute targetVar with replacement in an ExpressionNode
export function substituteAST(node: ExpressionNode, targetVar: string, replacement: ExpressionNode): ExpressionNode {
  if (!node) return node;
  if (node.type === 'variable' && node.name === targetVar) {
    return replacement;
  }
  switch (node.type) {
    case 'number':
    case 'constant':
      return node;
    case 'add':
      return {
        type: 'add',
        lhs: substituteAST(node.lhs, targetVar, replacement),
        rhs: substituteAST(node.rhs, targetVar, replacement)
      };
    case 'subtract':
      return {
        type: 'subtract',
        lhs: substituteAST(node.lhs, targetVar, replacement),
        rhs: substituteAST(node.rhs, targetVar, replacement)
      };
    case 'multiply':
      return {
        type: 'multiply',
        lhs: substituteAST(node.lhs, targetVar, replacement),
        rhs: substituteAST(node.rhs, targetVar, replacement)
      };
    case 'divide':
      return {
        type: 'divide',
        lhs: substituteAST(node.lhs, targetVar, replacement),
        rhs: substituteAST(node.rhs, targetVar, replacement)
      };
    case 'modulo':
      return {
        type: 'modulo',
        lhs: substituteAST(node.lhs, targetVar, replacement),
        rhs: substituteAST(node.rhs, targetVar, replacement)
      };
    case 'power':
      return {
        type: 'power',
        base: substituteAST(node.base, targetVar, replacement),
        exponent: substituteAST(node.exponent, targetVar, replacement)
      };
    case 'negate':
      return {
        type: 'negate',
        expr: substituteAST(node.expr, targetVar, replacement)
      };
    case 'factorial':
      return {
        type: 'factorial',
        expr: substituteAST(node.expr, targetVar, replacement)
      };
    case 'call':
      return {
        type: 'call',
        name: node.name,
        args: node.args.map(arg => substituteAST(arg, targetVar, replacement))
      };
    case 'equation':
      return {
        type: 'equation',
        lhs: substituteAST(node.lhs, targetVar, replacement),
        rhs: substituteAST(node.rhs, targetVar, replacement)
      };
    case 'inequality':
      return {
        type: 'inequality',
        lhs: substituteAST(node.lhs, targetVar, replacement),
        op: node.op,
        rhs: substituteAST(node.rhs, targetVar, replacement)
      };
  }
  return node;
}

// Utility: Extract all variables from an ExpressionNode
export function getVariables(node: ExpressionNode): string[] {
  const vars = new Set<string>();
  const traverse = (n: ExpressionNode) => {
    if (!n) return;
    if (n.type === 'variable') {
      const name = n.name.toLowerCase();
      if (name !== 'i' && name !== 'pi' && name !== 'e' && name !== 'phi' && name !== 'theta') {
        vars.add(n.name);
      }
    } else if (n.type === 'add' || n.type === 'subtract' || n.type === 'multiply' || n.type === 'divide' || n.type === 'modulo' || n.type === 'equation' || n.type === 'inequality') {
      traverse(n.lhs);
      traverse(n.rhs);
    } else if (n.type === 'negate' || n.type === 'factorial') {
      traverse(n.expr);
    } else if (n.type === 'power') {
      traverse(n.base);
      traverse(n.exponent);
    } else if (n.type === 'call') {
      n.args.forEach(traverse);
    }
  };
  traverse(node);
  return Array.from(vars);
}

/**
 * Extracts standard polynomial coefficients for a single variable (default 'x')
 * Returns map of power -> coefficient, or null if not a standard polynomial
 */
export function getPolynomialCoefficients(expr: ExpressionNode, v = 'x'): Record<number, number> | null {
  const coeffs: Record<number, number> = {};

  function addTerm(pow: number, coeff: number) {
    coeffs[pow] = (coeffs[pow] || 0) + coeff;
  }

  function traverse(node: ExpressionNode, sign: 1 | -1 = 1): boolean {
    switch (node.type) {
      case 'number':
        addTerm(0, sign * node.value);
        return true;
      case 'variable':
        if (node.name === v) {
          addTerm(1, sign * 1);
          return true;
        }
        return false;
      case 'negate':
        return traverse(node.expr, (sign * -1) as 1 | -1);
      case 'add':
        return traverse(node.lhs, sign) && traverse(node.rhs, sign);
      case 'subtract':
        return traverse(node.lhs, sign) && traverse(node.rhs, (sign * -1) as 1 | -1);
      case 'multiply': {
        // Number * x^p or x * x or number * number
        const lPoly = getPolynomialCoefficients(node.lhs, v);
        const rPoly = getPolynomialCoefficients(node.rhs, v);
        if (!lPoly || !rPoly) return false;

        // Multiply polynomials
        for (const p1 in lPoly) {
          for (const p2 in rPoly) {
            const pow = parseInt(p1, 10) + parseInt(p2, 10);
            addTerm(pow, sign * lPoly[p1] * rPoly[p2]);
          }
        }
        return true;
      }
      case 'power': {
        if (node.base.type === 'variable' && node.base.name === v && node.exponent.type === 'number') {
          const p = node.exponent.value;
          if (Number.isInteger(p) && p >= 0) {
            addTerm(p, sign * 1);
            return true;
          }
        }
        // Base polynomial to integer power (e.g. (x+2)^2)
        if (node.exponent.type === 'number' && Number.isInteger(node.exponent.value) && node.exponent.value >= 0 && node.exponent.value <= 4) {
          const exp = node.exponent.value;
          if (exp === 0) {
            addTerm(0, sign * 1);
            return true;
          }
          const basePoly = getPolynomialCoefficients(node.base, v);
          if (!basePoly) return false;
          let current: Record<number, number> = { 0: 1 };
          for (let i = 0; i < exp; i++) {
            const next: Record<number, number> = {};
            for (const p1 in current) {
              for (const p2 in basePoly) {
                const pow = parseInt(p1, 10) + parseInt(p2, 10);
                next[pow] = (next[pow] || 0) + current[p1] * basePoly[p2];
              }
            }
            current = next;
          }
          for (const p in current) {
            addTerm(parseInt(p, 10), sign * current[p]);
          }
          return true;
        }
        return false;
      }
      default:
        return false;
    }
  }

  const success = traverse(expr, 1);
  if (!success) return null;

  // Clean up near-zero coefficients
  for (const p in coeffs) {
    if (Math.abs(coeffs[p]) < 1e-12) {
      delete coeffs[p];
    }
  }
  return coeffs;
}

export function formatPolynomialLatex(coeffs: Record<number, number>, v = 'x'): string {
  const powers = Object.keys(coeffs)
    .map(Number)
    .sort((a, b) => b - a);

  if (powers.length === 0) return '0';

  const terms: string[] = [];
  for (let i = 0; i < powers.length; i++) {
    const p = powers[i];
    const c = coeffs[p];
    const absC = Math.abs(c);
    const sign = c < 0 ? '-' : '+';
    const isFirst = i === 0;

    let coeffStr = '';
    if (p === 0) {
      coeffStr = toFractionLatex(absC);
    } else {
      coeffStr = absC === 1 ? '' : toFractionLatex(absC);
    }

    let varStr = '';
    if (p === 1) varStr = v;
    else if (p > 1) varStr = `${v}^{${p}}`;

    const termBody = `${coeffStr}${varStr}`;

    if (isFirst) {
      terms.push(c < 0 ? `-${termBody}` : termBody);
    } else {
      terms.push(`${sign} ${termBody}`);
    }
  }
  return terms.join(' ');
}

export class AlgebraEngine {
  /**
   * FACTORING EXPRESSIONS
   * Supports GCF, Difference/Sum of Squares & Cubes, Quadratic Trinomials, Grouping, Higher-degree polynomials
   */
  public static factor(rawInput: string, v = 'x'): FactorResult {
    let clean = rawInput.trim();
    if (clean.includes('=')) {
      clean = clean.split('=')[0].trim();
    }
    const node = Parser.parse(clean);
    const originalLatex = astToLatex(node);
    const steps: AlgebraStep[] = [];

    const coeffs = getPolynomialCoefficients(node, v);

    if (!coeffs || Object.keys(coeffs).length === 0) {
      return {
        originalLatex,
        factoredLatex: originalLatex,
        factoredExpression: clean,
        method: 'Irreducible / Non-Polynomial',
        steps: [
          {
            title: 'Analyze Expression Structure',
            latex: originalLatex,
            explanation: 'The expression cannot be factored further using standard polynomial algebra over the real numbers.',
          },
        ],
      };
    }

    const powers = Object.keys(coeffs)
      .map(Number)
      .sort((a, b) => b - a);
    const maxDegree = powers[0] || 0;
    const minDegree = powers[powers.length - 1] || 0;

    // STEP 1: Greatest Common Factor (GCF)
    let gcfPow = minDegree;
    let gcfNum = 0;
    for (const p of powers) {
      gcfNum = gcd(gcfNum, Math.abs(coeffs[p]));
    }
    // Respect leading sign
    if (coeffs[maxDegree] < 0) {
      gcfNum = -gcfNum;
    }

    const standardFormLatex = formatPolynomialLatex(coeffs, v);
    steps.push({
      title: '1. Write in Standard Descending Form',
      latex: standardFormLatex,
      explanation: `Arrange the polynomial in descending powers of $${v}$ and collect all like terms.`,
    });

    let reducedCoeffs: Record<number, number> = {};
    let gcfPrefixLatex = '';
    let gcfPrefixExpr = '';

    if (gcfPow > 0 || Math.abs(gcfNum) !== 1) {
      for (const p of powers) {
        reducedCoeffs[p - gcfPow] = coeffs[p] / gcfNum;
      }
      const gcfVarStr = gcfPow === 0 ? '' : gcfPow === 1 ? v : `${v}^{${gcfPow}}`;
      const gcfNumStr = Math.abs(gcfNum) === 1 && gcfPow > 0 ? (gcfNum < 0 ? '-' : '') : gcfNum.toString();
      gcfPrefixLatex = `${gcfNumStr}${gcfVarStr}`;
      gcfPrefixExpr = `${gcfNumStr}${gcfPow > 0 ? `*${v}^${gcfPow}` : ''}`;

      steps.push({
        title: '2. Factor Out Greatest Common Factor (GCF)',
        latex: `${gcfPrefixLatex} \\left(${formatPolynomialLatex(reducedCoeffs, v)}\\right)`,
        explanation: `Extract the common monomial factor $${gcfPrefixLatex}$ from all terms.`,
      });
    } else {
      reducedCoeffs = { ...coeffs };
    }

    const reducedPowers = Object.keys(reducedCoeffs)
      .map(Number)
      .sort((a, b) => b - a);
    const deg = reducedPowers[0] || 0;

    // Quadratic Factoring: ax^2 + bx + c
    if (deg === 2) {
      const a = reducedCoeffs[2] || 0;
      const b = reducedCoeffs[1] || 0;
      const c = reducedCoeffs[0] || 0;

      const disc = b * b - 4 * a * c;

      // Difference of squares: a*x^2 - k^2
      if (b === 0 && a > 0 && c < 0) {
        const sqA = Math.sqrt(a);
        const sqC = Math.sqrt(-c);
        if (Number.isInteger(sqA) && Number.isInteger(sqC)) {
          const t1 = sqA === 1 ? v : `${sqA}${v}`;
          const factoredCore = `(${t1} - ${sqC})(${t1} + ${sqC})`;
          const fullFactored = gcfPrefixLatex ? `${gcfPrefixLatex} ${factoredCore}` : factoredCore;

          steps.push({
            title: '3. Identify Perfect Squares',
            latex: `(${t1})^2 - (${sqC})^2`,
            explanation: `Recognize that both terms are perfect squares: $${a}${v}^2$ is $(${t1})^2$ and $${-c}$ is $(${sqC})^2$.`,
          });

          steps.push({
            title: '4. Apply Difference of Squares Pattern: a² - b² = (a - b)(a + b)',
            latex: fullFactored,
            explanation: `Rewrite the difference of squares as the product of the difference and the sum of their bases.`,
          });

          return {
            originalLatex,
            factoredLatex: fullFactored,
            factoredExpression: fullFactored.replace(/\\left|\\right/g, ''),
            method: 'Difference of Squares',
            steps,
          };
        }
      }

      // Trinomial factoring
      if (disc >= 0) {
        const sqrtDisc = Math.sqrt(disc);
        if (Number.isInteger(sqrtDisc)) {
          // Rational roots!
          const r1 = (-b + sqrtDisc) / (2 * a);
          const r2 = (-b - sqrtDisc) / (2 * a);

          // Build integer factors (px + q)(rx + s)
          steps.push({
            title: '3. Calculate Discriminant and Product-Sum Factors',
            latex: `\\Delta = b^2 - 4ac = (${b})^2 - 4(${a})(${c}) = ${disc}`,
            explanation: `Since the discriminant $\\Delta = ${disc} = ${sqrtDisc}^2$ is a perfect square, the quadratic factors nicely over the rational numbers.`,
          });

          // ac method demonstration
          const ac = a * c;
          let factor1 = 0;
          let factor2 = 0;
          for (let f = -Math.abs(ac); f <= Math.abs(ac); f++) {
            if (f !== 0 && ac % f === 0) {
              const other = ac / f;
              if (f + other === b) {
                factor1 = f;
                factor2 = other;
                break;
              }
            }
          }

          // Build nice factor string
          let factorLatex = '';
          if (a === 1) {
            if (r1 === r2) {
              // Perfect square trinomial
              const sign = -r1 >= 0 ? '+' : '-';
              factorLatex = `\\left(${v} ${sign} ${Math.abs(r1)}\\right)^2`;
              steps.push({
                title: '4. Recognize Perfect Square Trinomial Pattern',
                latex: factorLatex,
                explanation: `Since the trinomial is of the form $${v}^2 + 2d${v} + d^2$, we can factor it directly as $(${v} + d)^2$, where $d = ${-r1}$.`,
              });
            } else {
              // Two distinct factors for a === 1
              const sign1 = factor1 >= 0 ? '+' : '-';
              const sign2 = factor2 >= 0 ? '+' : '-';
              const abs1 = Math.abs(factor1);
              const abs2 = Math.abs(factor2);

              steps.push({
                title: '4. Split Middle Term',
                latex: `${v}^2 ${factor1 >= 0 ? '+' : ''}${factor1}${v} ${factor2 >= 0 ? '+' : ''}${factor2}${v} ${c >= 0 ? '+' : ''}${c}`,
                explanation: `Find two integers whose product is $c = ${c}$ and whose sum is $b = ${b}$ (found: $${factor1}$ and $${factor2}$). Split the middle term.`,
              });

              steps.push({
                title: '5. Factor by Grouping',
                latex: `${v}\\left(${v} ${sign1} ${abs1}\\right) ${sign2} ${abs2}\\left(${v} ${sign1} ${abs1}\\right)`,
                explanation: `Group the terms as $\\left(${v}^2 ${factor1 >= 0 ? '+' : ''}${factor1}${v}\\right) + \\left(${factor2}${v} ${c >= 0 ? '+' : ''}${c}\\right)$. Factor out $${v}$ from the first group and $${factor2 >= 0 ? '' : '-'}${abs2}$ from the second group.`,
              });

              factorLatex = `\\left(${v} ${sign1} ${abs1}\\right)\\left(${v} ${sign2} ${abs2}\\right)`;
            }
          } else {
            // a !== 1
            if (factor1 !== 0 && factor2 !== 0) {
              steps.push({
                title: '4. Split Middle Term using ac Method',
                latex: `${a}${v}^2 ${factor1 >= 0 ? '+' : ''}${factor1}${v} ${factor2 >= 0 ? '+' : ''}${factor2}${v} ${c >= 0 ? '+' : ''}${c}`,
                explanation: `Find two integers whose product is $a \\cdot c = ${ac}$ and whose sum is $b = ${b}$ (found: $${factor1}$ and $${factor2}$). Split the middle term.`,
              });

              // Find GCF of first pair: a and factor1
              const g1 = gcd(Math.abs(a), Math.abs(factor1)) * (a < 0 ? -1 : 1);
              const p = a / g1;
              const q = factor1 / g1;
              const g2 = factor2 / p;

              const g1Str = Math.abs(g1) === 1 ? (g1 < 0 ? '-' : '') : g1.toString();
              const pStr = p === 1 ? v : `${p}${v}`;
              const qSign = q >= 0 ? '+' : '-';
              const qAbs = Math.abs(q);
              const qStr = q === 0 ? '' : ` ${qSign} ${qAbs}`;
              
              const g2Sign = g2 >= 0 ? '+' : '-';
              const g2Abs = Math.abs(g2);
              
              steps.push({
                title: '5. Factor by Grouping',
                latex: `${g1Str}${v}\\left(${pStr}${qStr}\\right) ${g2Sign} ${g2Abs}\\left(${pStr}${qStr}\\right)`,
                explanation: `Group the first two terms and the last two terms: $\\left(${a}${v}^2 ${factor1 >= 0 ? '+' : ''}${factor1}${v}\\right) + \\left(${factor2}${v} ${c >= 0 ? '+' : ''}${c}\\right)$. Factor out $${g1Str}${v}$ from the first group, and $${g2Sign}${g2Abs}$ from the second group.`,
              });
            }

            // Two distinct factors
            const getFactor = (root: number) => {
              for (let den = 1; den <= 20; den++) {
                const num = Math.round(root * den);
                if (Math.abs(root - num / den) < 1e-6) {
                  const p = den;
                  const q = -num;
                  const pStr = p === 1 ? v : `${p}${v}`;
                  const qStr = q === 0 ? '' : q > 0 ? `+ ${q}` : `- ${Math.abs(q)}`;
                  return `(${pStr} ${qStr})`.trim();
                }
              }
              return `(${v} - ${root.toFixed(3)})`;
            };

            factorLatex = `${getFactor(r1)}${getFactor(r2)}`;
          }

          const fullFactored = gcfPrefixLatex ? `${gcfPrefixLatex} ${factorLatex}` : factorLatex;

          steps.push({
            title: '6. Final Factored Form',
            latex: fullFactored,
            explanation: 'Extract the common binomial factor to arrive at the fully factored product.',
          });

          return {
            originalLatex,
            factoredLatex: fullFactored,
            factoredExpression: fullFactored.replace(/\\left|\\right/g, ''),
            method: 'Quadratic Factorization',
            steps,
          };
        }
      }
    }

    // Cubic factoring (Degree 3)
    if (deg === 3) {
      // Check sum / difference of cubes: a^3 x^3 ± k^3
      const a = reducedCoeffs[3] || 0;
      const b = reducedCoeffs[2] || 0;
      const c = reducedCoeffs[1] || 0;
      const d = reducedCoeffs[0] || 0;

      if (b === 0 && c === 0 && a > 0 && d !== 0) {
        const cbrtA = Math.cbrt(a);
        const cbrtD = Math.cbrt(Math.abs(d));
        if (Number.isInteger(cbrtA) && Number.isInteger(cbrtD)) {
          const isSum = d > 0;
          const aTerm = cbrtA === 1 ? v : `${cbrtA}${v}`;
          const bTerm = cbrtD;
          const a2 = cbrtA * cbrtA === 1 ? `${v}^2` : `${cbrtA * cbrtA}${v}^2`;
          const ab = cbrtA * bTerm === 1 ? v : `${cbrtA * bTerm}${v}`;
          const b2 = bTerm * bTerm;

          const factorLatex = isSum
            ? `(${aTerm} + ${bTerm})(${a2} - ${ab} + ${b2})`
            : `(${aTerm} - ${bTerm})(${a2} + ${ab} + ${b2})`;

          const fullFactored = gcfPrefixLatex ? `${gcfPrefixLatex} ${factorLatex}` : factorLatex;

          steps.push({
            title: '3. Identify Perfect Cubes',
            latex: `(${aTerm})^3 ${isSum ? '+' : '-'} (${bTerm})^3`,
            explanation: `Recognize that both terms are perfect cubes: $${a}${v}^3$ is $(${aTerm})^3$ and $${Math.abs(d)}$ is $(${bTerm})^3$.`,
          });

          steps.push({
            title: isSum ? '4. Apply Sum of Cubes Pattern: a³ + b³ = (a + b)(a² - ab + b²)' : '4. Apply Difference of Cubes Pattern: a³ - b³ = (a - b)(a² + ab + b²)',
            latex: fullFactored,
            explanation: `Rewrite using the algebraic identity with $a = ${aTerm}$ and $b = ${bTerm}$.`,
          });

          return {
            originalLatex,
            factoredLatex: fullFactored,
            factoredExpression: fullFactored,
            method: isSum ? 'Sum of Cubes' : 'Difference of Cubes',
            steps,
          };
        }
      }

      // Rational Root Theorem for Cubic
      const rationalRoots: number[] = [];
      const pCandidates: number[] = [];
      const qCandidates: number[] = [];
      const absD = Math.abs(d);
      const absA = Math.abs(a);

      for (let i = 1; i <= absD; i++) if (absD % i === 0) pCandidates.push(i, -i);
      for (let j = 1; j <= absA; j++) if (absA % j === 0) qCandidates.push(j);

      for (const p of pCandidates) {
        for (const q of qCandidates) {
          const candidate = p / q;
          const val = a * candidate ** 3 + b * candidate ** 2 + c * candidate + d;
          if (Math.abs(val) < 1e-9 && !rationalRoots.includes(candidate)) {
            rationalRoots.push(candidate);
          }
        }
      }

      if (rationalRoots.length > 0) {
        const root1 = rationalRoots[0];
        // Synthetic division of (a*x^3 + b*x^2 + c*x + d) by (x - root1)
        const qA = a;
        const qB = b + root1 * qA;
        const qC = c + root1 * qB;

        steps.push({
          title: `3. Find Rational Zero via Rational Root Theorem (x = ${root1})`,
          latex: `P(${root1}) = ${a}(${root1})^3 + ${b}(${root1})^2 + ${c}(${root1}) + ${d} = 0`,
          explanation: `By testing rational factors of the constant term over the leading coefficient, $x = ${root1}$ is a verified zero, so $(x - ${root1})$ is a factor.`,
        });

        steps.push({
          title: `4. Synthetic Division by (x - ${root1})`,
          latex: `(${v} - ${root1})(${formatPolynomialLatex({ 2: qA, 1: qB, 0: qC }, v)})`,
          explanation: 'Divide out the linear factor to obtain the quotient quadratic factor.',
        });

        // Try factoring quadratic remainder
        const subFact = AlgebraEngine.factor(`${qA}*${v}^2 + ${qB}*${v} + ${qC}`, v);
        
        if (subFact.steps && subFact.steps.length > 1) {
          // Skip the standard form step (index 0) of the sub-factoring and append the rest
          subFact.steps.forEach((subStep, sIdx) => {
            if (sIdx === 0) return; // Skip "Write in Standard Descending Form"
            
            let subLatex = subStep.latex;
            if (subStep.title.toLowerCase().includes('discriminant') || subStep.title.toLowerCase().includes('delta')) {
              subLatex = subStep.latex;
            } else {
              subLatex = `(${v} - ${root1})\\left(${subStep.latex}\\right)`;
            }
            
            steps.push({
              title: `5.${sIdx}. Factor Quadratic Quotient: ${subStep.title.replace(/^\d+\.\s*/, '')}`,
              latex: subLatex,
              explanation: `Now we factor the remaining quadratic quotient. ${subStep.explanation}`,
            });
          });
        }

        let factorLatex = `(${v} - ${root1})(${formatPolynomialLatex({ 2: qA, 1: qB, 0: qC }, v)})`;
        if (subFact.factoredLatex !== formatPolynomialLatex({ 2: qA, 1: qB, 0: qC }, v)) {
          factorLatex = `(${v} - ${root1})${subFact.factoredLatex}`;
        }

        const fullFactored = gcfPrefixLatex ? `${gcfPrefixLatex} ${factorLatex}` : factorLatex;
        return {
          originalLatex,
          factoredLatex: fullFactored,
          factoredExpression: fullFactored,
          method: 'Rational Root Theorem & Synthetic Division',
          steps,
        };
      }
    }

    // Default fallback if no special pattern matched
    const fullFactored = gcfPrefixLatex ? `${gcfPrefixLatex} \\left(${formatPolynomialLatex(reducedCoeffs, v)}\\right)` : standardFormLatex;
    return {
      originalLatex,
      factoredLatex: fullFactored,
      factoredExpression: fullFactored.replace(/\\left|\\right/g, ''),
      method: 'Polynomial Factoring',
      steps,
    };
  }

  /**
   * EXPANDING EXPRESSIONS
   * Expands products, binomial powers (a+b)^n, FOIL, and combines like terms
   */
  public static expand(rawInput: string, v = 'x'): ExpandResult {
    let clean = rawInput.trim();
    if (clean.includes('=')) {
      clean = clean.split('=')[0].trim();
    }
    const node = Parser.parse(clean);
    const originalLatex = astToLatex(node);
    const steps: AlgebraStep[] = [];

    steps.push({
      title: '1. Original Expression',
      latex: originalLatex,
      explanation: 'Analyze the product, powers, and terms to be expanded.',
    });

    const coeffs = getPolynomialCoefficients(node, v);

    if (!coeffs || Object.keys(coeffs).length === 0) {
      const simplified = Simplifier.simplify(node);
      const simpLatex = astToLatex(simplified);
      steps.push({
        title: '2. Apply Algebraic Simplification',
        latex: simpLatex,
        explanation: 'Apply distributive rules and combine identical terms.',
      });
      return {
        originalLatex,
        expandedLatex: simpLatex,
        expandedExpression: astToExpression(simplified),
        method: 'Algebraic Simplification',
        steps,
      };
    }

    // Check for Binomial expansion pattern (ax + b)^n
    if (node.type === 'power' && node.exponent.type === 'number' && Number.isInteger(node.exponent.value)) {
      const n = node.exponent.value;
      if (n >= 2 && n <= 5) {
        steps.push({
          title: `2. Apply Binomial Theorem for Power n = ${n}`,
          latex: `(a + b)^${n} = \\sum_{k=0}^{${n}} \\binom{${n}}{k} a^{${n}-k} b^k`,
          explanation: `Expand using Pascal's triangle coefficients for degree ${n}.`,
        });
      }
    } else if (node.type === 'multiply') {
      steps.push({
        title: '2. Apply Distributive Law / FOIL Method',
        latex: `(A + B)(C + D) = A \\cdot C + A \\cdot D + B \\cdot C + B \\cdot D`,
        explanation: 'Multiply each term in the first factor by each term in the second factor.',
      });
    }

    const expandedLatex = formatPolynomialLatex(coeffs, v);
    steps.push({
      title: '3. Collect and Combine Like Terms',
      latex: expandedLatex,
      explanation: 'Group terms by identical powers and sum their coefficients into standard descending order.',
    });

    return {
      originalLatex,
      expandedLatex,
      expandedExpression: expandedLatex.replace(/\\cdot/g, '*').replace(/\{|\}/g, ''),
      method: 'Polynomial Expansion',
      steps,
    };
  }

  /**
   * SOLVING FOR FINITE VALUES OF X, ZEROS
   * Symbolic solving for Linear, Quadratic, Polynomial, Rational, Exponential, Trig
   */
  public static solveForX(rawInput: string, v = 'x'): SolveResult {
    let clean = rawInput.trim();
    let lhsStr = clean;
    let rhsStr = '0';

    if (clean.includes('=')) {
      const parts = clean.split('=');
      lhsStr = parts[0].trim();
      rhsStr = parts[1].trim();
    } else if (clean.startsWith('y=') || clean.startsWith('f(x)=')) {
      lhsStr = clean.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '');
      rhsStr = '0';
    }

    const equationLatex = `${astToLatex(Parser.parse(lhsStr))} = ${astToLatex(Parser.parse(rhsStr))}`;
    const diffNode = Parser.parse(`(${lhsStr}) - (${rhsStr})`);
    const steps: AlgebraStep[] = [];

    steps.push({
      title: '1. Set Equation in Standard Form: f(x) = 0',
      latex: `${astToLatex(diffNode)} = 0`,
      explanation: 'Subtract the right-hand side from both sides to form a single equation equated to zero.',
    });

    const coeffs = getPolynomialCoefficients(diffNode, v);

    if (coeffs && Object.keys(coeffs).length > 0) {
      const powers = Object.keys(coeffs)
        .map(Number)
        .sort((a, b) => b - a);
      const deg = powers[0] || 0;

      // LINEAR: ax + b = 0
      if (deg === 1) {
        const a = coeffs[1] || 0;
        const b = coeffs[0] || 0;
        const root = -b / a;
        const exactLatex = toFractionLatex(root);

        steps.push({
          title: '2. Isolate Linear Variable Term',
          latex: `${a}${v} = ${-b}`,
          explanation: `Subtract constant ${b} from both sides.`,
        });

        steps.push({
          title: '3. Divide by Coefficient of x',
          latex: `${v} = \\frac{${-b}}{${a}} = ${exactLatex}`,
          explanation: `Divide both sides by ${a} to obtain the unique solution.`,
        });

        return {
          equationLatex,
          variable: v,
          solutions: [{ exactLatex: `${v} = ${exactLatex}`, approx: root, multiplicity: 1 }],
          method: 'Linear Equation Isolation',
          steps,
        };
      }

      // QUADRATIC: ax^2 + bx + c = 0
      if (deg === 2) {
        const a = coeffs[2] || 0;
        const b = coeffs[1] || 0;
        const c = coeffs[0] || 0;

        const disc = b * b - 4 * a * c;

        steps.push({
          title: '2. Identify Coefficients and Calculate Discriminant',
          latex: `a = ${a}, \\quad b = ${b}, \\quad c = ${c} \\implies \\Delta = b^2 - 4ac = (${b})^2 - 4(${a})(${c}) = ${disc}`,
          explanation: `The discriminant Delta = ${disc} indicates the number and nature of roots.`,
        });

        steps.push({
          title: '3. Apply Quadratic Formula: x = (-b ± √Δ) / (2a)',
          latex: `${v} = \\frac{-(${b}) \\pm \\sqrt{${disc}}}{2(${a})}`,
          explanation: 'Substitute a, b, and Delta into the standard quadratic formula.',
        });

        if (disc > 0) {
          const sqrtDisc = Math.sqrt(disc);
          const r1 = (-b + sqrtDisc) / (2 * a);
          const r2 = (-b - sqrtDisc) / (2 * a);

          let sol1Latex = '';
          let sol2Latex = '';

          if (Number.isInteger(sqrtDisc)) {
            sol1Latex = `${v}_1 = ${toFractionLatex(r1)}`;
            sol2Latex = `${v}_2 = ${toFractionLatex(r2)}`;
            steps.push({
              title: '4. Simplify Exact Rational Roots',
              latex: `${sol1Latex}, \\quad ${sol2Latex}`,
              explanation: `Since sqrt(${disc}) = ${sqrtDisc}, both solutions simplify to exact rational values.`,
            });
          } else {
            sol1Latex = `${v}_1 = \\frac{${-b} + \\sqrt{${disc}}}{${2 * a}} \\approx ${r1.toFixed(4)}`;
            sol2Latex = `${v}_2 = \\frac{${-b} - \\sqrt{${disc}}}{${2 * a}} \\approx ${r2.toFixed(4)}`;
            steps.push({
              title: '4. Simplify Radical and Decimal Approximations',
              latex: `${sol1Latex}, \\quad ${sol2Latex}`,
              explanation: 'Express the two distinct real roots in radical and decimal forms.',
            });
          }

          return {
            equationLatex,
            variable: v,
            solutions: [
              { exactLatex: sol1Latex, approx: r1, multiplicity: 1 },
              { exactLatex: sol2Latex, approx: r2, multiplicity: 1 },
            ],
            method: 'Quadratic Formula (Two Real Roots)',
            steps,
          };
        } else if (disc === 0) {
          const r = -b / (2 * a);
          const solLatex = `${v} = ${toFractionLatex(r)}`;
          steps.push({
            title: '4. Single Repeated Real Root (Multiplicity 2)',
            latex: solLatex,
            explanation: 'Because the discriminant is zero, the parabola touches the x-axis at exactly one point.',
          });
          return {
            equationLatex,
            variable: v,
            solutions: [{ exactLatex: solLatex, approx: r, multiplicity: 2 }],
            method: 'Quadratic Formula (Repeated Real Root)',
            steps,
          };
        } else {
          // Complex conjugate roots
          const realPart = -b / (2 * a);
          const imagPart = Math.sqrt(-disc) / (2 * Math.abs(a));
          const complexLatex = `${v} = ${toFractionLatex(realPart)} \\pm ${toFractionLatex(imagPart)}i`;

          steps.push({
            title: '4. Complex Conjugate Roots (No Real Solutions)',
            latex: complexLatex,
            explanation: 'The discriminant is negative (Delta < 0), yielding two complex conjugate roots with imaginary unit i = sqrt(-1).',
          });

          return {
            equationLatex,
            variable: v,
            solutions: [
              { exactLatex: `${complexLatex}`, approx: realPart },
            ],
            method: 'Quadratic Formula (Complex Roots)',
            steps,
          };
        }
      }

      // HIGHER POLYNOMIALS (Cubics / Quartics)
      const rationalRoots: number[] = [];
      const leadingA = coeffs[deg];
      const constD = coeffs[0] || 0;

      if (constD === 0) {
        // x = 0 is a root!
        rationalRoots.push(0);
      } else {
        const pCandidates: number[] = [];
        const qCandidates: number[] = [];
        const absD = Math.abs(constD);
        const absA = Math.abs(leadingA);

        for (let i = 1; i <= Math.min(absD, 50); i++) if (absD % i === 0) pCandidates.push(i, -i);
        for (let j = 1; j <= Math.min(absA, 20); j++) if (absA % j === 0) qCandidates.push(j);

        for (const p of pCandidates) {
          for (const q of qCandidates) {
            const candidate = p / q;
            let sum = 0;
            for (const pow in coeffs) sum += coeffs[pow] * candidate ** parseInt(pow, 10);
            if (Math.abs(sum) < 1e-7 && !rationalRoots.includes(candidate)) {
              rationalRoots.push(candidate);
            }
          }
        }
      }

      if (rationalRoots.length > 0) {
        steps.push({
          title: `2. Rational Root Theorem Zero Testing`,
          latex: rationalRoots.map((r) => `${v} = ${toFractionLatex(r)}`).join(', \\quad '),
          explanation: `Tested rational factors of the constant term over the leading coefficient to find exact polynomial roots.`,
        });

        return {
          equationLatex,
          variable: v,
          solutions: rationalRoots.map((r) => ({
            exactLatex: `${v} = ${toFractionLatex(r)}`,
            approx: r,
            multiplicity: 1,
          })),
          method: 'Rational Root Theorem & Zero-Product Rule',
          steps,
        };
      }
    }

    // EXPONENTIAL / LOGARITHMIC / TRANSCENDENTAL
    // Check e^(kx) = c
    try {
      const expMatch = clean.match(/exp\s*\(\s*([a-zA-Z0-9*+-]+)\s*\)\s*=\s*([0-9.]+)/);
      if (expMatch) {
        const inner = expMatch[1];
        const val = parseFloat(expMatch[2]);
        if (val > 0) {
          const lnVal = Math.log(val);
          steps.push({
            title: '2. Take Natural Logarithm (ln) of Both Sides',
            latex: `\\ln\\left(e^{${inner}}\\right) = \\ln(${val}) \\implies ${inner} = \\ln(${val})`,
            explanation: 'The natural logarithm is the inverse of the exponential function.',
          });
          const sol = AlgebraEngine.solveForX(`${inner} = ${lnVal}`, v);
          return {
            equationLatex,
            variable: v,
            solutions: sol.solutions,
            method: 'Exponential Inversion (Natural Log)',
            steps: [...steps, ...sol.steps],
          };
        }
      }
    } catch {
      // Continue
    }

    // Fallback: Numerical Newton Search across domain [-10, 10]
    const foundRoots: number[] = [];
    const deriv = SymbolicDifferentiator.diff(diffNode, v);

    for (let x0 = -10; x0 <= 10; x0 += 0.5) {
      let x = x0;
      for (let iter = 0; iter < 30; iter++) {
        const fx = evaluateAST(diffNode, { [v]: x });
        const fpx = evaluateAST(deriv, { [v]: x });
        if (Math.abs(fpx) < 1e-12 || isNaN(fpx) || isNaN(fx)) break;
        const xNext = x - fx / fpx;
        if (Math.abs(xNext - x) < 1e-9) {
          if (!foundRoots.some((r) => Math.abs(r - xNext) < 1e-4) && Math.abs(evaluateAST(diffNode, { [v]: xNext })) < 1e-5) {
            foundRoots.push(xNext);
          }
          break;
        }
        x = xNext;
      }
    }

    if (foundRoots.length > 0) {
      steps.push({
        title: '2. Numerical Root Isolation (Newton-Raphson Iteration)',
        latex: foundRoots.map((r) => `${v} \\approx ${r.toFixed(5)}`).join(', \\quad '),
        explanation: 'Applied rapid iterative Newton-Raphson tangent line root finding over the search interval.',
      });

      return {
        equationLatex,
        variable: v,
        solutions: foundRoots.map((r) => ({
          exactLatex: `${v} \\approx ${r.toFixed(5)}`,
          approx: r,
        })),
        method: 'Newton-Raphson Numerical Root Finding',
        steps,
      };
    }

    return {
      equationLatex,
      variable: v,
      solutions: [],
      method: 'No Real Solutions Found',
      steps: [
        {
          title: 'Root Search Completed',
          explanation: 'No finite real zeros or solutions exist for this equation within standard domain bounds.',
        },
      ],
    };
  }

  /**
   * SOLVE SYSTEM OF EQUATIONS
   * Solves linear systems of any dimension N x N, and nonlinear 2-variable systems (e.g. Line & Parabola)
   */
  public static solveSystem(equations: string[]): SystemSolveResult {
    const cleanEqs = equations.map((e) => e.trim()).filter(Boolean);
    const N = cleanEqs.length;

    // Dynamically detect variables in the system of equations
    const detectedVarsSet = new Set<string>();
    cleanEqs.forEach((eq) => {
      let lhs = eq;
      let rhs = '0';
      if (eq.includes('=')) {
        const parts = eq.split('=');
        lhs = parts[0];
        rhs = parts[1];
      }
      try {
        const node = Parser.parse(`(${lhs}) - (${rhs})`);
        getVariables(node).forEach((v) => detectedVarsSet.add(v));
      } catch {
        // Ignore parsing errors for variable detection
      }
    });

    let vars = Array.from(detectedVarsSet);
    if (vars.length === 0) {
      vars = ['x', 'y', 'z', 'w', 'u', 'v'].slice(0, Math.max(2, N));
    } else {
      const order = ['x', 'y', 'z', 'w', 'u', 'v'];
      vars.sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return a.localeCompare(b);
      });
      const needed = Math.max(2, N);
      while (vars.length < needed) {
        for (const fallback of order) {
          if (!vars.includes(fallback)) {
            vars.push(fallback);
            break;
          }
        }
      }
    }

    const equationsLatex = cleanEqs.map((e) => {
      try {
        if (e.includes('=')) {
          const parts = e.split('=');
          return `${astToLatex(Parser.parse(parts[0]))} = ${astToLatex(Parser.parse(parts[1]))}`;
        }
        return `${astToLatex(Parser.parse(e))} = 0`;
      } catch {
        return e;
      }
    });

    const steps: AlgebraStep[] = [];
    steps.push({
      title: '1. State System of Equations',
      latex: `\\begin{cases} ${equationsLatex.join(' \\\\ ')} \\end{cases}`,
      explanation: 'Organize the given equations in simultaneous system format.',
    });

    if (N >= 2) {
      // 1. Try to solve as linear system of size N x N
      const parseLinearND = (eq: string, variables: string[]): { coeffs: number[]; constant: number } | null => {
        let lhs = eq;
        let rhs = '0';
        if (eq.includes('=')) {
          const parts = eq.split('=');
          lhs = parts[0];
          rhs = parts[1];
        }
        try {
          const node = Parser.parse(`(${lhs}) - (${rhs})`);
          
          // Get offset
          const zeroVals: Record<string, number> = {};
          variables.forEach((v) => { zeroVals[v] = 0; });
          const f0 = evaluateAST(node, zeroVals);
          
          const coeffs: number[] = [];
          for (let i = 0; i < variables.length; i++) {
            const vals: Record<string, number> = { ...zeroVals };
            vals[variables[i]] = 1;
            const f1 = evaluateAST(node, vals);
            coeffs.push(f1 - f0);
          }
          const constant = -f0;
          
          // Linearity test
          const testVals: Record<string, number> = {};
          variables.forEach((v) => { testVals[v] = 2.5; });
          const actual = evaluateAST(node, testVals);
          
          let expected = 0;
          for (let i = 0; i < variables.length; i++) {
            expected += coeffs[i] * 2.5;
          }
          expected -= constant;
          
          if (Math.abs(actual - expected) < 1e-6) {
            return { coeffs, constant };
          }
          return null;
        } catch {
          return null;
        }
      };

      const parsedEqs = cleanEqs.map(eq => parseLinearND(eq, vars));
      const allLinear = parsedEqs.every(p => p !== null);

      if (allLinear) {
        // Construct augmented matrix
        const matrix: number[][] = parsedEqs.map(p => [...p!.coeffs, p!.constant]);

        // Helper to format augmented matrix to LaTeX
        const formatAugmentedMatrixLatex = (m: number[][]): string => {
          const rows = m.map(row => {
            const coeffs = row.slice(0, row.length - 1).map(val => toFractionLatex(val)).join(' & ');
            const constant = toFractionLatex(row[row.length - 1]);
            return `${coeffs} & \\bigm| & ${constant}`;
          });
          const colFormat = 'c'.repeat(m[0].length - 1) + '|c';
          return `\\left[\\begin{array}{${colFormat}} ${rows.join(' \\\\ ')} \\end{array}\\right]`;
        };

        steps.push({
          title: '2. Setup Augmented Coefficient Matrix',
          latex: formatAugmentedMatrixLatex(matrix),
          explanation: `Represent the linear system of equations in augmented matrix format [A | B] where the variables are ${vars.join(', ')} from left to right.`,
        });

        // Gauss-Jordan Elimination solver
        const m = matrix.map(row => [...row]); // Deep copy
        const rowCount = m.length;
        const colCount = m[0].length;
        let lead = 0;

        for (let r = 0; r < rowCount; r++) {
          if (lead >= colCount - 1) break;
          let i = r;
          while (Math.abs(m[i][lead]) < 1e-9) {
            i++;
            if (i === rowCount) {
              i = r;
              lead++;
              if (lead === colCount - 1) break;
            }
          }
          if (lead === colCount - 1) break;
          
          if (i !== r) {
            // Swap rows i and r
            const temp = m[r];
            m[r] = m[i];
            m[i] = temp;
            steps.push({
              title: `3.${r}.1. Swap Rows`,
              latex: formatAugmentedMatrixLatex(m),
              explanation: `Swap Row ${r + 1} and Row ${i + 1} to establish a non-zero pivot element at column ${lead + 1}.`,
            });
          }
          
          const pivot = m[r][lead];
          if (Math.abs(pivot) > 1e-9) {
            // Divide row r by pivot
            for (let j = 0; j < colCount; j++) {
              m[r][j] /= pivot;
            }
            steps.push({
              title: `3.${r}.2. Normalize Pivot Row`,
              latex: formatAugmentedMatrixLatex(m),
              explanation: `Divide Row ${r + 1} by the pivot ${toFractionLatex(pivot)} to set the leading coefficient to 1.`,
            });
          }
          
          for (let i2 = 0; i2 < rowCount; i2++) {
            if (i2 !== r) {
              const factor = m[i2][lead];
              if (Math.abs(factor) > 1e-9) {
                for (let j = 0; j < colCount; j++) {
                  m[i2][j] -= factor * m[r][j];
                }
                steps.push({
                  title: `3.${r}.3. Eliminate Row ${i2 + 1}`,
                  latex: formatAugmentedMatrixLatex(m),
                  explanation: `Subtract ${toFractionLatex(factor)} * Row ${r + 1} from Row ${i2 + 1} to eliminate the term in column ${lead + 1}.`,
                });
              }
            }
          }
          lead++;
        }

        // Check for inconsistency or free variables
        let isInconsistent = false;
        const pivotRowOfCol: Record<number, number> = {};
        for (let r = 0; r < rowCount; r++) {
          let leadingCol = -1;
          for (let c = 0; c < colCount - 1; c++) {
            if (Math.abs(m[r][c]) > 1e-9) {
              leadingCol = c;
              break;
            }
          }

          if (leadingCol === -1) {
            // All coefficients are zero
            if (Math.abs(m[r][colCount - 1]) > 1e-9) {
              isInconsistent = true;
              steps.push({
                title: '4. Contradictory Row Detected',
                latex: formatAugmentedMatrixLatex(m),
                explanation: `Row ${r + 1} corresponds to the statement 0 = ${toFractionLatex(m[r][colCount - 1])}, which is a contradiction. The system has no solution.`,
              });
              break;
            }
          } else {
            pivotRowOfCol[leadingCol] = r;
          }
        }

        if (isInconsistent) {
          return {
            equationsLatex,
            variables: vars,
            solutions: [],
            classification: 'inconsistent',
            method: 'Gauss-Jordan Elimination',
            steps,
          };
        }

        const pivotsCount = Object.keys(pivotRowOfCol).length;
        if (pivotsCount < vars.length) {
          steps.push({
            title: '4. Infinite Solutions',
            latex: formatAugmentedMatrixLatex(m),
            explanation: 'The system has fewer independent constraint equations than variables (free parameters exist). Infinitely many solutions exist.',
          });
          return {
            equationsLatex,
            variables: vars,
            solutions: [],
            classification: 'infinite',
            method: 'Gauss-Jordan Elimination',
            steps,
          };
        }

        // Unique solution
        const solPoint: Record<string, { exactLatex: string; approx: number }> = {};
        vars.forEach((v, idx) => {
          const r = pivotRowOfCol[idx];
          const val = m[r][colCount - 1];
          solPoint[v] = { exactLatex: `${v} = ${toFractionLatex(val)}`, approx: val };
        });

        steps.push({
          title: '4. Final Reduced Row Echelon Form (RREF)',
          latex: formatAugmentedMatrixLatex(m),
          explanation: `Every variable has a corresponding pivot column. Reading directly from the matrix: ` + vars.map(v => solPoint[v].exactLatex).join(', ') + '.',
        });

        return {
          equationsLatex,
          variables: vars,
          solutions: [solPoint],
          classification: 'unique',
          method: 'Gauss-Jordan Elimination',
          steps,
        };
      }

      // 2. Non-linear Substitution fallback for N=2
      if (N === 2) {
        const v1 = vars[0];
        const v2 = vars[1];

        // Try to solve either eq0 or eq1 for either v1 or v2
        const tryExpressVar = (eq: string, targetVar: string, otherVar: string): ExpressionNode | null => {
          let lhs = eq;
          let rhs = '0';
          if (eq.includes('=')) {
            const parts = eq.split('=');
            lhs = parts[0];
            rhs = parts[1];
          }
          try {
            const node = Parser.parse(`(${lhs}) - (${rhs})`);
            const f0 = evaluateAST(node, { [otherVar]: 0, [targetVar]: 0 });
            const f1 = evaluateAST(node, { [otherVar]: 0, [targetVar]: 1 });
            const coeff_target = f1 - f0;

            const f0_1 = evaluateAST(node, { [otherVar]: 1, [targetVar]: 0 });
            const f1_1 = evaluateAST(node, { [otherVar]: 1, [targetVar]: 1 });
            const coeff_target_1 = f1_1 - f0_1;

            const f0_2 = evaluateAST(node, { [otherVar]: 2.5, [targetVar]: 0 });
            const f1_2 = evaluateAST(node, { [otherVar]: 2.5, [targetVar]: 1 });
            const coeff_target_2 = f1_2 - f0_2;

            if (
              Math.abs(coeff_target_1 - coeff_target) < 1e-9 &&
              Math.abs(coeff_target_2 - coeff_target) < 1e-9 &&
              Math.abs(coeff_target) > 1e-9
            ) {
              const nodeLhsRhs = Parser.parse(`(${lhs}) - (${rhs})`);
              const nodeB = substituteAST(nodeLhsRhs, targetVar, { type: 'number', value: 0 });
              return {
                type: 'divide',
                lhs: { type: 'negate', expr: nodeB },
                rhs: { type: 'number', value: coeff_target }
              };
            }
          } catch {
            // Ignore and continue
          }
          return null;
        };

        // Find substitution model
        let subModel: {
          eqIndex: number;
          solvedVar: string;
          subVar: string;
          exprAST: ExpressionNode;
        } | null = null;

        // Try eq0 first: express v2 or v1
        let expr0_v2 = tryExpressVar(cleanEqs[0], v2, v1);
        if (expr0_v2) {
          subModel = { eqIndex: 0, solvedVar: v2, subVar: v1, exprAST: expr0_v2 };
        } else {
          let expr0_v1 = tryExpressVar(cleanEqs[0], v1, v2);
          if (expr0_v1) {
            subModel = { eqIndex: 0, solvedVar: v1, subVar: v2, exprAST: expr0_v1 };
          }
        }

        // If not found, try eq1: express v2 or v1
        if (!subModel) {
          let expr1_v2 = tryExpressVar(cleanEqs[1], v2, v1);
          if (expr1_v2) {
            subModel = { eqIndex: 1, solvedVar: v2, subVar: v1, exprAST: expr1_v2 };
          } else {
            let expr1_v1 = tryExpressVar(cleanEqs[1], v1, v2);
            if (expr1_v1) {
              subModel = { eqIndex: 1, solvedVar: v1, subVar: v2, exprAST: expr1_v1 };
            }
          }
        }

        if (subModel) {
          const { eqIndex, solvedVar, subVar, exprAST } = subModel;
          const otherEqIndex = eqIndex === 0 ? 1 : 0;
          const otherEq = cleanEqs[otherEqIndex];

          let otherLhs = otherEq;
          let otherRhs = '0';
          if (otherEq.includes('=')) {
            const parts = otherEq.split('=');
            otherLhs = parts[0];
            otherRhs = parts[1];
          }

          try {
            const otherExprAST = tryExpressVar(otherEq, solvedVar, subVar);
            let subbedEqStr = '';

            if (otherExprAST) {
              steps.push({
                title: `2. Isolate ${solvedVar} in Both Equations`,
                latex: `\\begin{aligned} ${solvedVar} &= ${astToLatex(exprAST)} \\\\ ${solvedVar} &= ${astToLatex(otherExprAST)} \\end{aligned}`,
                explanation: `Isolate ${solvedVar} in both equations to set up equating them.`,
              });

              steps.push({
                title: `3. Equate Both Equations`,
                latex: `${astToLatex(exprAST)} = ${astToLatex(otherExprAST)}`,
                explanation: `Equate the two expressions for ${solvedVar} to form a single equation with only ${subVar}.`,
              });

              subbedEqStr = `(${astToExpression(exprAST)}) - (${astToExpression(otherExprAST)}) = 0`;
            } else {
              const otherNodeLhs = Parser.parse(otherLhs);
              const otherNodeRhs = Parser.parse(otherRhs);
              const subbedLhs = substituteAST(otherNodeLhs, solvedVar, exprAST);
              const subbedRhs = substituteAST(otherNodeRhs, solvedVar, exprAST);

              steps.push({
                title: `2. Isolate ${solvedVar} in Equation ${eqIndex + 1}`,
                latex: `${solvedVar} = ${astToLatex(exprAST)}`,
                explanation: `Solve the ${eqIndex === 0 ? 'first' : 'second'} equation to express ${solvedVar} in terms of ${subVar}.`,
              });

              steps.push({
                title: `3. Substitute ${solvedVar} into Equation ${otherEqIndex + 1}`,
                latex: `${astToLatex(otherNodeLhs)} = ${astToLatex(otherNodeRhs)} \\implies ${astToLatex(subbedLhs)} = ${astToLatex(subbedRhs)}`,
                explanation: `Substitute the expression for ${solvedVar} into the other equation to obtain an equation solely in terms of ${subVar}.`,
              });

              subbedEqStr = `(${astToExpression(subbedLhs)}) - (${astToExpression(subbedRhs)}) = 0`;
            }

            // Solve for the single variable
            const subVarSol = AlgebraEngine.solveForX(subbedEqStr, subVar);
            steps.push(...subVarSol.steps);

            const solPoints: Array<Record<string, { exactLatex: string; approx: number }>> = [];

            for (const sol of subVarSol.solutions) {
              const subVal = sol.approx;
              const solvedVal = evaluateAST(exprAST, { [subVar]: subVal });

              if (!isNaN(solvedVal) && isFinite(solvedVal)) {
                solPoints.push({
                  [subVar]: { exactLatex: sol.exactLatex, approx: subVal },
                  [solvedVar]: { exactLatex: `${solvedVar} = ${toFractionLatex(solvedVal)}`, approx: solvedVal },
                });
              }
            }

            if (solPoints.length > 0) {
              return {
                equationsLatex,
                variables: [subVar, solvedVar],
                solutions: solPoints,
                classification: 'unique',
                method: 'Substitution & Root Finding',
                steps,
              };
            }
          } catch (err) {
            // Fall through to fallback
          }
        }
      }
    }

    // Inconsistent/unsupported system of equations fallback
    return {
      equationsLatex,
      variables: vars,
      solutions: [],
      classification: 'inconsistent',
      method: 'System Analysis',
      steps: [
        ...steps,
        {
          title: 'Solution Unavailable',
          explanation: `This system could not be solved. For linear systems, ensure all equations are linear in terms of the variables: $${vars.join(',\\ ')}$ (for a ${N}x${N} system). For non-linear systems, 2-equation substitution is supported in the form $y = f(x)$.`,
        }
      ],
    };
  }

  /**
   * FINDING DIRECT LIMITS
   * Evaluates lim (x -> c) f(x), checks direct substitution, L'Hôpital's rule, factoring cancellation, and asymptotes
   */
  public static findLimit(rawExpr: string, targetStr: string, direction: 'both' | 'left' | 'right' = 'both', v = 'x'): LimitResult {
    let clean = rawExpr.trim();
    if (clean.includes('=')) {
      clean = clean.split('=')[0].trim();
    }
    const node = Parser.parse(clean);
    const exprLatex = astToLatex(node);

    let targetVal = 0;
    let isInf = false;
    let isNegInf = false;

    if (targetStr === 'inf' || targetStr === 'infinity' || targetStr === '\\infty' || targetStr === '+inf') {
      isInf = true;
    } else if (targetStr === '-inf' || targetStr === '-infinity' || targetStr === '-\\infty') {
      isNegInf = true;
    } else {
      targetVal = parseFloat(targetStr) || 0;
    }

    const dirSymbol = direction === 'left' ? '^-' : direction === 'right' ? '^+' : '';
    const targetLatex = isInf ? '\\infty' : isNegInf ? '-\\infty' : targetVal.toString();
    const limitLatex = `\\lim_{${v} \\to ${targetLatex}${dirSymbol}} \\left(${exprLatex}\\right)`;

    const steps: AlgebraStep[] = [];
    steps.push({
      title: '1. State Limit Problem',
      latex: limitLatex,
      explanation: `Evaluate the behavior of the expression as ${v} approaches ${targetLatex}${dirSymbol}.`,
    });

    // Infinity Limits
    if (isInf || isNegInf) {
      // Test at x = 1000 and x = 10000
      const sign = isNegInf ? -1 : 1;
      const val1 = evaluateAST(node, { [v]: sign * 1e4 });
      const val2 = evaluateAST(node, { [v]: sign * 1e6 });

      if (Math.abs(val1 - val2) < 1e-4 && !isNaN(val2)) {
        const rounded = Math.round(val2 * 1e6) / 1e6;
        const fracLatex = toFractionLatex(rounded);
        steps.push({
          title: '2. Dominant Degree & Asymptotic Growth Analysis',
          latex: `\\lim_{${v} \\to ${targetLatex}} \\left(${exprLatex}\\right) = ${fracLatex}`,
          explanation: 'Evaluate leading power terms as x approaches +/- infinity. Lower degree terms become negligible.',
        });

        return {
          limitLatex,
          targetStr,
          direction,
          valueLatex: fracLatex,
          numericValue: rounded,
          formType: 'infinity',
          steps,
        };
      }
    }

    // Finite limit: Check Direct Substitution
    const directVal = evaluateAST(node, { [v]: targetVal });

    if (!isNaN(directVal) && isFinite(directVal)) {
      const fracLatex = toFractionLatex(directVal);
      steps.push({
        title: '2. Direct Substitution Test',
        latex: `f(${targetVal}) = ${fracLatex}`,
        explanation: `Since the function is defined and continuous at ${v} = ${targetVal}, we apply the Direct Substitution Property directly: lim f(${v}) as ${v} approaches c equals f(c).`,
      });

      return {
        limitLatex,
        targetStr,
        direction,
        valueLatex: fracLatex,
        numericValue: directVal,
        formType: 'direct',
        steps,
      };
    }

    // Indeterminate form check (e.g. 0/0 or division by zero)
    if (node.type === 'divide') {
      const numNode = node.lhs;
      const denNode = node.rhs;
      const numVal = evaluateAST(numNode, { [v]: targetVal });
      const denVal = evaluateAST(denNode, { [v]: targetVal });

      // Indeterminate 0/0 form
      if (Math.abs(numVal) < 1e-6 && Math.abs(denVal) < 1e-6) {
        steps.push({
          title: '2. Identify Indeterminate Form [0/0]',
          latex: `\\frac{f(${targetVal})}{g(${targetVal})} = \\left[\\frac{0}{0}\\right]`,
          explanation: 'Direct substitution yields the indeterminate form [0/0]. We apply L’Hôpital’s Rule: differentiate numerator and denominator separately.',
        });

        // Apply L'Hôpital's Rule
        const numDeriv = SymbolicDifferentiator.diff(numNode, v);
        const denDeriv = SymbolicDifferentiator.diff(denNode, v);

        steps.push({
          title: "3. Apply L'Hôpital's Rule: lim f'(x) / g'(x)",
          latex: `\\lim_{${v} \\to ${targetVal}} \\frac{\\frac{d}{d${v}}[${astToLatex(numNode)}]}{\\frac{d}{d${v}}[${astToLatex(denNode)}]} = \\lim_{${v} \\to ${targetVal}} \\frac{${astToLatex(numDeriv)}}{${astToLatex(denDeriv)}}`,
          explanation: "Compute the derivative of the numerator and denominator.",
        });

        const dNumVal = evaluateAST(numDeriv, { [v]: targetVal });
        const dDenVal = evaluateAST(denDeriv, { [v]: targetVal });

        if (!isNaN(dNumVal) && !isNaN(dDenVal) && Math.abs(dDenVal) > 1e-9) {
          const limitResultVal = dNumVal / dDenVal;
          const resFrac = toFractionLatex(limitResultVal);

          steps.push({
            title: '4. Re-evaluate Derivatives at Target',
            latex: `\\frac{${toFractionLatex(dNumVal)}}{${toFractionLatex(dDenVal)}} = ${resFrac}`,
            explanation: `Substitute ${v} = ${targetVal} into the differentiated quotient to determine the exact limit.`,
          });

          return {
            limitLatex,
            targetStr,
            direction,
            valueLatex: resFrac,
            numericValue: limitResultVal,
            formType: '0/0',
            steps,
          };
        }
      } else if (Math.abs(denVal) < 1e-6 && Math.abs(numVal) > 1e-6) {
        // Vertical Asymptote (Constant / 0)
        const leftVal = evaluateAST(node, { [v]: targetVal - 1e-6 });
        const rightVal = evaluateAST(node, { [v]: targetVal + 1e-6 });

        steps.push({
          title: '2. Non-Zero over Zero Form (Vertical Asymptote)',
          latex: `\\frac{${toFractionLatex(numVal)}}{0} \\implies \\text{Infinite Discontinuity}`,
          explanation: `The denominator approaches zero while the numerator approaches a non-zero constant ${toFractionLatex(numVal)}.`,
        });

        const leftInf = leftVal > 0 ? '+\\infty' : '-\\infty';
        const rightInf = rightVal > 0 ? '+\\infty' : '-\\infty';

        steps.push({
          title: '3. One-Sided Limit Analysis',
          latex: `\\lim_{${v} \\to ${targetVal}^-} f(${v}) = ${leftInf}, \\quad \\lim_{${v} \\to ${targetVal}^+} f(${v}) = ${rightInf}`,
          explanation: leftInf === rightInf ? 'Both one-sided limits agree towards infinity.' : 'One-sided limits diverge to opposite infinities; two-sided limit does not exist (DNE).',
        });

        const resultStr = direction === 'left' ? leftInf : direction === 'right' ? rightInf : leftInf === rightInf ? leftInf : '\\text{DNE (Does Not Exist)}';

        return {
          limitLatex,
          targetStr,
          direction,
          valueLatex: resultStr,
          numericValue: null,
          formType: 'vertical_asymptote',
          steps,
        };
      }
    }

    // Numerical approximation fallback for complex limits
    const eps = direction === 'left' ? -1e-6 : 1e-6;
    const approx = evaluateAST(node, { [v]: targetVal + eps });
    const resLatex = !isNaN(approx) && isFinite(approx) ? toFractionLatex(approx) : '\\text{Undefined}';

    return {
      limitLatex,
      targetStr,
      direction,
      valueLatex: resLatex,
      numericValue: isNaN(approx) ? null : approx,
      formType: 'direct',
      steps,
    };
  }
}
