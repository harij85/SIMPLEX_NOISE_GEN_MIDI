/**
 * Strings Module
 *
 * Manages tube/string connections between beacon sensors.
 */

import * as THREE from 'three';
import { SCENE_CONFIG } from '../config/constants.js';
import { createCurvedControlPoint } from '../utils/geometry.js';

// String segments
const tubeSegments = [];

/**
 * Create a tube/string between two points
 * @param {THREE.Vector3} start - Start position
 * @param {THREE.Vector3} end - End position
 * @param {number} index - String index
 * @param {THREE.Group} parentGroup - Parent group to add to
 * @returns {Object} Tube segment {mesh, material, index}
 */
export function createTubeString(start, end, index, parentGroup) {
  // Calculate control point to ensure tube doesn't intersect sphere
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const midpointDir = midpoint.clone().normalize();

  // Ensure control point is above sphere surface
  const midpointDist = midpoint.length();
  const sphereRadius = SCENE_CONFIG.SPHERE_RADIUS;
  const minHeight = sphereRadius + SCENE_CONFIG.BEACON_HEIGHT * 0.5;

  const liftAmount = Math.max(0, minHeight - midpointDist);
  const controlPoint = midpoint.clone().add(midpointDir.multiplyScalar(liftAmount + 0.15));

  // Create quadratic bezier curve
  const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
  const tubeGeometry = new THREE.TubeGeometry(
    curve,
    SCENE_CONFIG.TUBE_SEGMENTS,
    SCENE_CONFIG.TUBE_RADIUS,
    SCENE_CONFIG.TUBE_RADIAL_SEGMENTS,
    false
  );

  const tubeMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.6
  });

  const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
  const segment = { mesh: tube, material: tubeMaterial, index };

  tubeSegments.push(segment);

  // Add to parent group
  if (parentGroup) {
    parentGroup.add(tube);
  }

  return segment;
}

/**
 * Create all tube strings connecting beacon positions
 * @param {Array<THREE.Vector3>} beaconPositions - Beacon positions
 * @param {THREE.Group} parentGroup - Parent group to add to
 */
export function createTubeStrings(beaconPositions, parentGroup) {
  const numBeacons = beaconPositions.length;

  for (let i = 0; i < numBeacons; i++) {
    const nextIndex = (i + 1) % numBeacons;
    const start = beaconPositions[i];
    const end = beaconPositions[nextIndex];

    createTubeString(start, end, i, parentGroup);
  }
}

/**
 * Update tube geometry for a specific string
 * @param {number} index - String index
 * @param {THREE.Vector3} start - Start position
 * @param {THREE.Vector3} end - End position
 * @param {THREE.Vector3} displacement - Additional displacement for vibration
 */
export function updateTubeGeometry(index, start, end, displacement = null) {
  const segment = tubeSegments[index];
  if (!segment) return;

  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
  const midpointDir = midpoint.clone().normalize();

  const midpointDist = midpoint.length();
  const sphereRadius = SCENE_CONFIG.SPHERE_RADIUS;
  const minHeight = sphereRadius + SCENE_CONFIG.BEACON_HEIGHT * 0.5;

  const liftAmount = Math.max(0, minHeight - midpointDist);
  let controlPoint = midpoint.clone().add(midpointDir.multiplyScalar(liftAmount + 0.15));

  // Apply displacement if provided (for vibration effects)
  if (displacement) {
    controlPoint.add(displacement);
  }

  const newCurve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);

  // Dispose old geometry and create new one
  segment.mesh.geometry.dispose();
  segment.mesh.geometry = new THREE.TubeGeometry(
    newCurve,
    SCENE_CONFIG.TUBE_SEGMENTS,
    SCENE_CONFIG.TUBE_RADIUS,
    SCENE_CONFIG.TUBE_RADIAL_SEGMENTS,
    false
  );
}

/**
 * Set tube opacity
 * @param {number} index - String index
 * @param {number} opacity - Opacity value (0-1)
 */
export function setTubeOpacity(index, opacity) {
  if (tubeSegments[index]) {
    tubeSegments[index].material.opacity = opacity;
  }
}

/**
 * Set tube color
 * @param {number} index - String index
 * @param {number} r - Red (0-1)
 * @param {number} g - Green (0-1)
 * @param {number} b - Blue (0-1)
 */
export function setTubeColor(index, r, g, b) {
  if (tubeSegments[index]) {
    tubeSegments[index].material.color.setRGB(r, g, b);
  }
}

/**
 * Get tube segments
 * @returns {Array} Tube segments
 */
export function getTubeSegments() {
  return tubeSegments;
}

/**
 * Get tube segment by index
 * @param {number} index - String index
 * @returns {Object|undefined} Tube segment
 */
export function getTubeSegment(index) {
  return tubeSegments[index];
}

/**
 * Clear all tube strings
 */
export function clearTubeStrings() {
  tubeSegments.forEach(segment => {
    segment.mesh.geometry.dispose();
    segment.mesh.material.dispose();
    if (segment.mesh.parent) {
      segment.mesh.parent.remove(segment.mesh);
    }
  });

  tubeSegments.length = 0;
}
