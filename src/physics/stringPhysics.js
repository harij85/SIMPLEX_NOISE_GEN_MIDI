/**
 * String Physics Module
 *
 * Implements spring-based vibration physics for interactive strings
 * using Hooke's law. Handles string plucking, vibration simulation,
 * and visual feedback.
 */

import * as THREE from 'three';
import { PHYSICS_CONSTANTS } from '../config/constants.js';

// String physics state array
const stringPhysics = [];

/**
 * Initialize physics state for a string
 * @param {number} index - String index
 * @returns {Object} Physics state object
 */
export function initStringPhysics(index) {
  return {
    index: index,
    displacement: new THREE.Vector3(0, 0, 0), // Current displacement from rest
    velocity: new THREE.Vector3(0, 0, 0),      // Current velocity
    isVibrating: false,
    pitchBend: 0, // MIDI pitch bend value (-8192 to 8191, 0 = no bend)
    dampening: PHYSICS_CONSTANTS.STRING_DAMPENING,  // Energy loss per frame (0-1)
    stiffness: PHYSICS_CONSTANTS.STRING_STIFFNESS,   // Spring force (how quickly it returns to center)
    originalCurve: null // Store original curve for restoration
  };
}

/**
 * Get or initialize physics state for a string
 * @param {number} stringIndex - String index
 * @returns {Object} Physics state object
 */
export function getStringPhysics(stringIndex) {
  if (!stringPhysics[stringIndex]) {
    stringPhysics[stringIndex] = initStringPhysics(stringIndex);
  }
  return stringPhysics[stringIndex];
}

/**
 * Pluck a string to start vibration
 * @param {number|Object} stringIndexOrPhysics - Index of string or physics object
 * @param {number} velocity - MIDI velocity (0-127) or normalized (0-1) controls pluck strength
 * @param {THREE.Vector3} start - String start position (optional)
 * @param {THREE.Vector3} end - String end position (optional)
 * @param {number} totalStrings - Total number of strings (optional)
 */
export function pluckString(stringIndexOrPhysics, velocity, start, end, totalStrings) {
  let physics;

  // Check if first argument is a physics object or an index
  if (typeof stringIndexOrPhysics === 'object' && stringIndexOrPhysics.displacement) {
    // Called with physics object directly (from main.js)
    physics = stringIndexOrPhysics;

    // Simplified pluck without string geometry
    const normalizedVelocity = velocity !== undefined ? velocity : 0.5; // Default to 0.5 if not provided
    const pluckStrength = normalizedVelocity * 0.15; // velocity is already 0-1
    physics.displacement.set(0, pluckStrength, 0);
    physics.velocity.set(0, -pluckStrength * 0.3, 0);
    physics.isVibrating = true;
    return;
  }

  // Original implementation with index
  const stringIndex = stringIndexOrPhysics;
  physics = getStringPhysics(stringIndex);

  // Get string orientation to determine pluck direction
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Calculate perpendicular direction for pluck
  // Use cross product to get a direction perpendicular to both the string and radial direction
  const stringDirection = new THREE.Vector3().subVectors(end, start).normalize();
  const radialDirection = midpoint.clone().normalize();
  const pluckDirection = new THREE.Vector3().crossVectors(stringDirection, radialDirection).normalize();

  // Vary pluck direction slightly based on string index for visual variety
  const rotationAngle = (stringIndex / totalStrings) * Math.PI * 2;
  pluckDirection.applyAxisAngle(stringDirection, rotationAngle);

  // Set initial displacement based on velocity (normalized 0-1)
  const pluckStrength = (velocity / 127) * 0.15; // Max displacement of 0.15 units
  physics.displacement.copy(pluckDirection.multiplyScalar(pluckStrength));

  // Set initial velocity for the pluck (opposite to displacement for spring motion)
  const initialVelocity = 0.3; // Adjust for more/less initial vibration speed
  physics.velocity.copy(physics.displacement).multiplyScalar(-initialVelocity);

  // Start vibration
  physics.isVibrating = true;

  // Store original curve if not already stored
  if (!physics.originalCurve) {
    const originalMidpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const midpointDir = originalMidpoint.clone().normalize();
    const originalControlPoint = originalMidpoint.clone().add(midpointDir.multiplyScalar(0.15));
    physics.originalCurve = new THREE.QuadraticBezierCurve3(start, originalControlPoint, end);
  }

  console.log(`String ${stringIndex} plucked with velocity ${velocity}`);
}

/**
 * Update spring physics for a single string
 * Implements Hooke's law: F = -k * displacement
 * @param {Object} physics - String physics state
 */
export function updateStringPhysicsStep(physics) {
  if (!physics || !physics.isVibrating) return false;

  // Spring force: F = -k * displacement (Hooke's law)
  const springForce = physics.displacement.clone().multiplyScalar(-physics.stiffness);

  // Update velocity with spring force
  physics.velocity.add(springForce);

  // Apply dampening (energy loss)
  physics.velocity.multiplyScalar(physics.dampening);

  // Update displacement based on velocity
  physics.displacement.add(physics.velocity);

  // Check if vibration has nearly stopped
  const energy = physics.displacement.length() + physics.velocity.length();
  if (energy < 0.001) {
    // Stop vibrating and reset to original position
    physics.isVibrating = false;
    physics.displacement.set(0, 0, 0);
    physics.velocity.set(0, 0, 0);
    return false; // Signal that vibration has stopped
  }

  return true; // Signal that vibration continues
}

/**
 * Update all string physics
 * @param {Function} updateCallback - Called for each vibrating string with (index, physics, displacement)
 */
export function updateAllStringPhysics(updateCallback) {
  for (let i = 0; i < stringPhysics.length; i++) {
    const physics = stringPhysics[i];
    if (!physics) continue;

    const stillVibrating = updateStringPhysicsStep(physics);

    if (updateCallback) {
      updateCallback(i, physics, stillVibrating);
    }
  }
}

/**
 * Get displacement magnitude for a string
 * @param {number} stringIndex - String index
 * @returns {number} Displacement magnitude
 */
export function getStringDisplacement(stringIndex) {
  const physics = stringPhysics[stringIndex];
  return physics ? physics.displacement.length() : 0;
}

/**
 * Check if a string is vibrating
 * @param {number} stringIndex - String index
 * @returns {boolean}
 */
export function isStringVibrating(stringIndex) {
  const physics = stringPhysics[stringIndex];
  return physics ? physics.isVibrating : false;
}

/**
 * Stop vibration for a specific string
 * @param {number} stringIndex - String index
 */
export function stopStringVibration(stringIndex) {
  const physics = stringPhysics[stringIndex];
  if (physics) {
    physics.isVibrating = false;
    physics.displacement.set(0, 0, 0);
    physics.velocity.set(0, 0, 0);
  }
}

/**
 * Apply external displacement to a string (e.g., from pitch bend)
 * @param {number|Object} stringIndexOrPhysics - String index or physics object
 * @param {THREE.Vector3} displacement - Displacement vector to add (optional if physics passed)
 * @param {number} maxDisplacement - Maximum allowed displacement magnitude
 * @returns {THREE.Vector3} Current displacement vector
 */
export function applyStringDisplacement(stringIndexOrPhysics, displacement, maxDisplacement = 0.2) {
  let physics;

  // Check if called with physics object directly
  if (typeof stringIndexOrPhysics === 'object' && stringIndexOrPhysics.displacement) {
    physics = stringIndexOrPhysics;
    // Return current displacement for main.js usage
    return physics.displacement.clone();
  }

  // Original implementation with index
  const stringIndex = stringIndexOrPhysics;
  physics = stringPhysics[stringIndex];
  if (!physics || !physics.isVibrating) return new THREE.Vector3();

  physics.displacement.add(displacement);

  // Clamp total displacement to prevent excessive vibration
  const currentMagnitude = physics.displacement.length();
  if (currentMagnitude > maxDisplacement) {
    physics.displacement.normalize().multiplyScalar(maxDisplacement);
  }

  return physics.displacement.clone();
}

/**
 * Create string physics object (alias for initStringPhysics)
 * @returns {Object} Physics object
 */
export function createStringPhysics() {
  const index = stringPhysics.length;
  return initStringPhysics(index);
}

export { stringPhysics };
