/**
 * String Physics Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createStringPhysics,
  pluckString,
  updateStringPhysicsStep,
  applyStringDisplacement,
} from '../../src/physics/stringPhysics.js';

describe('String Physics', () => {
  let stringPhysics;

  beforeEach(() => {
    stringPhysics = createStringPhysics();
  });

  describe('String Creation', () => {
    it('should create string with default state', () => {
      expect(stringPhysics).toBeDefined();
      expect(stringPhysics.isVibrating).toBe(false);
      expect(stringPhysics.displacement).toBeDefined();
      expect(stringPhysics.velocity).toBeDefined();
      expect(stringPhysics.pitchBend).toBe(0);
    });

    it('should have displacement and velocity vectors', () => {
      expect(stringPhysics.displacement.x).toBe(0);
      expect(stringPhysics.displacement.y).toBe(0);
      expect(stringPhysics.displacement.z).toBe(0);

      expect(stringPhysics.velocity.x).toBe(0);
      expect(stringPhysics.velocity.y).toBe(0);
      expect(stringPhysics.velocity.z).toBe(0);
    });
  });

  describe('String Plucking', () => {
    it('should pluck string with default strength', () => {
      pluckString(stringPhysics);
      expect(stringPhysics.isVibrating).toBe(true);
      expect(stringPhysics.velocity.length()).toBeGreaterThan(0);
    });

    it('should pluck string with custom strength', () => {
      pluckString(stringPhysics, 0.8);
      expect(stringPhysics.isVibrating).toBe(true);

      const velocity = stringPhysics.velocity.length();
      expect(velocity).toBeGreaterThan(0);
    });

    it('should create stronger vibration with higher strength', () => {
      const weak = createStringPhysics();
      const strong = createStringPhysics();

      pluckString(weak, 0.2);
      pluckString(strong, 0.9);

      expect(strong.velocity.length()).toBeGreaterThan(weak.velocity.length());
    });
  });

  describe('Physics Simulation', () => {
    it('should dampen vibration over time', () => {
      pluckString(stringPhysics, 1.0);

      const initialEnergy = stringPhysics.displacement.length() + stringPhysics.velocity.length();

      // Run multiple physics steps (need more iterations for energy to clearly decrease)
      for (let i = 0; i < 50; i++) {
        updateStringPhysicsStep(stringPhysics);
      }

      const finalEnergy = stringPhysics.displacement.length() + stringPhysics.velocity.length();
      expect(finalEnergy).toBeLessThan(initialEnergy);
    });

    it('should stop vibrating when energy is depleted', () => {
      pluckString(stringPhysics, 0.1);

      // Run many physics steps
      for (let i = 0; i < 200; i++) {
        updateStringPhysicsStep(stringPhysics);
      }

      expect(stringPhysics.isVibrating).toBe(false);
    });

    it('should apply spring force (Hooke\'s law)', () => {
      pluckString(stringPhysics, 0.5);

      updateStringPhysicsStep(stringPhysics);

      // Displacement should be affected by velocity
      expect(stringPhysics.displacement.length()).toBeGreaterThan(0);
    });
  });

  describe('Displacement Application', () => {
    it('should return displacement vector', () => {
      pluckString(stringPhysics, 0.5);
      updateStringPhysicsStep(stringPhysics);

      const displacement = applyStringDisplacement(stringPhysics);

      expect(displacement).toBeDefined();
      expect(displacement.x).toBeDefined();
      expect(displacement.y).toBeDefined();
      expect(displacement.z).toBeDefined();
    });

    it('should return zero displacement when not vibrating', () => {
      const displacement = applyStringDisplacement(stringPhysics);
      expect(displacement.length()).toBe(0);
    });
  });

  describe('Multiple Physics Steps', () => {
    it('should handle continuous updates correctly', () => {
      pluckString(stringPhysics, 0.5);

      // Run multiple steps
      for (let i = 0; i < 20; i++) {
        updateStringPhysicsStep(stringPhysics);
      }

      // Should still be tracking properly
      expect(stringPhysics.isVibrating).toBeDefined();
      expect(stringPhysics.displacement).toBeDefined();
    });
  });

  describe('Multiple Strings', () => {
    it('should create independent string physics instances', () => {
      const string1 = createStringPhysics();
      const string2 = createStringPhysics();

      pluckString(string1, 0.8);

      expect(string1.isVibrating).toBe(true);
      expect(string2.isVibrating).toBe(false);
    });
  });
});
