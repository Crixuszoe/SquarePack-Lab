/**
 * Jamming, Contact Rigidity & Rattler Diagnostics
 * 
 * Evaluates the mechanical stability of a square packing:
 * - Identifies physical contact graph (edge-edge, edge-vertex, vertex-vertex)
 * - Identifies container wall contacts (left, right, bottom, top)
 * - Detects "Rattlers" (squares with <= 1 contact, having unconstrained translational freedom)
 * - Computes Packing Fraction (Phi = n / L^2) and Coordination Number (Z = 2 * C / n)
 */

import { UnitSquare, Point, RotatedSquareGeometry } from '../types';
import { computeSquareGeometry, checkSquareIntersection } from './sat';

export interface ContactEdge {
  squareA: number;
  squareB: number;
  contactPoint: Point;
  contactType: 'edge_edge' | 'edge_vertex' | 'vertex_vertex';
}

export interface RigidityDiagnostics {
  n: number;
  containerLength: number;
  packingFraction: number; // n / L^2
  totalContacts: number;
  coordinationNumber: number; // 2 * totalContacts / n
  contactEdges: ContactEdge[];
  rattlerSquareIds: number[]; // squares with <= 1 contact
  isMechanicallyJammed: boolean;
  wallContacts: {
    left: number[];
    right: number[];
    bottom: number[];
    top: number[];
  };
}

export function computeRigidityDiagnostics(
  n: number,
  squares: UnitSquare[],
  containerLength: number,
  contactTolerance: number = 1e-4
): RigidityDiagnostics {
  const geometries: RotatedSquareGeometry[] = squares.map((sq) => computeSquareGeometry(sq));
  const contactEdges: ContactEdge[] = [];
  const contactsPerSquare = new Array(n).fill(0);

  const wallContacts = {
    left: [] as number[],
    right: [] as number[],
    bottom: [] as number[],
    top: [] as number[],
  };

  // 1. Check pairwise inter-square contacts
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const gA = geometries[i];
      const gB = geometries[j];

      // AABB pre-check
      if (
        gA.aabb.minX > gB.aabb.maxX + contactTolerance ||
        gA.aabb.maxX < gB.aabb.minX - contactTolerance ||
        gA.aabb.minY > gB.aabb.maxY + contactTolerance ||
        gA.aabb.maxY < gB.aabb.minY - contactTolerance
      ) {
        continue;
      }

      const sat = checkSquareIntersection(gA, gB, contactTolerance);
      // Contact occurs when overlap is close to 0 (within contactTolerance)
      if (Math.abs(sat.minOverlap) <= contactTolerance || sat.contactType === 'boundary_touch') {
        const contactPoint: Point = {
          x: (gA.center.x + gB.center.x) * 0.5,
          y: (gA.center.y + gB.center.y) * 0.5,
        };

        contactEdges.push({
          squareA: i,
          squareB: j,
          contactPoint,
          contactType: 'edge_edge',
        });

        contactsPerSquare[i]++;
        contactsPerSquare[j]++;
      }
    }

    // 2. Check container wall contacts
    const aabb = geometries[i].aabb;
    if (Math.abs(aabb.minX) <= contactTolerance) {
      wallContacts.left.push(i);
      contactsPerSquare[i]++;
    }
    if (Math.abs(aabb.maxX - containerLength) <= contactTolerance) {
      wallContacts.right.push(i);
      contactsPerSquare[i]++;
    }
    if (Math.abs(aabb.minY) <= contactTolerance) {
      wallContacts.bottom.push(i);
      contactsPerSquare[i]++;
    }
    if (Math.abs(aabb.maxY - containerLength) <= contactTolerance) {
      wallContacts.top.push(i);
      contactsPerSquare[i]++;
    }
  }

  // 3. Identify Rattlers (squares with <= 1 contact)
  const rattlerSquareIds: number[] = [];
  for (let i = 0; i < n; i++) {
    if (contactsPerSquare[i] <= 1) {
      rattlerSquareIds.push(i);
    }
  }

  const packingFraction = n / (containerLength * containerLength);
  const totalContacts = contactEdges.length;
  const coordinationNumber = (2.0 * totalContacts) / Math.max(1, n);
  const isMechanicallyJammed = rattlerSquareIds.length === 0 && coordinationNumber >= 3.0;

  return {
    n,
    containerLength,
    packingFraction,
    totalContacts,
    coordinationNumber,
    contactEdges,
    rattlerSquareIds,
    isMechanicallyJammed,
    wallContacts,
  };
}
