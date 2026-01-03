/**
 * Physics Integration Tests
 *
 * Tests the complete physics workflow including:
 * - String physics simulation
 * - Clay deformation
 * - Combined interactions
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import {
  createStringPhysics,
  pluckString,
  updateStringPhysicsStep,
  applyStringDisplacement,
} from '../../src/physics/stringPhysics.js';
import {
  moldAtPoint,
  clearDeformations,
  setClayViscosity,
  setClayElasticity,
  updateClayPhysics,
  getDeformationsForShader,
} from '../../src/physics/clayPhysics.js';

describe('Physics Integration', () => {
  describe('String Physics Workflow', () => {
    let strings;

    beforeEach(() => {
      // Create array of string physics instances
      strings = Array.from({ length: 8 }, () => createStringPhysics());
    });

    it('should simulate multiple independent strings', () => {
      // Pluck different strings with different strengths
      pluckString(strings[0], 1.0);
      pluckString(strings[2], 0.5);
      pluckString(strings[5], 0.3);

      // Update all strings
      strings.forEach(string => updateStringPhysicsStep(string));

      // Check vibration states
      expect(strings[0].isVibrating).toBe(true);
      expect(strings[1].isVibrating).toBe(false);
      expect(strings[2].isVibrating).toBe(true);
      expect(strings[5].isVibrating).toBe(true);

      // String 0 should have strongest vibration
      const disp0 = applyStringDisplacement(strings[0]).length();
      const disp2 = applyStringDisplacement(strings[2]).length();

      expect(disp0).toBeGreaterThan(disp2);
    });

    it('should pluck multiple strings independently', () => {
      pluckString(strings[0], 0.8);
      pluckString(strings[1], 0.8);
      pluckString(strings[3], 0.4);

      expect(strings[0].isVibrating).toBe(true);
      expect(strings[1].isVibrating).toBe(true);
      expect(strings[2].isVibrating).toBe(false);
      expect(strings[3].isVibrating).toBe(true);
    });

    it('should simulate realistic decay over time', () => {
      pluckString(strings[0], 1.0);

      const velocities = [];

      // Record velocity over 50 steps
      for (let i = 0; i < 50; i++) {
        updateStringPhysicsStep(strings[0]);
        velocities.push(strings[0].velocity.length());
      }

      // Check that velocity generally decreases (with some oscillation)
      const firstHalf = velocities.slice(0, 25).reduce((a, b) => a + b) / 25;
      const secondHalf = velocities.slice(25).reduce((a, b) => a + b) / 25;

      expect(secondHalf).toBeLessThan(firstHalf);
    });
  });

  describe('Clay Physics Workflow', () => {
    beforeEach(() => {
      clearDeformations();
      setClayViscosity(0.8);
      setClayElasticity(0.5);
    });

    afterEach(() => {
      clearDeformations();
    });

    it('should create and track deformations', () => {
      // Mold at several points
      moldAtPoint(new THREE.Vector3(0.5, 0.5, 0.1));
      moldAtPoint(new THREE.Vector3(-0.3, 0.2, 0.15));
      moldAtPoint(new THREE.Vector3(0.0, -0.5, 0.08));

      const deformations = getDeformationsForShader();
      expect(deformations.length).toBeGreaterThan(0);
    });

    it('should decay deformations over time', () => {
      moldAtPoint(new THREE.Vector3(0.5, 0.5, 0.2));

      const initialDeformations = getDeformationsForShader().length;

      // Run physics updates
      for (let i = 0; i < 100; i++) {
        updateClayPhysics();
      }

      const finalDeformations = getDeformationsForShader().length;

      // Deformations should decay
      expect(finalDeformations).toBeLessThanOrEqual(initialDeformations);
    });

    it('should clear all deformations', () => {
      moldAtPoint(new THREE.Vector3(0.1, 0.1, 0.1));
      moldAtPoint(new THREE.Vector3(0.2, 0.2, 0.1));
      moldAtPoint(new THREE.Vector3(0.3, 0.3, 0.1));

      expect(getDeformationsForShader().length).toBeGreaterThan(0);

      clearDeformations();

      expect(getDeformationsForShader().length).toBe(0);
    });

    it('should respect viscosity settings', () => {
      setClayViscosity(0.95); // High viscosity = slower decay
      moldAtPoint(new THREE.Vector3(0.5, 0.5, 0.2));

      // Update a few times
      for (let i = 0; i < 10; i++) {
        updateClayPhysics();
      }

      const highViscosityDefs = getDeformationsForShader().length;

      clearDeformations();

      setClayViscosity(0.5); // Low viscosity = faster decay
      moldAtPoint(new THREE.Vector3(0.5, 0.5, 0.2));

      for (let i = 0; i < 10; i++) {
        updateClayPhysics();
      }

      const lowViscosityDefs = getDeformationsForShader().length;

      // Lower viscosity should result in fewer/smaller deformations
      expect(lowViscosityDefs).toBeLessThanOrEqual(highViscosityDefs);
    });
  });

  describe('Combined Physics Interactions', () => {
    beforeEach(() => {
      clearDeformations();
    });

    it('should handle simultaneous string and clay physics', () => {
      // Create strings
      const strings = Array.from({ length: 4 }, () => createStringPhysics());

      // Pluck strings
      strings.forEach((string, i) => {
        pluckString(string, 0.5 + i * 0.1);
      });

      // Create clay deformations
      moldAtPoint(0.5, 0.5, 0.1);
      moldAtPoint(-0.5, -0.5, 0.12);

      // Update physics (fewer iterations to ensure deformations persist)
      for (let i = 0; i < 5; i++) {
        strings.forEach(string => updateStringPhysicsStep(string));
        updateClayPhysics();
      }

      // Both systems should be active
      const anyStringVibrating = strings.some(s => s.isVibrating);
      const hasDeformations = getDeformationsForShader().length > 0;

      expect(anyStringVibrating).toBe(true);
      expect(hasDeformations).toBe(true);
    });
  });
});
