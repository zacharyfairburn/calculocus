import React, { useState, useEffect } from 'react';
import { Viewport3D } from '../types';
import { X, RotateCcw, Check, Sliders } from 'lucide-react';

interface BoundsModal3DProps {
  isOpen: boolean;
  onClose: () => void;
  viewport: Viewport3D;
  onChange: (vp: Viewport3D) => void;
  theme?: 'dark' | 'light';
}

export const BoundsModal3D: React.FC<BoundsModal3DProps> = ({
  isOpen,
  onClose,
  viewport,
  onChange,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  const [xMin, setXMin] = useState<string>(String(viewport.xMin ?? -1));
  const [xMax, setXMax] = useState<string>(String(viewport.xMax ?? 1));
  const [yMin, setYMin] = useState<string>(String(viewport.yMin ?? -1));
  const [yMax, setYMax] = useState<string>(String(viewport.yMax ?? 1));
  const [zMin, setZMin] = useState<string>(String(viewport.zMin ?? -1));
  const [zMax, setZMax] = useState<string>(String(viewport.zMax ?? 1));

  useEffect(() => {
    if (isOpen) {
      setXMin(String(viewport.xMin ?? -1));
      setXMax(String(viewport.xMax ?? 1));
      setYMin(String(viewport.yMin ?? -1));
      setYMax(String(viewport.yMax ?? 1));
      setZMin(String(viewport.zMin ?? -1));
      setZMax(String(viewport.zMax ?? 1));
    }
  }, [isOpen, viewport]);

  if (!isOpen) return null;

  const handleApply = () => {
    const numXMin = parseFloat(xMin);
    const numXMax = parseFloat(xMax);
    const numYMin = parseFloat(yMin);
    const numYMax = parseFloat(yMax);
    const numZMin = parseFloat(zMin);
    const numZMax = parseFloat(zMax);

    if (
      isNaN(numXMin) ||
      isNaN(numXMax) ||
      isNaN(numYMin) ||
      isNaN(numYMax) ||
      isNaN(numZMin) ||
      isNaN(numZMax)
    ) {
      return;
    }

    if (numXMin >= numXMax || numYMin >= numYMax || numZMin >= numZMax) {
      return;
    }

    // Adapt zoom to keep 3D volume well framed
    const maxSpan = Math.max(numXMax - numXMin, numYMax - numYMin, numZMax - numZMin);
    const targetZoom = Math.max(15, Math.min(180, 240 / maxSpan));

    onChange({
      ...viewport,
      xMin: numXMin,
      xMax: numXMax,
      yMin: numYMin,
      yMax: numYMax,
      zMin: numZMin,
      zMax: numZMax,
      zoom: targetZoom,
    });
    onClose();
  };

  const handleSetPreset = (minVal: number, maxVal: number) => {
    setXMin(String(minVal));
    setXMax(String(maxVal));
    setYMin(String(minVal));
    setYMax(String(maxVal));
    setZMin(String(minVal));
    setZMax(String(maxVal));

    const maxSpan = maxVal - minVal;
    const targetZoom = Math.max(15, Math.min(180, 240 / maxSpan));

    onChange({
      ...viewport,
      xMin: minVal,
      xMax: maxVal,
      yMin: minVal,
      yMax: maxVal,
      zMin: minVal,
      zMax: maxVal,
      zoom: targetZoom,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm box-border border shadow-2xl rounded-none p-4 sm:p-5 overflow-y-auto max-h-[90vh] ${
          isLight ? 'bg-white text-black border-neutral-300' : 'bg-black text-white border-neutral-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b ${
          isLight ? 'border-neutral-200' : 'border-neutral-800'
        }`}>
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#6042a6]" />
            <h3 className="font-semibold text-sm">3D Graph Bounds</h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 transition-colors rounded-none ${
              isLight ? 'text-neutral-500 hover:text-black' : 'text-neutral-400 hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Range Presets */}
        <div className={`py-3 border-b ${
          isLight ? 'border-neutral-200' : 'border-neutral-800'
        }`}>
          <label className={`block text-[11px] font-mono mb-1.5 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
            Quick Presets:
          </label>
          <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
            <button
              onClick={() => handleSetPreset(-1, 1)}
              className="px-1.5 py-1 bg-[#00693E] text-white font-bold rounded-none hover:brightness-110 transition-colors text-center text-[11px] truncate"
              title="Default: -1 ≤ x,y,z ≤ 1"
            >
              [-1, 1]
            </button>
            <button
              onClick={() => handleSetPreset(-2, 2)}
              className={`px-1.5 py-1 border rounded-none text-center text-[11px] truncate transition-colors ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
              }`}
            >
              [-2, 2]
            </button>
            <button
              onClick={() => handleSetPreset(-3, 3)}
              className={`px-1.5 py-1 border rounded-none text-center text-[11px] truncate transition-colors ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
              }`}
            >
              [-3, 3]
            </button>
            <button
              onClick={() => handleSetPreset(-5, 5)}
              className={`px-1.5 py-1 border rounded-none text-center text-[11px] truncate transition-colors ${
                isLight
                  ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                  : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
              }`}
            >
              [-5, 5]
            </button>
          </div>
        </div>

        {/* Bounds Inputs Form */}
        <div className="py-3 space-y-3 font-mono text-xs">
          {/* X Bounds */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#c84442]">X Axis Bounds:</span>
              <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {xMin} ≤ x ≤ {xMax}
              </span>
            </div>
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <input
                type="number"
                step="any"
                value={xMin}
                onChange={(e) => setXMin(e.target.value)}
                className={`flex-1 min-w-0 w-0 px-2 py-1 border rounded-none text-center text-xs outline-none box-border ${
                  isLight
                    ? 'bg-white border-neutral-300 focus:border-[#c84442]'
                    : 'bg-neutral-900 border-neutral-700 focus:border-[#c84442]'
                }`}
                placeholder="xMin"
              />
              <span className={`shrink-0 text-[11px] ${isLight ? 'text-neutral-400' : 'text-neutral-600'}`}>≤ x ≤</span>
              <input
                type="number"
                step="any"
                value={xMax}
                onChange={(e) => setXMax(e.target.value)}
                className={`flex-1 min-w-0 w-0 px-2 py-1 border rounded-none text-center text-xs outline-none box-border ${
                  isLight
                    ? 'bg-white border-neutral-300 focus:border-[#c84442]'
                    : 'bg-neutral-900 border-neutral-700 focus:border-[#c84442]'
                }`}
                placeholder="xMax"
              />
            </div>
          </div>

          {/* Y Bounds */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#00693E]">Y Axis Bounds:</span>
              <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {yMin} ≤ y ≤ {yMax}
              </span>
            </div>
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <input
                type="number"
                step="any"
                value={yMin}
                onChange={(e) => setYMin(e.target.value)}
                className={`flex-1 min-w-0 w-0 px-2 py-1 border rounded-none text-center text-xs outline-none box-border ${
                  isLight
                    ? 'bg-white border-neutral-300 focus:border-[#00693E]'
                    : 'bg-neutral-900 border-neutral-700 focus:border-[#00693E]'
                }`}
                placeholder="yMin"
              />
              <span className={`shrink-0 text-[11px] ${isLight ? 'text-neutral-400' : 'text-neutral-600'}`}>≤ y ≤</span>
              <input
                type="number"
                step="any"
                value={yMax}
                onChange={(e) => setYMax(e.target.value)}
                className={`flex-1 min-w-0 w-0 px-2 py-1 border rounded-none text-center text-xs outline-none box-border ${
                  isLight
                    ? 'bg-white border-neutral-300 focus:border-[#00693E]'
                    : 'bg-neutral-900 border-neutral-700 focus:border-[#00693E]'
                }`}
                placeholder="yMax"
              />
            </div>
          </div>

          {/* Z Bounds */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-[#2d6fb4]">Z Axis Bounds:</span>
              <span className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                {zMin} ≤ z ≤ {zMax}
              </span>
            </div>
            <div className="flex items-center gap-1.5 w-full min-w-0">
              <input
                type="number"
                step="any"
                value={zMin}
                onChange={(e) => setZMin(e.target.value)}
                className={`flex-1 min-w-0 w-0 px-2 py-1 border rounded-none text-center text-xs outline-none box-border ${
                  isLight
                    ? 'bg-white border-neutral-300 focus:border-[#2d6fb4]'
                    : 'bg-neutral-900 border-neutral-700 focus:border-[#2d6fb4]'
                }`}
                placeholder="zMin"
              />
              <span className={`shrink-0 text-[11px] ${isLight ? 'text-neutral-400' : 'text-neutral-600'}`}>≤ z ≤</span>
              <input
                type="number"
                step="any"
                value={zMax}
                onChange={(e) => setZMax(e.target.value)}
                className={`flex-1 min-w-0 w-0 px-2 py-1 border rounded-none text-center text-xs outline-none box-border ${
                  isLight
                    ? 'bg-white border-neutral-300 focus:border-[#2d6fb4]'
                    : 'bg-neutral-900 border-neutral-700 focus:border-[#2d6fb4]'
                }`}
                placeholder="zMax"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className={`pt-3 border-t flex items-center justify-between gap-2 ${
          isLight ? 'border-neutral-200' : 'border-neutral-800'
        }`}>
          <button
            onClick={() => handleSetPreset(-1, 1)}
            className={`px-2.5 py-1.5 border text-xs font-mono flex items-center gap-1 transition-colors rounded-none ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset [-1, 1]</span>
          </button>

          <button
            onClick={handleApply}
            className="px-3.5 py-1.5 bg-[#00693E] hover:brightness-110 text-white font-semibold text-xs flex items-center gap-1 rounded-none shadow-sm transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Apply Bounds</span>
          </button>
        </div>
      </div>
    </div>
  );
};
