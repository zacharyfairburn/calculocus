import React, { useState, useRef, useEffect } from 'react';
import {
  MathItem,
  Viewport2D,
  Viewport3D,
  CriticalPoint,
  ExpressionType,
  ThemeMode,
  DataTable,
} from './types';
import { GraphCanvas2D, AnalysisOverlayData, AnalysisFeaturePoint, AnalysisFeatureLine } from './components/GraphCanvas2D';
import { SurfaceCanvas3D } from './components/SurfaceCanvas3D';
import { MathKeyboard } from './components/MathKeyboard';
import { ExpressionList } from './components/ExpressionList';
import { CASInspector } from './components/CASInspector';
import { MatrixVectorInspector } from './components/MatrixVectorInspector';
import { CalculusAnalyzer } from './components/CalculusAnalyzer';
import { AnalysisInspector } from './components/AnalysisInspector';
import { TableView } from './components/TableView';
import { ScratchpadCalculator, CalcHistoryItem } from './components/ScratchpadCalculator';
import { BoundsModal3D } from './components/BoundsModal3D';
import { ExportPreviewModal } from './components/ExportPreviewModal';
import { exportGraphToPNG, isIOSDevice, ExportResult } from './utils/exportGraph';
import { Parser } from './engine/parser';
import { evaluateAST, astToLatex } from './engine/ast';
import { NumericalSolvers } from './engine/solvers';
import { CurveAnalyzer } from './engine/analyzer';
import { splitFormulaAndDomain, cleanFormula } from './engine/domain';
import { Complex, evaluateComplexAST, preprocessAngleNotation } from './engine/complex';
import {
  Activity,
  Layers,
  Box,
  Keyboard as KeyboardIcon,
  BrainCircuit,
  Grid3X3,
  Table as TableIcon,
  X,
  CornerDownLeft,
  Trash2,
  Calculator as CalcIcon,
  Plus,
  Minus,
  RotateCcw,
  ChevronDown,
  Circle,
  Compass,
  GitCommit,
  Sun,
  Moon,
  Sliders,
  Download,
  Check,
  Share2,
  Undo2,
  Redo2,
} from 'lucide-react';

export type ActivePanelType = 'none' | 'calculate' | 'functions' | 'calculus' | 'analysis' | 'table' | 'cas' | 'matrix';

export type ExtendedInputMode = ExpressionType | 'calculate';

interface ModeOption {
  id: ExtendedInputMode;
  label: string;
  prefix: string;
  desc: string;
  icon: React.ReactNode;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    id: 'cartesian',
    label: 'Cartesian 2D',
    prefix: 'f(x)=',
    desc: 'Explicit function y = f(x)',
    icon: <span className="font-serif italic font-bold text-[#00693E]">f(x)</span>,
  },
  {
    id: 'implicit',
    label: 'Conic / Relation',
    prefix: 'Rel:',
    desc: 'Implicit relation & conics (Circle, Ellipse, Hyperbola)',
    icon: <Circle className="w-3.5 h-3.5 text-[#2d6fb4]" />,
  },
  {
    id: 'surface3d',
    label: '3D Surface',
    prefix: 'z=',
    desc: 'Two-variable surface z = f(x, y)',
    icon: <Box className="w-3.5 h-3.5 text-[#6042a6]" />,
  },
  {
    id: 'polar',
    label: 'Polar Curve',
    prefix: 'r(θ)=',
    desc: 'Polar equation r = f(θ)',
    icon: <Compass className="w-3.5 h-3.5 text-[#fa7d19]" />,
  },
  {
    id: 'complex',
    label: 'Complex / Phasor',
    prefix: 'z=',
    desc: 'Complex number or function z = a + bi or r ∠ θ',
    icon: <span className="font-serif font-bold text-[#fa7d19] text-xs">z</span>,
  },
  {
    id: 'parametric',
    label: 'Parametric',
    prefix: 'x(t),y(t)',
    desc: 'Parametric curve system with simulation',
    icon: <GitCommit className="w-3.5 h-3.5 text-[#c84442]" />,
  },
  {
    id: 'series',
    label: 'Series / Sequence',
    prefix: '∑',
    desc: 'Series partial sums S_N(x) and discrete sequences',
    icon: <span className="font-serif font-bold text-[#6042a6]">∑</span>,
  },
  {
    id: 'calculate',
    label: 'Scratchpad Calc',
    prefix: 'Calc:',
    desc: 'Numeric & exact calculation',
    icon: <CalcIcon className="w-3.5 h-3.5 text-[#00693E]" />,
  },
];

function toFraction(val: number): string | null {
  if (Number.isInteger(val)) return null;
  const tolerance = 1.0e-6;
  let h1 = 1,
    h2 = 0,
    k1 = 0,
    k2 = 1;
  let b = Math.abs(val);
  do {
    const a = Math.floor(b);
    let aux = h1;
    h1 = a * h1 + h2;
    h2 = aux;
    aux = k1;
    k1 = a * k1 + k2;
    k2 = aux;
    b = 1 / (b - a);
  } while (Math.abs(Math.abs(val) - h1 / k1) > Math.abs(val) * tolerance && k1 < 10000);

  if (k1 > 1 && k1 < 10000) {
    const sign = val < 0 ? '-' : '';
    return `${sign}\\frac{${h1}}{${k1}}`;
  }
  return null;
}

export default function App() {
  // Theme state: dark | light (default: light)
  const [theme, setTheme] = useState<ThemeMode>('light');
  const isLight = theme === 'light';

  // Toggle theme
  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Sync theme class to root
  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  }, [isLight]);

  // Empty start: no predefined functions on launch
  const [items, setItems] = useState<MathItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [currentInputText, setCurrentInputText] = useState<string>('');
  const [inputType, setInputType] = useState<ExpressionType>('cartesian');

  // Interactive prefix selector menu state
  const [isModeMenuOpen, setIsModeMenuOpen] = useState<boolean>(false);
  const modeMenuRef = useRef<HTMLDivElement | null>(null);

  // Angle Mode: RAD or DEG
  const [angleMode, setAngleMode] = useState<'RAD' | 'DEG'>('RAD');

  // Scratchpad history - strictly 0 examples at startup
  const [calcHistory, setCalcHistory] = useState<CalcHistoryItem[]>([]);

  // 2D & 3D Viewport States
  const [viewport2D, setViewport2D] = useState<Viewport2D>({
    xMin: -6,
    xMax: 6,
    yMin: -4,
    yMax: 4,
  });

  const [viewport3D, setViewport3D] = useState<Viewport3D>({
    xMin: -1,
    xMax: 1,
    yMin: -1,
    yMax: 1,
    zMin: -1,
    zMax: 1,
    rotX: 0.6,
    rotY: 0.8,
    zoom: 120,
    wireframe: false,
  });

  const [isBoundsModalOpen, setIsBoundsModalOpen] = useState<boolean>(false);
  const [isContourMode, setIsContourMode] = useState<boolean>(false);
  const [dataTables, setDataTables] = useState<DataTable[]>([]);
  const [is3DMode, setIs3DMode] = useState<boolean>(false);
  const [coordinateMode2D, setCoordinateMode2D] = useState<'cartesian' | 'polar'>('cartesian');

  interface UndoRedoSnapshot {
    items: MathItem[];
    dataTables: DataTable[];
    viewport2D: Viewport2D;
    viewport3D: Viewport3D;
    is3DMode: boolean;
    coordinateMode2D: 'cartesian' | 'polar';
    isContourMode: boolean;
  }

  // Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState<UndoRedoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<UndoRedoSnapshot[]>([]);
  const lastInputPushTime = useRef<number>(0);
  const lastPushedText = useRef<string>('');
  const lastPushTime = useRef<number>(0);

  const getSnapshot = (): UndoRedoSnapshot => ({
    items: JSON.parse(JSON.stringify(items)),
    dataTables: JSON.parse(JSON.stringify(dataTables)),
    viewport2D: { ...viewport2D },
    viewport3D: { ...viewport3D },
    is3DMode,
    coordinateMode2D,
    isContourMode,
  });

  const pushHistory = () => {
    setUndoStack((prev) => {
      const next = [...prev, getSnapshot()];
      if (next.length > 50) {
        next.shift();
      }
      return next;
    });
    setRedoStack([]);
  };

  const handleInteractionStart = () => {
    const now = Date.now();
    if (now - lastPushTime.current > 800) {
      pushHistory();
      lastPushTime.current = now;
    }
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;

    const currentSnapshot = getSnapshot();
    const previousSnapshot = undoStack[undoStack.length - 1];

    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, currentSnapshot]);

    restoreSnapshot(previousSnapshot);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;

    const currentSnapshot = getSnapshot();
    const nextSnapshot = redoStack[redoStack.length - 1];

    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, currentSnapshot]);

    restoreSnapshot(nextSnapshot);
  };

  const restoreSnapshot = (snapshot: UndoRedoSnapshot) => {
    setItems(snapshot.items);
    setDataTables(snapshot.dataTables);
    setViewport2D(snapshot.viewport2D);
    setViewport3D(snapshot.viewport3D);
    setIs3DMode(snapshot.is3DMode);
    setCoordinateMode2D(snapshot.coordinateMode2D);
    setIsContourMode(snapshot.isContourMode);
  };

  // Setup Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? e.metaKey : e.ctrlKey;

      if (modifier && e.key.toLowerCase() === 'z') {
        const active = document.activeElement;
        const isInputField = active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
        if (isInputField && !e.shiftKey) {
          // Let native undo handle it first if typing, but if they want global, prevent default and trigger
          // We will always allow our global CAS/Graph undo/redo stack!
        }
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((modifier && e.key.toLowerCase() === 'y') || (modifier && e.shiftKey && e.key.toLowerCase() === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [undoStack, redoStack, items, dataTables, viewport2D, viewport3D, is3DMode, coordinateMode2D, isContourMode]);

  const handleUpdateDataTables = (newTables: DataTable[] | ((prev: DataTable[]) => DataTable[])) => {
    pushHistory();
    setDataTables(newTables);
  };

  const handleAddRegressionToGraph = (expression: string, label: string, color: string) => {
    pushHistory();
    const newId = `reg_${Date.now()}`;
    const newItem: MathItem = {
      id: newId,
      rawInput: expression,
      type: 'cartesian',
      color: color || '#00693E',
      visible: true,
      label,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newId);
  };

  // Active Menu / Panel state (Graph and Panels stay side-by-side in locked horizontal orientation)
  const [activePanel, setActivePanel] = useState<ActivePanelType>('none');
  const [isKeyboardOpen, setIsKeyboardOpen] = useState<boolean>(false);

  // PNG Export State & Handler (Fully compatible with iOS Safari & Photos library)
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success'>('idle');
  const [exportModalState, setExportModalState] = useState<{
    isOpen: boolean;
    dataUrl: string;
    blob: Blob | null;
    filename: string;
    width: number;
    height: number;
  }>({
    isOpen: false,
    dataUrl: '',
    blob: null,
    filename: '',
    width: 0,
    height: 0,
  });

  const handleExportPNG = async () => {
    try {
      setExportStatus('exporting');
      const canvas =
        (document.getElementById(is3DMode ? 'graph-3d-canvas' : 'graph-2d-canvas') as HTMLCanvasElement | null) ||
        (document.querySelector('#graph-canvas-container canvas, #surface-3d-container canvas') as HTMLCanvasElement | null) ||
        (document.querySelector('canvas') as HTMLCanvasElement | null);

      if (!canvas) {
        setExportStatus('idle');
        return;
      }

      const isIOS = isIOSDevice();
      const result: ExportResult = await exportGraphToPNG(canvas, is3DMode, true);

      setExportStatus('success');
      setTimeout(() => setExportStatus('idle'), 2500);

      // On iOS devices or if Web Share was not triggered, open preview modal for direct photo saving & touch-hold options
      if (isIOS || !result.downloadTriggered) {
        setExportModalState({
          isOpen: true,
          dataUrl: result.dataUrl,
          blob: result.blob,
          filename: result.filename,
          width: result.width,
          height: result.height,
        });
      }
    } catch (err) {
      console.error('Export PNG failed:', err);
      setExportStatus('idle');
    }
  };

  // Calculus Tangent, Integral & Trace states
  const [showTangentAtX, setShowTangentAtX] = useState<number | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<CriticalPoint | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);

  // Close mode menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    if (isModeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isModeMenuOpen]);

  // Compute critical points for selected or first cartesian function
  const activeItem = items.find((it) => it.id === selectedItemId) || items[0];
  const criticalPoints: CriticalPoint[] = [];

  if (activeItem && activeItem.type === 'cartesian' && activeItem.rawInput.trim()) {
    try {
      const { formula } = splitFormulaAndDomain(activeItem.rawInput);
      const ast = Parser.parse(cleanFormula(formula));
      const pts = NumericalSolvers.findCriticalPoints(ast, viewport2D.xMin, viewport2D.xMax);
      criticalPoints.push(...pts);
    } catch {
      // Ignore parse failure in critical points
    }
  }

  // Intersections across all cartesian curves
  const cartesianItems = items.filter((it) => it.visible && it.type === 'cartesian' && it.rawInput.trim());
  if (cartesianItems.length > 1) {
    for (let i = 0; i < cartesianItems.length; i++) {
      for (let j = i + 1; j < cartesianItems.length; j++) {
        try {
          const ast1 = Parser.parse(cleanFormula(splitFormulaAndDomain(cartesianItems[i].rawInput).formula));
          const ast2 = Parser.parse(cleanFormula(splitFormulaAndDomain(cartesianItems[j].rawInput).formula));
          const inters = NumericalSolvers.findIntersections(
            ast1,
            ast2,
            viewport2D.xMin,
            viewport2D.xMax
          );
          inters.forEach((pt) => {
            criticalPoints.push({
              x: pt.x,
              y: pt.y,
              type: 'intersection',
              label: pt.label,
            });
          });
        } catch {
          // Ignore
        }
      }
    }
  }

  // Geometric & Conic Analysis Overlay for Canvas (Foci, Directrix, Center, Asymptotes)
  const analysisOverlay: AnalysisOverlayData | null = React.useMemo(() => {
    if (!activeItem || !activeItem.rawInput.trim()) return null;
    const analysis = CurveAnalyzer.analyze(activeItem.rawInput);
    const points: AnalysisFeaturePoint[] = [];
    const lines: AnalysisFeatureLine[] = [];

    if (analysis.conic) {
      const c = analysis.conic;
      if (c.center) {
        points.push({
          x: c.center.x,
          y: c.center.y,
          label: `Center: (${c.center.x.toFixed(2)}, ${c.center.y.toFixed(2)})`,
          type: 'center',
        });
      }
      if (c.foci) {
        c.foci.forEach((f, idx) => {
          points.push({
            x: f.x,
            y: f.y,
            label: `Focus F${idx + 1}: (${f.x.toFixed(2)}, ${f.y.toFixed(2)})`,
            type: 'focus',
          });
        });
      }
      if (c.vertices) {
        c.vertices.forEach((v, idx) => {
          points.push({
            x: v.x,
            y: v.y,
            label: `Vertex V${idx + 1}: (${v.x.toFixed(2)}, ${v.y.toFixed(2)})`,
            type: 'vertex',
          });
        });
      }
      if (c.coVertices) {
        c.coVertices.forEach((cv, idx) => {
          points.push({
            x: cv.x,
            y: cv.y,
            label: `Co-Vertex B${idx + 1}: (${cv.x.toFixed(2)}, ${cv.y.toFixed(2)})`,
            type: 'co-vertex',
          });
        });
      }
      if (c.directrices) {
        c.directrices.forEach((d) => {
          if (d.type === 'vertical' && d.val !== undefined) {
            lines.push({
              type: 'vertical',
              x: d.val,
              label: `Directrix ${d.equation}`,
              color: '#c84442',
            });
          } else if (d.type === 'horizontal' && d.val !== undefined) {
            lines.push({
              type: 'horizontal',
              y: d.val,
              label: `Directrix ${d.equation}`,
              color: '#c84442',
            });
          } else if (d.m !== undefined && d.b !== undefined) {
            lines.push({
              type: 'slant',
              m: d.m,
              b: d.b,
              label: `Directrix ${d.equation}`,
              color: '#c84442',
            });
          }
        });
      }
    }

    if (analysis.yIntercept) {
      points.push({
        x: analysis.yIntercept.x,
        y: analysis.yIntercept.y,
        label: `Y-Intercept: (0.00, ${analysis.yIntercept.y.toFixed(2)})`,
        type: 'intercept',
      });
    }

    if (analysis.asymptotes) {
      analysis.asymptotes.vertical.forEach((v) => {
        lines.push({
          type: 'vertical',
          x: v.x,
          label: v.label || `Asymptote x = ${v.x.toFixed(2)}`,
          color: '#c84442',
        });
      });
      analysis.asymptotes.horizontal.forEach((h) => {
        lines.push({
          type: 'horizontal',
          y: h.y,
          label: h.label || `Asymptote y = ${h.y.toFixed(2)}`,
          color: '#2d6fb4',
        });
      });
      analysis.asymptotes.oblique.forEach((obl) => {
        lines.push({
          type: 'slant',
          m: obl.m,
          b: obl.b,
          label: obl.label || `Slant: y = ${obl.m.toFixed(2)}x ${obl.b >= 0 ? '+' : '-'} ${Math.abs(obl.b).toFixed(2)}`,
          color: '#fa7d19',
        });
      });
    }

    return { points, lines };
  }, [activeItem]);

  // Zoom Helpers
  const handleZoom = (factor: number) => {
    pushHistory();
    if (is3DMode) {
      setViewport3D((prev) => ({
        ...prev,
        zoom: Math.max(10, Math.min(250, (prev.zoom || 120) * (1 / factor))),
      }));
    } else {
      const xCenter = (viewport2D.xMin + viewport2D.xMax) / 2;
      const yCenter = (viewport2D.yMin + viewport2D.yMax) / 2;
      const xHalf = ((viewport2D.xMax - viewport2D.xMin) * factor) / 2;
      const yHalf = ((viewport2D.yMax - viewport2D.yMin) * factor) / 2;

      setViewport2D({
        xMin: xCenter - xHalf,
        xMax: xCenter + xHalf,
        yMin: yCenter - yHalf,
        yMax: yCenter + yHalf,
      });
    }
  };

  const handleResetOrigin = () => {
    pushHistory();
    setViewport2D({
      xMin: -6,
      xMax: 6,
      yMin: -4,
      yMax: 4,
    });
    setViewport3D({
      xMin: -1,
      xMax: 1,
      yMin: -1,
      yMax: 1,
      zMin: -1,
      zMax: 1,
      rotX: 0.6,
      rotY: 0.8,
      zoom: 120,
      wireframe: false,
    });
  };

  // Expression Management - No default example strings
  const handleAddItem = (type: ExpressionType = 'cartesian', defaultInput: string = '', extra?: Partial<MathItem>) => {
    pushHistory();
    const newId = `item_${Date.now()}`;
    const palette = ['#00693E', '#2d6fb4', '#fa7d19', '#6042a6', '#c84442'];
    const nextColor = palette[items.length % palette.length];

    const newItem: MathItem = {
      id: newId,
      rawInput: defaultInput,
      type,
      color: nextColor,
      visible: true,
      isDerivativeVisible: false,
      isIntegralVisible: false,
      integralRange: [0, 2],
      parametricX: type === 'parametric' ? (extra?.parametricX || 'cos(t)') : undefined,
      parametricY: type === 'parametric' ? (extra?.parametricY || 'sin(t)') : undefined,
      parametricTMin: type === 'parametric' ? (extra?.parametricTMin ?? 0) : undefined,
      parametricTMax: type === 'parametric' ? (extra?.parametricTMax ?? 6.28) : undefined,
      parametricTCurrent: type === 'parametric' ? (extra?.parametricTCurrent ?? 0) : undefined,
      seriesTerm: type === 'series' ? (extra?.seriesTerm || '((-1)^n * x^(2*n+1))/((2*n+1)!)') : undefined,
      seriesFrom: type === 'series' ? (extra?.seriesFrom ?? 0) : undefined,
      seriesTo: type === 'series' ? (extra?.seriesTo ?? 5) : undefined,
      seriesVar: type === 'series' ? (extra?.seriesVar || 'n') : undefined,
      seriesMode: type === 'series' ? (extra?.seriesMode || 'partial_sum') : undefined,
      ...extra,
    };

    setItems((prev) => [...prev, newItem]);
    setSelectedItemId(newId);
    setCurrentInputText(defaultInput);
    setInputType(type);
    if (type === 'surface3d') {
      setIs3DMode(true);
    } else {
      setIs3DMode(false);
    }
  };

  const handleUpdateItem = (id: string, updates: Partial<MathItem>) => {
    if (updates.rawInput !== undefined) {
      const now = Date.now();
      if (now - lastInputPushTime.current > 1200 || updates.rawInput === '' || lastPushedText.current === '') {
        pushHistory();
        lastInputPushTime.current = now;
        lastPushedText.current = updates.rawInput;
      }
    } else {
      pushHistory();
    }
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...updates } : it)));
  };

  const handleDeleteItem = (id: string) => {
    pushHistory();
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedItemId === id) {
      const remaining = items.filter((it) => it.id !== id);
      setSelectedItemId(remaining.length > 0 ? remaining[0].id : null);
      setCurrentInputText(remaining.length > 0 ? remaining[0].rawInput : '');
    }
  };

  // Perform calculation in Scratchpad Calculator
  const handlePerformCalculation = () => {
    if (!currentInputText.trim()) return;

    try {
      const preprocessed = preprocessAngleNotation(currentInputText);
      const ast = Parser.parse(preprocessed);
      const latexInput = astToLatex(ast);

      // Extract last complex answer if available
      let lastAnsComp = new Complex(0, 0);
      if (calcHistory.length > 0) {
        const lastItem = calcHistory[calcHistory.length - 1];
        if (lastItem.resultComplex) {
          lastAnsComp = new Complex(lastItem.resultComplex.re, lastItem.resultComplex.im);
        } else {
          lastAnsComp = new Complex(lastItem.resultNum, 0);
        }
      }

      // Populate variable context for evaluation
      const ctx: Record<string, Complex> = {
        Ans: lastAnsComp,
        ans: lastAnsComp,
      };

      const resComp = evaluateComplexAST(ast, ctx);

      if (!resComp.isFinite()) {
        throw new Error('Undefined result');
      }

      const formattedRes = resComp.toString(6);

      // Fraction only applies if purely real
      let frac: string | null = null;
      if (resComp.im === 0) {
        frac = toFraction(resComp.re);
      }

      const newItem: CalcHistoryItem = {
        id: Date.now().toString(),
        rawInput: currentInputText,
        latexInput,
        resultNum: resComp.re,
        resultDisplay: formattedRes,
        fractionDisplay: frac || undefined,
        resultComplex: { re: resComp.re, im: resComp.im },
        timestamp: Date.now(),
      };

      setCalcHistory((prev) => [...prev, newItem]);
      setCurrentInputText('');
    } catch {
      // Syntax or evaluation error
    }
  };

  const handleCommitInput = () => {
    if (!currentInputText.trim()) return;

    if (activePanel === 'calculate') {
      handlePerformCalculation();
      return;
    }

    let detectedType = inputType;
    if (
      currentInputText.includes('=') ||
      (currentInputText.includes('x') && currentInputText.includes('y') && !currentInputText.startsWith('z'))
    ) {
      detectedType = 'implicit';
    }

    if (selectedItemId) {
      handleUpdateItem(selectedItemId, { rawInput: currentInputText.trim(), type: detectedType });
    } else {
      handleAddItem(detectedType, currentInputText.trim());
    }
  };

  const handleSelectMode = (mode: ExtendedInputMode) => {
    setIsModeMenuOpen(false);

    if (mode === 'calculate') {
      setActivePanel('calculate');
      return;
    }

    setInputType(mode);

    if (mode === 'surface3d') {
      setIs3DMode(true);
    } else {
      setIs3DMode(false);
    }

    if (selectedItemId) {
      handleUpdateItem(selectedItemId, { type: mode });
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleKeyboardInsert = (text: string) => {
    setCurrentInputText((prev) => prev + text);
    if (selectedItemId && activePanel !== 'calculate') {
      handleUpdateItem(selectedItemId, { rawInput: currentInputText + text });
    }
  };

  const handleKeyboardBackspace = () => {
    setCurrentInputText((prev) => {
      const next = prev.slice(0, -1);
      if (selectedItemId && activePanel !== 'calculate') {
        handleUpdateItem(selectedItemId, { rawInput: next });
      }
      return next;
    });
  };

  const handleKeyboardClear = () => {
    setCurrentInputText('');
    if (selectedItemId && activePanel !== 'calculate') {
      handleUpdateItem(selectedItemId, { rawInput: '' });
    }
  };

  const handleClearAll = () => {
    pushHistory();
    setItems([]);
    setSelectedItemId(null);
    setCurrentInputText('');
    setShowTangentAtX(null);
    setActivePanel('none');
  };

  const handleJumpToPoint = (x: number, y: number) => {
    pushHistory();
    const xSpan = (viewport2D.xMax - viewport2D.xMin) / 2;
    const ySpan = (viewport2D.yMax - viewport2D.yMin) / 2;
    setViewport2D({
      xMin: x - xSpan,
      xMax: x + xSpan,
      yMin: y - ySpan,
      yMax: y + ySpan,
    });
  };

  const togglePanel = (panel: ActivePanelType) => {
    setActivePanel((curr) => (curr === panel ? 'none' : panel));
  };

  // Determine current badge prefix & label
  const currentPrefixDisplay =
    activePanel === 'calculate'
      ? 'Calc:'
      : inputType === 'cartesian'
      ? 'f(x)='
      : inputType === 'implicit'
      ? 'Rel:'
      : inputType === 'polar'
      ? 'r(θ)='
      : inputType === 'parametric'
      ? 'x(t),y(t)'
      : inputType === 'series'
      ? '∑'
      : 'z=';

  return (
    <div
      className={`fixed inset-0 w-screen h-[100dvh] overflow-hidden select-none font-sans flex flex-col ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* 
        LOCKED HORIZONTAL WORKBENCH:
        The layout is firmly locked in a horizontal side-by-side arrangement (flex-row).
        Left side: Interactive 2D/3D Graph Canvas.
        Right side: Docked Analysis / Calculation Panel.
      */}
      <div className="relative flex-1 min-h-0 w-full flex flex-row overflow-hidden">
        {/* GRAPH VIEWPORT (Always active and visible in horizontal layout) */}
        <div
          className={`relative flex-1 min-w-0 h-full overflow-hidden ${
            isLight ? 'bg-white' : 'bg-black'
          }`}
        >
          {/* Floating Top Control Pills - Sharp Corners & No-Overlap Layout */}
          <div className="absolute top-2.5 inset-x-2.5 flex flex-wrap items-center justify-between gap-1.5 pointer-events-none z-30">
            {/* Top-Left Floating Controls: Angle Mode, Export PNG & Stats */}
            <div
              className={`flex items-center gap-1.5 pointer-events-auto px-2 py-1 border shadow-lg rounded-none shrink-0 ${
                isLight
                  ? 'bg-white/95 text-black border-neutral-300'
                  : 'bg-black/90 text-white border-neutral-800'
              }`}
            >
              <button
                onClick={() => setAngleMode((m) => (m === 'RAD' ? 'DEG' : 'RAD'))}
                className="px-2 py-0.5 rounded-none bg-[#00693E] text-white font-mono text-[11px] font-bold transition-colors shadow-sm"
                title="Toggle Angle Mode (Radians / Degrees)"
              >
                {angleMode}
              </button>

              {/* Export Graph Screen as PNG (.png) */}
              <button
                onClick={handleExportPNG}
                className={`px-2 py-0.5 rounded-none text-[11px] font-mono font-semibold flex items-center gap-1 transition-all border ${
                  exportStatus === 'success'
                    ? 'bg-[#00693E] text-white border-[#00693E]'
                    : isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200'
                }`}
                title="Export current 2D or 3D graph display screen as a .png file"
              >
                {exportStatus === 'exporting' ? (
                  <>
                    <span className="w-3 h-3 border-2 border-current border-t-transparent animate-spin inline-block" />
                    <span>Exporting...</span>
                  </>
                ) : exportStatus === 'success' ? (
                  <>
                    <Check className="w-3 h-3 text-white" />
                    <span>Exported .PNG</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3 h-3 text-[#00693E]" />
                    <span>Export .PNG</span>
                  </>
                )}
              </button>

              <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />

              {/* Undo Button */}
              <button
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                className={`p-1 rounded-none transition-all border ${
                  undoStack.length === 0
                    ? 'opacity-30 cursor-not-allowed border-transparent text-neutral-400'
                    : isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 font-bold hover:shadow-sm'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200 font-bold hover:shadow-sm'
                }`}
                title="Undo last action (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>

              {/* Redo Button */}
              <button
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                className={`p-1 rounded-none transition-all border ${
                  redoStack.length === 0
                    ? 'opacity-30 cursor-not-allowed border-transparent text-neutral-400'
                    : isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-neutral-800 font-bold hover:shadow-sm'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-200 font-bold hover:shadow-sm'
                }`}
                title="Redo action (Ctrl+Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>

              <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />

              <span className={`text-[11px] font-mono px-1 ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                {is3DMode ? '3D Surface' : `${items.length} Curves`}
              </span>
            </div>

            {/* Top-Right Floating Controls: Light/Dark Switcher, 2D/3D, Bounds, Navigation & Clear */}
            <div
              className={`flex flex-wrap items-center gap-1 pointer-events-auto p-1 border shadow-lg rounded-none shrink-0 ${
                isLight
                  ? 'bg-white/95 text-black border-neutral-300'
                  : 'bg-black/90 text-white border-neutral-800'
              }`}
            >
              {/* Light / Dark Mode Toggle Icon */}
              <button
                onClick={toggleTheme}
                className={`p-1.5 rounded-none transition-colors border ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-[#fa7d19]'
                }`}
                title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              >
                {isLight ? <Moon className="w-3.5 h-3.5 text-neutral-800" /> : <Sun className="w-3.5 h-3.5" />}
              </button>

              <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />

              <button
                onClick={() => setIs3DMode(!is3DMode)}
                className={`px-2 py-1 rounded-none font-semibold text-[11px] flex items-center gap-1 transition-all ${
                  is3DMode
                    ? 'bg-[#6042a6] text-white shadow-sm'
                    : isLight
                    ? 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                    : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
                title="Toggle 2D / 3D Mode"
              >
                <Box className="w-3.5 h-3.5" />
                <span>{is3DMode ? '3D' : '2D'}</span>
              </button>

              {!is3DMode && (
                <>
                  <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />
                  <button
                    onClick={() => setCoordinateMode2D((m) => (m === 'cartesian' ? 'polar' : 'cartesian'))}
                    className={`px-2 py-1 rounded-none text-[11px] font-mono flex items-center gap-1.5 transition-all border ${
                      coordinateMode2D === 'polar'
                        ? 'bg-[#2d6fb4] text-white border-[#2d6fb4] shadow-sm font-semibold'
                        : isLight
                        ? 'bg-neutral-100/80 text-neutral-800 border-neutral-300 hover:bg-neutral-200'
                        : 'bg-neutral-900 text-neutral-200 border-neutral-700 hover:bg-neutral-800'
                    }`}
                    title={
                      coordinateMode2D === 'polar'
                        ? 'Active: Polar Coordinates (r, θ). Click to switch to Cartesian (x, y).'
                        : 'Active: Cartesian Coordinates (x, y). Click to switch to Polar (r, θ).'
                    }
                  >
                    <Compass className={`w-3.5 h-3.5 ${coordinateMode2D === 'polar' ? 'text-white' : 'text-[#2d6fb4]'}`} />
                    <span>{coordinateMode2D === 'polar' ? 'Polar' : 'Cartesian'}</span>
                  </button>
                </>
              )}

              {is3DMode && (
                <>
                  <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />
                  <button
                    onClick={() =>
                      setViewport3D((prev) => ({ ...prev, wireframe: !prev.wireframe }))
                    }
                    className={`px-1.5 py-1 rounded-none text-[11px] font-mono flex items-center gap-1 transition-all ${
                      viewport3D.wireframe
                        ? 'bg-[#00693E] text-white'
                        : isLight
                        ? 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                    }`}
                    title="Toggle Wireframe Mesh"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Wire</span>
                  </button>

                  <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />
                  <button
                    onClick={() => setIsBoundsModalOpen(true)}
                    className={`px-1.5 py-1 rounded-none text-[11px] font-mono flex items-center gap-1 transition-all ${
                      isBoundsModalOpen
                        ? 'bg-[#6042a6] text-white'
                        : isLight
                        ? 'text-neutral-700 hover:text-black hover:bg-neutral-100'
                        : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                    }`}
                    title="Adjust 3D Graph Bounds (-1≤x,y,z≤1)"
                  >
                    <Sliders className={`w-3.5 h-3.5 ${isBoundsModalOpen ? 'text-white' : 'text-[#6042a6]'}`} />
                    <span>Bounds</span>
                  </button>
                </>
              )}

              <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />

              <button
                onClick={() => handleZoom(0.8)}
                className={`p-1 rounded-none transition-colors ${
                  isLight ? 'text-neutral-700 hover:text-black hover:bg-neutral-100' : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
                title="Zoom In"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => handleZoom(1.25)}
                className={`p-1 rounded-none transition-colors ${
                  isLight ? 'text-neutral-700 hover:text-black hover:bg-neutral-100' : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
                title="Zoom Out"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleResetOrigin}
                className={`p-1 rounded-none transition-colors ${
                  isLight ? 'text-neutral-700 hover:text-black hover:bg-neutral-100' : 'text-neutral-300 hover:text-white hover:bg-neutral-900'
                }`}
                title="Reset Origin (0, 0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {items.length > 0 && (
                <>
                  <span className={`w-px h-3.5 ${isLight ? 'bg-neutral-300' : 'bg-neutral-800'}`} />
                  <button
                    onClick={handleClearAll}
                    className="p-1 text-[#c84442] hover:bg-[#c84442]/10 rounded-none transition-colors"
                    title="Clear All Functions"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Live Canvas */}
          {!is3DMode ? (
            <GraphCanvas2D
              items={items}
              viewport={viewport2D}
              onViewportChange={setViewport2D}
              criticalPoints={criticalPoints}
              hoveredPoint={hoveredPoint}
              onHoverPoint={setHoveredPoint}
              showTangentAtX={showTangentAtX}
              dataTables={dataTables}
              analysisOverlay={analysisOverlay}
              coordinateMode={coordinateMode2D}
              angleMode={angleMode}
              theme={theme}
              onInteractionStart={handleInteractionStart}
            />
          ) : (
            <SurfaceCanvas3D
              items={items}
              viewport={viewport3D}
              onViewportChange={setViewport3D}
              onAddSurface={(expr) => handleAddItem('surface3d', expr)}
              theme={theme}
              isBoundsModalOpen={isBoundsModalOpen}
              onOpenBoundsModal={() => setIsBoundsModalOpen(true)}
              onCloseBoundsModal={() => setIsBoundsModalOpen(false)}
              isContourMode={isContourMode}
              onToggleContourMode={() => setIsContourMode((prev) => !prev)}
              onInteractionStart={handleInteractionStart}
            />
          )}

          {/* 3D Bounds Modal */}
          {is3DMode && (
            <BoundsModal3D
              isOpen={isBoundsModalOpen}
              onClose={() => setIsBoundsModalOpen(false)}
              viewport={viewport3D}
              onChange={setViewport3D}
              theme={theme}
            />
          )}
        </div>

        {/* 
          HORIZONTAL SIDE PANEL:
          Docked side-by-side with exactly ONE canonical header per active section.
        */}
        {activePanel !== 'none' && (
          <div
            id="active-panel-container"
            className={`w-[340px] sm:w-[380px] md:w-[420px] lg:w-[460px] h-full shrink-0 border-l flex flex-col z-20 shadow-2xl overflow-hidden rounded-none ${
              isLight
                ? 'bg-white border-neutral-300 text-black'
                : 'bg-black border-neutral-800 text-white'
            }`}
          >
            {/* Single Canonical Panel Header */}
            <div
              className={`p-2.5 border-b flex items-center justify-between shrink-0 rounded-none ${
                isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
              }`}
            >
              <div className="flex items-center gap-2">
                {activePanel === 'calculate' && <CalcIcon className="w-4 h-4 text-[#00693E]" />}
                {activePanel === 'functions' && <Layers className="w-4 h-4 text-[#2d6fb4]" />}
                {activePanel === 'calculus' && <Activity className="w-4 h-4 text-[#fa7d19]" />}
                {activePanel === 'analysis' && <Compass className="w-4 h-4 text-[#00693E]" />}
                {activePanel === 'table' && <TableIcon className="w-4 h-4 text-[#00693E]" />}
                {activePanel === 'cas' && <BrainCircuit className="w-4 h-4 text-[#6042a6]" />}
                {activePanel === 'matrix' && <Grid3X3 className="w-4 h-4 text-[#00693E]" />}
                <h3 className="text-xs font-bold uppercase tracking-wider">
                  {activePanel === 'calculate' && 'Scratchpad Calculator'}
                  {activePanel === 'functions' && 'Equations & Relations'}
                  {activePanel === 'calculus' && 'Calculus Suite & Tangents'}
                  {activePanel === 'analysis' && 'Graph Analysis & Conic Geometry'}
                  {activePanel === 'table' && 'Data Tables & Statistics Suite'}
                  {activePanel === 'cas' && 'Symbolic CAS Inspector'}
                  {activePanel === 'matrix' && 'Matrix & Vector Suite'}
                </h3>
              </div>
              <button
                onClick={() => setActivePanel('none')}
                className={`p-1 rounded-none transition-colors ${
                  isLight ? 'text-neutral-700 hover:text-black hover:bg-neutral-200' : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
                }`}
                title="Close Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {activePanel === 'calculate' && (
                <ScratchpadCalculator
                  currentInput={currentInputText}
                  onChangeInput={setCurrentInputText}
                  history={calcHistory}
                  onCalculate={handlePerformCalculation}
                  onClearHistory={() => setCalcHistory([])}
                  angleMode={angleMode}
                  onToggleAngleMode={() => setAngleMode((m) => (m === 'RAD' ? 'DEG' : 'RAD'))}
                  theme={theme}
                />
              )}

              {activePanel === 'functions' && (
                <ExpressionList
                  items={items}
                  selectedId={selectedItemId}
                  onSelectItem={(id) => {
                    setSelectedItemId(id);
                    const it = items.find((i) => i.id === id);
                    if (it) {
                      setCurrentInputText(it.rawInput);
                      setInputType(it.type);
                    }
                  }}
                  onUpdateItem={handleUpdateItem}
                  onDeleteItem={handleDeleteItem}
                  onAddItem={handleAddItem}
                  theme={theme}
                />
              )}

              {activePanel === 'calculus' && (
                <CalculusAnalyzer
                  items={items}
                  selectedItemId={selectedItemId}
                  onSelectItem={(id) => {
                    setSelectedItemId(id);
                    const it = items.find((i) => i.id === id);
                    if (it) {
                      setCurrentInputText(it.rawInput);
                      setInputType(it.type);
                    }
                  }}
                  onUpdateItem={handleUpdateItem}
                  onJumpToPoint={handleJumpToPoint}
                  onSetTangentX={setShowTangentAtX}
                  onAddItem={handleAddItem}
                  theme={theme}
                />
              )}

              {activePanel === 'analysis' && (
                <AnalysisInspector
                  items={items}
                  selectedItemId={selectedItemId}
                  onSelectItem={(id) => {
                    setSelectedItemId(id);
                    const it = items.find((i) => i.id === id);
                    if (it) {
                      setCurrentInputText(it.rawInput);
                      setInputType(it.type);
                    }
                  }}
                  onAddItem={handleAddItem}
                  onJumpToPoint={handleJumpToPoint}
                  theme={theme}
                />
              )}

              {activePanel === 'table' && (
                <TableView
                  items={items}
                  selectedItemId={selectedItemId}
                  dataTables={dataTables}
                  onUpdateDataTables={handleUpdateDataTables}
                  onAddRegressionToGraph={handleAddRegressionToGraph}
                  theme={theme}
                />
              )}

              {activePanel === 'cas' && (
                <CASInspector
                  items={items}
                  selectedItemId={selectedItemId}
                  onSelectItem={(id) => {
                    setSelectedItemId(id);
                    const it = items.find((i) => i.id === id);
                    if (it) {
                      setCurrentInputText(it.rawInput);
                      setInputType(it.type);
                    }
                  }}
                  onSelectPoint={handleJumpToPoint}
                  onAddItem={handleAddItem}
                  theme={theme}
                />
              )}

              {activePanel === 'matrix' && (
                <MatrixVectorInspector
                  theme={theme}
                  onAddItem={handleAddItem}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 
        BOTTOM ACTION BAR:
        Equations, Calculate, Calculus Suite, Analysis, Table, CAS, Matrix & Vector - Sharp Buttons
      */}
      <div
        className={`px-2.5 py-1.5 border-t flex items-center justify-between shrink-0 z-30 rounded-none ${
          isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-[calc(100%-48px)] no-scrollbar">
          {/* Equations Manager */}
          <button
            onClick={() => togglePanel('functions')}
            className={`px-2.5 py-1 rounded-none text-xs font-semibold flex items-center gap-1.5 border shrink-0 transition-all ${
              activePanel === 'functions'
                ? 'bg-[#2d6fb4] text-white border-[#2d6fb4] shadow-md'
                : isLight
                ? 'bg-white text-neutral-700 border-neutral-300 hover:text-black hover:bg-neutral-100'
                : 'bg-black text-neutral-300 border-neutral-800 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Equations ({items.length})</span>
          </button>

          {/* Calculate / Scratchpad Button */}
          <button
            onClick={() => togglePanel('calculate')}
            className={`px-2.5 py-1 rounded-none text-xs font-semibold flex items-center gap-1.5 border shrink-0 transition-all ${
              activePanel === 'calculate'
                ? 'bg-[#00693E] text-white border-[#00693E] shadow-md'
                : isLight
                ? 'bg-white text-[#00693E] border-neutral-300 hover:bg-neutral-100 font-bold'
                : 'bg-black text-[#43b082] border-neutral-800 hover:bg-neutral-900 font-bold'
            }`}
          >
            <CalcIcon className="w-3.5 h-3.5" />
            <span>Calculate</span>
          </button>

          {/* Analysis (Foci, Directrix, Eccentricity, Asymptotes, Center) */}
          <button
            onClick={() => togglePanel('analysis')}
            className={`px-2.5 py-1 rounded-none text-xs font-semibold flex items-center gap-1.5 border shrink-0 transition-all ${
              activePanel === 'analysis'
                ? 'bg-[#00693E] text-white border-[#00693E] shadow-md'
                : isLight
                ? 'bg-white text-neutral-700 border-neutral-300 hover:text-[#00693E] hover:bg-neutral-100'
                : 'bg-black text-neutral-300 border-neutral-800 hover:text-[#43b082] hover:bg-neutral-900'
            }`}
            title="Conic & Curve Analysis (Foci, Directrix, Eccentricity, Asymptotes, Center)"
          >
            <Compass className={`w-3.5 h-3.5 ${activePanel === 'analysis' ? 'text-white' : 'text-[#00693E]'}`} />
            <span>Analysis</span>
          </button>

          {/* Calculus Suite */}
          <button
            onClick={() => togglePanel('calculus')}
            className={`px-2.5 py-1 rounded-none text-xs font-semibold flex items-center gap-1.5 border shrink-0 transition-all ${
              activePanel === 'calculus'
                ? 'bg-[#fa7d19] text-white border-[#fa7d19] shadow-md'
                : isLight
                ? 'bg-white text-neutral-700 border-neutral-300 hover:text-[#fa7d19] hover:bg-neutral-100'
                : 'bg-black text-neutral-300 border-neutral-800 hover:text-[#fa7d19] hover:bg-neutral-900'
            }`}
          >
            <Activity className={`w-3.5 h-3.5 ${activePanel === 'calculus' ? 'text-white' : 'text-[#fa7d19]'}`} />
            <span>Calculus</span>
          </button>

          {/* Table of Values & Statistics */}
          <button
            onClick={() => togglePanel('table')}
            className={`px-2.5 py-1 rounded-none text-xs font-semibold flex items-center gap-1.5 border shrink-0 transition-all ${
              activePanel === 'table'
                ? 'bg-[#00693E] text-white border-[#00693E] shadow-md'
                : isLight
                ? 'bg-white text-neutral-700 border-neutral-300 hover:text-black hover:bg-neutral-100'
                : 'bg-black text-neutral-300 border-neutral-800 hover:text-white hover:bg-neutral-900'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Tables & Stats</span>
          </button>

          {/* Symbolic CAS */}
          <button
            onClick={() => togglePanel('cas')}
            className={`px-2 py-1 rounded-none text-xs font-semibold flex items-center gap-1 border shrink-0 transition-all ${
              activePanel === 'cas'
                ? 'bg-[#6042a6] text-white border-[#6042a6] shadow-md'
                : isLight
                ? 'bg-white text-neutral-700 border-neutral-300 hover:text-[#6042a6] hover:bg-neutral-100'
                : 'bg-black text-neutral-300 border-neutral-800 hover:text-[#6042a6] hover:bg-neutral-900'
            }`}
            title="Symbolic CAS Inspector"
          >
            <BrainCircuit className={`w-3.5 h-3.5 ${activePanel === 'cas' ? 'text-white' : 'text-[#6042a6]'}`} />
            <span>CAS</span>
          </button>

          {/* Matrix & Vector Suite */}
          <button
            onClick={() => togglePanel('matrix')}
            className={`px-2 py-1 rounded-none text-xs font-semibold flex items-center gap-1 border shrink-0 transition-all ${
              activePanel === 'matrix'
                ? 'bg-[#00693E] text-white border-[#00693E] shadow-md'
                : isLight
                ? 'bg-white text-neutral-700 border-neutral-300 hover:text-[#00693E] hover:bg-neutral-100'
                : 'bg-black text-neutral-300 border-neutral-800 hover:text-[#43b082] hover:bg-neutral-900'
            }`}
            title="Matrix & Vector Suite (Arithmetic, Row Ops, Det, REF, RREF, Transpose, Vectors)"
          >
            <Grid3X3 className={`w-3.5 h-3.5 ${activePanel === 'matrix' ? 'text-white' : 'text-[#00693E]'}`} />
            <span>Matrix & Vector</span>
          </button>
        </div>

        {/* Keypad Toggle Button */}
        <button
          onClick={() => setIsKeyboardOpen(!isKeyboardOpen)}
          className={`p-1.5 rounded-none border shrink-0 transition-all ${
            isKeyboardOpen
              ? 'bg-[#00693E] text-white border-[#00693E] shadow-md'
              : isLight
              ? 'bg-white text-neutral-700 border-neutral-300 hover:text-black hover:bg-neutral-100'
              : 'bg-black text-neutral-300 border-neutral-800 hover:text-white hover:bg-neutral-900'
          }`}
          title="Toggle Math Keyboard"
        >
          <KeyboardIcon className="w-4 h-4" />
        </button>
      </div>

      {/* MATH FORMULA INPUT BAR WITH CLICKABLE PREFIX SELECTOR */}
      <div
        className={`relative px-2.5 py-1.5 border-t flex items-center gap-2 shrink-0 z-30 rounded-none ${
          isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-950 border-neutral-900'
        }`}
      >
        {/* Floating Expression Type Selector Popover - Sharp Corners */}
        {isModeMenuOpen && (
          <div
            ref={modeMenuRef}
            className={`absolute bottom-full left-2.5 mb-2 w-72 border p-1.5 shadow-2xl z-50 rounded-none ${
              isLight
                ? 'bg-white border-neutral-300 text-black shadow-black/20'
                : 'bg-neutral-950 border-neutral-800 text-white shadow-black/80'
            }`}
          >
            <div className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider border-b mb-1 ${isLight ? 'text-neutral-500 border-neutral-200' : 'text-neutral-400 border-neutral-800'}`}>
              Select Expression Mode
            </div>
            <div className="space-y-0.5">
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleSelectMode(opt.id)}
                  className={`w-full p-2 rounded-none flex items-center gap-2.5 text-left transition-all border ${
                    (opt.id === 'calculate' && activePanel === 'calculate') ||
                    (opt.id !== 'calculate' && inputType === opt.id && activePanel !== 'calculate')
                      ? 'bg-[#00693E]/20 border-[#00693E]/50 font-bold'
                      : isLight
                      ? 'hover:bg-neutral-100 text-black border-transparent'
                      : 'hover:bg-neutral-900 text-neutral-300 border-transparent'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-none border flex items-center justify-center shrink-0 ${isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-black border-neutral-800'}`}>
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">{opt.label}</span>
                      <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-none border ${isLight ? 'bg-neutral-100 border-neutral-300 text-[#00693E]' : 'bg-neutral-900 border-neutral-800 text-[#43b082]'}`}>
                        {opt.prefix}
                      </span>
                    </div>
                    <p className={`text-[10px] truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className={`flex-1 flex items-center px-2.5 py-1.5 border rounded-none focus-within:ring-1 ${
            isLight
              ? 'bg-white border-neutral-300 text-black focus-within:border-[#00693E] focus-within:ring-[#00693E]'
              : 'bg-black border-neutral-800 text-white focus-within:border-[#00693E] focus-within:ring-[#00693E]'
          }`}
        >
          {/* Interactive Clickable Prefix Button (f(x), z, conic, polar, etc.) */}
          <button
            onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
            className={`flex items-center gap-1 font-mono text-xs font-bold px-2 py-0.5 rounded-none border transition-all mr-2 shrink-0 active:scale-95 ${
              isLight
                ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-[#00693E]'
                : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-[#43b082]'
            }`}
            title="Click to swap between f(x), z, conics, polar, etc."
          >
            <span>{currentPrefixDisplay}</span>
            <ChevronDown className="w-3 h-3 opacity-80" />
          </button>

          <input
            ref={inputRef}
            type="text"
            value={currentInputText}
            placeholder={
              activePanel === 'calculate'
                ? 'Enter calculation...'
                : 'Enter expression...'
            }
            onChange={(e) => {
              setCurrentInputText(e.target.value);
              if (selectedItemId && activePanel !== 'calculate') {
                handleUpdateItem(selectedItemId, { rawInput: e.target.value });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCommitInput();
            }}
            className={`w-full bg-transparent font-mono text-xs outline-none ${
              isLight ? 'text-black placeholder-neutral-400' : 'text-white placeholder-neutral-600'
            }`}
          />
        </div>

        <button
          onClick={handleCommitInput}
          className="p-2 bg-[#00693E] hover:brightness-110 text-white rounded-none shadow-md transition-all active:scale-95 shrink-0"
          title={activePanel === 'calculate' ? 'Calculate' : 'Plot Expression'}
        >
          <CornerDownLeft className="w-4 h-4" />
        </button>
      </div>

      {/* MATH KEYBOARD DRAWER */}
      {isKeyboardOpen && (
        <div className="shrink-0 z-40 max-h-[38vh] overflow-y-auto rounded-none">
          <MathKeyboard
            onInsert={handleKeyboardInsert}
            onBackspace={handleKeyboardBackspace}
            onClear={handleKeyboardClear}
            onEnter={handleCommitInput}
            theme={theme}
          />
        </div>
      )}

      {/* Export Graph Image (.PNG) Modal for iOS & Desktop */}
      <ExportPreviewModal
        isOpen={exportModalState.isOpen}
        onClose={() => setExportModalState((prev) => ({ ...prev, isOpen: false }))}
        dataUrl={exportModalState.dataUrl}
        blob={exportModalState.blob}
        filename={exportModalState.filename}
        width={exportModalState.width}
        height={exportModalState.height}
        is3D={is3DMode}
        theme={theme}
      />
    </div>
  );
}
