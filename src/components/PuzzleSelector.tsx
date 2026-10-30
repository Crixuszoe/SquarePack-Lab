/**
 * Puzzle Selector & Range Filter Component (n = 1 to 1,000)
 */

import React, { useState } from 'react';
import { Packing } from '../types';
import { globalMetricEngine } from '../metrics/config';
import { Search, ChevronLeft, ChevronRight, SkipForward, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

interface PuzzleSelectorProps {
  currentN: number;
  onSelectN: (n: number) => void;
  storedPackings: Map<number, Packing>;
}

type FilterMode = 'all' | 'needs_work' | 'improved' | 'optimal';

export const PuzzleSelector: React.FC<PuzzleSelectorProps> = ({
  currentN,
  onSelectN,
  storedPackings,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchInput, setSearchInput] = useState('');

  const currentPacking = storedPackings.get(currentN);
  const isOptimal = globalMetricEngine.isPerfectSquare(currentN);

  // Jump to next puzzle that is not a perfect square
  const handleNextNonOptimal = () => {
    let next = currentN + 1;
    while (next <= 1000 && globalMetricEngine.isPerfectSquare(next)) {
      next++;
    }
    if (next <= 1000) {
      onSelectN(next);
    }
  };

  const handlePrev = () => {
    if (currentN > 1) onSelectN(currentN - 1);
  };

  const handleNext = () => {
    if (currentN < 1000) onSelectN(currentN + 1);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(searchInput.trim(), 10);
    if (!isNaN(val) && val >= 1 && val <= 1000) {
      onSelectN(val);
      setSearchInput('');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
      {/* Top row: Puzzle Title & Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Selected Puzzle
          </span>
          <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800">
            <span className="text-lg font-bold font-mono text-cyan-400">n = {currentN}</span>
            {isOptimal ? (
              <span className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] px-2 py-0.5 rounded-full font-medium ml-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                Proven Optimal
              </span>
            ) : currentPacking?.status === 'improved' ? (
              <span className="flex items-center gap-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] px-2 py-0.5 rounded-full font-medium ml-1">
                <Sparkles className="w-3.5 h-3.5" />
                Improved
              </span>
            ) : (
              <span className="bg-slate-800 text-slate-300 text-[11px] px-2 py-0.5 rounded-full font-medium ml-1">
                Baseline Grid
              </span>
            )}
          </div>
        </div>

        {/* Quick Stepper Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handlePrev}
            disabled={currentN <= 1}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg transition-colors"
            title="Previous Puzzle"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleNext}
            disabled={currentN >= 1000}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-lg transition-colors"
            title="Next Puzzle"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleNextNonOptimal}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-medium rounded-lg transition-colors"
            title="Jump to Next Puzzle with Improvement Potential"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Next Non-Optimal
          </button>
        </div>
      </div>

      {/* Slider & Direct Number Input */}
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="1"
          max="1000"
          value={currentN}
          onChange={(e) => onSelectN(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
        />
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Jump (1..1000)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-32 bg-slate-950 border border-slate-800 focus:border-cyan-500 rounded-lg pl-8 pr-2 py-1 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none"
            />
          </div>
        </form>
      </div>

      {/* Filter Presets */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/60 text-xs">
        <span className="text-slate-500 mr-1">Quick Select:</span>
        {[2, 3, 5, 8, 10, 15, 20, 50, 100].map((quickN) => (
          <button
            key={quickN}
            onClick={() => onSelectN(quickN)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
              currentN === quickN
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            n={quickN}
          </button>
        ))}
        <span className="text-slate-600 mx-1">|</span>
        {[4, 9, 16, 25, 36].map((optN) => (
          <button
            key={optN}
            onClick={() => onSelectN(optN)}
            className={`px-2 py-0.5 rounded font-mono text-[11px] transition-colors ${
              currentN === optN
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/60 border border-emerald-800/40'
            }`}
            title="Proven optimal perfect square"
          >
            n={optN}★
          </button>
        ))}
      </div>
    </div>
  );
};
