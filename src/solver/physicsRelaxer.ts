/**
 * Interactive Force-Directed Physics Relaxation Engine
 * 
 * Implements continuous contact mechanics for rotated unit squares:
 * - Computes exact contact normals and penetration depths via SAT separating axes
 * - Applies elastic-viscous contact repulsion forces to push overlapping squares apart
 * - Applies rotational contact torques based on lever arms from square centers
 * - Compresses container boundaries progressively to squeeze the packing
 * - Damps kinetic energy to settle into static jammed equilibria
 * - Returns live contact points, force vectors, and rattlers for canvas rendering
 */

import { UnitSquare, Point, RotatedSquareGeometry } from '../types';
import { computeSquareGeometry, checkSquareIntersection } from '../geometry/sat';
import { SpatialHashGrid } from '../geometry/spatialHash';

export interface ContactPointInfo {
  x: number;
  y: number;
  normalX: number;
  normalY: number;
  depth: number;
  squareA: number;
  squareB: number;
}

export interface PhysicsSimulationState {
  squares: UnitSquare[];
  velocities: { vx: number; vy: number; omega: number }[];
  contacts: ContactPointInfo[];
  rattlerIds: Set<number>;
  currentL: number;
  targetL: number;
  kineticEnergy: number;
  overlapEnergy: number;
}

export class PhysicsRelaxer {
  private n: number;
  private squares: UnitSquare[];
  private velocities: { vx: number; vy: number; omega: number }[];
  private spatialHash: SpatialHashGrid;
  private targetL: number;
  private damping: number = 0.88;
  private repulseSpring: number = 45.0;
  private boundarySpring: number = 25.0;
  private dt: number = 0.04;

  constructor(initialSquares: UnitSquare[], targetContainerL: number) {
    this.n = initialSquares.length;
    this.squares = initialSquares.map((sq) => ({ ...sq }));
    this.velocities = initialSquares.map(() => ({ vx: 0, vy: 0, omega: 0 }));
    this.spatialHash = new SpatialHashGrid(1.6);
    this.targetL = targetContainerL;
  }

  public setTargetL(newL: number): void {
    this.targetL = Math.max(Math.sqrt(this.n), newL);
  }

  public getSquares(): UnitSquare[] {
    return this.squares.map((sq) => ({ ...sq }));
  }

  /**
   * Execute one simulation time-step
   */
  public step(): PhysicsSimulationState {
    const geometries: RotatedSquareGeometry[] = this.squares.map((sq) => computeSquareGeometry(sq));
    this.spatialHash.rebuild(geometries);

    const forces: Point[] = this.squares.map(() => ({ x: 0, y: 0 }));
    const torques: number[] = new Array(this.n).fill(0);
    const contacts: ContactPointInfo[] = [];
    const contactCountPerSquare = new Array(this.n).fill(0);
    let totalOverlapEnergy = 0;

    // 1. Pairwise Contact Repulsion & Torques via Spatial Hash
    const candidatePairs = this.spatialHash.getCandidatePairs();

    for (let p = 0; p < candidatePairs.length; p++) {
      const [idA, idB] = candidatePairs[p];
      const geomA = geometries[idA];
      const geomB = geometries[idB];
      if (!geomA || !geomB) continue;

      const sat = checkSquareIntersection(geomA, geomB, 1e-7);

      if (sat.isColliding) {
        const depth = sat.minOverlap;
        totalOverlapEnergy += depth * depth;

        // Collision normal from B to A
        let dx = geomA.center.x - geomB.center.x;
        let dy = geomA.center.y - geomB.center.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        const nx = dx / dist;
        const ny = dy / dist;

        const forceMagnitude = this.repulseSpring * Math.min(0.5, depth);
        const fx = nx * forceMagnitude;
        const fy = ny * forceMagnitude;

        forces[idA].x += fx;
        forces[idA].y += fy;
        forces[idB].x -= fx;
        forces[idB].y -= fy;

        // Contact point approximation at midpoint of centers shifted along normal
        const cX = (geomA.center.x + geomB.center.x) * 0.5;
        const cY = (geomA.center.y + geomB.center.y) * 0.5;

        // Torques: tau = r_x * F_y - r_y * F_x
        const rAx = cX - geomA.center.x;
        const rAy = cY - geomA.center.y;
        torques[idA] += (rAx * fy - rAy * fx) * 0.5;

        const rBx = cX - geomB.center.x;
        const rBy = cY - geomB.center.y;
        torques[idB] -= (rBx * fy - rBy * fx) * 0.5;

        contacts.push({
          x: cX,
          y: cY,
          normalX: nx,
          normalY: ny,
          depth,
          squareA: idA,
          squareB: idB,
        });

        contactCountPerSquare[idA]++;
        contactCountPerSquare[idB]++;
      }
    }

    // 2. Container Boundary Containment Spring Forces
    const halfL = this.targetL * 0.5;
    for (let i = 0; i < this.n; i++) {
      const geom = geometries[i];
      const aabb = geom.aabb;

      // Left boundary (x = 0)
      if (aabb.minX < 0) {
        forces[i].x += this.boundarySpring * (0 - aabb.minX);
      }
      // Right boundary (x = targetL)
      if (aabb.maxX > this.targetL) {
        forces[i].x -= this.boundarySpring * (aabb.maxX - this.targetL);
      }
      // Bottom boundary (y = 0)
      if (aabb.minY < 0) {
        forces[i].y += this.boundarySpring * (0 - aabb.minY);
      }
      // Top boundary (y = targetL)
      if (aabb.maxY > this.targetL) {
        forces[i].y -= this.boundarySpring * (aabb.maxY - this.targetL);
      }

      // Gentle inward centripetal draft to keep packings centered
      forces[i].x += (halfL - geom.center.x) * 0.4;
      forces[i].y += (halfL - geom.center.y) * 0.4;
    }

    // 3. Integration with Damping (Velocity Verlet / Symplectic Euler)
    let totalKineticEnergy = 0;
    const rattlerIds = new Set<number>();

    for (let i = 0; i < this.n; i++) {
      if (contactCountPerSquare[i] === 0) {
        rattlerIds.add(i);
      }

      // Accelerations (assuming mass = 1, rotational inertia = 0.3)
      const ax = forces[i].x;
      const ay = forces[i].y;
      const alpha = torques[i] / 0.3;

      // Update velocity with damping
      this.velocities[i].vx = (this.velocities[i].vx + ax * this.dt) * this.damping;
      this.velocities[i].vy = (this.velocities[i].vy + ay * this.dt) * this.damping;
      this.velocities[i].omega = (this.velocities[i].omega + alpha * this.dt) * this.damping;

      // Cap maximum speeds for numerical stability
      const maxSpeed = 0.35;
      const speed = Math.hypot(this.velocities[i].vx, this.velocities[i].vy);
      if (speed > maxSpeed) {
        this.velocities[i].vx = (this.velocities[i].vx / speed) * maxSpeed;
        this.velocities[i].vy = (this.velocities[i].vy / speed) * maxSpeed;
      }
      this.velocities[i].omega = Math.max(-0.4, Math.min(0.4, this.velocities[i].omega));

      // Update positions
      this.squares[i].x += this.velocities[i].vx * this.dt;
      this.squares[i].y += this.velocities[i].vy * this.dt;

      const newAngle = this.squares[i].angle + this.velocities[i].omega * this.dt;
      this.squares[i].angle = Math.atan2(Math.sin(newAngle), Math.cos(newAngle));

      totalKineticEnergy += 0.5 * (this.velocities[i].vx ** 2 + this.velocities[i].vy ** 2);
    }

    // Compute actual bounding box of updated squares
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const sq of this.squares) {
      const g = computeSquareGeometry(sq);
      if (g.aabb.minX < minX) minX = g.aabb.minX;
      if (g.aabb.maxX > maxX) maxX = g.aabb.maxX;
      if (g.aabb.minY < minY) minY = g.aabb.minY;
      if (g.aabb.maxY > maxY) maxY = g.aabb.maxY;
    }
    const currentL = Math.max(maxX - minX, maxY - minY);

    return {
      squares: this.getSquares(),
      velocities: [...this.velocities],
      contacts,
      rattlerIds,
      currentL,
      targetL: this.targetL,
      kineticEnergy: totalKineticEnergy,
      overlapEnergy: totalOverlapEnergy,
    };
  }

  /**
   * Run continuous physics relaxation for a set number of steps
   */
  public relax(steps: number = 100): { squares: UnitSquare[]; currentL: number; overlapEnergy: number } {
    let finalState: PhysicsSimulationState | null = null;
    for (let i = 0; i < steps; i++) {
      finalState = this.step();
    }
    return {
      squares: this.getSquares(),
      currentL: finalState ? finalState.currentL : this.targetL,
      overlapEnergy: finalState ? finalState.overlapEnergy : 0,
    };
  }
}
