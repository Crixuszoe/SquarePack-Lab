/**
 * Research Dashboard Header & Global Competition Scoreboard
 */

import React from 'react';
import {
  Box,
  Download,
  Zap,
  Sliders,
  Terminal,
  Trophy,
  ShieldCheck,
  TrendingDown,
  Grid3X3,
  GitCompare,
} from 'lucide-react';

interface HeaderProps {
  totalCompetitionScore: number;
  baselineTotalScore: number;
  improvedCount: number;
  optimalCount: number;
  onOpenExport: () => void;
  onOpenBenchmark: () => void;
  onOpenMetricConfig: () => void;
  onOpenPythonSolver: () => void;
  onOpenPlaybook: () => void;
  onOpenHeatmap: () => void;
  onOpenCompare: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalCompetitionScore,
  baselineTotalScore,
  improvedCount,
  optimalCount,
  onOpenExport,
  onOpenBenchmark,
  onOpenMetricConfig,
  onOpenPythonSolver,
  onOpenPlaybook,
  onOpenHeatmap,
  onOpenCompare,
}) => {
  const scoreDelta = baselineTotalScore - totalCompetitionScore;

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-950/50">
            <Box className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">SquarePack Lab</h1>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">
                Unit-Square Optimization
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Computational geometry laboratory for n = 1 to 1,000 container packing
            </p>
          </div>
        </div>

        {/* Competition Scoreboard Cards */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Total Competition Score */}
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-400" />
              Total 1,000 Score
            </span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-sm font-bold text-cyan-300">
                {totalCompetitionScore.toFixed(4)}
              </span>
              {scoreDelta > 1e-5 && (
                <span className="text-[11px] text-emerald-400 flex items-center font-semibold">
                  <TrendingDown className="w-3 h-3" />
                  -{scoreDelta.toFixed(4)}
                </span>
              )}
            </div>
          </div>

          {/* Proven Optima */}
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex flex-col hidden sm:flex">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              Proven Optima
            </span>
            <span className="text-sm font-bold font-mono text-emerald-400">
              {optimalCount} / 1,000
            </span>
          </div>

          {/* Improvements */}
          <div className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg flex flex-col hidden sm:flex">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
              Improved
            </span>
            <span className="text-sm font-bold font-mono text-purple-400">
              {improvedCount} puzzles
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 ml-auto sm:ml-2">
            <button
              onClick={onOpenHeatmap}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-lg transition-all border border-cyan-800/60"
              title="Open 1,000-Puzzle Matrix Heatmap"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">1,000 Matrix</span>
            </button>

            <button
              onClick={onOpenCompare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 font-semibold text-xs rounded-lg transition-all border border-indigo-800/60"
              title="Compare Local Packings Against Rival Submission CSV"
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Diff Auditor</span>
            </button>

            <button
              onClick={onOpenPlaybook}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-lg transition-all shadow-md shadow-amber-950/50"
              title="Championship Strategy & Top-Score Tactics"
            >
              <Trophy className="w-3.5 h-3.5 fill-current" />
              <span>Win #1 Playbook</span>
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors shadow"
              title="Export Submission CSV or Checkpoint"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={onOpenBenchmark}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Run Verification Tests & Live Benchmark"
            >
              <Zap className="w-4 h-4 text-purple-400" />
            </button>

            <button
              onClick={onOpenMetricConfig}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Metric Configuration & Notebook Reconciliation"
            >
              <Sliders className="w-4 h-4 text-slate-400" />
            </button>

            <button
              onClick={onOpenPythonSolver}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors"
              title="Python & Kaggle Standalone Solver"
            >
              <Terminal className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
