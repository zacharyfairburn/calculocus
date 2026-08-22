import React, { useState, useEffect } from 'react';
import { MathItem, ExpressionType } from '../types';
import { Parser } from '../engine/parser';
import { astToLatex } from '../engine/ast';
import { splitFormulaAndDomain, parseDomainRestriction } from '../engine/domain';
import { SERIES_PRESETS, SeriesPreset } from '../engine/series';
import { preprocessAngleNotation } from '../engine/complex';
import { MathDisplay } from './MathDisplay';
import {
  Eye,
  EyeOff,
  Trash2,
  Activity,
  Plus,
  Layers,
  Circle,
  GitCommit,
  Play,
  Pause,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Bookmark,
} from 'lucide-react';

interface ExpressionListProps {
  items: MathItem[];
  selectedId: string | null;
  onSelectItem: (id: string) => void;
  onUpdateItem: (id: string, updates: Partial<MathItem>) => void;
  onDeleteItem: (id: string) => void;
  onAddItem: (type?: ExpressionType, defaultRaw?: string, extra?: Partial<MathItem>) => void;
  theme?: 'dark' | 'light';
}

const COLOR_PALETTE = [
  '#00693E', // Dartmouth green (main)
  '#2d6fb4', // Deep blue
  '#fa7d19', // Orange
  '#6042a6', // Purple
  '#c84442', // Coral red
];

export const ExpressionList: React.FC<ExpressionListProps> = ({
  items,
  selectedId,
  onSelectItem,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  theme = 'dark',
}) => {
  const [expandedControls, setExpandedControls] = useState<Record<string, boolean>>({});
  const isLight = theme === 'light';

  // Parametric simulation animation loop
  const animatingItems = items.filter((it) => it.type === 'parametric' && it.parametricSimulating);

  useEffect(() => {
    if (animatingItems.length === 0) return;

    let animId: number;
    let lastTime = performance.now();

    const step = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      animatingItems.forEach((item) => {
        const tMin = item.parametricTMin ?? -10;
        const tMax = item.parametricTMax ?? 10;
        const range = tMax - tMin;
        const speed = range / 6; // 6 seconds per full cycle
        let nextT = (item.parametricTCurrent ?? tMin) + speed * dt;
        if (nextT > tMax) nextT = tMin;

        onUpdateItem(item.id, { parametricTCurrent: nextT });
      });

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [animatingItems, onUpdateItem]);

  const toggleExpanded = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedControls((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleApplySeriesPreset = (itemId: string, preset: SeriesPreset) => {
    const rawInput = `sum(${preset.term}, ${preset.varName}=${preset.from}..${preset.defaultN})`;
    onUpdateItem(itemId, {
      seriesTerm: preset.term,
      seriesFrom: preset.from,
      seriesTo: preset.defaultN,
      seriesVar: preset.varName,
      rawInput,
      label: preset.name,
    });
  };

  return (
    <div
      className={`flex flex-col h-full ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* Quick Add Bar */}
      <div
        className={`p-2 border-b flex items-center justify-between gap-1 overflow-x-auto ${
          isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <span className={`text-[11px] font-mono px-1 shrink-0 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onAddItem('cartesian', '')}
            className="px-2.5 py-1 bg-[#00693E] hover:bg-[#005230] text-white text-[11px] font-semibold flex items-center gap-1 transition-all shadow-xs min-h-[32px] rounded-none"
            title="Add Cartesian f(x)"
          >
            <Plus className="w-3 h-3" />
            <span>f(x)</span>
          </button>
          <button
            onClick={() => onAddItem('implicit', 'x^2 + y^2 = 25')}
            className={`px-2.5 py-1 border text-[11px] font-medium flex items-center gap-1 transition-all min-h-[32px] rounded-none ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
            }`}
            title="Add Implicit Relation"
          >
            <Circle className="w-3 h-3 text-[#2d6fb4]" />
            <span>Implicit</span>
          </button>
          <button
            onClick={() => onAddItem('polar', '2 * cos(4 * theta)')}
            className={`px-2.5 py-1 border text-[11px] font-medium flex items-center gap-1 transition-all min-h-[32px] rounded-none ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
            }`}
            title="Add Polar r(θ)"
          >
            <span className="font-serif italic text-[#fa7d19]">r(θ)</span>
          </button>
          <button
            onClick={() => onAddItem('parametric', '', {
              parametricX: 'cos(t)',
              parametricY: 'sin(t)',
              parametricTMin: 0,
              parametricTMax: 6.28,
              parametricTCurrent: 0,
            })}
            className={`px-2.5 py-1 border text-[11px] font-medium flex items-center gap-1 transition-all min-h-[32px] rounded-none ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
            }`}
            title="Add Parametric (x(t), y(t))"
          >
            <GitCommit className="w-3 h-3 text-[#c84442]" />
            <span>(x,y)(t)</span>
          </button>
          <button
            onClick={() => onAddItem('complex', '3 + 4i')}
            className={`px-2.5 py-1 border text-[11px] font-medium flex items-center gap-1 transition-all min-h-[32px] rounded-none ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
            }`}
            title="Add Complex z"
          >
            <span className="font-serif italic font-bold text-[#fa7d19]">z</span>
            <span>Complex</span>
          </button>
          <button
            onClick={() => {
              const defaultPreset = SERIES_PRESETS[1] || SERIES_PRESETS[0]; // Sine series
              onAddItem('series', `sum(${defaultPreset.term}, ${defaultPreset.varName}=${defaultPreset.from}..${defaultPreset.defaultN})`, {
                seriesTerm: defaultPreset.term,
                seriesFrom: defaultPreset.from,
                seriesTo: defaultPreset.defaultN,
                seriesVar: defaultPreset.varName,
                seriesMode: 'partial_sum',
                label: defaultPreset.name,
              });
            }}
            className={`px-2.5 py-1 border text-[11px] font-medium flex items-center gap-1 transition-all min-h-[32px] rounded-none ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
            }`}
            title="Add Series ∑ a_n"
          >
            <span className="font-serif font-bold text-[#6042a6]">∑</span>
            <span>Series</span>
          </button>
        </div>
      </div>

      {/* Scrollable Expression Cards */}
      <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
        {items.length === 0 ? (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 space-y-1.5">
            <Layers className={`w-8 h-8 ${isLight ? 'text-neutral-400' : 'text-neutral-600'}`} />
            <p className={`text-xs font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
              No equations added.
            </p>
            <p className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
              Use the buttons above or the formula bar below to create one.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const { formula, domainStr } = splitFormulaAndDomain(item.rawInput);
            const effectiveDomain = item.domainRaw || domainStr;
            const parsedDomain = parseDomainRestriction(effectiveDomain, item.type === 'polar' ? 'theta' : item.type === 'parametric' ? 't' : 'x');

            let latex = item.rawInput;
            let parseError = false;

            if (item.type === 'series') {
              const term = item.seriesTerm || 'a_n';
              const fromN = item.seriesFrom ?? 0;
              const toN = item.seriesTo ?? 5;
              latex = `S_{${toN}}(x) = \\sum_{n=${fromN}}^{${toN}} ${term}`;
            } else if (item.type === 'parametric') {
              latex = `\\begin{cases} x(t) = ${item.parametricX || 'cos(t)'} \\\\ y(t) = ${item.parametricY || 'sin(t)'} \\end{cases} \\quad t \\in [${item.parametricTMin ?? -10}, ${item.parametricTMax ?? 10}]`;
            } else if (formula.trim()) {
              try {
                const ast = Parser.parse(formula);
                if (item.type === 'cartesian') {
                  if (formula.includes('=')) {
                    latex = astToLatex(ast);
                  } else {
                    latex = `f(x) = ${astToLatex(ast)}`;
                  }
                  if (parsedDomain && parsedDomain.isRestricted) {
                    latex += ` \\quad ${parsedDomain.toLatex()}`;
                  }
                } else if (item.type === 'implicit') {
                  latex = astToLatex(ast);
                } else if (item.type === 'polar') {
                  latex = `r(\\theta) = ${astToLatex(ast)}`;
                  if (parsedDomain && parsedDomain.isRestricted) {
                    latex += ` \\quad ${parsedDomain.toLatex()}`;
                  }
                } else if (item.type === 'complex') {
                  const preprocessed = preprocessAngleNotation(formula);
                  const astComp = Parser.parse(preprocessed);
                  latex = `z = ${astToLatex(astComp)}`;
                } else if (item.type === 'surface3d') {
                  latex = `z(x, y) = ${astToLatex(ast)}`;
                }
              } catch {
                parseError = true;
              }
            } else {
              latex = '...';
            }

            const isSelected = selectedId === item.id;
            const isControlsExpanded = expandedControls[item.id] ?? (item.type === 'parametric' || item.type === 'series');

            return (
              <div
                key={item.id}
                onClick={() => onSelectItem(item.id)}
                className={`p-3 transition-all cursor-pointer border rounded-none ${
                  isSelected
                    ? isLight
                      ? 'border-[#00693E] bg-[#00693E]/5 ring-1 ring-[#00693E]'
                      : 'border-[#00693E] bg-[#00693E]/10 ring-1 ring-[#00693E]'
                    : isLight
                    ? 'border-neutral-300 bg-white hover:border-neutral-400'
                    : 'border-neutral-800 bg-black hover:border-neutral-700'
                }`}
              >
                {/* Header Row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Color Swatch / Visibility Toggle */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateItem(item.id, { visible: !item.visible });
                      }}
                      className="w-5 h-5 flex items-center justify-center rounded-none shrink-0 transition-transform active:scale-95"
                      style={{ backgroundColor: item.visible ? item.color : 'transparent', border: `2px solid ${item.color}` }}
                      title={item.visible ? 'Hide from graph' : 'Show on graph'}
                    >
                      {item.visible ? (
                        <Eye className="w-3 h-3 text-white mix-blend-difference" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-neutral-500" />
                      )}
                    </button>

                    {/* Expression Type Badge */}
                    <span
                      className={`text-[10px] uppercase font-mono px-1 py-0.5 border shrink-0 ${
                        isLight ? 'bg-neutral-100 border-neutral-300 text-neutral-700' : 'bg-neutral-900 border-neutral-800 text-neutral-400'
                      }`}
                    >
                      {item.type}
                    </span>

                    {/* Color Picker palette */}
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => onUpdateItem(item.id, { color: c })}
                          className={`w-3 h-3 transition-transform ${item.color === c ? 'scale-125 ring-1 ring-white' : 'opacity-60 hover:opacity-100'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Actions Right */}
                  <div className="flex items-center gap-1 shrink-0">
                    {(item.type === 'parametric' || item.type === 'series') && (
                      <button
                        type="button"
                        onClick={(e) => toggleExpanded(item.id, e)}
                        className={`p-1 border text-[10px] font-mono flex items-center gap-0.5 transition-colors ${
                          isControlsExpanded
                            ? 'bg-[#00693E]/20 text-[#00693E] border-[#00693E]'
                            : isLight
                            ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                        }`}
                        title="Toggle specialized simulator & series controls"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        {isControlsExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteItem(item.id);
                      }}
                      className="p-1 text-neutral-400 hover:text-[#c84442] hover:bg-[#c84442]/10 transition-colors"
                      title="Delete equation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Math Render / Formula Input */}
                <div className="mt-2 font-serif text-sm overflow-x-auto py-1">
                  {item.type === 'parametric' ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>x(t) =</span>
                        <input
                          type="text"
                          value={item.parametricX || ''}
                          onChange={(e) => onUpdateItem(item.id, { parametricX: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-full px-2 py-0.5 border text-xs font-mono rounded-none ${
                            isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                          }`}
                          placeholder="e.g. 3 * cos(t)"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>y(t) =</span>
                        <input
                          type="text"
                          value={item.parametricY || ''}
                          onChange={(e) => onUpdateItem(item.id, { parametricY: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          className={`w-full px-2 py-0.5 border text-xs font-mono rounded-none ${
                            isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                          }`}
                          placeholder="e.g. 3 * sin(t)"
                        />
                      </div>
                    </div>
                  ) : item.type === 'series' ? (
                    <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>a_n(x) =</span>
                        <input
                          type="text"
                          value={item.seriesTerm || ''}
                          onChange={(e) => {
                            const newTerm = e.target.value;
                            const fromN = item.seriesFrom ?? 0;
                            const toN = item.seriesTo ?? 5;
                            onUpdateItem(item.id, {
                              seriesTerm: newTerm,
                              rawInput: `sum(${newTerm}, n=${fromN}..${toN})`,
                            });
                          }}
                          className={`w-full px-2 py-0.5 border text-xs font-mono rounded-none ${
                            isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                          }`}
                          placeholder="e.g. ((-1)^n * x^(2*n+1)) / ((2*n+1)!)"
                        />
                      </div>
                      <div className="text-xs pt-1">
                        <MathDisplay latex={latex} />
                      </div>
                    </div>
                  ) : (
                    <div>
                      {parseError ? (
                        <span className="text-xs font-mono text-[#c84442]">Syntax Error</span>
                      ) : (
                        <MathDisplay latex={latex} />
                      )}
                    </div>
                  )}
                </div>

                {/* Domain & Restrictions Badge */}
                {parsedDomain && parsedDomain.isRestricted && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.2 border ${
                        isLight
                          ? 'bg-neutral-100 border-neutral-300 text-neutral-800'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-300'
                      }`}
                    >
                      Domain: {parsedDomain.toLatex()}
                    </span>
                  </div>
                )}

                {/* EXPANDABLE CONTROLS */}
                {isControlsExpanded && (
                  <div className="mt-2.5 pt-2 border-t space-y-2 text-xs" onClick={(e) => e.stopPropagation()}>
                    {/* Parametric Simulator Controls */}
                    {item.type === 'parametric' && (
                      <div className="space-y-2 p-2 border bg-neutral-500/5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1 text-[#c84442]">
                            <GitCommit className="w-3.5 h-3.5" />
                            <span>Parametric Motion Simulator</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onUpdateItem(item.id, { parametricSimulating: !item.parametricSimulating })}
                              className={`px-2 py-0.5 text-[10px] font-mono font-bold flex items-center gap-1 border transition-colors ${
                                item.parametricSimulating
                                  ? 'bg-[#c84442] text-white border-[#c84442] shadow-xs'
                                  : isLight
                                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                              }`}
                            >
                              {item.parametricSimulating ? <Pause className="w-2.5 h-2.5" /> : <Play className="w-2.5 h-2.5" />}
                              <span>{item.parametricSimulating ? 'Pause' : 'Simulate'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateItem(item.id, { parametricTCurrent: item.parametricTMin ?? -10 })}
                              className={`p-1 border transition-colors ${
                                isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700'
                              }`}
                              title="Reset to t_min"
                            >
                              <RotateCcw className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* t bounds */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <label className={`block text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>t_min:</label>
                            <input
                              type="number"
                              step="0.5"
                              value={item.parametricTMin ?? -10}
                              onChange={(e) => onUpdateItem(item.id, { parametricTMin: parseFloat(e.target.value) || 0 })}
                              className={`w-full px-1.5 py-0.5 border rounded-none ${
                                isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`block text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>t_max:</label>
                            <input
                              type="number"
                              step="0.5"
                              value={item.parametricTMax ?? 10}
                              onChange={(e) => onUpdateItem(item.id, { parametricTMax: parseFloat(e.target.value) || 0 })}
                              className={`w-full px-1.5 py-0.5 border rounded-none ${
                                isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Current t slider */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                            <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Current parameter t:</span>
                            <span className="font-bold text-[#c84442]">t = {(item.parametricTCurrent ?? item.parametricTMin ?? -10).toFixed(2)}</span>
                          </div>
                          <input
                            type="range"
                            min={item.parametricTMin ?? -10}
                            max={item.parametricTMax ?? 10}
                            step={0.01}
                            value={item.parametricTCurrent ?? item.parametricTMin ?? -10}
                            onChange={(e) => onUpdateItem(item.id, { parametricTCurrent: parseFloat(e.target.value) })}
                            className="w-full accent-[#c84442] cursor-pointer"
                          />
                        </div>

                        {/* Vector checkboxes */}
                        <div className="flex items-center gap-3 text-[11px]">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.showTangentVector ?? true}
                              onChange={(e) => onUpdateItem(item.id, { showTangentVector: e.target.checked })}
                              className="accent-[#00693E]"
                            />
                            <span className={isLight ? 'text-neutral-800' : 'text-neutral-200'}>Show Tangent T(t)</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.showVelocityVector ?? true}
                              onChange={(e) => onUpdateItem(item.id, { showVelocityVector: e.target.checked })}
                              className="accent-[#f59e0b]"
                            />
                            <span className={isLight ? 'text-neutral-800' : 'text-neutral-200'}>Show Velocity Vector v(t)</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Series & Sequence Subsection with Presets and Controls */}
                    {item.type === 'series' && (
                      <div className="space-y-3 p-2.5 border bg-neutral-500/5" onClick={(e) => e.stopPropagation()}>
                        {/* Header & Mode Switch */}
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1 text-[#6042a6]">
                            <span className="font-serif text-sm">∑</span>
                            <span>Series & Sequence Controls</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onUpdateItem(item.id, { seriesMode: 'partial_sum' })}
                              className={`px-2 py-0.5 text-[10px] font-mono border transition-colors ${
                                (item.seriesMode ?? 'partial_sum') === 'partial_sum'
                                  ? 'bg-[#6042a6] text-white border-[#6042a6] shadow-xs'
                                  : isLight
                                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                              }`}
                            >
                              S_N(x) Curve
                            </button>
                            <button
                              type="button"
                              onClick={() => onUpdateItem(item.id, { seriesMode: 'sequence_plot' })}
                              className={`px-2 py-0.5 text-[10px] font-mono border transition-colors ${
                                item.seriesMode === 'sequence_plot'
                                  ? 'bg-[#6042a6] text-white border-[#6042a6] shadow-xs'
                                  : isLight
                                  ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-800 border-neutral-300'
                                  : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border-neutral-700'
                              }`}
                            >
                              (n, a_n) Stems
                            </button>
                          </div>
                        </div>

                        {/* Series Presets Quick Selector */}
                        <div>
                          <label className={`block text-[10px] uppercase font-bold mb-1.5 flex items-center gap-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            <Bookmark className="w-3 h-3 text-[#6042a6]" />
                            <span>Quick Series Presets:</span>
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                            {SERIES_PRESETS.map((preset) => {
                              const isCurrent = item.seriesTerm === preset.term;
                              return (
                                <button
                                  key={preset.id}
                                  type="button"
                                  onClick={() => handleApplySeriesPreset(item.id, preset)}
                                  className={`px-1.5 py-1 text-left border text-[10px] font-medium transition-all truncate rounded-none ${
                                    isCurrent
                                      ? 'bg-[#6042a6] text-white border-[#6042a6] font-bold'
                                      : isLight
                                      ? 'bg-white hover:bg-neutral-100 border-neutral-300 text-neutral-800'
                                      : 'bg-black hover:bg-neutral-900 border-neutral-800 text-neutral-200'
                                  }`}
                                  title={`${preset.name} - ${preset.formulaLatex}`}
                                >
                                  {preset.name}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Index Controls (From n0 to Order N) */}
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <label className={`block text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                              Start Index (n₀):
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={10}
                              value={item.seriesFrom ?? 0}
                              onChange={(e) => {
                                const fromVal = parseInt(e.target.value, 10) || 0;
                                const toVal = item.seriesTo ?? 5;
                                onUpdateItem(item.id, {
                                  seriesFrom: fromVal,
                                  rawInput: `sum(${item.seriesTerm || 'a_n'}, n=${fromVal}..${toVal})`,
                                });
                              }}
                              className={`w-full px-1.5 py-0.5 border rounded-none ${
                                isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                              }`}
                            />
                          </div>
                          <div>
                            <label className={`block text-[10px] uppercase font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                              Order / Bound (N):
                            </label>
                            <input
                              type="number"
                              min={1}
                              max={35}
                              value={item.seriesTo ?? 5}
                              onChange={(e) => {
                                const toVal = parseInt(e.target.value, 10) || 1;
                                const fromVal = item.seriesFrom ?? 0;
                                onUpdateItem(item.id, {
                                  seriesTo: toVal,
                                  rawInput: `sum(${item.seriesTerm || 'a_n'}, n=${fromVal}..${toVal})`,
                                });
                              }}
                              className={`w-full px-1.5 py-0.5 border rounded-none ${
                                isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                              }`}
                            />
                          </div>
                        </div>

                        {/* Order Slider with Live Feedback */}
                        <div>
                          <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                            <span className={isLight ? 'text-neutral-700' : 'text-neutral-300'}>Approximation Order N:</span>
                            <span className="font-bold text-[#6042a6]">N = {item.seriesTo ?? 5} terms</span>
                          </div>
                          <input
                            type="range"
                            min={1}
                            max={35}
                            value={item.seriesTo ?? 5}
                            onChange={(e) => {
                              const toVal = parseInt(e.target.value, 10);
                              const fromVal = item.seriesFrom ?? 0;
                              onUpdateItem(item.id, {
                                seriesTo: toVal,
                                rawInput: `sum(${item.seriesTerm || 'a_n'}, n=${fromVal}..${toVal})`,
                              });
                            }}
                            className="w-full accent-[#6042a6] cursor-pointer"
                          />
                        </div>
                      </div>
                    )}

                    {/* Calculus Quick Actions */}
                    {item.type === 'cartesian' && !parseError && formula.trim() && (
                      <div
                        className={`pt-1 flex items-center justify-between text-xs ${
                          isLight ? 'border-neutral-200' : 'border-neutral-900'
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => onUpdateItem(item.id, { isDerivativeVisible: !item.isDerivativeVisible })}
                          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono transition-colors border ${
                            item.isDerivativeVisible
                              ? 'bg-[#2d6fb4]/15 text-[#2d6fb4] border-[#2d6fb4]/40 font-bold'
                              : isLight
                              ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300'
                              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          <Activity className="w-3 h-3" />
                          <span>f'(x)</span>
                        </button>

                        <button
                          onClick={() => {
                            onUpdateItem(item.id, {
                              isIntegralVisible: !item.isIntegralVisible,
                              integralRange: item.integralRange || [0, Math.PI],
                            });
                          }}
                          className={`flex items-center gap-1 px-2 py-1 text-[11px] font-mono transition-colors border ${
                            item.isIntegralVisible
                              ? 'bg-[#00693E]/15 text-[#00693E] border-[#00693E]/40 font-bold'
                              : isLight
                              ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300'
                              : 'bg-neutral-900 hover:bg-neutral-800 text-neutral-400 border-neutral-800'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          <span>∫ Area</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
