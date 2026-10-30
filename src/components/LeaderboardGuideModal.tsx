/**
 * Competition Strategy & Leaderboard Dominance Guide Modal
 */

import React from 'react';
import { Trophy, Target, Zap, Cpu, Award, CheckCircle2, X, ChevronRight, Layers } from 'lucide-react';

interface LeaderboardGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunChampionshipSweep: () => void;
}

export const LeaderboardGuideModal: React.FC<LeaderboardGuideModalProps> = ({
  isOpen,
  onClose,
  onRunChampionshipSweep,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-6 max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl shadow-amber-950/40 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Leaderboard Championship Playbook
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-mono border border-amber-500/30">
                  TOP 1% STRATEGY
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Mathematical vulnerabilities, high-yield puzzles, and submission tactics
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

        {/* Action Callout */}
        <div className="bg-gradient-to-r from-amber-950/40 via-purple-950/40 to-cyan-950/40 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-200">
            <span className="font-bold text-amber-300 block mb-0.5 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              One-Click Championship Sweep
            </span>
            Instantly applies analytical diamond & perimeter packings + physics relaxation across top
            vulnerability targets (e.g. n=5, 7, 8, 10, 11, 12...).
          </div>
          <button
            onClick={() => {
              onClose();
              onRunChampionshipSweep();
            }}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold text-xs rounded-lg shadow-lg shadow-amber-950/50 shrink-0 flex items-center gap-1.5 transition-all"
          >
            <Trophy className="w-3.5 h-3.5 fill-current" />
            Run Sweep Now
          </button>
        </div>

        {/* Section 1: The Core Scoring Secret */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" />
            1. The Secret: Where 75% of Competition Points are Won
          </h3>
          <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800">
            <p>
              The competition score is <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded">score(n) = L / √n - 1</code>.
              Because competitor scores are summed across all 1,000 puzzles, the puzzles with the
              <strong className="text-amber-300"> largest waste in the baseline grid </strong>
              offer massive point gains.
            </p>
            <p>
              Whenever <code className="text-purple-300">n = m² + 1</code> (e.g. <strong className="text-slate-100">n = 5, 10, 17, 26, 37, 50, 65, 82, 101...</strong>),
              the baseline grid rounds up an entire integer row: <code className="text-cyan-300">L_grid = m + 1</code>.
              This leaves up to <strong className="text-red-400">2m empty slots</strong> of pure wasted container space!
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block">n=5 (Baseline Grid L=3):</span>
                <span className="text-red-400">Score: 0.34164</span>
                <span className="text-emerald-400 block font-semibold">With Diamond: 0.21065 (-0.1310!)</span>
              </div>
              <div className="bg-slate-900 p-2 rounded border border-slate-800">
                <span className="text-slate-400 block">n=10 (Baseline Grid L=4):</span>
                <span className="text-red-400">Score: 0.26491</span>
                <span className="text-emerald-400 block font-semibold">With Ring Core: 0.17462 (-0.0903!)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Mathematical Guarantees */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5" />
            2. The 31 Proven Mathematical Optima (Do Not Waste Time Here)
          </h3>
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <p>
              Any perfect square <code className="text-emerald-400">n ∈ &#123;1, 4, 9, 16, 25, 36, 49, 64, 81, 100, ..., 961, 1000&#125;</code>
              already packs perfectly into an axis-aligned grid with <code className="text-emerald-300">L = √n</code>.
            </p>
            <p>
              Its score is strictly <strong className="text-emerald-400">0.00000</strong>, which hits the theoretical area lower bound.
              SquarePack Lab automatically recognizes and locks these 31 puzzles, preventing wasted compute!
            </p>
          </div>
        </div>

        {/* Section 3: The Kaggle / High-Core Playbook */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            3. Overnight Multi-Core Power Run
          </h3>
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <p>
              To claim rank #1 on the competition scoreboard:
            </p>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300">
              <li>
                Click <strong className="text-cyan-300">Python Solver</strong> in the top header and download <code className="text-slate-100">squarepack_solver.py</code>.
              </li>
              <li>
                Open a free Kaggle notebook or multi-core local terminal and run:
                <div className="mt-1 bg-slate-900 text-cyan-300 p-2 rounded font-mono text-[11px] border border-slate-800">
                  python squarepack_solver.py --full --budget 15 --out submission_champion.csv
                </div>
              </li>
              <li>
                Download the resulting CSV file and click <strong className="text-cyan-300">Import CSV</strong> in SquarePack Lab.
                The app will re-verify all 500,500 rows with independent SAT checks and update your local best database.
              </li>
              <li>
                Click <strong className="text-cyan-300">Export CSV</strong> → <strong className="text-slate-100">Full Submission</strong>.
                The app runs a pre-download round-trip validation and produces your competition-ready submission!
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};
