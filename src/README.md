# Modular Source Code

This directory contains the refactored modular architecture for the 3D Noise MIDI Instrument.

## Example Modules (Phase 1)

Three key modules have been created as examples to demonstrate the modular architecture pattern:

### 1. [config/constants.js](config/constants.js)
**Purpose**: Centralized configuration and constants

**What it demonstrates**:
- Exported named constants grouped by domain
- Easy-to-modify configuration values
- Single source of truth for application settings
- No dependencies on other modules

**Usage**:
```javascript
import { MIDI_CONFIG, SCENE_CONFIG } from './config/constants.js';

const minNote = MIDI_CONFIG.MIN_NOTE;
const sphereRadius = SCENE_CONFIG.SPHERE_RADIUS;
```

### 2. [shaders/noiseLibrary.js](shaders/noiseLibrary.js)
**Purpose**: GLSL noise function library

**What it demonstrates**:
- Extracting large string constants into a dedicated module
- Clear separation of shader code from application logic
- Easy to add new noise types without touching main code
- Self-documenting structure (each noise type is clearly labeled)

**Usage**:
```javascript
import { noiseShaderLibrary } from './shaders/noiseLibrary.js';

const shaderCode = noiseShaderLibrary.simplex;
const material = new THREE.ShaderMaterial({
  fragmentShader: shaderCode
});
```

**Contains**:
- Simplex noise
- Perlin noise
- FBM (Fractal Brownian Motion)
- Voronoi noise
- Ridged noise
- Cellular noise

### 3. [midi/midiIO.js](midi/midiIO.js)
**Purpose**: Web MIDI API initialization and device management

**What it demonstrates**:
- Encapsulation of external API interactions
- Clean public interface with clear function names
- Private state (midiOutput, midiInput) not exposed directly
- Separation of concerns (I/O vs message handling)
- Error handling and user feedback

**Usage**:
```javascript
import { initMIDI, sendMIDIMessage, attachMIDIInputHandler } from './midi/midiIO.js';

// Initialize MIDI system
await initMIDI();

// Attach message handler
attachMIDIInputHandler(handleMIDIMessage);

// Send MIDI message
sendMIDIMessage([0x90, 60, 100]); // Note On, Middle C, velocity 100
```

**Public API**:
- `initMIDI()` - Initialize Web MIDI API
- `attachMIDIInputHandler(handler)` - Attach message callback
- `sendMIDIMessage(message)` - Send MIDI output
- `getMIDIOutput()` - Get output device
- `getMIDIInput()` - Get input device
- `isMIDIReady()` - Check initialization status

### 4. [physics/stringPhysics.js](physics/stringPhysics.js)
**Purpose**: Spring-based vibration physics simulation

**What it demonstrates**:
- Encapsulation of complex physics calculations
- State management for multiple objects (strings)
- Clear separation between physics logic and visual rendering
- Well-documented mathematical concepts (Hooke's law)
- Utility functions for common operations

**Usage**:
```javascript
import { pluckString, updateAllStringPhysics, getStringDisplacement } from './physics/stringPhysics.js';

// Pluck a string
pluckString(sensorIndex, velocity, startPos, endPos, totalStrings);

// Update physics in animation loop
updateAllStringPhysics((index, physics, stillVibrating) => {
  if (stillVibrating) {
    updateVisuals(index, physics.displacement);
  }
});

// Check displacement
const displacement = getStringDisplacement(sensorIndex);
```

**Public API**:
- `initStringPhysics(index)` - Create physics state
- `pluckString(...)` - Trigger vibration
- `updateStringPhysicsStep(physics)` - Update single string
- `updateAllStringPhysics(callback)` - Update all strings
- `getStringDisplacement(index)` - Get displacement magnitude
- `isStringVibrating(index)` - Check vibration state
- `stopStringVibration(index)` - Stop vibration
- `applyStringDisplacement(...)` - Apply external force

## Key Patterns Demonstrated

### 1. **ES6 Modules**
All modules use `export`/`import` syntax for clean dependency management.

### 2. **Single Responsibility**
Each module has one clear purpose:
- `constants.js` → Configuration
- `noiseLibrary.js` → Shader code
- `midiIO.js` → MIDI device management
- `stringPhysics.js` → Physics simulation

### 3. **Encapsulation**
Private state is kept inside modules, only public API is exposed:
```javascript
// Private
let midiOutput = null;

// Public
export function getMIDIOutput() {
  return midiOutput;
}
```

### 4. **Separation of Concerns**
- Configuration separated from logic
- Shader code separated from application code
- I/O separated from message handling
- Physics separated from rendering

### 5. **Clear Documentation**
Each module includes:
- File-level documentation explaining purpose
- Function documentation with parameters and return types
- Usage examples

## Next Steps

Based on the refactoring plan, the remaining modules to create are:

### midi/
- `midiHandlers.js` - Process MIDI messages, trigger actions
- `midiState.js` - Track active notes, pitch bend, mod wheel

### sequencer/
- `sequencer.js` - Main loop, scheduling, note triggering
- `stepParameters.js` - Per-step data
- `scheduler.js` - PPQN calculations, timing math

### scene/
- `sceneManager.js` - Three.js scene setup
- `lighting.js` - Light configuration
- `sensors.js` - Beacon positioning
- `strings.js` - Tube geometry

### shaders/
- `noiseMaterial.js` - ShaderMaterial for sphere
- `samplingShader.js` - GPU sampling shader

### physics/
- `clayPhysics.js` - Clay deformation interactions

### ui/
- `uiManager.js` - Initialize all UI elements
- `controls.js` - Event listeners
- `noisePalette.js` - Noise selector UI

### utils/
- `scales.js` - Scale definitions, Scala parser
- `geometry.js` - Geometry helpers
- `logger.js` - MIDI activity logging

### main.js
Entry point that orchestrates all modules.

## Benefits Achieved

1. **Easier to Navigate**: Each file is focused and small
2. **Easier to Test**: Modules can be tested in isolation
3. **Easier to Modify**: Changes to one module don't affect others
4. **Easier to Understand**: Clear structure and responsibility
5. **Better for Collaboration**: Multiple developers can work on different modules
6. **Better Performance**: Vite can tree-shake unused code
