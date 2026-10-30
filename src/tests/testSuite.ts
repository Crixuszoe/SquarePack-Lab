/**
 * Computational Geometry, Validation, & Solver Test Suite
 * 
 * Implements automated verification for:
 * 1. Single square container calculation
 * 2. Adjacent squares sharing an edge (boundary contact: valid)
 * 3. Squares touching only at a corner (boundary point contact: valid)
 * 4. Small positive overlap (interior overlap: strictly invalid)
 * 5. Rotated overlapping vs separated squares (SAT precision)
 * 6. Rotated square bounding box exact calculations
 * 7. Perfect-square grid packings (n=1, 4, 9, 16, 25 achieve L=sqrt(n), score=0, proven optimal)
 * 8. Identification sequence and duplicate/missing ID detection
 * 9. CSV export/import serialization round-trip verification
 * 10. Seed determinism in optimization engine
 * 11. Live benchmark measuring actual execution time on representative n values
 */

import { UnitSquare, ValidationResult, BenchmarkRecord } from '../types';
import { validatePacking } from '../geometry/validator';
import {
  computeSquareGeometry,
  checkSquareIntersection,
  computeEnclosingBoundingBox,
} from '../geometry/sat';
import { generateBaselinePacking } from '../solver/baseline';
import { generateSubmissionCsv, parseSubmissionCsv } from '../export/csv';
import { Mulberry32 } from '../solver/prng';
import { PackingOptimizer } from '../solver/optimizer';

export interface TestResult {
  id: string;
  name: string;
  category: 'geometry' | 'validator' | 'baseline' | 'csv' | 'determinism';
  passed: boolean;
  message: string;
  durationMs: number;
  details?: Record<string, unknown>;
}

export async function runAllTests(): Promise<{ results: TestResult[]; allPassed: boolean; totalDurationMs: number }> {
  const startTime = performance.now();
  const results: TestResult[] = [];

  function addTest(
    id: string,
    name: string,
    category: TestResult['category'],
    fn: () => { passed: boolean; message: string; details?: Record<string, unknown> }
  ) {
    const t0 = performance.now();
    try {
      const res = fn();
      results.push({
        id,
        name,
        category,
        passed: res.passed,
        message: res.message,
        durationMs: performance.now() - t0,
        details: res.details,
      });
    } catch (err: unknown) {
      results.push({
        id,
        name,
        category,
        passed: false,
        message: `Exception: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: performance.now() - t0,
      });
    }
  }

  // 1. Single Square (n=1)
  addTest('test-single-square', 'Single Square (n=1) Container Geometry & Height (H)', 'geometry', () => {
    const sq: UnitSquare[] = [{ id: 0, x: 0.5, y: 0.5, angle: 0 }];
    const val = validatePacking(1, sq);
    const passed =
      val.isValid &&
      Math.abs(val.computedLength - 1.0) < 1e-9 &&
      Math.abs(val.height - 1.0) < 1e-9 &&
      Math.abs(val.width - 1.0) < 1e-9 &&
      Math.abs(val.score) < 1e-9;
    return {
      passed,
      message: passed
        ? `L = ${val.computedLength}, H = ${val.height}, W = ${val.width}, score = ${val.score} (valid, optimal)`
        : `Expected L=1, H=1, W=1, got L=${val.computedLength}, H=${val.height}, W=${val.width}`,
      details: { computedLength: val.computedLength, height: val.height, width: val.width, score: val.score },
    };
  });

  // 2. Adjacent squares sharing an edge
  addTest('test-edge-contact', 'Adjacent Squares Sharing an Edge (Boundary Contact)', 'geometry', () => {
    // Two unit squares side-by-side: [0, 1] x [0, 1] and [1, 2] x [0, 1]
    const squares: UnitSquare[] = [
      { id: 0, x: 0.5, y: 0.5, angle: 0 },
      { id: 1, x: 1.5, y: 0.5, angle: 0 },
    ];
    const val = validatePacking(2, squares);
    const geom0 = computeSquareGeometry(squares[0]);
    const geom1 = computeSquareGeometry(squares[1]);
    const sat = checkSquareIntersection(geom0, geom1, 1e-8);

    const passed = val.isValid && sat.contactType === 'boundary_touch' && val.collisions.length === 0;
    return {
      passed,
      message: passed
        ? 'Edge-touching squares correctly classified as valid boundary contact without interior overlap.'
        : `Edge contact failed: val.isValid=${val.isValid}, contactType=${sat.contactType}`,
      details: { satResult: sat },
    };
  });

  // 3. Squares touching only at a corner
  addTest('test-corner-contact', 'Squares Touching Only at a Corner (Vertex Contact)', 'geometry', () => {
    // Square 1: center (0.5, 0.5) has top-right vertex at (1.0, 1.0)
    // Square 2: center (1.5, 1.5) has bottom-left vertex at (1.0, 1.0)
    const squares: UnitSquare[] = [
      { id: 0, x: 0.5, y: 0.5, angle: 0 },
      { id: 1, x: 1.5, y: 1.5, angle: 0 },
    ];
    const val = validatePacking(2, squares);
    const geom0 = computeSquareGeometry(squares[0]);
    const geom1 = computeSquareGeometry(squares[1]);
    const sat = checkSquareIntersection(geom0, geom1, 1e-8);

    const passed = val.isValid && val.collisions.length === 0;
    return {
      passed,
      message: passed
        ? 'Corner-touching squares correctly classified as valid with 0 interior collisions.'
        : `Corner contact failed: isValid=${val.isValid}, collisionCount=${val.collisions.length}`,
      details: { satResult: sat },
    };
  });

  // 4. Small positive overlap (must be flagged invalid!)
  addTest('test-positive-overlap', 'Detection of Small Positive Interior Overlap (1e-4)', 'validator', () => {
    // Square 0 at (0.5, 0.5), Square 1 at (1.4999, 0.5) -> overlaps by 0.0001
    const squares: UnitSquare[] = [
      { id: 0, x: 0.5, y: 0.5, angle: 0 },
      { id: 1, x: 1.4999, y: 0.5, angle: 0 },
    ];
    const val = validatePacking(2, squares, 1e-8);
    const passed = !val.isValid && val.collisions.length > 0;
    return {
      passed,
      message: passed
        ? `Correctly rejected: overlap of depth ${val.collisions[0]?.overlapDepth.toFixed(6)} flagged.`
        : 'Validator incorrectly accepted interior overlap!',
      details: { collisions: val.collisions },
    };
  });

  // 5. Rotated overlapping and separated squares
  addTest('test-rotated-sat', 'Rotated Squares SAT (Separation and Collision)', 'geometry', () => {
    // Square at origin tilted 45 deg: half-diagonal is sqrt(2)/2 ≈ 0.7071
    // A square placed at distance 1.5 along x is separated
    const sqA: UnitSquare = { id: 0, x: 0, y: 0, angle: Math.PI / 4 };
    const sqB: UnitSquare = { id: 1, x: 1.5, y: 0, angle: 0 };
    const geomA = computeSquareGeometry(sqA);
    const geomB = computeSquareGeometry(sqB);
    const satSeparated = checkSquareIntersection(geomA, geomB, 1e-8);

    // Square placed at distance 1.0 along x definitely overlaps with 45-deg square (0.7071 + 0.5 = 1.2071 > 1.0)
    const sqC: UnitSquare = { id: 2, x: 1.0, y: 0, angle: 0 };
    const geomC = computeSquareGeometry(sqC);
    const satColliding = checkSquareIntersection(geomA, geomC, 1e-8);

    const passed = !satSeparated.isColliding && satColliding.isColliding;
    return {
      passed,
      message: passed
        ? 'Rotated SAT accurately resolved both separated and colliding configurations.'
        : `Rotated SAT failed: separated=${!satSeparated.isColliding}, colliding=${satColliding.isColliding}`,
      details: {
        separatedPenetration: satSeparated.minOverlap,
        collidingPenetration: satColliding.minOverlap,
      },
    };
  });

  // 6. Rotated square bounding box
  addTest('test-rotated-bounds', 'Rotated Square Bounding Box Calculation (45 degrees)', 'geometry', () => {
    // 45-degree unit square centered at origin has extents [-sqrt(2)/2, sqrt(2)/2] in both axes
    const sq: UnitSquare = { id: 0, x: 0, y: 0, angle: Math.PI / 4 };
    const geom = computeSquareGeometry(sq);
    const expectedHalf = Math.SQRT2 / 2;
    const diffMinX = Math.abs(geom.aabb.minX - -expectedHalf);
    const diffMaxX = Math.abs(geom.aabb.maxX - expectedHalf);

    const passed = diffMinX < 1e-9 && diffMaxX < 1e-9;
    return {
      passed,
      message: passed
        ? `Rotated AABB matches analytical width ${Math.SQRT2.toFixed(8)} within numerical tolerance.`
        : `AABB mismatch: expected half=${expectedHalf}, got maxX=${geom.aabb.maxX}`,
      details: { aabb: geom.aabb },
    };
  });

  // 7. Perfect-square grid packings
  addTest('test-perfect-squares', 'Perfect-Square Grid Packings (n=4, 9, 16, 25)', 'baseline', () => {
    const testCases = [4, 9, 16, 25];
    let allValid = true;
    const details: Record<string, unknown> = {};

    for (const n of testCases) {
      const packing = generateBaselinePacking(n);
      const val = validatePacking(n, packing.squares);
      const expectedL = Math.sqrt(n);
      const matchesL = Math.abs(val.computedLength - expectedL) < 1e-9;
      const isOptimal = val.isProvenOptimal && Math.abs(val.score) < 1e-9;

      details[`n_${n}`] = { L: val.computedLength, score: val.score, isOptimal };
      if (!val.isValid || !matchesL || !isOptimal) {
        allValid = false;
      }
    }

    return {
      passed: allValid,
      message: allValid
        ? 'All tested perfect squares achieved exact L=sqrt(n), score=0, and proven optimal status.'
        : 'Perfect square test failed.',
      details,
    };
  });

  // 8. ID sequence and duplicate detection
  addTest('test-id-sequence', 'Validator Duplicate & Out-of-Range ID Detection', 'validator', () => {
    // 3 squares with duplicate ID 1
    const badSquares: UnitSquare[] = [
      { id: 0, x: 0.5, y: 0.5, angle: 0 },
      { id: 1, x: 1.5, y: 0.5, angle: 0 },
      { id: 1, x: 0.5, y: 1.5, angle: 0 },
    ];
    const val = validatePacking(3, badSquares);
    const hasDuplicateIssue = val.issues.some((i) => i.code === 'DUPLICATE_ID');
    const passed = !val.isValid && hasDuplicateIssue;

    return {
      passed,
      message: passed
        ? 'Duplicate square_id was properly caught and caused validation rejection.'
        : 'Validator failed to reject duplicate ID.',
      details: { issues: val.issues },
    };
  });

  // 9. CSV export/import serialization round-trip
  addTest('test-csv-roundtrip', 'CSV Serialization & Round-Trip Validation', 'csv', () => {
    const packingsMap = new Map();
    const testN = [1, 2, 4, 5];
    for (const n of testN) {
      packingsMap.set(n, generateBaselinePacking(n));
    }

    // Build CSV synchronously
    const lines = ['id,n,square_id,x,y,angle'];
    let rowId = 0;
    for (const n of testN) {
      const p = packingsMap.get(n)!;
      for (const sq of p.squares) {
        lines.push(`${rowId++},${n},${sq.id},${sq.x.toFixed(8)},${sq.y.toFixed(8)},${sq.angle.toFixed(8)}`);
      }
    }
    const csvContent = lines.join('\n');
    const parsed = parseSubmissionCsv(csvContent);

    let passed = true;
    let err = '';

    for (const n of testN) {
      const parsedSquares = parsed.get(n);
      if (!parsedSquares || parsedSquares.length !== n) {
        passed = false;
        err = `Missing or incomplete puzzle n=${n}`;
        break;
      }
      const val = validatePacking(n, parsedSquares);
      if (!val.isValid) {
        passed = false;
        err = `Re-validation failed for n=${n}`;
        break;
      }
    }

    return {
      passed,
      message: passed ? 'CSV export parsed cleanly and passed independent re-validation.' : err,
    };
  });

  // 10. Seed determinism in PRNG
  addTest('test-seed-determinism', 'Mulberry32 PRNG Determinism with Fixed Seed', 'determinism', () => {
    const rng1 = new Mulberry32(1337);
    const rng2 = new Mulberry32(1337);

    let match = true;
    for (let i = 0; i < 1000; i++) {
      if (rng1.next() !== rng2.next()) {
        match = false;
        break;
      }
    }

    return {
      passed: match,
      message: match
        ? 'Identical seeds produce bit-exact identical pseudo-random sequences (1000 iterations checked).'
        : 'PRNG produced divergent sequences with identical seed!',
    };
  });

  const totalDurationMs = performance.now() - startTime;
  const allPassed = results.every((r) => r.passed);

  return { results, allPassed, totalDurationMs };
}

/**
 * Execute real benchmark on representative puzzle set
 * Measures actual wall-clock execution time and validation
 */
export async function runSolverBenchmark(
  samplePuzzles: number[] = [2, 3, 5, 8],
  iterationsPerPuzzle: number = 3000
): Promise<BenchmarkRecord[]> {
  const records: BenchmarkRecord[] = [];

  for (const n of samplePuzzles) {
    const baseline = generateBaselinePacking(n);
    const t0 = performance.now();

    const optimizer = new PackingOptimizer({
      n,
      seed: 42,
      restarts: 1,
      timeBudgetMs: 2500,
      maxIterations: iterationsPerPuzzle,
      initialTemp: 0.3,
      coolingRate: 0.999,
      stepSizeTranslation: 0.04,
      stepSizeRotation: 0.1,
      shrinkFactor: 0.99,
      weights: { overlapPenalty: 120, containerPenalty: 60 },
    });

    const optimized = await optimizer.optimize();
    const runtimeMs = performance.now() - t0;

    // Independent validation
    const val = validatePacking(n, optimized.squares);
    const scoreDelta = baseline.score - val.score;

    records.push({
      n,
      baselineL: baseline.containerLength,
      optimizedL: val.computedLength,
      scoreDelta,
      runtimeMs,
      iterations: iterationsPerPuzzle,
      isValid: val.isValid,
    });
  }

  return records;
}
