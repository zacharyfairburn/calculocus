export interface MatrixStep {
  title: string;
  latex?: string;
  explanation: string;
}

export type MatrixData = number[][];

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

// Convert numeric float to exact LaTeX fraction if close
export function toFractionLatex(num: number, tol = 1e-6): string {
  if (Math.abs(num) < 1e-12) return '0';
  if (Number.isInteger(num)) return num.toString();
  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  for (let den = 1; den <= 120; den++) {
    const numer = Math.round(absNum * den);
    if (Math.abs(absNum - numer / den) < tol) {
      if (den === 1) return `${sign}${numer}`;
      return `${sign}\\frac{${numer}}{${den}}`;
    }
  }
  return num.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}

export function matrixToLatex(m: MatrixData, bracket: 'bmatrix' | 'pmatrix' = 'bmatrix'): string {
  if (!m || m.length === 0 || !m[0] || m[0].length === 0) return '\\begin{bmatrix} 0 \\end{bmatrix}';
  const rows = m.map((row) => row.map((val) => toFractionLatex(val)).join(' & '));
  return `\\begin{${bracket}} ${rows.join(' \\\\ ')} \\end{${bracket}}`;
}

export function cloneMatrix(m: MatrixData): MatrixData {
  return m.map((row) => [...row]);
}

export class MatrixEngine {
  /**
   * ADDITION: A + B
   */
  public static add(A: MatrixData, B: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const rows = A.length;
    const cols = A[0].length;
    const steps: MatrixStep[] = [];

    if (rows !== B.length || cols !== B[0].length) {
      throw new Error(`Matrix dimensions must match for addition: A is ${rows}x${cols}, B is ${B.length}x${B[0].length}`);
    }

    steps.push({
      title: '1. Check Dimension Compatibility',
      latex: `${matrixToLatex(A)} + ${matrixToLatex(B)}`,
      explanation: `Both matrices have identical dimension ${rows} × ${cols}, so entry-wise addition is defined.`,
    });

    const result: MatrixData = Array.from({ length: rows }, () => Array(cols).fill(0));
    const formulaRows: string[] = [];

    for (let i = 0; i < rows; i++) {
      const rowTerms: string[] = [];
      for (let j = 0; j < cols; j++) {
        result[i][j] = A[i][j] + B[i][j];
        const aStr = toFractionLatex(A[i][j]);
        const bVal = B[i][j];
        const bStr = bVal < 0 ? `(${toFractionLatex(bVal)})` : toFractionLatex(bVal);
        rowTerms.push(`${aStr} + ${bStr}`);
      }
      formulaRows.push(rowTerms.join(' & '));
    }

    steps.push({
      title: '2. Add Corresponding Elements (Entry-Wise)',
      latex: `\\begin{bmatrix} ${formulaRows.join(' \\\\ ')} \\end{bmatrix}`,
      explanation: 'Calculate (A + B)ᵢⱼ = Aᵢⱼ + Bᵢⱼ for every row i and column j.',
    });

    const resLatex = matrixToLatex(result);
    steps.push({
      title: '3. Final Sum Matrix',
      latex: resLatex,
      explanation: 'Result of the matrix addition A + B.',
    });

    return { result, latex: resLatex, steps };
  }

  /**
   * SUBTRACTION: A - B
   */
  public static subtract(A: MatrixData, B: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const rows = A.length;
    const cols = A[0].length;
    const steps: MatrixStep[] = [];

    if (rows !== B.length || cols !== B[0].length) {
      throw new Error(`Matrix dimensions must match for subtraction: A is ${rows}x${cols}, B is ${B.length}x${B[0].length}`);
    }

    steps.push({
      title: '1. Check Dimension Compatibility',
      latex: `${matrixToLatex(A)} - ${matrixToLatex(B)}`,
      explanation: `Both matrices have dimension ${rows} × ${cols}, so entry-wise subtraction is defined.`,
    });

    const result: MatrixData = Array.from({ length: rows }, () => Array(cols).fill(0));
    const formulaRows: string[] = [];

    for (let i = 0; i < rows; i++) {
      const rowTerms: string[] = [];
      for (let j = 0; j < cols; j++) {
        result[i][j] = A[i][j] - B[i][j];
        const aStr = toFractionLatex(A[i][j]);
        const bVal = B[i][j];
        const bStr = bVal < 0 ? `(${toFractionLatex(bVal)})` : toFractionLatex(bVal);
        rowTerms.push(`${aStr} - ${bStr}`);
      }
      formulaRows.push(rowTerms.join(' & '));
    }

    steps.push({
      title: '2. Subtract Corresponding Elements',
      latex: `\\begin{bmatrix} ${formulaRows.join(' \\\\ ')} \\end{bmatrix}`,
      explanation: 'Compute (A - B)ᵢⱼ = Aᵢⱼ - Bᵢⱼ for every row and column.',
    });

    const resLatex = matrixToLatex(result);
    steps.push({
      title: '3. Final Difference Matrix',
      latex: resLatex,
      explanation: 'Result of the matrix subtraction A - B.',
    });

    return { result, latex: resLatex, steps };
  }

  /**
   * MULTIPLICATION: A * B
   */
  public static multiply(A: MatrixData, B: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const rA = A.length;
    const cA = A[0].length;
    const rB = B.length;
    const cB = B[0].length;
    const steps: MatrixStep[] = [];

    if (cA !== rB) {
      throw new Error(`Matrix multiplication undefined: Columns of A (${cA}) must equal Rows of B (${rB}).`);
    }

    steps.push({
      title: '1. Verify Inner Dimension Match',
      latex: `A_{${rA} \\times ${cA}} \\cdot B_{${rB} \\times ${cB}} \\implies C_{${rA} \\times ${cB}}`,
      explanation: `Inner dimensions match (${cA} = ${rB}). The product matrix C = A · B will have size ${rA} × ${cB}.`,
    });

    const result: MatrixData = Array.from({ length: rA }, () => Array(cB).fill(0));
    const sampleCalculations: string[] = [];

    for (let i = 0; i < rA; i++) {
      for (let j = 0; j < cB; j++) {
        let sum = 0;
        const dotParts: string[] = [];
        for (let k = 0; k < cA; k++) {
          sum += A[i][k] * B[k][j];
          dotParts.push(`(${toFractionLatex(A[i][k])})(${toFractionLatex(B[k][j])})`);
        }
        result[i][j] = sum;
        if (sampleCalculations.length < 4) {
          sampleCalculations.push(`C_{${i + 1},${j + 1}} = ${dotParts.join(' + ')} = ${toFractionLatex(sum)}`);
        }
      }
    }

    steps.push({
      title: '2. Compute Row-by-Column Dot Products: C_ij = ∑ A_ik B_kj',
      latex: sampleCalculations.join(' \\\\ '),
      explanation: 'Multiply each row vector of A with each column vector of B and sum the products.',
    });

    const resLatex = matrixToLatex(result);
    steps.push({
      title: '3. Final Product Matrix',
      latex: `${matrixToLatex(A)} \\cdot ${matrixToLatex(B)} = ${resLatex}`,
      explanation: `Result of matrix multiplication A · B (${rA} × ${cB}).`,
    });

    return { result, latex: resLatex, steps };
  }

  /**
   * TRANSPOSE: A^T
   */
  public static transpose(A: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const rows = A.length;
    const cols = A[0].length;
    const steps: MatrixStep[] = [];

    const result: MatrixData = Array.from({ length: cols }, () => Array(rows).fill(0));

    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j][i] = A[i][j];
      }
    }

    steps.push({
      title: '1. Definition of Matrix Transpose: (Aᵀ)ⱼᵢ = Aᵢⱼ',
      latex: `A = ${matrixToLatex(A)} \\implies A^T \\text{ size } ${cols} \\times ${rows}`,
      explanation: `Swap rows with columns: Row i of A becomes Column i of Aᵀ.`,
    });

    const resLatex = matrixToLatex(result);
    steps.push({
      title: '2. Transposed Matrix Result',
      latex: `A^T = ${resLatex}`,
      explanation: `Matrix A (${rows} × ${cols}) transposed to Aᵀ (${cols} × ${rows}).`,
    });

    return { result, latex: resLatex, steps };
  }

  /**
   * DETERMINANT: det(A) with step-by-step cofactor expansion / reduction
   */
  public static determinant(A: MatrixData): { det: number; latex: string; steps: MatrixStep[] } {
    const n = A.length;
    if (n !== A[0].length) {
      throw new Error(`Determinant is only defined for square matrices (given ${n}x${A[0].length}).`);
    }

    const steps: MatrixStep[] = [];
    steps.push({
      title: '1. Original Square Matrix',
      latex: `\\det(A) = |A| = ${matrixToLatex(A, 'pmatrix')}`,
      explanation: `Evaluating the determinant for a ${n} × ${n} matrix.`,
    });

    // 1x1
    if (n === 1) {
      const val = A[0][0];
      return { det: val, latex: toFractionLatex(val), steps };
    }

    // 2x2: ad - bc
    if (n === 2) {
      const a = A[0][0];
      const b = A[0][1];
      const c = A[1][0];
      const d = A[1][1];
      const detVal = a * d - b * c;

      steps.push({
        title: '2. 2x2 Cross-Product Formula: det(A) = ad - bc',
        latex: `\\det(A) = (${toFractionLatex(a)})(${toFractionLatex(d)}) - (${toFractionLatex(b)})(${toFractionLatex(c)}) = ${toFractionLatex(detVal)}`,
        explanation: 'Multiply main diagonal entries and subtract anti-diagonal product.',
      });

      return { det: detVal, latex: toFractionLatex(detVal), steps };
    }

    // 3x3: Cofactor expansion along first row
    if (n === 3) {
      const a = A[0][0], b = A[0][1], c = A[0][2];
      const m1 = A[1][1] * A[2][2] - A[1][2] * A[2][1];
      const m2 = A[1][0] * A[2][2] - A[1][2] * A[2][0];
      const m3 = A[1][0] * A[2][1] - A[1][1] * A[2][0];

      const detVal = a * m1 - b * m2 + c * m3;

      steps.push({
        title: '2. Cofactor Expansion along Row 1: a·M₁₁ - b·M₁₂ + c·M₁₃',
        latex: `\\det(A) = (${toFractionLatex(a)})\\begin{vmatrix} ${toFractionLatex(A[1][1])} & ${toFractionLatex(A[1][2])} \\\\ ${toFractionLatex(A[2][1])} & ${toFractionLatex(A[2][2])} \\end{vmatrix} - (${toFractionLatex(b)})\\begin{vmatrix} ${toFractionLatex(A[1][0])} & ${toFractionLatex(A[1][2])} \\\\ ${toFractionLatex(A[2][0])} & ${toFractionLatex(A[2][2])} \\end{vmatrix} + (${toFractionLatex(c)})\\begin{vmatrix} ${toFractionLatex(A[1][0])} & ${toFractionLatex(A[1][1])} \\\\ ${toFractionLatex(A[2][0])} & ${toFractionLatex(A[2][1])} \\end{vmatrix}`,
        explanation: 'Expand into three 2x2 sub-determinant minors with alternating signs (+, -, +).',
      });

      steps.push({
        title: '3. Calculate 2x2 Minors',
        latex: `\\det(A) = (${toFractionLatex(a)})(${toFractionLatex(m1)}) - (${toFractionLatex(b)})(${toFractionLatex(m2)}) + (${toFractionLatex(c)})(${toFractionLatex(m3)}) = ${toFractionLatex(detVal)}`,
        explanation: 'Evaluate each 2x2 minor and sum the signed products.',
      });

      return { det: detVal, latex: toFractionLatex(detVal), steps };
    }

    // General n x n via Gaussian triangular reduction
    const M = cloneMatrix(A);
    let detVal = 1;
    let sign = 1;

    for (let i = 0; i < n; i++) {
      // Pivot search
      let pivotRow = i;
      while (pivotRow < n && Math.abs(M[pivotRow][i]) < 1e-12) {
        pivotRow++;
      }

      if (pivotRow === n) {
        // Singular matrix
        steps.push({
          title: `2. Column ${i + 1} Contains No Non-Zero Pivot`,
          latex: `\\det(A) = 0`,
          explanation: 'Since an entire column contains zero below the diagonal, the matrix is singular and determinant is 0.',
        });
        return { det: 0, latex: '0', steps };
      }

      if (pivotRow !== i) {
        // Swap rows
        const temp = M[i];
        M[i] = M[pivotRow];
        M[pivotRow] = temp;
        sign = -sign;
        steps.push({
          title: `Row Swap: R_${i + 1} ↔ R_${pivotRow + 1} (Determinant changes sign)`,
          latex: `|A| = ${sign < 0 ? '-' : ''} ${matrixToLatex(M, 'pmatrix')}`,
          explanation: `Interchanging two rows multiplies the determinant by -1.`,
        });
      }

      const pivot = M[i][i];
      for (let j = i + 1; j < n; j++) {
        const factor = M[j][i] / pivot;
        if (Math.abs(factor) > 1e-12) {
          for (let k = i; k < n; k++) {
            M[j][k] -= factor * M[i][k];
          }
        }
      }
    }

    for (let i = 0; i < n; i++) {
      detVal *= M[i][i];
    }
    detVal *= sign;

    steps.push({
      title: '2. Upper Triangular Form Reached',
      latex: `U = ${matrixToLatex(M, 'pmatrix')}`,
      explanation: 'The determinant of an upper triangular matrix equals the product of its diagonal elements.',
    });

    const diagTerms = Array.from({ length: n }, (_, i) => toFractionLatex(M[i][i])).join(' \\cdot ');
    steps.push({
      title: '3. Multiply Diagonal Elements',
      latex: `\\det(A) = ${sign < 0 ? '(-1) \\cdot ' : ''} (${diagTerms}) = ${toFractionLatex(detVal)}`,
      explanation: 'Final determinant value.',
    });

    return { det: detVal, latex: toFractionLatex(detVal), steps };
  }

  /**
   * INVERSE: A^-1
   */
  public static inverse(A: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const n = A.length;
    if (n !== A[0].length) {
      throw new Error(`Inverse is only defined for square matrices (${n}x${A[0].length}).`);
    }

    const { det } = MatrixEngine.determinant(A);
    if (Math.abs(det) < 1e-12) {
      throw new Error('Matrix is singular (det(A) = 0); inverse does not exist.');
    }

    const steps: MatrixStep[] = [];
    steps.push({
      title: '1. Non-Singular Check',
      latex: `\\det(A) = ${toFractionLatex(det)} \\neq 0 \\implies A^{-1} \\text{ exists}`,
      explanation: 'Because the determinant is non-zero, the matrix is invertible.',
    });

    // Gauss-Jordan on augmented matrix [A | I]
    const aug: MatrixData = Array.from({ length: n }, (_, i) => {
      const row = [...A[i]];
      for (let j = 0; j < n; j++) row.push(i === j ? 1 : 0);
      return row;
    });

    steps.push({
      title: '2. Set Up Augmented Matrix [A | I]',
      latex: `[A \\mid I] = ${matrixToLatex(aug)}`,
      explanation: 'Place the identity matrix I on the right and perform row operations until the left side becomes I.',
    });

    // Forward & Backward elimination
    for (let i = 0; i < n; i++) {
      let pivotRow = i;
      while (pivotRow < n && Math.abs(aug[pivotRow][i]) < 1e-12) pivotRow++;

      if (pivotRow !== i) {
        const temp = aug[i];
        aug[i] = aug[pivotRow];
        aug[pivotRow] = temp;
      }

      const pivot = aug[i][i];
      for (let k = 0; k < 2 * n; k++) aug[i][k] /= pivot;

      for (let r = 0; r < n; r++) {
        if (r !== i) {
          const factor = aug[r][i];
          if (Math.abs(factor) > 1e-12) {
            for (let k = 0; k < 2 * n; k++) {
              aug[r][k] -= factor * aug[i][k];
            }
          }
        }
      }
    }

    const result: MatrixData = aug.map((row) => row.slice(n));
    const resLatex = matrixToLatex(result);

    steps.push({
      title: '3. Final Reduced Augmented Matrix [I | A⁻¹]',
      latex: `[I \\mid A^{-1}] = ${matrixToLatex(aug)}`,
      explanation: 'The right side now contains the exact inverse matrix A⁻¹.',
    });

    steps.push({
      title: '4. Matrix Inverse Result',
      latex: `A^{-1} = ${resLatex}`,
      explanation: `Inverse matrix satisfying A · A⁻¹ = I.`,
    });

    return { result, latex: resLatex, steps };
  }

  /**
   * DIVISION: A / B = A * B^-1
   */
  public static divide(A: MatrixData, B: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const steps: MatrixStep[] = [];
    steps.push({
      title: '1. Matrix Division Definition: A / B = A · B⁻¹',
      latex: `A \\cdot B^{-1}`,
      explanation: 'Matrix division is computed by multiplying the dividend A by the multiplicative inverse B⁻¹.',
    });

    const invB = MatrixEngine.inverse(B);
    steps.push(...invB.steps);

    const mult = MatrixEngine.multiply(A, invB.result);
    steps.push(...mult.steps);

    return { result: mult.result, latex: mult.latex, steps };
  }

  /**
   * ROW-ECHELON FORM (REF)
   */
  public static ref(A: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const rows = A.length;
    const cols = A[0].length;
    const M = cloneMatrix(A);
    const steps: MatrixStep[] = [];

    steps.push({
      title: '1. Initial Matrix',
      latex: matrixToLatex(M),
      explanation: `Reduce ${rows} × ${cols} matrix to upper Row-Echelon Form (REF).`,
    });

    let lead = 0;
    for (let r = 0; r < rows; r++) {
      if (lead >= cols) break;
      let i = r;
      while (i < rows && Math.abs(M[i][lead]) < 1e-12) {
        i++;
      }

      if (i === rows) {
        lead++;
        r--;
        continue;
      }

      if (i !== r) {
        const temp = M[i];
        M[i] = M[r];
        M[r] = temp;
        steps.push({
          title: `Row Swap: R_${r + 1} ↔ R_${i + 1}`,
          latex: matrixToLatex(M),
          explanation: `Swap rows to bring non-zero pivot ${toFractionLatex(M[r][lead])} to row ${r + 1}.`,
        });
      }

      const pivot = M[r][lead];
      // Normalize pivot row to 1 for clean REF
      if (Math.abs(pivot - 1) > 1e-12) {
        for (let j = 0; j < cols; j++) {
          M[r][j] /= pivot;
        }
        steps.push({
          title: `Scale Pivot Row: R_${r + 1} ← (1/${toFractionLatex(pivot)}) · R_${r + 1}`,
          latex: matrixToLatex(M),
          explanation: `Make leading entry of row ${r + 1} equal to 1.`,
        });
      }

      // Eliminate entries below pivot
      for (let j = r + 1; j < rows; j++) {
        const factor = M[j][lead];
        if (Math.abs(factor) > 1e-12) {
          for (let k = 0; k < cols; k++) {
            M[j][k] -= factor * M[r][k];
          }
          steps.push({
            title: `Row Elimination: R_${j + 1} ← R_${j + 1} - (${toFractionLatex(factor)}) · R_${r + 1}`,
            latex: matrixToLatex(M),
            explanation: `Clear entry below pivot in column ${lead + 1}.`,
          });
        }
      }

      lead++;
    }

    const resLatex = matrixToLatex(M);
    steps.push({
      title: 'Final Row-Echelon Form (REF)',
      latex: `\\text{REF}(A) = ${resLatex}`,
      explanation: 'All non-zero rows are above any zero rows, and each leading entry is strictly to the right of the leading entry above it.',
    });

    return { result: M, latex: resLatex, steps };
  }

  /**
   * REDUCED ROW-ECHELON FORM (RREF)
   */
  public static rref(A: MatrixData): { result: MatrixData; latex: string; steps: MatrixStep[] } {
    const rows = A.length;
    const cols = A[0].length;
    const M = cloneMatrix(A);
    const steps: MatrixStep[] = [];

    steps.push({
      title: '1. Initial Matrix',
      latex: matrixToLatex(M),
      explanation: `Perform Gauss-Jordan Elimination to convert matrix to Reduced Row-Echelon Form (RREF).`,
    });

    let lead = 0;
    const pivotPositions: Array<{ r: number; c: number }> = [];

    // Forward Phase: Form pivots and zeros below
    for (let r = 0; r < rows; r++) {
      if (lead >= cols) break;
      let i = r;
      while (i < rows && Math.abs(M[i][lead]) < 1e-12) {
        i++;
      }

      if (i === rows) {
        lead++;
        r--;
        continue;
      }

      if (i !== r) {
        const temp = M[i];
        M[i] = M[r];
        M[r] = temp;
        steps.push({
          title: `Swap Rows: R_${r + 1} ↔ R_${i + 1}`,
          latex: matrixToLatex(M),
          explanation: `Move row with non-zero pivot in column ${lead + 1} into position.`,
        });
      }

      const pivot = M[r][lead];
      if (Math.abs(pivot - 1) > 1e-12) {
        for (let j = 0; j < cols; j++) {
          M[r][j] /= pivot;
        }
        steps.push({
          title: `Scale Pivot to 1: R_${r + 1} ← (1/${toFractionLatex(pivot)}) · R_${r + 1}`,
          latex: matrixToLatex(M),
          explanation: `Make leading entry of row ${r + 1} equal to 1.`,
        });
      }

      pivotPositions.push({ r, c: lead });

      for (let j = r + 1; j < rows; j++) {
        const factor = M[j][lead];
        if (Math.abs(factor) > 1e-12) {
          for (let k = 0; k < cols; k++) {
            M[j][k] -= factor * M[r][k];
          }
          steps.push({
            title: `Eliminate Below: R_${j + 1} ← R_${j + 1} - (${toFractionLatex(factor)}) · R_${r + 1}`,
            latex: matrixToLatex(M),
            explanation: `Create zero below pivot in column ${lead + 1}.`,
          });
        }
      }

      lead++;
    }

    // Backward Phase: Eliminate ABOVE each pivot
    for (let idx = pivotPositions.length - 1; idx >= 0; idx--) {
      const { r, c } = pivotPositions[idx];
      for (let j = r - 1; j >= 0; j--) {
        const factor = M[j][c];
        if (Math.abs(factor) > 1e-12) {
          for (let k = 0; k < cols; k++) {
            M[j][k] -= factor * M[r][k];
          }
          steps.push({
            title: `Eliminate Above Pivot: R_${j + 1} ← R_${j + 1} - (${toFractionLatex(factor)}) · R_${r + 1}`,
            latex: matrixToLatex(M),
            explanation: `Clear entry above pivot in row ${j + 1}, column ${c + 1}.`,
          });
        }
      }
    }

    const resLatex = matrixToLatex(M);
    steps.push({
      title: 'Final Reduced Row-Echelon Form (RREF)',
      latex: `\\text{RREF}(A) = ${resLatex}`,
      explanation: 'Every leading pivot is 1, and every pivot column has zeros in all other entries.',
    });

    return { result: M, latex: resLatex, steps };
  }

  /**
   * MANUAL ROW OPERATIONS
   */
  public static applyRowOperation(
    A: MatrixData,
    op:
      | { type: 'swap'; r1: number; r2: number }
      | { type: 'scale'; r: number; k: number }
      | { type: 'add'; targetRow: number; sourceRow: number; k: number }
  ): { result: MatrixData; latex: string; step: MatrixStep } {
    const M = cloneMatrix(A);
    const rows = M.length;
    const cols = M[0].length;

    if (op.type === 'swap') {
      const r1 = op.r1 - 1;
      const r2 = op.r2 - 1;
      if (r1 < 0 || r1 >= rows || r2 < 0 || r2 >= rows) throw new Error('Invalid row index for swap.');
      const temp = M[r1];
      M[r1] = M[r2];
      M[r2] = temp;
      const resLatex = matrixToLatex(M);
      return {
        result: M,
        latex: resLatex,
        step: {
          title: `Row Operation: R_${op.r1} ↔ R_${op.r2}`,
          latex: resLatex,
          explanation: `Interchange row ${op.r1} and row ${op.r2}.`,
        },
      };
    }

    if (op.type === 'scale') {
      const r = op.r - 1;
      if (r < 0 || r >= rows) throw new Error('Invalid row index for scale.');
      if (Math.abs(op.k) < 1e-12) throw new Error('Row multiplier k cannot be zero.');
      for (let j = 0; j < cols; j++) M[r][j] *= op.k;
      const resLatex = matrixToLatex(M);
      return {
        result: M,
        latex: resLatex,
        step: {
          title: `Row Operation: R_${op.r} ← (${toFractionLatex(op.k)}) · R_${op.r}`,
          latex: resLatex,
          explanation: `Multiply every element in row ${op.r} by scalar ${toFractionLatex(op.k)}.`,
        },
      };
    }

    if (op.type === 'add') {
      const target = op.targetRow - 1;
      const source = op.sourceRow - 1;
      if (target < 0 || target >= rows || source < 0 || source >= rows) throw new Error('Invalid row index for addition.');
      for (let j = 0; j < cols; j++) M[target][j] += op.k * M[source][j];
      const resLatex = matrixToLatex(M);
      const sign = op.k >= 0 ? '+' : '-';
      const kAbs = Math.abs(op.k);
      const kStr = kAbs === 1 ? '' : `(${toFractionLatex(kAbs)}) \\cdot `;
      return {
        result: M,
        latex: resLatex,
        step: {
          title: `Row Operation: R_${op.targetRow} ← R_${op.targetRow} ${sign} ${kStr}R_${op.sourceRow}`,
          latex: resLatex,
          explanation: `Add ${toFractionLatex(op.k)} times row ${op.sourceRow} to row ${op.targetRow}.`,
        },
      };
    }

    throw new Error('Unknown row operation.');
  }

  /**
   * VECTOR OPERATIONS: Dot, Cross, Norm, Angle, Unit Vector
   */
  public static vectorDot(u: number[], v: number[]): { result: number; latex: string; steps: MatrixStep[] } {
    if (u.length !== v.length) throw new Error('Vector dimensions must match for dot product.');
    const steps: MatrixStep[] = [];
    const uLatex = `\\mathbf{u} = \\begin{pmatrix} ${u.map((n) => toFractionLatex(n)).join(' & ')} \\end{pmatrix}`;
    const vLatex = `\\mathbf{v} = \\begin{pmatrix} ${v.map((n) => toFractionLatex(n)).join(' & ')} \\end{pmatrix}`;

    steps.push({
      title: '1. State Vectors',
      latex: `${uLatex}, \\quad ${vLatex}`,
      explanation: 'Vectors in Euclidean space ℝⁿ.',
    });

    const terms: string[] = [];
    let dot = 0;
    for (let i = 0; i < u.length; i++) {
      dot += u[i] * v[i];
      terms.push(`(${toFractionLatex(u[i])})(${toFractionLatex(v[i])})`);
    }

    steps.push({
      title: '2. Compute Component-Wise Sum: u · v = ∑ u_i v_i',
      latex: `\\mathbf{u} \\cdot \\mathbf{v} = ${terms.join(' + ')} = ${toFractionLatex(dot)}`,
      explanation: 'The scalar dot product measures vector alignment.',
    });

    return { result: dot, latex: toFractionLatex(dot), steps };
  }

  public static vectorCross(u: number[], v: number[]): { result: number[]; latex: string; steps: MatrixStep[] } {
    if (u.length !== 3 || v.length !== 3) throw new Error('Cross product is defined for 3-dimensional vectors in ℝ³.');
    const steps: MatrixStep[] = [];

    steps.push({
      title: '1. 3D Cross Product Determinant Setup',
      latex: `\\mathbf{u} \\times \\mathbf{v} = \\begin{vmatrix} \\mathbf{i} & \\mathbf{j} & \\mathbf{k} \\\\ ${toFractionLatex(u[0])} & ${toFractionLatex(u[1])} & ${toFractionLatex(u[2])} \\\\ ${toFractionLatex(v[0])} & ${toFractionLatex(v[1])} & ${toFractionLatex(v[2])} \\end{vmatrix}`,
      explanation: 'Form the 3×3 formal determinant using unit basis vectors i, j, k.',
    });

    const iVal = u[1] * v[2] - u[2] * v[1];
    const jVal = -(u[0] * v[2] - u[2] * v[0]);
    const kVal = u[0] * v[1] - u[1] * v[0];
    const result = [iVal, jVal, kVal];

    steps.push({
      title: '2. Expand by 2x2 Minors',
      latex: `\\mathbf{u} \\times \\mathbf{v} = (${toFractionLatex(iVal)})\\mathbf{i} + (${toFractionLatex(jVal)})\\mathbf{j} + (${toFractionLatex(kVal)})\\mathbf{k}`,
      explanation: 'Compute each component via the 2×2 sub-determinants.',
    });

    const resLatex = `\\begin{pmatrix} ${toFractionLatex(iVal)} \\\\ ${toFractionLatex(jVal)} \\\\ ${toFractionLatex(kVal)} \\end{pmatrix}`;
    steps.push({
      title: '3. Resulting Orthogonal Vector',
      latex: `\\mathbf{u} \\times \\mathbf{v} = ${resLatex}`,
      explanation: 'The resulting vector is strictly orthogonal to both u and v.',
    });

    return { result, latex: resLatex, steps };
  }
}

