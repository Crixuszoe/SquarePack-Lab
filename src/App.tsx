/**
 * SquarePack Lab - Computational Geometry & Unit-Square Packing Application
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Packing, UnitSquare, OptimizationParams, OptimizationProgress, ValidationResult } from './types';
import { dbService } from './storage/db';
import { generateBaselinePacking, computeAnalyticalBaselineSummary } from './solver/baseline';
import { validatePacking } from './geometry/validator';
import { PackingOptimizer } from './solver/optimizer';
import { MultiSolverEngine } from './solver/multiSolver';
import { PhysicsRelaxer } from './solver/physicsRelaxer';
import { generateLiteraturePacking } from './solver/literatureRecords';
import { globalMetricEngine } from './metrics/config';

import { Header } from './components/Header';
import { CanvasViewer } from './components/CanvasViewer';
import { PuzzleSelector } from './components/PuzzleSelector';
import { SolverPanel } from './components/SolverPanel';
import { ValidationPanel } from './components/ValidationPanel';
import { ExportModal } from './components/ExportModal';
import { BenchmarkModal } from './components/BenchmarkModal';
import { MetricConfigModal } from './components/MetricConfigModal';
import { PythonSolverModal } from './components/PythonSolverModal';
import { LeaderboardGuideModal } from './components/LeaderboardGuideModal';
import { ScoreHeatmapModal } from './components/ScoreHeatmapModal';
import { SubmissionCompareModal } from './components/SubmissionCompareModal';
import { getAnalyticalImprovement } from './solver/analyticalPatterns';

export default function App() {
  // Current active puzzle (start at n=5 to showcase rotated non-grid packing potential!)
  const [currentN, setCurrentN] = useState<number>(5);

  // Stored packings map from IndexedDB
  const [storedPackings, setStoredPackings] = useState<Map<number, Packing>>(new Map());
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);

  // Live optimization states
  const [isOptimizing, setIsOptimizing] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [liveCandidateSquares, setLiveCandidateSquares] = useState<UnitSquare[] | null>(null);
  const [liveCandidateL, setLiveCandidateL] = useState<number | null>(null);
  const [progress, setProgress] = useState<OptimizationProgress | null>(null);

  // Active optimizer / solver instances ref
  const optimizerRef = useRef<PackingOptimizer | null>(null);
  const multiSolverRef = useRef<MultiSolverEngine | null>(null);

  // Modal open states
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showBenchmarkModal, setShowBenchmarkModal] = useState<boolean>(false);
  const [showMetricConfigModal, setShowMetricConfigModal] = useState<boolean>(false);
  const [showPythonSolverModal, setShowPythonSolverModal] = useState<boolean>(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState<boolean>(false);
  const [showHeatmapModal, setShowHeatmapModal] = useState<boolean>(false);
  const [showCompareModal, setShowCompareModal] = useState<boolean>(false);

  // Load stored packings from IndexedDB on startup
  const loadStoredPackings = useCallback(async () => {
    try {
      const packings = await dbService.getAllStoredPackings();

      // Automatically register known high-density analytical patterns if not already saved
      const defaultHighWins = [5, 10, 11, 12, 17, 26];
      for (const n of defaultHighWins) {
        if (!packings.has(n)) {
          const pattern = getAnalyticalImprovement(n);
          if (pattern) {
            await dbService.savePacking(pattern);
            packings.set(n, pattern);
          }
        }
      }

      setStoredPackings(packings);
      setIsDbLoaded(true);
    } catch (err) {
      console.error('Error loading packings from IndexedDB', err);
      setIsDbLoaded(true);
    }
  }, []);

  useEffect(() => {
    loadStoredPackings();
  }, [loadStoredPackings]);

  // Current active packing: from DB or baseline fallback
  const currentPacking = useMemo(() => {
    const fromMap = storedPackings.get(currentN);
    if (fromMap) return fromMap;
    return generateBaselinePacking(currentN);
  }, [currentN, storedPackings]);

  // Independent validation result for current displayed packing
  const currentValidation: ValidationResult = useMemo(() => {
    const squares = liveCandidateSquares || currentPacking.squares;
    return validatePacking(currentN, squares);
  }, [currentN, currentPacking, liveCandidateSquares]);

  // Compute global leaderboard competition statistics across all 1,000 puzzles
  const analyticalBaseline = useMemo(() => computeAnalyticalBaselineSummary(), []);

  const { totalScore, improvedCount, optimalCount } = useMemo(() => {
    let scoreSum = 0;
    let impCount = 0;
    let optCount = 0;

    for (let n = 1; n <= 1000; n++) {
      const p = storedPackings.get(n);
      const isOpt = globalMetricEngine.isPerfectSquare(n);
      if (isOpt) optCount++;

      if (p) {
        scoreSum += p.score;
        if (p.status === 'improved') {
          impCount++;
        }
      } else {
        const fallbackScore = globalMetricEngine.computeGridFallbackScore(n);
        scoreSum += fallbackScore;
      }
    }

    return {
      totalScore: scoreSum,
      improvedCount: impCount,
      optimalCount: optCount,
    };
  }, [storedPackings]);

  // Start single puzzle optimization via MultiSolverEngine
  const handleStartOptimize = async (params: OptimizationParams) => {
    if (isOptimizing) return;

    setIsOptimizing(true);
    setIsPaused(false);
    setLiveCandidateSquares(null);
    setLiveCandidateL(null);

    const solver = new MultiSolverEngine();
    multiSolverRef.current = solver;

    try {
      const best = await solver.solve(
        {
          n: params.n,
          initialPacking: currentPacking,
          algorithm: params.algorithm || 'hyper_arena',
          seed: params.seed,
          timeBudgetMs: params.timeBudgetMs,
        },
        (prog, candidate) => {
          setProgress(prog);
          if (candidate) {
            setLiveCandidateSquares(candidate.squares);
            setLiveCandidateL(candidate.containerLength);
          } else {
            setLiveCandidateL(prog.currentL);
          }
        }
      );

      // Independent validation before saving
      const val = validatePacking(params.n, best.squares);
      if (val.isValid && (best.status === 'improved' || val.isProvenOptimal || val.computedLength < currentPacking.containerLength - 1e-4)) {
        await dbService.savePacking(best);
        setStoredPackings((prev) => {
          const updated = new Map(prev);
          updated.set(params.n, best);
          return updated;
        });
      }
    } catch (err) {
      console.error('Optimization error:', err);
    } finally {
      setIsOptimizing(false);
      setIsPaused(false);
      setLiveCandidateSquares(null);
      setLiveCandidateL(null);
      multiSolverRef.current = null;
      optimizerRef.current = null;
    }
  };

  // Start batch range optimization
  const handleStartBatchOptimize = async (startN: number, endN: number, budgetPerPuzzle: number) => {
    if (isOptimizing) return;

    setIsOptimizing(true);
    setIsPaused(false);

    try {
      for (let n = startN; n <= endN; n++) {
        // Skip proven-optimal perfect squares
        if (globalMetricEngine.isPerfectSquare(n)) {
          continue;
        }

        setCurrentN(n);

        const initial = storedPackings.get(n) || generateBaselinePacking(n);
        const optimizer = new PackingOptimizer({
          n,
          initialPacking: initial,
          seed: 42 + n,
          restarts: 1,
          timeBudgetMs: budgetPerPuzzle * 1000,
          maxIterations: 30000,
          initialTemp: 0.35,
          coolingRate: 0.9995,
          stepSizeTranslation: 0.05,
          stepSizeRotation: 0.1,
          shrinkFactor: 0.992,
          weights: { overlapPenalty: 120, containerPenalty: 60 },
        });

        optimizerRef.current = optimizer;

        const best = await optimizer.optimize((prog, candidate) => {
          setProgress(prog);
          if (candidate) {
            setLiveCandidateSquares(candidate.squares);
            setLiveCandidateL(candidate.containerLength);
          }
        });

        const val = validatePacking(n, best.squares);
        if (val.isValid && best.status === 'improved') {
          await dbService.savePacking(best);
          setStoredPackings((prev) => {
            const updated = new Map(prev);
            updated.set(n, best);
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Batch error:', err);
    } finally {
      setIsOptimizing(false);
      setIsPaused(false);
      setLiveCandidateSquares(null);
      setLiveCandidateL(null);
      optimizerRef.current = null;
    }
  };

  const handlePauseResume = () => {
    if (multiSolverRef.current) {
      if (isPaused) {
        multiSolverRef.current.resume();
        setIsPaused(false);
      } else {
        multiSolverRef.current.pause();
        setIsPaused(true);
      }
      return;
    }

    if (optimizerRef.current) {
      if (isPaused) {
        optimizerRef.current.resume();
        setIsPaused(false);
      } else {
        optimizerRef.current.pause();
        setIsPaused(true);
      }
    }
  };

  const handleCancel = () => {
    if (multiSolverRef.current) {
      multiSolverRef.current.cancel();
    }
    if (optimizerRef.current) {
      optimizerRef.current.cancel();
    }
    setIsOptimizing(false);
    setIsPaused(false);
    setLiveCandidateSquares(null);
    setLiveCandidateL(null);
  };

  const handleResetBaseline = async () => {
    const baseline = await dbService.resetToBaseline(currentN);
    setStoredPackings((prev) => {
      const updated = new Map(prev);
      updated.set(currentN, baseline);
      return updated;
    });
  };

  // Run continuous physics relaxation to squeeze boundary gaps and micro-overlaps
  const handleRunPhysicsPolish = async () => {
    if (isOptimizing) return;
    const initialSquares = currentPacking.squares;
    const relaxer = new PhysicsRelaxer(initialSquares, currentPacking.containerLength);
    const result = relaxer.relax(100);
    const val = validatePacking(currentN, result.squares);

    if (val.isValid) {
      const isBetter = val.computedLength < currentPacking.containerLength - 1e-4;
      const newPacking: Packing = {
        ...currentPacking,
        squares: result.squares,
        containerLength: val.computedLength,
        score: val.score,
        status: isBetter ? 'improved' : currentPacking.status,
        isProvenOptimal: val.isProvenOptimal,
        timestamp: Date.now(),
        notes: `Physics Relaxation Polish (L = ${val.computedLength.toFixed(5)})`,
      };
      await dbService.savePacking(newPacking);
      setStoredPackings((prev) => {
        const next = new Map(prev);
        next.set(currentN, newPacking);
        return next;
      });
    }
  };

  // Load curated literature record solution
  const handleApplyLiteratureRecord = async () => {
    const litPacking = generateLiteraturePacking(currentN);
    if (litPacking) {
      const val = validatePacking(currentN, litPacking.squares);
      if (val.isValid) {
        await dbService.savePacking(litPacking);
        setStoredPackings((prev) => {
          const next = new Map(prev);
          next.set(currentN, litPacking);
          return next;
        });
      }
    }
  };

  // Run Championship Sweep across high-yield vulnerable baseline targets
  const handleRunChampionshipSweep = async () => {
    if (isOptimizing) return;

    setIsOptimizing(true);
    setIsPaused(false);

    // Target the most impactful puzzles where grid has maximum wasted space
    const championshipTargets = [5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20];

    try {
      for (const n of championshipTargets) {
        if (globalMetricEngine.isPerfectSquare(n)) continue;

        setCurrentN(n);

        // First check analytical patterns
        const analytical = getAnalyticalImprovement(n);
        let startingPacking = storedPackings.get(n) || generateBaselinePacking(n);

        if (analytical && analytical.containerLength < startingPacking.containerLength - 1e-4) {
          startingPacking = analytical;
          await dbService.savePacking(analytical);
          setStoredPackings((prev) => {
            const next = new Map(prev);
            next.set(n, analytical);
            return next;
          });
        }

        // Run fast physics-directed annealing
        const optimizer = new PackingOptimizer({
          n,
          initialPacking: startingPacking,
          seed: 1337 + n,
          restarts: 1,
          timeBudgetMs: 2500, // fast sweep
          maxIterations: 18000,
          initialTemp: 0.35,
          coolingRate: 0.9995,
          stepSizeTranslation: 0.05,
          stepSizeRotation: 0.1,
          shrinkFactor: 0.992,
          weights: { overlapPenalty: 120, containerPenalty: 60 },
        });

        optimizerRef.current = optimizer;

        const best = await optimizer.optimize((prog, candidate) => {
          setProgress(prog);
          if (candidate) {
            setLiveCandidateSquares(candidate.squares);
            setLiveCandidateL(candidate.containerLength);
          }
        });

        const val = validatePacking(n, best.squares);
        if (val.isValid && best.status === 'improved') {
          await dbService.savePacking(best);
          setStoredPackings((prev) => {
            const updated = new Map(prev);
            updated.set(n, best);
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Championship sweep error:', err);
    } finally {
      setIsOptimizing(false);
      setIsPaused(false);
      setLiveCandidateSquares(null);
      setLiveCandidateL(null);
      optimizerRef.current = null;
    }
  };

  // Handle real-time manual dragging/rotating of squares from canvas
  const handleManualUpdateSquares = async (updatedSquares: UnitSquare[]) => {
    const val = validatePacking(currentN, updatedSquares);
    if (val.isValid) {
      const isBetter = val.computedLength < currentPacking.containerLength - 1e-4;
      const newPacking: Packing = {
        ...currentPacking,
        squares: updatedSquares,
        containerLength: val.computedLength,
        score: val.score,
        status: isBetter ? 'improved' : currentPacking.status,
        isProvenOptimal: val.isProvenOptimal,
        timestamp: Date.now(),
      };
      await dbService.savePacking(newPacking);
      setStoredPackings((prev) => {
        const next = new Map(prev);
        next.set(currentN, newPacking);
        return next;
      });
      setLiveCandidateSquares(null);
      setLiveCandidateL(null);
    } else {
      setLiveCandidateSquares(updatedSquares);
      setLiveCandidateL(val.computedLength);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      {/* Top Header & Competition Stats */}
      <Header
        totalCompetitionScore={totalScore}
        baselineTotalScore={analyticalBaseline.totalScore}
        improvedCount={improvedCount}
        optimalCount={optimalCount}
        onOpenExport={() => setShowExportModal(true)}
        onOpenBenchmark={() => setShowBenchmarkModal(true)}
        onOpenMetricConfig={() => setShowMetricConfigModal(true)}
        onOpenPythonSolver={() => setShowPythonSolverModal(true)}
        onOpenPlaybook={() => setShowPlaybookModal(true)}
        onOpenHeatmap={() => setShowHeatmapModal(true)}
        onOpenCompare={() => setShowCompareModal(true)}
      />

      {/* Main Research Studio Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Column: Canvas View & Puzzle Navigation (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 min-h-[500px]">
          {/* Puzzle Range Selector & Controls */}
          <PuzzleSelector
            currentN={currentN}
            onSelectN={(n) => {
              if (isOptimizing) {
                handleCancel();
              }
              setCurrentN(n);
            }}
            storedPackings={storedPackings}
          />

          {/* Interactive Rotated Geometry Canvas */}
          <div className="flex-1 flex flex-col min-h-[460px]">
            <CanvasViewer
              packing={currentPacking}
              candidateSquares={liveCandidateSquares}
              candidateL={liveCandidateL}
              collisions={currentValidation.collisions}
              isOptimizing={isOptimizing}
              onUpdateSquares={handleManualUpdateSquares}
            />
          </div>
        </div>

        {/* Right Column: Solver Panel & Validation Audit (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Multi-Engine Solver Controls */}
          <SolverPanel
            n={currentN}
            currentPacking={currentPacking}
            isOptimizing={isOptimizing}
            isPaused={isPaused}
            progress={progress}
            onStartOptimize={handleStartOptimize}
            onPauseResume={handlePauseResume}
            onCancel={handleCancel}
            onResetBaseline={handleResetBaseline}
            onStartBatchOptimize={handleStartBatchOptimize}
            onRunPhysicsPolish={handleRunPhysicsPolish}
          />

          {/* Independent Verification Audit & Metrics */}
          <ValidationPanel
            packing={currentPacking}
            validation={currentValidation}
            onApplyLiteratureRecord={handleApplyLiteratureRecord}
          />
        </div>
      </main>

      {/* Modals */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        currentN={currentN}
        storedPackings={storedPackings}
        onRefreshData={loadStoredPackings}
      />

      <BenchmarkModal
        isOpen={showBenchmarkModal}
        onClose={() => setShowBenchmarkModal(false)}
      />

      <MetricConfigModal
        isOpen={showMetricConfigModal}
        onClose={() => setShowMetricConfigModal(false)}
        onConfigChanged={() => {
          setStoredPackings(new Map(storedPackings));
        }}
      />

      <PythonSolverModal
        isOpen={showPythonSolverModal}
        onClose={() => setShowPythonSolverModal(false)}
      />

      <LeaderboardGuideModal
        isOpen={showPlaybookModal}
        onClose={() => setShowPlaybookModal(false)}
        onRunChampionshipSweep={handleRunChampionshipSweep}
      />

      <ScoreHeatmapModal
        isOpen={showHeatmapModal}
        onClose={() => setShowHeatmapModal(false)}
        currentN={currentN}
        onSelectN={(n) => setCurrentN(n)}
        storedPackings={storedPackings}
        onRunBatchOnCohort={(cohort) => {
          handleStartBatchOptimize(cohort[0], cohort[cohort.length - 1], 5);
        }}
      />

      <SubmissionCompareModal
        isOpen={showCompareModal}
        onClose={() => setShowCompareModal(false)}
        currentPackings={storedPackings}
        onRefreshData={loadStoredPackings}
      />
    </div>
  );
}
