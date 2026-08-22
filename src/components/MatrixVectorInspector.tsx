import React, { useState, useMemo } from 'react';
import {
  MatrixEngine,
  MatrixData,
  matrixToLatex,
  toFractionLatex,
  cloneMatrix,
  MatrixStep,
} from '../engine/matrix';
import { MathDisplay, MathText } from './MathDisplay';
import {
  Grid3X3,
  ListOrdered,
  Plus,
  Minus,
  X as MultiplyIcon,
  Divide,
  ArrowLeftRight,
  RotateCw,
  Scaling,
  Undo2,
  Copy,
  Check,
  MoveUpRight,
  Layers,
  Binary,
  Maximize2,
  ChevronDown,
  RefreshCw,
  Hash,
  Activity,
  ArrowRight,
} from 'lucide-react';

export type MatrixProcessType =
  | 'arithmetic'
  | 'row_ops'
  | 'determinant'
  | 'ref'
  | 'rref'
  | 'transpose'
  | 'vectors';

interface MatrixVectorInspectorProps {
  theme?: 'dark' | 'light';
  onAddItem?: (type: any, rawInput: string) => void;
}

const PRESET_MATRICES: Array<{ name: string; A: MatrixData; B?: MatrixData; desc: string }> = [
  {
    name: '3×3 Invertible Matrix',
    A: [
      [1, 2, 3],
      [0, 1, 4],
      [5, 6, 0],
    ],
    B: [
      [2, -1, 0],
      [0, 3, 1],
      [-2, 1, 4],
    ],
    desc: 'Non-zero determinant, ideal for REF, RREF, Inverse, and Multiplication',
  },
  {
    name: '2×2 Linear System Matrix',
    A: [
      [2, 3],
      [4, -1],
    ],
    B: [
      [1, 2],
      [3, 4],
    ],
    desc: 'Classic 2×2 system coefficients with det(A) = -14',
  },
  {
    name: '3×4 Augmented System',
    A: [
      [1, 2, -1, 4],
      [2, 3, 1, 5],
      [3, 5, 0, 9],
    ],
    desc: '3 equations in 3 variables with RHS augmented vector',
  },
  {
    name: 'Singular (det(A) = 0) Matrix',
    A: [
      [1, 2, 3],
      [2, 4, 6],
      [1, 1, 1],
    ],
    desc: 'Linearly dependent rows where det(A) = 0 and inverse does not exist',
  },
  {
    name: '3×3 Symmetric Matrix',
    A: [
      [2, -1, 0],
      [-1, 2, -1],
      [0, -1, 2],
    ],
    desc: 'Tridiagonal symmetric matrix (A = Aᵀ)',
  },
];

const PRESET_VECTORS: Array<{ name: string; u: number[]; v: number[] }> = [
  { name: '3D Orthogonal Basis', u: [1, 2, 3], v: [2, -1, 0] },
  { name: 'Standard 3D Space', u: [3, -2, 1], v: [1, 4, -2] },
  { name: 'Physics Force & Lever', u: [0, 5, 0], v: [2, 0, 0] },
  { name: 'Parallel Vectors', u: [2, 4, 6], v: [1, 2, 3] },
];

export const MatrixVectorInspector: React.FC<MatrixVectorInspectorProps> = ({
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  // Active Process Tab
  const [activeProcess, setActiveProcess] = useState<MatrixProcessType>('arithmetic');
  const [arithmeticOp, setArithmeticOp] = useState<'add' | 'subtract' | 'multiply' | 'divide'>('multiply');

  // Matrix A Dimensions & Data
  const [rowsA, setRowsA] = useState(3);
  const [colsA, setColsA] = useState(3);
  const [matA, setMatA] = useState<MatrixData>([
    [1, 2, 3],
    [0, 1, 4],
    [5, 6, 0],
  ]);

  // Matrix B Dimensions & Data
  const [rowsB, setRowsB] = useState(3);
  const [colsB, setColsB] = useState(3);
  const [matB, setMatB] = useState<MatrixData>([
    [2, -1, 0],
    [0, 3, 1],
    [-2, 1, 4],
  ]);

  // Interactive Row Operations State
  const [rowOpMatrix, setRowOpMatrix] = useState<MatrixData>([
    [1, 2, 3],
    [0, 1, 4],
    [5, 6, 0],
  ]);
  const [rowOpHistory, setRowOpHistory] = useState<Array<{ matrix: MatrixData; step: MatrixStep }>>([]);
  const [rowOpType, setRowOpType] = useState<'swap' | 'scale' | 'add'>('add');
  const [swapR1, setSwapR1] = useState(1);
  const [swapR2, setSwapR2] = useState(2);
  const [scaleR, setScaleR] = useState(1);
  const [scaleK, setScaleK] = useState('2');
  const [addTargetR, setAddTargetR] = useState(3);
  const [addSourceR, setAddSourceR] = useState(1);
  const [addK, setAddK] = useState('-5');

  // Vectors state
  const [vecU, setVecU] = useState<number[]>([1, 2, 3]);
  const [vecV, setVecV] = useState<number[]>([2, -1, 0]);

  // Feedback State
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);

  // Resize Handlers
  const handleResizeA = (newR: number, newC: number) => {
    newR = Math.max(1, Math.min(5, newR));
    newC = Math.max(1, Math.min(5, newC));
    setRowsA(newR);
    setColsA(newC);
    const newM: MatrixData = Array.from({ length: newR }, (_, r) =>
      Array.from({ length: newC }, (_, c) => (matA[r] && matA[r][c] !== undefined ? matA[r][c] : r === c ? 1 : 0))
    );
    setMatA(newM);
    setRowOpMatrix(cloneMatrix(newM));
    setRowOpHistory([]);
  };

  const handleResizeB = (newR: number, newC: number) => {
    newR = Math.max(1, Math.min(5, newR));
    newC = Math.max(1, Math.min(5, newC));
    setRowsB(newR);
    setColsB(newC);
    const newM: MatrixData = Array.from({ length: newR }, (_, r) =>
      Array.from({ length: newC }, (_, c) => (matB[r] && matB[r][c] !== undefined ? matB[r][c] : r === c ? 1 : 0))
    );
    setMatB(newM);
  };

  const handleCellChangeA = (r: number, c: number, val: string) => {
    const num = parseFloat(val) || 0;
    const next = cloneMatrix(matA);
    next[r][c] = num;
    setMatA(next);
    setRowOpMatrix(cloneMatrix(next));
    setRowOpHistory([]);
  };

  const handleCellChangeB = (r: number, c: number, val: string) => {
    const num = parseFloat(val) || 0;
    const next = cloneMatrix(matB);
    next[r][c] = num;
    setMatB(next);
  };

  const handleLoadPreset = (preset: (typeof PRESET_MATRICES)[0]) => {
    setRowsA(preset.A.length);
    setColsA(preset.A[0].length);
    setMatA(cloneMatrix(preset.A));
    setRowOpMatrix(cloneMatrix(preset.A));
    setRowOpHistory([]);

    if (preset.B) {
      setRowsB(preset.B.length);
      setColsB(preset.B[0].length);
      setMatB(cloneMatrix(preset.B));
    }
    setIsPresetsOpen(false);
  };

  const handleCopy = (latex: string) => {
    navigator.clipboard.writeText(latex);
    setCopiedText(latex);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Perform Manual Row Operation
  const handleApplyRowOp = () => {
    try {
      let res: { result: MatrixData; latex: string; step: MatrixStep };
      if (rowOpType === 'swap') {
        res = MatrixEngine.applyRowOperation(rowOpMatrix, { type: 'swap', r1: swapR1, r2: swapR2 });
      } else if (rowOpType === 'scale') {
        const k = parseFloat(scaleK) || 1;
        res = MatrixEngine.applyRowOperation(rowOpMatrix, { type: 'scale', r: scaleR, k });
      } else {
        const k = parseFloat(addK) || 1;
        res = MatrixEngine.applyRowOperation(rowOpMatrix, {
          type: 'add',
          targetRow: addTargetR,
          sourceRow: addSourceR,
          k,
        });
      }

      setRowOpHistory((prev) => [...prev, { matrix: rowOpMatrix, step: res.step }]);
      setRowOpMatrix(res.result);
    } catch (e: any) {
      alert(e.message || 'Error executing row operation');
    }
  };

  const handleUndoRowOp = () => {
    if (rowOpHistory.length === 0) return;
    const last = rowOpHistory[rowOpHistory.length - 1];
    setRowOpMatrix(last.matrix);
    setRowOpHistory((prev) => prev.slice(0, prev.length - 1));
  };

  const handleResetRowOps = () => {
    setRowOpMatrix(cloneMatrix(matA));
    setRowOpHistory([]);
  };

  // Computations
  const arithmeticResult = useMemo(() => {
    try {
      if (arithmeticOp === 'add') return { data: MatrixEngine.add(matA, matB), error: null };
      if (arithmeticOp === 'subtract') return { data: MatrixEngine.subtract(matA, matB), error: null };
      if (arithmeticOp === 'multiply') return { data: MatrixEngine.multiply(matA, matB), error: null };
      if (arithmeticOp === 'divide') return { data: MatrixEngine.divide(matA, matB), error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Operation error' };
    }
    return { data: null, error: null };
  }, [matA, matB, arithmeticOp]);

  const determinantResult = useMemo(() => {
    try {
      return { data: MatrixEngine.determinant(matA), error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Determinant error' };
    }
  }, [matA]);

  const refResult = useMemo(() => {
    try {
      return { data: MatrixEngine.ref(matA), error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'REF error' };
    }
  }, [matA]);

  const rrefResult = useMemo(() => {
    try {
      return { data: MatrixEngine.rref(matA), error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'RREF error' };
    }
  }, [matA]);

  const transposeResult = useMemo(() => {
    try {
      return { data: MatrixEngine.transpose(matA), error: null };
    } catch (err: any) {
      return { data: null, error: err.message || 'Transpose error' };
    }
  }, [matA]);

  // Vector Computations
  const vectorResults = useMemo(() => {
    try {
      const dot = MatrixEngine.vectorDot(vecU, vecV);
      const cross = vecU.length === 3 && vecV.length === 3 ? MatrixEngine.vectorCross(vecU, vecV) : null;
      const normU = Math.sqrt(vecU.reduce((s, x) => s + x * x, 0));
      const normV = Math.sqrt(vecV.reduce((s, x) => s + x * x, 0));
      const cosTheta = normU > 0 && normV > 0 ? dot.result / (normU * normV) : 0;
      const angleRad = Math.acos(Math.max(-1, Math.min(1, cosTheta)));
      const angleDeg = (angleRad * 180) / Math.PI;

      return {
        dot,
        cross,
        normU,
        normV,
        angleDeg,
        angleRad,
        error: null,
      };
    } catch (err: any) {
      return { dot: null, cross: null, normU: 0, normV: 0, angleDeg: 0, angleRad: 0, error: err.message };
    }
  }, [vecU, vecV]);

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* 1. TOP PROCESS NAVIGATION TABS */}
      <div
        className={`flex items-center gap-1 p-2 border-b overflow-x-auto shrink-0 ${
          isLight ? 'bg-neutral-100/60 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        {(
          [
            { id: 'arithmetic', label: 'Arithmetic (+, -, ×, ÷)', icon: MultiplyIcon, color: '#00693E' },
            { id: 'row_ops', label: 'Row Operations', icon: ArrowLeftRight, color: '#2d6fb4' },
            { id: 'determinant', label: 'Determinant |A|', icon: Hash, color: '#fa7d19' },
            { id: 'ref', label: 'Row-Echelon (REF)', icon: Binary, color: '#6042a6' },
            { id: 'rref', label: 'Reduced REF (RREF)', icon: Grid3X3, color: '#00693E' },
            { id: 'transpose', label: 'Transpose (Aᵀ)', icon: RotateCw, color: '#2d6fb4' },
            { id: 'vectors', label: 'Vector Suite', icon: MoveUpRight, color: '#fa7d19' },
          ] as const
        ).map((proc) => {
          const isActive = activeProcess === proc.id;
          const IconComp = proc.icon;
          return (
            <button
              key={proc.id}
              onClick={() => setActiveProcess(proc.id)}
              className={`px-2.5 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all border ${
                isActive
                  ? 'bg-[#00693E] text-white border-[#00693E] shadow-sm'
                  : isLight
                  ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                  : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-300'
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{proc.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. MATRIX INPUT EDITORS BAR */}
      {activeProcess !== 'vectors' ? (
        <div
          className={`p-3 border-b shrink-0 space-y-3 ${
            isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          {/* Preset Selector & Action Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                Matrix Definitions
              </span>
              <div className="relative">
                <button
                  onClick={() => setIsPresetsOpen(!isPresetsOpen)}
                  className={`text-[11px] px-2 py-0.5 border font-mono rounded-none flex items-center gap-1.5 ${
                    isLight ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
                  }`}
                >
                  <Layers className="w-3 h-3 text-[#00693E]" />
                  <span>Presets</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {isPresetsOpen && (
                  <div
                    className={`absolute top-full left-0 mt-1 w-72 border rounded-none shadow-xl z-50 p-1 ${
                      isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                    }`}
                  >
                    <div className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Sample Matrices
                    </div>
                    {PRESET_MATRICES.map((pr, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleLoadPreset(pr)}
                        className={`w-full p-1.5 text-left rounded-none text-xs flex flex-col transition-all ${
                          isLight ? 'hover:bg-neutral-100 text-neutral-800' : 'hover:bg-neutral-900 text-neutral-200'
                        }`}
                      >
                        <span className="font-bold text-[11px]">{pr.name}</span>
                        <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{pr.desc}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Matrix A Quick Dimension Controls */}
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Dim(A):</span>
              <div className="flex items-center gap-1">
                {[2, 3, 4].map((d) => (
                  <button
                    key={d}
                    onClick={() => handleResizeA(d, d)}
                    className={`px-1.5 py-0.5 border text-[10px] ${
                      rowsA === d && colsA === d
                        ? 'bg-[#00693E] text-white border-[#00693E] font-bold'
                        : isLight
                        ? 'bg-white border-neutral-300 hover:bg-neutral-100'
                        : 'bg-black border-neutral-800 hover:bg-neutral-900'
                    }`}
                  >
                    {d}×{d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Matrix Grid Layouts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Matrix A Grid */}
            <div
              className={`p-2.5 border rounded-none space-y-2 ${
                isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#00693E] uppercase tracking-wider">
                  Matrix A ({rowsA}×{colsA})
                </span>
                <div className="flex items-center gap-1 text-[11px] font-mono">
                  <button
                    onClick={() => handleResizeA(rowsA + 1, colsA)}
                    disabled={rowsA >= 5}
                    className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    title="Add row"
                  >
                    +R
                  </button>
                  <button
                    onClick={() => handleResizeA(rowsA - 1, colsA)}
                    disabled={rowsA <= 1}
                    className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    title="Remove row"
                  >
                    -R
                  </button>
                  <button
                    onClick={() => handleResizeA(rowsA, colsA + 1)}
                    disabled={colsA >= 5}
                    className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    title="Add column"
                  >
                    +C
                  </button>
                  <button
                    onClick={() => handleResizeA(rowsA, colsA - 1)}
                    disabled={colsA <= 1}
                    className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    title="Remove column"
                  >
                    -C
                  </button>
                </div>
              </div>

              {/* Grid Inputs */}
              <div
                className="grid gap-1.5"
                style={{
                  gridTemplateColumns: `repeat(${colsA}, minmax(0, 1fr))`,
                }}
              >
                {matA.map((row, r) =>
                  row.map((val, c) => (
                    <input
                      key={`${r}-${c}`}
                      type="number"
                      step="any"
                      value={val}
                      onChange={(e) => handleCellChangeA(r, c, e.target.value)}
                      className={`w-full text-center py-1 text-xs font-mono font-bold border rounded-none focus:outline-hidden ${
                        isLight
                          ? 'bg-neutral-50 border-neutral-300 focus:border-[#00693E]'
                          : 'bg-neutral-900 border-neutral-800 focus:border-[#00693E]'
                      }`}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Matrix B Grid (Shown for Arithmetic Tab) */}
            {activeProcess === 'arithmetic' ? (
              <div
                className={`p-2.5 border rounded-none space-y-2 ${
                  isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2d6fb4] uppercase tracking-wider">
                    Matrix B ({rowsB}×{colsB})
                  </span>
                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <button
                      onClick={() => handleResizeB(rowsB + 1, colsB)}
                      disabled={rowsB >= 5}
                      className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    >
                      +R
                    </button>
                    <button
                      onClick={() => handleResizeB(rowsB - 1, colsB)}
                      disabled={rowsB <= 1}
                      className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    >
                      -R
                    </button>
                    <button
                      onClick={() => handleResizeB(rowsB, colsB + 1)}
                      disabled={colsB >= 5}
                      className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    >
                      +C
                    </button>
                    <button
                      onClick={() => handleResizeB(rowsB, colsB - 1)}
                      disabled={colsB <= 1}
                      className="px-1 border hover:bg-neutral-200 dark:hover:bg-neutral-800 disabled:opacity-30"
                    >
                      -C
                    </button>
                  </div>
                </div>

                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${colsB}, minmax(0, 1fr))`,
                  }}
                >
                  {matB.map((row, r) =>
                    row.map((val, c) => (
                      <input
                        key={`${r}-${c}`}
                        type="number"
                        step="any"
                        value={val}
                        onChange={(e) => handleCellChangeB(r, c, e.target.value)}
                        className={`w-full text-center py-1 text-xs font-mono font-bold border rounded-none focus:outline-hidden ${
                          isLight
                            ? 'bg-neutral-50 border-neutral-300 focus:border-[#2d6fb4]'
                            : 'bg-neutral-900 border-neutral-800 focus:border-[#2d6fb4]'
                        }`}
                      />
                    ))
                  )}
                </div>
              </div>
            ) : (
              /* Quick Matrix Properties Preview */
              <div
                className={`p-2.5 border rounded-none flex flex-col justify-center gap-1.5 text-xs font-mono ${
                  isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between border-b pb-1">
                  <span className={isLight ? 'text-neutral-500' : 'text-neutral-400'}>Dimensions:</span>
                  <span className="font-bold">{rowsA} × {colsA}</span>
                </div>
                <div className="flex items-center justify-between border-b pb-1">
                  <span className={isLight ? 'text-neutral-500' : 'text-neutral-400'}>Is Square:</span>
                  <span className="font-bold">{rowsA === colsA ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={isLight ? 'text-neutral-500' : 'text-neutral-400'}>Square Det:</span>
                  <span className="font-bold text-[#fa7d19]">
                    {rowsA === colsA ? determinantResult.data?.latex || '0' : 'N/A'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VECTORS INPUT BAR */
        <div
          className={`p-3 border-b shrink-0 space-y-3 ${
            isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              3D Vector Coordinates
            </span>
            <div className="flex items-center gap-1.5">
              {PRESET_VECTORS.map((pv, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setVecU(pv.u);
                    setVecV(pv.v);
                  }}
                  className={`text-[10px] px-2 py-0.5 border font-mono rounded-none ${
                    isLight ? 'bg-white hover:bg-neutral-100 border-neutral-300' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                  }`}
                >
                  {pv.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
            {/* Vector u */}
            <div className={`p-2.5 border rounded-none space-y-2 ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'}`}>
              <span className="font-bold text-[#00693E] block">Vector u = (u₁, u₂, u₃)</span>
              <div className="grid grid-cols-3 gap-2">
                {vecU.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-[10px] opacity-60">u{idx + 1}:</span>
                    <input
                      type="number"
                      step="any"
                      value={val}
                      onChange={(e) => {
                        const next = [...vecU];
                        next[idx] = parseFloat(e.target.value) || 0;
                        setVecU(next);
                      }}
                      className={`w-full text-center py-1 font-bold border rounded-none focus:outline-hidden ${
                        isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-900 border-neutral-800'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Vector v */}
            <div className={`p-2.5 border rounded-none space-y-2 ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'}`}>
              <span className="font-bold text-[#2d6fb4] block">Vector v = (v₁, v₂, v₃)</span>
              <div className="grid grid-cols-3 gap-2">
                {vecV.map((val, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-[10px] opacity-60">v{idx + 1}:</span>
                    <input
                      type="number"
                      step="any"
                      value={val}
                      onChange={(e) => {
                        const next = [...vecV];
                        next[idx] = parseFloat(e.target.value) || 0;
                        setVecV(next);
                      }}
                      className={`w-full text-center py-1 font-bold border rounded-none focus:outline-hidden ${
                        isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-900 border-neutral-800'
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. MAIN RESULTS & STEP-BY-STEP CALCULATION BODY */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
        {/* ========================================================================= */}
        {/* TAB 1: ARITHMETIC (Addition, Subtraction, Multiplication, Division) */}
        {/* ========================================================================= */}
        {activeProcess === 'arithmetic' && (
          <div className="space-y-3.5">
            {/* Arithmetic Operator Bar */}
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: 'add', label: 'Addition (A + B)', icon: Plus },
                { id: 'subtract', label: 'Subtraction (A - B)', icon: Minus },
                { id: 'multiply', label: 'Multiplication (A × B)', icon: MultiplyIcon },
                { id: 'divide', label: 'Division (A · B⁻¹)', icon: Divide },
              ].map((op) => {
                const isSelected = arithmeticOp === op.id;
                const OpIcon = op.icon;
                return (
                  <button
                    key={op.id}
                    onClick={() => setArithmeticOp(op.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold border flex items-center gap-1.5 rounded-none transition-all ${
                      isSelected
                        ? 'bg-[#00693E] text-white border-[#00693E] shadow-sm'
                        : isLight
                        ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                        : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    <OpIcon className="w-3.5 h-3.5" />
                    <span>{op.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Arithmetic Output Result Card */}
            {arithmeticResult.error ? (
              <div className="p-3 border border-[#c84442]/40 bg-[#c84442]/10 text-[#c84442] text-xs font-mono">
                {arithmeticResult.error}
              </div>
            ) : arithmeticResult.data ? (
              <div className="space-y-3">
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Matrix Arithmetic Result
                    </span>
                    <button
                      onClick={() => handleCopy(arithmeticResult.data!.latex)}
                      className={`p-1 border rounded-none ${
                        isLight ? 'hover:bg-neutral-200 border-neutral-300' : 'hover:bg-neutral-800 border-neutral-700'
                      }`}
                      title="Copy LaTeX"
                    >
                      {copiedText === arithmeticResult.data!.latex ? (
                        <Check className="w-3.5 h-3.5 text-[#00693E]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 opacity-70" />
                      )}
                    </button>
                  </div>

                  <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <MathDisplay latex={arithmeticResult.data.latex} className="text-base font-serif font-bold text-[#00693E]" />
                  </div>
                </div>

                {/* Step-by-Step Breakdown */}
                <div
                  className={`p-3.5 border rounded-none space-y-3 ${
                    isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-[#00693E]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Step-by-Step Matrix Calculation</span>
                  </div>

                  <div className="space-y-2.5">
                    {arithmeticResult.data.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 border rounded-none space-y-1.5 ${
                          isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-900'
                        }`}
                      >
                        <div className="text-xs font-bold text-[#00693E]">{step.title}</div>
                        {step.latex && (
                          <div className={`p-2 border rounded-none overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950 border-neutral-900'}`}>
                            <MathDisplay latex={step.latex} className="text-sm font-serif" />
                          </div>
                        )}
                        <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          {step.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: ROW OPERATIONS (Interactive Elementary Row Operations) */}
        {/* ========================================================================= */}
        {activeProcess === 'row_ops' && (
          <div className="space-y-3.5">
            {/* Interactive Row Operation Controls */}
            <div
              className={`p-3.5 border rounded-none space-y-3 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Elementary Row Operations Engine
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleUndoRowOp}
                    disabled={rowOpHistory.length === 0}
                    className={`px-2 py-1 text-xs border rounded-none font-mono flex items-center gap-1 ${
                      isLight ? 'bg-white hover:bg-neutral-100 border-neutral-300' : 'bg-black hover:bg-neutral-900 border-neutral-700'
                    } disabled:opacity-30`}
                    title="Undo last row operation"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>Undo</span>
                  </button>
                  <button
                    onClick={handleResetRowOps}
                    className={`px-2 py-1 text-xs border rounded-none font-mono flex items-center gap-1 ${
                      isLight ? 'bg-white hover:bg-neutral-100 border-neutral-300' : 'bg-black hover:bg-neutral-900 border-neutral-700'
                    }`}
                    title="Reset to original Matrix A"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Operation Mode Selector */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'add', label: 'R_i + k·R_j → R_i (Add Multiple)' },
                  { id: 'scale', label: 'k·R_i → R_i (Scale Row)' },
                  { id: 'swap', label: 'R_i ↔ R_j (Swap Rows)' },
                ].map((op) => (
                  <button
                    key={op.id}
                    onClick={() => setRowOpType(op.id as any)}
                    className={`p-2 text-xs font-bold border rounded-none text-center transition-all ${
                      rowOpType === op.id
                        ? 'bg-[#2d6fb4] text-white border-[#2d6fb4]'
                        : isLight
                        ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                        : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    {op.label}
                  </button>
                ))}
              </div>

              {/* Parameters Input */}
              <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                {rowOpType === 'swap' && (
                  <div className="flex items-center gap-2">
                    <span>Swap Row:</span>
                    <select
                      value={swapR1}
                      onChange={(e) => setSwapR1(parseInt(e.target.value))}
                      className={`px-2 py-1 border rounded-none ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'}`}
                    >
                      {Array.from({ length: rowsA }, (_, i) => (
                        <option key={i + 1} value={i + 1}>R{i + 1}</option>
                      ))}
                    </select>
                    <span>with</span>
                    <select
                      value={swapR2}
                      onChange={(e) => setSwapR2(parseInt(e.target.value))}
                      className={`px-2 py-1 border rounded-none ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'}`}
                    >
                      {Array.from({ length: rowsA }, (_, i) => (
                        <option key={i + 1} value={i + 1}>R{i + 1}</option>
                      ))}
                    </select>
                  </div>
                )}

                {rowOpType === 'scale' && (
                  <div className="flex items-center gap-2">
                    <span>Scale Row:</span>
                    <select
                      value={scaleR}
                      onChange={(e) => setScaleR(parseInt(e.target.value))}
                      className={`px-2 py-1 border rounded-none ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'}`}
                    >
                      {Array.from({ length: rowsA }, (_, i) => (
                        <option key={i + 1} value={i + 1}>R{i + 1}</option>
                      ))}
                    </select>
                    <span>by factor k =</span>
                    <input
                      type="text"
                      value={scaleK}
                      onChange={(e) => setScaleK(e.target.value)}
                      placeholder="e.g. 2, -1/3, 0.5"
                      className={`w-20 px-2 py-1 border text-center font-bold rounded-none ${
                        isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                      }`}
                    />
                  </div>
                )}

                {rowOpType === 'add' && (
                  <div className="flex items-center gap-2">
                    <span>Target:</span>
                    <select
                      value={addTargetR}
                      onChange={(e) => setAddTargetR(parseInt(e.target.value))}
                      className={`px-2 py-1 border rounded-none font-bold text-[#00693E] ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'}`}
                    >
                      {Array.from({ length: rowsA }, (_, i) => (
                        <option key={i + 1} value={i + 1}>R{i + 1}</option>
                      ))}
                    </select>
                    <span>← Target + (</span>
                    <input
                      type="text"
                      value={addK}
                      onChange={(e) => setAddK(e.target.value)}
                      placeholder="k"
                      className={`w-16 px-2 py-1 border text-center font-bold rounded-none ${
                        isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                      }`}
                    />
                    <span>) ·</span>
                    <select
                      value={addSourceR}
                      onChange={(e) => setAddSourceR(parseInt(e.target.value))}
                      className={`px-2 py-1 border rounded-none font-bold text-[#2d6fb4] ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'}`}
                    >
                      {Array.from({ length: rowsA }, (_, i) => (
                        <option key={i + 1} value={i + 1}>R{i + 1}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  onClick={handleApplyRowOp}
                  className="px-3 py-1 bg-[#00693E] hover:bg-[#005230] text-white font-bold rounded-none shadow-sm flex items-center gap-1.5"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Execute Operation</span>
                </button>
              </div>
            </div>

            {/* Current Working Matrix */}
            <div
              className={`p-3.5 border rounded-none space-y-2.5 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider">
                Current Matrix State (After {rowOpHistory.length} operation{rowOpHistory.length === 1 ? '' : 's'})
              </span>
              <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                <MathDisplay latex={matrixToLatex(rowOpMatrix)} className="text-lg font-serif font-bold text-[#2d6fb4]" />
              </div>
            </div>

            {/* History of Applied Row Operations */}
            {rowOpHistory.length > 0 && (
              <div
                className={`p-3.5 border rounded-none space-y-3 ${
                  isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-[#2d6fb4]" />
                  <span className="text-xs font-bold uppercase tracking-wider">Audit Log of Applied Operations</span>
                </div>

                <div className="space-y-2">
                  {rowOpHistory.map((h, idx) => (
                    <div
                      key={idx}
                      className={`p-2.5 border rounded-none space-y-1 ${
                        isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-900'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#2d6fb4]">
                        Step {idx + 1}: {h.step.title}
                      </div>
                      <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        {h.step.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: DETERMINANT */}
        {/* ========================================================================= */}
        {activeProcess === 'determinant' && (
          <div className="space-y-3.5">
            {determinantResult.error ? (
              <div className="p-3 border border-[#c84442]/40 bg-[#c84442]/10 text-[#c84442] text-xs font-mono">
                {determinantResult.error}
              </div>
            ) : determinantResult.data ? (
              <div className="space-y-3">
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Determinant Value: det(A) or |A|
                    </span>
                    <button
                      onClick={() => handleCopy(`\\det(A) = ${determinantResult.data!.latex}`)}
                      className={`p-1 border rounded-none ${
                        isLight ? 'hover:bg-neutral-200 border-neutral-300' : 'hover:bg-neutral-800 border-neutral-700'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </div>

                  <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <MathDisplay latex={`\\det(A) = ${determinantResult.data.latex}`} className="text-xl font-serif font-bold text-[#fa7d19]" />
                  </div>
                </div>

                {/* Step-by-Step Breakdown */}
                <div
                  className={`p-3.5 border rounded-none space-y-3 ${
                    isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-[#fa7d19]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Step-by-Step Determinant Expansion</span>
                  </div>

                  <div className="space-y-2.5">
                    {determinantResult.data.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 border rounded-none space-y-1.5 ${
                          isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-900'
                        }`}
                      >
                        <div className="text-xs font-bold text-[#fa7d19]">{step.title}</div>
                        {step.latex && (
                          <div className={`p-2 border rounded-none overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950 border-neutral-900'}`}>
                            <MathDisplay latex={step.latex} className="text-sm font-serif" />
                          </div>
                        )}
                        <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          {step.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: ROW-ECHELON FORM (REF) */}
        {/* ========================================================================= */}
        {activeProcess === 'ref' && (
          <div className="space-y-3.5">
            {refResult.error ? (
              <div className="p-3 border border-[#c84442]/40 bg-[#c84442]/10 text-[#c84442] text-xs font-mono">
                {refResult.error}
              </div>
            ) : refResult.data ? (
              <div className="space-y-3">
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Row-Echelon Form (REF)
                    </span>
                    <button
                      onClick={() => handleCopy(refResult.data!.latex)}
                      className={`p-1 border rounded-none ${
                        isLight ? 'hover:bg-neutral-200 border-neutral-300' : 'hover:bg-neutral-800 border-neutral-700'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </div>

                  <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <MathDisplay latex={refResult.data.latex} className="text-base font-serif font-bold text-[#6042a6]" />
                  </div>
                </div>

                {/* Step-by-Step Breakdown */}
                <div
                  className={`p-3.5 border rounded-none space-y-3 ${
                    isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-[#6042a6]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Gaussian Elimination Steps to REF</span>
                  </div>

                  <div className="space-y-2.5">
                    {refResult.data.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 border rounded-none space-y-1.5 ${
                          isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-900'
                        }`}
                      >
                        <div className="text-xs font-bold text-[#6042a6]">{step.title}</div>
                        {step.latex && (
                          <div className={`p-2 border rounded-none overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950 border-neutral-900'}`}>
                            <MathDisplay latex={step.latex} className="text-sm font-serif" />
                          </div>
                        )}
                        <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          {step.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: REDUCED ROW-ECHELON FORM (RREF) */}
        {/* ========================================================================= */}
        {activeProcess === 'rref' && (
          <div className="space-y-3.5">
            {rrefResult.error ? (
              <div className="p-3 border border-[#c84442]/40 bg-[#c84442]/10 text-[#c84442] text-xs font-mono">
                {rrefResult.error}
              </div>
            ) : rrefResult.data ? (
              <div className="space-y-3">
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Reduced Row-Echelon Form (RREF)
                    </span>
                    <button
                      onClick={() => handleCopy(rrefResult.data!.latex)}
                      className={`p-1 border rounded-none ${
                        isLight ? 'hover:bg-neutral-200 border-neutral-300' : 'hover:bg-neutral-800 border-neutral-700'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </div>

                  <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <MathDisplay latex={rrefResult.data.latex} className="text-base font-serif font-bold text-[#00693E]" />
                  </div>
                </div>

                {/* Step-by-Step Breakdown */}
                <div
                  className={`p-3.5 border rounded-none space-y-3 ${
                    isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-[#00693E]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Gauss-Jordan Elimination Steps to RREF</span>
                  </div>

                  <div className="space-y-2.5">
                    {rrefResult.data.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 border rounded-none space-y-1.5 ${
                          isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-900'
                        }`}
                      >
                        <div className="text-xs font-bold text-[#00693E]">{step.title}</div>
                        {step.latex && (
                          <div className={`p-2 border rounded-none overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950 border-neutral-900'}`}>
                            <MathDisplay latex={step.latex} className="text-sm font-serif" />
                          </div>
                        )}
                        <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          {step.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 6: TRANSPOSE (A^T) */}
        {/* ========================================================================= */}
        {activeProcess === 'transpose' && (
          <div className="space-y-3.5">
            {transposeResult.error ? (
              <div className="p-3 border border-[#c84442]/40 bg-[#c84442]/10 text-[#c84442] text-xs font-mono">
                {transposeResult.error}
              </div>
            ) : transposeResult.data ? (
              <div className="space-y-3">
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Matrix Transpose: Aᵀ
                    </span>
                    <button
                      onClick={() => handleCopy(transposeResult.data!.latex)}
                      className={`p-1 border rounded-none ${
                        isLight ? 'hover:bg-neutral-200 border-neutral-300' : 'hover:bg-neutral-800 border-neutral-700'
                      }`}
                    >
                      <Copy className="w-3.5 h-3.5 opacity-70" />
                    </button>
                  </div>

                  <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <MathDisplay latex={transposeResult.data.latex} className="text-base font-serif font-bold text-[#2d6fb4]" />
                  </div>
                </div>

                {/* Step-by-Step Breakdown */}
                <div
                  className={`p-3.5 border rounded-none space-y-3 ${
                    isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-[#2d6fb4]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Transpose Row-to-Column Mapping</span>
                  </div>

                  <div className="space-y-2.5">
                    {transposeResult.data.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 border rounded-none space-y-1.5 ${
                          isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-900'
                        }`}
                      >
                        <div className="text-xs font-bold text-[#2d6fb4]">{step.title}</div>
                        {step.latex && (
                          <div className={`p-2 border rounded-none overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950 border-neutral-900'}`}>
                            <MathDisplay latex={step.latex} className="text-sm font-serif" />
                          </div>
                        )}
                        <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          {step.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 7: VECTORS SUITE (Dot, Cross, Norm, Angle) */}
        {/* ========================================================================= */}
        {activeProcess === 'vectors' && (
          <div className="space-y-3.5">
            {vectorResults.error ? (
              <div className="p-3 border border-[#c84442]/40 bg-[#c84442]/10 text-[#c84442] text-xs font-mono">
                {vectorResults.error}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary Metrics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className={`p-3 border rounded-none space-y-1 ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Dot Product u · v
                    </span>
                    <div className="text-lg font-serif font-bold text-[#00693E]">
                      {vectorResults.dot?.latex}
                    </div>
                  </div>

                  <div className={`p-3 border rounded-none space-y-1 ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Angle Between (θ)
                    </span>
                    <div className="text-lg font-serif font-bold text-[#2d6fb4]">
                      {vectorResults.angleDeg.toFixed(2)}°
                    </div>
                  </div>

                  <div className={`p-3 border rounded-none space-y-1 ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Vector Magnitudes
                    </span>
                    <div className="text-xs font-mono space-y-0.5">
                      <div>||u|| = {vectorResults.normU.toFixed(4)}</div>
                      <div>||v|| = {vectorResults.normV.toFixed(4)}</div>
                    </div>
                  </div>
                </div>

                {/* 3D Cross Product Card */}
                {vectorResults.cross && (
                  <div
                    className={`p-3.5 border rounded-none space-y-2.5 ${
                      isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                    }`}
                  >
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Cross Product: u × v (Orthogonal Normal Vector)
                    </span>
                    <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <MathDisplay latex={vectorResults.cross.latex} className="text-base font-serif font-bold text-[#fa7d19]" />
                    </div>
                  </div>
                )}

                {/* Step-by-Step Dot Product */}
                {vectorResults.dot && (
                  <div
                    className={`p-3.5 border rounded-none space-y-3 ${
                      isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ListOrdered className="w-4 h-4 text-[#00693E]" />
                      <span className="text-xs font-bold uppercase tracking-wider">Dot Product Calculation Steps</span>
                    </div>

                    <div className="space-y-2.5">
                      {vectorResults.dot.steps.map((step, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 border rounded-none space-y-1.5 ${
                            isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-900'
                          }`}
                        >
                          <div className="text-xs font-bold text-[#00693E]">{step.title}</div>
                          {step.latex && (
                            <div className={`p-2 border rounded-none overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-neutral-950 border-neutral-900'}`}>
                              <MathDisplay latex={step.latex} className="text-sm font-serif" />
                            </div>
                          )}
                          <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            {step.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
