/**
 * Scheduler Module
 *
 * Handles timing calculations for the sequencer including BPM,
 * time signatures, and PPQN-based MIDI timing.
 */

import { MIDI_CONFIG, SEQUENCER_DEFAULTS } from '../config/constants.js';

// Timing state
let BPM = SEQUENCER_DEFAULTS.BPM;
let timeSigNumerator = SEQUENCER_DEFAULTS.TIME_SIG_NUM;
let timeSigDenominator = SEQUENCER_DEFAULTS.TIME_SIG_DEN;
let STEP_MS = 0;

/**
 * Calculate step duration in milliseconds
 * @param {number} bpm - Beats per minute
 * @param {number} numerator - Time signature numerator
 * @param {number} denominator - Time signature denominator
 * @param {number} numSteps - Number of steps per measure
 * @returns {number} Step duration in milliseconds
 */
export function calculateStepMS(bpm = BPM, numerator = timeSigNumerator, denominator = timeSigDenominator, numSteps = SEQUENCER_DEFAULTS.STEPS) {
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
export function calculateTicksPerMeasure(numerator = timeSigNumerator, denominator = timeSigDenominator) {
  // Ticks per quarter note * quarter notes per measure
  const quarterNotesPerMeasure = numerator * (4 / denominator);
  return MIDI_CONFIG.PPQN * quarterNotesPerMeasure;
}

/**
 * Get current BPM
 * @returns {number} BPM
 */
export function getBPM() {
  return BPM;
}

/**
 * Set BPM and recalculate step timing
 * @param {number} bpm - Beats per minute
 */
export function setBPM(bpm) {
  BPM = Math.max(0, Math.min(240, bpm));
  STEP_MS = calculateStepMS(BPM, timeSigNumerator, timeSigDenominator);
}

/**
 * Get current time signature
 * @returns {Object} {numerator, denominator}
 */
export function getTimeSig() {
  return {
    numerator: timeSigNumerator,
    denominator: timeSigDenominator
  };
}

/**
 * Set time signature and recalculate step timing
 * @param {number} numerator - Beats per measure
 * @param {number} denominator - Note value (2, 4, 8, 16, etc.)
 */
export function setTimeSig(numerator, denominator) {
  timeSigNumerator = Math.max(1, Math.min(256, numerator));
  timeSigDenominator = Math.max(1, Math.min(256, denominator));
  STEP_MS = calculateStepMS(BPM, timeSigNumerator, timeSigDenominator);
}

/**
 * Get current step duration in milliseconds
 * @returns {number} Step duration
 */
export function getStepMS() {
  return STEP_MS;
}

/**
 * Update step timing (should be called after BPM or time signature changes)
 * @param {number} numSteps - Number of steps
 */
export function updateStepTiming(numSteps) {
  STEP_MS = calculateStepMS(BPM, timeSigNumerator, timeSigDenominator, numSteps);
}

/**
 * Convert milliseconds to MIDI ticks
 * @param {number} ms - Milliseconds
 * @param {number} bpm - Beats per minute
 * @returns {number} MIDI ticks
 */
export function msToTicks(ms, bpm = BPM) {
  const quarterNoteMS = 60000 / bpm;
  const quarterNotes = ms / quarterNoteMS;
  return Math.round(quarterNotes * MIDI_CONFIG.PPQN);
}

/**
 * Convert MIDI ticks to milliseconds
 * @param {number} ticks - MIDI ticks
 * @param {number} bpm - Beats per minute
 * @returns {number} Milliseconds
 */
export function ticksToMS(ticks, bpm = BPM) {
  const quarterNoteMS = 60000 / bpm;
  const quarterNotes = ticks / MIDI_CONFIG.PPQN;
  return quarterNotes * quarterNoteMS;
}
