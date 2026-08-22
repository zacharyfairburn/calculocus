/**
 * Utility to convert raw LaTeX expressions to Calculocus readable mathematical expressions.
 */
export function latexToCalculus(latexStr: string): string {
  if (!latexStr) return '';

  let out = latexStr.trim();

  // Strip math delimiters $...$ or $$...$$ or \( ... \) or \[ ... \]
  out = out.replace(/^\${1,2}|\${1,2}$/g, '');
  out = out.replace(/^\\\(|\\\)$/g, '');
  out = out.replace(/^\\\[|\\\]$/g, '');

  // Strip \left and \right
  out = out.replace(/\\left\s*/g, '').replace(/\\right\s*/g, '');

  // Convert fractions: \frac{a}{b} -> ((a)/(b))
  // Iterate to handle nested fractions
  let prev = '';
  while (prev !== out) {
    prev = out;
    out = out.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, '(($1)/($2))');
  }

  // Convert nth roots: \sqrt[n]{x} -> root(n, x)
  out = out.replace(/\\sqrt\s*\[([^{}]+)\]\s*\{([^{}]+)\}/g, 'root($1, $2)');

  // Convert square roots: \sqrt{x} -> sqrt(x)
  out = out.replace(/\\sqrt\s*\{([^{}]+)\}/g, 'sqrt($1)');

  // Convert trigonometric & standard functions
  out = out.replace(/\\(sin|cos|tan|asin|acos|atan|sinh|cosh|tanh|ln|log|exp|abs|min|max|sec|csc|cot)\b/g, '$1');

  // Convert powers with braces: x^{2n+1} -> x^(2n+1)
  out = out.replace(/\^\{([^{}]+)\}/g, '^($1)');

  // Convert subscripts: x_{1} -> x1
  out = out.replace(/_\{([^{}]+)\}/g, '$1');
  out = out.replace(/_([0-9a-zA-Z])/g, '$1');

  // Convert symbols & operators
  out = out.replace(/\\cdot|\\times/g, '*');
  out = out.replace(/\\div/g, '/');
  out = out.replace(/\\pi/g, 'pi');
  out = out.replace(/\\theta/g, 'theta');
  out = out.replace(/\\le|\\leq/g, '<=');
  out = out.replace(/\\ge|\\geq/g, '>=');
  out = out.replace(/\\neq/g, '!=');

  // Clean remaining backslashes
  out = out.replace(/\\/g, '');

  return out.trim();
}

/**
 * Checks if a string looks like LaTeX input (contains backslashes or braces).
 */
export function isLikelyLatex(input: string): boolean {
  return /\\(frac|sqrt|sin|cos|tan|pi|theta|cdot|times|le|ge|ln|sum|int)|\^\{|_\{/.test(input);
}
