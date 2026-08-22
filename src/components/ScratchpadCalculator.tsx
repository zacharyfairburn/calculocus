import React, { useState } from 'react';
import { MathDisplay } from './MathDisplay';
import {
  Trash2,
  Copy,
  Check,
  Divide,
  Calculator,
} from 'lucide-react';

export interface CalcHistoryItem {
  id: string;
  rawInput: string;
  latexInput: string;
  resultNum: number;
  resultDisplay: string;
  fractionDisplay?: string;
  resultComplex?: { re: number; im: number };
  timestamp: number;
}

interface ScratchpadCalculatorProps {
  currentInput: string;
  onChangeInput: (val: string) => void;
  history: CalcHistoryItem[];
  onCalculate: () => void;
  onClearHistory: () => void;
  angleMode: 'RAD' | 'DEG';
  onToggleAngleMode: () => void;
  theme?: 'dark' | 'light';
}

export const ScratchpadCalculator: React.FC<ScratchpadCalculatorProps> = ({
  currentInput,
  onChangeInput,
  history,
  onCalculate,
  onClearHistory,
  angleMode,
  onToggleAngleMode,
  theme = 'dark',
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFractions, setShowFractions] = useState(true);
  const isLight = theme === 'light';

  const copyToClipboard = (text: string, id: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }
  };

  return (
    <div
      className={`flex flex-col h-full select-none ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* Top Controls Bar */}
      <div
        className={`p-2 border-b flex items-center justify-between rounded-none ${
          isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <span className={`text-[11px] font-mono px-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
          {history.length} {history.length === 1 ? 'entry' : 'entries'}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onToggleAngleMode}
            className={`px-2 py-0.5 rounded-none text-[11px] font-mono border transition-colors ${
              isLight
                ? 'bg-neutral-100 border-neutral-300 text-black hover:bg-neutral-200'
                : 'bg-neutral-900 border-neutral-700 text-white hover:bg-neutral-800'
            }`}
            title="Toggle Angle Mode (RAD / DEG)"
          >
            {angleMode}
          </button>
          <button
            onClick={() => setShowFractions(!showFractions)}
            className={`px-2 py-0.5 rounded-none text-[11px] font-mono border transition-colors flex items-center gap-1 ${
              showFractions
                ? 'bg-[#2d6fb4]/15 border-[#2d6fb4]/50 text-[#2d6fb4] font-bold'
                : isLight
                ? 'bg-neutral-100 border-neutral-300 text-neutral-600'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400'
            }`}
            title="Toggle Exact Fractions"
          >
            <Divide className="w-3 h-3" />
            <span>Exact Frac</span>
          </button>
          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-1 rounded-none text-[#c84442] hover:bg-[#c84442]/10 transition-colors"
              title="Clear History"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* History Tape */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {history.length === 0 ? (
          <div className="h-full min-h-[160px] flex flex-col items-center justify-center text-center p-6 space-y-1.5">
            <Calculator className={`w-8 h-8 ${isLight ? 'text-neutral-400' : 'text-neutral-600'}`} />
            <p className={`text-xs font-semibold ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
              No calculations yet.
            </p>
            <p className={`text-[11px] ${isLight ? 'text-neutral-500' : 'text-neutral-500'}`}>
              Enter a mathematical expression to calculate results.
            </p>
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => onChangeInput(item.rawInput)}
              className={`p-3 border rounded-none transition-all cursor-pointer group ${
                isLight
                  ? 'bg-neutral-50 border-neutral-300 hover:border-[#00693E]'
                  : 'bg-neutral-950 border-neutral-800 hover:border-[#00693E]'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className={`font-mono text-[11px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                  {item.rawInput}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(item.resultDisplay, item.id);
                    }}
                    className={`p-1 rounded-none ${
                      isLight ? 'hover:bg-neutral-200 text-neutral-700' : 'hover:bg-neutral-800 text-neutral-300'
                    }`}
                    title="Copy result"
                  >
                    {copiedId === item.id ? <Check className="w-3 h-3 text-[#00693E]" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Formatted Equation */}
              <div className="flex items-center justify-between pt-1">
                <MathDisplay
                  latex={item.latexInput}
                  className={`text-xs overflow-x-auto ${isLight ? 'text-neutral-800' : 'text-neutral-200'}`}
                />
                <div className="text-right ml-4">
                  <span className={`text-sm font-bold font-mono ${isLight ? 'text-black' : 'text-white'}`}>
                    = {item.resultDisplay}
                  </span>
                  {showFractions && item.fractionDisplay && (
                    <div className="text-xs text-[#2d6fb4] font-mono mt-0.5">
                      <MathDisplay latex={`= ${item.fractionDisplay}`} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
