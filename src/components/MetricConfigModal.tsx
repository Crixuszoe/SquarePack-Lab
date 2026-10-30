/**
 * Metric Configuration & Notebook Reconciliation Modal
 * 
 * Allows users to inspect and adjust metric assumptions, tolerances,
 * and upload official competition notebooks/scripts to reconcile exact behaviors.
 */

import React, { useState } from 'react';
import { globalMetricEngine } from '../metrics/config';
import { MetricConfig } from '../types';
import { Sliders, Upload, CheckCircle2, FileCode2, X, RotateCcw } from 'lucide-react';

interface MetricConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const MetricConfigModal: React.FC<MetricConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const [config, setConfig] = useState<MetricConfig>(globalMetricEngine.getConfig());
  const [notebookAnalysis, setNotebookAnalysis] = useState<{
    detectedFormula?: string;
    detectedTolerance?: number;
    notes: string[];
    isCompatible: boolean;
  } | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    globalMetricEngine.updateConfig(config);
    onConfigChanged();
    onClose();
  };

  const handleReset = () => {
    globalMetricEngine.resetToDefault();
    const def = globalMetricEngine.getConfig();
    setConfig(def);
    onConfigChanged();
  };

  const handleNotebookUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const analysis = globalMetricEngine.inspectUploadedNotebook(text);
      setNotebookAnalysis(analysis);

      if (analysis.detectedTolerance) {
        setConfig((prev) => ({
          ...prev,
          overlapTolerance: analysis.detectedTolerance!,
        }));
      }
    } catch (err) {
      console.error('Failed to parse uploaded notebook', err);
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-2xl flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">Metric Configuration & Official Script Matching</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Upload Metric Notebook Section */}
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-2 text-xs">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <FileCode2 className="w-4 h-4 text-cyan-400" />
            Upload Official Metric Notebook (.ipynb / .py)
          </span>
          <p className="text-slate-400 text-[11px]">
            Upload the competition’s evaluation script. SquarePack Lab will inspect the source code,
            detect exact floating-point tolerances and scoring formulas, and reconcile them automatically.
          </p>
          <label className="flex items-center justify-center gap-2 py-2 px-3 bg-slate-900 hover:bg-slate-850 border border-slate-700 rounded-lg cursor-pointer text-slate-300 hover:text-white transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Select Notebook or Script</span>
            <input
              type="file"
              accept=".ipynb,.py,.txt"
              onChange={handleNotebookUpload}
              className="hidden"
            />
          </label>

          {notebookAnalysis && (
            <div className="bg-slate-900 border border-cyan-900/60 rounded p-2.5 flex flex-col gap-1 text-[11px] font-mono text-cyan-300">
              <span className="font-bold flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> Analysis Complete
              </span>
              {notebookAnalysis.notes.map((note, i) => (
                <div key={i}>• {note}</div>
              ))}
            </div>
          )}
        </div>

        {/* Tolerances Form */}
        <div className="flex flex-col gap-3 text-xs">
          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Interior Overlap Tolerance (ε)
            </label>
            <input
              type="number"
              step="1e-9"
              value={config.overlapTolerance}
              onChange={(e) =>
                setConfig({ ...config, overlapTolerance: parseFloat(e.target.value) || 1e-8 })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 font-mono text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            />
            <span className="text-[10px] text-slate-500 mt-0.5 block">
              Default: 1e-8. Overlaps greater than this depth are rejected as interior collisions.
            </span>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Score Calculation Formula</label>
            <select
              value={config.scoreFormula}
              onChange={(e) =>
                setConfig({ ...config, scoreFormula: e.target.value as 'standard' | 'length_only' })
              }
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 text-xs focus:border-cyan-500 focus:outline-none"
            >
              <option value="standard">Standard: L / sqrt(n) - 1 (Official)</option>
              <option value="length_only">Raw Container Length: L</option>
            </select>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-800">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-lg shadow"
            >
              Apply Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
