/**
 * Sequencer Module
 *
 * Core sequencer loop that schedules MIDI notes based on noise sampling
 * and step parameters. Handles note timing, duration, and playback.
 */

import { getStepParameters } from './stepParameters.js';
import { getStepMS } from './scheduler.js';
import { sendNoteOn, sendNoteOff, noiseToMIDINote, noiseToMIDINoteWithVelocity } from '../midi/midiHandlers.js';
import { scaleDegreeToMidiNote, isScaleEnabled, quantizeToScale } from '../utils/scales.js';
import { MIDI_CONFIG } from '../config/constants.js';

// Sequencer state
let sequencerRunning = false;
let sequencerTimeoutId = null;
let currentStep = 0;
let stepStartTime = 0;

// Callbacks
let sampleNoiseCallback = null;
let onStepCallback = null;
let sendNoteOnCallback = null;
let sendNoteOffCallback = null;

/**
 * Set callback for noise sampling
 * @param {Function} callback - () => Array<number> noise values
 */
export function setSampleNoiseCallback(callback) {
  sampleNoiseCallback = callback;
}

/**
 * Set callback for step updates
 * @param {Function} callback - (stepIndex, time) => void
 */
export function setStepCallback(callback) {
  onStepCallback = callback;
}

/**
 * Schedule notes for one complete sequence
 */
function scheduleNoiseSequence() {
  if (!sampleNoiseCallback) return;

  const STEP_MS = getStepMS();

  // Skip scheduling if BPM is 0 (STEP_MS would be Infinity)
  if (!isFinite(STEP_MS)) return;

  const noiseValues = sampleNoiseCallback();
  const now = performance.now();

  const stepParameters = getStepParameters();
  const numSteps = stepParameters.length;

  let cumulativeTime = 0;

  for (let i = 0; i < numSteps; i++) {
    const params = stepParameters[i];

    // Skip if step is inactive (rest)
    if (!params.active) {
      cumulativeTime += STEP_MS;
      continue;
    }

    // Determine note value and velocity
    let note;
    let velocity;

    if (params.scaleDegree !== null && isScaleEnabled()) {
      // Use forced scale degree (I-VII)
      note = scaleDegreeToMidiNote(params.scaleDegree);
      velocity = params.velocity !== null ? params.velocity : MIDI_CONFIG.DEFAULT_VELOCITY;
    } else {
      // Use noise value with gradient-based velocity
      const value = noiseValues[i];
      const result = noiseToMIDINoteWithVelocity(value, quantizeToScale);
      note = result.note;
      // Use gradient-based velocity unless step has explicit velocity override
      velocity = params.velocity !== null ? params.velocity : result.velocity;
    }

    // Calculate note duration
    let duration = STEP_MS;

    // Apply dotted note (1.5x duration)
    if (params.dotted) {
      duration *= 1.5;
    }

    // Check if next step is tied
    let extendedDuration = duration;
    if (params.tie && i < numSteps - 1) {
      // Count consecutive tied steps
      let tieCount = 1;
      for (let j = i + 1; j < numSteps; j++) {
        if (stepParameters[j].tie && j < numSteps - 1) {
          tieCount++;
        } else {
          // Include the last tied step's duration
          tieCount++;
          break;
        }
      }
      extendedDuration = STEP_MS * tieCount;
    }

    const tOn = now + cumulativeTime;
    const tOff = tOn + extendedDuration * 0.95; // 95% to avoid overlap

    sendNoteOn(note, velocity, tOn);
    sendNoteOff(note, tOff);

    // Call callbacks for tracker/UI updates
    if (sendNoteOnCallback) {
      sendNoteOnCallback(note, velocity, tOn, i);
    }
    if (sendNoteOffCallback) {
      sendNoteOffCallback(note, tOff, i);
    }

    cumulativeTime += STEP_MS;
  }
}

/**
 * Main sequencer loop
 */
function sequencerLoop() {
  if (!sequencerRunning) return;

  scheduleNoiseSequence();

  // Calculate next schedule time based on current BPM
  const STEP_MS = getStepMS();
  const stepParameters = getStepParameters();
  const barMs = STEP_MS * stepParameters.length;

  sequencerTimeoutId = setTimeout(sequencerLoop, barMs);
}

/**
 * Start the sequencer
 */
export function startSequencer() {
  if (sequencerRunning) return;
  sequencerRunning = true;

  // Initialize step tracking
  currentStep = 0;
  stepStartTime = performance.now();

  sequencerLoop();
  console.log('Sequencer started');
}

/**
 * Stop the sequencer
 */
export function stopSequencer() {
  sequencerRunning = false;

  if (sequencerTimeoutId !== null) {
    clearTimeout(sequencerTimeoutId);
    sequencerTimeoutId = null;
  }

  console.log('Sequencer stopped');
}

/**
 * Check if sequencer is running
 * @returns {boolean}
 */
export function isSequencerRunning() {
  return sequencerRunning;
}

/**
 * Get current step index
 * @returns {number}
 */
export function getCurrentStep() {
  return currentStep;
}

/**
 * Update current step (called from animation loop)
 * @returns {number} Current step index
 */
export function updateCurrentStep() {
  if (!sequencerRunning) return currentStep;

  const STEP_MS = getStepMS();
  const now = performance.now();
  const elapsed = now - stepStartTime;

  const stepParameters = getStepParameters();
  const numSteps = stepParameters.length;

  const barMs = STEP_MS * numSteps;
  const elapsedInBar = elapsed % barMs;
  const newStep = Math.floor(elapsedInBar / STEP_MS);

  if (newStep !== currentStep) {
    currentStep = newStep;

    if (onStepCallback) {
      onStepCallback(currentStep, now);
    }
  }

  return currentStep;
}

/**
 * Set callback for MIDI note on events from sequencer
 * @param {Function} callback - Callback function(note, velocity, time, stepIndex)
 */
export function setSendNoteOnCallback(callback) {
  sendNoteOnCallback = callback;
}

/**
 * Set callback for MIDI note off events from sequencer
 * @param {Function} callback - Callback function(note, time, stepIndex)
 */
export function setSendNoteOffCallback(callback) {
  sendNoteOffCallback = callback;
}
