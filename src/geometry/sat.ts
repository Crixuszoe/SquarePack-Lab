/**
 * Separating Axis Theorem (SAT) & Rotated Geometry Module
 * 
 * Provides high-precision computational geometry primitives for rotated unit squares.
 * Evaluates bounding boxes, separating axes, vertex coordinates, and boundary contact.
 */

import { Point, UnitSquare, RotatedSquareGeometry, CollisionPair } from '../types';

export const LOCAL_UNIT_VERTICES: [Point, Point, Point, Point] = [
  { x: -0.5, y: -0.5 },
  { x: 0.5, y: -0.5 },
  { x: 0.5, y: 0.5 },
  { x: -0.5, y: 0.5 },
];

/**
 * Computes exact rotated vertices, axes, and AABB for a unit square
 * vertex = center + R(angle) * local_vertex
 */
export function computeSquareGeometry(sq: UnitSquare): RotatedSquareGeometry {
  const cos = Math.cos(sq.angle);
  const sin = Math.sin(sq.angle);

  const vertices: [Point, Point, Point, Point] = [
    {
      x: sq.x + (LOCAL_UNIT_VERTICES[0].x * cos - LOCAL_UNIT_VERTICES[0].y * sin),
      y: sq.y + (LOCAL_UNIT_VERTICES[0].x * sin + LOCAL_UNIT_VERTICES[0].y * cos),
    },
    {
      x: sq.x + (LOCAL_UNIT_VERTICES[1].x * cos - LOCAL_UNIT_VERTICES[1].y * sin),
      y: sq.y + (LOCAL_UNIT_VERTICES[1].x * sin + LOCAL_UNIT_VERTICES[1].y * cos),
    },
    {
      x: sq.x + (LOCAL_UNIT_VERTICES[2].x * cos - LOCAL_UNIT_VERTICES[2].y * sin),
      y: sq.y + (LOCAL_UNIT_VERTICES[2].x * sin + LOCAL_UNIT_VERTICES[2].y * cos),
    },
    {
      x: sq.x + (LOCAL_UNIT_VERTICES[3].x * cos - LOCAL_UNIT_VERTICES[3].y * sin),
      y: sq.y + (LOCAL_UNIT_VERTICES[3].x * sin + LOCAL_UNIT_VERTICES[3].y * cos),
    },
  ];

  // Two orthogonal unit normal axes
  const normals: [Point, Point] = [
    { x: cos, y: sin },
    { x: -sin, y: cos },
  ];

  let minX = vertices[0].x;
  let maxX = vertices[0].x;
  let minY = vertices[0].y;
  let maxY = vertices[0].y;

  for (let i = 1; i < 4; i++) {
    if (vertices[i].x < minX) minX = vertices[i].x;
    if (vertices[i].x > maxX) maxX = vertices[i].x;
    if (vertices[i].y < minY) minY = vertices[i].y;
    if (vertices[i].y > maxY) maxY = vertices[i].y;
  }

  return {
    id: sq.id,
    center: { x: sq.x, y: sq.y },
    angle: sq.angle,
    vertices,
    normals,
    aabb: { minX, maxX, minY, maxY },
  };
}

/**
 * Check AABB broad-phase overlap between two geometries
 */
export function aabbOverlap(
  a: RotatedSquareGeometry['aabb'],
  b: RotatedSquareGeometry['aabb'],
  tolerance: number = 0
): boolean {
  return (
    a.minX <= b.maxX + tolerance &&
    a.maxX >= b.minX - tolerance &&
    a.minY <= b.maxY + tolerance &&
    a.maxY >= b.minY - tolerance
  );
}

/**
 * Separating Axis Theorem (SAT) check between two rotated unit squares
 * 
 * Boundary contact is strictly allowed: if overlap on all axes <= tolerance,
 * the squares do not overlap in their interiors.
 */
export function checkSquareIntersection(
  geomA: RotatedSquareGeometry,
  geomB: RotatedSquareGeometry,
  tolerance: number = 1e-8
): { isColliding: boolean; minOverlap: number; contactType: 'interior_overlap' | 'boundary_touch' | 'separated' } {
  // Candidate axes: 2 from geomA + 2 from geomB
  const axes: Point[] = [
    geomA.normals[0],
    geomA.normals[1],
    geomB.normals[0],
    geomB.normals[1],
  ];

  let minPenetration = Infinity;

  for (let a = 0; a < 4; a++) {
    const axis = axes[a];

    // Project geomA
    let minA = geomA.vertices[0].x * axis.x + geomA.vertices[0].y * axis.y;
    let maxA = minA;
    for (let i = 1; i < 4; i++) {
      const proj = geomA.vertices[i].x * axis.x + geomA.vertices[i].y * axis.y;
      if (proj < minA) minA = proj;
      if (proj > maxA) maxA = proj;
    }

    // Project geomB
    let minB = geomB.vertices[0].x * axis.x + geomB.vertices[0].y * axis.y;
    let maxB = minB;
    for (let i = 1; i < 4; i++) {
      const proj = geomB.vertices[i].x * axis.x + geomB.vertices[i].y * axis.y;
      if (proj < minB) minB = proj;
      if (proj > maxB) maxB = proj;
    }

    // Overlap on this axis
    const overlap = Math.min(maxA, maxB) - Math.max(minA, minB);

    // If there is an axis where overlap <= tolerance, they do not have interior overlap
    if (overlap <= tolerance) {
      if (overlap >= -tolerance) {
        return { isColliding: false, minOverlap: overlap, contactType: 'boundary_touch' };
      }
      return { isColliding: false, minOverlap: overlap, contactType: 'separated' };
    }

    if (overlap < minPenetration) {
      minPenetration = overlap;
    }
  }

  // All 4 axes show overlap > tolerance -> Interior Overlap
  return {
    isColliding: true,
    minOverlap: minPenetration,
    contactType: 'interior_overlap',
  };
}

/**
 * Computes the overall axis-aligned bounding box enclosing all squares
 */
export function computeEnclosingBoundingBox(geometries: RotatedSquareGeometry[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  length: number;
  width: number;
  height: number;
} {
  if (geometries.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, length: 0, width: 0, height: 0 };
  }

  let minX = geometries[0].aabb.minX;
  let maxX = geometries[0].aabb.maxX;
  let minY = geometries[0].aabb.minY;
  let maxY = geometries[0].aabb.maxY;

  for (let i = 1; i < geometries.length; i++) {
    const aabb = geometries[i].aabb;
    if (aabb.minX < minX) minX = aabb.minX;
    if (aabb.maxX > maxX) maxX = aabb.maxX;
    if (aabb.minY < minY) minY = aabb.minY;
    if (aabb.maxY > maxY) maxY = aabb.maxY;
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const length = Math.max(width, height);

  return { minX, maxX, minY, maxY, length, width, height };
}
