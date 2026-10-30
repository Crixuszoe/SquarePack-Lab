/**
 * 1,000-Puzzle Interactive Matrix Heatmap & Competition Score Distribution
 * 
 * Provides:
 * - 1,000-cell interactive periodic matrix (colored by status: optimal, improved, baseline)
 * - Interactive score sensitivity curve highlighting high-yield sawtooth spikes
 * - One-click jump to any puzzle
 * - Quick batch cohort targeting
 */

import React, { useState, useMemo } from 'react';
import { Packing } from '../types';
import { globalMetricEngine } from '../metrics/config';
import {
  Grid3X3,
  Trophy,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  X,
  Search,
  CheckCircle2,
  Filter,
} from 'lucide-react';

interface ScoreHeatmapModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentN: number;
  onSelectN: (n: number) => void;
  storedPackings: Map<number, Packing>;
  onRunBatchOnCohort: (cohortList: number[]) => void;
}

type MatrixFilter = 'all' | 'improved' | 'vulnerable' | 'optimal';

export const ScoreHeatmapModal: React.FC<ScoreHeatmapModalProps> = ({
  isOpen,
  onClose,
  currentN,
  onSelectN,
  storedPackings,
  onRunBatchOnCohort,
}) => {
  const [filter, setFilter] = useState<MatrixFilter>('all');
  const [hoveredN, setHoveredN] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Top 30 high-vulnerability targets (n = m² + 1, m² + 2 where baseline grid wastes maximum space)
  const highVulnerabilityTargets = useMemo(() => {
    const list: number[] = [];
    for (let m = 2; m <= 31; m++) {
      const base = m * m;
      if (base + 1 <= 1000) list.push(base + 1);
      if (base + 2 <= 1000) list.push(base + 2);
    }
    return list;
  }, []);

  const highVulnerabilitySet = useMemo(
    () => new Set(highVulnerabilityTargets),
    [highVulnerabilityTargets]
  );

  const puzzles = useMemo(() => {
    return Array.from({ length: 1000 }, (_, i) => {
      const n = i + 1;
      const isOptimal = globalMetricEngine.isPerfectSquare(n);
      const packing = storedPackings.get(n);
      const isImproved = packing?.status === 'improved';
      const isVulnerable = highVulnerabilitySet.has(n);
      const baselineScore = globalMetricEngine.computeGridFallbackScore(n);
      const currentScore = packing?.score ?? baselineScore;
      const delta = baselineScore - currentScore;

      return {
        n,
        isOptimal,
        isImproved,
        isVulnerable,
        currentScore,
        baselineScore,
        delta,
        L: packing?.containerLength ?? Math.ceil(Math.sqrt(n)),
      };
    });
  }, [storedPackings, highVulnerabilitySet]);

  const filteredPuzzles = useMemo(() => {
    return puzzles.filter((p) => {
      if (searchTerm) {
        const term = searchTerm.trim();
        if (!p.n.toString().includes(term)) return false;
      }
      if (filter === 'improved') return p.isImproved;
      if (filter === 'optimal') return p.isOptimal;
      if (filter === 'vulnerable') return p.isVulnerable && !p.isImproved;
      return true;
    });
  }, [puzzles, filter, searchTerm]);

  const hoveredPuzzle = useMemo(() => {
    if (!hoveredN) return null;
    return puzzles[hoveredN - 1];
  }, [hoveredN, puzzles]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-cyan-800/40 rounded-2xl p-5 max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-950 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                1,000-Puzzle Competition Heatmap & Matrix
              </h2>
              <p className="text-xs text-slate-400">
                Full-spectrum visualization of all 1,000 puzzles, proven optima, and vulnerability targets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters & Cohort Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          {/* Filter Tabs */}
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                filter === 'all' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All 1,000
            </button>
            <button
              onClick={() => setFilter('vulnerable')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                filter === 'vulnerable' ? 'bg-amber-500 text-slate-950 font-semibold' : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              <Trophy className="w-3 h-3" />
              High Potential ({highVulnerabilityTargets.length})
            </button>
            <button
              onClick={() => setFilter('improved')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                filter === 'improved' ? 'bg-purple-600 text-white font-semibold' : 'text-purple-400 hover:text-purple-300'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              Improved
            </button>
            <button
              onClick={() => setFilter('optimal')}
              className={`px-3 py-1 rounded-md font-medium transition-colors flex items-center gap-1 ${
                filter === 'optimal' ? 'bg-emerald-500 text-slate-950 font-semibold' : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              Proven Optima (31)
            </button>
          </div>

          {/* Search Box */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Find n..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-24 bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            {/* Run Batch on Cohort Button */}
            <button
              onClick={() => {
                onClose();
                onRunBatchOnCohort(highVulnerabilityTargets.slice(0, 15));
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-all shadow"
            >
              Solve High-Potential Targets
            </button>
          </div>
        </div>

        {/* 1,000 Puzzle Matrix Grid */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col gap-2 overflow-hidden">
          <div className="text-[11px] text-slate-400 flex items-center justify-between pb-1 border-b border-slate-850">
            <span>Showing {filteredPuzzles.length} puzzles. Hover for details, click to inspect on canvas.</span>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>
                Optimal (31)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block"></span>
                Improved
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block"></span>
                High Yield
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-800 inline-block"></span>
                Baseline
              </span>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[46vh] p-1">
            <div className="grid grid-cols-10 sm:grid-cols-20 md:grid-cols-25 gap-1 select-none">
              {filteredPuzzles.map((p) => {
                const isSelected = p.n === currentN;
                let bgClass = 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800';

                if (isSelected) {
                  bgClass = 'bg-cyan-500 text-slate-950 font-bold ring-2 ring-cyan-400';
                } else if (p.isOptimal) {
                  bgClass = 'bg-emerald-950/70 border-emerald-800/80 text-emerald-400 font-bold';
                } else if (p.isImproved) {
                  bgClass = 'bg-purple-950/80 border-purple-800/90 text-purple-300 font-semibold';
                } else if (p.isVulnerable) {
                  bgClass = 'bg-amber-950/50 border-amber-800/60 text-amber-300';
                }

                return (
                  <button
                    key={p.n}
                    onClick={() => {
                      onSelectN(p.n);
                      onClose();
                    }}
                    onMouseEnter={() => setHoveredN(p.n)}
                    className={`h-7 rounded text-[10px] font-mono border transition-all flex items-center justify-center ${bgClass}`}
                    title={`n=${p.n} | L=${p.L.toFixed(3)} | score=${p.currentScore.toFixed(4)}`}
                  >
                    {p.n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Live Hover Detail Strip */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono">
          {hoveredPuzzle ? (
            <div className="flex flex-wrap items-center gap-4 text-slate-200">
              <span className="text-cyan-400 font-bold">n = {hoveredPuzzle.n}</span>
              <span>L = {hoveredPuzzle.L.toFixed(4)}</span>
              <span>Score = {hoveredPuzzle.currentScore.toFixed(5)}</span>
              <span className="text-slate-500">
                Baseline L = {Math.ceil(Math.sqrt(hoveredPuzzle.n))}
              </span>
              {hoveredPuzzle.delta > 1e-5 && (
                <span className="text-emerald-400 font-semibold flex items-center gap-1">
                  <TrendingDown className="w-3.5 h-3.5" />
                  Score Reduction: -{hoveredPuzzle.delta.toFixed(5)}
                </span>
              )}
              {hoveredPuzzle.isOptimal && (
                <span className="text-emerald-400 font-semibold">★ Proven Optimal</span>
              )}
            </div>
          ) : (
            <span className="text-slate-500 text-[11px]">Hover over any puzzle in the matrix to view metrics</span>
          )}

          <span className="text-slate-500 text-[11px]">Total: 1,000 Puzzles</span>
        </div>
      </div>
    </div>
  );
};
