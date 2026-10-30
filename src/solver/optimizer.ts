/**
 * Optimization Engine for Unit Square Packing
 * 
 * Implements:
 * 1. Progressive Container Shrinkage with Simulated Annealing
 * 2. Incremental SAT energy computation using local neighborhood updates
 * 3. Multi-move repertoire: fine translations, angle perturbations, canonical 45°/30° snaps,
 *    and centroid boundary compaction
 * 4. Strictly saves only independently validated improvements
 * 5. Full support for reproducible seeds, restarts, time budgets, pause/resume, and cancellation
 */

import { UnitSquare, Packing, OptimizationParams, OptimizationProgress, RotatedSquareGeometry } from '../types';
import { Mulberry32 } from './prng';
import {
  computeSquareGeometry,
  checkSquareIntersection,
  computeEnclosingBoundingBox,
} from '../geometry/sat';
import { SpatialHashGrid } from '../geometry/spatialHash';
import { validatePacking } from '../geometry/validator';
import { globalMetricEngine } from '../metrics/config';
import { generateBaselinePacking } from './baseline';
import { getAnalyticalImprovement } from './analyticalPatterns';

export interface SolverStepResult {
  improved: boolean;
  bestPacking: Packing;
  progress: OptimizationProgress;
}

export class PackingOptimizer {
  private params: OptimizationParams;
  private prng: Mulberry32;
  private isCancelled: boolean = false;
  private isPaused: boolean = false;
  private bestValidatedPacking: Packing;

  constructor(params: OptimizationParams) {
    this.params = params;
    this.prng = new Mulberry32(params.seed);
    
    // Ensure we start with a valid baseline if not provided
    if (params.initialPacking && params.initialPacking.squares.length === params.n) {
      this.bestValidatedPacking = params.initialPacking;
    } else {
      this.bestValidatedPacking = generateBaselinePacking(params.n);
    }
  }

  public cancel(): void {
    this.isCancelled = true;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public getBestValidatedPacking(): Packing {
    return this.bestValidatedPacking;
  }

  /**
   * Run optimization with callback reporting
   */
  public async optimize(
    onProgress?: (progress: OptimizationProgress, currentCandidate?: Packing) => void
  ): Promise<Packing> {
    this.isCancelled = false;
    this.isPaused = false;

    const n = this.params.n;

    // Perfect squares already achieve proven theoretical lower bound L = sqrt(n).
    // No algorithm can improve upon this, so return immediately with explanation.
    if (globalMetricEngine.isPerfectSquare(n)) {
      const best = generateBaselinePacking(n);
      this.bestValidatedPacking = best;
      if (onProgress) {
        onProgress({
          n,
          restart: 0,
          iteration: 0,
          currentL: best.containerLength,
          bestL: best.containerLength,
          currentOverlap: 0,
          temperature: 0,
          elapsedMs: 0,
          movesAccepted: 0,
          movesTotal: 0,
          state: 'completed',
        });
      }
      return best;
    }

    // Check if an analytical record or tilted lattice construction exists for n
    const analytical = getAnalyticalImprovement(n);
    if (analytical && analytical.containerLength < this.bestValidatedPacking.containerLength - 1e-4) {
      this.bestValidatedPacking = analytical;
    }

    const startTime = Date.now();
    const timeLimitMs = this.params.timeBudgetMs || 15000;
    const restarts = Math.max(1, this.params.restarts || 3);

    for (let restart = 0; restart < restarts; restart++) {
      if (this.isCancelled) break;

      // Seed setup for restart
      const restartSeed = (this.params.seed + restart * 7919) >>> 0;
      this.prng.setSeed(restartSeed);

      // Initialize candidate squares
      let currentSquares = this.initializeCandidate(n, restart);
      let geometries = currentSquares.map((sq) => computeSquareGeometry(sq));
      const spatialHash = new SpatialHashGrid(1.6);
      spatialHash.rebuild(geometries);

      // Target container length: attempt a step reduction below best known L
      let targetL = Math.min(
        this.bestValidatedPacking.containerLength * (this.params.shrinkFactor || 0.995),
        this.bestValidatedPacking.containerLength - 0.005
      );

      // Lower bound constraint
      const minTheoreticalL = Math.sqrt(n);
      if (targetL < minTheoreticalL) {
        targetL = minTheoreticalL;
      }

      let temperature = this.params.initialTemp || 0.5;
      const coolingRate = this.params.coolingRate || 0.9995;
      let movesTotal = 0;
      let movesAccepted = 0;

      const maxIter = this.params.maxIterations || 40000;

      for (let iter = 0; iter < maxIter; iter++) {
        if (this.isCancelled) break;

        // Check time budget
        const elapsed = Date.now() - startTime;
        if (elapsed > timeLimitMs) {
          break;
        }

        // Cooperative pause
        while (this.isPaused && !this.isCancelled) {
          await new Promise((r) => setTimeout(r, 100));
        }

        movesTotal++;

        // Pick a random square to mutate
        const sqIndex = this.prng.nextInt(0, n - 1);
        const oldSq = currentSquares[sqIndex];
        const oldGeom = geometries[sqIndex];

        // Compute local energy before move
        const oldEnergy = this.computeSquareLocalEnergy(sqIndex, oldGeom, geometries, spatialHash, targetL);

        // Mutate square
        const moveType = this.prng.next();
        let newX = oldSq.x;
        let newY = oldSq.y;
        let newAngle = oldSq.angle;

        if (oldEnergy > 1e-6 && this.prng.next() < 0.5) {
          // Physics-based collision repulsion: push square directly away from overlapping neighbors
          let pushX = 0;
          let pushY = 0;
          const candidates = spatialHash.queryCandidates(oldGeom, true);
          for (const cId of candidates) {
            const other = geometries[cId];
            if (!other) continue;
            const sat = checkSquareIntersection(oldGeom, other, 1e-8);
            if (sat.isColliding) {
              const dx = oldSq.x - currentSquares[cId].x;
              const dy = oldSq.y - currentSquares[cId].y;
              const dist = Math.hypot(dx, dy) || 0.05;
              const force = Math.min(0.15, (sat.minOverlap + 0.02) * 1.8);
              pushX += (dx / dist) * force;
              pushY += (dy / dist) * force;
            }
          }
          // Boundary push if violating target container [0, targetL]
          if (oldGeom.aabb.minX < 0) pushX += (0 - oldGeom.aabb.minX) * 0.4;
          if (oldGeom.aabb.maxX > targetL) pushX -= (oldGeom.aabb.maxX - targetL) * 0.4;
          if (oldGeom.aabb.minY < 0) pushY += (0 - oldGeom.aabb.minY) * 0.4;
          if (oldGeom.aabb.maxY > targetL) pushY -= (oldGeom.aabb.maxY - targetL) * 0.4;

          newX += pushX;
          newY += pushY;
        } else if (moveType < 0.50) {
          // Fine translation
          const step = this.params.stepSizeTranslation || 0.05;
          newX += this.prng.nextGaussian(0, step * Math.max(0.1, temperature));
          newY += this.prng.nextGaussian(0, step * Math.max(0.1, temperature));
        } else if (moveType < 0.80) {
          // Fine rotation
          const stepAngle = this.params.stepSizeRotation || 0.1;
          newAngle += this.prng.nextGaussian(0, stepAngle * Math.max(0.1, temperature));
          // Normalize angle to [-PI, PI]
          newAngle = Math.atan2(Math.sin(newAngle), Math.cos(newAngle));
        } else if (moveType < 0.92) {
          // Canonical angle snap (0, 45°, 30°, 60°)
          const snaps = [0, Math.PI / 4, Math.PI / 6, Math.PI / 3, -Math.PI / 4];
          newAngle = snaps[this.prng.nextInt(0, snaps.length - 1)];
        } else {
          // Boundary compression: pull gently toward center of target box [0, targetL]
          const centerX = targetL * 0.5;
          const centerY = targetL * 0.5;
          newX += (centerX - newX) * 0.06 * this.prng.next();
          newY += (centerY - newY) * 0.06 * this.prng.next();
        }

        const candidateSq: UnitSquare = {
          id: sqIndex,
          x: newX,
          y: newY,
          angle: newAngle,
        };
        const candidateGeom = computeSquareGeometry(candidateSq);

        // Temporarily put candidate geometry
        geometries[sqIndex] = candidateGeom;
        const newEnergy = this.computeSquareLocalEnergy(sqIndex, candidateGeom, geometries, spatialHash, targetL);

        const deltaE = newEnergy - oldEnergy;
        let accept = false;

        if (deltaE <= 0) {
          accept = true;
        } else if (temperature > 1e-6) {
          const prob = Math.exp(-deltaE / temperature);
          if (this.prng.next() < prob) {
            accept = true;
          }
        }

        if (accept) {
          movesAccepted++;
          currentSquares[sqIndex] = candidateSq;
          // Re-insert into spatial hash
          spatialHash.insert(candidateGeom);
        } else {
          // Revert geometry
          geometries[sqIndex] = oldGeom;
        }

        // Cool temperature
        temperature *= coolingRate;

        // Periodic full check & report
        if (iter % 300 === 0 || iter === maxIter - 1) {
          // Periodically re-pack spatial hash to keep it tidy
          spatialHash.rebuild(geometries);

          const bbox = computeEnclosingBoundingBox(geometries);
          const currentCandidateL = bbox.length;

          // If current configuration fits in smaller length and has low overlap,
          // run strict independent validation!
          if (currentCandidateL < this.bestValidatedPacking.containerLength - 1e-4) {
            const val = validatePacking(n, currentSquares);
            if (val.isValid && val.computedLength < this.bestValidatedPacking.containerLength) {
              // Strictly verified local improvement!
              this.bestValidatedPacking = {
                n,
                squares: currentSquares.map((s) => ({ ...s })),
                containerLength: val.computedLength,
                score: val.score,
                status: 'improved',
                isProvenOptimal: val.isProvenOptimal,
                notes: `Validated improvement: L reduced from ${this.bestValidatedPacking.containerLength.toFixed(5)} to ${val.computedLength.toFixed(5)}.`,
                seed: restartSeed,
                iterations: iter,
                timestamp: Date.now(),
              };

              // Lower target L further to aggressively search for even smaller packings
              targetL = Math.max(minTheoreticalL, val.computedLength * (this.params.shrinkFactor || 0.995));
            }
          }

          if (onProgress) {
            onProgress({
              n,
              restart,
              iteration: iter,
              currentL: currentCandidateL,
              bestL: this.bestValidatedPacking.containerLength,
              currentOverlap: newEnergy,
              temperature,
              elapsedMs: Date.now() - startTime,
              movesAccepted,
              movesTotal,
              state: 'running',
            });
          }

          // Yield to event loop periodically
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
    }

    if (onProgress) {
      onProgress({
        n,
        restart: restarts,
        iteration: this.params.maxIterations || 40000,
        currentL: this.bestValidatedPacking.containerLength,
        bestL: this.bestValidatedPacking.containerLength,
        currentOverlap: 0,
        temperature: 0,
        elapsedMs: Date.now() - startTime,
        movesAccepted: 0,
        movesTotal: 0,
        state: 'completed',
      });
    }

    return this.bestValidatedPacking;
  }

  /**
   * Initialize candidate configuration:
   * Restart 0: start from best validated packing
   * Restart 1: diagonal 45-degree tilted arrangement
   * Restart 2+: perturbed baseline with jitter
   */
  private initializeCandidate(n: number, restartIndex: number): UnitSquare[] {
    if (restartIndex === 0 && this.bestValidatedPacking) {
      return this.bestValidatedPacking.squares.map((s) => ({ ...s }));
    }

    const baseline = generateBaselinePacking(n);

    if (restartIndex === 1 && n <= 10) {
      // For small n, try a 45-degree tilt
      return baseline.squares.map((s) => ({
        ...s,
        angle: Math.PI / 4,
      }));
    }

    // Default: jittered baseline
    return baseline.squares.map((s) => {
      const jitterX = this.prng.nextGaussian(0, 0.05);
      const jitterY = this.prng.nextGaussian(0, 0.05);
      const angle = restartIndex % 2 === 1 ? Math.PI / 4 : 0;
      return {
        ...s,
        x: s.x + jitterX,
        y: s.y + jitterY,
        angle,
      };
    });
  }

  /**
   * Computes local energy for a single square:
   * Sum of squared overlap depths with neighbors + boundary penalty if outside [0, targetL]
   */
  private computeSquareLocalEnergy(
    sqIndex: number,
    geom: RotatedSquareGeometry,
    allGeometries: RotatedSquareGeometry[],
    spatialHash: SpatialHashGrid,
    targetL: number
  ): number {
    let energy = 0;
    const candidates = spatialHash.queryCandidates(geom, true);

    const overlapWeight = this.params.weights?.overlapPenalty || 100.0;
    const containerWeight = this.params.weights?.containerPenalty || 50.0;

    for (let i = 0; i < candidates.length; i++) {
      const otherId = candidates[i];
      if (otherId === sqIndex) continue;
      const otherGeom = allGeometries[otherId];
      if (!otherGeom) continue;

      const sat = checkSquareIntersection(geom, otherGeom, 1e-8);
      if (sat.isColliding) {
        energy += overlapWeight * (sat.minOverlap * sat.minOverlap);
      }
    }

    // Boundary penalty: penalize exceeding targetL square container
    // We assume container is [0, targetL] x [0, targetL]
    const aabb = geom.aabb;
    if (aabb.minX < 0) energy += containerWeight * (aabb.minX * aabb.minX);
    if (aabb.maxX > targetL) energy += containerWeight * Math.pow(aabb.maxX - targetL, 2);
    if (aabb.minY < 0) energy += containerWeight * (aabb.minY * aabb.minY);
    if (aabb.maxY > targetL) energy += containerWeight * Math.pow(aabb.maxY - targetL, 2);

    return energy;
  }
}
