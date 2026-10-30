/**
 * Optimization Controls & Live Telemetry Panel
 */

import React, { useState } from 'react';
import { OptimizationParams, OptimizationProgress, Packing } from '../types';
import { globalMetricEngine } from '../metrics/config';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Settings2,
  Flame,
  Layers,
  ShieldAlert,
  Cpu,
  Sparkles,
  Zap,
} from 'lucide-react';

interface SolverPanelProps {
  n: number;
  currentPacking: Packing | null;
  isOptimizing: boolean;
  isPaused: boolean;
  progress: OptimizationProgress | null;
  onStartOptimize: (params: OptimizationParams) => void;
  onPauseResume: () => void;
  onCancel: () => void;
  onResetBaseline: () => void;
  onStartBatchOptimize: (startN: number, endN: number, budgetPerPuzzle: number) => void;
  onRunPhysicsPolish?: () => void;
}

export const SolverPanel: React.FC<SolverPanelProps> = ({
  n,
  currentPacking,
  isOptimizing,
  isPaused,
  progress,
  onStartOptimize,
  onPauseResume,
  onCancel,
  onResetBaseline,
  onStartBatchOptimize,
  onRunPhysicsPolish,
}) => {
  // Solver Configuration
  const [algorithm, setAlgorithm] = useState<
    'hyper_arena' | 'simulated_annealing' | 'physics_compaction' | 'genetic_algorithm' | 'lattice_synthesizer'
  >('hyper_arena');
  const [seed, setSeed] = useState<number>(42);
  const [restarts, setRestarts] = useState<number>(2);
  const [timeBudgetSec, setTimeBudgetSec] = useState<number>(10);
  const [initialTemp, setInitialTemp] = useState<number>(0.35);
  const [coolingRate, setCoolingRate] = useState<number>(0.9995);
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [batchStart, setBatchStart] = useState<number>(2);
  const [batchEnd, setBatchEnd] = useState<number>(10);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);

  const isOptimal = globalMetricEngine.isPerfectSquare(n);

  const handleStart = () => {
    onStartOptimize({
      n,
      initialPacking: currentPacking || undefined,
      algorithm,
      seed,
      restarts,
      timeBudgetMs: timeBudgetSec * 1000,
      maxIterations: 35000,
      initialTemp,
      coolingRate,
      stepSizeTranslation: 0.05,
      stepSizeRotation: 0.1,
      shrinkFactor: 0.992,
      weights: {
        overlapPenalty: 120.0,
        containerPenalty: 60.0,
      },
    });
  };

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (batchStart < 1 || batchEnd > 1000 || batchStart > batchEnd) return;
    setShowBatchModal(false);
    onStartBatchOptimize(batchStart, batchEnd, timeBudgetSec);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-cyan-400" />
          <h3 className="font-semibold text-sm text-slate-200">Multi-Engine Optimizer</h3>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
          {showAdvanced ? 'Simple' : 'Tune'}
        </button>
      </div>

      {isOptimal ? (
        <div className="bg-emerald-950/40 border border-emerald-800/50 rounded-lg p-3 text-xs text-emerald-300 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Proven Mathematical Optimum:</span> For perfect square n={n}, the
            grid packing reaches container length L = √{n} = {Math.sqrt(n)}, achieving score = 0.
            No optimization needed.
          </div>
        </div>
      ) : null}

      {/* Algorithm Selector Dropdown */}
      <div>
        <label className="text-slate-400 block mb-1 text-xs font-medium">Optimization Algorithm</label>
        <select
          disabled={isOptimizing}
          value={algorithm}
          onChange={(e) => setAlgorithm(e.target.value as any)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none font-sans"
        >
          <option value="hyper_arena">🚀 Hyper-Arena Sweep (All 4 Engines Competing)</option>
          <option value="simulated_annealing">🌡️ Simulated Annealing (Thermodynamic)</option>
          <option value="physics_compaction">🧲 Force-Directed Physics (Contact Springs)</option>
          <option value="genetic_algorithm">🧬 Genetic Evolutionary (Spatial Crossover)</option>
          <option value="lattice_synthesizer">📐 Tilted Lattice Synthesizer (Caliper Grid)</option>
        </select>
      </div>

      {/* Main Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {!isOptimizing ? (
          <button
            onClick={handleStart}
            disabled={isOptimal}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-cyan-500 text-slate-950 font-semibold text-sm transition-all shadow-md shadow-cyan-950/50"
          >
            <Play className="w-4 h-4 fill-current" />
            Optimize n={n}
          </button>
        ) : (
          <button
            onClick={onPauseResume}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors"
          >
            {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        )}

        {isOptimizing ? (
          <button
            onClick={onCancel}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 font-semibold text-sm transition-colors"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop
          </button>
        ) : (
          <button
            onClick={onResetBaseline}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors"
            title="Reset this puzzle back to baseline grid"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Baseline
          </button>
        )}
      </div>

      {/* Physics Relaxation Polish Action */}
      {!isOptimizing && !isOptimal && onRunPhysicsPolish && (
        <button
          onClick={onRunPhysicsPolish}
          className="w-full py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          title="Run continuous contact mechanics physics relaxer to eliminate micro-overlaps and squeeze bounds"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          Physics Relax & Polish (Eliminate Gaps)
        </button>
      )}

      {/* Batch Solver Button */}
      <button
        onClick={() => setShowBatchModal(true)}
        disabled={isOptimizing}
        className="w-full py-1.5 px-3 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-40"
      >
        <Layers className="w-3.5 h-3.5 text-cyan-400" />
        Batch Optimize Range (Skip Optima)
      </button>

      {/* Live Telemetry Display */}
      {isOptimizing && progress && (
        <div className="bg-slate-950 border border-cyan-900/60 rounded-lg p-3 flex flex-col gap-2 font-mono text-xs">
          <div className="flex items-center justify-between text-cyan-400 font-bold border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
              Iteration: {progress.iteration}
            </span>
            <span>{(progress.elapsedMs / 1000).toFixed(1)}s elapsed</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px]">
            <div>
              <span className="text-slate-500 block">Candidate L:</span>
              <span className="font-semibold text-cyan-300">{progress.currentL.toFixed(5)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Best Validated L:</span>
              <span className="font-semibold text-emerald-400">{progress.bestL.toFixed(5)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Temperature:</span>
              <span>{progress.temperature.toFixed(4)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Energy / Overlap:</span>
              <span>{progress.currentOverlap.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Parameter Controls */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div>
          <label className="text-slate-400 block mb-1">Seed (Reproducible)</label>
          <input
            type="number"
            disabled={isOptimizing}
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 font-mono text-xs focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-slate-400 block mb-1">Time Budget</label>
          <select
            disabled={isOptimizing}
            value={timeBudgetSec}
            onChange={(e) => setTimeBudgetSec(parseInt(e.target.value, 10))}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
          >
            <option value={3}>3 seconds (Fast)</option>
            <option value={10}>10 seconds (Standard)</option>
            <option value={30}>30 seconds (Deep)</option>
            <option value={60}>60 seconds (High Search)</option>
          </select>
        </div>
      </div>

      {showAdvanced && (
        <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex flex-col gap-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Restarts</label>
              <input
                type="number"
                min="1"
                max="5"
                disabled={isOptimizing}
                value={restarts}
                onChange={(e) => setRestarts(parseInt(e.target.value, 10) || 1)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Initial Temp</label>
              <input
                type="number"
                step="0.05"
                disabled={isOptimizing}
                value={initialTemp}
                onChange={(e) => setInitialTemp(parseFloat(e.target.value) || 0.1)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono"
              />
            </div>
          </div>
          <div>
            <label className="text-slate-400 block mb-1">Cooling Rate: {coolingRate}</label>
            <input
              type="range"
              min="0.998"
              max="0.9999"
              step="0.0001"
              disabled={isOptimizing}
              value={coolingRate}
              onChange={(e) => setCoolingRate(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 h-1 bg-slate-800 rounded"
            />
          </div>
        </div>
      )}

      {/* Batch Optimization Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-sm w-full shadow-2xl flex flex-col gap-4">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              Batch Optimize Puzzles
            </h3>
            <p className="text-xs text-slate-400">
              Run simulated annealing sequentially across a range of puzzles. Perfect squares are
              automatically skipped as they are already proven optimal.
            </p>
            <form onSubmit={handleBatchSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Start n</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={batchStart}
                    onChange={(e) => setBatchStart(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 font-mono text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">End n</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={batchEnd}
                    onChange={(e) => setBatchEnd(parseInt(e.target.value, 10))}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 font-mono text-slate-200"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg shadow"
                >
                  Start Batch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
