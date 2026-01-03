/**
 * Geometry Utilities Tests
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  generateLinePositions,
  generateFibonacciSpherePositions,
  interpolatePositions,
  smoothLerpPositions,
  quadraticBezierPoint,
  createCurvedControlPoint,
  rotateVectorAroundAxis,
  createFibonacciSphere,
} from '../../src/utils/geometry.js';

describe('Geometry Utilities', () => {
  describe('Line Positions', () => {
    it('should generate positions in a circular line', () => {
      const positions = generateLinePositions(8, 1.0);

      expect(positions).toHaveLength(8);
      positions.forEach(pos => {
        expect(pos).toBeInstanceOf(THREE.Vector3);
        // All points should be on circle (y=0, radius=1)
        expect(pos.y).toBeCloseTo(0, 5);
        expect(Math.sqrt(pos.x ** 2 + pos.z ** 2)).toBeCloseTo(1.0, 5);
      });
    });

    it('should distribute points evenly around circle', () => {
      const positions = generateLinePositions(4, 1.0);

      // Check angles are evenly distributed (90 degrees apart)
      const angle1 = Math.atan2(positions[1].z, positions[1].x);
      const angle0 = Math.atan2(positions[0].z, positions[0].x);
      const angleDiff = Math.abs(angle1 - angle0);

      expect(angleDiff).toBeCloseTo(Math.PI / 2, 1);
    });

    it('should scale with radius parameter', () => {
      const positions = generateLinePositions(8, 2.0);

      positions.forEach(pos => {
        expect(Math.sqrt(pos.x ** 2 + pos.z ** 2)).toBeCloseTo(2.0, 5);
      });
    });
  });

  describe('Fibonacci Sphere Positions', () => {
    it('should generate positions on sphere surface', () => {
      const positions = generateFibonacciSpherePositions(16, 1.0);

      expect(positions).toHaveLength(16);
      positions.forEach(pos => {
        expect(pos).toBeInstanceOf(THREE.Vector3);
        // All points should be on unit sphere
        expect(pos.length()).toBeCloseTo(1.0, 5);
      });
    });

    it('should distribute points evenly across sphere', () => {
      const positions = generateFibonacciSpherePositions(100, 1.0);

      // Check that points are distributed in all directions
      const hasPositiveX = positions.some(p => p.x > 0.5);
      const hasNegativeX = positions.some(p => p.x < -0.5);
      const hasPositiveY = positions.some(p => p.y > 0.5);
      const hasNegativeY = positions.some(p => p.y < -0.5);
      const hasPositiveZ = positions.some(p => p.z > 0.5);
      const hasNegativeZ = positions.some(p => p.z < -0.5);

      expect(hasPositiveX).toBe(true);
      expect(hasNegativeX).toBe(true);
      expect(hasPositiveY).toBe(true);
      expect(hasNegativeY).toBe(true);
      expect(hasPositiveZ).toBe(true);
      expect(hasNegativeZ).toBe(true);
    });

    it('should alias to createFibonacciSphere', () => {
      const positions1 = generateFibonacciSpherePositions(10, 1.0);
      const positions2 = createFibonacciSphere(10, 1.0);

      expect(positions1.length).toBe(positions2.length);
    });
  });

  describe('Position Interpolation', () => {
    it('should interpolate between two position arrays', () => {
      const posA = [new THREE.Vector3(0, 0, 0)];
      const posB = [new THREE.Vector3(10, 10, 10)];

      const result = interpolatePositions(posA, posB, 0.5);

      expect(result[0].x).toBeCloseTo(5, 5);
      expect(result[0].y).toBeCloseTo(5, 5);
      expect(result[0].z).toBeCloseTo(5, 5);
    });

    it('should return posA when t=0', () => {
      const posA = [new THREE.Vector3(1, 2, 3)];
      const posB = [new THREE.Vector3(10, 20, 30)];

      const result = interpolatePositions(posA, posB, 0);

      expect(result[0].x).toBeCloseTo(1, 5);
      expect(result[0].y).toBeCloseTo(2, 5);
      expect(result[0].z).toBeCloseTo(3, 5);
    });

    it('should return posB when t=1', () => {
      const posA = [new THREE.Vector3(1, 2, 3)];
      const posB = [new THREE.Vector3(10, 20, 30)];

      const result = interpolatePositions(posA, posB, 1);

      expect(result[0].x).toBeCloseTo(10, 5);
      expect(result[0].y).toBeCloseTo(20, 5);
      expect(result[0].z).toBeCloseTo(30, 5);
    });
  });

  describe('Smooth Lerp Positions', () => {
    it('should smoothly interpolate current towards target', () => {
      const current = [new THREE.Vector3(0, 0, 0)];
      const target = [new THREE.Vector3(10, 0, 0)];

      smoothLerpPositions(current, target, 0.1);

      // Should move 10% towards target
      expect(current[0].x).toBeCloseTo(1, 5);
      expect(current[0].y).toBeCloseTo(0, 5);
      expect(current[0].z).toBeCloseTo(0, 5);
    });
  });

  describe('Quadratic Bezier Point', () => {
    it('should calculate point on bezier curve', () => {
      const p0 = new THREE.Vector3(0, 0, 0);
      const p1 = new THREE.Vector3(5, 10, 0); // Control point
      const p2 = new THREE.Vector3(10, 0, 0);

      const mid = quadraticBezierPoint(p0, p1, p2, 0.5);

      // At t=0.5, should be influenced by control point
      expect(mid.y).toBeGreaterThan(0);
      expect(mid.x).toBeCloseTo(5, 1);
    });

    it('should return start point at t=0', () => {
      const p0 = new THREE.Vector3(1, 2, 3);
      const p1 = new THREE.Vector3(5, 10, 5);
      const p2 = new THREE.Vector3(10, 20, 10);

      const start = quadraticBezierPoint(p0, p1, p2, 0);

      expect(start.x).toBeCloseTo(p0.x, 5);
      expect(start.y).toBeCloseTo(p0.y, 5);
      expect(start.z).toBeCloseTo(p0.z, 5);
    });

    it('should return end point at t=1', () => {
      const p0 = new THREE.Vector3(1, 2, 3);
      const p1 = new THREE.Vector3(5, 10, 5);
      const p2 = new THREE.Vector3(10, 20, 10);

      const end = quadraticBezierPoint(p0, p1, p2, 1);

      expect(end.x).toBeCloseTo(p2.x, 5);
      expect(end.y).toBeCloseTo(p2.y, 5);
      expect(end.z).toBeCloseTo(p2.z, 5);
    });
  });

  describe('Curved Control Point', () => {
    it('should create control point between two points', () => {
      const start = new THREE.Vector3(1, 0, 0);
      const end = new THREE.Vector3(-1, 0, 0);

      const control = createCurvedControlPoint(start, end, 0.15);

      expect(control).toBeInstanceOf(THREE.Vector3);
      // Control point should be outward from sphere center
      expect(control.length()).toBeGreaterThan(0);
    });

    it('should scale with curvature parameter', () => {
      const start = new THREE.Vector3(1, 0, 0);
      const end = new THREE.Vector3(0, 1, 0);

      const control1 = createCurvedControlPoint(start, end, 0.1);
      const control2 = createCurvedControlPoint(start, end, 0.2);

      expect(control2.length()).toBeGreaterThan(control1.length());
    });
  });

  describe('Vector Rotation', () => {
    it('should rotate vector around axis', () => {
      const vector = new THREE.Vector3(1, 0, 0);
      const axis = new THREE.Vector3(0, 1, 0); // Y-axis
      const angle = Math.PI / 2; // 90 degrees

      const rotated = rotateVectorAroundAxis(vector, axis, angle);

      // X-axis vector rotated 90° around Y should point along -Z
      expect(rotated.x).toBeCloseTo(0, 5);
      expect(rotated.y).toBeCloseTo(0, 5);
      expect(rotated.z).toBeCloseTo(-1, 5);
    });

    it('should not modify original vector', () => {
      const original = new THREE.Vector3(1, 2, 3);
      const axis = new THREE.Vector3(0, 1, 0);

      rotateVectorAroundAxis(original, axis, Math.PI / 4);

      expect(original.x).toBe(1);
      expect(original.y).toBe(2);
      expect(original.z).toBe(3);
    });
  });
});
