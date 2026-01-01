/**
 * Global Constants and Default Values
 * 3D Noise MIDI Instrument
 */

// MIDI Configuration
export const MIDI_CONFIG = {
  MIN_NOTE: 12,
  MAX_NOTE: 84,
  PPQN: 960, // Pulses per quarter note
  DEFAULT_VELOCITY: 80,
};

// Sequencer Defaults
export const SEQUENCER_DEFAULTS = {
  BPM: 120,
  STEPS: 16,
  TIME_SIG_NUM: 4,
  TIME_SIG_DEN: 4,
  MAX_STEPS: 32,
  MIN_STEPS: 4,
};

// Scene Configuration
export const SCENE_CONFIG = {
  SPHERE_RADIUS: 1.0,
  SPHERE_SEGMENTS: 128,
  BEACON_HEIGHT: 0.3,
  BEACON_RADIUS: 0.03,
  TUBE_RADIUS: 0.008,
  TUBE_SEGMENTS: 20,
  TUBE_RADIAL_SEGMENTS: 8,
};

// Noise Defaults
export const NOISE_DEFAULTS = {
  SPATIAL_SCALE: 0.5,
  TIME_SCALE: 0.3,
  DISPLACEMENT_AMOUNT: 0.3,
  DEFAULT_TYPE: 'simplex',
};

// Physics Constants
export const PHYSICS_CONSTANTS = {
  STRING_STIFFNESS: 0.3,
  STRING_DAMPENING: 0.95,
  CLAY_VISCOSITY: 0.92,
  CLAY_ELASTICITY: 0.05,
  CLAY_PUSH_STRENGTH: 0.15,
  CLAY_BRUSH_SIZE: 0.3,
  POSITION_SMOOTHING: 0.15,
};

// Color Gradient Defaults
export const COLOR_DEFAULTS = {
  COLOR_1: { r: 0.05, g: 0.05, b: 0.4, a: 1.0 },
  COLOR_2: { r: 0.0, g: 0.4, b: 0.9, a: 1.0 },
  COLOR_3: { r: 0.0, g: 0.8, b: 0.7, a: 1.0 },
  COLOR_4: { r: 1.0, g: 0.8, b: 0.1, a: 1.0 },
  COLOR_5: { r: 1.0, g: 0.3, b: 0.6, a: 1.0 },
};

// Lighting Configuration
export const LIGHTING_CONFIG = {
  AMBIENT_INTENSITY: 0.25,
  AMBIENT_COLOR: 0x404060,
  POINT_LIGHT_INTENSITY: 1.5,
  POINT_LIGHT_DISTANCE: 2.0,
  POINT_LIGHT_DECAY: 2.0,
  POINT_LIGHT_COLOR: 0xffffff,
};

// Sensor Configuration
export const SENSOR_CONFIG = {
  DISTRIBUTION: 0.0, // 0 = line, 1 = chaos
  ANIMATION_SPEED: 0.0,
  GOLDEN_RATIO: (1 + Math.sqrt(5)) / 2,
};

// Camera Configuration
export const CAMERA_CONFIG = {
  FOV: 50,
  NEAR: 0.1,
  FAR: 100,
  POSITION_Z: 3,
};

// Pitch Bend Limits
export const PITCH_BEND_LIMITS = {
  MAX_BEND_AMOUNT: 0.05,
  MAX_DISPLACEMENT: 0.2,
  SENSITIVITY: 0.05,
};
