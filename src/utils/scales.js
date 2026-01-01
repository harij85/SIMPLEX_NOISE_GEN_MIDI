/**
 * Musical Scales Utility Module
 *
 * Handles scale definitions, quantization, and Scala file parsing.
 */

import { MIDI_CONFIG } from '../config/constants.js';

// Scale definitions as semitone intervals from root
export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'pentatonic-major': [0, 2, 4, 7, 9],
  'pentatonic-minor': [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  'whole-tone': [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11]
};

// Scale state
let scaleEnabled = false;
let currentScale = SCALES.chromatic;
let currentKey = 0; // 0 = C, 1 = C#, 2 = D, etc.
let customScalaScale = null; // For imported Scala files

/**
 * Get current scale enabled state
 * @returns {boolean}
 */
export function isScaleEnabled() {
  return scaleEnabled;
}

/**
 * Enable or disable scale quantization
 * @param {boolean} enabled
 */
export function setScaleEnabled(enabled) {
  scaleEnabled = enabled;
}

/**
 * Get current scale intervals
 * @returns {Array<number>}
 */
export function getCurrentScale() {
  return currentScale;
}

/**
 * Set current scale
 * @param {string|Array<number>} scale - Scale name or custom intervals
 */
export function setCurrentScale(scale) {
  if (typeof scale === 'string' && SCALES[scale]) {
    currentScale = SCALES[scale];
    customScalaScale = null;
  } else if (Array.isArray(scale)) {
    currentScale = scale;
    customScalaScale = null;
  }
}

/**
 * Get current key
 * @returns {number} Key offset (0-11)
 */
export function getCurrentKey() {
  return currentKey;
}

/**
 * Set current key
 * @param {number} key - Key offset (0-11)
 */
export function setCurrentKey(key) {
  currentKey = Math.max(0, Math.min(11, key));
}

/**
 * Set custom Scala scale
 * @param {Array<number>} scaleNotes - Array of MIDI note numbers
 */
export function setCustomScalaScale(scaleNotes) {
  customScalaScale = scaleNotes;
}

/**
 * Clear custom Scala scale
 */
export function clearCustomScalaScale() {
  customScalaScale = null;
}

/**
 * Generate all MIDI notes in the current scale across the full range
 * Applies key transposition
 * @returns {Array<number>} Sorted array of MIDI note numbers
 */
export function generateScaleNotes() {
  if (customScalaScale) {
    return customScalaScale;
  }

  const notes = [];
  const scaleIntervals = currentScale;

  // Generate notes across all octaves with key transposition
  for (let octave = 0; octave < 11; octave++) {
    const octaveBase = octave * 12;
    for (let interval of scaleIntervals) {
      const note = octaveBase + interval + currentKey;
      if (note >= MIDI_CONFIG.MIN_NOTE && note <= MIDI_CONFIG.MAX_NOTE) {
        notes.push(note);
      }
    }
  }

  return notes.sort((a, b) => a - b);
}

/**
 * Quantize a MIDI note to the nearest note in the current scale
 * @param {number} midiNote - MIDI note number to quantize
 * @returns {number} Quantized MIDI note number
 */
export function quantizeToScale(midiNote) {
  if (!scaleEnabled) {
    return midiNote;
  }

  const scaleNotes = generateScaleNotes();

  // Find nearest note in scale
  let closest = scaleNotes[0];
  let minDist = Math.abs(midiNote - closest);

  for (let note of scaleNotes) {
    const dist = Math.abs(midiNote - note);
    if (dist < minDist) {
      minDist = dist;
      closest = note;
    }
  }

  return closest;
}

/**
 * Convert scale degree (1-7 for I-VII) to MIDI note
 * Uses middle octave (C4-B4) as default range
 * @param {number} degree - Scale degree (1-7)
 * @returns {number} MIDI note number
 */
export function scaleDegreeToMidiNote(degree) {
  if (!scaleEnabled) {
    // If scale is disabled, use chromatic scale in C
    const middleC = 60; // C4
    return middleC + (degree - 1);
  }

  const scaleIntervals = currentScale;
  const degreeIndex = (degree - 1) % scaleIntervals.length;
  const octaveOffset = Math.floor((degree - 1) / scaleIntervals.length);

  // Use C4 (MIDI 60) as base for middle octave
  const middleC = 60;
  const note = middleC + currentKey + scaleIntervals[degreeIndex] + (octaveOffset * 12);

  // Clamp to valid MIDI range
  return Math.max(MIDI_CONFIG.MIN_NOTE, Math.min(MIDI_CONFIG.MAX_NOTE, note));
}

/**
 * Parse a Scala (.scl) file
 * Format: https://www.huygens-fokker.org/scala/scl_format.html
 * @param {string} text - Scala file contents
 * @returns {Array<number>} Array of MIDI note numbers
 * @throws {Error} If file format is invalid
 */
export function parseScalaFile(text) {
  const lines = text.split('\n').map(line => line.trim());

  // Skip comments and empty lines
  const cleanLines = lines.filter(line =>
    line.length > 0 && !line.startsWith('!')
  );

  if (cleanLines.length < 2) {
    throw new Error('Invalid Scala file format');
  }

  // First line is description (skip)
  // Second line is number of notes
  const numNotes = parseInt(cleanLines[1]);

  if (isNaN(numNotes)) {
    throw new Error('Invalid number of notes in Scala file');
  }

  // Parse scale degrees
  const intervals = [0]; // Always include root

  for (let i = 2; i < Math.min(2 + numNotes, cleanLines.length); i++) {
    const line = cleanLines[i];

    // Parse either cents (decimal) or ratio (e.g., "3/2")
    let cents;
    if (line.includes('/')) {
      // Ratio format
      const [num, den] = line.split('/').map(parseFloat);
      cents = 1200 * Math.log2(num / den);
    } else {
      // Cents format
      cents = parseFloat(line);
    }

    if (!isNaN(cents)) {
      intervals.push(cents);
    }
  }

  // Convert cents to MIDI notes across the range
  const notes = [];
  const octaveCents = intervals[intervals.length - 1]; // Usually 1200 for octave

  for (let octave = 0; octave < 11; octave++) {
    for (let cents of intervals) {
      const totalCents = octave * octaveCents + cents;
      const semitones = totalCents / 100; // Convert cents to semitones
      const midiNote = Math.round(semitones);

      if (midiNote >= MIDI_CONFIG.MIN_NOTE && midiNote <= MIDI_CONFIG.MAX_NOTE) {
        notes.push(midiNote);
      }
    }
  }

  return [...new Set(notes)].sort((a, b) => a - b);
}
