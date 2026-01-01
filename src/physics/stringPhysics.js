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
 * @param {number} stringIndex - Index of the string to pluck
 * @param {number} velocity - MIDI velocity (0-127) controls pluck strength
 * @param {THREE.Vector3} start - String start position
 * @param {THREE.Vector3} end - String end position
 * @param {number} totalStrings - Total number of strings
 */
export function pluckString(stringIndex, velocity, start, end, totalStrings) {
  const physics = getStringPhysics(stringIndex);

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

  console.log(`🎸 String ${stringIndex} plucked with velocity ${velocity}`);
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
 * @param {number} stringIndex - String index
 * @param {THREE.Vector3} displacement - Displacement vector to add
 * @param {number} maxDisplacement - Maximum allowed displacement magnitude
 */
export function applyStringDisplacement(stringIndex, displacement, maxDisplacement = 0.2) {
  const physics = stringPhysics[stringIndex];
  if (!physics || !physics.isVibrating) return;

  physics.displacement.add(displacement);

  // Clamp total displacement to prevent excessive vibration
  const currentMagnitude = physics.displacement.length();
  if (currentMagnitude > maxDisplacement) {
    physics.displacement.normalize().multiplyScalar(maxDisplacement);
  }
}

export { stringPhysics };
