/**
 * Logger Utility Module
 *
 * Handles MIDI activity logging with UI display.
 */

const midiActivityLog = [];
const MAX_MIDI_LOG_ENTRIES = 10;

/**
 * Log MIDI activity message
 * @param {string} message - Activity message to log
 */
export function logMIDIActivity(message) {
  midiActivityLog.unshift(message);
  if (midiActivityLog.length > MAX_MIDI_LOG_ENTRIES) {
    midiActivityLog.pop();
  }

  // Update UI
  const activityDiv = document.getElementById('midiInputActivity');
  if (activityDiv) {
    activityDiv.innerHTML = midiActivityLog.join('<br>');
  }
}

/**
 * Clear MIDI activity log
 */
export function clearMIDILog() {
  midiActivityLog.length = 0;

  const activityDiv = document.getElementById('midiInputActivity');
  if (activityDiv) {
    activityDiv.innerHTML = 'Waiting for MIDI messages...';
  }
}

/**
 * Get current MIDI activity log
 * @returns {Array<string>} Array of log messages
 */
export function getMIDILog() {
  return [...midiActivityLog];
}
