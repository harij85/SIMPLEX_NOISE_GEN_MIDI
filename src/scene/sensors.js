/**
 * Sensors Module
 *
 * Manages beacon sensors and their positioning on the sphere surface.
 */

import * as THREE from 'three';
import { SCENE_CONFIG } from '../config/constants.js';
import { createSensorLight } from './lighting.js';

// Sensor data structures
const beaconElements = [];
const beaconTops = [];

/**
 * Create a single beacon sensor
 * @param {THREE.Vector3} position - Base position on sphere
 * @param {THREE.Group} parentGroup - Parent group to add to
 * @returns {Object} Beacon element {topSphere, position}
 */
export function createBeacon(position, parentGroup) {
  const direction = position.clone().normalize();
  const beaconPos = position.clone().add(direction.multiplyScalar(SCENE_CONFIG.BEACON_HEIGHT));

  // Create glowing beacon sphere
  const beaconGeometry = new THREE.SphereGeometry(SCENE_CONFIG.BEACON_RADIUS, 16, 16);
  const beaconMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    transparent: true,
    opacity: 0.9
  });
  const beaconSphere = new THREE.Mesh(beaconGeometry, beaconMaterial);
  beaconSphere.position.copy(beaconPos);

  // Store beacon element
  const element = {
    topSphere: beaconSphere,
    position: beaconPos.clone()
  };

  beaconElements.push(element);
  beaconTops.push(beaconPos);

  // Add to parent group
  if (parentGroup) {
    parentGroup.add(beaconSphere);
  }

  // Create point light at sensor position
  createSensorLight(position);

  return element;
}

/**
 * Create multiple beacon sensors
 * @param {Array<THREE.Vector3>} positions - Array of base positions
 * @param {THREE.Group} parentGroup - Parent group to add to
 */
export function createBeacons(positions, parentGroup) {
  positions.forEach(pos => createBeacon(pos, parentGroup));
}

/**
 * Update beacon position
 * @param {number} index - Beacon index
 * @param {THREE.Vector3} position - New base position
 */
export function updateBeaconPosition(index, position) {
  if (beaconElements[index]) {
    const direction = position.clone().normalize();
    const beaconPos = position.clone().add(direction.multiplyScalar(SCENE_CONFIG.BEACON_HEIGHT));

    beaconElements[index].topSphere.position.copy(beaconPos);
    beaconElements[index].position.copy(beaconPos);
    beaconTops[index].copy(beaconPos);
  }
}

/**
 * Set beacon opacity
 * @param {number} index - Beacon index
 * @param {number} opacity - Opacity value (0-1)
 */
export function setBeaconOpacity(index, opacity) {
  if (beaconElements[index]) {
    beaconElements[index].topSphere.material.opacity = opacity;
  }
}

/**
 * Set beacon color
 * @param {number} index - Beacon index
 * @param {number} color - Color hex value
 */
export function setBeaconColor(index, color) {
  if (beaconElements[index]) {
    beaconElements[index].topSphere.material.color.setHex(color);
  }
}

/**
 * Get beacon elements
 * @returns {Array} Beacon elements
 */
export function getBeaconElements() {
  return beaconElements;
}

/**
 * Get beacon top positions
 * @returns {Array<THREE.Vector3>} Beacon positions
 */
export function getBeaconTops() {
  return beaconTops;
}

/**
 * Get beacon element by index
 * @param {number} index - Beacon index
 * @returns {Object|undefined} Beacon element
 */
export function getBeaconElement(index) {
  return beaconElements[index];
}

/**
 * Clear all beacons
 */
export function clearBeacons() {
  beaconElements.forEach(element => {
    element.topSphere.geometry.dispose();
    element.topSphere.material.dispose();
    if (element.topSphere.parent) {
      element.topSphere.parent.remove(element.topSphere);
    }
  });

  beaconElements.length = 0;
  beaconTops.length = 0;
}

/**
 * Create sensor array and return beacon meshes
 * @param {Array<THREE.Vector3>} positions - Sensor positions
 * @returns {Array<THREE.Mesh>} Array of beacon meshes
 */
export function createSensors(positions) {
  const meshes = [];
  positions.forEach(pos => {
    const element = createBeacon(pos, null);
    meshes.push(element.topSphere);
  });
  return meshes;
}

/**
 * Update sensor positions based on distribution
 * @param {Array<THREE.Mesh>} beacons - Beacon meshes
 * @param {Array<THREE.Vector3>} basePositions - Base positions
 * @param {number} distribution - Distribution factor (0-1)
 * @param {number} animationSpeed - Animation speed
 * @param {number} time - Current time
 */
export function updateSensorPositions(beacons, basePositions, distribution, animationSpeed, time) {
  // Update beacon positions based on distribution
  // This is a placeholder - actual implementation would handle distribution
  beacons.forEach((beacon, i) => {
    if (basePositions[i]) {
      const direction = basePositions[i].clone().normalize();
      const beaconPos = basePositions[i].clone().add(
        direction.multiplyScalar(SCENE_CONFIG.BEACON_HEIGHT)
      );
      beacon.position.copy(beaconPos);
    }
  });
}

/**
 * Get sensor positions
 * @returns {Array<THREE.Vector3>} Sensor positions
 */
export function getSensorPositions() {
  return beaconTops;
}

/**
 * Highlight a beacon (flash effect)
 * @param {THREE.Mesh} beacon - Beacon mesh to highlight
 */
export function highlightBeacon(beacon) {
  if (beacon && beacon.material) {
    // Flash effect - temporarily increase opacity
    beacon.material.opacity = 1.0;
    setTimeout(() => {
      beacon.material.opacity = 0.9;
    }, 100);
  }
}

/**
 * Update beacon animations
 * @param {Array<THREE.Mesh>} beacons - Beacon meshes
 */
export function updateBeaconAnimations(beacons) {
  // Beacon animations (pulsing, etc.)
  // This is a placeholder for future animation logic
  beacons.forEach((beacon, i) => {
    if (beacon.material.opacity > 0.9) {
      beacon.material.opacity = Math.max(0.9, beacon.material.opacity - 0.05);
    }
  });
}
