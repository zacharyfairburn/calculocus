import React, { useState, useMemo } from 'react';
import { MathItem } from '../types';
import { Parser } from '../engine/parser';
import { astToLatex, astToExpression, evaluateAST } from '../engine/ast';
import { SymbolicDifferentiator } from '../engine/differentiator';
import { SymbolicIntegrator } from '../engine/integrator';
import { NumericalSolvers } from '../engine/solvers';
import { normalizeFunctionInput } from '../engine/analyzer';
import { MathDisplay } from './MathDisplay';
import {
  Activity,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Sliders,
  TrendingUp,
  CircleDot,
  Maximize2,
  Compass,
  CornerDownLeft,
  Plus,
  Check,
  Sigma,
  Target,
  Binary,
} from 'lucide-react';

interface CalculusAnalyzerProps {
  items: MathItem[];
  selectedItemId: string | null;
  onSelectItem?: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<MathItem>) => void;
  onJumpToPoint?: (x: number, y: number) => void;
  onSetTangentX?: (x: number | null) => void;
  onAddItem?: (type: any, rawInput: string) => void;
  theme?: 'dark' | 'light';
}

const PRESETS = [
  { name: 'Cubic Polynomial', formula: 'x^3 - 3*x' },
  { name: 'Sine Wave', formula: 'sin(x)' },
  { name: 'Gaussian / Normal Bell', formula: 'exp(-x^2)' },
  { name: 'Rational Function', formula: '(x^2 - 1)/(x - 2)' },
  { name: 'Damped Oscillation', formula: 'exp(-0.2*x)*cos(3*x)' },
];

export const CalculusAnalyzer: React.FC<CalculusAnalyzerProps> = ({
  items,
  selectedItemId,
  onSelectItem,
  onUpdateItem,
  onJumpToPoint,
  onSetTangentX,
  onAddItem,
  theme = 'dark',
}) => {
  const [activeTab, setActiveTab] = useState<'derivative' | 'integral' | 'analyze' | 'limits'>('derivative');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customFormula, setCustomFormula] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  // Derivative & Tangent State
  const [tangentPointX, setTangentPointX] = useState<number>(1);
  const [showNormal, setShowNormal] = useState<boolean>(false);

  // Definite Integral State
  const [integralA, setIntegralA] = useState<number>(0);
  const [integralB, setIntegralB] = useState<number>(2);
  const [riemannMethod, setRiemannMethod] = useState<'none' | 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson'>('left');
  const [riemannN, setRiemannN] = useState<number>(8);

  // Limits & Series State
  const [limitPointC, setLimitPointC] = useState<number>(0);
  const [taylorOrder, setTaylorOrder] = useState<number>(4);
  const [taylorCenter, setTaylorCenter] = useState<number>(0);

  const isLight = theme === 'light';

  const [addedFormula, setAddedFormula] = useState<string | null>(null);

  // Determine active item - empty by default unless selectedItemId exists
  const activeItem = useMemo(() => {
    if (selectedItemId) {
      const found = items.find((it) => it.id === selectedItemId);
      if (found) return found;
    }
    return null;
  }, [items, selectedItemId]);

  const rawInput = isCustom ? customFormula : activeItem ? activeItem.rawInput : '';
  const hasSelection = Boolean(rawInput.trim());
  const norm = hasSelection ? normalizeFunctionInput(rawInput) : { expression: '', label: '', isImplicit: false, cleanLhs: '', cleanRhs: '' };

  let ast: any = null;
  let fPrimeAst: any = null;
  let fDoublePrimeAst: any = null;
  let fTriplePrimeAst: any = null;
  let symbolicIntAst: any = null;
  let parseError = '';

  if (hasSelection) {
    try {
      ast = Parser.parse(norm.expression);
      fPrimeAst = SymbolicDifferentiator.diff(ast, 'x');
      fDoublePrimeAst = SymbolicDifferentiator.diff(fPrimeAst, 'x');
      fTriplePrimeAst = SymbolicDifferentiator.diff(fDoublePrimeAst, 'x');
      symbolicIntAst = SymbolicIntegrator.integrate(ast, 'x');
    } catch (err: any) {
      parseError = err.message || 'Syntax error in function formula';
    }
  }

  // Tangent and derivative evaluations at tangentPointX
  const yVal = ast ? evaluateAST(ast, { x: tangentPointX }) : NaN;
  const slopeVal = fPrimeAst ? evaluateAST(fPrimeAst, { x: tangentPointX }) : NaN;
  const concavityVal = fDoublePrimeAst ? evaluateAST(fDoublePrimeAst, { x: tangentPointX }) : NaN;

  // Tangent line formula: y - y0 = m(x - x0) => y = mx + (y0 - m*x0)
  const tangentIntercept = yVal - slopeVal * tangentPointX;
  const tangentLatex =
    !isNaN(slopeVal) && !isNaN(yVal)
      ? `y = ${slopeVal.toFixed(3)}x ${tangentIntercept >= 0 ? '+' : '-'} ${Math.abs(tangentIntercept).toFixed(3)}`
      : 'Undefined';

  // Normal line formula: slope = -1/m
  let normalLatex = 'Undefined';
  if (!isNaN(slopeVal) && !isNaN(yVal)) {
    if (Math.abs(slopeVal) < 1e-6) {
      normalLatex = `x = ${tangentPointX.toFixed(3)} \\quad \\text{(Vertical line)}`;
    } else {
      const normalSlope = -1 / slopeVal;
      const normalIntercept = yVal - normalSlope * tangentPointX;
      normalLatex = `y = ${normalSlope.toFixed(3)}x ${normalIntercept >= 0 ? '+' : '-'} ${Math.abs(normalIntercept).toFixed(3)}`;
    }
  }

  // Curvature kappa = |f''| / (1 + (f')^2)^(3/2)
  const curvature =
    !isNaN(slopeVal) && !isNaN(concavityVal)
      ? Math.abs(concavityVal) / Math.pow(1 + slopeVal * slopeVal, 1.5)
      : NaN;

  // Definite integral & Riemann evaluation
  const exactIntegral = ast ? SymbolicIntegrator.adaptiveSimpson(ast, integralA, integralB) : 0;
  const riemannResult = ast
    ? NumericalSolvers.computeRiemannSum(
        ast,
        integralA,
        integralB,
        riemannN,
        riemannMethod === 'none' ? 'left' : riemannMethod
      )
    : { value: 0, rectangles: [] };
  const arcLength = ast ? NumericalSolvers.computeArcLength(ast, integralA, integralB) : 0;

  // Volume of revolution (Disk method: V = pi * int(f^2 dx))
  const volumeRevolution = ast
    ? Math.PI * SymbolicIntegrator.adaptiveSimpson({ type: 'power', base: ast, exponent: { type: 'number', value: 2 } }, integralA, integralB)
    : 0;

  // Critical points and roots
  const criticalPoints = ast ? NumericalSolvers.findCriticalPoints(ast, -12, 12) : [];
  const roots = criticalPoints.filter((p) => p.type === 'zero');
  const extrema = criticalPoints.filter((p) => p.type === 'min' || p.type === 'max');
  const inflections = criticalPoints.filter((p) => p.type === 'inflection');

  // Limit evaluations around limitPointC
  const limitLeft = ast ? evaluateAST(ast, { x: limitPointC - 1e-5 }) : NaN;
  const limitRight = ast ? evaluateAST(ast, { x: limitPointC + 1e-5 }) : NaN;
  const limitExact = ast ? evaluateAST(ast, { x: limitPointC }) : NaN;
  const limitPosInf = ast ? evaluateAST(ast, { x: 1e5 }) : NaN;
  const limitNegInf = ast ? evaluateAST(ast, { x: -1e5 }) : NaN;

  // Compute Taylor Series Polynomial
  const taylorTerms: string[] = [];
  if (ast) {
    const f0 = evaluateAST(ast, { x: taylorCenter });
    if (!isNaN(f0) && Math.abs(f0) > 1e-5) taylorTerms.push(`${f0.toFixed(3)}`);

    if (fPrimeAst) {
      const f1 = evaluateAST(fPrimeAst, { x: taylorCenter });
      if (!isNaN(f1) && Math.abs(f1) > 1e-5) {
        const factor = taylorCenter === 0 ? 'x' : `(x - ${taylorCenter})`;
        taylorTerms.push(`${f1 >= 0 && taylorTerms.length > 0 ? '+' : ''}${f1.toFixed(3)}${factor}`);
      }
    }

    if (fDoublePrimeAst && taylorOrder >= 2) {
      const f2 = evaluateAST(fDoublePrimeAst, { x: taylorCenter }) / 2;
      if (!isNaN(f2) && Math.abs(f2) > 1e-5) {
        const factor = taylorCenter === 0 ? 'x^2' : `(x - ${taylorCenter})^2`;
        taylorTerms.push(`${f2 >= 0 && taylorTerms.length > 0 ? '+' : ''}${f2.toFixed(3)}${factor}`);
      }
    }

    if (fTriplePrimeAst && taylorOrder >= 3) {
      const f3 = evaluateAST(fTriplePrimeAst, { x: taylorCenter }) / 6;
      if (!isNaN(f3) && Math.abs(f3) > 1e-5) {
        const factor = taylorCenter === 0 ? 'x^3' : `(x - ${taylorCenter})^3`;
        taylorTerms.push(`${f3 >= 0 && taylorTerms.length > 0 ? '+' : ''}${f3.toFixed(3)}${factor}`);
      }
    }
  }

  const taylorLatex = taylorTerms.length > 0 ? `P_${taylorOrder}(x) \\approx ${taylorTerms.join(' ')}` : 'P(x) \\approx 0';

  const handleApplyTangent = (val: number) => {
    setTangentPointX(val);
    onSetTangentX?.(val);
    if (activeItem) {
      onUpdateItem(activeItem.id, { tangentX: val, showNormalLine: showNormal });
    }
  };

  const handleToggleNormal = () => {
    const next = !showNormal;
    setShowNormal(next);
    if (activeItem) {
      onUpdateItem(activeItem.id, { showNormalLine: next });
    }
  };

  const handleApplyIntegralRange = (a: number, b: number) => {
    setIntegralA(a);
    setIntegralB(b);
    if (activeItem) {
      onUpdateItem(activeItem.id, {
        isIntegralVisible: true,
        integralRange: [a, b],
        riemannMode: riemannMethod,
        riemannN: riemannN,
      });
    }
  };

  const handleToggleRiemannMode = (m: 'none' | 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson') => {
    setRiemannMethod(m);
    if (activeItem) {
      onUpdateItem(activeItem.id, {
        isIntegralVisible: true,
        integralRange: [integralA, integralB],
        riemannMode: m,
        riemannN: riemannN,
      });
    }
  };

  return (
    <div
      className={`flex flex-col h-full select-none rounded-none ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* 1. TOP FUNCTION SELECTOR BAR */}
      <div
        className={`p-2.5 border-b space-y-2 shrink-0 rounded-none ${
          isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <span className={`text-[10px] uppercase font-bold tracking-wider shrink-0 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Function:
          </span>

          <div className="relative min-w-0 flex-1">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full px-2.5 py-1.5 border rounded-none flex items-center justify-between text-left text-xs font-mono font-bold truncate transition-all ${
                isLight
                  ? 'bg-white border-neutral-300 hover:bg-neutral-100 text-black'
                  : 'bg-black border-neutral-800 hover:bg-neutral-900 text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {activeItem && !isCustom && (
                  <span
                    className="w-2.5 h-2.5 rounded-none shrink-0"
                    style={{ backgroundColor: activeItem.color }}
                  />
                )}
                <span className={`truncate ${!hasSelection ? 'italic font-normal opacity-60' : ''}`}>
                  {hasSelection ? rawInput : 'Select an equation or preset...'}
                </span>
              </div>
              <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className={`absolute top-full left-0 right-0 mt-1 border p-1 shadow-2xl z-50 rounded-none max-h-60 overflow-y-auto ${
                  isLight
                    ? 'bg-white border-neutral-300 shadow-black/15 text-black'
                    : 'bg-neutral-950 border-neutral-800 shadow-black/80 text-white'
                }`}
              >
                <div className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider border-b mb-1 ${isLight ? 'text-neutral-500 border-neutral-200' : 'text-neutral-400 border-neutral-800'}`}>
                  Workspace Equations
                </div>
                {items.length === 0 ? (
                  <div className={`p-2 text-xs italic ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
                    No functions on canvas.
                  </div>
                ) : (
                  items.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => {
                        onSelectItem?.(it.id);
                        setIsCustom(false);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full p-2 rounded-none flex items-center justify-between text-left text-xs font-mono border transition-all ${
                        it.id === selectedItemId && !isCustom
                          ? 'bg-[#00693E]/15 text-[#00693E] border-[#00693E]/40 font-bold'
                          : isLight
                          ? 'hover:bg-neutral-100 border-transparent text-neutral-800'
                          : 'hover:bg-neutral-900 border-transparent text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-2.5 h-2.5 rounded-none shrink-0" style={{ backgroundColor: it.color }} />
                        <span className="truncate">{it.rawInput}</span>
                      </div>
                      <span className={`text-[10px] uppercase px-1 py-0.5 border shrink-0 ${isLight ? 'bg-neutral-100 border-neutral-200 text-neutral-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'}`}>
                        {it.type}
                      </span>
                    </button>
                  ))
                )}

                <div className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider border-t border-b my-1 ${isLight ? 'text-neutral-500 border-neutral-200' : 'text-neutral-400 border-neutral-800'}`}>
                  Calculus Presets
                </div>
                {PRESETS.map((pr, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (onAddItem) {
                        onAddItem('cartesian', pr.formula);
                      } else {
                        setCustomFormula(pr.formula);
                        setIsCustom(true);
                      }
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full p-1.5 rounded-none text-left text-xs flex items-center justify-between transition-all ${
                      isLight ? 'hover:bg-neutral-100 text-neutral-800' : 'hover:bg-neutral-900 text-neutral-200'
                    }`}
                  >
                    <span className="font-semibold text-[11px]">{pr.name}</span>
                    <span className={`font-mono text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>{pr.formula}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS NAVIGATION */}
      <div
        className={`flex items-center gap-1 p-2 border-b overflow-x-auto shrink-0 rounded-none ${
          isLight ? 'bg-neutral-100/50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <button
          onClick={() => setActiveTab('derivative')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'derivative'
              ? 'bg-[#00693E] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Derivatives & Tangents</span>
        </button>
        <button
          onClick={() => setActiveTab('integral')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'integral'
              ? 'bg-[#2d6fb4] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Sigma className="w-3.5 h-3.5" />
          <span>Integrals & Riemann</span>
        </button>
        <button
          onClick={() => setActiveTab('analyze')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'analyze'
              ? 'bg-[#fa7d19] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Critical Points</span>
        </button>
        <button
          onClick={() => setActiveTab('limits')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'limits'
              ? 'bg-[#6042a6] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Binary className="w-3.5 h-3.5" />
          <span>Limits & Series</span>
        </button>
      </div>

      {/* 3. MAIN TAB CONTENT */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
        {!hasSelection ? (
          /* EMPTY START SELECTION VIEW */
          <div className="space-y-4 py-4 text-center">
            <div className={`p-6 border rounded-none max-w-md mx-auto space-y-3 ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
              <Activity className="w-8 h-8 text-[#00693E] mx-auto opacity-80" />
              <h4 className="text-sm font-bold tracking-tight">No Equation Selected for Calculus</h4>
              <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                Select an equation from the dropdown above or click a calculus preset below to analyze derivatives, tangents, definite integrals, and series.
              </p>

              <div className="pt-2 text-left space-y-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider block ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  Quick Load Presets:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PRESETS.map((pr, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        if (onAddItem) {
                          onAddItem('cartesian', pr.formula);
                        } else {
                          setCustomFormula(pr.formula);
                          setIsCustom(true);
                        }
                      }}
                      className={`p-2 border rounded-none text-left transition-all ${
                        isLight ? 'bg-white hover:bg-neutral-100 border-neutral-300' : 'bg-black hover:bg-neutral-900 border-neutral-800'
                      }`}
                    >
                      <div className="text-xs font-bold text-[#00693E]">{pr.name}</div>
                      <div className={`text-[10px] font-mono truncate ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        {pr.formula}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : parseError ? (
          <div className="p-3 bg-[#c84442]/10 border border-[#c84442]/40 rounded-none text-[#c84442] text-xs font-mono">
            {parseError}
          </div>
        ) : (
          <>
            {addedFormula && (
              <div className="p-2.5 bg-[#00693E]/15 border border-[#00693E]/40 text-[#00693E] text-xs font-mono flex items-center justify-between">
                <span>Added equation: <strong>y = {addedFormula}</strong></span>
                <Check className="w-4 h-4" />
              </div>
            )}

            {/* TAB 1: DERIVATIVES & TANGENTS */}
            {activeTab === 'derivative' && (
              <div className="space-y-3.5">
                {/* Symbolic Derivatives Display */}
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      Symbolic Derivatives
                    </span>
                    {activeItem && (
                      <button
                        onClick={() =>
                          onUpdateItem(activeItem.id, {
                            isDerivativeVisible: !activeItem.isDerivativeVisible,
                          })
                        }
                        className={`text-[11px] font-bold px-2 py-0.5 border rounded-none flex items-center gap-1 transition-all ${
                          activeItem.isDerivativeVisible
                            ? 'bg-[#00693E] text-white border-[#00693E]'
                            : isLight
                            ? 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200'
                            : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
                        }`}
                      >
                        {activeItem.isDerivativeVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{activeItem.isDerivativeVisible ? "Plot f'(x) ON" : "Plot f'(x) OFF"}</span>
                      </button>
                    )}
                  </div>

                  {/* f'(x) */}
                  <div className={`p-2.5 rounded-none border space-y-1.5 text-xs ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        First Derivative f'(x):
                      </span>
                      {fPrimeAst && onAddItem && (
                        <button
                          onClick={() => {
                            const fStr = astToExpression(fPrimeAst);
                            onAddItem('cartesian', fStr);
                            setAddedFormula(fStr);
                            setTimeout(() => setAddedFormula(null), 2500);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold border rounded-none flex items-center gap-1 bg-[#00693E] text-white hover:bg-[#005530] border-[#00693E]"
                          title="Add f'(x) as equation"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Add as Eq</span>
                        </button>
                      )}
                    </div>
                    <div className="font-bold text-sm text-[#00693E]">
                      <MathDisplay math={`f'(x) = ${fPrimeAst ? astToLatex(fPrimeAst) : '0'}`} />
                    </div>
                  </div>

                  {/* f''(x) */}
                  <div className={`p-2.5 rounded-none border space-y-1.5 text-xs ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Second Derivative f''(x):
                      </span>
                      {fDoublePrimeAst && onAddItem && (
                        <button
                          onClick={() => {
                            const fStr = astToExpression(fDoublePrimeAst);
                            onAddItem('cartesian', fStr);
                            setAddedFormula(fStr);
                            setTimeout(() => setAddedFormula(null), 2500);
                          }}
                          className="px-2 py-0.5 text-[10px] font-bold border rounded-none flex items-center gap-1 bg-[#6042a6] text-white hover:bg-[#4d3485] border-[#6042a6]"
                          title="Add f''(x) as equation"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>Add as Eq</span>
                        </button>
                      )}
                    </div>
                    <div className="font-bold text-sm text-[#6042a6]">
                      <MathDisplay math={`f''(x) = ${fDoublePrimeAst ? astToLatex(fDoublePrimeAst) : '0'}`} />
                    </div>
                  </div>
                </div>

                {/* Point Evaluation & Tangent Line */}
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#00693E] uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Tangent & Normal Line at x₀</span>
                    </span>
                  </div>

                  {/* Slider & Input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Evaluation Point (x₀):</span>
                      <input
                        type="number"
                        step="0.1"
                        value={tangentPointX}
                        onChange={(e) => handleApplyTangent(parseFloat(e.target.value) || 0)}
                        className={`w-20 px-2 py-0.5 border text-right font-mono text-xs rounded-none ${
                          isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                        }`}
                      />
                    </div>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      step="0.05"
                      value={tangentPointX}
                      onChange={(e) => handleApplyTangent(parseFloat(e.target.value))}
                      className="w-full accent-[#00693E]"
                    />
                  </div>

                  {/* Calculations Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className={`p-2 rounded-none border ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <div className={`text-[10px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Point (x₀, y₀):</div>
                      <div className="font-bold text-[#00693E] mt-0.5">({tangentPointX.toFixed(3)}, {yVal.toFixed(3)})</div>
                    </div>
                    <div className={`p-2 rounded-none border ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <div className={`text-[10px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Slope m = f'(x₀):</div>
                      <div className="font-bold text-[#2d6fb4] mt-0.5">{slopeVal.toFixed(4)}</div>
                    </div>
                    <div className={`p-2 rounded-none border ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <div className={`text-[10px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Concavity f''(x₀):</div>
                      <div className={`font-bold mt-0.5 ${concavityVal > 0 ? 'text-[#00693E]' : concavityVal < 0 ? 'text-[#c84442]' : 'text-neutral-400'}`}>
                        {concavityVal > 0 ? 'Concave Up' : concavityVal < 0 ? 'Concave Down' : 'Inflection'} ({concavityVal.toFixed(3)})
                      </div>
                    </div>
                    <div className={`p-2 rounded-none border ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <div className={`text-[10px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Curvature κ(x₀):</div>
                      <div className="font-bold text-[#6042a6] mt-0.5">{curvature.toFixed(4)}</div>
                    </div>
                  </div>

                  {/* Equations */}
                  <div className={`p-2.5 rounded-none border space-y-1.5 text-xs ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          Tangent Line:
                        </span>
                        {!isNaN(slopeVal) && !isNaN(yVal) && onAddItem && (
                          <button
                            onClick={() => {
                              const fStr = `${slopeVal.toFixed(4)}*x + (${tangentIntercept.toFixed(4)})`;
                              onAddItem('cartesian', fStr);
                              setAddedFormula(fStr);
                              setTimeout(() => setAddedFormula(null), 2500);
                            }}
                            className="px-2 py-0.5 text-[10px] font-bold border rounded-none flex items-center gap-1 bg-[#00693E] text-white hover:bg-[#005530] border-[#00693E]"
                            title="Add tangent line as equation"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Add as Eq</span>
                          </button>
                        )}
                      </div>
                      <div className="font-bold text-[#00693E]">
                        <MathDisplay math={tangentLatex} />
                      </div>
                    </div>
                    <div className="pt-1.5 border-t">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                          Normal Line (Perpendicular):
                        </span>
                        <div className="flex items-center gap-1">
                          {!isNaN(slopeVal) && Math.abs(slopeVal) >= 1e-6 && onAddItem && (
                            <button
                              onClick={() => {
                                const normalSlope = -1 / slopeVal;
                                const normalIntercept = yVal - normalSlope * tangentPointX;
                                const fStr = `${normalSlope.toFixed(4)}*x + (${normalIntercept.toFixed(4)})`;
                                onAddItem('cartesian', fStr);
                                setAddedFormula(fStr);
                                setTimeout(() => setAddedFormula(null), 2500);
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold border rounded-none flex items-center gap-1 bg-[#2d6fb4] text-white hover:bg-[#235892] border-[#2d6fb4]"
                              title="Add normal line as equation"
                            >
                              <Plus className="w-2.5 h-2.5" />
                              <span>Add as Eq</span>
                            </button>
                          )}
                          <button
                            onClick={handleToggleNormal}
                            className={`text-[10px] px-1.5 py-0.5 border rounded-none font-bold ${
                              showNormal
                                ? 'bg-[#2d6fb4] text-white border-[#2d6fb4]'
                                : isLight
                                ? 'bg-neutral-100 border-neutral-300'
                                : 'bg-neutral-900 border-neutral-800'
                            }`}
                          >
                            {showNormal ? 'Plot ON' : 'Plot OFF'}
                          </button>
                        </div>
                      </div>
                      <div className="font-bold text-[#2d6fb4] mt-0.5">
                        <MathDisplay math={normalLatex} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: INTEGRALS & RIEMANN SUMS */}
            {activeTab === 'integral' && (
              <div className="space-y-3.5">
                {/* Symbolic Antiderivative */}
                <div
                  className={`p-3.5 border rounded-none space-y-2 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      Indefinite Integral (Antiderivative)
                    </span>
                    {symbolicIntAst && onAddItem && (
                      <button
                        onClick={() => {
                          const fStr = astToExpression(symbolicIntAst);
                          onAddItem('cartesian', fStr);
                          setAddedFormula(fStr);
                          setTimeout(() => setAddedFormula(null), 2500);
                        }}
                        className="px-2 py-0.5 text-[10px] font-bold border rounded-none flex items-center gap-1 bg-[#2d6fb4] text-white hover:bg-[#235892] border-[#2d6fb4]"
                        title="Add antiderivative as equation"
                      >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Add as Eq</span>
                      </button>
                    )}
                  </div>
                  <div className={`p-2.5 rounded-none border text-xs ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <div className="font-bold text-sm text-[#2d6fb4]">
                      <MathDisplay
                        math={`\\int f(x)\\,dx = ${symbolicIntAst ? astToLatex(symbolicIntAst) : '\\text{Non-elementary or Numeric}'} + C`}
                      />
                    </div>
                  </div>
                </div>

                {/* Definite Integral Bounds & Controls */}
                <div
                  className={`p-3.5 border rounded-none space-y-3 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2d6fb4] uppercase tracking-wider flex items-center gap-1.5">
                      <CircleDot className="w-3.5 h-3.5" />
                      <span>Definite Integral & Riemann Sums</span>
                    </span>
                  </div>

                  {/* Bounds inputs */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Lower Bound (a):
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={integralA}
                        onChange={(e) => handleApplyIntegralRange(parseFloat(e.target.value) || 0, integralB)}
                        className={`w-full px-2 py-1 border font-mono rounded-none ${
                          isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Upper Bound (b):
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={integralB}
                        onChange={(e) => handleApplyIntegralRange(integralA, parseFloat(e.target.value) || 0)}
                        className={`w-full px-2 py-1 border font-mono rounded-none ${
                          isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Riemann Method Selector */}
                  <div className="space-y-1.5">
                    <label className={`block text-[10px] font-bold uppercase ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      Riemann Mode & Partitions (N = {riemannN}):
                    </label>
                    <div className="grid grid-cols-3 gap-1 text-[11px] font-semibold">
                      {(['left', 'right', 'midpoint', 'trapezoid', 'simpson', 'none'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => handleToggleRiemannMode(m)}
                          className={`px-2 py-1 border rounded-none capitalize transition-all ${
                            riemannMethod === m
                              ? 'bg-[#2d6fb4] text-white border-[#2d6fb4] font-bold'
                              : isLight
                              ? 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                              : 'bg-black text-neutral-400 border-neutral-800 hover:bg-neutral-900'
                          }`}
                        >
                          {m === 'none' ? 'Smooth Area' : m}
                        </button>
                      ))}
                    </div>
                    <input
                      type="range"
                      min="4"
                      max="100"
                      step="2"
                      value={riemannN}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setRiemannN(n);
                        if (activeItem) {
                          onUpdateItem(activeItem.id, { riemannN: n });
                        }
                      }}
                      className="w-full accent-[#2d6fb4]"
                    />
                  </div>

                  {/* Results Grid */}
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className={`p-2.5 rounded-none border flex items-center justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Exact Integral (Simpson's Quadrature):</span>
                      <span className="font-bold text-sm text-[#00693E]">{exactIntegral.toFixed(6)}</span>
                    </div>

                    {riemannMethod !== 'none' && (
                      <div className={`p-2.5 rounded-none border flex items-center justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                        <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Riemann Sum ({riemannMethod}, N={riemannN}):</span>
                        <span className="font-bold text-sm text-[#2d6fb4]">{riemannResult.value.toFixed(6)}</span>
                      </div>
                    )}

                    <div className={`p-2.5 rounded-none border flex items-center justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Arc Length L = ∫√(1 + (f')²) dx:</span>
                      <span className="font-bold text-sm text-[#fa7d19]">{arcLength.toFixed(6)}</span>
                    </div>

                    <div className={`p-2.5 rounded-none border flex items-center justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Volume of Revolution (Disk Method):</span>
                      <span className="font-bold text-sm text-[#6042a6]">{volumeRevolution.toFixed(6)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CRITICAL POINTS */}
            {activeTab === 'analyze' && (
              <div className="space-y-3.5">
                {/* Zeros / X-Intercepts */}
                <div
                  className={`p-3.5 border rounded-none space-y-2 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#2d6fb4] uppercase tracking-wider">
                      Zeros / Roots (f(x) = 0)
                    </span>
                    <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>{roots.length} found</span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    {roots.length === 0 ? (
                      <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>No real roots in interval</div>
                    ) : (
                      roots.map((r, i) => (
                        <button
                          key={i}
                          onClick={() => onJumpToPoint?.(r.x, r.y)}
                          className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                            isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                          }`}
                        >
                          <span className="font-bold text-[#2d6fb4]">x = {r.x.toFixed(4)}</span>
                          <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            Jump <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Local Extrema */}
                <div
                  className={`p-3.5 border rounded-none space-y-2 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#fa7d19] uppercase tracking-wider">
                      Local Extrema (f'(x) = 0)
                    </span>
                    <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>{extrema.length} found</span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    {extrema.length === 0 ? (
                      <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>No local extrema in interval</div>
                    ) : (
                      extrema.map((e, i) => (
                        <button
                          key={i}
                          onClick={() => onJumpToPoint?.(e.x, e.y)}
                          className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                            isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                          }`}
                        >
                          <span className={`font-bold ${e.type === 'min' ? 'text-[#fa7d19]' : 'text-[#00693E]'}`}>
                            {e.type === 'min' ? 'Local Min' : 'Local Max'}: ({e.x.toFixed(3)}, {e.y.toFixed(3)})
                          </span>
                          <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            Jump <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Inflection Points */}
                <div
                  className={`p-3.5 border rounded-none space-y-2 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#6042a6] uppercase tracking-wider">
                      Inflection Points (f''(x) = 0)
                    </span>
                    <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>{inflections.length} found</span>
                  </div>
                  <div className="space-y-1.5 text-xs font-mono">
                    {inflections.length === 0 ? (
                      <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>No inflection points in interval</div>
                    ) : (
                      inflections.map((inf, i) => (
                        <button
                          key={i}
                          onClick={() => onJumpToPoint?.(inf.x, inf.y)}
                          className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                            isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                          }`}
                        >
                          <span className="font-bold text-[#6042a6]">
                            ({inf.x.toFixed(3)}, {inf.y.toFixed(3)})
                          </span>
                          <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            Jump <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: LIMITS & TAYLOR SERIES */}
            {activeTab === 'limits' && (
              <div className="space-y-3.5">
                {/* Limit Calculator */}
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <span className="text-xs font-bold text-[#6042a6] uppercase tracking-wider flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Limit Evaluation (x → c)</span>
                  </span>

                  <div className="flex items-center gap-2 text-xs">
                    <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Target Point (c):</span>
                    <input
                      type="number"
                      step="0.5"
                      value={limitPointC}
                      onChange={(e) => setLimitPointC(parseFloat(e.target.value) || 0)}
                      className={`w-24 px-2 py-1 border font-mono rounded-none ${
                        isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                      }`}
                    />
                  </div>

                  <div className="space-y-1 text-xs font-mono">
                    <div className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Left-hand Limit (x → {limitPointC}⁻):</span>
                      <span className="font-bold text-[#c84442]">{isNaN(limitLeft) ? 'Undefined' : limitLeft.toFixed(5)}</span>
                    </div>
                    <div className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Right-hand Limit (x → {limitPointC}⁺):</span>
                      <span className="font-bold text-[#00693E]">{isNaN(limitRight) ? 'Undefined' : limitRight.toFixed(5)}</span>
                    </div>
                    <div className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Two-Sided Limit (x → {limitPointC}):</span>
                      <span className="font-bold text-[#2d6fb4]">
                        {!isNaN(limitLeft) && !isNaN(limitRight) && Math.abs(limitLeft - limitRight) < 1e-3
                          ? limitLeft.toFixed(5)
                          : 'DNE (Does Not Exist)'}
                      </span>
                    </div>
                    <div className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>As x → +∞:</span>
                      <span className="font-bold">{isNaN(limitPosInf) ? 'Undefined' : limitPosInf.toFixed(4)}</span>
                    </div>
                  </div>
                </div>

                {/* Taylor Series Expansion */}
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <span className="text-xs font-bold text-[#00693E] uppercase tracking-wider">
                    Taylor Polynomial Expansion
                  </span>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Center Point (x₀):
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={taylorCenter}
                        onChange={(e) => setTaylorCenter(parseFloat(e.target.value) || 0)}
                        className={`w-full px-2 py-1 border font-mono rounded-none ${
                          isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Order (Degree n = {taylorOrder}):
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="6"
                        value={taylorOrder}
                        onChange={(e) => setTaylorOrder(parseInt(e.target.value, 10))}
                        className="w-full accent-[#00693E] mt-2"
                      />
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-none border text-xs font-mono ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <div className="font-bold text-sm text-[#00693E]">
                      <MathDisplay math={taylorLatex} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
