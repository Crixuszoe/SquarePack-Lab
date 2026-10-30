/**
 * IndexedDB Persistence Layer for SquarePack Lab
 * 
 * Stores:
 * - Best validated packings for all n in [1, 1000]
 * - Optimization history and checkpoints
 * - Metric preferences
 */

import { Packing } from '../types';
import { generateBaselinePacking } from '../solver/baseline';

const DB_NAME = 'SquarePackLabDB';
const DB_VERSION = 1;
const STORE_PUZZLES = 'puzzles';
const STORE_CHECKPOINTS = 'checkpoints';

class DatabaseService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  public async getDb(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_PUZZLES)) {
          const puzzleStore = db.createObjectStore(STORE_PUZZLES, { keyPath: 'n' });
          puzzleStore.createIndex('status', 'status', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_CHECKPOINTS)) {
          db.createObjectStore(STORE_CHECKPOINTS, { keyPath: 'id', autoIncrement: true });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };
    });

    return this.initPromise;
  }

  /**
   * Get packing for specific n. If not found in DB, returns deterministic baseline.
   */
  public async getPacking(n: number): Promise<Packing> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PUZZLES, 'readonly');
      const store = tx.objectStore(STORE_PUZZLES);
      const req = store.get(n);

      req.onsuccess = () => {
        if (req.result) {
          resolve(req.result as Packing);
        } else {
          // Fallback to baseline
          const baseline = generateBaselinePacking(n);
          resolve(baseline);
        }
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Save or update validated packing for n
   */
  public async savePacking(packing: Packing): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PUZZLES, 'readwrite');
      const store = tx.objectStore(STORE_PUZZLES);
      const req = store.put(packing);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Save multiple packings in a single bulk transaction
   */
  public async savePackingsBulk(packings: Packing[]): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PUZZLES, 'readwrite');
      const store = tx.objectStore(STORE_PUZZLES);

      for (const p of packings) {
        store.put(p);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  /**
   * Get all stored packings
   */
  public async getAllStoredPackings(): Promise<Map<number, Packing>> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PUZZLES, 'readonly');
      const store = tx.objectStore(STORE_PUZZLES);
      const req = store.getAll();

      req.onsuccess = () => {
        const map = new Map<number, Packing>();
        const list = req.result as Packing[];
        for (const item of list) {
          map.set(item.n, item);
        }
        resolve(map);
      };

      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Reset a specific puzzle back to baseline
   */
  public async resetToBaseline(n: number): Promise<Packing> {
    const baseline = generateBaselinePacking(n);
    await this.savePacking(baseline);
    return baseline;
  }

  /**
   * Reset all puzzles back to baseline
   */
  public async clearAllPuzzles(): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PUZZLES, 'readwrite');
      const store = tx.objectStore(STORE_PUZZLES);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Export all packings as JSON checkpoint
   */
  public async exportCheckpointJson(): Promise<string> {
    const map = await this.getAllStoredPackings();
    const array = Array.from(map.values());
    const data = {
      version: 1,
      timestamp: Date.now(),
      totalSaved: array.length,
      packings: array,
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Import packings from JSON checkpoint
   */
  public async importCheckpointJson(jsonString: string): Promise<number> {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.packings)) {
      throw new Error('Invalid checkpoint JSON format: missing "packings" array');
    }
    await this.savePackingsBulk(parsed.packings);
    return parsed.packings.length;
  }
}

export const dbService = new DatabaseService();
