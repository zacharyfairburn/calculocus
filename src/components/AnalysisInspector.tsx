import React, { useState, useMemo } from 'react';
import { MathItem } from '../types';
import { CurveAnalyzer, FunctionAnalysisResult } from '../engine/analyzer';
import { MathDisplay } from './MathDisplay';
import {
  Compass,
  Target,
  Activity,
  Layers,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  CircleDot,
  Maximize2,
  Split,
  Eye,
  EyeOff,
  Plus,
} from 'lucide-react';

interface AnalysisInspectorProps {
  items: MathItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onAddItem?: (type: any, rawInput: string) => void;
  onJumpToPoint?: (x: number, y: number) => void;
  theme?: 'dark' | 'light';
  showOverlayOnGraph?: boolean;
  onToggleOverlayOnGraph?: (show: boolean) => void;
}

const PRESETS = [
  { name: 'Ellipse', formula: 'x^2/25 + y^2/9 = 1', type: 'implicit' },
  { name: 'Hyperbola', formula: 'x^2/16 - y^2/9 = 1', type: 'implicit' },
  { name: 'Circle', formula: 'x^2 + y^2 = 25', type: 'implicit' },
  { name: 'Parabola', formula: 'y = 0.5*x^2 - 2', type: 'cartesian' },
  { name: 'Rational (Slant Asymptote)', formula: '(x^2 - 1) / (x - 2)', type: 'cartesian' },
  { name: 'Cubic with Inflection', formula: 'x^3 - 3*x', type: 'cartesian' },
  { name: 'Sine Wave', formula: '3*sin(2*x)', type: 'cartesian' },
];

export const AnalysisInspector: React.FC<AnalysisInspectorProps> = ({
  items,
  selectedItemId,
  onSelectItem,
  onAddItem,
  onJumpToPoint,
  theme = 'dark',
  showOverlayOnGraph = true,
  onToggleOverlayOnGraph,
}) => {
  const isLight = theme === 'light';
  const [activeTab, setActiveTab] = useState<'overview' | 'conic' | 'asymptotes' | 'calculus'>('overview');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [isEditingCustom, setIsEditingCustom] = useState(false);

  // Active math item or fallback
  const activeItem = useMemo(() => {
    if (selectedItemId) {
      const found = items.find((it) => it.id === selectedItemId);
      if (found) return found;
    }
    return null;
  }, [items, selectedItemId]);

  const currentFormula = isEditingCustom ? customInput : activeItem ? activeItem.rawInput : '';
  const hasSelection = Boolean(currentFormula.trim());

  // Run comprehensive curve & conic analysis
  const analysis: FunctionAnalysisResult = useMemo(() => {
    if (!hasSelection) {
      return {
        formula: '',
        latexFormula: '',
        isImplicit: false,
        domain: { min: -10, max: 10 },
        range: { min: -10, max: 10 },
        intercepts: { x: [], y: [] },
        extrema: [],
        inflectionPoints: [],
        asymptotes: { vertical: [], horizontal: [], oblique: [] },
        symmetry: 'None',
        conic: null,
      };
    }
    return CurveAnalyzer.analyze(currentFormula);
  }, [currentFormula, hasSelection]);

  const conic = analysis.conic;

  const handleSelectPreset = (formula: string, type: string) => {
    if (onAddItem) {
      onAddItem(type as any, formula);
    } else {
      setCustomInput(formula);
      setIsEditingCustom(true);
    }
  };

  return (
    <div
      className={`flex flex-col h-full select-none rounded-none ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* 1. TOP FUNCTION SELECTOR BAR WITH DROPDOWN & PRESETS */}
      <div
        className={`p-2.5 border-b space-y-2 shrink-0 rounded-none ${
          isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <span className={`text-[10px] uppercase font-bold tracking-wider shrink-0 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              Analyzing:
            </span>

            {/* Selector Dropdown trigger */}
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
                  {activeItem && (
                    <span
                      className="w-2.5 h-2.5 rounded-none shrink-0"
                      style={{ backgroundColor: activeItem.color }}
                    />
                  )}
                  <span className={`truncate ${!hasSelection ? 'italic font-normal opacity-60' : ''}`}>
                    {hasSelection ? currentFormula : 'Select a curve or preset...'}
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
                    Active Equations ({items.length})
                  </div>
                  {items.length === 0 ? (
                    <div className={`p-2 text-xs italic ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
                      No equations on canvas yet.
                    </div>
                  ) : (
                    items.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => {
                          onSelectItem(it.id);
                          setIsEditingCustom(false);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full p-2 rounded-none flex items-center justify-between text-left text-xs font-mono border transition-all ${
                          it.id === selectedItemId && !isEditingCustom
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
                    Quick Presets
                  </div>
                  {PRESETS.map((pr, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        handleSelectPreset(pr.formula, pr.type);
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

          {/* Overlay on Graph Toggle */}
          {onToggleOverlayOnGraph && (
            <button
              onClick={() => onToggleOverlayOnGraph(!showOverlayOnGraph)}
              className={`px-2 py-1.5 border rounded-none text-[11px] font-bold flex items-center gap-1 shrink-0 transition-all ${
                showOverlayOnGraph
                  ? 'bg-[#00693E] text-white border-[#00693E]'
                  : isLight
                  ? 'bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:bg-neutral-800'
              }`}
              title="Toggle overlay of Foci, Directrix, Asymptotes on 2D Graph"
            >
              {showOverlayOnGraph ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{showOverlayOnGraph ? 'Graph Pins ON' : 'Pins OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. SUB-TABS NAVIGATION */}
      <div
        className={`flex items-center gap-1 p-2 border-b overflow-x-auto shrink-0 rounded-none ${
          isLight ? 'bg-neutral-100/50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'overview'
              ? 'bg-[#00693E] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('conic')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'conic'
              ? 'bg-[#2d6fb4] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <CircleDot className="w-3.5 h-3.5" />
          <span>Conics & Geometry</span>
        </button>
        <button
          onClick={() => setActiveTab('asymptotes')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'asymptotes'
              ? 'bg-[#fa7d19] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          <span>Asymptotes & Limits</span>
        </button>
        <button
          onClick={() => setActiveTab('calculus')}
          className={`px-3 py-1.5 rounded-none text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all ${
            activeTab === 'calculus'
              ? 'bg-[#6042a6] text-white shadow-sm'
              : isLight
              ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
              : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
          }`}
        >
          <Target className="w-3.5 h-3.5" />
          <span>Roots & Extrema</span>
        </button>
      </div>

      {/* 3. MAIN TAB CONTENT */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-3.5">
        {!hasSelection ? (
          /* EMPTY START SELECTION VIEW */
          <div className="space-y-4 py-4 text-center">
            <div className={`p-6 border rounded-none max-w-md mx-auto space-y-3 ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
              <Compass className="w-8 h-8 text-[#00693E] mx-auto opacity-80" />
              <h4 className="text-sm font-bold tracking-tight">No Curve Selected for Analysis</h4>
              <p className={`text-xs ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                Select an equation from the dropdown above or choose a geometric curve preset below to analyze foci, directrix, eccentricity, asymptotes, and center.
              </p>

              <div className="pt-2 text-left space-y-2">
                <span className={`text-[10px] uppercase font-bold tracking-wider block ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  Quick Load Geometric Curves:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {PRESETS.map((pr, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectPreset(pr.formula, pr.type)}
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
        ) : (
          <>
            {/* TAB 1: OVERVIEW HERO & SUMMARY CARDS */}
            {activeTab === 'overview' && (
          <div className="space-y-3.5">
            {/* Header Badge Card */}
            <div
              className={`p-3.5 border rounded-none space-y-2.5 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] uppercase font-bold tracking-wider ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  Curve Classification
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 border rounded-none uppercase ${
                    conic && conic.isConic
                      ? 'bg-[#00693E]/20 text-[#00693E] border-[#00693E]/40'
                      : 'bg-[#2d6fb4]/20 text-[#2d6fb4] border-[#2d6fb4]/40'
                  }`}
                >
                  {conic && conic.isConic ? conic.typeName : 'Explicit Curve'}
                </span>
              </div>

              <div className="text-base font-semibold">
                <MathDisplay math={analysis.latexFormula} />
              </div>

              {conic && conic.isConic && conic.standardFormLatex && (
                <div className={`p-2 rounded-none border text-xs ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                  <span className={`text-[10px] uppercase font-bold block mb-0.5 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    Standard Form:
                  </span>
                  <MathDisplay math={conic.standardFormLatex} />
                </div>
              )}
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {/* Center / Vertex */}
              {conic && conic.center && (
                <div
                  onClick={() => onJumpToPoint?.(conic.center!.x, conic.center!.y)}
                  className={`p-2.5 border rounded-none cursor-pointer transition-colors ${
                    isLight ? 'bg-white border-neutral-200 hover:bg-neutral-100' : 'bg-black border-neutral-900 hover:bg-neutral-900'
                  }`}
                >
                  <div className={`text-[10px] uppercase font-bold flex items-center justify-between ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    <span>{conic.type === 'parabola' ? 'Vertex (h, k)' : 'Center (h, k)'}</span>
                    <ChevronRight className="w-3 h-3 text-[#00693E]" />
                  </div>
                  <div className="font-bold text-sm text-[#00693E] mt-0.5">
                    ({conic.center.x.toFixed(3)}, {conic.center.y.toFixed(3)})
                  </div>
                </div>
              )}

              {/* Eccentricity */}
              {conic && conic.eccentricity !== undefined && (
                <div
                  className={`p-2.5 border rounded-none ${
                    isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'
                  }`}
                >
                  <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                    Eccentricity (e)
                  </div>
                  <div className="font-bold text-sm text-[#2d6fb4] mt-0.5">
                    e = {conic.eccentricity.toFixed(4)}
                  </div>
                </div>
              )}

              {/* Symmetry */}
              <div
                className={`p-2.5 border rounded-none ${
                  isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'
                }`}
              >
                <div className={`text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  Parity & Symmetry
                </div>
                <div className="font-bold text-xs text-[#fa7d19] mt-0.5 leading-tight">
                  {analysis.symmetryDescription || (analysis.symmetry === 'even'
                    ? 'Even (y-axis)'
                    : analysis.symmetry === 'odd'
                    ? 'Odd (Origin)'
                    : 'None / Asymmetric')}
                </div>
              </div>

              {/* Y-Intercept */}
              <div
                onClick={() => analysis.yIntercept && onJumpToPoint?.(analysis.yIntercept.x, analysis.yIntercept.y)}
                className={`p-2.5 border rounded-none cursor-pointer transition-colors ${
                  isLight ? 'bg-white border-neutral-200 hover:bg-neutral-100' : 'bg-black border-neutral-900 hover:bg-neutral-900'
                }`}
              >
                <div className={`text-[10px] uppercase font-bold flex items-center justify-between ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  <span>Y-Intercept</span>
                  <ChevronRight className="w-3 h-3 text-[#6042a6]" />
                </div>
                <div className="font-bold text-xs text-[#6042a6] mt-0.5">
                  {analysis.yIntercept ? `(0, ${analysis.yIntercept.y.toFixed(3)})` : 'None'}
                </div>
              </div>
            </div>

            {/* Asymptotes Overview Summary */}
            {(analysis.asymptotes.vertical.length > 0 ||
              analysis.asymptotes.horizontal.length > 0 ||
              analysis.asymptotes.oblique.length > 0 ||
              (conic && conic.asymptotes && conic.asymptotes.length > 0)) && (
              <div
                className={`p-3.5 border rounded-none space-y-2 ${
                  isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#fa7d19] uppercase tracking-wider flex items-center gap-1.5">
                    <Split className="w-3.5 h-3.5" />
                    <span>Asymptotes Detected</span>
                  </span>
                </div>
                <div className="space-y-1 text-xs font-mono">
                  {/* Vertical */}
                  {analysis.asymptotes.vertical.map((v, i) => (
                    <div key={`v-${i}`} className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className="font-bold text-[#c84442]">{v.equation}</span>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Vertical Asymptote</span>
                    </div>
                  ))}

                  {/* Horizontal */}
                  {analysis.asymptotes.horizontal.map((h, i) => (
                    <div key={`h-${i}`} className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className="font-bold text-[#2d6fb4]">{h.equation}</span>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Horizontal (x → ±∞)</span>
                    </div>
                  ))}

                  {/* Slant / Oblique */}
                  {analysis.asymptotes.oblique.map((ob, i) => (
                    <div key={`ob-${i}`} className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className="font-bold text-[#fa7d19]">{ob.equation}</span>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Slant / Oblique</span>
                    </div>
                  ))}

                  {/* Hyperbolic Asymptotes */}
                  {conic && conic.asymptotes && conic.asymptotes.map((ha, i) => (
                    <div key={`ha-${i}`} className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className="font-bold text-[#fa7d19]">{ha.equation}</span>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Hyperbolic Asymptote</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Foci & Directrix Overview */}
            {conic && conic.foci && conic.foci.length > 0 && (
              <div
                className={`p-3.5 border rounded-none space-y-2 ${
                  isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                }`}
              >
                <span className="text-xs font-bold text-[#00693E] uppercase tracking-wider flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  <span>Focal Properties (Foci & Directrix)</span>
                </span>
                <div className="space-y-1.5 text-xs font-mono">
                  {conic.foci.map((fc, i) => (
                    <button
                      key={i}
                      onClick={() => onJumpToPoint?.(fc.x, fc.y)}
                      className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                        isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                      }`}
                    >
                      <span className="font-bold text-[#00693E]">{fc.label}</span>
                      <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Jump <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}

                  {conic.directrices && conic.directrices.map((d, i) => (
                    <div key={i} className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className="font-bold text-[#2d6fb4]">{d.equation}</span>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Directrix Line</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONIC & GEOMETRY DEEP DIVE */}
        {activeTab === 'conic' && (
          <div className="space-y-3.5">
            {conic && conic.isConic ? (
              <>
                {/* Full Conic Parameters Table */}
                <div
                  className={`p-3.5 border rounded-none space-y-2.5 ${
                    isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                  }`}
                >
                  <span className="text-xs font-bold text-[#2d6fb4] uppercase tracking-wider flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    <span>Conic Parameters & Dimensions</span>
                  </span>

                  <div className="space-y-1.5 text-xs font-mono">
                    {conic.details.map((dt, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded-none border flex items-center justify-between ${
                          isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'
                        }`}
                      >
                        <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>{dt.label}:</span>
                        <span className={`font-bold ${isLight ? 'text-black' : 'text-white'}`}>{dt.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Vertices & Co-Vertices */}
                {((conic.vertices && conic.vertices.length > 0) || (conic.coVertices && conic.coVertices.length > 0)) && (
                  <div
                    className={`p-3.5 border rounded-none space-y-2.5 ${
                      isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                    }`}
                  >
                    <span className="text-xs font-bold text-[#00693E] uppercase tracking-wider">
                      Vertices & Co-Vertices
                    </span>
                    <div className="space-y-1.5 text-xs font-mono">
                      {conic.vertices?.map((v, i) => (
                        <button
                          key={`v-${i}`}
                          onClick={() => onJumpToPoint?.(v.x, v.y)}
                          className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                            isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                          }`}
                        >
                          <span className="font-bold text-[#00693E]">{v.label}</span>
                          <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            Jump <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))}

                      {conic.coVertices?.map((cv, i) => (
                        <button
                          key={`cv-${i}`}
                          onClick={() => onJumpToPoint?.(cv.x, cv.y)}
                          className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                            isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                          }`}
                        >
                          <span className="font-bold text-[#6042a6]">{cv.label}</span>
                          <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            Jump <ChevronRight className="w-3 h-3" />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div
                className={`p-4 border rounded-none text-center space-y-2 ${
                  isLight ? 'bg-neutral-50 border-neutral-300 text-neutral-600' : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                <Compass className="w-6 h-6 text-[#2d6fb4] mx-auto" />
                <p className={`text-xs font-semibold ${isLight ? 'text-black' : 'text-white'}`}>Not a Classical Conic Section</p>
                <p className="text-xs">
                  This expression represents a general or non-quadratic curve. Use the <strong>Asymptotes & Limits</strong> or <strong>Roots & Extrema</strong> tabs to explore its calculus properties.
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: ASYMPTOTES & LIMITS */}
        {activeTab === 'asymptotes' && (
          <div className="space-y-3.5">
            {/* Vertical Asymptotes */}
            <div
              className={`p-3.5 border rounded-none space-y-2 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#c84442] uppercase tracking-wider">
                  Vertical Asymptotes (Poles)
                </span>
                <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  {analysis.asymptotes.vertical.length} found
                </span>
              </div>

              {analysis.asymptotes.vertical.length === 0 ? (
                <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  No finite vertical poles detected in [-20, 20].
                </div>
              ) : (
                <div className="space-y-1 text-xs font-mono">
                  {analysis.asymptotes.vertical.map((v, i) => (
                    <button
                      key={i}
                      onClick={() => onJumpToPoint?.(v.x, 0)}
                      className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                        isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                      }`}
                    >
                      <span className="font-bold text-[#c84442]">{v.equation}</span>
                      <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Jump <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Horizontal & Slant Asymptotes */}
            <div
              className={`p-3.5 border rounded-none space-y-2 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <span className="text-xs font-bold text-[#2d6fb4] uppercase tracking-wider">
                Horizontal & Oblique (Slant) Asymptotes
              </span>

              {analysis.asymptotes.horizontal.length === 0 && analysis.asymptotes.oblique.length === 0 ? (
                <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
                  No horizontal or slant asymptotes as x → ±∞.
                </div>
              ) : (
                <div className="space-y-1 text-xs font-mono">
                  {analysis.asymptotes.horizontal.map((h, i) => (
                    <div key={i} className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className="font-bold text-[#2d6fb4]">{h.equation}</span>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Horizontal (x → ±∞)</span>
                    </div>
                  ))}

                  {analysis.asymptotes.oblique.map((ob, i) => (
                    <div key={i} className={`p-2 rounded-none border flex justify-between ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                      <span className="font-bold text-[#fa7d19]">{ob.equation}</span>
                      <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Slant / Oblique</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Domain & Range Estimate */}
            <div
              className={`p-3.5 border rounded-none space-y-2 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <span className="text-xs font-bold text-[#00693E] uppercase tracking-wider">
                Domain & Range
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className={`p-2.5 rounded-none border ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                  <div className={`text-[10px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Domain (x):</div>
                  <div className="font-bold text-[#00693E] mt-0.5">{analysis.domain}</div>
                </div>
                <div className={`p-2.5 rounded-none border ${isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-900'}`}>
                  <div className={`text-[10px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Range (y):</div>
                  <div className="font-bold text-[#2d6fb4] mt-0.5">{analysis.range}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ROOTS & EXTREMA */}
        {activeTab === 'calculus' && (
          <div className="space-y-3.5">
            {/* Zeros / Roots */}
            <div
              className={`p-3.5 border rounded-none space-y-2 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#2d6fb4] uppercase tracking-wider">
                  Zeros / X-Intercepts (f(x) = 0)
                </span>
                <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>{analysis.zeros.length} found</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                {analysis.zeros.length === 0 ? (
                  <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>No real roots in [-15, 15]</div>
                ) : (
                  analysis.zeros.map((z, i) => (
                    <button
                      key={i}
                      onClick={() => onJumpToPoint?.(z.x, z.y)}
                      className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                        isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                      }`}
                    >
                      <span className="font-bold text-[#2d6fb4]">x = {z.x.toFixed(4)}</span>
                      <span className={`text-[10px] flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                        Jump <ChevronRight className="w-3 h-3" />
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Extrema (Min/Max) */}
            <div
              className={`p-3.5 border rounded-none space-y-2 ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#fa7d19] uppercase tracking-wider">
                  Local Extrema (f'(x) = 0)
                </span>
                <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>{analysis.extrema.length} found</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                {analysis.extrema.length === 0 ? (
                  <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>No local extrema found</div>
                ) : (
                  analysis.extrema.map((e, i) => (
                    <button
                      key={i}
                      onClick={() => onJumpToPoint?.(e.x, e.y)}
                      className={`w-full p-2 rounded-none border flex items-center justify-between text-left transition-colors ${
                        isLight ? 'bg-white hover:bg-neutral-100 border-neutral-200' : 'bg-black hover:bg-neutral-900 border-neutral-900'
                      }`}
                    >
                      <span className={`font-bold ${e.type === 'min' ? 'text-[#fa7d19]' : 'text-[#00693E]'}`}>
                        {e.type === 'min' ? 'Min' : 'Max'}: ({e.x.toFixed(3)}, {e.y.toFixed(3)})
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
                <span className={`text-[11px] font-mono ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>{analysis.inflections.length} found</span>
              </div>
              <div className="space-y-1.5 text-xs font-mono">
                {analysis.inflections.length === 0 ? (
                  <div className={`text-xs italic py-1 ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>No inflection points found</div>
                ) : (
                  analysis.inflections.map((inf, i) => (
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
          </>
        )}
      </div>
    </div>
  );
};
