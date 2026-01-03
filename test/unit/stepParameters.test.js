/**
 * Step Parameters Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  initStepParameters,
  getStepParameters,
  getStepParameter,
  setStepActive,
  setStepDotted,
  setStepTie,
  setStepScaleDegree,
  setStepVelocity,
} from '../../src/sequencer/stepParameters.js';

describe('Step Parameters', () => {
  beforeEach(() => {
    // Initialize with 8 steps for testing
    initStepParameters(8);
  });

  describe('Initialization', () => {
    it('should initialize parameters for all steps', () => {
      const params = getStepParameters();
      expect(params).toHaveLength(8);

      params.forEach(param => {
        expect(param).toHaveProperty('active', true);
        expect(param).toHaveProperty('dotted', false);
        expect(param).toHaveProperty('tie', false);
        expect(param).toHaveProperty('scaleDegree', null);
        expect(param).toHaveProperty('velocity', null);
      });
    });

    it('should get individual step parameter', () => {
      const param = getStepParameter(0);
      expect(param.active).toBe(true);
      expect(param.dotted).toBe(false);
    });
  });

  describe('Step Active State', () => {
    it('should toggle step active state', () => {
      setStepActive(0, false);
      expect(getStepParameter(0).active).toBe(false);

      setStepActive(0, true);
      expect(getStepParameter(0).active).toBe(true);
    });
  });

  describe('Step Dotted Modifier', () => {
    it('should set step dotted modifier', () => {
      setStepDotted(2, true);
      expect(getStepParameter(2).dotted).toBe(true);

      setStepDotted(2, false);
      expect(getStepParameter(2).dotted).toBe(false);
    });
  });

  describe('Step Tie', () => {
    it('should set step tie', () => {
      setStepTie(3, true);
      expect(getStepParameter(3).tie).toBe(true);
    });

    it('should allow consecutive tied steps', () => {
      setStepTie(3, true);
      setStepTie(4, true);
      setStepTie(5, true);

      expect(getStepParameter(3).tie).toBe(true);
      expect(getStepParameter(4).tie).toBe(true);
      expect(getStepParameter(5).tie).toBe(true);
    });
  });

  describe('Scale Degree Override', () => {
    it('should set scale degree override', () => {
      setStepScaleDegree(1, 0); // Root note
      expect(getStepParameter(1).scaleDegree).toBe(0);

      setStepScaleDegree(2, 4); // Fifth
      expect(getStepParameter(2).scaleDegree).toBe(4);
    });

    it('should clear scale degree override', () => {
      setStepScaleDegree(1, 0);
      setStepScaleDegree(1, null);
      expect(getStepParameter(1).scaleDegree).toBe(null);
    });
  });

  describe('Velocity Override', () => {
    it('should set velocity override', () => {
      setStepVelocity(0, 100);
      expect(getStepParameter(0).velocity).toBe(100);

      setStepVelocity(1, 50);
      expect(getStepParameter(1).velocity).toBe(50);
    });

    it('should clamp velocity to MIDI range', () => {
      setStepVelocity(0, 150);
      expect(getStepParameter(0).velocity).toBe(127);

      setStepVelocity(1, -10);
      expect(getStepParameter(1).velocity).toBe(1);
    });
  });

  describe('Parameter Persistence', () => {
    it('should maintain parameters across multiple operations', () => {
      setStepActive(0, false);
      setStepDotted(0, true);
      setStepVelocity(0, 80);

      const param = getStepParameter(0);
      expect(param.active).toBe(false);
      expect(param.dotted).toBe(true);
      expect(param.velocity).toBe(80);
    });
  });
});
