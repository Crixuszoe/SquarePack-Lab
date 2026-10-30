/**
 * Submission Comparison & Diff Auditor Modal
 * 
 * Allows comparing two submission files or comparing local best database
 * against competitor results:
 * - Puzzle-by-puzzle container length and score delta
 * - Total leaderboard score impact
 * - Visual win/tie/loss breakdown
 * - One-click selective merging of improved puzzle configurations!
 */

import React, { useState, useMemo } from 'react';
import { Packing, UnitSquare } from '../types';
import { parseSubmissionCsv } from '../export/csv';
import { validatePacking } from '../geometry/validator';
import { globalMetricEngine } from '../metrics/config';
import { dbService } from '../storage/db';
import {
  GitCompare,
  Upload,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  CheckCircle2,
  X,
  FileCheck,
  Download,
} from 'lucide-react';

interface SubmissionCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPackings: Map<number, Packing>;
  onRefreshData: () => void;
}

export const SubmissionCompareModal: React.FC<SubmissionCompareModalProps> = ({
  isOpen,
  onClose,
  currentPackings,
  onRefreshData,
}) => {
  const [rivalPackings, setRivalPackings] = useState<Map<number, UnitSquare[]> | null>(null);
  const [rivalFileName, setRivalFileName] = useState<string>('');
  const [filterMode, setFilterMode] = useState<'all' | 'rival_better' | 'local_better'>('all');
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseSubmissionCsv(text);
      setRivalPackings(parsed);
      setRivalFileName(file.name);
      setMergeMessage(null);
    } catch (err: unknown) {
      alert(`Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      e.target.value = '';
    }
  };

  // Compute diff across all puzzles
  const diffResults = useMemo(() => {
    if (!rivalPackings) return null;

    let localTotalScore = 0;
    let rivalTotalScore = 0;
    let localWins = 0;
    let rivalWins = 0;
    let ties = 0;

    const rows: {
      n: number;
      localL: number;
      rivalL: number;
      localScore: number;
      rivalScore: number;
      deltaL: number;
      deltaScore: number; // positive means rival is better (lower score)
      status: 'rival_wins' | 'local_wins' | 'tie';
    }[] = [];

    for (let n = 1; n <= 1000; n++) {
      const localP = currentPackings.get(n);
      const localL = localP?.containerLength ?? Math.ceil(Math.sqrt(n));
      const localScore = (localL / Math.sqrt(n)) - 1.0;
      localTotalScore += localScore;

      const rivalSquares = rivalPackings.get(n);
      let rivalL = Math.ceil(Math.sqrt(n));
      if (rivalSquares && rivalSquares.length === n) {
        const val = validatePacking(n, rivalSquares);
        if (val.isValid) {
          rivalL = val.computedLength;
        }
      }
      const rivalScore = (rivalL / Math.sqrt(n)) - 1.0;
      rivalTotalScore += rivalScore;

      const deltaL = localL - rivalL;
      const deltaScore = localScore - rivalScore;

      let status: 'rival_wins' | 'local_wins' | 'tie' = 'tie';
      if (deltaL > 1e-4) {
        status = 'rival_wins';
        rivalWins++;
      } else if (deltaL < -1e-4) {
        status = 'local_wins';
        localWins++;
      } else {
        ties++;
      }

      rows.push({
        n,
        localL,
        rivalL,
        localScore,
        rivalScore,
        deltaL,
        deltaScore,
        status,
      });
    }

    return {
      localTotalScore,
      rivalTotalScore,
      scoreDifference: localTotalScore - rivalTotalScore,
      localWins,
      rivalWins,
      ties,
      rows,
    };
  }, [currentPackings, rivalPackings]);

  // One-click merge better solutions from rival file into local database
  const handleMergeBetterSolutions = async () => {
    if (!diffResults || !rivalPackings) return;

    let mergedCount = 0;
    const packingsToSave: Packing[] = [];

    for (const row of diffResults.rows) {
      if (row.status === 'rival_wins') {
        const squares = rivalPackings.get(row.n);
        if (squares) {
          const val = validatePacking(row.n, squares);
          if (val.isValid) {
            packingsToSave.push({
              n: row.n,
              squares,
              containerLength: val.computedLength,
              score: val.score,
              status: val.isProvenOptimal ? 'optimal' : 'improved',
              isProvenOptimal: val.isProvenOptimal,
              notes: `Merged from ${rivalFileName} (L = ${val.computedLength.toFixed(5)})`,
              timestamp: Date.now(),
            });
            mergedCount++;
          }
        }
      }
    }

    if (packingsToSave.length > 0) {
      await dbService.savePackingsBulk(packingsToSave);
      setMergeMessage(`Successfully merged ${mergedCount} superior puzzle packings into your database!`);
      onRefreshData();
    } else {
      setMergeMessage('No superior puzzle packings found to merge.');
    }
  };

  const filteredRows = useMemo(() => {
    if (!diffResults) return [];
    if (filterMode === 'rival_better') return diffResults.rows.filter((r) => r.status === 'rival_wins');
    if (filterMode === 'local_better') return diffResults.rows.filter((r) => r.status === 'local_wins');
    return diffResults.rows;
  }, [diffResults, filterMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-4xl w-full max-h-[88vh] overflow-hidden shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-950 border border-purple-800/60 flex items-center justify-center text-purple-400">
              <GitCompare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Submission Comparison & Diff Auditor
              </h2>
              <p className="text-xs text-slate-400">
                Compare your local database against competitor CSV files to identify and merge score gains
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

        {/* Upload Rival CSV Area */}
        {!rivalPackings ? (
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-purple-500 rounded-xl p-8 cursor-pointer bg-slate-950 transition-colors">
            <Upload className="w-8 h-8 text-purple-400 mb-2" />
            <span className="font-semibold text-slate-200 text-sm">Select Competitor Submission CSV to Compare</span>
            <span className="text-xs text-slate-500 mt-1">Upload submission_competitor.csv or baseline.csv</span>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Summary Scorecard */}
            {diffResults && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-400 block text-[11px]">Your Total Score:</span>
                  <span className="text-sm font-bold text-cyan-400">{diffResults.localTotalScore.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Rival ({rivalFileName}):</span>
                  <span className="text-sm font-bold text-purple-400">{diffResults.rivalTotalScore.toFixed(4)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Net Score Advantage:</span>
                  <span className={`text-sm font-bold ${diffResults.scoreDifference >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {diffResults.scoreDifference >= 0 ? `+${diffResults.scoreDifference.toFixed(4)}` : diffResults.scoreDifference.toFixed(4)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Record Breakdown:</span>
                  <span className="text-slate-200">
                    <span className="text-emerald-400">{diffResults.localWins}W</span> - <span className="text-slate-400">{diffResults.ties}T</span> - <span className="text-red-400">{diffResults.rivalWins}L</span>
                  </span>
                </div>
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-2.5 py-1 rounded font-medium ${filterMode === 'all' ? 'bg-purple-600 text-white' : 'text-slate-400'}`}
                >
                  All (1000)
                </button>
                <button
                  onClick={() => setFilterMode('rival_better')}
                  className={`px-2.5 py-1 rounded font-medium ${filterMode === 'rival_better' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  Rival Better ({diffResults?.rivalWins})
                </button>
                <button
                  onClick={() => setFilterMode('local_better')}
                  className={`px-2.5 py-1 rounded font-medium ${filterMode === 'local_better' ? 'bg-emerald-500 text-slate-950 font-bold' : 'text-slate-400'}`}
                >
                  You Better ({diffResults?.localWins})
                </button>
              </div>

              <div className="flex items-center gap-2">
                {diffResults && diffResults.rivalWins > 0 && (
                  <button
                    onClick={handleMergeBetterSolutions}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-slate-950 font-bold rounded-lg transition-all shadow"
                  >
                    <FileCheck className="w-3.5 h-3.5" />
                    Merge {diffResults.rivalWins} Winning Puzzles
                  </button>
                )}

                <label className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer">
                  <span>Switch CSV</span>
                  <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </div>

            {mergeMessage && (
              <div className="bg-emerald-950/40 border border-emerald-800/60 p-2.5 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{mergeMessage}</span>
              </div>
            )}

            {/* Table of Differences */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden max-h-[42vh] overflow-y-auto">
              <table className="w-full text-left font-mono text-[11px] text-slate-300">
                <thead className="bg-slate-900 sticky top-0 text-slate-500 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Puzzle</th>
                    <th className="py-2 px-3">Your L</th>
                    <th className="py-2 px-3">Rival L</th>
                    <th className="py-2 px-3">Δ Container</th>
                    <th className="py-2 px-3">Δ Score</th>
                    <th className="py-2 px-3">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {filteredRows.slice(0, 100).map((row) => (
                    <tr key={row.n} className="hover:bg-slate-900/50">
                      <td className="py-1.5 px-3 font-bold text-cyan-400">n = {row.n}</td>
                      <td className="py-1.5 px-3 text-slate-300">{row.localL.toFixed(4)}</td>
                      <td className="py-1.5 px-3 text-slate-300">{row.rivalL.toFixed(4)}</td>
                      <td className="py-1.5 px-3">
                        {row.deltaL > 1e-4 ? (
                          <span className="text-amber-400">-{row.deltaL.toFixed(4)}</span>
                        ) : row.deltaL < -1e-4 ? (
                          <span className="text-emerald-400">+{Math.abs(row.deltaL).toFixed(4)}</span>
                        ) : (
                          <span className="text-slate-500">0.0000</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        {row.deltaScore > 1e-5 ? (
                          <span className="text-amber-400 flex items-center gap-0.5">
                            <TrendingDown className="w-3 h-3" />
                            -{row.deltaScore.toFixed(5)}
                          </span>
                        ) : row.deltaScore < -1e-5 ? (
                          <span className="text-emerald-400 flex items-center gap-0.5">
                            <TrendingUp className="w-3 h-3" />
                            +{Math.abs(row.deltaScore).toFixed(5)}
                          </span>
                        ) : (
                          <span className="text-slate-500">0.00000</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3">
                        {row.status === 'rival_wins' ? (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            Rival Won
                          </span>
                        ) : row.status === 'local_wins' ? (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            You Won
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Tied</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
