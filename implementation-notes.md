# 3D Simplex Noise MIDI Instrument - Implementation Notes

## Overview

This implementation transforms a 2D noise sequencer into a **3D spatial pressure field instrument** where sound represents an evolving energy distribution in 3D space.

---

## Core Architecture

### 1. 3D Simplex Noise Shader

**Vertex Shader:**
- Passes `vWorldPos` (world-space position) to fragment shader
- Uses `modelMatrix * vec4(position, 1.0)` for accurate world coordinates
- Also passes normal for lighting calculations

**Fragment Shader:**
- Implements full 3D simplex noise algorithm (Stefan Gustavson)
- Samples noise at: `vWorldPos * uSpatialScale + vec3(0, 0, uTime * uTimeScale)`
- Time animates along Z-axis, creating temporal evolution
- Output normalized to [0,1] and mapped to color gradient
- Includes basic Lambertian lighting for 3D depth perception

**Key Uniforms:**
```javascript
uSpatialScale: 0.5   // Controls noise feature size (higher = smaller features)
uTimeScale: 0.3      // Controls animation speed
uTime: auto          // Continuously updated by animation loop
```

---

### 2. Spatial Sampling Strategy

**Concept:**
Instead of sampling UV coordinates from a 2D texture, we sample **fixed 3D world-space coordinates** around the sphere's equator.

**Implementation:**
```javascript
// Generate 16 points evenly spaced around equator (y=0 plane)
for (let i = 0; i < 16; i++) {
  const angle = (i / 16) * Math.PI * 2;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  points.push(new Vector3(x, 0, z));
}
```

**Why the equator?**
- Creates a circular "scan line" through the noise field
- Rotating the sphere = traveling through different noise regions
- Easy to visualize and understand musically
- Can be modified to sample poles, spirals, or arbitrary patterns

---

### 3. GPU Sampling Pipeline

**Challenge:** We need to evaluate 3D noise at specific world positions and read the results back to JavaScript.

**Solution:**
1. Create an offscreen `WebGLRenderTarget` (16×1 pixels)
2. Create a separate scene with 16 point primitives
3. Each point has a `worldPosition` attribute (our sample coordinates)
4. Use a custom shader that:
   - Takes `worldPosition` as input
   - Evaluates 3D simplex noise at that position
   - Outputs grayscale value to pixel
5. Render to target, read pixels with `readRenderTargetPixels()`
6. Extract R channel values → noise array [0..1]

**Code Flow:**
```javascript
sampleNoiseFromGPU() {
  // 1. Render sample points to offscreen target
  renderer.setRenderTarget(samplingTarget);
  renderer.render(samplingScene, samplingCamera);
  
  // 2. Read pixel data back to CPU
  renderer.readRenderTargetPixels(..., pixelBuffer);
  
  // 3. Extract noise values
  values = pixelBuffer.map(r => r / 255);
  
  return values; // [0..1] array
}
```

---

### 4. Noise → Music Mapping

**Direct Linear Mapping:**
```javascript
noiseToMidiNote(value) {
  return MIN_NOTE + value * (MAX_NOTE - MIN_NOTE);
  // 0.0 → 12 (C0)
  // 0.5 → 48 (C3)
  // 1.0 → 84 (C6)
}
```

**Spatial-to-Temporal Translation:**
- **Space:** 16 fixed points around the sphere
- **Time:** 16 sixteenth-note steps per bar
- **Mapping:** Point[i] → Step[i] → Note[i]

As the noise field evolves (via `uTime`), the same spatial point reads different values, creating melodic variation.

**Musical Implications:**
- **Low `uSpatialScale`** (0.1-0.5): Smooth, flowing melodies
- **High `uSpatialScale`** (1.0-2.0): Jagged, chaotic sequences
- **Low `uTimeScale`** (0.0-0.3): Slow evolution, repeating patterns
- **High `uTimeScale`** (0.5-1.0): Rapid changes, generative chaos

---

### 5. MIDI Scheduling

Uses the same bar-based scheduling as original:

```javascript
scheduleNoiseSequence() {
  const noiseValues = sampleNoiseFromGPU();
  const now = performance.now();
  
  for (let i = 0; i < 16; i++) {
    const note = noiseToMidiNote(noiseValues[i]);
    const tOn = now + i * STEP_MS;
    const tOff = tOn + STEP_MS * 0.8;
    
    noteOn(note, 80, tOn);
    noteOff(note, tOff);
  }
}
```

Repeats every bar (16 steps @ BPM 120 = 2 seconds).

---

## Key Improvements Over 2D Version

| Aspect | 2D Version | 3D Version |
|--------|-----------|-----------|
| **Visual** | Flat quad | Rotating 3D sphere |
| **Sampling** | UV coordinates | World-space coordinates |
| **Noise** | 2D simplex | 3D simplex with time |
| **Interaction** | Static | Orbit controls + live sliders |
| **Musical Depth** | Fixed texture scroll | Evolving spatial field |

---

## Future Extensions

### Easy Additions:
1. **Velocity from noise gradient:**
   ```javascript
   velocity = 40 + abs(noiseGradient) * 80;
   ```

2. **Alternative sample patterns:**
   - Spiral around sphere
   - Random constellation
   - Fibonacci sphere distribution

3. **Multiple octaves:**
   ```javascript
   noise = fbm3d(p); // Fractal Brownian Motion
   ```

### Advanced:
1. **4D noise** (add W dimension):
   ```glsl
   float noise = snoise4d(vec4(vWorldPos * uScale, uTime));
   ```

2. **Polyphonic chords:**
   Sample multiple layers at different scales

3. **User-drawn sample paths:**
   Allow drawing custom curves for sampling

4. **Scale quantization:**
   Map noise → scale degrees instead of chromatic

---

## Performance Notes

- **GPU sampling:** ~0.1ms per frame (negligible)
- **Render target size:** 16×1 (minimal memory)
- **Sphere geometry:** 64×64 segments (good balance)
- **Frame rate:** Locked at 60fps

**Optimization opportunities:**
- Use `UnsignedByteType` for sampling (already implemented)
- Disable depth buffer on sampling target (already done)
- Could reduce sphere resolution to 32×32 if needed

---

## Troubleshooting

**No sound?**
- Check IAC Driver is enabled (macOS: Audio MIDI Setup)
- Verify DAW is receiving MIDI on correct port
- Check browser console for MIDI errors

**Laggy visuals?**
- Reduce sphere geometry segments
- Lower `devicePixelRatio`

**Repetitive melodies?**
- Increase `uTimeScale`
- Increase `uSpatialScale`
- Rotate the sphere manually

---

## Conceptual Summary

This instrument treats 3D space as a **living energy field**:

```
3D Simplex Noise Field
       ↓
  Sample at fixed spatial points
       ↓
  Read values via GPU → CPU
       ↓
  Map to MIDI notes
       ↓
  Schedule as 16th note sequence
       ↓
  Output to DAW via WebMIDI
```

The key innovation is **decoupling visual representation from musical sampling**:
- The sphere shows the entire field
- The red dots show what we're "listening to"
- As the field evolves, the music changes

This creates a **spatial instrument** where position, scale, and time all contribute to the musical output.

---

## Installation & Running

```bash
npm install
npm run dev
```

Open browser to `http://localhost:5173`

Click "▶ Start MIDI Sequencer"

Adjust sliders and rotate sphere to explore the sound space.

Enjoy! 🎵