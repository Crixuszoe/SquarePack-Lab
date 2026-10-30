/**
 * Independent Packing Geometry & Submission Validator
 * 
 * Recomputes all geometry from scratch directly from raw coordinate inputs.
 * Strictly verifies:
 * 1. Exactly n squares
 * 2. Unique square_id values 0..n-1
 * 3. Finite numeric x, y, and angle values (no NaN, Infinity)
 * 4. Rotated SAT separating axis checks for all broad-phase overlapping pairs
 * 5. Boundary contact (overlap <= tolerance) is permitted; interior overlap (> tolerance) is rejected
 * 6. Computes exact container length L = max(maxX - minX, maxY - minY)
 * 7. Computes score = L / sqrt(n) - 1
 */

import { UnitSquare, ValidationResult, CollisionPair, ValidationIssue, RotatedSquareGeometry } from '../types';
import {
  computeSquareGeometry,
  checkSquareIntersection,
  computeEnclosingBoundingBox,
} from './sat';
import { SpatialHashGrid } from './spatialHash';
import { globalMetricEngine } from '../metrics/config';

export function validatePacking(
  n: number,
  squares: UnitSquare[],
  customTolerance?: number
): ValidationResult {
  const tolerance = customTolerance ?? globalMetricEngine.getConfig().overlapTolerance;
  const issues: ValidationIssue[] = [];
  const collisions: CollisionPair[] = [];

  // Rule 1: Exactly n squares
  if (squares.length !== n) {
    issues.push({
      severity: 'error',
      code: 'INVALID_SQUARE_COUNT',
      message: `Expected exactly ${n} squares, but received ${squares.length}.`,
      details: { expected: n, received: squares.length },
    });
  }

  // Rule 2 & 3: Check IDs, finiteness, NaN, Infinity
  const seenIds = new Set<number>();
  let hasNonFinite = false;

  for (let i = 0; i < squares.length; i++) {
    const sq = squares[i];
    if (sq == null) {
      issues.push({
        severity: 'error',
        code: 'NULL_SQUARE_OBJECT',
        message: `Square index ${i} is null or undefined.`,
      });
      continue;
    }

    if (!Number.isFinite(sq.x) || !Number.isFinite(sq.y) || !Number.isFinite(sq.angle)) {
      hasNonFinite = true;
      issues.push({
        severity: 'error',
        code: 'NON_FINITE_COORDINATE',
        message: `Square id ${sq.id} contains non-finite values (x: ${sq.x}, y: ${sq.y}, angle: ${sq.angle}).`,
      });
    }

    if (sq.id < 0 || sq.id >= n || !Number.isInteger(sq.id)) {
      issues.push({
        severity: 'error',
        code: 'OUT_OF_RANGE_ID',
        message: `Square id ${sq.id} is outside valid index range [0, ${n - 1}].`,
      });
    }

    if (seenIds.has(sq.id)) {
      issues.push({
        severity: 'error',
        code: 'DUPLICATE_ID',
        message: `Duplicate square id detected: ${sq.id}.`,
      });
    }
    seenIds.add(sq.id);
  }

  if (seenIds.size !== n && squares.length === n) {
    issues.push({
      severity: 'error',
      code: 'MISSING_IDS',
      message: `Expected ids 0 through ${n - 1}, but only ${seenIds.size} unique ids found.`,
    });
  }

  // If there are fatal coordinate errors, cannot proceed with geometric calculations
  if (hasNonFinite || squares.length === 0) {
    const areaLowerBound = Math.sqrt(n);
    return {
      isValid: false,
      n,
      squareCount: squares.length,
      computedLength: NaN,
      width: NaN,
      height: NaN,
      bindingAxis: 'balanced',
      score: NaN,
      areaLowerBound,
      isProvenOptimal: false,
      boundingBox: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
      collisions,
      issues,
      toleranceUsed: tolerance,
    };
  }

  // Recompute full rotated geometry
  const geometries: RotatedSquareGeometry[] = new Array(squares.length);
  for (let i = 0; i < squares.length; i++) {
    geometries[i] = computeSquareGeometry(squares[i]);
  }

  // Broad-phase spatial hashing
  const spatialHash = new SpatialHashGrid(1.6);
  spatialHash.rebuild(geometries);
  const candidatePairs = spatialHash.getCandidatePairs();

  // Create fast map of geometries by square.id
  const geomMap = new Map<number, RotatedSquareGeometry>();
  for (let i = 0; i < geometries.length; i++) {
    geomMap.set(geometries[i].id, geometries[i]);
  }

  // Narrow-phase SAT verification
  for (let p = 0; p < candidatePairs.length; p++) {
    const [idA, idB] = candidatePairs[p];
    const geomA = geomMap.get(idA);
    const geomB = geomMap.get(idB);

    if (!geomA || !geomB) continue;

    const satResult = checkSquareIntersection(geomA, geomB, tolerance);

    if (satResult.isColliding) {
      collisions.push({
        squareA: idA,
        squareB: idB,
        overlapDepth: satResult.minOverlap,
        contactType: 'interior_overlap',
      });
    } else if (satResult.contactType === 'boundary_touch') {
      // Boundary touch is legal! We can log it as info if desired
    }
  }

  if (collisions.length > 0) {
    issues.push({
      severity: 'error',
      code: 'INTERIOR_OVERLAP_DETECTED',
      message: `Detected ${collisions.length} pair(s) with interior overlap exceeding tolerance (${tolerance}).`,
      details: {
        collisionCount: collisions.length,
        maxOverlap: Math.max(...collisions.map((c) => c.overlapDepth)),
        pairs: collisions.slice(0, 10), // sample up to 10 pairs
      },
    });
  }

  // Compute overall enclosing bounding box & length
  const bbox = computeEnclosingBoundingBox(geometries);
  const computedLength = bbox.length;
  const width = bbox.width;
  const height = bbox.height;
  const bindingAxis: 'width' | 'height' | 'balanced' =
    Math.abs(width - height) < 1e-6 ? 'balanced' : width > height ? 'width' : 'height';

  const score = globalMetricEngine.computeScore(n, computedLength);
  const areaLowerBound = Math.sqrt(n);
  const isPerfectSquare = globalMetricEngine.isPerfectSquare(n);

  // Proven optimal if n is a perfect square and L equals sqrt(n) within numerical precision
  const isProvenOptimal = isPerfectSquare && Math.abs(computedLength - areaLowerBound) < 1e-7;

  const isValid = issues.filter((iss) => iss.severity === 'error').length === 0;

  return {
    isValid,
    n,
    squareCount: squares.length,
    computedLength,
    width,
    height,
    bindingAxis,
    score,
    areaLowerBound,
    isProvenOptimal,
    boundingBox: { minX: bbox.minX, maxX: bbox.maxX, minY: bbox.minY, maxY: bbox.maxY },
    collisions,
    issues,
    toleranceUsed: tolerance,
  };
}
