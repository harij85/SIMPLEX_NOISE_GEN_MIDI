# State Management Architecture

## Overview

This application uses a **hybrid state management approach** that combines multiple patterns for optimal modularity, maintainability, and performance.

## State Management Patterns

### 1. Module-Local Encapsulated State

Each module manages its own internal state using private variables and exposes controlled access through public functions.

**Example: [src/midi/midiIO.js](src/midi/midiIO.js)**
```javascript
// Private state - not exported
let midiOutput = null;
let midiInput = null;
let isReady = false;

// Public API - controlled access
export function getMIDIOutput() {
  return midiOutput;
}

export function isMIDIReady() {
  return isReady;
}
```

**Benefits:**
- Encapsulation prevents external code from breaking internal state
- Clear API boundaries
- Easy to test in isolation
- Prevents naming conflicts

**Used in:**
- MIDI modules (device references, connection state)
- Physics modules (deformation arrays, physics parameters)
- Sequencer modules (timing state, step data)
- Scene modules (Three.js objects, light arrays)

### 2. Global State Module

Cross-cutting state that needs to be accessed by multiple modules is centralized in [src/config/globalState.js](src/config/globalState.js).

**State Categories:**
```javascript
const state = {
  // Sequencer
  numSteps: 16,
  currentStep: 0,
  stepStartTime: 0,

  // Sensor configuration
  sensorDistribution: 0.0,
  sensorAnimationSpeed: 0.0,

  // Noise parameters
  currentNoiseType: 'simplex',

  // Time
  time: 0.0,

  // Mouse interaction
  mouse: {
    x: 0,
    y: 0,
    normalized: { x: 0, y: 0 }
  },

  // Active interactions
  activeString: null,

  // UI state
  editingStep: null
};
```

**Access Pattern - Getter/Setter:**
```javascript
export function getNumSteps() {
  return state.numSteps;
}

export function setNumSteps(steps) {
  state.numSteps = Math.max(
    SEQUENCER_DEFAULTS.MIN_STEPS,
    Math.min(SEQUENCER_DEFAULTS.MAX_STEPS, steps)
  );
}
```

**Benefits:**
- Single source of truth for shared state
- Validation logic in setters
- Easy to debug (all state in one place)
- Prevents accidental corruption

**Used for:**
- Sequencer state (current step, number of steps)
- Sensor animation parameters
- Global time tracking
- Mouse position tracking
- Active interaction tracking

### 3. Callback-Based Communication

Modules communicate through registered callback functions, enabling loose coupling.

**Example: MIDI Handler Callbacks**

[src/midi/midiHandlers.js](src/midi/midiHandlers.js) defines callbacks:
```javascript
let onNoteOnCallback = null;
let onNoteOffCallback = null;
let onPitchBendCallback = null;

export function setNoteOnCallback(callback) {
  onNoteOnCallback = callback;
}

export function handleMIDINoteOn(note, velocity) {
  const sensorIndex = mapNoteToSensorCallback(note);
  addActiveNote(note, velocity, sensorIndex);

  if (onNoteOnCallback) {
    onNoteOnCallback(note, velocity, sensorIndex);
  }

  sendMIDIMessage([0x90, note, velocity]);
}
```

[src/main.js](src/main.js) wires them together:
```javascript
import { setNoteOnCallback } from './midi/midiHandlers.js';
import { pluckString } from './physics/stringPhysics.js';
import { highlightBeacon } from './scene/sensors.js';

setNoteOnCallback((note, velocity, sensorIndex) => {
  pluckString(sensorIndex, velocity);
  highlightBeacon(sensorIndex);
});
```

**Benefits:**
- Loose coupling - modules don't import each other
- Easy to add new behaviors
- Main app orchestrates interactions
- Testable with mock callbacks

**Used for:**
- MIDI event handling (note on/off, pitch bend, CC)
- Sequencer events (step changes, note scheduling)
- Physics updates (string plucking, clay molding)
- UI interactions (mouse events, keyboard shortcuts)

### 4. Event-Driven UI

DOM events trigger module functions directly, keeping UI concerns separate.

**Example: UI Event Handling**
```javascript
import { setBPM } from './sequencer/scheduler.js';
import { setNumSteps } from './config/globalState.js';
import { updateStepGrid } from './ui/stepGrid.js';

// BPM slider
document.getElementById('bpm-slider').addEventListener('input', (e) => {
  const bpm = parseFloat(e.target.value);
  setBPM(bpm);
  document.getElementById('bpm-display').textContent = bpm;
});

// Step count
document.getElementById('steps-slider').addEventListener('input', (e) => {
  const steps = parseInt(e.target.value);
  setNumSteps(steps);
  updateStepGrid(steps);
});
```

**Benefits:**
- Clear separation of UI and logic
- Easy to change UI without touching modules
- Modules remain UI-agnostic
- Can be tested without DOM

### 5. Constants Configuration

Immutable configuration values centralized in [src/config/constants.js](src/config/constants.js).

```javascript
export const MIDI_CONFIG = {
  MIN_NOTE: 12,
  MAX_NOTE: 84,
  PPQN: 960,
  DEFAULT_VELOCITY: 80,
};

export const SEQUENCER_DEFAULTS = {
  BPM: 120,
  STEPS: 16,
  MIN_STEPS: 4,
  MAX_STEPS: 32,
};
```

**Benefits:**
- Easy to modify application defaults
- Self-documenting configuration
- Type safety through constants
- Prevents magic numbers

## State Flow Diagram

```
User Input
    |
    v
Event Handler (main.js)
    |
    v
Global State Setter (globalState.js)
    |
    v
Module-Local Update (module state)
    |
    v
Callback Trigger (registered callbacks)
    |
    v
Cross-Module Effects (via callbacks)
    |
    v
Render/Output
```

## State Management Decision Rationale

### Why Not Redux/Zustand/MobX?

**Considerations:**
- This is a real-time audio-visual application, not a traditional web app
- State changes happen at 60fps+ (animation loop)
- MIDI timing requires sub-millisecond precision
- GPU shader uniforms need direct object references

**Our Approach:**
- Minimal overhead for performance-critical paths
- Direct memory access for Three.js objects
- Synchronous state updates for timing accuracy
- No serialization overhead
- Smaller bundle size

### Why Hybrid Instead of Single Pattern?

**Different state types have different needs:**

| State Type | Pattern | Reason |
|------------|---------|--------|
| Three.js objects | Module-local | Direct GPU memory references |
| MIDI devices | Module-local | Browser API handles |
| Physics arrays | Module-local | High-frequency updates |
| Current step | Global getter/setter | Shared across modules |
| UI state | Global getter/setter | Synchronized UI updates |
| Cross-module events | Callbacks | Loose coupling |
| Configuration | Constants | Immutable defaults |

## Best Practices

### When to Use Each Pattern

**Use Module-Local State when:**
- State is only used within one module
- State needs high-frequency updates
- State holds object references (Three.js, DOM)
- State is implementation detail

**Use Global State when:**
- State is accessed by 3+ modules
- State needs centralized validation
- State represents application-level concerns
- State needs debugging visibility

**Use Callbacks when:**
- One module triggers actions in another
- Multiple modules need to respond to events
- You want to avoid circular dependencies
- Behavior might change at runtime

**Use Constants when:**
- Values are configuration defaults
- Values never change during runtime
- Values are used across multiple modules
- Values need documentation

## Migration Notes

### From Monolithic to Modular

**Before (Monolithic):**
```javascript
let numSteps = 16;
let currentStep = 0;
let midiOutput = null;
// ... 200+ global variables
```

**After (Modular):**
```javascript
// src/config/globalState.js
const state = { numSteps: 16, currentStep: 0 };
export function getNumSteps() { return state.numSteps; }

// src/midi/midiIO.js
let midiOutput = null; // Module-local
export function getMIDIOutput() { return midiOutput; }
```

**Benefits Achieved:**
- Reduced global namespace pollution from 200+ to ~10 exported functions
- Clear ownership of state
- Easier to track state changes
- Better IDE autocomplete

## Testing Strategy

### Module-Local State
```javascript
// Easy to test with fresh state per test
import { initMIDI, getMIDIOutput } from './midi/midiIO.js';

test('MIDI initialization', async () => {
  await initMIDI();
  expect(getMIDIOutput()).toBeDefined();
});
```

### Global State
```javascript
// Reset between tests
import { setNumSteps, getNumSteps } from './config/globalState.js';

beforeEach(() => {
  setNumSteps(16); // Reset to default
});

test('step count validation', () => {
  setNumSteps(100); // Over max
  expect(getNumSteps()).toBe(32); // Clamped
});
```

### Callbacks
```javascript
// Mock callbacks for testing
import { setNoteOnCallback, handleMIDINoteOn } from './midi/midiHandlers.js';

test('note on callback', () => {
  const mockCallback = jest.fn();
  setNoteOnCallback(mockCallback);

  handleMIDINoteOn(60, 100);

  expect(mockCallback).toHaveBeenCalledWith(60, 100, expect.any(Number));
});
```

## Summary

This hybrid state management approach provides:

- **Performance**: Minimal overhead for real-time audio-visual processing
- **Maintainability**: Clear ownership and boundaries
- **Testability**: Isolated modules with mockable interfaces
- **Scalability**: Easy to add new modules without refactoring existing ones
- **Debuggability**: Centralized state inspection via globalState.js
- **Type Safety**: Validation in setters, constants for configuration

The architecture balances modern software engineering practices with the performance requirements of a real-time interactive application.
