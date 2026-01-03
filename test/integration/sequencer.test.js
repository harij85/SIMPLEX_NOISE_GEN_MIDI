/**
 * Sequencer Integration Tests
 *
 * Tests the complete sequencer workflow including:
 * - MIDI initialization
 * - Step parameters
 * - Sequencer start/stop
 * - Note scheduling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initMIDI, sendMIDIMessage } from '../../src/midi/midiIO.js';
import {
  setBPM,
  setTimeSig,
  getStepMS,
  setNumSteps,
} from '../../src/sequencer/scheduler.js';
import {
  initStepParameters,
  setStepActive,
  setStepVelocity,
  getStepParameter,
} from '../../src/sequencer/stepParameters.js';
import {
  startSequencer,
  stopSequencer,
  isSequencerRunning,
} from '../../src/sequencer/sequencer.js';

describe('Sequencer Integration', () => {
  beforeEach(async () => {
    // Initialize MIDI
    await initMIDI();

    // Set up sequencer parameters
    setBPM(120);
    setTimeSig([4, 4]);
    setNumSteps(4); // One step per beat for timing tests
    initStepParameters(16);
  });

  describe('MIDI Output', () => {
    it('should initialize MIDI successfully', async () => {
      const result = await initMIDI();
      expect(result).toBe(true);
    });

    it('should send MIDI messages', () => {
      const noteOn = [0x90, 60, 100]; // Note On, Middle C, velocity 100
      expect(() => sendMIDIMessage(noteOn)).not.toThrow();
    });

    it('should send MIDI messages with timestamp', () => {
      const noteOn = [0x90, 60, 100];
      const timestamp = performance.now() + 100;
      expect(() => sendMIDIMessage(noteOn, timestamp)).not.toThrow();
    });
  });

  describe('Sequencer Lifecycle', () => {
    it('should start and stop sequencer', () => {
      expect(isSequencerRunning()).toBe(false);

      startSequencer();
      expect(isSequencerRunning()).toBe(true);

      stopSequencer();
      expect(isSequencerRunning()).toBe(false);
    });

    it('should not start if already running', () => {
      startSequencer();
      const firstState = isSequencerRunning();

      startSequencer(); // Try to start again
      const secondState = isSequencerRunning();

      expect(firstState).toBe(true);
      expect(secondState).toBe(true);

      stopSequencer();
    });
  });

  describe('Step Configuration', () => {
    it('should activate and deactivate steps', () => {
      setStepActive(0, false);
      expect(getStepParameter(0).active).toBe(false);

      setStepActive(0, true);
      expect(getStepParameter(0).active).toBe(true);
    });

    it('should set velocity per step', () => {
      setStepVelocity(0, 100);
      setStepVelocity(1, 50);
      setStepVelocity(2, 127);

      expect(getStepParameter(0).velocity).toBe(100);
      expect(getStepParameter(1).velocity).toBe(50);
      expect(getStepParameter(2).velocity).toBe(127);
    });

    it('should create pattern with active and inactive steps', () => {
      // Create a pattern: X . X . X . X . (kick drum pattern)
      for (let i = 0; i < 16; i++) {
        setStepActive(i, i % 2 === 0);
      }

      expect(getStepParameter(0).active).toBe(true);
      expect(getStepParameter(1).active).toBe(false);
      expect(getStepParameter(2).active).toBe(true);
      expect(getStepParameter(3).active).toBe(false);
    });
  });

  describe('Timing Calculations', () => {
    it('should calculate correct step duration at 120 BPM', () => {
      setBPM(120);
      const stepMs = getStepMS();
      expect(stepMs).toBeCloseTo(500, 1);
    });

    it('should adapt to BPM changes', () => {
      setBPM(60);
      const slowStepMs = getStepMS();

      setBPM(240);
      const fastStepMs = getStepMS();

      expect(slowStepMs).toBeGreaterThan(fastStepMs);
      expect(slowStepMs).toBeCloseTo(1000, 1);
      expect(fastStepMs).toBeCloseTo(250, 1);
    });

    it('should respect time signature', () => {
      setBPM(120);

      setTimeSig([4, 4]);
      setNumSteps(4);
      const stepMs_4_4 = getStepMS();

      setTimeSig([3, 4]);
      setNumSteps(3); // Adjust steps to match time signature numerator
      const stepMs_3_4 = getStepMS();

      // Step duration should be the same (quarter note) when steps match beats
      expect(stepMs_4_4).toBeCloseTo(stepMs_3_4, 1);
    });
  });

  describe('Complete Workflow', () => {
    it('should execute full sequencer workflow', () => {
      // 1. Initialize sequencer
      initStepParameters(8);

      // 2. Configure pattern
      setStepActive(0, true);
      setStepActive(1, false);
      setStepActive(2, true);
      setStepActive(3, false);
      setStepActive(4, true);
      setStepActive(5, true);
      setStepActive(6, false);
      setStepActive(7, true);

      // 3. Set velocities
      setStepVelocity(0, 127);
      setStepVelocity(2, 100);
      setStepVelocity(4, 80);
      setStepVelocity(5, 60);
      setStepVelocity(7, 100);

      // 4. Set tempo
      setBPM(128);

      // 5. Start sequencer
      startSequencer();
      expect(isSequencerRunning()).toBe(true);

      // 6. Stop sequencer
      stopSequencer();
      expect(isSequencerRunning()).toBe(false);
    });
  });
});
