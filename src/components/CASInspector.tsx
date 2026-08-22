import React, { useState, useMemo, useEffect } from 'react';
import { MathItem } from '../types';
import { Parser } from '../engine/parser';
import { astToLatex, astToExpression, ExpressionNode } from '../engine/ast';
import { SymbolicIntegrator } from '../engine/integrator';
import { NumericalSolvers } from '../engine/solvers';
import { normalizeFunctionInput } from '../engine/analyzer';
import {
  AlgebraEngine,
  FactorResult,
  ExpandResult,
  SolveResult,
  SystemSolveResult,
  LimitResult,
} from '../engine/algebra';
import { MathDisplay } from './MathDisplay';
import {
  BrainCircuit,
  ChevronDown,
  Check,
  Plus,
  Minus,
  Trash,
  Copy,
  ChevronRight,
  ListOrdered,
  Layers,
  Variable,
  ArrowRight,
} from 'lucide-react';

interface CASInspectorProps {
  item?: MathItem | null;
  items?: MathItem[];
  selectedItemId?: string | null;
  onSelectItem?: (id: string) => void;
  onSelectPoint?: (x: number, y: number) => void;
  onAddItem?: (type: any, rawInput: string) => void;
  theme?: 'dark' | 'light';
}

export type AlgebraProcessType = 'factor' | 'expand' | 'solve' | 'system' | 'limit';

const ALGEBRA_PRESETS: Record<AlgebraProcessType, Array<{ name: string; formula: string; extra?: any }>> = {
  factor: [
    { name: 'Quadratic Trinomial', formula: '2*x^2 - 7*x + 3' },
    { name: 'Difference of Squares', formula: '4*x^2 - 25' },
    { name: 'Difference of Cubes', formula: 'x^3 - 8' },
    { name: 'Monomial GCF', formula: '6*x^3 + 9*x^2' },
    { name: 'Cubic Polynomial', formula: 'x^3 - 6*x^2 + 11*x - 6' },
  ],
  expand: [
    { name: 'Binomial Square', formula: '(x + 3)^2' },
    { name: 'Binomial Cube', formula: '(2*x - 1)^3' },
    { name: 'Product of Binomials', formula: '(x - 2)*(x + 5)' },
    { name: 'Difference of Squares Product', formula: '(3*x - 4)*(3*x + 4)' },
    { name: 'Higher Power', formula: '(x - 2)^4' },
  ],
  solve: [
    { name: 'Quadratic Equation', formula: 'x^2 - 5*x + 6 = 0' },
    { name: 'Radical Roots', formula: '2*x^2 - 4*x - 3 = 0' },
    { name: 'Cubic Zeros', formula: 'x^3 - 4*x = 0' },
    { name: 'Linear Isolation', formula: '3*x + 5 = 14' },
    { name: 'Exponential Eq', formula: 'exp(2*x) = 7' },
  ],
  system: [
    { name: '2x2 Linear System', formula: '2*x + 3*y = 7', extra: { eq2: '4*x - y = 5' } },
    { name: 'Line & Parabola', formula: 'y = x^2 - 4', extra: { eq2: 'y = 2*x - 1' } },
    { name: 'Orthogonal Lines', formula: 'x + y = 6', extra: { eq2: 'x - y = 2' } },
    { name: 'Parallel (No Sol)', formula: '2*x + y = 3', extra: { eq2: '2*x + y = 8' } },
  ],
  limit: [
    { name: 'Indeterminate 0/0 (L’Hôpital)', formula: '(x^2 - 4) / (x - 2)', extra: { target: '2', dir: 'both' } },
    { name: 'Trig Direct Limit', formula: 'sin(3*x) / x', extra: { target: '0', dir: 'both' } },
    { name: 'Asymptote at Infinity', formula: '(2*x^2 + 3) / (5*x^2 - 1)', extra: { target: 'inf', dir: 'both' } },
    { name: 'Vertical Asymptote', formula: '1 / (x - 3)', extra: { target: '3', dir: 'both' } },
  ],
};

export const CASInspector: React.FC<CASInspectorProps> = ({
  item,
  items = [],
  selectedItemId,
  onSelectItem,
  onSelectPoint,
  onAddItem,
  theme = 'dark',
}) => {
  const [activeTab, setActiveTab] = useState<'algebra' | 'roots' | 'quadrature'>('algebra');
  const [algebraProcess, setAlgebraProcess] = useState<AlgebraProcessType>('factor');

  // Equation Target State
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [addedFormula, setAddedFormula] = useState<string | null>(null);

  // System of equations secondary inputs
  const [systemEqs, setSystemEqs] = useState<string[]>(['y = 2*x^2 - 7*x + 3', '4*x - y = 5']);

  // Limits parameters
  const [limitTarget, setLimitTarget] = useState('2');
  const [limitDirection, setLimitDirection] = useState<'both' | 'left' | 'right'>('both');

  // Numerical quadrature state
  const [integralA, setIntegralA] = useState<number>(0);
  const [integralB, setIntegralB] = useState<number>(Math.PI);

  const isLight = theme === 'light';

  // Determine active target item
  const activeItem = useMemo(() => {
    if (item) return item;
    if (selectedItemId && items.length > 0) {
      const found = items.find((i) => i.id === selectedItemId);
      if (found) return found;
    }
    return null;
  }, [item, items, selectedItemId]);

  const rawInput = isCustom ? customInput : activeItem ? activeItem.rawInput : '2*x^2 - 7*x + 3';
  const hasSelection = Boolean(rawInput.trim());
  const norm = hasSelection
    ? normalizeFunctionInput(rawInput)
    : { expression: '0', label: '', isImplicit: false, cleanLhs: '', cleanRhs: '' };

  // Synchronize first equation when rawInput changes to keep it in sync with active selection
  useEffect(() => {
    if (rawInput) {
      setSystemEqs((prev) => {
        const updated = [...prev];
        updated[0] = rawInput;
        return updated;
      });
    }
  }, [rawInput]);

  // Run Symbolic Algebra Computations
  const factorResult = useMemo<FactorResult | null>(() => {
    if (!hasSelection) return null;
    try {
      return AlgebraEngine.factor(norm.expression, 'x');
    } catch (e) {
      return null;
    }
  }, [norm.expression, hasSelection]);

  const expandResult = useMemo<ExpandResult | null>(() => {
    if (!hasSelection) return null;
    try {
      return AlgebraEngine.expand(norm.expression, 'x');
    } catch (e) {
      return null;
    }
  }, [norm.expression, hasSelection]);

  const solveResult = useMemo<SolveResult | null>(() => {
    if (!hasSelection) return null;
    try {
      return AlgebraEngine.solveForX(rawInput, 'x');
    } catch (e) {
      return null;
    }
  }, [rawInput, hasSelection]);

  const systemResult = useMemo<SystemSolveResult | null>(() => {
    try {
      return AlgebraEngine.solveSystem(systemEqs);
    } catch (e) {
      return null;
    }
  }, [systemEqs]);

  const limitResult = useMemo<LimitResult | null>(() => {
    if (!hasSelection) return null;
    try {
      return AlgebraEngine.findLimit(norm.expression, limitTarget, limitDirection, 'x');
    } catch (e) {
      return null;
    }
  }, [norm.expression, limitTarget, limitDirection, hasSelection]);

  // Numerical Solvers & Quadrature
  let simpsonVal = 0;
  let criticalPoints: any[] = [];
  let parseError = '';

  if (hasSelection) {
    try {
      const ast = Parser.parse(norm.expression);
      simpsonVal = SymbolicIntegrator.adaptiveSimpson(ast, integralA, integralB);
      criticalPoints = NumericalSolvers.findCriticalPoints(ast, -8, 8);
    } catch (err: any) {
      parseError = err.message || 'Syntax Error in expression';
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleAddEquation = (formula: string) => {
    if (!formula || !onAddItem) return;
    onAddItem('cartesian', formula);
    setAddedFormula(formula);
    setTimeout(() => setAddedFormula(null), 2500);
  };

  const handleSelectPreset = (preset: { name: string; formula: string; extra?: any }, proc?: AlgebraProcessType) => {
    if (proc) setAlgebraProcess(proc);
    setCustomInput(preset.formula);
    setIsCustom(true);
    setIsDropdownOpen(false);

    if (preset.extra?.eq2) {
      setSystemEqs([preset.formula, preset.extra.eq2]);
    } else if (preset.extra?.eqs) {
      setSystemEqs(preset.extra.eqs);
    }
    if (preset.extra?.target) {
      setLimitTarget(preset.extra.target);
    }
    if (preset.extra?.dir) {
      setLimitDirection(preset.extra.dir);
    }
  };

  return (
    <div
      className={`flex flex-col h-full overflow-hidden ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* 1. SELECTOR & TARGET HEADER */}
      <div
        className={`p-3 border-b shrink-0 ${
          isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className={`text-[11px] font-bold uppercase tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Computer Algebra Target
            </span>
            {hasSelection && (
              <span className={`text-[11px] font-mono px-1.5 py-0.5 border ${
                isLight ? 'bg-white border-neutral-300 text-neutral-700' : 'bg-neutral-900 border-neutral-800 text-neutral-300'
              }`}>
                {activeItem?.type || (isCustom ? 'custom' : 'active')}
              </span>
            )}
          </div>

          {/* Equation Selector Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`w-full p-2 border rounded-none text-left flex items-center justify-between text-xs font-mono transition-colors ${
                isLight ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-black' : 'bg-black hover:bg-neutral-900 border-neutral-800 text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                {activeItem && !isCustom ? (
                  <span className="w-2.5 h-2.5 rounded-none shrink-0" style={{ backgroundColor: activeItem.color }} />
                ) : (
                  <BrainCircuit className="w-3.5 h-3.5 text-[#6042a6] shrink-0" />
                )}
                <span className={`truncate ${!hasSelection ? 'italic font-normal opacity-60' : ''}`}>
                  {rawInput || 'Select equation or type custom algebraic expression...'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 opacity-50 shrink-0" />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div
                className={`absolute top-full left-0 right-0 mt-1 border rounded-none shadow-xl z-50 max-h-64 overflow-y-auto p-1 ${
                  isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                }`}
              >
                <div className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  Your Graph Equations
                </div>
                {items.length === 0 ? (
                  <div className={`px-2 py-1.5 text-xs italic ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    No equations in graph yet
                  </div>
                ) : (
                  items.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => {
                        if (onSelectItem) onSelectItem(it.id);
                        setIsCustom(false);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full p-1.5 rounded-none text-left text-xs font-mono flex items-center justify-between transition-all ${
                        activeItem?.id === it.id && !isCustom
                          ? 'bg-[#00693E]/15 text-[#00693E] font-bold'
                          : isLight
                          ? 'hover:bg-neutral-100 text-neutral-800'
                          : 'hover:bg-neutral-900 text-neutral-200'
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
                  Algebra Presets ({algebraProcess.toUpperCase()})
                </div>
                {ALGEBRA_PRESETS[algebraProcess].map((pr, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectPreset(pr)}
                    className={`w-full p-1.5 rounded-none text-left text-xs flex items-center justify-between transition-all ${
                      isLight ? 'hover:bg-neutral-100 text-neutral-800' : 'hover:bg-neutral-900 text-neutral-200'
                    }`}
                  >
                    <span className="font-semibold text-[11px]">{pr.name}</span>
                    <span className={`font-mono text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{pr.formula}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Custom Input Bar */}
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={isCustom ? customInput : rawInput}
              onChange={(e) => {
                setCustomInput(e.target.value);
                setIsCustom(true);
              }}
              placeholder="e.g. 2*x^2 - 7*x + 3, (x+3)^2, or (x^2-4)/(x-2)"
              className={`flex-1 px-2.5 py-1 text-xs font-mono border rounded-none focus:outline-hidden ${
                isLight ? 'bg-white border-neutral-300 focus:border-[#00693E]' : 'bg-black border-neutral-800 focus:border-[#00693E]'
              }`}
            />
            {isCustom && (
              <button
                onClick={() => {
                  if (activeItem) {
                    setIsCustom(false);
                  }
                }}
                className={`px-2 py-1 text-[11px] border font-mono rounded-none ${
                  isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                }`}
                title="Reset to selected curve"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. SUB-TABS NAVIGATION: ALGEBRA / ROOTS & EXTREMA / DEFINITE INTEGRAL */}
      <div
        className={`flex items-center gap-1 p-2 border-b overflow-x-auto shrink-0 rounded-none ${
          isLight ? 'bg-neutral-100/50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <button
          onClick={() => setActiveTab('algebra')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
            activeTab === 'algebra'
              ? 'bg-[#00693E] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Variable className="w-3.5 h-3.5" />
          <span>Algebra Suite</span>
        </button>
        <button
          onClick={() => setActiveTab('roots')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'roots'
              ? 'bg-[#2d6fb4] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          Roots & Extrema
        </button>
        <button
          onClick={() => setActiveTab('quadrature')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap transition-all ${
            activeTab === 'quadrature'
              ? 'bg-[#fa7d19] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          Definite Integral
        </button>
      </div>

      {/* 3. ALGEBRA SUBSECTION PROCESS SELECTOR (When Algebra Tab is active) */}
      {activeTab === 'algebra' && (
        <div
          className={`px-2.5 py-1.5 border-b overflow-x-auto shrink-0 flex items-center gap-1 ${
            isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-900/60 border-neutral-800'
          }`}
        >
          {(
            [
              { id: 'factor', label: 'Factoring' },
              { id: 'expand', label: 'Expanding' },
              { id: 'solve', label: 'Solve for x / Zeros' },
              { id: 'system', label: 'System of Equations' },
              { id: 'limit', label: 'Direct Limits' },
            ] as const
          ).map((proc) => {
            const isActive = algebraProcess === proc.id;
            return (
              <button
                key={proc.id}
                onClick={() => setAlgebraProcess(proc.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap border transition-all rounded-none ${
                  isActive
                    ? 'bg-[#00693E] text-white border-[#00693E] shadow-xs'
                    : isLight
                    ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-700'
                    : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-300'
                }`}
              >
                {proc.label}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. MAIN CONTENT AREA */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
        {addedFormula && (
          <div className="p-2.5 bg-[#00693E]/15 border border-[#00693E]/40 text-[#00693E] text-xs font-mono flex items-center justify-between">
            <span>Added as equation: <strong>y = {addedFormula}</strong></span>
            <Check className="w-4 h-4" />
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBSECTION 1: ALGEBRA PROCESSES (Factoring, Expanding, Solve, System, Limits) */}
        {/* ========================================================================= */}
        {activeTab === 'algebra' && (
          <div className="space-y-3.5">
            {/* Quick Process Presets Bar */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                Presets:
              </span>
              {ALGEBRA_PRESETS[algebraProcess].map((pr, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectPreset(pr)}
                  className={`px-2 py-0.5 text-[10px] font-mono border rounded-none transition-all ${
                    isLight ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                  }`}
                >
                  {pr.name}
                </button>
              ))}
            </div>

            {/* PROCESS 1: FACTORING */}
            {algebraProcess === 'factor' && factorResult && (
              <div className="space-y-3">
                {/* Result Card */}
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider">Factored Expression</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                        isLight ? 'bg-white border-neutral-300 text-neutral-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                      }`}>
                        {factorResult.method}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(factorResult.factoredExpression)}
                        className={`p-1 border rounded-none ${isLight ? 'hover:bg-neutral-200 border-neutral-300' : 'hover:bg-neutral-800 border-neutral-700'}`}
                        title="Copy factored expression"
                      >
                        {copiedText === factorResult.factoredExpression ? <Check className="w-3.5 h-3.5 text-[#00693E]" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
                      </button>
                      {onAddItem && (
                        <button
                          onClick={() => handleAddEquation(factorResult.factoredExpression)}
                          className="text-[11px] px-2 py-0.5 bg-[#00693E] hover:bg-[#005230] text-white font-mono flex items-center gap-1 rounded-none shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add to Graph</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <MathDisplay latex={factorResult.factoredLatex} className="text-base font-serif font-bold text-[#00693E]" />
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
                    <span className="text-xs font-bold uppercase tracking-wider">Step-by-Step Solution</span>
                  </div>

                  <div className="space-y-2.5">
                    {factorResult.steps.map((step, idx) => (
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
            )}

            {/* PROCESS 2: EXPANDING */}
            {algebraProcess === 'expand' && expandResult && (
              <div className="space-y-3">
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider">Expanded Polynomial</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                        isLight ? 'bg-white border-neutral-300 text-neutral-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                      }`}>
                        {expandResult.method}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(expandResult.expandedExpression)}
                        className={`p-1 border rounded-none ${isLight ? 'hover:bg-neutral-200 border-neutral-300' : 'hover:bg-neutral-800 border-neutral-700'}`}
                        title="Copy expanded formula"
                      >
                        {copiedText === expandResult.expandedExpression ? <Check className="w-3.5 h-3.5 text-[#00693E]" /> : <Copy className="w-3.5 h-3.5 opacity-70" />}
                      </button>
                      {onAddItem && (
                        <button
                          onClick={() => handleAddEquation(expandResult.expandedExpression)}
                          className="text-[11px] px-2 py-0.5 bg-[#00693E] hover:bg-[#005230] text-white font-mono flex items-center gap-1 rounded-none shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add to Graph</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className={`p-3 rounded-none border overflow-x-auto ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                    <MathDisplay latex={expandResult.expandedLatex} className="text-base font-serif font-bold text-[#2d6fb4]" />
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
                    <span className="text-xs font-bold uppercase tracking-wider">Step-by-Step Solution</span>
                  </div>

                  <div className="space-y-2.5">
                    {expandResult.steps.map((step, idx) => (
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
            )}

            {/* PROCESS 3: SOLVE FOR FINITE VALUES OF X / ZEROS */}
            {algebraProcess === 'solve' && solveResult && (
              <div className="space-y-3">
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider">Finite Solutions & Zeros</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                        isLight ? 'bg-white border-neutral-300 text-neutral-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                      }`}>
                        {solveResult.solutions.length} roots
                      </span>
                    </div>
                    <span className={`text-[10px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      {solveResult.method}
                    </span>
                  </div>

                  {solveResult.solutions.length === 0 ? (
                    <div className={`p-3 text-xs italic text-center ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      No finite real solutions found for this equation.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {solveResult.solutions.map((sol, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 border rounded-none flex items-center justify-between ${
                            isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'
                          }`}
                        >
                          <MathDisplay latex={sol.exactLatex} className="text-sm font-serif font-bold text-[#fa7d19]" />
                          {onSelectPoint && !isNaN(sol.approx) && (
                            <button
                              onClick={() => onSelectPoint(sol.approx, 0)}
                              className={`text-[10px] px-2 py-0.5 border rounded-none font-mono ${
                                isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                              }`}
                            >
                              Focus (x = {sol.approx.toFixed(2)})
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step-by-Step Breakdown */}
                <div
                  className={`p-3.5 border rounded-none space-y-3 ${
                    isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-4 h-4 text-[#fa7d19]" />
                    <span className="text-xs font-bold uppercase tracking-wider">Step-by-Step Symbolic Solution</span>
                  </div>

                  <div className="space-y-2.5">
                    {solveResult.steps.map((step, idx) => (
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
            )}

            {/* PROCESS 4: SOLVE SYSTEM OF EQUATIONS */}
            {algebraProcess === 'system' && (
              <div className="space-y-3">
                {/* Dynamic Equations Configuration */}
                <div
                  className={`p-3 border rounded-none space-y-3.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] uppercase font-bold tracking-wider block ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                      System Equations:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const nextVars = ['x', 'y', 'z', 'w', 'u', 'v'];
                        const nextIdx = systemEqs.length;
                        const newVar = nextVars[Math.min(nextIdx, nextVars.length - 1)];
                        setSystemEqs([...systemEqs, `${newVar} = ${nextIdx + 1}`]);
                      }}
                      className={`px-2 py-1 border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 hover:bg-opacity-80 transition rounded-none ${
                        isLight ? 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-50' : 'bg-black border-neutral-900 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <Plus className="w-3 h-3" />
                      Add Equation
                    </button>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    {systemEqs.map((eq, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-2">
                        <span className={`w-12 shrink-0 font-bold ${sIdx === 0 ? 'text-[#00693E]' : sIdx === 1 ? 'text-[#2d6fb4]' : 'text-[#6042a6]'}`}>
                          Eq {sIdx + 1}:
                        </span>
                        <input
                          type="text"
                          value={eq}
                          onChange={(e) => {
                            const updated = [...systemEqs];
                            updated[sIdx] = e.target.value;
                            setSystemEqs(updated);
                          }}
                          placeholder={sIdx === 0 ? "e.g. y = 2*x - 1" : sIdx === 1 ? "e.g. 4*x - y = 5" : "e.g. x + y + z = 6"}
                          className={`flex-1 px-2 py-1 border rounded-none focus:outline-hidden ${
                            isLight ? 'bg-white border-neutral-300 focus:border-[#2d6fb4]' : 'bg-black border-neutral-800 focus:border-[#2d6fb4]'
                          }`}
                        />
                        {systemEqs.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = systemEqs.filter((_, idx) => idx !== sIdx);
                              setSystemEqs(updated);
                            }}
                            className={`p-1.5 border text-neutral-400 hover:text-red-500 rounded-none transition ${
                              isLight ? 'border-neutral-300 hover:bg-neutral-100' : 'border-neutral-800 hover:bg-neutral-900'
                            }`}
                            title="Remove Equation"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-dashed pt-2.5">
                    <span className={`text-[10px] font-medium ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Active variables: {['x', 'y', 'z', 'w', 'u', 'v'].slice(0, Math.max(2, systemEqs.length)).join(', ')}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSystemEqs(['y = 2*x^2 - 7*x + 3', '4*x - y = 5']);
                      }}
                      className={`text-[10px] uppercase font-bold text-red-500 hover:underline transition`}
                    >
                      Reset System
                    </button>
                  </div>
                </div>

                {/* System Result */}
                {systemResult && (
                  <>
                    <div
                      className={`p-3.5 border rounded-none space-y-2.5 ${
                        isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider">Simultaneous Solution Tuple</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 uppercase border ${
                            systemResult.classification === 'unique'
                              ? 'bg-[#00693E]/20 text-[#00693E] border-[#00693E]/40'
                              : systemResult.classification === 'infinite'
                              ? 'bg-[#2d6fb4]/20 text-[#2d6fb4] border-[#2d6fb4]/40'
                              : 'bg-[#c84442]/20 text-[#c84442] border-[#c84442]/40'
                          }`}
                        >
                          {systemResult.classification}
                        </span>
                      </div>

                      {systemResult.solutions.length === 0 ? (
                        <div className={`p-3 text-xs italic text-center ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                          {systemResult.classification === 'infinite'
                            ? 'Infinitely many solutions (dependent system).'
                            : 'No simultaneous intersection point exists (inconsistent system).'}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {systemResult.solutions.map((pt, idx) => {
                            const coordComponents = systemResult.variables.map((v) => {
                              const varResult = pt[v];
                              return varResult ? varResult.exactLatex.replace(`${v} = `, '') : '?';
                            });
                            const ptLatex = `\\left(${coordComponents.join(', \\; ')}\\right)`;
                            const hasFocus = pt.x && pt.y;

                            return (
                              <div
                                key={idx}
                                className={`p-2.5 border rounded-none flex items-center justify-between ${
                                  isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'
                                }`}
                              >
                                <div className="flex items-center gap-3 overflow-x-auto">
                                  <MathDisplay latex={ptLatex} className="text-sm font-serif font-bold text-[#6042a6]" />
                                </div>
                                {onSelectPoint && hasFocus && (
                                  <button
                                    onClick={() => onSelectPoint(pt.x.approx, pt.y.approx)}
                                    className={`text-[10px] px-2 py-0.5 border rounded-none font-mono ${
                                      isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                                    }`}
                                  >
                                    Focus Point
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Step-by-step System Solution */}
                    <div
                      className={`p-3.5 border rounded-none space-y-3 ${
                        isLight ? 'bg-white border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <ListOrdered className="w-4 h-4 text-[#6042a6]" />
                        <span className="text-xs font-bold uppercase tracking-wider">System Solution steps</span>
                      </div>

                      <div className="space-y-2.5">
                        {systemResult.steps.map((step, idx) => (
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
                  </>
                )}
              </div>
            )}

            {/* PROCESS 5: DIRECT LIMITS */}
            {algebraProcess === 'limit' && (
              <div className="space-y-3">
                {/* Limit Parameter Controls */}
                <div
                  className={`p-3 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold tracking-wider block ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    Limit Approach Parameters:
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Target x → c:
                      </label>
                      <input
                        type="text"
                        value={limitTarget}
                        onChange={(e) => setLimitTarget(e.target.value)}
                        placeholder="e.g. 2, 0, inf, -inf"
                        className={`w-full px-2 py-1 border font-mono rounded-none ${
                          isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-bold uppercase mb-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Direction:
                      </label>
                      <select
                        value={limitDirection}
                        onChange={(e) => setLimitDirection(e.target.value as any)}
                        className={`w-full px-2 py-1 border font-mono rounded-none ${
                          isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                        }`}
                      >
                        <option value="both">Two-sided (x → c)</option>
                        <option value="right">Right-hand (x → c⁺)</option>
                        <option value="left">Left-hand (x → c⁻)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {limitResult && (
                  <>
                    <div
                      className={`p-3.5 border rounded-none space-y-2.5 ${
                        isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider">Evaluated Limit</span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 border ${
                          isLight ? 'bg-white border-neutral-300 text-neutral-600' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                        }`}>
                          Form: {limitResult.formType}
                        </span>
                      </div>

                      <div className={`p-3 rounded-none border overflow-x-auto flex items-center justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                        <MathDisplay latex={`${limitResult.limitLatex} = ${limitResult.valueLatex}`} className="text-base font-serif font-bold text-[#00693E]" />
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
                        <span className="text-xs font-bold uppercase tracking-wider">Step-by-Step Limit Evaluation</span>
                      </div>

                      <div className="space-y-2.5">
                        {limitResult.steps.map((step, idx) => (
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
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBSECTION 2: ROOTS & CRITICAL POINTS */}
        {/* ========================================================================= */}
        {activeTab === 'roots' && (
          <div className="space-y-3">
            <div
              className={`p-3.5 border rounded-none space-y-3 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider">
                  Critical Points (x ∈ [-8, 8])
                </span>
                <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  {criticalPoints.length} detected
                </span>
              </div>

              {criticalPoints.length === 0 ? (
                <div className={`p-3 text-xs italic text-center ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                  No critical points found in [-8, 8]
                </div>
              ) : (
                <div className="space-y-1.5">
                  {criticalPoints.map((pt, idx) => (
                    <div
                      key={idx}
                      className={`p-2 border rounded-none flex items-center justify-between text-xs font-mono transition-all ${
                        isLight ? 'bg-white border-neutral-200 hover:bg-neutral-100' : 'bg-black border-neutral-800 hover:bg-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold uppercase rounded-none ${
                            pt.type === 'min'
                              ? 'bg-[#00693E]/20 text-[#00693E]'
                              : pt.type === 'max'
                              ? 'bg-[#fa7d19]/20 text-[#fa7d19]'
                              : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {pt.type === 'min' ? 'Local Min' : pt.type === 'max' ? 'Local Max' : 'Inflection'}
                        </span>
                        <span>
                          ({pt.x.toFixed(4)}, {pt.y.toFixed(4)})
                        </span>
                      </div>
                      {onSelectPoint && (
                        <button
                          onClick={() => onSelectPoint(pt.x, pt.y)}
                          className={`text-[11px] px-2 py-0.5 border rounded-none transition-all ${
                            isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                          }`}
                        >
                          Focus
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* SUBSECTION 3: DEFINITE INTEGRAL & QUADRATURE */}
        {/* ========================================================================= */}
        {activeTab === 'quadrature' && (
          <div className="space-y-3.5">
            <div
              className={`p-3.5 border rounded-none space-y-3 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wider">
                Definite Integral (Adaptive Simpson Quadrature)
              </span>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    Lower Bound (a):
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={integralA}
                    onChange={(e) => setIntegralA(parseFloat(e.target.value) || 0)}
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
                    onChange={(e) => setIntegralB(parseFloat(e.target.value) || 0)}
                    className={`w-full px-2 py-1 border font-mono rounded-none ${
                      isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                    }`}
                  />
                </div>
              </div>

              <div className={`p-2.5 rounded-none border space-y-1 text-xs font-mono ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                <div className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>
                  ∫ [{integralA} to {integralB}] f(x) dx:
                </div>
                <div className="font-bold text-base text-[#00693E]">{simpsonVal.toFixed(8)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
