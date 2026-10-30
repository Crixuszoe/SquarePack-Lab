/**
 * Automated Verification Test Suite & Live Benchmark Modal
 */

import React, { useState } from 'react';
import { runAllTests, runSolverBenchmark, TestResult } from '../tests/testSuite';
import { BenchmarkRecord } from '../types';
import { CheckCircle2, AlertTriangle, Play, Zap, Loader2, X, Terminal, Clock } from 'lucide-react';

interface BenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BenchmarkModal: React.FC<BenchmarkModalProps> = ({ isOpen, onClose }) => {
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[] | null>(null);
  const [testSummary, setTestSummary] = useState<{ allPassed: boolean; totalDurationMs: number } | null>(null);

  const [isRunningBench, setIsRunningBench] = useState(false);
  const [benchRecords, setBenchRecords] = useState<BenchmarkRecord[] | null>(null);

  if (!isOpen) return null;

  const handleRunTests = async () => {
    setIsRunningTests(true);
    // Yield to let UI update
    await new Promise((r) => setTimeout(r, 50));
    try {
      const { results, allPassed, totalDurationMs } = await runAllTests();
      setTestResults(results);
      setTestSummary({ allPassed, totalDurationMs });
    } finally {
      setIsRunningTests(false);
    }
  };

  const handleRunBenchmark = async () => {
    setIsRunningBench(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
      // Execute measured benchmark on n = 2, 3, 5, 8
      const records = await runSolverBenchmark([2, 3, 5, 8], 4000);
      setBenchRecords(records);
    } finally {
      setIsRunningBench(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">Verification Tests & Live Benchmark</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRunTests}
            disabled={isRunningTests || isRunningBench}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-semibold text-xs rounded-lg transition-colors shadow"
          >
            {isRunningTests ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            Run 10 Automated Geometry Tests
          </button>

          <button
            onClick={handleRunBenchmark}
            disabled={isRunningTests || isRunningBench}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold text-xs rounded-lg transition-colors shadow"
          >
            {isRunningBench ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Clock className="w-3.5 h-3.5" />}
            Execute Live Solver Benchmark (n=2, 3, 5, 8)
          </button>
        </div>

        {/* Test Results Output */}
        {testResults && (
          <div className="flex flex-col gap-2 bg-slate-950 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800 font-mono">
              <span className="text-slate-300 font-semibold">Test Execution Results</span>
              {testSummary && (
                <span className={testSummary.allPassed ? 'text-emerald-400' : 'text-red-400'}>
                  {testSummary.allPassed ? '10/10 PASSED' : 'TESTS FAILED'} in {testSummary.totalDurationMs.toFixed(1)}ms
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-850 font-mono text-[11px] max-h-60 overflow-y-auto">
              {testResults.map((t) => (
                <div key={t.id} className="py-1.5 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    {t.passed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <span className="text-slate-200 font-medium">{t.name}</span>
                      <p className="text-slate-500 text-[10px]">{t.message}</p>
                    </div>
                  </div>
                  <span className="text-slate-500 shrink-0">{t.durationMs.toFixed(1)}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Live Benchmark Table */}
        {benchRecords && (
          <div className="flex flex-col gap-2 bg-slate-950 border border-purple-900/50 rounded-lg p-3">
            <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800 font-mono text-purple-300 font-semibold">
              <span>Actual Measured Solver Performance (Zero Fabrication)</span>
            </div>

            <table className="w-full text-left font-mono text-[11px] text-slate-300">
              <thead>
                <tr className="text-slate-500 border-b border-slate-850 pb-1">
                  <th className="py-1">Puzzle</th>
                  <th className="py-1">Baseline L</th>
                  <th className="py-1">Optimized L</th>
                  <th className="py-1">Score Δ</th>
                  <th className="py-1">Runtime</th>
                  <th className="py-1">Valid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {benchRecords.map((b) => (
                  <tr key={b.n}>
                    <td className="py-1.5 font-bold text-cyan-400">n = {b.n}</td>
                    <td className="py-1.5 text-slate-400">{b.baselineL.toFixed(4)}</td>
                    <td className="py-1.5 font-semibold text-emerald-400">{b.optimizedL.toFixed(5)}</td>
                    <td className="py-1.5 text-purple-400 font-medium">
                      {b.scoreDelta > 0 ? `-${b.scoreDelta.toFixed(5)}` : '0.00000'}
                    </td>
                    <td className="py-1.5 text-slate-400">{(b.runtimeMs / 1000).toFixed(2)}s</td>
                    <td className="py-1.5 text-emerald-400">
                      {b.isValid ? 'VALID' : 'INVALID'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
