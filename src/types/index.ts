/**
 * Core type definitions for SquarePack Lab
 */

export interface Point {
  x: number;
  y: number;
}

export interface UnitSquare {
  id: number; // 0 to n-1
  x: number;  // center x
  y: number;  // center y
  angle: number; // rotation in radians [-pi, pi] or [0, 2pi]
}

export interface RotatedSquareGeometry {
  id: number;
  center: Point;
  angle: number;
  vertices: [Point, Point, Point, Point]; // 4 rotated vertices
  normals: [Point, Point]; // 2 orthogonal unit normals
  aabb: { minX: number; maxX: number; minY: number; maxY: number };
}

export type PackingStatus = 'baseline' | 'improved' | 'optimal' | 'invalid';

export interface Packing {
  n: number;
  squares: UnitSquare[];
  containerLength: number; // L
  score: number;           // L / sqrt(n) - 1
  status: PackingStatus;
  isProvenOptimal: boolean;
  notes?: string;
  seed?: number;
  iterations?: number;
  timestamp?: number;
}

export interface CollisionPair {
  squareA: number;
  squareB: number;
  overlapDepth: number;
  contactType: 'interior_overlap' | 'boundary_touch';
}

export interface ValidationIssue {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  isValid: boolean;
  n: number;
  squareCount: number;
  computedLength: number; // L = max(W, H)
  width: number;          // W = maxX - minX
  height: number;         // H = maxY - minY
  bindingAxis: 'width' | 'height' | 'balanced'; // indicates whether W or H constraints L
  score: number;
  areaLowerBound: number; // sqrt(n)
  isProvenOptimal: boolean;
  boundingBox: { minX: number; maxX: number; minY: number; maxY: number };
  collisions: CollisionPair[];
  issues: ValidationIssue[];
  toleranceUsed: number;
}

export interface MetricConfig {
  overlapTolerance: number; // default 1e-9 (interiors overlapping more than this is invalid)
  boundaryContactEpsilon: number; // default 1e-7
  scoreFormula: 'standard' | 'length_only';
  containerAlignment: 'axis_aligned';
  allowPartialSubmissions: boolean;
}

export interface OptimizationParams {
  n: number;
  initialPacking?: Packing;
  seed: number;
  restarts: number;
  timeBudgetMs: number;
  maxIterations: number;
  initialTemp: number;
  coolingRate: number;
  stepSizeTranslation: number;
  stepSizeRotation: number;
  shrinkFactor: number; // e.g. 0.998 to progressively compress container
  algorithm?: 'simulated_annealing' | 'physics_compaction' | 'genetic_algorithm' | 'lattice_synthesizer' | 'hyper_arena';
  weights: {
    overlapPenalty: number;
    containerPenalty: number;
  };
}

export interface OptimizationProgress {
  n: number;
  restart: number;
  iteration: number;
  currentL: number;
  bestL: number;
  currentOverlap: number;
  temperature: number;
  elapsedMs: number;
  movesAccepted: number;
  movesTotal: number;
  state: 'running' | 'paused' | 'completed' | 'cancelled' | 'validated';
}

export interface BenchmarkRecord {
  n: number;
  baselineL: number;
  optimizedL: number;
  scoreDelta: number;
  runtimeMs: number;
  iterations: number;
  isValid: boolean;
}
