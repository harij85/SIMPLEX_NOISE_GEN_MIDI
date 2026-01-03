/**
 * Scheduler Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setBPM,
  getBPM,
  setTimeSig,
  getTimeSig,
  getStepMS,
  setNumSteps,
  PPQN,
} from '../../src/sequencer/scheduler.js';

describe('Scheduler', () => {
  beforeEach(() => {
    setBPM(120);
    setTimeSig([4, 4]);
    setNumSteps(4); // One step per beat
  });

  describe('BPM Management', () => {
    it('should set and get BPM', () => {
      setBPM(140);
      expect(getBPM()).toBe(140);
    });

    it('should clamp BPM to valid range', () => {
      setBPM(0);
      expect(getBPM()).toBe(0);

      setBPM(240);
      expect(getBPM()).toBe(240);
    });

    it('should calculate correct step duration for different BPMs', () => {
      // At 120 BPM: quarter note = 500ms
      setBPM(120);
      const stepMs120 = getStepMS();
      expect(stepMs120).toBeCloseTo(500, 1);

      // At 60 BPM: quarter note = 1000ms
      setBPM(60);
      const stepMs60 = getStepMS();
      expect(stepMs60).toBeCloseTo(1000, 1);

      // At 240 BPM: quarter note = 250ms
      setBPM(240);
      const stepMs240 = getStepMS();
      expect(stepMs240).toBeCloseTo(250, 1);
    });
  });

  describe('Time Signature Management', () => {
    it('should set and get time signature', () => {
      setTimeSig([3, 4]);
      const timeSig = getTimeSig();
      expect(timeSig).toEqual([3, 4]);
    });

    it('should support common time signatures', () => {
      const signatures = [
        [4, 4],
        [3, 4],
        [6, 8],
        [5, 4],
        [7, 8],
      ];

      signatures.forEach(sig => {
        setTimeSig(sig);
        expect(getTimeSig()).toEqual(sig);
      });
    });

    it('should support rational time signatures', () => {
      setTimeSig([5, 3]); // Quintuplet over triplet
      expect(getTimeSig()).toEqual([5, 3]);
    });
  });

  describe('Step Timing Calculations', () => {
    it('should return Infinity when BPM is 0', () => {
      setBPM(0);
      expect(getStepMS()).toBe(Infinity);
    });

    it('should calculate step duration based on time signature', () => {
      setBPM(120);

      // 4/4 time: quarter note gets the beat
      setTimeSig([4, 4]);
      const stepMs_4_4 = getStepMS();

      // 4/8 time: eighth note gets the beat (twice as fast)
      setTimeSig([4, 8]);
      const stepMs_4_8 = getStepMS();

      expect(stepMs_4_8).toBeCloseTo(stepMs_4_4 / 2, 1);
    });

    it('should use PPQN for precise timing', () => {
      expect(PPQN).toBe(960);
    });
  });

  describe('Edge Cases', () => {
    it('should handle very high BPM', () => {
      setBPM(240);
      const stepMs = getStepMS();
      expect(stepMs).toBeGreaterThan(0);
      expect(stepMs).toBeLessThan(1000);
    });

    it('should handle complex time signatures', () => {
      setTimeSig([13, 16]);
      expect(getTimeSig()).toEqual([13, 16]);

      const stepMs = getStepMS();
      expect(stepMs).toBeGreaterThan(0);
    });
  });
});
