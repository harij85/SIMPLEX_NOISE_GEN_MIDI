/**
 * MIDI Handlers Module
 *
 * Processes incoming MIDI messages and triggers appropriate actions.
 * Handles Note On/Off, Pitch Bend, and Control Change messages.
 */

import * as THREE from 'three';
import { MIDI_CONFIG, PITCH_BEND_LIMITS } from '../config/constants.js';
import {
  isMIDIInputEnabled,
  addActiveNote,
  removeActiveNote,
  setPitchBend,
  setModWheel,
  setExpression,
  getAllActiveNotes
} from './midiState.js';
import { sendMIDIMessage } from './midiIO.js';

// Callbacks for integration with main application
let onNoteOnCallback = null;
let onNoteOffCallback = null;
let onPitchBendCallback = null;
let onControlChangeCallback = null;
let logActivityCallback = null;
let mapNoteToSensorCallback = null;
let applyStringDisplacementCallback = null;

/**
 * Set callback for note on events
 * @param {Function} callback - (note, velocity, sensorIndex) => void
 */
export function setNoteOnCallback(callback) {
  onNoteOnCallback = callback;
}

/**
 * Set callback for note off events
 * @param {Function} callback - (note, sensorIndex) => void
 */
export function setNoteOffCallback(callback) {
  onNoteOffCallback = callback;
}

/**
 * Set callback for pitch bend events
 * @param {Function} callback - (bendValue) => void
 */
export function setPitchBendCallback(callback) {
  onPitchBendCallback = callback;
}

/**
 * Set callback for control change events
 * @param {Function} callback - (controller, value, normalizedValue) => void
 */
export function setControlChangeCallback(callback) {
  onControlChangeCallback = callback;
}

/**
 * Set callback for logging MIDI activity
 * @param {Function} callback - (message) => void
 */
export function setLogActivityCallback(callback) {
  logActivityCallback = callback;
}

/**
 * Set callback for mapping notes to sensors
 * @param {Function} callback - (midiNote) => sensorIndex
 */
export function setMapNoteToSensorCallback(callback) {
  mapNoteToSensorCallback = callback;
}

/**
 * Set callback for applying string displacement
 * @param {Function} callback - (sensorIndex, displacement, maxDisplacement) => void
 */
export function setApplyStringDisplacementCallback(callback) {
  applyStringDisplacementCallback = callback;
}

/**
 * Log MIDI activity
 * @param {string} message
 */
function logActivity(message) {
  if (logActivityCallback) {
    logActivityCallback(message);
  }
}

/**
 * Main MIDI message handler
 * @param {MIDIMessageEvent} event
 */
export function handleMIDIMessage(event) {
  if (!isMIDIInputEnabled()) {
    return;
  }

  const [status, data1, data2] = event.data;
  const command = status & 0xF0;

  switch (command) {
    case 0x90: // Note On
      if (data2 > 0) {
        handleMIDINoteOn(data1, data2);
      } else {
        handleMIDINoteOff(data1);
      }
      break;

    case 0x80: // Note Off
      handleMIDINoteOff(data1);
      break;

    case 0xE0: // Pitch Bend
      handleMIDIPitchBend(data1, data2);
      break;

    case 0xB0: // Control Change
      handleMIDIControlChange(data1, data2);
      break;
  }
}

/**
 * Handle incoming MIDI Note On
 * @param {number} note - MIDI note number
 * @param {number} velocity - Note velocity (0-127)
 */
export function handleMIDINoteOn(note, velocity) {
  // Map MIDI note to sensor index
  const sensorIndex = mapNoteToSensorCallback ? mapNoteToSensorCallback(note) : 0;

  // Store active note
  addActiveNote(note, velocity, sensorIndex);

  // Trigger callback for visual/audio feedback
  if (onNoteOnCallback) {
    onNoteOnCallback(note, velocity, sensorIndex);
  }

  // Send note through to output (MIDI thru)
  sendMIDIMessage([0x90, note, velocity]);

  logActivity(`Note On: ${note} (vel: ${velocity}) -> Sensor ${sensorIndex}`);
}

/**
 * Handle incoming MIDI Note Off
 * @param {number} note - MIDI note number
 */
export function handleMIDINoteOff(note) {
  const noteData = removeActiveNote(note);

  if (noteData && onNoteOffCallback) {
    onNoteOffCallback(note, noteData.sensorIndex);
  }

  // Send note off through to output
  sendMIDIMessage([0x80, note, 0]);

  if (noteData) {
    logActivity(`Note Off: ${note}`);
  }
}

/**
 * Handle incoming MIDI Pitch Bend
 * @param {number} lsb - Least significant byte
 * @param {number} msb - Most significant byte
 */
export function handleMIDIPitchBend(lsb, msb) {
  // Convert 14-bit pitch bend to -1..1 range
  const value14bit = (msb << 7) | lsb;
  const pitchBend = (value14bit - 8192) / 8192;

  setPitchBend(pitchBend);

  // Apply pitch bend to all active notes' strings
  if (applyStringDisplacementCallback) {
    for (const [, noteData] of getAllActiveNotes()) {
      const { sensorIndex } = noteData;

      // Calculate displacement with clamping
      const bendAmount = Math.max(
        -PITCH_BEND_LIMITS.MAX_BEND_AMOUNT,
        Math.min(
          PITCH_BEND_LIMITS.MAX_BEND_AMOUNT,
          pitchBend * PITCH_BEND_LIMITS.SENSITIVITY
        )
      );

      const bendVector = new THREE.Vector3(bendAmount, 0, 0);
      applyStringDisplacementCallback(
        sensorIndex,
        bendVector,
        PITCH_BEND_LIMITS.MAX_DISPLACEMENT
      );
    }
  }

  // Trigger callback
  if (onPitchBendCallback) {
    onPitchBendCallback(pitchBend);
  }

  // Send pitch bend through to output
  sendMIDIMessage([0xE0, lsb, msb]);

  logActivity(`Pitch Bend: ${pitchBend.toFixed(2)}`);
}

/**
 * Handle incoming MIDI Control Change
 * @param {number} controller - CC number
 * @param {number} value - CC value (0-127)
 */
export function handleMIDIControlChange(controller, value) {
  const normalizedValue = value / 127;

  const ccNames = {
    1: 'Mod Wheel',
    11: 'Expression',
    64: 'Sustain'
  };

  let logMessage = `CC${controller}`;
  if (ccNames[controller]) {
    logMessage += ` (${ccNames[controller]})`;
  }
  logMessage += `: ${value}`;

  switch (controller) {
    case 1: // Mod Wheel
      setModWheel(normalizedValue);
      logMessage += ' -> Spatial Scale';
      break;

    case 11: // Expression
      setExpression(normalizedValue);
      logMessage += ' -> Displacement';
      break;

    case 64: // Sustain Pedal
      // Handled by callback
      break;
  }

  // Trigger callback
  if (onControlChangeCallback) {
    onControlChangeCallback(controller, value, normalizedValue);
  }

  // Send CC through to output
  sendMIDIMessage([0xB0, controller, value]);

  logActivity(logMessage);
}

/**
 * Send MIDI Note On
 * @param {number} note - MIDI note number
 * @param {number} velocity - Note velocity (0-127)
 * @param {number} time - Timestamp in milliseconds
 */
export function sendNoteOn(note, velocity = 80, time = 0) {
  sendMIDIMessage([0x90, note, velocity], time);
}

/**
 * Send MIDI Note Off
 * @param {number} note - MIDI note number
 * @param {number} time - Timestamp in milliseconds
 */
export function sendNoteOff(note, time = 0) {
  sendMIDIMessage([0x80, note, 0], time);
}

/**
 * Send MIDI Pitch Bend
 * @param {number} channel - MIDI channel (0-15)
 * @param {number} value - Pitch bend value (0-16383, center is 8192)
 */
export function sendPitchBend(channel, value) {
  // Clamp value to valid range
  const clampedValue = Math.max(0, Math.min(16383, Math.round(value)));

  // Split 14-bit value into LSB and MSB
  const lsb = clampedValue & 0x7F;
  const msb = (clampedValue >> 7) & 0x7F;

  const status = 0xE0 | (channel & 0x0F);
  sendMIDIMessage([status, lsb, msb]);
}

/**
 * Map noise value to MIDI note
 * @param {number} value - Noise value (0 to 1)
 * @param {Function} quantizeCallback - Optional scale quantization function
 * @returns {number} MIDI note number
 */
export function noiseToMIDINote(value, quantizeCallback) {
  const clamped = Math.max(0, Math.min(1, value));
  const rawNote = Math.round(
    MIDI_CONFIG.MIN_NOTE + clamped * (MIDI_CONFIG.MAX_NOTE - MIDI_CONFIG.MIN_NOTE)
  );

  return quantizeCallback ? quantizeCallback(rawNote) : rawNote;
}
