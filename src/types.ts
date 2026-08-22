export type ExpressionType = 
  | 'cartesian'   // y = f(x)
  | 'polar'       // r = f(theta)
  | 'parametric'  // x = f(t), y = g(t)
  | 'implicit'    // f(x, y) = 0 or f(x, y) = g(x, y)
  | 'surface3d'   // z = f(x, y)
  | 'inequality'  // y <= f(x) or y >= f(x)
  | 'scatter'     // Scatter plot from data points
  | 'series'      // Series partial sums / sequences sum_{n=a}^N a_n(x)
  | 'complex';    // z = a + bi or r ∠ theta

export type ThemeMode = 'dark' | 'light';

export const THEME_PALETTE = {
  coralRed: '#c84442',
  deepBlue: '#2d6fb4',
  dartmouthGreen: '#00693E',
  orange: '#fa7d19',
  purple: '#6042a6',
  black: '#000000',
  white: '#FFFFFF',
};

export const COLOR_OPTIONS = [
  '#00693E', // Dartmouth Green (Main)
  '#2d6fb4', // Deep Blue
  '#fa7d19', // Orange
  '#6042a6', // Purple
  '#c84442', // Coral Red
];

export type RiemannMethod = 'none' | 'left' | 'right' | 'midpoint' | 'trapezoid' | 'simpson';

export interface DataPoint {
  x: number;
  y: number;
}

export interface DataTable {
  id: string;
  name: string;
  points: DataPoint[];
  color: string;
  visible: boolean;
  showScatter: boolean;
  connectLines: boolean;
  pointStyle?: 'circle' | 'square' | 'diamond' | 'cross';
}

export interface MathItem {
  id: string;
  rawInput: string;
  type: ExpressionType;
  color: string;
  visible: boolean;
  // Domain restrictions (e.g. {0 < x < 2}, {x > 0})
  domainRaw?: string;
  domainMin?: number;
  domainMax?: number;
  domainMinInclusive?: boolean;
  domainMaxInclusive?: boolean;
  // Derivative & Integral Features (TI-Nspire CX II inspired)
  isDerivativeVisible?: boolean;
  isSecondDerivativeVisible?: boolean;
  isIntegralVisible?: boolean;
  integralRange?: [number, number];
  riemannMode?: RiemannMethod;
  riemannN?: number;
  tangentX?: number | null;
  showNormalLine?: boolean;
  // Parametric Constraints & Simulation
  parametricX?: string;
  parametricY?: string;
  parametricTMin?: number;
  parametricTMax?: number;
  parametricTStep?: number;
  parametricTCurrent?: number;
  parametricSimulating?: boolean;
  showVelocityVector?: boolean;
  showAccelerationVector?: boolean;
  // Series and Sequences
  seriesTerm?: string;
  seriesVar?: string;
  seriesFrom?: number;
  seriesTo?: number;
  seriesMode?: 'partial_sum' | 'sequence_plot';
  // Generalized Dynamic Parameters (a, b, c, k, etc.)
  parameterValues?: Record<string, number>;
  inequalityOp?: '<' | '<=' | '>' | '>=';
  label?: string;
  // Scatter / Table points
  points?: DataPoint[];
  connectPoints?: boolean;
  pointShape?: 'circle' | 'square' | 'diamond' | 'cross';
  tableSourceId?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface CriticalPoint {
  x: number;
  y: number;
  type: 'zero' | 'min' | 'max' | 'inflection' | 'y-intercept' | 'intersection' | 'trace';
  label: string;
}

export interface Viewport2D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface Viewport3D {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  rotX: number;
  rotY: number;
  zoom: number;
  wireframe: boolean;
}

export type MobileActivePanel = 'none' | 'functions' | 'calculus' | 'table' | 'cas' | 'settings';

