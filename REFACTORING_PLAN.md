# Modular Refactoring Plan
## 3D Noise MIDI Instrument

### Overview
This document outlines the plan to refactor the monolithic `threejs-3d-noise-midi.js` file into a modular architecture following industry best practices.

### Target Structure

```
src/
├── config/
│   ├── constants.js                 ✅ DONE
│   └── globalState.js               # Centralized state management
├── midi/
│   ├── midiIO.js                    # Init, connect, disconnect
│   ├── midiHandlers.js              # Note On/Off, Pitch Bend, CC
│   └── midiState.js                 # Active notes, input enabled
├── sequencer/
│   ├── sequencer.js                 # Core sequencer loop
│   ├── stepParameters.js            # Per-step settings
│   └── scheduler.js                 # PPQN timing calculations
├── scene/
│   ├── sceneManager.js              # Scene, camera, renderer
│   ├── lighting.js                  # Ambient + point lights
│   ├── sensors.js                   # Beacon/sensor positioning
│   └── strings.js                   # String tubes creation
├── physics/
│   ├── stringPhysics.js             # Hooke's law spring simulation
│   └── clayPhysics.js               # Clay molding interactions
├── shaders/
│   ├── noiseLibrary.js              # GLSL noise functions
│   ├── noiseMaterial.js             # Sphere shader material
│   └── samplingShader.js            # GPU sampling shader
├── ui/
│   ├── uiManager.js                 # Initialize all UI
│   ├── controls.js                  # Slider/toggle handlers
│   └── noisePalette.js              # Noise selector UI
├── utils/
│   ├── scales.js                    # Musical scales + Scala parser
│   ├── geometry.js                  # Geometry helpers
│   └── logger.js                    # MIDI activity logging
└── main.js                          # Entry point

index.html                           # Update script src to main.js
```

### Module Responsibilities

#### 1. config/
- **constants.js** ✅ - All constant values, defaults
- **globalState.js** - Reactive state object with getters/setters

#### 2. midi/
- **midiIO.js** - WebMIDI initialization, device enumeration
- **midiHandlers.js** - Process MIDI messages, trigger actions
- **midiState.js** - Track active notes, pitch bend, mod wheel

#### 3. sequencer/
- **sequencer.js** - Main loop, scheduling, note triggering
- **stepParameters.js** - Per-step data (active, dotted, tie, velocity)
- **scheduler.js** - PPQN calculations, timing math

#### 4. scene/
- **sceneManager.js** - Three.js scene setup, camera, renderer, controls
- **lighting.js** - Ambient light + per-sensor point lights
- **sensors.js** - Beacon poles, position calculation
- **strings.js** - Tube geometry, bezier curves

#### 5. physics/
- **stringPhysics.js** - Spring physics, vibration simulation
- **clayPhysics.js** - Clay deformation, vertex manipulation

#### 6. shaders/
- **noiseLibrary.js** - All GLSL noise function strings
- **noiseMaterial.js** - ShaderMaterial for sphere
- **samplingShader.js** - GPU sampling material

#### 7. ui/
- **uiManager.js** - Initialize all UI elements
- **controls.js** - Event listeners for sliders/toggles
- **noisePalette.js** - Noise type selector

#### 8. utils/
- **scales.js** - Scale definitions, Scala parser, quantization
- **geometry.js** - Fibonacci sphere, curve helpers
- **logger.js** - MIDI activity log

### Implementation Strategy

1. **Phase 1: Foundation** ✅
   - Create directory structure
   - Extract constants

2. **Phase 2: Core Modules** (Next)
   - Shaders (largest, most isolated)
   - Scene management
   - MIDI I/O

3. **Phase 3: Integration**
   - Sequencer logic
   - Physics modules
   - UI bindings

4. **Phase 4: Testing & Cleanup**
   - Create main.js entry point
   - Update index.html
   - Test all functionality
   - Remove old file

### Module Communication Pattern

```javascript
// Example: MIDI In → Sequencer → Scene

// MIDI Handler detects note
handleMIDINoteOn(note, velocity) {
  const sensorIndex = mapNoteToSensor(note);

  // Update physics
  pluckString(sensorIndex, velocity);

  // Update scene
  highlightBeacon(sensorIndex);

  // Pass through to output
  sendMIDIOut([0x90, note, velocity]);
}
```

### Benefits of Modular Architecture

1. **Maintainability** - Each file has single responsibility
2. **Testability** - Modules can be tested in isolation
3. **Reusability** - Functions can be imported where needed
4. **Collaboration** - Multiple developers can work on different modules
5. **Performance** - Tree-shaking removes unused code
6. **Debugging** - Easier to locate and fix issues
7. **Documentation** - Each module is self-documenting

### Migration Notes

- Keep original file as reference until refactoring complete
- Test each module as it's created
- Use ES6 modules (import/export)
- Maintain all existing functionality
- No breaking changes to user experience
