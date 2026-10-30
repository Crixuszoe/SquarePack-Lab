/**
 * Web Worker Client Wrapper
 * 
 * Manages background optimization worker with automatic lifecycle management,
 * progress streaming, and fallback to main-thread execution if needed.
 */

import { OptimizationParams, OptimizationProgress, Packing } from '../types';
import { PackingOptimizer } from './optimizer';

export class OptimizationWorkerClient {
  private worker: Worker | null = null;
  private fallbackOptimizer: PackingOptimizer | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker(): void {
    if (typeof Worker !== 'undefined') {
      try {
        this.worker = new Worker(new URL('./worker.ts', import.meta.url), {
          type: 'module',
        });
      } catch (err) {
        console.warn('Web Worker initialization failed, will use main thread fallback:', err);
        this.worker = null;
      }
    }
  }

  public async start(
    params: OptimizationParams,
    onProgress: (progress: OptimizationProgress, candidate?: Packing) => void
  ): Promise<Packing> {
    if (this.worker) {
      return new Promise((resolve, reject) => {
        const handler = (e: MessageEvent) => {
          const { type, payload } = e.data;

          if (type === 'PROGRESS') {
            onProgress(payload.progress, payload.candidate);
          } else if (type === 'COMPLETED') {
            this.worker?.removeEventListener('message', handler);
            resolve(payload.bestPacking);
          } else if (type === 'ERROR') {
            this.worker?.removeEventListener('message', handler);
            reject(new Error(payload.message));
          }
        };

        this.worker!.addEventListener('message', handler);
        this.worker!.postMessage({ type: 'START', payload: params });
      });
    }

    // Main thread fallback
    this.fallbackOptimizer = new PackingOptimizer(params);
    return this.fallbackOptimizer.optimize(onProgress);
  }

  public pause(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'PAUSE' });
    } else if (this.fallbackOptimizer) {
      this.fallbackOptimizer.pause();
    }
  }

  public resume(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'RESUME' });
    } else if (this.fallbackOptimizer) {
      this.fallbackOptimizer.resume();
    }
  }

  public cancel(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'CANCEL' });
      // Re-init worker to ensure clean state
      this.worker.terminate();
      this.initWorker();
    } else if (this.fallbackOptimizer) {
      this.fallbackOptimizer.cancel();
      this.fallbackOptimizer = null;
    }
  }
}
