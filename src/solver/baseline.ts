/**
 * Phase 1: Baseline Grid Packing Generator
 * 
 * Generates the deterministic baseline grid packings for any n in [1, 1000].
 * For each n:
 *   k = ceil(sqrt(n))
 *   Centers: (column + 0.5, row + 0.5)
 *   Angle = 0
 *   Square IDs = 0 to n-1
 * 
 * For perfect-square values of n, the grid achieves the theoretical area lower bound L = sqrt(n),
 * yielding score = 0, which is proven mathematically optimal.
 */

import { Packing, UnitSquare } from '../types';
import { globalMetricEngine } from '../metrics/config';
import { validatePacking } from '../geometry/validator';

/**
 * Generate the baseline grid packing for a given n
 */
export function generateBaselinePacking(n: number): Packing {
  if (n <= 0) {
    throw new Error(`n must be >= 1, received ${n}`);
  }

  const k = Math.ceil(Math.sqrt(n));
  const squares: UnitSquare[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const col = i % k;
    const row = Math.floor(i / k);

    squares[i] = {
      id: i,
      x: col + 0.5,
      y: row + 0.5,
      angle: 0.0,
    };
  }

  const isProvenOptimal = globalMetricEngine.isPerfectSquare(n);
  const containerLength = k;
  const score = globalMetricEngine.computeScore(n, containerLength);

  return {
    n,
    squares,
    containerLength,
    score,
    status: isProvenOptimal ? 'optimal' : 'baseline',
    isProvenOptimal,
    notes: isProvenOptimal
      ? `Proven optimal grid packing: achieves theoretical area lower bound L = sqrt(${n}) = ${Math.sqrt(n)}.`
      : `Standard baseline grid packing with ${k} columns.`,
    timestamp: Date.now(),
  };
}

/**
 * Validates baseline packing directly via independent validator
 */
export function generateAndValidateBaseline(n: number): { packing: Packing; isValid: boolean } {
  const packing = generateBaselinePacking(n);
  const valResult = validatePacking(n, packing.squares);

  return {
    packing: {
      ...packing,
      containerLength: valResult.computedLength,
      score: valResult.score,
      isProvenOptimal: valResult.isProvenOptimal,
    },
    isValid: valResult.isValid,
  };
}

/**
 * Compute the analytical baseline total competition score across all 1,000 puzzles
 */
export function computeAnalyticalBaselineSummary(): {
  totalScore: number;
  perfectSquareCount: number;
  totalSquares: number;
} {
  let totalScore = 0;
  let perfectSquareCount = 0;
  let totalSquares = 0;

  for (let n = 1; n <= 1000; n++) {
    totalSquares += n;
    const k = Math.ceil(Math.sqrt(n));
    const score = (k / Math.sqrt(n)) - 1.0;
    totalScore += score;
    if (k * k === n) {
      perfectSquareCount++;
    }
  }

  return {
    totalScore,
    perfectSquareCount,
    totalSquares,
  };
}
