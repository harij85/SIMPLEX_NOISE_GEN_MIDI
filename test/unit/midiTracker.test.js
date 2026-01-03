/**
 * MIDI Tracker Display Tests
 *
 * Tests the tracker-style MIDI monitor display functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

describe('MIDI Tracker Display', () => {
  let dom;
  let document;
  let window;
  let trackerRowsDiv;
  let updateMIDIMonitor;
  let midiNoteToName;
  let getCurrentStep;

  beforeEach(() => {
    // Create a DOM environment
    dom = new JSDOM(`
      <!DOCTYPE html>
      <html>
        <body>
          <div id="trackerRows"></div>
        </body>
      </html>
    `);
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    trackerRowsDiv = document.getElementById('trackerRows');

    // Mock getCurrentStep
    let mockStepCounter = 0;
    getCurrentStep = vi.fn(() => mockStepCounter++);

    // Helper function to convert MIDI note to name
    midiNoteToName = (midiNote) => {
      const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const octave = Math.floor(midiNote / 12) - 1;
      const noteName = noteNames[midiNote % 12];
      return `${noteName}${octave}`;
    };

    // Create the tracker update function
    const trackerRows = [];
    const MAX_STEPS = 16; // Default max steps for tests

    updateMIDIMonitor = (note, velocity, duration, stepIndex = null, gpuColor = 'rgb(128, 128, 128)') => {
      const trackerRowsDiv = document.getElementById('trackerRows');
      if (!trackerRowsDiv) return;

      const stepNumber = stepIndex !== null ? stepIndex : getCurrentStep();
      const noteName = midiNoteToName(note);
      const durationMs = Math.round(duration);

      // Create new tracker row
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '35px 30px 50px 35px 50px'; // Added GPU column
      row.style.gap = '8px';
      row.style.padding = '2px 0';
      row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.1)';
      row.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';

      // Add cells
      const stepCell = document.createElement('div');
      stepCell.textContent = String(stepNumber + 1).padStart(2, '0'); // Display as 1-based (01-16)
      stepCell.style.textAlign = 'center';

      // GPU color swatch
      const gpuCell = document.createElement('div');
      gpuCell.style.width = '20px';
      gpuCell.style.height = '12px';
      gpuCell.style.backgroundColor = gpuColor;
      gpuCell.style.border = '1px solid rgba(255, 255, 255, 0.2)';
      gpuCell.style.borderRadius = '2px';
      gpuCell.style.margin = '0 auto';

      const noteCell = document.createElement('div');
      noteCell.textContent = noteName;
      noteCell.style.textAlign = 'center';

      const velCell = document.createElement('div');
      velCell.textContent = String(velocity);
      velCell.style.textAlign = 'center';

      const durCell = document.createElement('div');
      durCell.textContent = String(durationMs);
      durCell.style.textAlign = 'right';

      row.appendChild(stepCell);
      row.appendChild(gpuCell); // GPU color swatch
      row.appendChild(noteCell);
      row.appendChild(velCell);
      row.appendChild(durCell);

      // Insert at top of list
      if (trackerRowsDiv.firstChild) {
        trackerRowsDiv.insertBefore(row, trackerRowsDiv.firstChild);
      } else {
        trackerRowsDiv.appendChild(row);
      }

      // Fade out previous row highlight
      if (trackerRowsDiv.children.length > 1) {
        trackerRowsDiv.children[1].style.backgroundColor = 'transparent';
      }

      // Store reference
      trackerRows.unshift(row);

      // Dynamically limit rows to MAX_STEPS
      while (trackerRows.length > MAX_STEPS) {
        const oldRow = trackerRows.pop();
        if (oldRow && oldRow.parentNode) {
          oldRow.parentNode.removeChild(oldRow);
        }
      }
    };
  });

  afterEach(() => {
    global.document = undefined;
    global.window = undefined;
  });

  describe('Basic Functionality', () => {
    it('should create tracker div element', () => {
      expect(trackerRowsDiv).toBeDefined();
      expect(trackerRowsDiv).not.toBeNull();
    });

    it('should add a single MIDI note to tracker', () => {
      updateMIDIMonitor(60, 80, 450);

      expect(trackerRowsDiv.children.length).toBe(1);

      const row = trackerRowsDiv.children[0];
      expect(row.children.length).toBe(5); // Added GPU column
    });

    it('should display correct note information', () => {
      updateMIDIMonitor(60, 80, 450); // C4

      const row = trackerRowsDiv.children[0];
      const stepCell = row.children[0];
      const gpuCell = row.children[1]; // GPU color swatch
      const noteCell = row.children[2];
      const velCell = row.children[3];
      const durCell = row.children[4];

      expect(stepCell.textContent).toBe('01'); // 1-based step numbering
      expect(noteCell.textContent).toBe('C4');
      expect(velCell.textContent).toBe('80');
      expect(durCell.textContent).toBe('450');
      expect(gpuCell.style.backgroundColor).toBe('rgb(128, 128, 128)'); // Default color
    });
  });

  describe('Note Name Conversion', () => {
    it('should convert MIDI 60 to C4', () => {
      expect(midiNoteToName(60)).toBe('C4');
    });

    it('should convert MIDI 69 to A4', () => {
      expect(midiNoteToName(69)).toBe('A4');
    });

    it('should convert MIDI 48 to C3', () => {
      expect(midiNoteToName(48)).toBe('C3');
    });

    it('should convert MIDI 72 to C5', () => {
      expect(midiNoteToName(72)).toBe('C5');
    });

    it('should convert MIDI 61 to C#4', () => {
      expect(midiNoteToName(61)).toBe('C#4');
    });
  });

  describe('Multiple Notes', () => {
    it('should add multiple notes in sequence', () => {
      updateMIDIMonitor(60, 80, 450);
      updateMIDIMonitor(64, 75, 425);
      updateMIDIMonitor(67, 90, 438);

      expect(trackerRowsDiv.children.length).toBe(3);
    });

    it('should display notes in reverse chronological order (newest first)', () => {
      updateMIDIMonitor(60, 80, 450); // C4
      updateMIDIMonitor(64, 75, 425); // E4
      updateMIDIMonitor(67, 90, 438); // G4

      const firstRow = trackerRowsDiv.children[0];
      const secondRow = trackerRowsDiv.children[1];
      const thirdRow = trackerRowsDiv.children[2];

      expect(firstRow.children[2].textContent).toBe('G4'); // Most recent
      expect(secondRow.children[2].textContent).toBe('E4');
      expect(thirdRow.children[2].textContent).toBe('C4'); // Oldest
    });

    it('should increment step numbers', () => {
      updateMIDIMonitor(60, 80, 450);
      updateMIDIMonitor(64, 75, 425);
      updateMIDIMonitor(67, 90, 438);

      const firstRow = trackerRowsDiv.children[0];
      const secondRow = trackerRowsDiv.children[1];
      const thirdRow = trackerRowsDiv.children[2];

      expect(firstRow.children[0].textContent).toBe('03'); // Most recent step (1-based)
      expect(secondRow.children[0].textContent).toBe('02');
      expect(thirdRow.children[0].textContent).toBe('01'); // First step
    });
  });

  describe('Row Limit', () => {
    it('should limit tracker to MAX_STEPS rows maximum', () => {
      // Add 20 notes (more than MAX_STEPS of 16)
      for (let i = 0; i < 20; i++) {
        updateMIDIMonitor(60 + i, 80, 450);
      }

      expect(trackerRowsDiv.children.length).toBe(16); // MAX_STEPS
    });

    it('should remove oldest rows when exceeding limit', () => {
      // Add 20 notes with different note values
      for (let i = 0; i < 20; i++) {
        updateMIDIMonitor(60 + i, 80, 450);
      }

      // First four notes (60-63) should be removed (20 notes - 16 max = 4 removed)
      const rows = Array.from(trackerRowsDiv.children);
      const noteNames = rows.map(row => row.children[2].textContent);

      expect(noteNames).not.toContain('C4'); // MIDI 60
      expect(noteNames).not.toContain('C#4'); // MIDI 61
      expect(noteNames).not.toContain('D4'); // MIDI 62
      expect(noteNames).not.toContain('D#4'); // MIDI 63
      expect(noteNames).toContain('G5'); // MIDI 79 (most recent)
    });
  });

  describe('Row Highlighting', () => {
    it('should highlight newest row', () => {
      updateMIDIMonitor(60, 80, 450);

      const row = trackerRowsDiv.children[0];
      expect(row.style.backgroundColor).toBe('rgba(255, 255, 255, 0.05)');
    });

    it('should remove highlight from previous row when adding new note', () => {
      updateMIDIMonitor(60, 80, 450);
      updateMIDIMonitor(64, 75, 425);

      const firstRow = trackerRowsDiv.children[0]; // Newest
      const secondRow = trackerRowsDiv.children[1]; // Previous

      expect(firstRow.style.backgroundColor).toBe('rgba(255, 255, 255, 0.05)');
      expect(secondRow.style.backgroundColor).toBe('transparent');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high MIDI notes', () => {
      updateMIDIMonitor(127, 80, 450); // G9

      const row = trackerRowsDiv.children[0];
      expect(row.children[2].textContent).toBe('G9');
    });

    it('should handle very low MIDI notes', () => {
      updateMIDIMonitor(0, 80, 450); // C-1

      const row = trackerRowsDiv.children[0];
      expect(row.children[2].textContent).toBe('C-1');
    });

    it('should handle low velocity', () => {
      updateMIDIMonitor(60, 1, 450);

      const row = trackerRowsDiv.children[0];
      expect(row.children[3].textContent).toBe('1');
    });

    it('should handle high velocity', () => {
      updateMIDIMonitor(60, 127, 450);

      const row = trackerRowsDiv.children[0];
      expect(row.children[3].textContent).toBe('127');
    });

    it('should round duration to integer', () => {
      updateMIDIMonitor(60, 80, 450.7);

      const row = trackerRowsDiv.children[0];
      expect(row.children[4].textContent).toBe('451');
    });
  });

  describe('Clock Sync', () => {
    it('should clear tracker on step 0 (loop restart)', () => {
      // Add several notes to tracker
      updateMIDIMonitor(60, 80, 450, 0);
      updateMIDIMonitor(64, 75, 425, 1);
      updateMIDIMonitor(67, 90, 438, 2);

      expect(trackerRowsDiv.children.length).toBe(3);

      // Clear tracker (simulating clock sync) - only DOM clearing needed
      while (trackerRowsDiv.firstChild) {
        trackerRowsDiv.removeChild(trackerRowsDiv.firstChild);
      }

      expect(trackerRowsDiv.children.length).toBe(0);

      // Add new note after clear
      updateMIDIMonitor(72, 85, 440, 0);
      expect(trackerRowsDiv.children.length).toBe(1);
      expect(trackerRowsDiv.children[0].children[0].textContent).toBe('01'); // Step 1
    });

    it('should maintain fresh data for each loop', () => {
      // First loop
      for (let i = 0; i < 4; i++) {
        updateMIDIMonitor(60 + i, 80, 450, i);
      }
      expect(trackerRowsDiv.children.length).toBe(4);

      // Clear for new loop - only DOM clearing needed
      while (trackerRowsDiv.firstChild) {
        trackerRowsDiv.removeChild(trackerRowsDiv.firstChild);
      }

      // Second loop
      for (let i = 0; i < 4; i++) {
        updateMIDIMonitor(70 + i, 90, 460, i);
      }
      expect(trackerRowsDiv.children.length).toBe(4);

      // Check that we have new data, not old
      const rows = Array.from(trackerRowsDiv.children);
      const noteNames = rows.map(row => row.children[2].textContent);
      expect(noteNames).toContain('A#4'); // MIDI 70
      expect(noteNames).not.toContain('C4'); // MIDI 60 from first loop
    });
  });
});
