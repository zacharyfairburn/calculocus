import React, { useState, useMemo } from 'react';
import { MathItem, DataTable, DataPoint } from '../types';
import { Parser } from '../engine/parser';
import { evaluateAST } from '../engine/ast';
import { SymbolicDifferentiator } from '../engine/differentiator';
import {
  fitLinearRegression,
  fitQuadraticRegression,
  fitCubicRegression,
  fitExponentialRegression,
  fitPowerRegression,
  fitSinusoidalRegression,
  compute2VarStats,
  compute1VarStats,
  nPr,
  nCr,
  factorial,
  doubleFactorial,
  normalPDF,
  normalCDF,
  normalRangeCDF,
  binomialPDF,
  binomialCDF,
  poissonPDF,
  poissonCDF,
  geometricPDF,
  RegressionResult,
} from '../engine/statistics';
import {
  Table as TableIcon,
  Plus,
  Trash2,
  TrendingUp,
  BarChart2,
  Dices,
  Hash,
  Share2,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  FileSpreadsheet,
  Check,
  ScatterChart,
  CircleDot,
  Layers,
  Upload,
  Download,
} from 'lucide-react';

interface TableViewProps {
  items: MathItem[];
  selectedItemId: string | null;
  dataTables: DataTable[];
  onUpdateDataTables: (tables: DataTable[]) => void;
  onAddRegressionToGraph: (expression: string, label: string, color: string) => void;
  theme?: 'dark' | 'light';
}

type MainTableMode = 'custom' | 'function';
type AnalyticsSubTab = 'regression' | 'stats' | 'probability' | 'combinatorics';
type RegressionType = 'linear' | 'quadratic' | 'cubic' | 'exponential' | 'power' | 'sinusoidal';

export const TableView: React.FC<TableViewProps> = ({
  items,
  selectedItemId,
  dataTables,
  onUpdateDataTables,
  onAddRegressionToGraph,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';

  // Mode Selection
  const [mainMode, setMainMode] = useState<MainTableMode>('custom');
  const [activeSubTab, setActiveSubTab] = useState<AnalyticsSubTab>('regression');
  const [selectedRegressionType, setSelectedRegressionType] = useState<RegressionType>('linear');

  // Active custom table selection
  const [activeTableId, setActiveTableId] = useState<string>(
    dataTables.length > 0 ? dataTables[0].id : ''
  );

  // New row input state
  const [newRowX, setNewRowX] = useState<string>('');
  const [newRowY, setNewRowY] = useState<string>('');

  // CSV / Batch Import Modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [pasteContent, setPasteContent] = useState<string>('');
  const [modalTab, setModalTab] = useState<'import' | 'export'>('import');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Function Table configuration
  const [xStart, setXStart] = useState<number>(-5);
  const [xStep, setXStep] = useState<number>(0.5);
  const [rowCount] = useState<number>(25);

  // Combinatorics inputs
  const [combN, setCombN] = useState<number>(5);
  const [combR, setCombR] = useState<number>(2);

  // Probability inputs
  const [probDistType, setProbDistType] = useState<'normal' | 'binomial' | 'poisson' | 'geometric'>('normal');
  const [normMean, setNormMean] = useState<number>(0);
  const [normStd, setNormStd] = useState<number>(1);
  const [normX, setNormX] = useState<number>(1);
  const [normA, setNormA] = useState<number>(-1);
  const [normB, setNormB] = useState<number>(1);

  const [binN, setBinN] = useState<number>(10);
  const [binP, setBinP] = useState<number>(0.5);
  const [binK, setBinK] = useState<number>(5);

  const [poisLambda, setPoisLambda] = useState<number>(3);
  const [poisK, setPoisK] = useState<number>(3);

  const [geomP, setGeomP] = useState<number>(0.2);
  const [geomK, setGeomK] = useState<number>(3);

  // Active custom table
  const activeTable = useMemo(() => {
    return dataTables.find((t) => t.id === activeTableId) || dataTables[0] || null;
  }, [dataTables, activeTableId]);

  // Ensure active table ID is valid
  React.useEffect(() => {
    if (dataTables.length > 0 && (!activeTableId || !dataTables.find((t) => t.id === activeTableId))) {
      setActiveTableId(dataTables[0].id);
    }
  }, [dataTables, activeTableId]);

  // Table Management Handlers
  const handleAddTable = () => {
    const nextNum = dataTables.length + 1;
    const colors = ['#00693E', '#2d6fb4', '#fa7d19', '#6042a6', '#c84442'];
    const newColor = colors[(nextNum - 1) % colors.length];

    const newTbl: DataTable = {
      id: `table_${Date.now()}`,
      name: `Table ${nextNum}`,
      points: [
        { x: 1, y: 2 },
        { x: 2, y: 5 },
        { x: 3, y: 10 },
        { x: 4, y: 17 },
      ],
      color: newColor,
      visible: true,
      showScatter: true,
      connectLines: false,
      pointStyle: 'circle',
    };

    const updated = [...dataTables, newTbl];
    onUpdateDataTables(updated);
    setActiveTableId(newTbl.id);
  };

  const handleUpdateActiveTable = (updates: Partial<DataTable>) => {
    if (!activeTable) return;
    const updated = dataTables.map((t) => (t.id === activeTable.id ? { ...t, ...updates } : t));
    onUpdateDataTables(updated);
  };

  const handleDeleteActiveTable = () => {
    if (dataTables.length <= 1) {
      // Clear points instead of deleting the last table
      handleUpdateActiveTable({ points: [] });
      return;
    }
    const updated = dataTables.filter((t) => t.id !== activeTableId);
    onUpdateDataTables(updated);
    setActiveTableId(updated[0].id);
  };

  const handleAddRow = () => {
    if (!activeTable) return;
    const parsedX = parseFloat(newRowX);
    const parsedY = parseFloat(newRowY);

    if (isNaN(parsedX) || isNaN(parsedY)) {
      // If empty, auto-increment based on last row or start at 1
      const lastX = activeTable.points.length > 0 ? activeTable.points[activeTable.points.length - 1].x : 0;
      const lastY = activeTable.points.length > 0 ? activeTable.points[activeTable.points.length - 1].y : 0;
      const nextPoints = [...activeTable.points, { x: lastX + 1, y: lastY + 1 }];
      handleUpdateActiveTable({ points: nextPoints });
    } else {
      const nextPoints = [...activeTable.points, { x: parsedX, y: parsedY }];
      handleUpdateActiveTable({ points: nextPoints });
      setNewRowX('');
      setNewRowY('');
    }
  };

  const handleCellChange = (rowIndex: number, field: 'x' | 'y', value: string) => {
    if (!activeTable) return;
    const num = parseFloat(value);
    const updatedPoints = activeTable.points.map((pt, idx) => {
      if (idx !== rowIndex) return pt;
      return {
        ...pt,
        [field]: isNaN(num) ? 0 : num,
      };
    });
    handleUpdateActiveTable({ points: updatedPoints });
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (!activeTable) return;
    const updatedPoints = activeTable.points.filter((_, idx) => idx !== rowIndex);
    handleUpdateActiveTable({ points: updatedPoints });
  };

  const handleSortX = (ascending = true) => {
    if (!activeTable) return;
    const sorted = [...activeTable.points].sort((a, b) => (ascending ? a.x - b.x : b.x - a.x));
    handleUpdateActiveTable({ points: sorted });
  };

  const handleClearPoints = () => {
    if (!activeTable) return;
    handleUpdateActiveTable({ points: [] });
  };

  const parseAndSetCSVData = (text: string) => {
    if (!activeTable) return;
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const newPoints: DataPoint[] = [];

    // Identify delimiter: comma, semicolon, space, or tab
    let delimiter = ',';
    if (lines.length > 0) {
      const firstLine = lines[0];
      if (firstLine.includes('\t')) delimiter = '\t';
      else if (firstLine.includes(';')) delimiter = ';';
      else if (!firstLine.includes(',') && firstLine.includes(' ')) delimiter = ' ';
    }

    // Check if the first line is a header
    let startIndex = 0;
    if (lines.length > 0) {
      const firstLineParts = lines[0].split(delimiter).map((p) => p.trim().replace(/['"]/g, '')).filter(Boolean);
      if (firstLineParts.length >= 2) {
        const px = parseFloat(firstLineParts[0]);
        const py = parseFloat(firstLineParts[1]);
        if (isNaN(px) || isNaN(py)) {
          // First row is a header row (non-numeric text)
          startIndex = 1;
        }
      }
    }

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(delimiter).map((p) => p.trim().replace(/['"]/g, '')).filter(Boolean);
      if (parts.length >= 2) {
        const px = parseFloat(parts[0]);
        const py = parseFloat(parts[1]);
        if (!isNaN(px) && !isNaN(py) && isFinite(px) && isFinite(py)) {
          newPoints.push({ x: px, y: py });
        }
      }
    }

    if (newPoints.length > 0) {
      handleUpdateActiveTable({ points: newPoints });
      setIsImportModalOpen(false);
      setPasteContent('');
    } else {
      alert("No valid numerical X, Y coordinate pairs found in the CSV data. Please ensure it has at least 2 columns of numbers.");
    }
  };

  const handleImportData = () => {
    if (!pasteContent.trim()) return;
    parseAndSetCSVData(pasteContent);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        parseAndSetCSVData(text);
      }
    };
    reader.onerror = () => {
      alert("Failed to read the selected file.");
    };
    reader.readAsText(file);
  };

  const handleExportCSV = () => {
    if (!activeTable || activeTable.points.length === 0) return;

    const csvRows = ['x,y'];
    for (const pt of activeTable.points) {
      csvRows.push(`${pt.x},${pt.y}`);
    }
    const csvContent = csvRows.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${activeTable.name.toLowerCase().replace(/\s+/g, '_')}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute Regressions for active table
  const regressionResults = useMemo(() => {
    const pts = activeTable ? activeTable.points : [];
    return {
      linear: fitLinearRegression(pts),
      quadratic: fitQuadraticRegression(pts),
      cubic: fitCubicRegression(pts),
      exponential: fitExponentialRegression(pts),
      power: fitPowerRegression(pts),
      sinusoidal: fitSinusoidalRegression(pts),
    };
  }, [activeTable]);

  const currentRegression: RegressionResult = regressionResults[selectedRegressionType];

  // Helper for clean numbers without box overflow
  const formatStat = (val: number, decimals = 4): string => {
    if (val === undefined || isNaN(val) || !isFinite(val)) return '-';
    if (Math.abs(val) >= 1e9 || (Math.abs(val) < 1e-4 && val !== 0)) {
      return val.toExponential(3);
    }
    return Number(val.toFixed(decimals)).toString();
  };

  // Compute 2-Variable Stats for active table
  const stats2Var = useMemo(() => {
    const pts = activeTable ? activeTable.points : [];
    return compute2VarStats(pts);
  }, [activeTable]);

  // Handle plotting regression to 2D Graph
  const handlePlotRegression = (reg: RegressionResult) => {
    if (!reg.valid || !activeTable) return;
    const label = `${reg.name} (${activeTable.name})`;
    onAddRegressionToGraph(reg.rawExpression, label, activeTable.color);
  };

  // Function Table Generation
  const cartesianItems = items.filter((it) => it.type === 'cartesian');

  const parsedFunctions = useMemo(() => {
    return cartesianItems.map((item, index) => {
      try {
        const ast = Parser.parse(item.rawInput);
        const dAst = SymbolicDifferentiator.diff(ast, 'x');
        return {
          item,
          name: `f${index + 1}(x)`,
          ast,
          dAst,
          valid: true,
        };
      } catch {
        return {
          item,
          name: `f${index + 1}(x)`,
          ast: null,
          dAst: null,
          valid: false,
        };
      }
    });
  }, [cartesianItems]);

  const functionRows = useMemo(() => {
    const rows: Array<{ x: number; values: Array<{ y: number; dy: number; valid: boolean }> }> = [];
    for (let i = 0; i < rowCount; i++) {
      const x = xStart + i * xStep;
      const rowVals = parsedFunctions.map((fn) => {
        if (!fn.valid || !fn.ast) {
          return { y: NaN, dy: NaN, valid: false };
        }
        const y = evaluateAST(fn.ast, { x });
        const dy = fn.dAst ? evaluateAST(fn.dAst, { x }) : NaN;
        return { y, dy, valid: !isNaN(y) && isFinite(y) };
      });
      rows.push({ x, values: rowVals });
    }
    return rows;
  }, [rowCount, xStart, xStep, parsedFunctions]);

  return (
    <div
      className={`flex flex-col h-full select-none overflow-hidden rounded-none ${
        isLight ? 'bg-white text-black' : 'bg-black text-white'
      }`}
    >
      {/* Top Header Mode Toggle: Custom Data Tables vs. Function Table */}
      <div
        className={`px-3 py-2 border-b flex items-center justify-between gap-2 shrink-0 rounded-none ${
          isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
        }`}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMainMode('custom')}
            className={`px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors rounded-none ${
              mainMode === 'custom'
                ? 'bg-[#00693E] text-white shadow-sm'
                : isLight
                ? 'text-neutral-700 hover:bg-neutral-200'
                : 'text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <ScatterChart className="w-3.5 h-3.5" />
            <span>Custom Data Tables</span>
          </button>
          <button
            onClick={() => setMainMode('function')}
            className={`px-2.5 py-1 text-xs font-mono font-bold flex items-center gap-1.5 transition-colors rounded-none ${
              mainMode === 'function'
                ? 'bg-[#2d6fb4] text-white shadow-sm'
                : isLight
                ? 'text-neutral-700 hover:bg-neutral-200'
                : 'text-neutral-300 hover:bg-neutral-800'
            }`}
          >
            <TableIcon className="w-3.5 h-3.5" />
            <span>Function Table f(x)</span>
          </button>
        </div>

        {mainMode === 'custom' && (
          <button
            onClick={handleAddTable}
            className="px-2 py-1 bg-[#00693E] hover:bg-[#005230] text-white text-[11px] font-mono font-bold flex items-center gap-1 transition-colors rounded-none shadow-sm"
            title="Create a new dataset table"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Table</span>
          </button>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODE 1: CUSTOM DATA TABLES (Scatter Plots, Regressions, Stats, Probability, Combinatorics) */}
      {/* ============================================================ */}
      {mainMode === 'custom' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
          {dataTables.length === 0 ? (
            <div className={`p-8 text-center space-y-3 select-none my-auto ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
              <TableIcon className="w-10 h-10 text-[#00693E] mx-auto opacity-80" />
              <p className={`text-base font-bold ${isLight ? 'text-black' : 'text-white'}`}>No Data Tables Created</p>
              <p className="text-xs max-w-sm mx-auto leading-relaxed">
                Create a dataset table or import coordinate pairs to plot live scatter points, compute regressions, and analyze statistical distributions.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <button
                  onClick={handleAddTable}
                  className="px-3 py-1.5 bg-[#00693E] hover:bg-[#005230] text-white text-xs font-mono font-bold flex items-center gap-1.5 rounded-none shadow-sm transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Dataset Table</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Table Selector & Actions Toolbar */}
              <div
                className={`p-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${
                  isLight ? 'bg-neutral-100/70 border-neutral-200' : 'bg-neutral-900/60 border-neutral-800'
                }`}
              >
                {/* Table Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5 min-w-0">
                  {dataTables.map((tbl) => (
                    <button
                      key={tbl.id}
                      onClick={() => setActiveTableId(tbl.id)}
                      className={`px-2 py-1 text-xs font-mono font-bold flex items-center gap-1.5 border transition-all rounded-none shrink-0 ${
                        activeTable?.id === tbl.id
                          ? isLight
                            ? 'bg-white border-[#00693E] text-[#00693E] shadow-sm'
                            : 'bg-black border-[#00693E] text-white shadow-sm'
                          : isLight
                          ? 'bg-neutral-200/80 border-neutral-300 text-neutral-600 hover:text-black'
                          : 'bg-neutral-800/80 border-neutral-700 text-neutral-400 hover:text-white'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-none shrink-0" style={{ backgroundColor: tbl.color }} />
                      <span className="truncate max-w-[100px]">{tbl.name}</span>
                      <span className="text-[10px] opacity-60">({tbl.points.length})</span>
                    </button>
                  ))}
                </div>

                {/* Table-level Toggles & Tools */}
                {activeTable && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    {/* Scatter Plot Toggle */}
                    <button
                      onClick={() => handleUpdateActiveTable({ showScatter: !activeTable.showScatter })}
                      className={`px-2 py-1 border flex items-center gap-1 transition-colors rounded-none font-bold ${
                        activeTable.showScatter
                          ? 'bg-[#00693E] text-white border-[#00693E]'
                          : isLight
                          ? 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
                          : 'bg-black text-neutral-400 border-neutral-700 hover:bg-neutral-900'
                      }`}
                      title="Toggle Scatter Plot Points on 2D Graph"
                    >
                      <CircleDot className="w-3.5 h-3.5" />
                      <span>Scatter {activeTable.showScatter ? 'ON' : 'OFF'}</span>
                    </button>

                    {/* Connect Lines Toggle */}
                    <button
                      onClick={() => handleUpdateActiveTable({ connectLines: !activeTable.connectLines })}
                      className={`px-2 py-1 border flex items-center gap-1 transition-colors rounded-none ${
                        activeTable.connectLines
                          ? 'bg-[#2d6fb4] text-white border-[#2d6fb4]'
                          : isLight
                          ? 'bg-white text-neutral-600 border-neutral-300 hover:bg-neutral-100'
                          : 'bg-black text-neutral-400 border-neutral-700 hover:bg-neutral-900'
                      }`}
                      title="Connect consecutive data points with line segments"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>Lines</span>
                    </button>

                    {/* Import CSV / Paste */}
                    <button
                      onClick={() => setIsImportModalOpen(true)}
                      className={`p-1 border transition-colors rounded-none ${
                        isLight
                          ? 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                          : 'bg-black text-neutral-300 border-neutral-700 hover:bg-neutral-900'
                      }`}
                      title="Paste / Import CSV Data"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-[#fa7d19]" />
                    </button>

                    {/* Sort by X */}
                    <button
                      onClick={() => handleSortX(true)}
                      className={`p-1 border transition-colors rounded-none ${
                        isLight
                          ? 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100'
                          : 'bg-black text-neutral-300 border-neutral-700 hover:bg-neutral-900'
                      }`}
                      title="Sort points by X (ascending)"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                    </button>

                    {/* Clear Table */}
                    <button
                      onClick={handleClearPoints}
                      className={`p-1 border text-[#c84442] transition-colors rounded-none ${
                        isLight
                          ? 'bg-white border-neutral-300 hover:bg-red-50'
                          : 'bg-black border-neutral-700 hover:bg-red-950/40'
                      }`}
                      title="Clear all points"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Table Data Entry Grid */}
              {activeTable && (
                <div className="border-b shrink-0 max-h-56 overflow-y-auto">
                  <table className="w-full text-left font-mono text-xs border-collapse">
                    <thead
                      className={`sticky top-0 border-b z-10 ${
                        isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-900 border-neutral-800'
                      }`}
                    >
                      <tr>
                        <th
                          className={`p-1.5 text-center font-bold border-r w-10 ${
                            isLight ? 'text-neutral-500 border-neutral-300' : 'text-neutral-400 border-neutral-800'
                          }`}
                        >
                          #
                        </th>
                        <th
                          className={`p-1.5 text-center font-bold border-r ${
                            isLight ? 'text-neutral-800 border-neutral-300' : 'text-neutral-200 border-neutral-800'
                          }`}
                        >
                          X (Independent)
                        </th>
                        <th
                          className={`p-1.5 text-center font-bold border-r ${
                            isLight ? 'text-neutral-800 border-neutral-300' : 'text-neutral-200 border-neutral-800'
                          }`}
                        >
                          Y (Dependent)
                        </th>
                        <th className="p-1.5 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className={isLight ? 'divide-y divide-neutral-200' : 'divide-y divide-neutral-800'}>
                      {activeTable.points.map((pt, idx) => (
                        <tr
                          key={idx}
                          className={isLight ? 'hover:bg-neutral-50' : 'hover:bg-neutral-900/50'}
                        >
                          <td
                            className={`p-1 text-center font-bold border-r text-[10px] ${
                              isLight
                                ? 'bg-neutral-50 text-neutral-500 border-neutral-200'
                                : 'bg-neutral-950 text-neutral-400 border-neutral-800'
                            }`}
                          >
                            {idx + 1}
                          </td>
                          <td className={`p-1 border-r ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`}>
                            <input
                              type="number"
                              step="any"
                              value={pt.x}
                              onChange={(e) => handleCellChange(idx, 'x', e.target.value)}
                              className={`w-full text-center px-1.5 py-0.5 border rounded-none font-bold box-border ${
                                isLight
                                  ? 'bg-white border-neutral-300 text-black focus:border-[#00693E]'
                                  : 'bg-black border-neutral-700 text-white focus:border-[#00693E]'
                              }`}
                            />
                          </td>
                          <td className={`p-1 border-r ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`}>
                            <input
                              type="number"
                              step="any"
                              value={pt.y}
                              onChange={(e) => handleCellChange(idx, 'y', e.target.value)}
                              className={`w-full text-center px-1.5 py-0.5 border rounded-none font-bold box-border ${
                                isLight
                                  ? 'bg-white border-neutral-300 text-black focus:border-[#00693E]'
                                  : 'bg-black border-neutral-700 text-white focus:border-[#00693E]'
                              }`}
                            />
                          </td>
                          <td className="p-1 text-center">
                            <button
                              onClick={() => handleDeleteRow(idx)}
                              className="p-1 text-neutral-400 hover:text-[#c84442] transition-colors rounded-none"
                              title="Delete Row"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      ))}

                      {/* Add Row Quick Form */}
                      <tr className={isLight ? 'bg-neutral-50/50' : 'bg-neutral-950/50'}>
                        <td className={`p-1 text-center border-r font-bold text-[10px] text-[#00693E] ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`}>
                          +
                        </td>
                        <td className={`p-1 border-r ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`}>
                          <input
                            type="number"
                            step="any"
                            placeholder="Next X"
                            value={newRowX}
                            onChange={(e) => setNewRowX(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
                            className={`w-full text-center px-1.5 py-0.5 border rounded-none text-xs box-border ${
                              isLight
                                ? 'bg-white border-neutral-300 text-black'
                                : 'bg-black border-neutral-700 text-white'
                            }`}
                          />
                        </td>
                        <td className={`p-1 border-r ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`}>
                          <input
                            type="number"
                            step="any"
                            placeholder="Next Y"
                            value={newRowY}
                            onChange={(e) => setNewRowY(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddRow()}
                            className={`w-full text-center px-1.5 py-0.5 border rounded-none text-xs box-border ${
                              isLight
                                ? 'bg-white border-neutral-300 text-black'
                                : 'bg-black border-neutral-700 text-white'
                            }`}
                          />
                        </td>
                        <td className="p-1 text-center">
                          <button
                            onClick={handleAddRow}
                            className="px-2 py-0.5 bg-[#00693E] hover:bg-[#005230] text-white text-xs font-bold rounded-none"
                            title="Add row"
                          >
                            Add
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              {/* Analytical Sub-Tabs Navigation */}
              <div
                className={`border-b flex items-center justify-between text-xs font-mono shrink-0 ${
                  isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-900 border-neutral-800'
                }`}
              >
                <div className="flex items-center overflow-x-auto min-w-0">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('regression')}
                    className={`px-3 py-2 font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                      activeSubTab === 'regression'
                        ? isLight
                          ? 'border-[#00693E] text-[#00693E] bg-emerald-50/70'
                          : 'border-emerald-500 text-emerald-400 bg-neutral-950'
                        : isLight
                        ? 'border-transparent text-neutral-600 hover:text-black'
                        : 'border-transparent text-neutral-400 hover:text-white'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>Regressions</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('stats')}
                    className={`px-3 py-2 font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                      activeSubTab === 'stats'
                        ? isLight
                          ? 'border-[#2d6fb4] text-[#2d6fb4] bg-blue-50/70'
                          : 'border-blue-500 text-blue-400 bg-neutral-950'
                        : isLight
                        ? 'border-transparent text-neutral-600 hover:text-black'
                        : 'border-transparent text-neutral-400 hover:text-white'
                    }`}
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>Stats Summary</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('probability')}
                    className={`px-3 py-2 font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                      activeSubTab === 'probability'
                        ? isLight
                          ? 'border-[#fa7d19] text-[#fa7d19] bg-amber-50/70'
                          : 'border-amber-500 text-amber-400 bg-neutral-950'
                        : isLight
                        ? 'border-transparent text-neutral-600 hover:text-black'
                        : 'border-transparent text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Dices className="w-3.5 h-3.5" />
                    <span>Probability</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveSubTab('combinatorics')}
                    className={`px-3 py-2 font-bold border-b-2 flex items-center gap-1.5 transition-colors shrink-0 ${
                      activeSubTab === 'combinatorics'
                        ? isLight
                          ? 'border-[#6042a6] text-[#6042a6] bg-purple-50/70'
                          : 'border-purple-500 text-purple-400 bg-neutral-950'
                        : isLight
                        ? 'border-transparent text-neutral-600 hover:text-black'
                        : 'border-transparent text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Hash className="w-3.5 h-3.5" />
                    <span>Combinatorics</span>
                  </button>
                </div>
              </div>

              {/* Sub-Tab 1: Regressions */}
              {activeSubTab === 'regression' && (
                <div className="p-3 space-y-3 min-w-0">
                  {/* 6 Regression Type Selection Buttons */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 font-mono text-xs w-full min-w-0">
                    {(
                      [
                        { id: 'linear', name: 'Linear', form: 'y = ax + b', color: '#00693E' },
                        { id: 'quadratic', name: 'Quadratic', form: 'y = ax² + bx + c', color: '#2d6fb4' },
                        { id: 'cubic', name: 'Cubic', form: 'y = ax³ + bx² + ...', color: '#fa7d19' },
                        { id: 'exponential', name: 'Exponential', form: 'y = a · bˣ', color: '#6042a6' },
                        { id: 'power', name: 'Power', form: 'y = a · xᵇ', color: '#c84442' },
                        { id: 'sinusoidal', name: 'Sinusoidal', form: 'y = a·sin(bx+c)+d', color: '#00693E' },
                      ] as const
                    ).map((reg) => {
                      const isSelected = selectedRegressionType === reg.id;
                      const res = regressionResults[reg.id];
                      return (
                        <button
                          key={reg.id}
                          onClick={() => setSelectedRegressionType(reg.id)}
                          className={`p-2 border text-left flex flex-col justify-between transition-all rounded-none min-w-0 overflow-hidden box-border ${
                            isSelected
                              ? isLight
                                ? 'bg-neutral-50 border-black ring-1 ring-black'
                                : 'bg-neutral-900 border-white ring-1 ring-white'
                              : isLight
                              ? 'bg-white border-neutral-200 hover:bg-neutral-50'
                              : 'bg-black border-neutral-800 hover:bg-neutral-900'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 min-w-0">
                            <span className="font-bold text-[11px] truncate" style={{ color: reg.color }}>
                              {reg.name}
                            </span>
                            {res.valid && (
                              <span className={`text-[9px] font-mono shrink-0 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                                R²={res.rSquared.toFixed(3)}
                              </span>
                            )}
                          </div>
                          <span className={`text-[9px] truncate font-mono mt-0.5 block max-w-full ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            {reg.form}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Selected Regression Details Card */}
                  {currentRegression && (
                    <div
                      className={`p-3 border rounded-none space-y-2.5 min-w-0 box-border ${
                        isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
                      }`}
                    >
                      <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-2 ${
                        isLight ? 'border-neutral-200' : 'border-neutral-800'
                      }`}>
                        <div className="flex items-center gap-1.5 min-w-0">
                          <TrendingUp className="w-4 h-4 text-[#00693E] shrink-0" />
                          <span className="text-xs font-bold font-mono truncate">{currentRegression.name}</span>
                        </div>

                        {currentRegression.valid && (
                          <button
                            onClick={() => handlePlotRegression(currentRegression)}
                            className="px-2 py-1 bg-[#00693E] hover:bg-[#005230] text-white text-[11px] font-mono font-bold flex items-center gap-1 rounded-none shadow-sm transition-colors shrink-0"
                            title="Plot this regression curve on the 2D canvas"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Plot Regression Curve</span>
                          </button>
                        )}
                      </div>

                      {currentRegression.valid ? (
                        <>
                          {/* Model Equation Banner */}
                          <div
                            className={`p-2.5 border text-center font-mono min-w-0 box-border ${
                              isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-800'
                            }`}
                          >
                            <div className={`text-[10px] uppercase font-bold mb-1 ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                              Fitted Model Equation
                            </div>
                            <div className="text-xs sm:text-sm font-bold text-[#00693E] select-text break-words max-w-full overflow-x-auto">
                              {currentRegression.formula}
                            </div>
                          </div>

                          {/* Parameters Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs font-mono w-full min-w-0">
                            {Object.entries(currentRegression.parameters).map(([key, val]) => (
                              <div
                                key={key}
                                className={`p-1.5 sm:p-2 border text-center min-w-0 overflow-hidden box-border ${
                                  isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-800'
                                }`}
                              >
                                <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>{key}:</span>
                                <span className="font-bold text-xs block truncate" title={String(val)}>
                                  {typeof val === 'number' ? val.toFixed(4) : val}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Goodness-of-Fit Metrics */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-xs font-mono w-full min-w-0">
                            <div
                              className={`p-1.5 sm:p-2 border text-center min-w-0 overflow-hidden box-border ${
                                isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-800'
                              }`}
                            >
                              <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Coeff. Det (R²):</span>
                              <span className="font-bold text-[#2d6fb4] text-xs block truncate">
                                {currentRegression.rSquared.toFixed(5)}
                              </span>
                            </div>

                            <div
                              className={`p-1.5 sm:p-2 border text-center min-w-0 overflow-hidden box-border ${
                                isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-800'
                              }`}
                            >
                              <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Pearson (r):</span>
                              <span className="font-bold text-xs block truncate">
                                {currentRegression.pearsonR !== undefined
                                  ? currentRegression.pearsonR.toFixed(5)
                                  : Math.sqrt(Math.max(0, currentRegression.rSquared)).toFixed(5)}
                              </span>
                            </div>

                            <div
                              className={`p-1.5 sm:p-2 border text-center min-w-0 overflow-hidden box-border ${
                                isLight ? 'bg-white border-neutral-200' : 'bg-black border-neutral-800'
                              }`}
                            >
                              <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>RMSE:</span>
                              <span className="font-bold text-[#fa7d19] text-xs block truncate">
                                {currentRegression.rmse.toFixed(5)}
                              </span>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center text-xs font-mono text-[#c84442] break-words">
                          {currentRegression.errorMessage || 'Unable to compute regression with current points.'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 2: Stats Summary (1-Var & 2-Var) */}
              {activeSubTab === 'stats' && (
                <div className="p-3 space-y-3 font-mono text-xs min-w-0">
                  {/* Sample Size & Correlation */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 w-full min-w-0">
                    <div className={`p-2 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Sample Size n</span>
                      <span className="font-bold text-xs sm:text-sm text-[#00693E] block truncate">{stats2Var.n}</span>
                    </div>
                    <div className={`p-2 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Pearson r</span>
                      <span className="font-bold text-xs sm:text-sm text-[#2d6fb4] block truncate">{formatStat(stats2Var.pearsonR)}</span>
                    </div>
                    <div className={`p-2 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>R²</span>
                      <span className="font-bold text-xs sm:text-sm text-[#6042a6] block truncate">{formatStat(stats2Var.rSquared)}</span>
                    </div>
                    <div className={`p-2 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Covariance (s_xy)</span>
                      <span className="font-bold text-xs sm:text-sm block truncate">{formatStat(stats2Var.covarianceSample)}</span>
                    </div>
                  </div>

                  {/* 1-Var Breakdown for X and Y */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 w-full min-w-0">
                    {/* Variable X */}
                    <div className={`p-2.5 border rounded-none space-y-1.5 min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <div className="font-bold text-[#00693E] border-b pb-1 flex flex-wrap justify-between items-center gap-1 text-[11px]">
                        <span className="truncate">Variable X</span>
                        <span className="shrink-0">Σx = {formatStat(stats2Var.xStats.sum, 2)}</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Mean x̄:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.mean)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Sample Std Dev s_x:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.stdevSample)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Pop Std Dev σ_x:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.stdevPop)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Sample Var s_x²:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.varianceSample)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Min X:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.min, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Q1 X:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.q1, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Median X:</span><span className="font-bold text-[#2d6fb4] shrink-0">{formatStat(stats2Var.xStats.median, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Q3 X:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.q3, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Max X:</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.max, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">IQR (Q3 - Q1):</span><span className="font-bold shrink-0">{formatStat(stats2Var.xStats.iqr, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0">
                          <span className="truncate">Mode X:</span>
                          <span className="font-bold text-emerald-600 shrink-0">
                            {stats2Var.xStats.modes.length > 0
                              ? stats2Var.xStats.modes.map((m) => formatStat(m, 2)).join(', ')
                              : 'No mode'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Variable Y */}
                    <div className={`p-2.5 border rounded-none space-y-1.5 min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <div className="font-bold text-[#2d6fb4] border-b pb-1 flex flex-wrap justify-between items-center gap-1 text-[11px]">
                        <span className="truncate">Variable Y</span>
                        <span className="shrink-0">Σy = {formatStat(stats2Var.yStats.sum, 2)}</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Mean ȳ:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.mean)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Sample Std Dev s_y:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.stdevSample)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Pop Std Dev σ_y:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.stdevPop)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Sample Var s_y²:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.varianceSample)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Min Y:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.min, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Q1 Y:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.q1, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Median Y:</span><span className="font-bold text-[#00693E] shrink-0">{formatStat(stats2Var.yStats.median, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Q3 Y:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.q3, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">Max Y:</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.max, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0"><span className="truncate">IQR (Q3 - Q1):</span><span className="font-bold shrink-0">{formatStat(stats2Var.yStats.iqr, 2)}</span></div>
                        <div className="flex justify-between items-center gap-1 min-w-0">
                          <span className="truncate">Mode Y:</span>
                          <span className="font-bold text-emerald-600 shrink-0">
                            {stats2Var.yStats.modes.length > 0
                              ? stats2Var.yStats.modes.map((m) => formatStat(m, 2)).join(', ')
                              : 'No mode'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-Tab 3: Probability Distributions */}
              {activeSubTab === 'probability' && (
                <div className="p-3 space-y-3 font-mono text-xs min-w-0">
                  {/* Distribution Selector */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 w-full min-w-0">
                    {(
                      [
                        { id: 'normal', name: 'Normal' },
                        { id: 'binomial', name: 'Binomial' },
                        { id: 'poisson', name: 'Poisson' },
                        { id: 'geometric', name: 'Geometric' },
                      ] as const
                    ).map((dist) => (
                      <button
                        key={dist.id}
                        onClick={() => setProbDistType(dist.id)}
                        className={`py-1.5 text-center font-bold border transition-colors rounded-none text-xs truncate ${
                          probDistType === dist.id
                            ? 'bg-[#fa7d19] text-white border-[#fa7d19]'
                            : isLight
                            ? 'bg-white border-neutral-300 text-neutral-700 hover:bg-neutral-100'
                            : 'bg-black border-neutral-700 text-neutral-300 hover:bg-neutral-900'
                        }`}
                      >
                        {dist.name}
                      </button>
                    ))}
                  </div>

                  {/* Normal Distribution */}
                  {probDistType === 'normal' && (
                    <div className={`p-3 border rounded-none space-y-2 min-w-0 box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <div className="font-bold text-[#fa7d19]">Normal Distribution N(μ, σ²)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Mean (μ):</span>
                          <input
                            type="number"
                            step="any"
                            value={normMean}
                            onChange={(e) => setNormMean(parseFloat(e.target.value) || 0)}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Std Dev (σ):</span>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={normStd}
                            onChange={(e) => setNormStd(Math.max(0.001, parseFloat(e.target.value) || 1))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                      </div>

                      {/* Range CDF */}
                      <div className={`pt-2 border-t space-y-1 ${
                        isLight ? 'border-neutral-200' : 'border-neutral-800'
                      }`}>
                        <span className={`text-[10px] block font-bold ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>Interval Probability P(a ≤ X ≤ b):</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="number"
                            step="any"
                            placeholder="Lower bound a"
                            value={normA}
                            onChange={(e) => setNormA(parseFloat(e.target.value) || 0)}
                            className={`p-1 border text-center box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                          <input
                            type="number"
                            step="any"
                            placeholder="Upper bound b"
                            value={normB}
                            onChange={(e) => setNormB(parseFloat(e.target.value) || 0)}
                            className={`p-1 border text-center box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                        <div className={`p-2 border text-center font-bold text-xs sm:text-sm break-all box-border ${isLight ? 'bg-white text-[#00693E]' : 'bg-black text-[#43b082]'}`}>
                          P({normA} ≤ X ≤ {normB}) = {normalRangeCDF(normA, normB, normMean, normStd).toFixed(6)}
                        </div>
                      </div>

                      {/* PDF at X */}
                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t ${
                        isLight ? 'border-neutral-200' : 'border-neutral-800'
                      }`}>
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Evaluate at x:</span>
                          <input
                            type="number"
                            step="any"
                            value={normX}
                            onChange={(e) => setNormX(parseFloat(e.target.value) || 0)}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                        <div className={`p-2 border text-center flex flex-col justify-center min-w-0 box-border ${isLight ? 'bg-white' : 'bg-black'}`}>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>PDF ϕ(x):</span>
                          <span className="font-bold text-xs truncate">{normalPDF(normX, normMean, normStd).toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Binomial Distribution */}
                  {probDistType === 'binomial' && (
                    <div className={`p-3 border rounded-none space-y-2 min-w-0 box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <div className="font-bold text-[#fa7d19]">Binomial Distribution B(n, p)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Trials (n):</span>
                          <input
                            type="number"
                            min="1"
                            value={binN}
                            onChange={(e) => setBinN(Math.max(1, parseInt(e.target.value) || 1))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Success (p):</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={binP}
                            onChange={(e) => setBinP(Math.max(0, Math.min(1, parseFloat(e.target.value) || 0)))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Successes (k):</span>
                          <input
                            type="number"
                            min="0"
                            max={binN}
                            value={binK}
                            onChange={(e) => setBinK(Math.max(0, parseInt(e.target.value) || 0))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                      </div>

                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t ${
                        isLight ? 'border-neutral-200' : 'border-neutral-800'
                      }`}>
                        <div className={`p-2 border text-center min-w-0 box-border ${isLight ? 'bg-white' : 'bg-black'}`}>
                          <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Exact P(X = {binK}):</span>
                          <span className="font-bold text-xs sm:text-sm text-[#00693E] block truncate">{binomialPDF(binN, binK, binP).toFixed(6)}</span>
                        </div>
                        <div className={`p-2 border text-center min-w-0 box-border ${isLight ? 'bg-white' : 'bg-black'}`}>
                          <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Cumulative P(X ≤ {binK}):</span>
                          <span className="font-bold text-xs sm:text-sm text-[#2d6fb4] block truncate">{binomialCDF(binN, binK, binP).toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Poisson Distribution */}
                  {probDistType === 'poisson' && (
                    <div className={`p-3 border rounded-none space-y-2 min-w-0 box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <div className="font-bold text-[#fa7d19]">Poisson Distribution Pois(λ)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Rate (λ):</span>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={poisLambda}
                            onChange={(e) => setPoisLambda(Math.max(0.1, parseFloat(e.target.value) || 1))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Occurrences (k):</span>
                          <input
                            type="number"
                            min="0"
                            value={poisK}
                            onChange={(e) => setPoisK(Math.max(0, parseInt(e.target.value) || 0))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                      </div>

                      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t ${
                        isLight ? 'border-neutral-200' : 'border-neutral-800'
                      }`}>
                        <div className={`p-2 border text-center min-w-0 box-border ${isLight ? 'bg-white' : 'bg-black'}`}>
                          <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Exact P(X = {poisK}):</span>
                          <span className="font-bold text-xs sm:text-sm text-[#00693E] block truncate">{poissonPDF(poisK, poisLambda).toFixed(6)}</span>
                        </div>
                        <div className={`p-2 border text-center min-w-0 box-border ${isLight ? 'bg-white' : 'bg-black'}`}>
                          <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Cumulative P(X ≤ {poisK}):</span>
                          <span className="font-bold text-xs sm:text-sm text-[#2d6fb4] block truncate">{poissonCDF(poisK, poisLambda).toFixed(6)}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Geometric Distribution */}
                  {probDistType === 'geometric' && (
                    <div className={`p-3 border rounded-none space-y-2 min-w-0 box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <div className="font-bold text-[#fa7d19]">Geometric Distribution Geom(p)</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Probability (p):</span>
                          <input
                            type="number"
                            step="0.05"
                            min="0.001"
                            max="1"
                            value={geomP}
                            onChange={(e) => setGeomP(Math.max(0.001, Math.min(1, parseFloat(e.target.value) || 0.5)))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                        <div>
                          <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Trial of 1st success (k):</span>
                          <input
                            type="number"
                            min="1"
                            value={geomK}
                            onChange={(e) => setGeomK(Math.max(1, parseInt(e.target.value) || 1))}
                            className={`w-full p-1 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                          />
                        </div>
                      </div>

                      <div className={`p-2 border text-center pt-2 min-w-0 box-border ${isLight ? 'bg-white' : 'bg-black'}`}>
                        <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>P(1st success on trial {geomK}):</span>
                        <span className="font-bold text-xs sm:text-sm text-[#00693E] block truncate">{geometricPDF(geomK, geomP).toFixed(6)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-Tab 4: Combinatorics */}
              {activeSubTab === 'combinatorics' && (
                <div className="p-3 space-y-3 font-mono text-xs min-w-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full min-w-0">
                    <div>
                      <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Total Items (n):</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={combN}
                        onChange={(e) => setCombN(Math.max(0, parseInt(e.target.value) || 0))}
                        className={`w-full p-1.5 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                      />
                    </div>
                    <div>
                      <span className={`text-[10px] block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Subset Items (r):</span>
                      <input
                        type="number"
                        min="0"
                        max={combN}
                        value={combR}
                        onChange={(e) => setCombR(Math.max(0, parseInt(e.target.value) || 0))}
                        className={`w-full p-1.5 border font-bold box-border ${isLight ? 'bg-white border-neutral-300' : 'bg-black border-neutral-700'}`}
                      />
                    </div>
                  </div>

                  {/* Combinatorics Results Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full min-w-0">
                    <div className={`p-2.5 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Combinations nCr = (n choose r)</span>
                      <span className="text-sm sm:text-base font-bold text-[#6042a6] block truncate" title={nCr(combN, combR) > 1e12 ? nCr(combN, combR).toExponential(4) : nCr(combN, combR).toLocaleString()}>
                        {nCr(combN, combR) > 1e12 ? nCr(combN, combR).toExponential(4) : nCr(combN, combR).toLocaleString()}
                      </span>
                      <span className={`block text-[9px] mt-0.5 truncate ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>n! / (r!(n-r)!)</span>
                    </div>

                    <div className={`p-2.5 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Permutations nPr</span>
                      <span className="text-sm sm:text-base font-bold text-[#2d6fb4] block truncate" title={nPr(combN, combR) > 1e12 ? nPr(combN, combR).toExponential(4) : nPr(combN, combR).toLocaleString()}>
                        {nPr(combN, combR) > 1e12 ? nPr(combN, combR).toExponential(4) : nPr(combN, combR).toLocaleString()}
                      </span>
                      <span className={`block text-[9px] mt-0.5 truncate ${isLight ? 'text-neutral-400' : 'text-neutral-500'}`}>n! / (n-r)!</span>
                    </div>

                    <div className={`p-2.5 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Factorial n! ({combN}!)</span>
                      <span className="text-sm sm:text-base font-bold text-[#00693E] block truncate" title={combN <= 15 ? factorial(combN).toLocaleString() : factorial(combN).toExponential(4)}>
                        {combN <= 15 ? factorial(combN).toLocaleString() : factorial(combN).toExponential(4)}
                      </span>
                    </div>

                    <div className={`p-2.5 border text-center min-w-0 overflow-hidden box-border ${isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'}`}>
                      <span className={`text-[10px] block truncate ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>Double Factorial n!! ({combN}!!)</span>
                      <span className="text-sm sm:text-base font-bold text-[#fa7d19] block truncate" title={combN <= 20 ? doubleFactorial(combN).toLocaleString() : doubleFactorial(combN).toExponential(4)}>
                        {combN <= 20 ? doubleFactorial(combN).toLocaleString() : doubleFactorial(combN).toExponential(4)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ============================================================ */
        /* MODE 2: FUNCTION TABLE (f(x), d/dx table of values) */
        /* ============================================================ */
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Table controls top bar */}
          <div
            className={`p-3 border-b flex flex-wrap items-center justify-between gap-3 text-xs rounded-none shrink-0 ${
              isLight ? 'bg-neutral-50 border-neutral-300' : 'bg-neutral-950 border-neutral-800'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 font-mono">
                <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Start x₀:</span>
                <input
                  type="number"
                  step="1"
                  value={xStart}
                  onChange={(e) => setXStart(parseFloat(e.target.value) || 0)}
                  className={`w-16 border rounded-none px-2 py-1 text-center font-bold font-mono ${
                    isLight ? 'bg-white border-neutral-300 text-black' : 'bg-black border-neutral-700 text-white'
                  }`}
                />
              </div>
              <div className="flex items-center gap-1.5 font-mono">
                <span className={isLight ? 'text-neutral-600' : 'text-neutral-400'}>Step Δx:</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.01"
                  value={xStep}
                  onChange={(e) => setXStep(parseFloat(e.target.value) || 0.5)}
                  className={`w-16 border rounded-none px-2 py-1 text-center font-bold font-mono ${
                    isLight ? 'bg-white border-neutral-300 text-black' : 'bg-black border-neutral-700 text-white'
                  }`}
                />
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setXStart((prev) => prev - xStep * 10)}
                className={`p-1.5 rounded-none border transition-colors ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                }`}
                title="Page Up"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setXStart((prev) => prev + xStep * 10)}
                className={`p-1.5 rounded-none border transition-colors ${
                  isLight
                    ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black'
                    : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-neutral-300'
                }`}
                title="Page Down"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Data Container */}
          <div className="flex-1 overflow-auto">
            {cartesianItems.length === 0 ? (
              <div className={`p-8 text-center space-y-2 select-none ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                <TableIcon className="w-8 h-8 text-[#2d6fb4] mx-auto" />
                <p className={`text-sm font-semibold ${isLight ? 'text-black' : 'text-white'}`}>No Cartesian Functions</p>
                <p className="text-xs">Add a Cartesian function y = f(x) to populate this table.</p>
              </div>
            ) : (
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead
                  className={`sticky top-0 border-b shadow-sm z-10 ${
                    isLight ? 'bg-neutral-100 border-neutral-300' : 'bg-neutral-900 border-neutral-800'
                  }`}
                >
                  <tr>
                    <th
                      className={`p-2.5 text-center font-bold border-r w-20 ${
                        isLight ? 'text-neutral-700 border-neutral-300' : 'text-neutral-400 border-neutral-800'
                      }`}
                    >
                      x
                    </th>
                    {parsedFunctions.map((fn) => (
                      <React.Fragment key={fn.item.id}>
                        <th
                          className={`p-2.5 text-left border-r ${
                            isLight ? 'border-neutral-300' : 'border-neutral-800'
                          }`}
                          style={{ color: fn.item.color }}
                        >
                          <div className="font-bold">{fn.name}</div>
                          <div className={`text-[10px] font-normal truncate max-w-[120px] ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>
                            {fn.item.rawInput}
                          </div>
                        </th>
                        <th
                          className={`p-2.5 text-left text-[#00693E] border-r ${
                            isLight ? 'border-neutral-300' : 'border-neutral-800'
                          }`}
                        >
                          <div className="font-bold">{fn.name}'</div>
                          <div className={`text-[10px] font-normal ${isLight ? 'text-neutral-600' : 'text-neutral-400'}`}>d/dx</div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className={isLight ? 'divide-y divide-neutral-200' : 'divide-y divide-neutral-900'}>
                  {functionRows.map((r, i) => (
                    <tr
                      key={i}
                      className={`transition-colors ${
                        isLight ? 'hover:bg-neutral-100' : 'hover:bg-neutral-900'
                      }`}
                    >
                      <td
                        className={`p-2.5 text-center font-bold border-r ${
                          isLight
                            ? 'bg-neutral-50 text-black border-neutral-200'
                            : 'bg-neutral-950 text-white border-neutral-900'
                        }`}
                      >
                        {r.x.toFixed(2)}
                      </td>
                      {r.values.map((v, vIdx) => (
                        <React.Fragment key={vIdx}>
                          <td
                            className={`p-2.5 border-r ${
                              isLight ? 'border-neutral-200 text-black' : 'border-neutral-900 text-neutral-200'
                            }`}
                          >
                            {v.valid ? v.y.toFixed(4) : <span className="text-[#c84442]">undef</span>}
                          </td>
                          <td
                            className={`p-2.5 border-r font-medium ${
                              isLight ? 'border-neutral-200 text-[#00693E]' : 'border-neutral-900 text-[#43b082]'
                            }`}
                          >
                            {v.valid && !isNaN(v.dy) ? v.dy.toFixed(4) : <span className={isLight ? 'text-neutral-400' : 'text-neutral-600'}>-</span>}
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* CSV / Batch Paste Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div
            className={`w-full max-w-lg border shadow-2xl p-4 space-y-4 font-mono text-xs rounded-none ${
              isLight ? 'bg-white text-black border-neutral-300' : 'bg-neutral-950 text-white border-neutral-800'
            }`}
          >
            {/* Modal Title Bar */}
            <div className={`flex items-center justify-between border-b pb-2 ${
              isLight ? 'border-neutral-200' : 'border-neutral-800'
            }`}>
              <div className="flex items-center gap-1.5 font-bold">
                <FileSpreadsheet className="w-4 h-4 text-[#fa7d19]" />
                <span>CSV Integration Suite</span>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className={`p-1 rounded-none ${
                  isLight ? 'hover:bg-neutral-200 text-neutral-600' : 'hover:bg-neutral-800 text-neutral-400'
                }`}
              >
                ✕
              </button>
            </div>

            {/* Modal Tabs */}
            <div className={`flex border-b ${isLight ? 'border-neutral-200' : 'border-neutral-800'}`}>
              <button
                type="button"
                onClick={() => setModalTab('import')}
                className={`flex-1 py-1.5 text-center font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                  modalTab === 'import'
                    ? 'border-[#00693E] text-[#00693E]'
                    : isLight
                    ? 'border-transparent text-neutral-500 hover:text-black'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Dataset</span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab('export')}
                className={`flex-1 py-1.5 text-center font-bold border-b-2 transition-colors flex items-center justify-center gap-1.5 ${
                  modalTab === 'export'
                    ? 'border-[#2d6fb4] text-[#2d6fb4]'
                    : isLight
                    ? 'border-transparent text-neutral-500 hover:text-black'
                    : 'border-transparent text-neutral-400 hover:text-white'
                }`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Dataset</span>
              </button>
            </div>

            {/* TAB CONTENT: IMPORT */}
            {modalTab === 'import' && (
              <div className="space-y-4">
                {/* File Upload Section */}
                <div className={`p-3 border text-center space-y-2 ${isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                  <p className="text-[11px] font-bold">Option A: Upload a .CSV file</p>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-none flex items-center gap-1.5 mx-auto transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose CSV File</span>
                  </button>
                  <p className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Supports 2-column CSV layouts (e.g. X and Y coordinates)
                  </p>
                </div>

                {/* Paste Area Section */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold">Option B: Paste Raw Coordinates</p>
                  <textarea
                    rows={6}
                    placeholder={`1, 2.5\n2, 4.1\n3, 6.8\n4, 8.2`}
                    value={pasteContent}
                    onChange={(e) => setPasteContent(e.target.value)}
                    className={`w-full p-2 border font-mono text-xs rounded-none ${
                      isLight ? 'bg-neutral-50 border-neutral-300 text-black' : 'bg-black border-neutral-700 text-white'
                    }`}
                  />
                  <p className={`text-[10px] ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                    Paste X and Y values separated by commas, tabs, or spaces.
                  </p>
                </div>

                {/* Import Footer Actions */}
                <div className={`flex justify-end gap-2 pt-2 border-t ${
                  isLight ? 'border-neutral-200' : 'border-neutral-800'
                }`}>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className={`px-3 py-1.5 border font-bold rounded-none ${
                      isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleImportData}
                    disabled={!pasteContent.trim()}
                    className={`px-3 py-1.5 bg-[#00693E] hover:bg-[#005230] text-white font-bold rounded-none flex items-center gap-1 ${
                      !pasteContent.trim() ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Import Paste Data</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT: EXPORT */}
            {modalTab === 'export' && (
              <div className="space-y-4">
                <div className={`p-3 border space-y-2.5 ${isLight ? 'bg-neutral-50 border-neutral-200' : 'bg-neutral-900 border-neutral-800'}`}>
                  <div>
                    <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Active Target Table
                    </span>
                    <span className="text-sm font-bold text-[#2d6fb4]">
                      {activeTable?.name || 'No Active Table'}
                    </span>
                  </div>

                  <div>
                    <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      Record Count
                    </span>
                    <span className="text-xs font-bold font-mono">
                      {activeTable?.points.length || 0} rows of X, Y coordinates
                    </span>
                  </div>
                </div>

                {/* CSV File Format Preview */}
                {activeTable && activeTable.points.length > 0 && (
                  <div className="space-y-1">
                    <span className={`text-[10px] uppercase font-bold block ${isLight ? 'text-neutral-500' : 'text-neutral-400'}`}>
                      CSV Export Format Preview:
                    </span>
                    <div className={`p-2 border font-mono text-[10px] select-text break-words max-h-24 overflow-y-auto ${
                      isLight ? 'bg-white border-neutral-300 text-neutral-600' : 'bg-black border-neutral-800 text-neutral-400'
                    }`}>
                      <div>x,y</div>
                      {activeTable.points.slice(0, 5).map((pt, idx) => (
                        <div key={idx}>{pt.x},{pt.y}</div>
                      ))}
                      {activeTable.points.length > 5 && <div>... (+ {activeTable.points.length - 5} more rows)</div>}
                    </div>
                  </div>
                )}

                {/* Export Footer Actions */}
                <div className={`flex justify-end gap-2 pt-2 border-t ${
                  isLight ? 'border-neutral-200' : 'border-neutral-800'
                }`}>
                  <button
                    type="button"
                    onClick={() => setIsImportModalOpen(false)}
                    className={`px-3 py-1.5 border font-bold rounded-none ${
                      isLight ? 'bg-neutral-100 hover:bg-neutral-200 border-neutral-300 text-black' : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-700 text-white'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    disabled={!activeTable || activeTable.points.length === 0}
                    className={`px-3 py-1.5 bg-[#2d6fb4] hover:bg-[#1e4d80] text-white font-bold rounded-none flex items-center gap-1.5 ${
                      (!activeTable || activeTable.points.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .CSV File</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
