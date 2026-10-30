/**
 * Submission Export & Import Modal
 * 
 * Supports:
 * 1. Full Submission CSV Export (all 1,000 puzzles, 500,500 rows) with pre-download round-trip validation
 * 2. Partial Submission CSV Export (selected range or single puzzle)
 * 3. Submission CSV Import (parses, validates, and incorporates external/Kaggle results)
 * 4. JSON Checkpoint Export & Restore
 */

import React, { useState } from 'react';
import { Packing } from '../types';
import { generateSubmissionCsv, downloadFile, parseSubmissionCsv } from '../export/csv';
import { dbService } from '../storage/db';
import { validatePacking } from '../geometry/validator';
import {
  Download,
  Upload,
  FileText,
  Database,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentN: number;
  storedPackings: Map<number, Packing>;
  onRefreshData: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  currentN,
  storedPackings,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'csv' | 'checkpoint' | 'import'>('csv');
  const [exportMode, setExportMode] = useState<'full' | 'single' | 'range'>('full');
  const [rangeStart, setRangeStart] = useState<number>(1);
  const [rangeEnd, setRangeEnd] = useState<number>(50);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatus, setExportStatus] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Import states
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      setExportStatus('Preparing puzzle geometries...');
      setProgressPct(5);

      let targetNList: number[] = [];
      if (exportMode === 'full') {
        targetNList = Array.from({ length: 1000 }, (_, i) => i + 1);
      } else if (exportMode === 'single') {
        targetNList = [currentN];
      } else {
        const start = Math.max(1, rangeStart);
        const end = Math.min(1000, rangeEnd);
        targetNList = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      }

      const { csvString, totalRows } = await generateSubmissionCsv(
        storedPackings,
        targetNList,
        (prog) => {
          if (prog.phase === 'generating') {
            const pct = Math.round((prog.currentPuzzle / prog.totalPuzzles) * 80);
            setProgressPct(pct);
            setExportStatus(
              `Generating rows... Puzzle ${prog.currentPuzzle} of ${prog.totalPuzzles} (${prog.rowsGenerated.toLocaleString()} rows)`
            );
          } else if (prog.phase === 'roundtrip_validating') {
            setProgressPct(90);
            setExportStatus('Executing strict round-trip geometry validation on generated CSV...');
          } else if (prog.phase === 'ready') {
            setProgressPct(100);
            setExportStatus('Verification passed! Starting download...');
          }
        }
      );

      const filename =
        exportMode === 'full'
          ? 'submission_full.csv'
          : exportMode === 'single'
          ? `submission_n${currentN}.csv`
          : `submission_n${rangeStart}_to_${rangeEnd}.csv`;

      downloadFile(csvString, filename);
      setExportStatus(`Success! Downloaded ${filename} (${totalRows.toLocaleString()} rows verified).`);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCheckpointJson = async () => {
    try {
      const jsonStr = await dbService.exportCheckpointJson();
      downloadFile(jsonStr, 'squarepack_checkpoint.json', 'application/json');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    setImportStatus('Reading and validating file...');
    setErrorMessage(null);

    try {
      const text = await file.text();

      if (file.name.endsWith('.json')) {
        const count = await dbService.importCheckpointJson(text);
        setImportStatus(`Successfully restored ${count} packings from checkpoint.`);
        onRefreshData();
      } else {
        // Parse CSV
        const parsed = parseSubmissionCsv(text);
        let importedCount = 0;
        let improvedCount = 0;
        const validPackingsToSave: Packing[] = [];

        for (const [n, squares] of parsed.entries()) {
          const val = validatePacking(n, squares);
          if (!val.isValid) {
            throw new Error(`CSV contains invalid geometry for n=${n}: ${val.issues[0]?.message}`);
          }

          const existing = storedPackings.get(n);
          const isBetter = !existing || val.computedLength < existing.containerLength - 1e-6;

          if (isBetter) {
            improvedCount++;
          }

          validPackingsToSave.push({
            n,
            squares,
            containerLength: val.computedLength,
            score: val.score,
            status: val.isProvenOptimal ? 'optimal' : isBetter ? 'improved' : 'baseline',
            isProvenOptimal: val.isProvenOptimal,
            notes: 'Imported from submission CSV',
            timestamp: Date.now(),
          });
          importedCount++;
        }

        await dbService.savePackingsBulk(validPackingsToSave);
        setImportStatus(
          `Imported ${importedCount} validated puzzle packings (${improvedCount} local improvements applied).`
        );
        onRefreshData();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-lg w-full shadow-2xl flex flex-col gap-4">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-bold text-slate-100">Export & Import Center</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setActiveTab('csv')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'csv' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Export Submission CSV
          </button>
          <button
            onClick={() => setActiveTab('checkpoint')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'checkpoint' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            JSON Checkpoint
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 py-1.5 rounded-md font-medium transition-colors ${
              activeTab === 'import' ? 'bg-cyan-500 text-slate-950 font-semibold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Import CSV / JSON
          </button>
        </div>

        {/* Tab 1: CSV Export */}
        {activeTab === 'csv' && (
          <div className="flex flex-col gap-3.5 text-xs">
            <div className="text-slate-300">
              Select export scope. The format strictly follows the competition specification:
              <div className="mt-1 font-mono text-[11px] text-cyan-400 bg-slate-950 p-2 rounded border border-slate-800">
                id,n,square_id,x,y,angle
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'full'}
                  onChange={() => setExportMode('full')}
                  className="accent-cyan-400"
                />
                <span className="text-slate-200 font-medium">
                  Full Submission: All 1,000 Puzzles (500,500 rows)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'single'}
                  onChange={() => setExportMode('single')}
                  className="accent-cyan-400"
                />
                <span className="text-slate-200">Current Puzzle only (n={currentN})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'range'}
                  onChange={() => setExportMode('range')}
                  className="accent-cyan-400"
                />
                <span className="text-slate-200">Custom Range</span>
              </label>
            </div>

            {exportMode === 'range' && (
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div>
                  <label className="text-slate-400 block mb-1">From n</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={rangeStart}
                    onChange={(e) => setRangeStart(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">To n</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(parseInt(e.target.value, 10) || 1)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono"
                  />
                </div>
              </div>
            )}

            {isExporting && (
              <div className="flex flex-col gap-1.5 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div className="flex items-center justify-between text-[11px] text-cyan-400">
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {exportStatus}
                  </span>
                  <span>{progressPct}%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-cyan-500 h-full transition-all duration-200"
                    style={{ width: `${progressPct}%` }}
                  ></div>
                </div>
              </div>
            )}

            <button
              onClick={handleExportCsv}
              disabled={isExporting}
              className="py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
            >
              <Download className="w-4 h-4" />
              Generate & Validate Download
            </button>
          </div>
        )}

        {/* Tab 2: Checkpoint */}
        {activeTab === 'checkpoint' && (
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            <p>
              Save complete solver state, current best packings, and history to a portable JSON
              checkpoint file for backup or transferring between machines.
            </p>
            <button
              onClick={handleExportCheckpointJson}
              className="py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Database className="w-4 h-4" />
              Download JSON Checkpoint
            </button>
          </div>
        )}

        {/* Tab 3: Import */}
        {activeTab === 'import' && (
          <div className="flex flex-col gap-3 text-xs text-slate-300">
            <p>
              Upload a previously generated submission CSV, Kaggle output CSV, or JSON checkpoint.
              SquarePack Lab will re-verify all geometry before incorporating it into your database.
            </p>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-6 cursor-pointer bg-slate-950 transition-colors">
              <Upload className="w-8 h-8 text-cyan-400 mb-2" />
              <span className="font-semibold text-slate-200">Click to upload CSV or JSON</span>
              <span className="text-[11px] text-slate-500">Supports .csv and .json</span>
              <input
                type="file"
                accept=".csv,.json"
                onChange={handleFileUpload}
                disabled={isImporting}
                className="hidden"
              />
            </label>
            {isImporting && (
              <div className="flex items-center gap-2 text-cyan-400 font-mono">
                <Loader2 className="w-4 h-4 animate-spin" />
                {importStatus}
              </div>
            )}
            {importStatus && !isImporting && (
              <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-800/40">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importStatus}</span>
              </div>
            )}
          </div>
        )}

        {/* Error Notification */}
        {errorMessage && (
          <div className="bg-red-950/40 border border-red-800/50 p-2.5 rounded-lg text-xs text-red-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>{errorMessage}</div>
          </div>
        )}
      </div>
    </div>
  );
};
