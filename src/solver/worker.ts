/**
 * Web Worker for Off-Thread Numerical Optimization
 * 
 * Runs simulated annealing, SAT collision calculations, and container contraction
 * at maximum CPU speed on a background thread without blocking the React UI or canvas.
 */

import { OptimizationParams, OptimizationProgress, Packing } from '../types';
import { PackingOptimizer } from './optimizer';

let currentOptimizer: PackingOptimizer | null = null;

self.onmessage = async (e: MessageEvent) => {
  const { type, payload } = e.data;

  if (type === 'START') {
    const params: OptimizationParams = payload;
    currentOptimizer = new PackingOptimizer(params);

    try {
      const best = await currentOptimizer.optimize(
        (progress: OptimizationProgress, candidate?: Packing) => {
          self.postMessage({
            type: 'PROGRESS',
            payload: { progress, candidate },
          });
        }
      );

      self.postMessage({
        type: 'COMPLETED',
        payload: { bestPacking: best },
      });
    } catch (err: unknown) {
      self.postMessage({
        type: 'ERROR',
        payload: { message: err instanceof Error ? err.message : String(err) },
      });
    } finally {
      currentOptimizer = null;
    }
  } else if (type === 'PAUSE') {
    if (currentOptimizer) currentOptimizer.pause();
  } else if (type === 'RESUME') {
    if (currentOptimizer) currentOptimizer.resume();
  } else if (type === 'CANCEL') {
    if (currentOptimizer) currentOptimizer.cancel();
    currentOptimizer = null;
  }
};
