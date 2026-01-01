/**
 * Global State Module
 *
 * Centralizes mutable application state that doesn't belong to
 * specific modules. Provides getter/setter pattern for state management.
 */

import { SEQUENCER_DEFAULTS } from './constants.js';

// Application state
const state = {
  // Sequencer
  numSteps: SEQUENCER_DEFAULTS.STEPS,
  currentStep: 0,
  stepStartTime: 0,

  // Sensor positions
  sensorDistribution: 0.0, // 0 = line, 1 = chaos
  sensorAnimationSpeed: 0.0,

  // Noise parameters
  currentNoiseType: 'simplex',

  // Time
  time: 0.0,

  // Mouse interaction
  mouse: {
    x: 0,
    y: 0,
    normalized: { x: 0, y: 0 }
  },

  // Active interactions
  activeString: null, // {index, startY, initialDisplacement}

  // UI state
  editingStep: null
};

/**
 * Get number of steps
 * @returns {number}
 */
export function getNumSteps() {
  return state.numSteps;
}

/**
 * Set number of steps
 * @param {number} steps
 */
export function setNumSteps(steps) {
  state.numSteps = Math.max(SEQUENCER_DEFAULTS.MIN_STEPS, Math.min(SEQUENCER_DEFAULTS.MAX_STEPS, steps));
}

/**
 * Get current step
 * @returns {number}
 */
export function getCurrentStep() {
  return state.currentStep;
}

/**
 * Set current step
 * @param {number} step
 */
export function setCurrentStep(step) {
  state.currentStep = step;
}

/**
 * Get step start time
 * @returns {number}
 */
export function getStepStartTime() {
  return state.stepStartTime;
}

/**
 * Set step start time
 * @param {number} time
 */
export function setStepStartTime(time) {
  state.stepStartTime = time;
}

/**
 * Get sensor distribution
 * @returns {number}
 */
export function getSensorDistribution() {
  return state.sensorDistribution;
}

/**
 * Set sensor distribution
 * @param {number} distribution - 0 to 1
 */
export function setSensorDistribution(distribution) {
  state.sensorDistribution = Math.max(0, Math.min(1, distribution));
}

/**
 * Get sensor animation speed
 * @returns {number}
 */
export function getSensorAnimationSpeed() {
  return state.sensorAnimationSpeed;
}

/**
 * Set sensor animation speed
 * @param {number} speed
 */
export function setSensorAnimationSpeed(speed) {
  state.sensorAnimationSpeed = speed;
}

/**
 * Get current noise type
 * @returns {string}
 */
export function getCurrentNoiseType() {
  return state.currentNoiseType;
}

/**
 * Set current noise type
 * @param {string} noiseType
 */
export function setCurrentNoiseType(noiseType) {
  state.currentNoiseType = noiseType;
}

/**
 * Get time
 * @returns {number}
 */
export function getTime() {
  return state.time;
}

/**
 * Set time
 * @param {number} time
 */
export function setTime(time) {
  state.time = time;
}

/**
 * Update time
 * @param {number} delta - Time delta
 */
export function updateTime(delta) {
  state.time += delta;
}

/**
 * Get mouse state
 * @returns {Object}
 */
export function getMouse() {
  return state.mouse;
}

/**
 * Set mouse position
 * @param {number} x - Mouse X
 * @param {number} y - Mouse Y
 * @param {number} normalizedX - Normalized X (-1 to 1)
 * @param {number} normalizedY - Normalized Y (-1 to 1)
 */
export function setMousePosition(x, y, normalizedX, normalizedY) {
  state.mouse.x = x;
  state.mouse.y = y;
  state.mouse.normalized.x = normalizedX;
  state.mouse.normalized.y = normalizedY;
}

/**
 * Get active string
 * @returns {Object|null}
 */
export function getActiveString() {
  return state.activeString;
}

/**
 * Set active string
 * @param {Object|null} stringData
 */
export function setActiveString(stringData) {
  state.activeString = stringData;
}

/**
 * Get editing step
 * @returns {number|null}
 */
export function getEditingStep() {
  return state.editingStep;
}

/**
 * Set editing step
 * @param {number|null} step
 */
export function setEditingStep(step) {
  state.editingStep = step;
}

/**
 * Get entire state object (for debugging)
 * @returns {Object}
 */
export function getState() {
  return state;
}
