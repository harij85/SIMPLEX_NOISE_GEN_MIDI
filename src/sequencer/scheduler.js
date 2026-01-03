/**
 * Scheduler Module
 *
 * Handles timing calculations for the sequencer including BPM,
 * time signatures, and PPQN-based MIDI timing.
 */

import { MIDI_CONFIG } from '../config/constants.js';
import {
  getNumSteps,
  getBPM as getStateBPM,
  setBPM as setStateBPM,
  getTimeSigNumerator as getStateTimeSigNumerator,
  getTimeSigDenominator as getStateTimeSigDenominator,
  setTimeSig as setStateTimeSig,
  setNumSteps as setGlobalNumSteps
} from '../config/globalState.js';

// Cached step duration
let STEP_MS = 0;

/**
 * Calculate step duration in milliseconds
 * @param {number} bpm - Beats per minute
 * @param {number} numerator - Time signature numerator
 * @param {number} denominator - Time signature denominator
 * @param {number} numSteps - Number of steps per measure
 * @returns {number} Step duration in milliseconds
 */
export function calculateStepMS(bpm, numerator, denominator, numSteps) {
  if (bpm <= 0) return Infinity;

  // Calculate quarter note duration in ms
  const quarterNoteMS = 60000 / bpm;

  // Calculate beat duration based on denominator
  // Denominator 4 = quarter note, 8 = eighth note, etc.
  const beatDurationMS = quarterNoteMS * (4 / denominator);

  // Each step is one beat divided by the number of steps per measure
  const beatsPerMeasure = numerator;
  const stepsPerMeasure = numSteps;

  // Distribute beats across steps
  return (beatDurationMS * beatsPerMeasure) / stepsPerMeasure;
}

/**
 * Calculate MIDI ticks per measure
 * @param {number} numerator - Time signature numerator
 * @param {number} denominator - Time signature denominator
 * @returns {number} Ticks per measure
 */
export function calculateTicksPerMeasure(numerator, denominator) {
  // Ticks per quarter note * quarter notes per measure
  const quarterNotesPerMeasure = numerator * (4 / denominator);
  return MIDI_CONFIG.PPQN * quarterNotesPerMeasure;
}

/**
 * Get current BPM
 * @returns {number} BPM
 */
export function getBPM() {
  return getStateBPM();
}

/**
 * Set BPM and recalculate step timing
 * @param {number} bpm - Beats per minute
 */
export function setBPM(bpm) {
  setStateBPM(bpm);
  // Use time signature numerator as default if numSteps hasn't been customized
  const numSteps = getNumSteps() || getStateTimeSigNumerator();
  STEP_MS = calculateStepMS(getStateBPM(), getStateTimeSigNumerator(), getStateTimeSigDenominator(), numSteps);
}

/**
 * Get current time signature
 * @returns {Array<number>} [numerator, denominator]
 */
export function getTimeSig() {
  return [getStateTimeSigNumerator(), getStateTimeSigDenominator()];
}

/**
 * Set time signature and recalculate step timing
 * @param {number|Array} numerator - Beats per measure, or [numerator, denominator] array
 * @param {number} denominator - Note value (2, 4, 8, 16, etc.)
 */
export function setTimeSig(numerator, denominator) {
  setStateTimeSig(numerator, denominator);
  // Use time signature numerator as default if numSteps hasn't been customized
  const numSteps = getNumSteps() || getStateTimeSigNumerator();
  STEP_MS = calculateStepMS(getStateBPM(), getStateTimeSigNumerator(), getStateTimeSigDenominator(), numSteps);
}

/**
 * Get current step duration in milliseconds
 * @returns {number} Step duration
 */
export function getStepMS() {
  // Calculate dynamically if not initialized
  if (STEP_MS === 0) {
    const numSteps = getNumSteps() || getStateTimeSigNumerator();
    return calculateStepMS(getStateBPM(), getStateTimeSigNumerator(), getStateTimeSigDenominator(), numSteps);
  }
  return STEP_MS;
}

/**
 * Update step timing (should be called after BPM or time signature changes)
 * @param {number} numSteps - Number of steps
 */
export function updateStepTiming(numSteps) {
  STEP_MS = calculateStepMS(getStateBPM(), getStateTimeSigNumerator(), getStateTimeSigDenominator(), numSteps);
}

/**
 * Convert milliseconds to MIDI ticks
 * @param {number} ms - Milliseconds
 * @param {number} bpm - Beats per minute (optional, uses current BPM if not provided)
 * @returns {number} MIDI ticks
 */
export function msToTicks(ms, bpm) {
  const actualBpm = bpm !== undefined ? bpm : getStateBPM();
  const quarterNoteMS = 60000 / actualBpm;
  const quarterNotes = ms / quarterNoteMS;
  return Math.round(quarterNotes * MIDI_CONFIG.PPQN);
}

/**
 * Convert MIDI ticks to milliseconds
 * @param {number} ticks - MIDI ticks
 * @param {number} bpm - Beats per minute (optional, uses current BPM if not provided)
 * @returns {number} Milliseconds
 */
export function ticksToMS(ticks, bpm) {
  const actualBpm = bpm !== undefined ? bpm : getStateBPM();
  const quarterNoteMS = 60000 / actualBpm;
  const quarterNotes = ticks / MIDI_CONFIG.PPQN;
  return quarterNotes * quarterNoteMS;
}

/**
 * Get time signature numerator
 * @returns {number} Numerator
 */
export function getTimeSigNumerator() {
  return getStateTimeSigNumerator();
}

/**
 * Get time signature denominator
 * @returns {number} Denominator
 */
export function getTimeSigDenominator() {
  return getStateTimeSigDenominator();
}

/**
 * Export PPQN constant
 */
export const PPQN = MIDI_CONFIG.PPQN;

/**
 * Set number of steps (forwards to globalState)
 * @param {number} steps - Number of steps
 */
export function setNumSteps(steps) {
  setGlobalNumSteps(steps);
  updateStepTiming(steps);
}
