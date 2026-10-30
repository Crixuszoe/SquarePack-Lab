/**
 * Submission CSV Generator, Parser, and Round-Trip Validator
 * 
 * Column specification:
 * id,n,square_id,x,y,angle
 * 
 * Full submission: 1,000 puzzles, 500,500 rows.
 * Validates generated CSV with independent validator before download.
 */

import { Packing, UnitSquare, ValidationResult } from '../types';
import { generateBaselinePacking } from '../solver/baseline';
import { validatePacking } from '../geometry/validator';

export interface CsvRow {
  id: number;
  n: number;
  square_id: number;
  x: number;
  y: number;
  angle: number;
}

export interface CsvGenerationProgress {
  currentPuzzle: number;
  totalPuzzles: number;
  rowsGenerated: number;
  phase: 'generating' | 'roundtrip_validating' | 'ready' | 'error';
  errorMessage?: string;
}

/**
 * Format coordinate or angle with sufficient precision (up to 9 decimals, trimmed trailing zeros)
 */
export function formatFloat(val: number): string {
  if (!Number.isFinite(val)) {
    throw new Error(`Cannot export non-finite value: ${val}`);
  }
  // 8 decimal places provides sub-nanometer precision for coordinates
  const fixed = val.toFixed(8);
  // Strip trailing zeros after dot
  return parseFloat(fixed).toString();
}

/**
 * Generates submission CSV string in chunks to keep UI responsive
 */
export async function generateSubmissionCsv(
  puzzlesMap: Map<number, Packing>,
  puzzleRange: number[],
  onProgress?: (progress: CsvGenerationProgress) => void
): Promise<{ csvString: string; totalRows: number; validationResults: Map<number, ValidationResult> }> {
  const lines: string[] = ['id,n,square_id,x,y,angle'];
  let globalRowId = 0;
  const totalPuzzles = puzzleRange.length;

  for (let idx = 0; idx < totalPuzzles; idx++) {
    const n = puzzleRange[idx];
    let packing = puzzlesMap.get(n);
    if (!packing) {
      packing = generateBaselinePacking(n);
    }

    if (packing.squares.length !== n) {
      throw new Error(`Puzzle n=${n} has invalid square count: expected ${n}, got ${packing.squares.length}`);
    }

    // Sort squares by id 0..n-1 to guarantee strict order
    const sortedSquares = [...packing.squares].sort((a, b) => a.id - b.id);

    for (let s = 0; s < sortedSquares.length; s++) {
      const sq = sortedSquares[s];
      const line = `${globalRowId},${n},${sq.id},${formatFloat(sq.x)},${formatFloat(sq.y)},${formatFloat(sq.angle)}`;
      lines.push(line);
      globalRowId++;
    }

    // Yield control periodically for UI responsiveness
    if (idx % 25 === 0 || idx === totalPuzzles - 1) {
      if (onProgress) {
        onProgress({
          currentPuzzle: idx + 1,
          totalPuzzles,
          rowsGenerated: globalRowId,
          phase: 'generating',
        });
      }
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const csvString = lines.join('\n');

  // PHASE 2: Round-trip verification
  // Parse back the generated CSV string and run independent validator on every puzzle!
  if (onProgress) {
    onProgress({
      currentPuzzle: totalPuzzles,
      totalPuzzles,
      rowsGenerated: globalRowId,
      phase: 'roundtrip_validating',
    });
  }

  const parsedPuzzles = parseSubmissionCsv(csvString);
  const validationResults = new Map<number, ValidationResult>();

  for (const [n, squares] of parsedPuzzles.entries()) {
    const val = validatePacking(n, squares);
    validationResults.set(n, val);
    if (!val.isValid) {
      const firstError = val.issues.find((i) => i.severity === 'error')?.message || 'Geometry validation error';
      throw new Error(`Round-trip validation failed for n=${n}: ${firstError}`);
    }
  }

  if (onProgress) {
    onProgress({
      currentPuzzle: totalPuzzles,
      totalPuzzles,
      rowsGenerated: globalRowId,
      phase: 'ready',
    });
  }

  return {
    csvString,
    totalRows: globalRowId,
    validationResults,
  };
}

/**
 * Parses raw submission CSV string back into map of puzzle n -> UnitSquare[]
 */
export function parseSubmissionCsv(csvContent: string): Map<number, UnitSquare[]> {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error('CSV is empty or missing data lines.');
  }

  const header = lines[0].trim().toLowerCase().split(',');
  const expectedCols = ['id', 'n', 'square_id', 'x', 'y', 'angle'];
  
  // Verify columns
  for (let c = 0; c < expectedCols.length; c++) {
    if (header[c] !== expectedCols[c]) {
      throw new Error(
        `Invalid CSV header. Expected [${expectedCols.join(', ')}], found [${header.join(', ')}]`
      );
    }
  }

  const puzzlesMap = new Map<number, UnitSquare[]>();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(',');
    if (cols.length !== 6) {
      throw new Error(`Line ${i + 1} has ${cols.length} columns, expected 6: "${line}"`);
    }

    const rowId = parseInt(cols[0], 10);
    const n = parseInt(cols[1], 10);
    const squareId = parseInt(cols[2], 10);
    const x = parseFloat(cols[3]);
    const y = parseFloat(cols[4]);
    const angle = parseFloat(cols[5]);

    if (isNaN(rowId) || isNaN(n) || isNaN(squareId) || isNaN(x) || isNaN(y) || isNaN(angle)) {
      throw new Error(`Line ${i + 1} contains NaN numeric values: "${line}"`);
    }

    let squareList = puzzlesMap.get(n);
    if (!squareList) {
      squareList = [];
      puzzlesMap.set(n, squareList);
    }

    squareList.push({
      id: squareId,
      x,
      y,
      angle,
    });
  }

  return puzzlesMap;
}

/**
 * Trigger browser file download from string content
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/csv'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
