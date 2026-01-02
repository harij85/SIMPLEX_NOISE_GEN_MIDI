/**
 * MIDI State Module
 *
 * Tracks MIDI input state including active notes, pitch bend,
 * and control change values.
 */

// Global MIDI input enabled flag
let midiInputEnabled = true;

// MIDI Input state tracking
const midiInputState = {
  activeNotes: new Map(), // Map of note -> {velocity, sensorIndex}
  pitchBend: 0,          // -1 to 1
  modWheel: 0,           // 0 to 1
  expression: 1.0        // 0 to 1
};

/**
 * Get MIDI input state
 * @returns {Object} MIDI input state
 */
export function getMIDIState() {
  return midiInputState;
}

/**
 * Check if MIDI input is enabled
 * @returns {boolean}
 */
export function isMIDIInputEnabled() {
  return midiInputEnabled;
}

/**
 * Enable or disable MIDI input
 * @param {boolean} enabled
 */
export function setMIDIInputEnabled(enabled) {
  midiInputEnabled = enabled;
}

/**
 * Add an active note
 * @param {number} note - MIDI note number
 * @param {number} velocity - Note velocity
 * @param {number} sensorIndex - Mapped sensor index
 */
export function addActiveNote(note, velocity, sensorIndex) {
  midiInputState.activeNotes.set(note, { velocity, sensorIndex });
}

/**
 * Remove an active note
 * @param {number} note - MIDI note number
 * @returns {Object|undefined} Note data if found
 */
export function removeActiveNote(note) {
  const noteData = midiInputState.activeNotes.get(note);
  midiInputState.activeNotes.delete(note);
  return noteData;
}

/**
 * Get active note data
 * @param {number} note - MIDI note number
 * @returns {Object|undefined} Note data {velocity, sensorIndex}
 */
export function getActiveNote(note) {
  return midiInputState.activeNotes.get(note);
}

/**
 * Clear all active notes
 */
export function clearActiveNotes() {
  midiInputState.activeNotes.clear();
}

/**
 * Get all active notes
 * @returns {Map} Map of active notes
 */
export function getAllActiveNotes() {
  return midiInputState.activeNotes;
}

/**
 * Set pitch bend value
 * @param {number} value - Pitch bend value (-1 to 1)
 */
export function setPitchBend(value) {
  midiInputState.pitchBend = value;
}

/**
 * Get pitch bend value
 * @returns {number} Pitch bend value (-1 to 1)
 */
export function getPitchBend() {
  return midiInputState.pitchBend;
}

/**
 * Set mod wheel value
 * @param {number} value - Mod wheel value (0 to 1)
 */
export function setModWheel(value) {
  midiInputState.modWheel = value;
}

/**
 * Get mod wheel value
 * @returns {number} Mod wheel value (0 to 1)
 */
export function getModWheel() {
  return midiInputState.modWheel;
}

/**
 * Set expression value
 * @param {number} value - Expression value (0 to 1)
 */
export function setExpression(value) {
  midiInputState.expression = value;
}

/**
 * Get expression value
 * @returns {number} Expression value (0 to 1)
 */
export function getExpression() {
  return midiInputState.expression;
}

/**
 * Get active notes (alias for getAllActiveNotes)
 * @returns {Map} Active notes map
 */
export function getActiveNotes() {
  return getAllActiveNotes();
}
