/**
 * Geometry Utility Module
 *
 * Helper functions for Three.js geometry calculations and sensor positioning.
 */

import * as THREE from 'three';
import { SENSOR_CONFIG } from '../config/constants.js';

/**
 * Generate sensor positions in a line arrangement
 * @param {number} count - Number of sensor positions
 * @param {number} radius - Sphere radius
 * @returns {Array<THREE.Vector3>} Array of position vectors
 */
export function generateLinePositions(count, radius = 1.0) {
  const points = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const x = radius * Math.cos(angle);
    const y = 0;
    const z = radius * Math.sin(angle);

    points.push(new THREE.Vector3(x, y, z));
  }

  return points;
}

/**
 * Generate sensor positions using Fibonacci sphere algorithm
 * Ensures even distribution across sphere surface
 * @param {number} count - Number of sensor positions
 * @param {number} radius - Sphere radius
 * @returns {Array<THREE.Vector3>} Array of position vectors
 */
export function generateFibonacciSpherePositions(count, radius = 1.0) {
  const points = [];
  const goldenRatio = SENSOR_CONFIG.GOLDEN_RATIO;

  for (let i = 0; i < count; i++) {
    // Fibonacci sphere distribution
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / count);

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    points.push(new THREE.Vector3(x, y, z));
  }

  return points;
}

/**
 * Interpolate between two position arrays
 * @param {Array<THREE.Vector3>} positionsA - First position set
 * @param {Array<THREE.Vector3>} positionsB - Second position set
 * @param {number} t - Interpolation factor (0-1)
 * @returns {Array<THREE.Vector3>} Interpolated positions
 */
export function interpolatePositions(positionsA, positionsB, t) {
  const result = [];
  const count = Math.min(positionsA.length, positionsB.length);

  for (let i = 0; i < count; i++) {
    const interpolated = new THREE.Vector3().lerpVectors(
      positionsA[i],
      positionsB[i],
      t
    );
    result.push(interpolated);
  }

  return result;
}

/**
 * Smoothly lerp a position array towards target positions
 * @param {Array<THREE.Vector3>} current - Current positions
 * @param {Array<THREE.Vector3>} target - Target positions
 * @param {number} smoothing - Smoothing factor (0-1, lower = smoother)
 * @returns {Array<THREE.Vector3>} Updated positions
 */
export function smoothLerpPositions(current, target, smoothing = 0.1) {
  const count = Math.min(current.length, target.length);

  for (let i = 0; i < count; i++) {
    current[i].lerp(target[i], smoothing);
  }

  return current;
}

/**
 * Calculate position on a quadratic bezier curve
 * @param {THREE.Vector3} p0 - Start point
 * @param {THREE.Vector3} p1 - Control point
 * @param {THREE.Vector3} p2 - End point
 * @param {number} t - Position parameter (0-1)
 * @returns {THREE.Vector3} Point on curve
 */
export function quadraticBezierPoint(p0, p1, p2, t) {
  const x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x;
  const y = (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y;
  const z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z;

  return new THREE.Vector3(x, y, z);
}

/**
 * Create a curved control point for a bezier curve between two sphere surface points
 * The control point is positioned to create a gentle outward curve
 * @param {THREE.Vector3} start - Start point on sphere surface
 * @param {THREE.Vector3} end - End point on sphere surface
 * @param {number} curvature - Curvature amount (default 0.15)
 * @returns {THREE.Vector3} Control point
 */
export function createCurvedControlPoint(start, end, curvature = 0.15) {
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Calculate direction - if midpoint is at origin (opposite points), use perpendicular
  let direction;
  if (midpoint.lengthSq() < 0.0001) {
    // Points are opposite on sphere, use perpendicular direction
    direction = new THREE.Vector3().crossVectors(start, new THREE.Vector3(0, 1, 0));
    if (direction.lengthSq() < 0.0001) {
      // start is aligned with Y axis, use X axis instead
      direction.crossVectors(start, new THREE.Vector3(1, 0, 0));
    }
    direction.normalize();
  } else {
    direction = midpoint.clone().normalize();
  }

  return midpoint.clone().add(direction.multiplyScalar(curvature));
}

/**
 * Rotate a vector around an axis
 * @param {THREE.Vector3} vector - Vector to rotate
 * @param {THREE.Vector3} axis - Rotation axis
 * @param {number} angle - Rotation angle in radians
 * @returns {THREE.Vector3} Rotated vector
 */
export function rotateVectorAroundAxis(vector, axis, angle) {
  const result = vector.clone();
  result.applyAxisAngle(axis.normalize(), angle);
  return result;
}

/**
 * Alias for generateFibonacciSpherePositions
 * Create Fibonacci sphere distribution
 * @param {number} count - Number of points
 * @param {number} radius - Sphere radius
 * @returns {Array<THREE.Vector3>} Array of position vectors
 */
export function createFibonacciSphere(count, radius = 1.0) {
  return generateFibonacciSpherePositions(count, radius);
}
