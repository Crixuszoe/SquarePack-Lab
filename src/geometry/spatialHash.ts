/**
 * Spatial Hash Grid for Broad-Phase Collision Filtering
 * 
 * Divides 2D continuous space into fixed-size cells.
 * Since a unit square has maximum diameter of sqrt(2) ≈ 1.4142,
 * a cell size of 1.5 to 2.0 guarantees that any potentially overlapping squares
 * will inhabit overlapping or adjacent grid cells.
 */

import { RotatedSquareGeometry } from '../types';

export class SpatialHashGrid {
  private cellSize: number;
  private invCellSize: number;
  // Map from cell key string (e.g. "cx,cy") to array of square IDs
  private cells: Map<string, number[]>;

  constructor(cellSize: number = 1.6) {
    this.cellSize = cellSize;
    this.invCellSize = 1.0 / cellSize;
    this.cells = new Map();
  }

  public clear(): void {
    this.cells.clear();
  }

  private hashCoords(cx: number, cy: number): string {
    return `${cx},${cy}`;
  }

  /**
   * Insert geometry into the grid based on its AABB
   */
  public insert(geom: RotatedSquareGeometry): void {
    const minCx = Math.floor(geom.aabb.minX * this.invCellSize);
    const maxCx = Math.floor(geom.aabb.maxX * this.invCellSize);
    const minCy = Math.floor(geom.aabb.minY * this.invCellSize);
    const maxCy = Math.floor(geom.aabb.maxY * this.invCellSize);

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hashCoords(cx, cy);
        let list = this.cells.get(key);
        if (!list) {
          list = [];
          this.cells.set(key, list);
        }
        list.push(geom.id);
      }
    }
  }

  /**
   * Rebuild the whole spatial hash from an array of geometries
   */
  public rebuild(geometries: RotatedSquareGeometry[]): void {
    this.clear();
    for (let i = 0; i < geometries.length; i++) {
      this.insert(geometries[i]);
    }
  }

  /**
   * Find candidate square IDs that share cells with the given geometry
   */
  public queryCandidates(geom: RotatedSquareGeometry, excludeSelf: boolean = true): number[] {
    const minCx = Math.floor(geom.aabb.minX * this.invCellSize);
    const maxCx = Math.floor(geom.aabb.maxX * this.invCellSize);
    const minCy = Math.floor(geom.aabb.minY * this.invCellSize);
    const maxCy = Math.floor(geom.aabb.maxY * this.invCellSize);

    const candidates = new Set<number>();

    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const key = this.hashCoords(cx, cy);
        const list = this.cells.get(key);
        if (list) {
          for (let i = 0; i < list.length; i++) {
            const id = list[i];
            if (excludeSelf && id === geom.id) continue;
            candidates.add(id);
          }
        }
      }
    }

    return Array.from(candidates);
  }

  /**
   * Get all unique candidate pairs across the whole grid
   */
  public getCandidatePairs(): [number, number][] {
    const pairSet = new Set<string>();
    const pairs: [number, number][] = [];

    for (const list of this.cells.values()) {
      if (list.length < 2) continue;
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        for (let j = i + 1; j < list.length; j++) {
          const b = list[j];
          const min = a < b ? a : b;
          const max = a < b ? b : a;
          const pairKey = `${min}:${max}`;
          if (!pairSet.has(pairKey)) {
            pairSet.add(pairKey);
            pairs.push([min, max]);
          }
        }
      }
    }

    return pairs;
  }
}
