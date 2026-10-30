/**
 * Python Solver & Kaggle Execution Guide Modal
 */

import React, { useState } from 'react';
import { PYTHON_SOLVER_SCRIPT, KAGGLE_INSTRUCTIONS } from '../solver/pythonSolver';
import { downloadFile } from '../export/csv';
import { Terminal, Copy, Check, Download, X, BookOpen } from 'lucide-react';

interface PythonSolverModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PythonSolverModal: React.FC<PythonSolverModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'script' | 'instructions'>('script');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(
      activeTab === 'script' ? PYTHON_SOLVER_SCRIPT : KAGGLE_INSTRUCTIONS
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    downloadFile(PYTHON_SOLVER_SCRIPT, 'squarepack_solver.py', 'text/x-python');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">Standalone Python & Kaggle Solver</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab & Actions */}
        <div className="flex items-center justify-between">
          <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('script')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'script' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              squarepack_solver.py
            </button>
            <button
              onClick={() => setActiveTab('instructions')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                activeTab === 'instructions' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400'
              }`}
            >
              Kaggle / Run Guide
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            {activeTab === 'script' && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold rounded-lg transition-colors shadow"
              >
                <Download className="w-3.5 h-3.5" />
                Download .py
              </button>
            )}
          </div>
        </div>

        {/* Content Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-y-auto max-h-[50vh]">
          <pre className="whitespace-pre-wrap leading-relaxed">
            {activeTab === 'script' ? PYTHON_SOLVER_SCRIPT : KAGGLE_INSTRUCTIONS}
          </pre>
        </div>
      </div>
    </div>
  );
};
