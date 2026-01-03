/**
 * Scales Module Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setScaleEnabled,
  isScaleEnabled,
  setRootNote,
  getRootNote,
  setScaleIntervals,
  getScaleIntervals,
  scaleDegreeToMidiNote,
  SCALE_PRESETS,
} from '../../src/utils/scales.js';

describe('Scales', () => {
  beforeEach(() => {
    setScaleEnabled(true);
    setRootNote(60); // Middle C
    setScaleIntervals(SCALE_PRESETS.Major); // Major scale
  });

  describe('Scale Enable/Disable', () => {
    it('should enable and disable scale', () => {
      setScaleEnabled(true);
      expect(isScaleEnabled()).toBe(true);

      setScaleEnabled(false);
      expect(isScaleEnabled()).toBe(false);
    });
  });

  describe('Root Note', () => {
    it('should set and get root note', () => {
      setRootNote(60);
      expect(getRootNote()).toBe(60);

      setRootNote(48);
      expect(getRootNote()).toBe(48);
    });

    it('should accept valid MIDI note range', () => {
      setRootNote(0);
      expect(getRootNote()).toBe(0);

      setRootNote(127);
      expect(getRootNote()).toBe(127);
    });
  });

  describe('Scale Intervals', () => {
    it('should set and get scale intervals', () => {
      const majorScale = [0, 2, 4, 5, 7, 9, 11];
      setScaleIntervals(majorScale);
      expect(getScaleIntervals()).toEqual(majorScale);
    });

    it('should support different scale presets', () => {
      const scales = [
        SCALE_PRESETS.Major,
        SCALE_PRESETS.Minor,
        SCALE_PRESETS.Dorian,
        SCALE_PRESETS.Phrygian,
        SCALE_PRESETS.Lydian,
        SCALE_PRESETS.Mixolydian,
        SCALE_PRESETS.Aeolian,
        SCALE_PRESETS.Locrian,
      ];

      scales.forEach(scale => {
        setScaleIntervals(scale);
        expect(getScaleIntervals()).toEqual(scale);
      });
    });
  });

  describe('Scale Degree to MIDI Note', () => {
    it('should map scale degrees to MIDI notes in major scale', () => {
      setRootNote(60); // C
      setScaleIntervals(SCALE_PRESETS.Major);

      expect(scaleDegreeToMidiNote(0)).toBe(60); // C
      expect(scaleDegreeToMidiNote(1)).toBe(62); // D
      expect(scaleDegreeToMidiNote(2)).toBe(64); // E
      expect(scaleDegreeToMidiNote(3)).toBe(65); // F
      expect(scaleDegreeToMidiNote(4)).toBe(67); // G
      expect(scaleDegreeToMidiNote(5)).toBe(69); // A
      expect(scaleDegreeToMidiNote(6)).toBe(71); // B
    });

    it('should handle octave wrapping', () => {
      setRootNote(60);
      setScaleIntervals(SCALE_PRESETS.Major);

      // Degree 7 should wrap to next octave (C5)
      expect(scaleDegreeToMidiNote(7)).toBe(72);
    });

    it('should work with different root notes', () => {
      setScaleIntervals(SCALE_PRESETS.Major);

      setRootNote(48); // C3
      expect(scaleDegreeToMidiNote(0)).toBe(48);

      setRootNote(72); // C5
      expect(scaleDegreeToMidiNote(0)).toBe(72);
    });

    it('should map degrees in minor scale correctly', () => {
      setRootNote(60);
      setScaleIntervals(SCALE_PRESETS.Minor);

      expect(scaleDegreeToMidiNote(0)).toBe(60); // C
      expect(scaleDegreeToMidiNote(1)).toBe(62); // D
      expect(scaleDegreeToMidiNote(2)).toBe(63); // Eb
      expect(scaleDegreeToMidiNote(3)).toBe(65); // F
      expect(scaleDegreeToMidiNote(4)).toBe(67); // G
      expect(scaleDegreeToMidiNote(5)).toBe(68); // Ab
      expect(scaleDegreeToMidiNote(6)).toBe(70); // Bb
    });
  });

  describe('Scale Presets', () => {
    it('should have major scale intervals', () => {
      expect(SCALE_PRESETS.Major).toEqual([0, 2, 4, 5, 7, 9, 11]);
    });

    it('should have natural minor scale intervals', () => {
      expect(SCALE_PRESETS.Minor).toEqual([0, 2, 3, 5, 7, 8, 10]);
    });

    it('should have pentatonic scale intervals', () => {
      expect(SCALE_PRESETS.MajorPentatonic).toEqual([0, 2, 4, 7, 9]);
      expect(SCALE_PRESETS.MinorPentatonic).toEqual([0, 3, 5, 7, 10]);
    });

    it('should have chromatic scale intervals', () => {
      expect(SCALE_PRESETS.Chromatic).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    });
  });

  describe('Custom Scales', () => {
    it('should accept custom scale intervals', () => {
      const customScale = [0, 1, 4, 6, 7, 10]; // Custom hexatonic
      setScaleIntervals(customScale);

      expect(getScaleIntervals()).toEqual(customScale);
      expect(scaleDegreeToMidiNote(0)).toBe(60);
      expect(scaleDegreeToMidiNote(1)).toBe(61);
      expect(scaleDegreeToMidiNote(2)).toBe(64);
    });
  });
});
