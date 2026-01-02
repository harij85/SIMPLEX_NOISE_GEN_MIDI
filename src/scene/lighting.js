/**
 * Lighting Module
 *
 * Manages scene lighting including ambient light and per-sensor point lights.
 */

import * as THREE from 'three';
import { LIGHTING_CONFIG } from '../config/constants.js';
import { addToScene } from './sceneManager.js';

// Light references
let ambientLight = null;
const sensorPointLights = [];

/**
 * Initialize scene lighting
 */
export function initLighting() {
  // Gentle ambient glow for everything
  ambientLight = new THREE.AmbientLight(
    LIGHTING_CONFIG.AMBIENT_COLOR,
    LIGHTING_CONFIG.AMBIENT_INTENSITY
  );
  addToScene(ambientLight);

  console.log('Lighting initialized');
}

/**
 * Create point light for a sensor
 * @param {THREE.Vector3} position - Light position
 * @param {number} color - Light color (hex)
 * @returns {THREE.PointLight}
 */
export function createSensorLight(position, color = LIGHTING_CONFIG.POINT_LIGHT_COLOR) {
  const pointLight = new THREE.PointLight(
    color,
    LIGHTING_CONFIG.POINT_LIGHT_INTENSITY,
    LIGHTING_CONFIG.POINT_LIGHT_DISTANCE,
    LIGHTING_CONFIG.POINT_LIGHT_DECAY
  );
  pointLight.position.copy(position);

  sensorPointLights.push(pointLight);
  addToScene(pointLight);

  return pointLight;
}

/**
 * Update sensor light position
 * @param {number} index - Sensor index
 * @param {THREE.Vector3} position - New position
 */
export function updateSensorLightPosition(index, position) {
  if (sensorPointLights[index]) {
    sensorPointLights[index].position.copy(position);
  }
}

/**
 * Set sensor light intensity
 * @param {number} index - Sensor index
 * @param {number} intensity - Light intensity
 */
export function setSensorLightIntensity(index, intensity) {
  if (sensorPointLights[index]) {
    sensorPointLights[index].intensity = intensity;
  }
}

/**
 * Set sensor light color
 * @param {number} index - Sensor index
 * @param {number} color - Light color (hex)
 */
export function setSensorLightColor(index, color) {
  if (sensorPointLights[index]) {
    sensorPointLights[index].color.setHex(color);
  }
}

/**
 * Get sensor point lights array
 * @returns {Array<THREE.PointLight>}
 */
export function getSensorLights() {
  return sensorPointLights;
}

/**
 * Get ambient light
 * @returns {THREE.AmbientLight}
 */
export function getAmbientLight() {
  return ambientLight;
}

/**
 * Set ambient light intensity
 * @param {number} intensity - Light intensity
 */
export function setAmbientLightIntensity(intensity) {
  if (ambientLight) {
    ambientLight.intensity = intensity;
  }
}

/**
 * Clear all sensor lights
 */
export function clearSensorLights() {
  sensorPointLights.forEach(light => {
    if (light.parent) {
      light.parent.remove(light);
    }
  });
  sensorPointLights.length = 0;
}

/**
 * Add ambient light to scene
 * @param {number} color - Light color (hex)
 * @param {number} intensity - Light intensity
 */
export function addAmbientLight(color, intensity) {
  ambientLight = new THREE.AmbientLight(color, intensity);
  addToScene(ambientLight);
  return ambientLight;
}

/**
 * Clear all lights from scene
 */
export function clearLights() {
  if (ambientLight && ambientLight.parent) {
    ambientLight.parent.remove(ambientLight);
    ambientLight = null;
  }
  clearSensorLights();
}

/**
 * Update lights (placeholder for dynamic light updates)
 */
export function updateLights() {
  // Currently no dynamic updates needed
  // This function exists for future light animation
}
