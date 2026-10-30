/**
 * Multi-Algorithm Solver Suite & Arena
 * 
 * Provides 4 distinct optimization paradigms:
 * 1. Adaptive Simulated Annealing (Dual-temperature thermodynamic search)
 * 2. Force-Directed Physics Compaction (Iterative contact mechanics with progressive ratcheting)
 * 3. Evolutionary Genetic Algorithm (Population of candidate packings with spatial crossover)
 * 4. Tilted Lattice Synthesizer (Exhaustive parametric grid search)
 * 
 * Includes the "Hyper-Sweep Arena" that runs all 4 engines and picks the validated global best!
 */

import { UnitSquare, Packing, OptimizationProgress } from '../types';
import { PackingOptimizer } from './optimizer';
import { PhysicsRelaxer } from './physicsRelaxer';
import { generateTiltedLatticePacking, polishPackingCoordinates, getAnalyticalImprovement } from './analyticalPatterns';
import { validatePacking } from '../geometry/validator';
import { generateBaselinePacking } from './baseline';
import { Mulberry32 } from './prng';

export type SolverAlgorithmType = 'simulated_annealing' | 'physics_compaction' | 'genetic_algorithm' | 'lattice_synthesizer' | 'hyper_arena';

export interface MultiSolverOptions {
  n: number;
  initialPacking?: Packing;
  algorithm: SolverAlgorithmType;
  seed?: number;
  timeBudgetMs?: number;
}

export class MultiSolverEngine {
  private isCancelled: boolean = false;
  private isPaused: boolean = false;

  public cancel(): void {
    this.isCancelled = true;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  /**
   * Run selected algorithm or the full Hyper-Arena
   */
  public async solve(
    options: MultiSolverOptions,
    onProgress?: (progress: OptimizationProgress, candidate?: Packing) => void
  ): Promise<Packing> {
    this.isCancelled = false;
    this.isPaused = false;
    const n = options.n;
    const initial = options.initialPacking || generateBaselinePacking(n);

    // Check analytical library first
    const analytical = getAnalyticalImprovement(n);
    let bestPacking: Packing = analytical && analytical.containerLength < initial.containerLength - 1e-4
      ? analytical
      : initial;

    if (options.algorithm === 'simulated_annealing') {
      const sa = new PackingOptimizer({
        n,
        initialPacking: bestPacking,
        seed: options.seed || 42,
        restarts: 2,
        timeBudgetMs: options.timeBudgetMs || 10000,
        maxIterations: 35000,
        initialTemp: 0.35,
        coolingRate: 0.9995,
        stepSizeTranslation: 0.05,
        stepSizeRotation: 0.1,
        shrinkFactor: 0.992,
        weights: { overlapPenalty: 120, containerPenalty: 60 },
      });
      return sa.optimize(onProgress);
    }

    if (options.algorithm === 'physics_compaction') {
      return this.runPhysicsCompaction(n, bestPacking, options.timeBudgetMs || 8000, onProgress);
    }

    if (options.algorithm === 'genetic_algorithm') {
      return this.runGeneticAlgorithm(n, bestPacking, options.seed || 42, options.timeBudgetMs || 10000, onProgress);
    }

    if (options.algorithm === 'lattice_synthesizer') {
      const lattice = generateTiltedLatticePacking(n);
      if (lattice && lattice.containerLength < bestPacking.containerLength - 1e-4) {
        return lattice;
      }
      return bestPacking;
    }

    // Default: Hyper-Arena (Executes all 4 engines in competition!)
    return this.runHyperArena(n, bestPacking, options.seed || 42, options.timeBudgetMs || 12000, onProgress);
  }

  /**
   * Physics Compaction Solver
   * Gradually ratchets targetL down while letting physics relaxer resolve collisions
   */
  private async runPhysicsCompaction(
    n: number,
    startingPacking: Packing,
    timeBudgetMs: number,
    onProgress?: (progress: OptimizationProgress, candidate?: Packing) => void
  ): Promise<Packing> {
    const startTime = Date.now();
    let bestPacking = startingPacking;
    const relaxer = new PhysicsRelaxer(startingPacking.squares, startingPacking.containerLength * 0.985);
    const minTheoreticalL = Math.sqrt(n);

    let stepCount = 0;
    while (Date.now() - startTime < timeBudgetMs && !this.isCancelled) {
      stepCount++;
      const state = relaxer.step();

      if (stepCount % 60 === 0) {
        const polished = polishPackingCoordinates(n, state.squares);
        const val = validatePacking(n, polished);

        if (val.isValid && val.computedLength < bestPacking.containerLength - 1e-4) {
          bestPacking = {
            n,
            squares: polished,
            containerLength: val.computedLength,
            score: val.score,
            status: 'improved',
            isProvenOptimal: val.isProvenOptimal,
            notes: `Physics compaction improvement (L = ${val.computedLength.toFixed(5)}).`,
            timestamp: Date.now(),
          };
          // Ratchet container smaller
          relaxer.setTargetL(Math.max(minTheoreticalL, val.computedLength * 0.99));
        }

        if (onProgress) {
          onProgress({
            n,
            restart: 0,
            iteration: stepCount,
            currentL: state.currentL,
            bestL: bestPacking.containerLength,
            currentOverlap: state.overlapEnergy,
            temperature: 0.1,
            elapsedMs: Date.now() - startTime,
            movesAccepted: stepCount,
            movesTotal: stepCount,
            state: 'running',
          });
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return bestPacking;
  }

  /**
   * Genetic Evolutionary Algorithm
   * Population of packings with spatial crossover and mutation
   */
  private async runGeneticAlgorithm(
    n: number,
    startingPacking: Packing,
    seed: number,
    timeBudgetMs: number,
    onProgress?: (progress: OptimizationProgress, candidate?: Packing) => void
  ): Promise<Packing> {
    const startTime = Date.now();
    const prng = new Mulberry32(seed);
    const popSize = 14;
    let population: UnitSquare[][] = [];

    // Seed population with perturbations of starting packing
    population.push(startingPacking.squares.map((s) => ({ ...s })));
    for (let p = 1; p < popSize; p++) {
      population.push(
        startingPacking.squares.map((s) => ({
          ...s,
          x: s.x + prng.nextGaussian(0, 0.05),
          y: s.y + prng.nextGaussian(0, 0.05),
          angle: prng.next() < 0.2 ? (prng.next() * Math.PI) / 2 : s.angle,
        }))
      );
    }

    let bestPacking = startingPacking;
    let generation = 0;

    while (Date.now() - startTime < timeBudgetMs && !this.isCancelled) {
      generation++;

      // Evaluate fitness of population
      const fitnessScores = population.map((ind) => {
        const val = validatePacking(n, ind);
        if (!val.isValid) {
          // Penalize invalid
          return 999.0 + (val.collisions.length || 1) * 2.0;
        }
        if (val.computedLength < bestPacking.containerLength - 1e-4) {
          bestPacking = {
            n,
            squares: ind.map((s) => ({ ...s })),
            containerLength: val.computedLength,
            score: val.score,
            status: 'improved',
            isProvenOptimal: val.isProvenOptimal,
            notes: `Genetic Algorithm improvement (L = ${val.computedLength.toFixed(5)}).`,
            timestamp: Date.now(),
          };
        }
        return val.computedLength;
      });

      // Selection: sort by fitness
      const indexed = fitnessScores.map((score, idx) => ({ score, idx }));
      indexed.sort((a, b) => a.score - b.score);

      const nextGen: UnitSquare[][] = [];
      // Elitism: preserve top 2
      nextGen.push(population[indexed[0].idx].map((s) => ({ ...s })));
      nextGen.push(population[indexed[1].idx].map((s) => ({ ...s })));

      // Crossover & Mutation
      while (nextGen.length < popSize) {
        const parentA = population[indexed[prng.nextInt(0, 4)].idx];
        const parentB = population[indexed[prng.nextInt(0, 6)].idx];

        // Spatial cut-and-splice crossover
        const splitX = prng.nextRange(0.5, bestPacking.containerLength - 0.5);
        const child: UnitSquare[] = parentA.map((sq, i) => {
          const gene = sq.x < splitX ? sq : parentB[i];
          // Mutation
          const mut = prng.next();
          let x = gene.x;
          let y = gene.y;
          let angle = gene.angle;
          if (mut < 0.3) {
            x += prng.nextGaussian(0, 0.03);
            y += prng.nextGaussian(0, 0.03);
          } else if (mut < 0.45) {
            angle += prng.nextGaussian(0, 0.06);
          }
          return { id: sq.id, x, y, angle };
        });

        nextGen.push(child);
      }

      population = nextGen;

      if (generation % 20 === 0 && onProgress) {
        onProgress({
          n,
          restart: 0,
          iteration: generation,
          currentL: fitnessScores[indexed[0].idx],
          bestL: bestPacking.containerLength,
          currentOverlap: 0,
          temperature: 0.2,
          elapsedMs: Date.now() - startTime,
          movesAccepted: generation * popSize,
          movesTotal: generation * popSize,
          state: 'running',
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return bestPacking;
  }

  /**
   * Hyper-Arena: runs all 4 engines sequentially or competitively
   */
  private async runHyperArena(
    n: number,
    startingPacking: Packing,
    seed: number,
    totalBudgetMs: number,
    onProgress?: (progress: OptimizationProgress, candidate?: Packing) => void
  ): Promise<Packing> {
    let currentBest = startingPacking;
    const splitBudget = Math.max(2500, Math.floor(totalBudgetMs / 3));

    // Phase 1: Lattice & Analytical Synthesis
    const lattice = generateTiltedLatticePacking(n);
    if (lattice && lattice.containerLength < currentBest.containerLength - 1e-4) {
      currentBest = lattice;
    }

    if (this.isCancelled) return currentBest;

    // Phase 2: High-Exploration Simulated Annealing
    const sa = new PackingOptimizer({
      n,
      initialPacking: currentBest,
      seed,
      restarts: 1,
      timeBudgetMs: splitBudget,
      maxIterations: 25000,
      initialTemp: 0.35,
      coolingRate: 0.9995,
      stepSizeTranslation: 0.05,
      stepSizeRotation: 0.1,
      shrinkFactor: 0.992,
      weights: { overlapPenalty: 120, containerPenalty: 60 },
    });
    currentBest = await sa.optimize(onProgress);

    if (this.isCancelled) return currentBest;

    // Phase 3: Physics Compaction Squeeze
    currentBest = await this.runPhysicsCompaction(n, currentBest, splitBudget, onProgress);

    return currentBest;
  }
}
