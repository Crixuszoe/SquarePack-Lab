/**
 * Independent Validation Audit & Geometry Metrics Panel
 */

import React, { useMemo } from 'react';
import { Packing, ValidationResult } from '../types';
import { globalMetricEngine } from '../metrics/config';
import { getLiteratureRecordInfo, generateLiteraturePacking } from '../solver/literatureRecords';
import { computeRigidityDiagnostics } from '../geometry/rigidity';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Ruler,
  Sparkles,
  BookOpen,
  Atom,
  Activity,
  Layers,
  ArrowDownRight,
} from 'lucide-react';

interface ValidationPanelProps {
  packing: Packing | null;
  validation: ValidationResult | null;
  onApplyLiteratureRecord?: () => void;
}

export const ValidationPanel: React.FC<ValidationPanelProps> = ({
  packing,
  validation,
  onApplyLiteratureRecord,
}) => {
  if (!packing || !validation) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-500 text-xs">
        No validation data available.
      </div>
    );
  }

  const n = packing.n;
  const sqrtN = Math.sqrt(n);
  const baselineL = Math.ceil(sqrtN);
  const baselineScore = globalMetricEngine.computeGridFallbackScore(n);
  const currentL = validation.computedLength;
  const currentScore = validation.score;
  const improvement = baselineScore - currentScore;
  const pctImprovement = baselineScore > 0 ? (improvement / baselineScore) * 100 : 0;

  // Literature benchmark record info
  const litInfo = useMemo(() => getLiteratureRecordInfo(n), [n]);
  const hasLiteratureCandidate = useMemo(() => !!generateLiteraturePacking(n), [n]);

  // Mechanical rigidity and jamming diagnostics
  const rigidity = useMemo(() => {
    const sqs = packing.squares;
    if (!sqs || sqs.length === 0 || !Number.isFinite(currentL) || currentL <= 0) return null;
    return computeRigidityDiagnostics(n, sqs, currentL);
  }, [n, packing.squares, currentL]);

  const gapToLit = currentL - litInfo.bestKnownL;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
      {/* Header & Status Banner */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-1.5">
          <Ruler className="w-4 h-4 text-cyan-400" />
          Geometry & Validation Audit
        </h3>
        <span
          className={`flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full font-medium ${
            validation.isValid
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border border-red-500/30'
          }`}
        >
          {validation.isValid ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              Valid Candidate
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5" />
              Validation Error
            </>
          )}
        </span>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Validated L */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex flex-col">
          <span className="text-[11px] text-slate-400">Container Length (L)</span>
          <span className="text-base font-bold font-mono text-cyan-300">
            {Number.isFinite(currentL) ? currentL.toFixed(5) : '—'}
          </span>
          <span className="text-[10px] text-slate-500 font-mono">
            W: {Number.isFinite(validation.width) ? validation.width.toFixed(4) : '—'} | H: {Number.isFinite(validation.height) ? validation.height.toFixed(4) : '—'}
          </span>
        </div>

        {/* Puzzle Score */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex flex-col">
          <span className="text-[11px] text-slate-400">Score (n={n})</span>
          <span className="text-base font-bold font-mono text-emerald-400">
            {Number.isFinite(currentScore) ? currentScore.toFixed(5) : '—'}
          </span>
          <span className="text-[10px] text-slate-500">L / √{n} − 1</span>
        </div>

        {/* Grid Baseline L */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex flex-col">
          <span className="text-[11px] text-slate-400">Baseline Grid (L_grid)</span>
          <span className="text-base font-bold font-mono text-slate-300">
            {baselineL.toFixed(5)}
          </span>
          <span className="text-[10px] text-slate-500">Score: {baselineScore.toFixed(5)}</span>
        </div>

        {/* Area Lower Bound */}
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-2.5 flex flex-col">
          <span className="text-[11px] text-slate-400">Area Lower Bound (√n)</span>
          <span className="text-base font-bold font-mono text-purple-400">
            {sqrtN.toFixed(5)}
          </span>
          <span className="text-[10px] text-slate-500">Theoretical limit</span>
        </div>
      </div>

      {/* Improvement Summary */}
      {improvement > 1e-6 ? (
        <div className="bg-purple-950/30 border border-purple-800/40 rounded-lg p-3 flex items-center justify-between text-xs text-purple-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Score reduced by {improvement.toFixed(6)} ({pctImprovement.toFixed(2)}% vs baseline)</span>
          </div>
          <span className="font-mono text-[11px] bg-purple-900/40 px-2 py-0.5 rounded border border-purple-700/50">
            ΔL = {(baselineL - currentL).toFixed(5)}
          </span>
        </div>
      ) : null}

      {/* Computational Geometry Literature Benchmark & Gap */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-semibold text-slate-200">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <span>Literature Record Benchmark</span>
          </div>
          {litInfo.provenOptimal ? (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-2 py-0.5 rounded">
              Proven Optimal
            </span>
          ) : (
            <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/60 px-2 py-0.5 rounded">
              Best Known Bound
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2 rounded border border-slate-800 font-mono text-[11px]">
          <div>
            <span className="text-slate-500 text-[10px] block">Record L (Friedman)</span>
            <span className="font-bold text-amber-300">{litInfo.bestKnownL.toFixed(5)}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Gap to Record (ΔL)</span>
            <span className={gapToLit <= 1e-5 ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
              {gapToLit <= 1e-5 ? '0.00000 (Matched)' : `+${gapToLit.toFixed(5)}`}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Potential Savings</span>
            <span className="font-bold text-purple-300">
              {litInfo.potentialScoreSavings > 1e-5 ? `-${litInfo.potentialScoreSavings.toFixed(5)}` : '0.0000'}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400 flex items-start gap-1.5">
          <span className="text-amber-400/80">Strategy:</span>
          <span>{litInfo.strategyDescription}</span>
        </div>

        {hasLiteratureCandidate && gapToLit > 1e-4 && onApplyLiteratureRecord && (
          <button
            onClick={onApplyLiteratureRecord}
            className="w-full py-1.5 px-3 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Load Known Literature Solution (L = {litInfo.bestKnownL.toFixed(4)})
          </button>
        )}
      </div>

      {/* Mechanical Rigidity & Jamming Diagnostics */}
      {rigidity && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-semibold text-slate-200">
              <Atom className="w-4 h-4 text-emerald-400" />
              <span>Rigidity & Jamming Diagnostics</span>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                rigidity.isMechanicallyJammed
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                  : 'bg-amber-950/60 text-amber-300 border-amber-800'
              }`}
            >
              {rigidity.isMechanicallyJammed ? 'Mechanically Jammed (Stable)' : `${rigidity.rattlerSquareIds.length} Rattlers Detected`}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-900/60 p-2 rounded border border-slate-800 font-mono text-[11px]">
            <div>
              <span className="text-slate-500 text-[10px] block">Packing Fraction (Φ)</span>
              <span className="font-bold text-cyan-300">{(rigidity.packingFraction * 100).toFixed(2)}%</span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Coordination (Z)</span>
              <span className={rigidity.coordinationNumber >= 3.0 ? 'font-bold text-emerald-400' : 'font-bold text-slate-300'}>
                {rigidity.coordinationNumber.toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 text-[10px] block">Total Contacts</span>
              <span className="font-bold text-slate-200">{rigidity.totalContacts} edges</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Container Wall Pins:</span>
            <span className="font-mono text-slate-300">
              L:{rigidity.wallContacts.left.length} R:{rigidity.wallContacts.right.length} B:{rigidity.wallContacts.bottom.length} T:{rigidity.wallContacts.top.length}
            </span>
          </div>
        </div>
      )}

      {/* Independent Verification Checklist */}
      <div className="flex flex-col gap-1.5 text-xs">
        <span className="text-slate-400 font-medium">Independent Verification Checklist:</span>
        <div className="bg-slate-950 border border-slate-800 rounded-lg divide-y divide-slate-850 overflow-hidden font-mono text-[11px]">
          {/* Check 1 */}
          <div className="flex items-center justify-between px-3 py-2 text-slate-300">
            <span>1. Square count matches n ({n})</span>
            {validation.squareCount === n ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PASS
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                FAIL ({validation.squareCount})
              </span>
            )}
          </div>

          {/* Check 2 */}
          <div className="flex items-center justify-between px-3 py-2 text-slate-300">
            <span>2. Unique IDs sequence [0 .. {n - 1}]</span>
            {!validation.issues.some((i) => i.code.includes('ID')) ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PASS
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                FAIL
              </span>
            )}
          </div>

          {/* Check 3 */}
          <div className="flex items-center justify-between px-3 py-2 text-slate-300">
            <span>3. Finite numeric values (no NaN/Inf)</span>
            {!validation.issues.some((i) => i.code.includes('FINITE')) ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PASS
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                FAIL
              </span>
            )}
          </div>

          {/* Check 4 */}
          <div className="flex items-center justify-between px-3 py-2 text-slate-300">
            <span>4. SAT Interior Overlap (tol: {validation.toleranceUsed})</span>
            {validation.collisions.length === 0 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                0 Overlaps
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {validation.collisions.length} Collisions
              </span>
            )}
          </div>

          {/* Check 5: Height (H) and Width (W) Boundary Check */}
          <div className="flex items-center justify-between px-3 py-2 text-slate-300">
            <span className="flex items-center gap-1.5">
              <span>5. Height (H) & Width (W) check:</span>
              <span className="text-slate-400 text-[10px]">
                H={Number.isFinite(validation.height) ? validation.height.toFixed(4) : '—'}, W={Number.isFinite(validation.width) ? validation.width.toFixed(4) : '—'}
              </span>
            </span>
            {Number.isFinite(validation.height) && validation.height <= validation.computedLength + 1e-7 ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                PASS ({validation.bindingAxis === 'balanced' ? 'H=W' : validation.bindingAxis === 'height' ? 'H=L' : 'W=L'})
              </span>
            ) : (
              <span className="text-red-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                FAIL
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Collision Details if any */}
      {validation.collisions.length > 0 && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-lg p-3 text-xs text-red-300 flex flex-col gap-1.5">
          <div className="font-semibold flex items-center gap-1 text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            Detected Interior Collisions:
          </div>
          <div className="max-h-24 overflow-y-auto font-mono text-[11px] divide-y divide-red-900/30">
            {validation.collisions.slice(0, 5).map((col, idx) => (
              <div key={idx} className="py-1 flex justify-between">
                <span>
                  Square #{col.squareA} ↔ Square #{col.squareB}
                </span>
                <span className="font-semibold">depth: {col.overlapDepth.toFixed(6)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
