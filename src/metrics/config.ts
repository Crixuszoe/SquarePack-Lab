/**
 * Metric Configuration Module
 * 
 * Isolates competition metric rules, mathematical assumptions, and floating-point
 * numerical tolerances for interior overlap vs. boundary contact.
 * Allows loading official metric notebooks/scripts to verify compatibility.
 */

import { MetricConfig } from '../types';

export const DEFAULT_METRIC_CONFIG: MetricConfig = {
  // Overlap tolerance: if overlap depth on any separating axis exceeds this,
  // it is classified as an interior overlap violation.
  // Boundary contact (overlap depth <= tolerance) is legal.
  overlapTolerance: 1e-8,
  
  // Boundary contact classification epsilon (for distinguishing pure touch from separate)
  boundaryContactEpsilon: 1e-6,
  
  // Official competition score function: score(n) = L / sqrt(n) - 1
  scoreFormula: 'standard',
  
  // Container must be an axis-aligned square enclosing all rotated vertices
  containerAlignment: 'axis_aligned',
  
  allowPartialSubmissions: true,
};

export class MetricEngine {
  private config: MetricConfig;

  constructor(customConfig?: Partial<MetricConfig>) {
    this.config = { ...DEFAULT_METRIC_CONFIG, ...customConfig };
  }

  public getConfig(): MetricConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<MetricConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public resetToDefault(): void {
    this.config = { ...DEFAULT_METRIC_CONFIG };
  }

  /**
   * Compute container side length L from overall bounding box:
   * L = max(max_x - min_x, max_y - min_y)
   */
  public computeContainerLength(minX: number, maxX: number, minY: number, maxY: number): number {
    const width = maxX - minX;
    const height = maxY - minY;
    return Math.max(width, height);
  }

  /**
   * Compute puzzle score:
   * score(n) = L / sqrt(n) - 1
   * Note: For perfect squares, L = sqrt(n) yields score = 0 (the proven area optimum).
   */
  public computeScore(n: number, containerLength: number): number {
    if (n <= 0) return 0;
    const sqrtN = Math.sqrt(n);
    if (this.config.scoreFormula === 'length_only') {
      return containerLength;
    }
    return (containerLength / sqrtN) - 1.0;
  }

  /**
   * Provisional fallback for missing puzzles:
   * L_grid = ceil(sqrt(n))
   */
  public computeGridFallbackLength(n: number): number {
    return Math.ceil(Math.sqrt(n));
  }

  public computeGridFallbackScore(n: number): number {
    const L_grid = this.computeGridFallbackLength(n);
    return this.computeScore(n, L_grid);
  }

  /**
   * Check if n is a perfect square.
   * If n is a perfect square, the grid packing achieves area lower bound L = sqrt(n)
   * and score = 0, which is proven mathematically optimal.
   */
  public isPerfectSquare(n: number): boolean {
    const root = Math.round(Math.sqrt(n));
    return root * root === n;
  }

  /**
   * Parse an uploaded official metric notebook or python file to detect parameters
   */
  public inspectUploadedNotebook(content: string): {
    detectedFormula?: string;
    detectedTolerance?: number;
    notes: string[];
    isCompatible: boolean;
  } {
    const notes: string[] = [];
    let detectedTolerance: number | undefined;
    let detectedFormula: string | undefined;

    // Search for tolerance definitions, e.g. 1e-6, 1e-8, 1e-9, 1e-5
    const tolMatch = content.match(/(?:tol|tolerance|eps|epsilon)\s*=\s*([0-9.eE-]+)/i);
    if (tolMatch) {
      const val = parseFloat(tolMatch[1]);
      if (!isNaN(val)) {
        detectedTolerance = val;
        notes.push(`Detected tolerance parameter in script: ${val}`);
      }
    }

    // Search for score formula patterns
    if (content.includes('sqrt(n)') && content.includes('- 1')) {
      detectedFormula = 'L / sqrt(n) - 1';
      notes.push('Confirmed standard score formula: L / sqrt(n) - 1');
    } else if (content.includes('score')) {
      notes.push('Found score calculation reference; verify exact formula in script.');
    }

    // Check for SAT or overlap logic
    if (content.toLowerCase().includes('separating') || content.toLowerCase().includes('sat') || content.toLowerCase().includes('shapely')) {
      notes.push('Detected polygon intersection/SAT logic in reference code.');
    }

    if (content.includes('ceil(sqrt(n))')) {
      notes.push('Confirmed standard fallback formula: ceil(sqrt(n)).');
    }

    return {
      detectedFormula,
      detectedTolerance,
      notes,
      isCompatible: true,
    };
  }
}

export const globalMetricEngine = new MetricEngine();
