import React, { useState } from 'react';
import { Delete, CornerDownLeft, ArrowLeft, ArrowRight } from 'lucide-react';

interface MathKeyboardProps {
  onInsert: (text: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onEnter: () => void;
  onMoveCursor?: (dir: 'left' | 'right') => void;
  theme?: 'dark' | 'light';
}

export type KeyboardPane = '123' | 'fx' | 'alg' | 'sym';

export const MathKeyboard: React.FC<MathKeyboardProps> = ({
  onInsert,
  onBackspace,
  onClear,
  onEnter,
  onMoveCursor,
  theme = 'dark',
}) => {
  const [activePane, setActivePane] = useState<KeyboardPane>('123');
  const isLight = theme === 'light';

  const handleKey = (insertText: string) => {
    onInsert(insertText);
  };

  return (
    <div
      id="math-keyboard"
      role="region"
      aria-label="Virtual Math Keyboard"
      className={`w-full p-1.5 sm:p-2 select-none flex flex-col gap-1.5 border-t ${
        isLight
          ? 'bg-white border-neutral-300 text-black shadow-lg'
          : 'bg-neutral-950 border-neutral-800 text-white shadow-2xl'
      }`}
    >
      {/* Pane Switcher Tabs & Quick Navigation */}
      <div className="flex items-center justify-between gap-1 px-0.5">
        <div
          className={`flex items-center gap-1 p-0.5 border ${
            isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-900 border-neutral-800'
          }`}
        >
          {(['123', 'fx', 'alg', 'sym'] as KeyboardPane[]).map((pane) => (
            <button
              key={pane}
              type="button"
              onClick={() => setActivePane(pane)}
              className={`px-2.5 sm:px-3 py-1 text-xs font-semibold transition-all min-h-[32px] sm:min-h-[28px] ${
                activePane === pane
                  ? 'bg-[#00693E] text-white shadow-sm'
                  : isLight
                  ? 'text-neutral-700 hover:text-black hover:bg-neutral-200'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {pane === '123' ? '123' : pane === 'fx' ? 'f(x)' : pane === 'alg' ? 'alg' : 'sym / domain'}
            </button>
          ))}
        </div>

        {/* Cursor & Delete Controls */}
        <div className="flex items-center gap-1">
          {onMoveCursor && (
            <>
              <button
                type="button"
                onClick={() => onMoveCursor('left')}
                className={`p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center border transition-colors ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                }`}
                title="Cursor Left"
                aria-label="Move cursor left"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onMoveCursor('right')}
                className={`p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center border transition-colors ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                }`}
                title="Cursor Right"
                aria-label="Move cursor right"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClear}
            className="px-2.5 min-h-[36px] text-[11px] font-bold border bg-[#c84442]/10 border-[#c84442]/40 text-[#c84442] hover:bg-[#c84442] hover:text-white transition-colors flex items-center justify-center"
            aria-label="Clear input"
          >
            AC
          </button>
          <button
            type="button"
            onClick={onBackspace}
            className={`p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center border transition-colors ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
            }`}
            title="Backspace"
            aria-label="Backspace"
          >
            <Delete className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pane 1: Numbers & Core Arithmetic (123) */}
      {activePane === '123' && (
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          <Key label="x" onClick={() => handleKey('x')} isLight={isLight} highlight="blue" />
          <Key label="y" onClick={() => handleKey('y')} isLight={isLight} highlight="blue" />
          <Key label="^" onClick={() => handleKey('^')} isLight={isLight} />
          <Key label="x²" onClick={() => handleKey('^2')} isLight={isLight} />
          <Key label="÷" onClick={() => handleKey('/')} isLight={isLight} />

          <Key label="7" onClick={() => handleKey('7')} isNum isLight={isLight} />
          <Key label="8" onClick={() => handleKey('8')} isNum isLight={isLight} />
          <Key label="9" onClick={() => handleKey('9')} isNum isLight={isLight} />
          <Key label="×" onClick={() => handleKey('*')} isLight={isLight} />
          <Key label="(" onClick={() => handleKey('(')} isLight={isLight} />

          <Key label="4" onClick={() => handleKey('4')} isNum isLight={isLight} />
          <Key label="5" onClick={() => handleKey('5')} isNum isLight={isLight} />
          <Key label="6" onClick={() => handleKey('6')} isNum isLight={isLight} />
          <Key label="-" onClick={() => handleKey('-')} isLight={isLight} />
          <Key label=")" onClick={() => handleKey(')')} isLight={isLight} />

          <Key label="1" onClick={() => handleKey('1')} isNum isLight={isLight} />
          <Key label="2" onClick={() => handleKey('2')} isNum isLight={isLight} />
          <Key label="3" onClick={() => handleKey('3')} isNum isLight={isLight} />
          <Key label="+" onClick={() => handleKey('+')} isLight={isLight} />
          <ActionKey label="Enter" icon={<CornerDownLeft className="w-4 h-4" />} onClick={onEnter} />

          <Key label="0" onClick={() => handleKey('0')} isNum isLight={isLight} />
          <Key label="." onClick={() => handleKey('.')} isNum isLight={isLight} />
          <Key label="π" onClick={() => handleKey('pi')} isLight={isLight} highlight="orange" />
          <Key label="e" onClick={() => handleKey('e')} isLight={isLight} highlight="orange" />
          <Key label="=" onClick={() => handleKey('=')} isLight={isLight} highlight="green" />
        </div>
      )}

      {/* Pane 2: Functions & Calculus (f(x)) */}
      {activePane === 'fx' && (
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          <Key label="sin" onClick={() => handleKey('sin(')} isLight={isLight} />
          <Key label="cos" onClick={() => handleKey('cos(')} isLight={isLight} />
          <Key label="tan" onClick={() => handleKey('tan(')} isLight={isLight} />
          <Key label="ln" onClick={() => handleKey('ln(')} isLight={isLight} highlight="blue" />
          <Key label="log" onClick={() => handleKey('log(')} isLight={isLight} highlight="blue" />

          <Key label="asin" onClick={() => handleKey('asin(')} isLight={isLight} />
          <Key label="acos" onClick={() => handleKey('acos(')} isLight={isLight} />
          <Key label="atan" onClick={() => handleKey('atan(')} isLight={isLight} />
          <Key label="log₂" onClick={() => handleKey('log2(')} isLight={isLight} />
          <Key label="log₁₀" onClick={() => handleKey('log10(')} isLight={isLight} />

          <Key label="sinh" onClick={() => handleKey('sinh(')} isLight={isLight} />
          <Key label="cosh" onClick={() => handleKey('cosh(')} isLight={isLight} />
          <Key label="tanh" onClick={() => handleKey('tanh(')} isLight={isLight} />
          <Key label="d/dx" sub="diff" onClick={() => handleKey('diff(')} isLight={isLight} highlight="green" />
          <Key label="∫" sub="int" onClick={() => handleKey('integrate(')} isLight={isLight} highlight="green" />

          <Key label="exp" onClick={() => handleKey('exp(')} isLight={isLight} />
          <Key label="√" onClick={() => handleKey('sqrt(')} isLight={isLight} />
          <Key label="∛" onClick={() => handleKey('cbrt(')} isLight={isLight} />
          <Key label="∑" sub="series" onClick={() => handleKey('sum(')} isLight={isLight} highlight="purple" />
          <ActionKey label="Enter" icon={<CornerDownLeft className="w-4 h-4" />} onClick={onEnter} />
        </div>
      )}

      {/* Pane 3: Algebraic & Number Theory (alg) */}
      {activePane === 'alg' && (
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          <Key label="|x|" onClick={() => handleKey('abs(')} isLight={isLight} highlight="purple" />
          <Key label="sgn" onClick={() => handleKey('sgn(')} isLight={isLight} />
          <Key label="floor" onClick={() => handleKey('floor(')} isLight={isLight} />
          <Key label="ceil" onClick={() => handleKey('ceil(')} isLight={isLight} />
          <Key label="round" onClick={() => handleKey('round(')} isLight={isLight} />

          <Key label="root" sub="n,x" onClick={() => handleKey('root(')} isLight={isLight} />
          <Key label="min" onClick={() => handleKey('min(')} isLight={isLight} />
          <Key label="max" onClick={() => handleKey('max(')} isLight={isLight} />
          <Key label="gcd" onClick={() => handleKey('gcd(')} isLight={isLight} />
          <Key label="lcm" onClick={() => handleKey('lcm(')} isLight={isLight} />

          <Key label="nCr" onClick={() => handleKey('nCr(')} isLight={isLight} />
          <Key label="nPr" onClick={() => handleKey('nPr(')} isLight={isLight} />
          <Key label="hypot" onClick={() => handleKey('hypot(')} isLight={isLight} />
          <Key label="sec" onClick={() => handleKey('sec(')} isLight={isLight} />
          <Key label="csc" onClick={() => handleKey('csc(')} isLight={isLight} />

          <Key label="cot" onClick={() => handleKey('cot(')} isLight={isLight} />
          <Key label="^" onClick={() => handleKey('^')} isLight={isLight} />
          <Key label="!" onClick={() => handleKey('!')} isLight={isLight} />
          <Key label="," onClick={() => handleKey(',')} isLight={isLight} />
          <ActionKey label="Enter" icon={<CornerDownLeft className="w-4 h-4" />} onClick={onEnter} />
        </div>
      )}

      {/* Pane 4: Symbols, Domain Restrictions & Parameters (sym) */}
      {activePane === 'sym' && (
        <div className="grid grid-cols-5 gap-1 sm:gap-1.5">
          <Key label="{" sub="brace" onClick={() => handleKey('{')} isLight={isLight} highlight="orange" />
          <Key label="}" sub="brace" onClick={() => handleKey('}')} isLight={isLight} highlight="orange" />
          <Key label="[" sub="bracket" onClick={() => handleKey('[')} isLight={isLight} highlight="orange" />
          <Key label="]" sub="bracket" onClick={() => handleKey(']')} isLight={isLight} highlight="orange" />
          <Key label="|" sub="such that" onClick={() => handleKey('|')} isLight={isLight} highlight="orange" />

          <Key label="<" onClick={() => handleKey('<')} isLight={isLight} highlight="blue" />
          <Key label=">" onClick={() => handleKey('>')} isLight={isLight} highlight="blue" />
          <Key label="≤" onClick={() => handleKey('<=')} isLight={isLight} highlight="blue" />
          <Key label="≥" onClick={() => handleKey('>=')} isLight={isLight} highlight="blue" />
          <Key label="∠" sub="angle" onClick={() => handleKey('∠')} isLight={isLight} highlight="blue" />

          <Key label="t" sub="param" onClick={() => handleKey('t')} isLight={isLight} highlight="purple" />
          <Key label="n" sub="series" onClick={() => handleKey('n')} isLight={isLight} highlight="purple" />
          <Key label="θ" sub="polar" onClick={() => handleKey('theta')} isLight={isLight} highlight="purple" />
          <Key label="r" sub="radius" onClick={() => handleKey('r')} isLight={isLight} highlight="purple" />
          <Key label="i" sub="imag" onClick={() => handleKey('i')} isLight={isLight} highlight="purple" />

          <Key label="a" onClick={() => handleKey('a')} isLight={isLight} />
          <Key label="b" onClick={() => handleKey('b')} isLight={isLight} />
          <Key label="c" onClick={() => handleKey('c')} isLight={isLight} />
          <Key label="k" onClick={() => handleKey('k')} isLight={isLight} />
          <ActionKey label="Enter" icon={<CornerDownLeft className="w-4 h-4" />} onClick={onEnter} />
        </div>
      )}
    </div>
  );
};

const Key: React.FC<{
  label: string;
  sub?: string;
  onClick: () => void;
  isNum?: boolean;
  isLight?: boolean;
  highlight?: 'blue' | 'purple' | 'green' | 'orange';
}> = ({ label, sub, onClick, isNum, isLight, highlight }) => {
  let colorStyles = isLight
    ? 'bg-neutral-100 border-neutral-300 text-black hover:bg-neutral-200'
    : 'bg-neutral-900 border-neutral-800 text-white hover:bg-neutral-800';

  if (highlight === 'blue') {
    colorStyles = isLight
      ? 'bg-[#2d6fb4]/10 border-[#2d6fb4]/30 text-[#2d6fb4] hover:bg-[#2d6fb4]/20'
      : 'bg-[#2d6fb4]/20 border-[#2d6fb4]/40 text-[#5b9be6] hover:bg-[#2d6fb4]/30';
  } else if (highlight === 'purple') {
    colorStyles = isLight
      ? 'bg-[#6042a6]/10 border-[#6042a6]/30 text-[#6042a6] hover:bg-[#6042a6]/20'
      : 'bg-[#6042a6]/20 border-[#6042a6]/40 text-[#a589e8] hover:bg-[#6042a6]/30';
  } else if (highlight === 'green') {
    colorStyles = isLight
      ? 'bg-[#00693E]/10 border-[#00693E]/30 text-[#00693E] hover:bg-[#00693E]/20'
      : 'bg-[#00693E]/20 border-[#00693E]/40 text-[#43b082] hover:bg-[#00693E]/30';
  } else if (highlight === 'orange') {
    colorStyles = isLight
      ? 'bg-[#fa7d19]/10 border-[#fa7d19]/30 text-[#fa7d19] hover:bg-[#fa7d19]/20'
      : 'bg-[#fa7d19]/20 border-[#fa7d19]/40 text-[#ffa154] hover:bg-[#fa7d19]/30';
  } else if (isNum) {
    colorStyles = isLight
      ? 'bg-white border-neutral-300 text-black font-bold hover:bg-neutral-100'
      : 'bg-neutral-800 border-neutral-700 text-white font-bold hover:bg-neutral-700';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] font-mono text-sm font-medium transition-all active:scale-95 flex flex-col items-center justify-center border shadow-sm ${colorStyles}`}
      aria-label={sub ? `${label} (${sub})` : label}
    >
      <span>{label}</span>
      {sub && <span className="text-[9px] opacity-75 -mt-1 font-sans">{sub}</span>}
    </button>
  );
};

const ActionKey: React.FC<{
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}> = ({ label, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="h-10 sm:h-9 min-h-[40px] sm:min-h-[36px] bg-[#00693E] border border-[#00693E] text-white font-semibold text-xs flex items-center justify-center gap-1 hover:brightness-110 transition-all active:scale-95 shadow-md"
    aria-label={label}
  >
    {icon}
    <span>{label}</span>
  </button>
);
