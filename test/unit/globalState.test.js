/**
 * Global State Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getNumSteps, setNumSteps,
  getCurrentStep, setCurrentStep,
  getBPM, setBPM,
  getTimeSig, setTimeSig,
  getTime, updateTime,
  getMousePosition, setMousePosition,
  getActiveString, setActiveString,
  getEditingStep, setEditingStep,
  getSensorDistribution, setSensorDistribution,
  getSensorAnimationSpeed, setSensorAnimationSpeed,
  getCurrentNoiseType, setCurrentNoiseType,
} from '../../src/config/globalState.js';

describe('Global State', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    setNumSteps(16);
    setCurrentStep(0);
    setBPM(120);
    setTimeSig([4, 4]);
  });

  describe('Step Management', () => {
    it('should get and set number of steps', () => {
      expect(getNumSteps()).toBe(16);
      setNumSteps(32);
      expect(getNumSteps()).toBe(32);
    });

    it('should get and set current step', () => {
      expect(getCurrentStep()).toBe(0);
      setCurrentStep(5);
      expect(getCurrentStep()).toBe(5);
    });

    it('should clamp steps to valid range', () => {
      setNumSteps(4);
      expect(getNumSteps()).toBe(4);
      setNumSteps(32);
      expect(getNumSteps()).toBe(32);
    });
  });

  describe('BPM and Timing', () => {
    it('should get and set BPM', () => {
      expect(getBPM()).toBe(120);
      setBPM(140);
      expect(getBPM()).toBe(140);
    });

    it('should get and set time signature', () => {
      const timeSig = getTimeSig();
      expect(timeSig).toEqual([4, 4]);

      setTimeSig([3, 4]);
      expect(getTimeSig()).toEqual([3, 4]);
    });

    it('should update and retrieve time', () => {
      const initialTime = getTime();
      updateTime(1.0);
      expect(getTime()).toBeGreaterThan(initialTime);
    });
  });

  describe('Mouse and Interaction State', () => {
    it('should track mouse position', () => {
      setMousePosition(100, 200);
      const pos = getMousePosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(200);
    });

    it('should track active string', () => {
      expect(getActiveString()).toBe(null);
      setActiveString(5);
      expect(getActiveString()).toBe(5);
      setActiveString(null);
      expect(getActiveString()).toBe(null);
    });

    it('should track editing step', () => {
      expect(getEditingStep()).toBe(null);
      setEditingStep(3);
      expect(getEditingStep()).toBe(3);
    });
  });

  describe('Sensor Configuration', () => {
    it('should get and set sensor distribution', () => {
      setSensorDistribution(0.5);
      expect(getSensorDistribution()).toBe(0.5);

      setSensorDistribution(0.0);
      expect(getSensorDistribution()).toBe(0.0);

      setSensorDistribution(1.0);
      expect(getSensorDistribution()).toBe(1.0);
    });

    it('should get and set sensor animation speed', () => {
      setSensorAnimationSpeed(1.5);
      expect(getSensorAnimationSpeed()).toBe(1.5);
    });
  });

  describe('Noise Type', () => {
    it('should get and set current noise type', () => {
      expect(getCurrentNoiseType()).toBe('simplex');

      setCurrentNoiseType('perlin');
      expect(getCurrentNoiseType()).toBe('perlin');

      setCurrentNoiseType('fbm');
      expect(getCurrentNoiseType()).toBe('fbm');
    });
  });
});
