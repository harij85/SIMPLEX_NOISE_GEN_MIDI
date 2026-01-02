/**
 * MIDI I/O Module
 *
 * Handles Web MIDI API initialization, device enumeration,
 * and connection management for both input and output.
 */

// MIDI Devices
let midiInput = null;
let midiOutput = null;


/**
 * Initialize Web MIDI API
 * @returns {Promise<boolean>} Success status
 */
export async function initMIDI() {
  if (!('requestMIDIAccess' in navigator)) {
    alert('WebMIDI not supported. Use Chrome/Edge on macOS.');
    return false;
  }

  try {
    const access = await navigator.requestMIDIAccess();

    // Find IAC Driver or first available output
    for (const output of access.outputs.values()) {
      if (output.name.toLowerCase().includes('iac')) {
        midiOutput = output;
        break;
      }
    }

    if (!midiOutput) {
      const firstOutput = access.outputs.values().next();
      if (!firstOutput.done) {
        midiOutput = firstOutput.value;
      }
    }

    if (!midiOutput) {
      alert('No MIDI output found. Enable IAC Driver in Audio MIDI Setup.');
      return false;
    }

    // Setup MIDI Input
    let inputCount = 0;
    for (const input of access.inputs.values()) {
      inputCount++;
      if (!midiInput) {
        midiInput = input;
      }
    }

    console.log('✓ MIDI initialized:', midiOutput.name);
    if (inputCount > 0) {
      console.log(`✓ MIDI Input listening on ${inputCount} device(s)`);
    }
    return true;
  } catch (err) {
    console.error('MIDI error:', err);
    alert('MIDI initialization failed: ' + err.message);
    return false;
  }
}

/**
 * Attach MIDI message handler to all inputs
 * @param {Function} handler - Callback function for MIDI messages
 */
export function attachMIDIInputHandler(handler) {
  if (!midiInput) {
    console.warn('No MIDI input available');
    return;
  }

  midiInput.onmidimessage = handler;
}

/**
 * Send MIDI message to output
 * @param {Array<number>} message - MIDI message bytes [status, data1, data2]
 * @param {number} timestamp - Optional timestamp in milliseconds for scheduling
 */
export function sendMIDIMessage(message, timestamp = 0) {
  if (midiOutput) {
    if (timestamp > 0) {
      midiOutput.send(message, timestamp);
    } else {
      midiOutput.send(message);
    }
  }
}

/**
 * Get MIDI output device
 * @returns {MIDIOutput|null}
 */
export function getMIDIOutput() {
  return midiOutput;
}

/**
 * Get MIDI input device
 * @returns {MIDIInput|null}
 */
export function getMIDIInput() {
  return midiInput;
}

/**
 * Check if MIDI is initialized
 * @returns {boolean}
 */
export function isMIDIReady() {
  return midiOutput !== null;
}
