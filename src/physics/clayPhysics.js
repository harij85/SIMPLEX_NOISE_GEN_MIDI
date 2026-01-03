/**
 * Clay Physics Module
 *
 * Implements clay-like deformation physics for interactive sphere molding.
 * Uses viscosity and elasticity to create realistic material behavior.
 */

import * as THREE from 'three';
import { PHYSICS_CONSTANTS } from '../config/constants.js';

// Clay material properties
let clayViscosity = PHYSICS_CONSTANTS.CLAY_VISCOSITY;
let clayElasticity = PHYSICS_CONSTANTS.CLAY_ELASTICITY;
let clayPushStrength = PHYSICS_CONSTANTS.CLAY_PUSH_STRENGTH;
let clayBrushSize = PHYSICS_CONSTANTS.CLAY_BRUSH_SIZE;

// Deformation state
const deformations = []; // Array of {position: Vector3, strength: float, velocity: Vector3}
const maxDeformations = 64;

// Mouse interaction tracking
let isMoldingSphere = false;
let lastMoldPoint = null;

/**
 * Add a deformation to the clay at a specific point
 * @param {THREE.Vector3} point - Deformation point
 * @param {number} strength - Deformation strength
 */
export function addClayDeformation(point, strength) {
  // Find if there's an existing deformation nearby
  let existingDeformation = null;
  let minDist = Infinity;

  for (let i = 0; i < deformations.length; i++) {
    const dist = point.distanceTo(deformations[i].position);
    if (dist < minDist) {
      minDist = dist;
      existingDeformation = deformations[i];
    }
  }

  // If nearby deformation exists, add to it
  if (existingDeformation && minDist < clayBrushSize * 0.5) {
    existingDeformation.strength += strength;
    existingDeformation.strength = Math.max(-1.0, Math.min(1.0, existingDeformation.strength));
  } else {
    // Create new deformation
    if (deformations.length < maxDeformations) {
      deformations.push({
        position: point.clone(),
        strength: strength,
        velocity: new THREE.Vector3(0, 0, 0)
      });
    }
  }
}

/**
 * Update clay physics simulation
 */
export function updateClayPhysics() {
  for (let i = deformations.length - 1; i >= 0; i--) {
    const deform = deformations[i];

    // Apply viscosity (gradual smoothing)
    deform.strength *= clayViscosity;

    // Apply elasticity (return to original shape)
    const returnForce = -deform.strength * clayElasticity;
    deform.velocity.z += returnForce;

    // Apply velocity
    deform.strength += deform.velocity.z;

    // Dampen velocity
    deform.velocity.multiplyScalar(0.9);

    // Remove deformations that are too weak
    if (Math.abs(deform.strength) < 0.01) {
      deformations.splice(i, 1);
    }
  }
}

/**
 * Get deformations array for shader
 * @returns {Array<THREE.Vector3>} Deformation positions (returns only actual deformations, padding should be done by caller)
 */
export function getDeformationsForShader() {
  return deformations.map(def => def.position.clone());
}

/**
 * Get active deformations
 * @returns {Array} Deformations array
 */
export function getDeformations() {
  return deformations;
}

/**
 * Clear all deformations
 */
export function clearDeformations() {
  deformations.length = 0;
}

/**
 * Set clay viscosity
 * @param {number} value - Viscosity (0-1, higher = stickier)
 */
export function setClayViscosity(value) {
  clayViscosity = Math.max(0, Math.min(1, value));
}

/**
 * Get clay viscosity
 * @returns {number}
 */
export function getClayViscosity() {
  return clayViscosity;
}

/**
 * Set clay elasticity
 * @param {number} value - Elasticity (0-1, higher = bouncier)
 */
export function setClayElasticity(value) {
  clayElasticity = Math.max(0, Math.min(1, value));
}

/**
 * Get clay elasticity
 * @returns {number}
 */
export function getClayElasticity() {
  return clayElasticity;
}

/**
 * Set clay push strength
 * @param {number} value - Push strength
 */
export function setClayPushStrength(value) {
  clayPushStrength = value;
}

/**
 * Get clay push strength
 * @returns {number}
 */
export function getClayPushStrength() {
  return clayPushStrength;
}

/**
 * Set clay brush size
 * @param {number} value - Brush size
 */
export function setClayBrushSize(value) {
  clayBrushSize = value;
}

/**
 * Get clay brush size
 * @returns {number}
 */
export function getClayBrushSize() {
  return clayBrushSize;
}

/**
 * Set molding state
 * @param {boolean} molding - Is molding active
 */
export function setMoldingState(molding) {
  isMoldingSphere = molding;
  if (!molding) {
    lastMoldPoint = null;
  }
}

/**
 * Get molding state
 * @returns {boolean}
 */
export function isMolding() {
  return isMoldingSphere;
}

/**
 * Set last mold point
 * @param {THREE.Vector3|null} point - Last mold point
 */
export function setLastMoldPoint(point) {
  lastMoldPoint = point;
}

/**
 * Get last mold point
 * @returns {THREE.Vector3|null}
 */
export function getLastMoldPoint() {
  return lastMoldPoint;
}

/**
 * Handle molding at a point
 * @param {THREE.Vector3|number} point - Surface point (Vector3) or x coordinate
 * @param {boolean|number} pushing - True for push, false for pull, or y coordinate if first param is number
 * @param {number} z - Z coordinate (only used if first param is number)
 */
export function moldAtPoint(point, pushing = true, z = undefined) {
  // Handle overload: moldAtPoint(x, y, z) or moldAtPoint(Vector3, pushing)
  let vectorPoint;
  let isPushing;

  if (typeof point === 'number' && typeof pushing === 'number') {
    // Called with moldAtPoint(x, y, z)
    vectorPoint = new THREE.Vector3(point, pushing, z);
    isPushing = true;
  } else {
    // Called with moldAtPoint(Vector3, pushing)
    vectorPoint = point;
    isPushing = pushing;
  }

  const strength = isPushing ? clayPushStrength : -clayPushStrength;
  addClayDeformation(vectorPoint, strength);
  setLastMoldPoint(vectorPoint);
}
