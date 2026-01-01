import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// ============================================================================
// CONSTANTS
// ============================================================================

let MIDI_STEPS = 16;
const MIN_NOTE = 12;  // C0
const MAX_NOTE = 84;  // C6
const PPQN = 960; // Parts Per Quarter Note (standard MIDI resolution)
let BPM = 120;

// Time signature state
let timeSigNumerator = 4;
let timeSigDenominator = 4;
let newComplexityEnabled = false;

// ============================================================================
// PER-STEP SEQUENCER PARAMETERS
// ============================================================================

/**
 * Per-step parameters for each sequencer step
 * Each step can have individual control over:
 * - active: whether the step plays (true) or is a rest (false)
 * - dotted: extends note duration by 50% (like dotted notes in music notation)
 * - tie: ties this note to the next step, extending duration
 * - scaleDegree: force specific scale degree (1-7 for I-VII), null = use noise value
 * - velocity: MIDI velocity override (1-127), null = use default
 */
let stepParameters = [];

function initStepParameters(numSteps) {
  stepParameters = [];
  for (let i = 0; i < numSteps; i++) {
    stepParameters.push({
      active: true,        // true = play note, false = rest
      dotted: false,       // true = 1.5x duration
      tie: false,          // true = tie to next step
      scaleDegree: null,   // 1-7 for I-VII, null = use noise
      velocity: null       // 1-127, null = default (80)
    });
  }
}

// Initialize with default step count
initStepParameters(MIDI_STEPS);

// Calculate step timing based on time signature
function calculateStepMS() {
  if (BPM <= 0) return Infinity;

  // Calculate quarter note duration in ms
  const quarterNoteMS = 60000 / BPM;

  // Calculate beat duration based on denominator
  // Denominator 4 = quarter note, 8 = eighth note, etc.
  const beatDurationMS = quarterNoteMS * (4 / timeSigDenominator);

  // Each step is one beat divided by the number of steps per measure
  const beatsPerMeasure = timeSigNumerator;
  const stepsPerMeasure = MIDI_STEPS;

  // Distribute beats across steps
  return (beatDurationMS * beatsPerMeasure) / stepsPerMeasure;
}

// Calculate MIDI ticks per measure (for sequencing reference)
function calculateTicksPerMeasure() {
  // Ticks per quarter note * quarter notes per measure
  const quarterNotesPerMeasure = timeSigNumerator * (4 / timeSigDenominator);
  return PPQN * quarterNotesPerMeasure;
}

let STEP_MS = calculateStepMS();

// ============================================================================
// MUSICAL SCALE DEFINITIONS
// ============================================================================

// Scale definitions as semitone intervals from root
const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  locrian: [0, 1, 3, 5, 6, 8, 10],
  'pentatonic-major': [0, 2, 4, 7, 9],
  'pentatonic-minor': [0, 3, 5, 7, 10],
  blues: [0, 3, 5, 6, 7, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  'whole-tone': [0, 2, 4, 6, 8, 10],
  diminished: [0, 2, 3, 5, 6, 8, 9, 11]
};

// Scale state
let scaleEnabled = false;
let currentScale = SCALES.chromatic;
let currentKey = 0; // 0 = C, 1 = C#, 2 = D, etc.
let customScalaScale = null; // For imported Scala files

/**
 * Generate all MIDI notes in the current scale across the full range
 * Applies key transposition
 */
function generateScaleNotes() {
  if (customScalaScale) {
    // Use custom Scala scale (already includes all octaves)
    return customScalaScale;
  }

  const notes = [];
  const scaleIntervals = currentScale;

  // Generate notes across all octaves with key transposition
  for (let octave = 0; octave < 11; octave++) {
    const octaveBase = octave * 12;
    for (let interval of scaleIntervals) {
      const note = octaveBase + interval + currentKey;
      if (note >= MIN_NOTE && note <= MAX_NOTE) {
        notes.push(note);
      }
    }
  }

  return notes.sort((a, b) => a - b);
}

/**
 * Quantize a MIDI note to the nearest note in the current scale
 */
function quantizeToScale(midiNote) {
  if (!scaleEnabled) {
    return midiNote;
  }

  const scaleNotes = generateScaleNotes();

  // Find nearest note in scale
  let closest = scaleNotes[0];
  let minDist = Math.abs(midiNote - closest);

  for (let note of scaleNotes) {
    const dist = Math.abs(midiNote - note);
    if (dist < minDist) {
      minDist = dist;
      closest = note;
    }
  }

  return closest;
}

/**
 * Convert scale degree (1-7 for I-VII) to MIDI note
 * Uses middle octave (C4-B4) as default range
 */
function scaleDegreeToMidiNote(degree) {
  if (!scaleEnabled) {
    // If scale is disabled, use chromatic scale in C
    const middleC = 60; // C4
    return middleC + (degree - 1);
  }

  const scaleIntervals = currentScale;
  const degreeIndex = (degree - 1) % scaleIntervals.length;
  const octaveOffset = Math.floor((degree - 1) / scaleIntervals.length);

  // Use C4 (MIDI 60) as base for middle octave
  const middleC = 60;
  const note = middleC + currentKey + scaleIntervals[degreeIndex] + (octaveOffset * 12);

  // Clamp to valid MIDI range
  return Math.max(MIN_NOTE, Math.min(MAX_NOTE, note));
}

/**
 * Parse a Scala (.scl) file
 * Format: https://www.huygens-fokker.org/scala/scl_format.html
 */
function parseScalaFile(text) {
  const lines = text.split('\n').map(line => line.trim());

  // Skip comments and empty lines
  const cleanLines = lines.filter(line =>
    line.length > 0 && !line.startsWith('!')
  );

  if (cleanLines.length < 2) {
    throw new Error('Invalid Scala file format');
  }

  // First line is description (skip)
  // Second line is number of notes
  const numNotes = parseInt(cleanLines[1]);

  if (isNaN(numNotes)) {
    throw new Error('Invalid number of notes in Scala file');
  }

  // Parse scale degrees
  const intervals = [0]; // Always include root

  for (let i = 2; i < Math.min(2 + numNotes, cleanLines.length); i++) {
    const line = cleanLines[i];

    // Parse either cents (decimal) or ratio (e.g., "3/2")
    let cents;
    if (line.includes('/')) {
      // Ratio format
      const [num, den] = line.split('/').map(parseFloat);
      cents = 1200 * Math.log2(num / den);
    } else {
      // Cents format
      cents = parseFloat(line);
    }

    if (!isNaN(cents)) {
      intervals.push(cents);
    }
  }

  // Convert cents to MIDI notes across the range
  const notes = [];
  const octaveCents = intervals[intervals.length - 1]; // Usually 1200 for octave

  for (let octave = 0; octave < 11; octave++) {
    for (let cents of intervals) {
      const totalCents = octave * octaveCents + cents;
      const semitones = totalCents / 100; // Convert cents to semitones
      const midiNote = Math.round(semitones);

      if (midiNote >= MIN_NOTE && midiNote <= MAX_NOTE) {
        notes.push(midiNote);
      }
    }
  }

  return [...new Set(notes)].sort((a, b) => a - b);
}

// ============================================================================
// THREE.JS SETUP
// ============================================================================

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a0a);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 3);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Track camera quaternion to detect rotation changes
// Apply rotation delta to noise sphere only, keeping sequencer fixed
const previousCameraQuaternion = new THREE.Quaternion();
const currentCameraQuaternion = new THREE.Quaternion();
const deltaQuaternion = new THREE.Quaternion();

const noiseRotationGroup = new THREE.Group();
scene.add(noiseRotationGroup);

// Gentle ambient glow for everything
const ambientLight = new THREE.AmbientLight(0x404060, 0.25);
scene.add(ambientLight);

// Array to store point lights for each sensor
const sensorPointLights = [];

// ============================================================================
// 3D SIMPLEX NOISE SHADER
// ============================================================================

// Initialize empty deformation array
const emptyDeformations = [];
for (let i = 0; i < 64; i++) {
  emptyDeformations.push(new THREE.Vector3(0, 0, 0));
}

const simplexNoiseShader = {
  uniforms: {
    uSpatialScale: { value: 0.5 },
    uTimeScale: { value: 0.3 },
    uTime: { value: 0.0 },
    uDeformations: { value: emptyDeformations }, // Array of deformation points
    uShininess: { value: 30.0 },
    uMetalness: { value: 0.2 },
    uRoughness: { value: 0.4 },
    uDisplacementAmount: { value: 0.3 }, // Mountain/valley displacement strength
    // Color gradient uniforms (5 color stops with alpha)
    uColor1: { value: new THREE.Vector4(0.05, 0.05, 0.4, 1.0) },
    uColor2: { value: new THREE.Vector4(0.0, 0.4, 0.9, 1.0) },
    uColor3: { value: new THREE.Vector4(0.0, 0.8, 0.7, 1.0) },
    uColor4: { value: new THREE.Vector4(1.0, 0.8, 0.1, 1.0) },
    uColor5: { value: new THREE.Vector4(1.0, 0.3, 0.6, 1.0) }
  },

  vertexShader: /* glsl */`
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDisplacement; // Pass displacement to fragment shader

    uniform vec3 uDeformations[64];
    uniform float uSpatialScale;
    uniform float uTimeScale;
    uniform float uTime;
    uniform float uDisplacementAmount;

    // Simplex noise function (copied from fragment shader)
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x * 34.0) + 1.0) * x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float snoise3d(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    void main() {
      vec3 deformedPosition = position;
      vec3 deformedNormal = normal;

      // Sample noise at this vertex position with time animation
      vec3 noisePos = position * uSpatialScale + vec3(0.0, 0.0, uTime * uTimeScale);
      float noiseValue = snoise3d(noisePos);

      // Create mountains and valleys: displace along normal direction
      float displacement = noiseValue * uDisplacementAmount;
      deformedPosition += normal * displacement;
      vDisplacement = displacement; // Pass to fragment shader

      // Apply clay-like deformations
      for (int i = 0; i < 64; i++) {
        vec3 deformPos = uDeformations[i];
        if (length(deformPos) < 0.001) break;

        float dist = distance(position, deformPos);
        float influence = exp(-dist * dist * 8.0);
        vec3 direction = normalize(position - deformPos);
        deformedPosition += direction * influence * 0.5;
      }

      // Recalculate normal after deformation (approximate)
      deformedNormal = normalize(deformedPosition);

      // Pass world-space position to fragment shader
      vec4 worldPos = modelMatrix * vec4(deformedPosition, 1.0);
      vWorldPos = worldPos.xyz;

      // Pass deformed normal for lighting
      vNormal = normalize(normalMatrix * deformedNormal);

      // View position for specular
      vec4 mvPosition = modelViewMatrix * vec4(deformedPosition, 1.0);
      vViewPosition = -mvPosition.xyz;

      gl_Position = projectionMatrix * mvPosition;
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    uniform float uSpatialScale;
    uniform float uTimeScale;
    uniform float uTime;
    uniform float uShininess;
    uniform float uMetalness;
    uniform float uRoughness;
    uniform vec4 uColor1;
    uniform vec4 uColor2;
    uniform vec4 uColor3;
    uniform vec4 uColor4;
    uniform vec4 uColor5;

    // ========================================================================
    // 3D SIMPLEX NOISE IMPLEMENTATION
    // Based on Stefan Gustavson's implementation
    // ========================================================================

    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x * 34.0) + 1.0) * x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float snoise3d(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      // First corner
      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      // Other corners
      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      // Permutations
      i = mod289(i);
      vec4 p = permute(permute(permute(
                 i.z + vec4(0.0, i1.z, i2.z, 1.0))
               + i.y + vec4(0.0, i1.y, i2.y, 1.0))
               + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      // Gradients
      float n_ = 0.142857142857; // 1.0/7.0
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      // Normalize gradients
      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      // Mix contributions
      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    // ========================================================================
    // MAIN FRAGMENT SHADER
    // ========================================================================

    void main() {
      // Sample 3D noise at world position with time animation
      vec3 p = vWorldPos * uSpatialScale + vec3(0.0, 0.0, uTime * uTimeScale);

      // Get noise value in range [-1, 1]
      float noise = snoise3d(p);

      // Normalize to [0, 1] for visualization
      float value = noise * 0.5 + 0.5;

      // Customizable color gradient using uniforms
      vec4 gradientColor;
      if (value < 0.2) {
        gradientColor = mix(uColor1, uColor2, value * 5.0);
      } else if (value < 0.4) {
        gradientColor = mix(uColor2, uColor3, (value - 0.2) * 5.0);
      } else if (value < 0.6) {
        gradientColor = mix(uColor3, uColor4, (value - 0.4) * 5.0);
      } else if (value < 0.8) {
        gradientColor = mix(uColor4, uColor5, (value - 0.6) * 5.0);
      } else {
        gradientColor = uColor5;
      }

      vec3 baseColor = gradientColor.rgb;
      float baseAlpha = gradientColor.a;

      // Enhanced physically-based lighting
      vec3 normal = normalize(vNormal);
      vec3 viewDir = normalize(vViewPosition);

      // Key light (main directional)
      vec3 keyLightDir = normalize(vec3(5.0, 5.0, 5.0));
      float keyDiffuse = max(dot(normal, keyLightDir), 0.0);

      // Fill light (secondary)
      vec3 fillLightDir = normalize(vec3(-3.0, 2.0, -3.0));
      float fillDiffuse = max(dot(normal, fillLightDir), 0.0);

      // Rim light (back light for depth)
      vec3 rimLightDir = normalize(vec3(0.0, -5.0, 0.0));
      float rimDiffuse = max(dot(normal, rimLightDir), 0.0);

      // Specular highlights (Blinn-Phong)
      vec3 halfVector = normalize(keyLightDir + viewDir);
      float specular = pow(max(dot(normal, halfVector), 0.0), uShininess);

      // Fresnel effect for edge glow (clay has subtle subsurface scattering)
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

      // Combine lighting
      float diffuseLight = keyDiffuse * 1.2 + fillDiffuse * 0.4 + rimDiffuse * 0.6;
      diffuseLight = diffuseLight * 0.7 + 0.3; // Ambient base

      // Apply lighting to color
      vec3 finalColor = baseColor * diffuseLight;

      // Add specular with metalness control
      finalColor += vec3(1.0, 1.0, 1.0) * specular * (0.3 + uMetalness * 0.7);

      // Add fresnel rim glow with color tint
      vec3 fresnelColor = mix(baseColor, vec3(0.4, 0.5, 1.0), 0.5);
      finalColor += fresnelColor * fresnel * 0.4;

      // Subtle ambient occlusion approximation based on noise
      float ao = 0.8 + value * 0.2;
      finalColor *= ao;

      // Enhanced transparency with depth-based opacity and gradient alpha
      float opacity = baseAlpha * (0.75 + fresnel * 0.15);

      gl_FragColor = vec4(finalColor, opacity);
    }
  `
};

// ============================================================================
// CREATE 3D MESH WITH NOISE MATERIAL
// ============================================================================

const geometry = new THREE.SphereGeometry(1, 128, 128); // Higher resolution for smooth deformation
const material = new THREE.ShaderMaterial({
  uniforms: simplexNoiseShader.uniforms,
  vertexShader: simplexNoiseShader.vertexShader,
  fragmentShader: simplexNoiseShader.fragmentShader,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.75
});

const noiseMesh = new THREE.Mesh(geometry, material);
noiseRotationGroup.add(noiseMesh);

// ============================================================================
// ZERO-CROSSING PLANE (Reference plane at sphere center)
// ============================================================================

// Create a semi-transparent plane at the center showing zero displacement
const planeGeometry = new THREE.PlaneGeometry(3, 3, 20, 20);
const planeMaterial = new THREE.MeshBasicMaterial({
  color: 0x4444ff,
  transparent: true,
  opacity: 0.15,
  side: THREE.DoubleSide,
  wireframe: false
});
const zeroCrossingPlane = new THREE.Mesh(planeGeometry, planeMaterial);

// Add grid lines for better visibility
const gridHelper = new THREE.GridHelper(3, 20, 0x6666ff, 0x3333ff);
gridHelper.rotation.x = Math.PI / 2; // Rotate to be vertical (XY plane)
gridHelper.material.transparent = true;
gridHelper.material.opacity = 0.3;

const planeGroup = new THREE.Group();
planeGroup.add(zeroCrossingPlane);
planeGroup.add(gridHelper);
noiseRotationGroup.add(planeGroup); // Add to rotation group so it rotates with sphere

// ============================================================================
// CLAY MOLDING PHYSICS SYSTEM
// ============================================================================

/**
 * Clay deformation system that simulates wet clay physics
 * - Deformations are stored as local vertex displacements
 * - Viscosity controls how much the clay "flows" and smooths over time
 * - Elasticity controls how much the clay wants to return to original shape
 */

// Clay material properties
let clayViscosity = 0.92; // How quickly deformations smooth out (0-1, higher = stickier)
let clayElasticity = 0.05; // How much clay returns to original shape (0-1, higher = bouncier)
let clayPushStrength = 0.15; // How much pushing affects the clay
let clayBrushSize = 0.3; // Radius of influence for molding

// Deformation state
const deformations = []; // Array of {position: Vector3, strength: float, velocity: Vector3}
const maxDeformations = 64;

// Track mouse interaction with sphere
let isMoldingSphere = false;
let lastMoldPoint = null;
let moldRaycaster = new THREE.Raycaster();

/**
 * Add a deformation to the clay at a specific point
 */
function addClayDeformation(point, strength) {
  // Find if there's an existing deformation nearby
  let existingDeformation = null;
  let minDist = Infinity;

  for (let i = 0; i < deformations.length; i++) {
    const dist = point.distanceTo(deformations[i].position);
    if (dist < clayBrushSize && dist < minDist) {
      existingDeformation = deformations[i];
      minDist = dist;
    }
  }

  if (existingDeformation) {
    // Strengthen existing deformation
    existingDeformation.strength += strength * 0.5;
    existingDeformation.strength = Math.min(existingDeformation.strength, 1.0);
    console.log('🎨 Strengthened deformation at', existingDeformation.position, 'strength:', existingDeformation.strength.toFixed(3));
  } else if (deformations.length < maxDeformations) {
    // Add new deformation
    const newDeform = {
      position: point.clone(),
      strength: strength,
      velocity: new THREE.Vector3(0, 0, 0)
    };
    deformations.push(newDeform);
    console.log('🎨 New deformation #' + deformations.length, 'at', point, 'strength:', strength.toFixed(3));
  }

  // Update shader uniform
  updateDeformationUniforms();
}

/**
 * Update the shader uniforms with current deformations
 */
function updateDeformationUniforms() {
  const deformArray = [];

  for (let i = 0; i < maxDeformations; i++) {
    if (i < deformations.length) {
      const d = deformations[i];
      // Pass actual position - we'll encode strength in the w component by storing it in a vec4
      // But since we're using vec3 array, we'll normalize and scale by strength in a different way
      // Store actual position for distance calculation, use length as indicator
      const pos = d.position.clone();
      // Scale position to sphere surface if needed (normalize to radius ~1)
      deformArray.push(pos);
    } else {
      deformArray.push(new THREE.Vector3(0, 0, 0));
    }
  }

  material.uniforms.uDeformations.value = deformArray;
}

/**
 * Update clay physics - smooth deformations and apply elasticity
 */
function updateClayPhysics() {
  for (let i = deformations.length - 1; i >= 0; i--) {
    const deform = deformations[i];

    // Apply viscosity (gradual smoothing)
    deform.strength *= clayViscosity;

    // Apply elasticity (return to original shape)
    const returnForce = -deform.strength * clayElasticity;
    deform.velocity.z += returnForce;

    // Apply velocity
    deform.strength += deform.velocity.z;

    // Dampen velocity
    deform.velocity.multiplyScalar(0.9);

    // Remove deformations that are too weak
    if (Math.abs(deform.strength) < 0.01) {
      deformations.splice(i, 1);
    }
  }

  // Update shader
  if (deformations.length > 0 || deformations.length !== material.uniforms.uDeformations.value.length) {
    updateDeformationUniforms();
  }
}

/**
 * Clear all clay deformations (reset to sphere)
 */
function resetClayShape() {
  deformations.length = 0;
  updateDeformationUniforms();
  console.log('🎨 Clay shape reset');
}

// ============================================================================
// SEQUENCER GROUP SETUP
// ============================================================================

// Sequencer group - contains all beacons, poles, and tubes (fixed in world space)
const sequencerGroup = new THREE.Group();
sequencerGroup.name = 'sequencer';
scene.add(sequencerGroup);

// ============================================================================
// SPATIAL SAMPLING CONFIGURATION
// ============================================================================

/**
 * Generate 16 sample points evenly distributed around the sphere's equator.
 * These points represent fixed spatial coordinates where we'll sample the
 * evolving 3D noise field for MIDI note generation.
 *
 * Musical Mapping Concept:
 * - Each sample point is a "sensor" in 3D space
 * - As the noise field animates, each sensor reads a different value
 * - Higher noise values = higher pitched notes
 * - This creates a spatial-to-temporal mapping where rotation around
 *   the sphere becomes a musical sequence
 */
function generateLinePositions() {
  const points = [];
  const radius = 1.0; // Sphere radius

  for (let i = 0; i < MIDI_STEPS; i++) {
    const angle = (i / MIDI_STEPS) * Math.PI * 2;

    // Points on equator (y=0 plane)
    const x = Math.cos(angle) * radius;
    const y = 0;
    const z = Math.sin(angle) * radius;

    points.push(new THREE.Vector3(x, y, z));
  }

  return points;
}

/**
 * Generate random points scattered across the sphere surface
 * Uses Fibonacci sphere algorithm for even distribution
 */
function generateRandomPositions() {
  const points = [];
  const radius = 1.0;
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < MIDI_STEPS; i++) {
    // Fibonacci sphere distribution
    const theta = 2 * Math.PI * i / goldenRatio;
    const phi = Math.acos(1 - 2 * (i + 0.5) / MIDI_STEPS);

    const x = radius * Math.cos(theta) * Math.sin(phi);
    const y = radius * Math.sin(theta) * Math.sin(phi);
    const z = radius * Math.cos(phi);

    points.push(new THREE.Vector3(x, y, z));
  }

  return points;
}

// Generate both position sets
const linePositions = generateLinePositions();
const randomPositions = generateRandomPositions();

// Start with line positions
const samplePoints = linePositions.map(p => p.clone());

// Sensor distribution (0 = line, 1 = chaos)
let sensorDistribution = 0.0;

// Sensor animation speed
let sensorAnimationSpeed = 0.0;

// Target positions for smooth interpolation
const targetSamplePoints = [];
for (let i = 0; i < 32; i++) {
  targetSamplePoints.push(new THREE.Vector3());
}

// Smoothing factor for position interpolation (0-1, higher = smoother but slower)
const POSITION_SMOOTHING = 0.15;

/**
 * Update sensor positions by morphing between line and random positions
 * with optional cosine-based animation for each point
 * Also updates beacon poles and tube connections with smooth interpolation
 */
function updateSensorPositions(mix, animatedMix = null) {
  // Update target positions
  for (let i = 0; i < MIDI_STEPS; i++) {
    // Use animated mix if provided, otherwise use static mix
    const currentMix = animatedMix !== null ? animatedMix[i] : mix;

    // Linear interpolation between line and random positions
    targetSamplePoints[i].lerpVectors(linePositions[i], randomPositions[i], currentMix);

    // Normalize to ensure sensor stays on sphere surface (radius = 1.0)
    targetSamplePoints[i].normalize();

    // Smoothly interpolate current position towards target
    samplePoints[i].lerp(targetSamplePoints[i], POSITION_SMOOTHING);
  }

  // Update beacon positions with smooth interpolation
  for (let i = 0; i < MIDI_STEPS; i++) {
    const basePos = samplePoints[i].clone();
    const direction = basePos.clone().normalize();
    const beaconPos = basePos.clone().add(direction.multiplyScalar(BEACON_HEIGHT));

    // Update beacon position
    beaconTops[i].copy(beaconPos);

    // Update beacon sphere position
    if (beaconElements[i]) {
      beaconElements[i].topSphere.position.copy(beaconPos);
      beaconElements[i].position.copy(beaconPos);
    }

    // Update point light position to follow sensor
    if (sensorPointLights[i]) {
      sensorPointLights[i].position.copy(basePos);
    }
  }

  // Update tube geometries (modify existing instead of recreating)
  updateTubeGeometries();

  // Update the sampling geometry world positions
  // IMPORTANT: Transform sample points by noise sphere rotation
  // Since sequencer is fixed in world space but noise sphere rotates,
  // we need to apply the noise rotation to get correct sampling coordinates
  const worldPositions = samplingGeometry.attributes.worldPosition.array;
  const tempVec = new THREE.Vector3();
  for (let i = 0; i < MIDI_STEPS; i++) {
    // Apply noise sphere's rotation to the sample point
    tempVec.copy(samplePoints[i]);
    tempVec.applyQuaternion(noiseRotationGroup.quaternion);

    worldPositions[i * 3] = tempVec.x;
    worldPositions[i * 3 + 1] = tempVec.y;
    worldPositions[i * 3 + 2] = tempVec.z;
  }
  samplingGeometry.attributes.worldPosition.needsUpdate = true;
}

/**
 * Update tube geometries ensuring they never pass through sphere surface
 */
function updateTubeGeometries() {
  for (let i = 0; i < tubeSegments.length; i++) {
    const seg = tubeSegments[i];
    const nextIndex = (i + 1) % MIDI_STEPS;
    const start = beaconTops[i];
    const end = beaconTops[nextIndex];

    // Calculate midpoint and ensure it's above sphere surface
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const midpointDir = midpoint.clone().normalize();

    // Calculate distance from origin to midpoint
    const midpointDist = midpoint.length();

    // Sphere radius is 1.0, minimum height to clear surface
    const sphereRadius = 1.0;
    const minHeight = sphereRadius + BEACON_HEIGHT * 0.5;

    // Lift control point to at least minHeight from origin
    const liftAmount = Math.max(0, minHeight - midpointDist);
    const controlPoint = midpoint.clone().add(midpointDir.multiplyScalar(liftAmount + 0.1));

    // Create new curve
    const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);

    // Store the curve for later use (for string physics)
    if (stringPhysics[i] && !stringPhysics[i].isVibrating) {
      stringPhysics[i].originalCurve = curve;
    }

    // Only update if string is not vibrating
    if (!stringPhysics[i] || !stringPhysics[i].isVibrating) {
      seg.mesh.geometry.dispose();
      seg.mesh.geometry = new THREE.TubeGeometry(curve, 20, 0.008, 8, false);
    }
  }
}

// Height of beacon markers above sphere surface
const BEACON_HEIGHT = 0.3;

// Beacon elements - organized structure for each beacon
let beaconElements = []; // { topSphere: Mesh, position: Vector3 }
let beaconTops = []; // Track positions of beacons
let tubeSegments = [];

/**
 * Rebuild all beacons and tubes when step count changes
 */
function rebuildBeaconsAndTubes() {
  // Clear existing sequencer group
  sequencerGroup.clear();

  // Dispose existing beacon elements
  beaconElements.forEach(element => {
    element.topSphere.geometry.dispose();
    element.topSphere.material.dispose();
  });
  beaconElements = [];
  beaconTops = [];

  // Dispose existing tubes
  tubeSegments.forEach(seg => {
    seg.mesh.geometry.dispose();
    seg.mesh.material.dispose();
  });
  tubeSegments = [];

  // Remove existing sensor point lights
  sensorPointLights.forEach(light => {
    scene.remove(light);
  });
  sensorPointLights.length = 0;

  // Regenerate positions with new step count
  const newLinePositions = generateLinePositions();
  const newRandomPositions = generateRandomPositions();

  linePositions.length = 0;
  randomPositions.length = 0;
  samplePoints.length = 0;

  newLinePositions.forEach(p => linePositions.push(p));
  newRandomPositions.forEach(p => randomPositions.push(p));
  newLinePositions.forEach(p => samplePoints.push(p.clone()));

  // Create new beacon markers (spheres above surface)
  for (let i = 0; i < MIDI_STEPS; i++) {
    const basePos = samplePoints[i].clone();
    const direction = basePos.clone().normalize();
    const beaconPos = basePos.clone().add(direction.multiplyScalar(BEACON_HEIGHT));

    // Create glowing beacon sphere
    const beaconGeometry = new THREE.SphereGeometry(0.03, 16, 16);
    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.9
    });
    const beaconSphere = new THREE.Mesh(beaconGeometry, beaconMaterial);
    beaconSphere.position.copy(beaconPos);

    // Store beacon element
    beaconElements.push({
      topSphere: beaconSphere,
      position: beaconPos.clone()
    });
    beaconTops.push(beaconPos);

    // Add to sequencer group
    sequencerGroup.add(beaconSphere);

    // Create point light at sensor position to illuminate the noise sphere
    const pointLight = new THREE.PointLight(0xffffff, 1.5, 2.0, 2.0);
    pointLight.position.copy(basePos);
    scene.add(pointLight);
    sensorPointLights.push(pointLight);
  }

  // Create tube connections between beacons (never passing through sphere)
  for (let i = 0; i < MIDI_STEPS; i++) {
    const nextIndex = (i + 1) % MIDI_STEPS;
    const start = beaconTops[i];
    const end = beaconTops[nextIndex];

    // Calculate midpoint and ensure it's above sphere surface
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const midpointDir = midpoint.clone().normalize();

    // Calculate distance from origin to midpoint
    const midpointDist = midpoint.length();

    // Sphere radius is 1.0, beacon height is BEACON_HEIGHT above surface
    // Minimum height for control point to clear sphere surface
    const sphereRadius = 1.0;
    const minHeight = sphereRadius + BEACON_HEIGHT * 0.5; // Halfway between surface and beacon

    // Lift control point to at least minHeight from origin
    const liftAmount = Math.max(0, minHeight - midpointDist);
    const controlPoint = midpoint.clone().add(midpointDir.multiplyScalar(liftAmount + 0.1));

    // Create quadratic bezier curve
    const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.008, 8, false);
    const tubeMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tubeSegments.push({ mesh: tube, material: tubeMaterial, index: i });

    // Add to sequencer group
    sequencerGroup.add(tube);
  }

  // Rebuild sampling geometry
  rebuildSamplingGeometry();
}

// Track current step for glow animation
let currentStep = 0;
let stepStartTime = 0;
let lastPluckedStep = -1; // Track which step was last plucked to avoid duplicates

/**
 * Update the glow effect for the current step in the sequence
 * Animates beacon poles and tube connections
 */
function updateSequenceGlow() {
  if (!sequencerRunning) {
    // Reset all tubes and beacons to dim state when stopped
    tubeSegments.forEach(seg => {
      seg.material.opacity = 0.6;
      seg.material.color.setHex(0xff0000);
    });

    // Reset beacon elements to default state
    beaconElements.forEach(element => {
      element.topSphere.material.opacity = 0.9;
      element.topSphere.material.color.setHex(0xff0000);
      element.topSphere.scale.setScalar(1.0);
    });
    return;
  }

  const now = performance.now();
  const timeSinceStepStart = now - stepStartTime;
  const progress = Math.min(timeSinceStepStart / STEP_MS, 1.0);

  // Calculate next step
  const nextStep = (currentStep + 1) % MIDI_STEPS;

  // Update all tube segments
  tubeSegments.forEach(seg => {
    if (seg.index === currentStep) {
      // Current tube segment: bright and fading
      const fade = 1.0 - progress * 0.5; // Fade from 1.0 to 0.5
      seg.material.opacity = 0.6 + fade * 0.4; // 0.6 to 1.0
      seg.material.color.setRGB(1.0, 0.4 * fade, 0);
    } else if (seg.index === nextStep) {
      // Next tube segment: fading in
      seg.material.opacity = 0.6 + progress * 0.3;
      seg.material.color.setRGB(1.0, 0.2 + progress * 0.2, 0);
    } else {
      // All other tubes: dim
      seg.material.opacity = 0.6;
      seg.material.color.setHex(0xff0000);
    }
  });

  // Update beacon elements
  beaconElements.forEach((element, i) => {
    if (i === currentStep) {
      // Current beacon: bright and pulsing
      const brightness = 1.0 - progress * 0.3;
      element.topSphere.material.opacity = 1.0;
      element.topSphere.material.color.setRGB(1.0, 0.3 * brightness, 0);
      // Pulse the size
      const scale = 1.0 + Math.sin(progress * Math.PI) * 0.5;
      element.topSphere.scale.setScalar(scale);
    } else if (i === nextStep) {
      // Next beacon: fading in
      element.topSphere.material.opacity = 0.9 + progress * 0.1;
      element.topSphere.material.color.setRGB(1.0, 0.1 + progress * 0.2, 0);
      const scale = 1.0 + progress * 0.3;
      element.topSphere.scale.setScalar(scale);
    } else {
      // All other beacons: dim
      element.topSphere.material.opacity = 0.9;
      element.topSphere.material.color.setHex(0xff0000);
      element.topSphere.scale.setScalar(1.0);
    }
  });

  // Advance to next step when time is up
  if (timeSinceStepStart >= STEP_MS) {
    currentStep = (currentStep + 1) % MIDI_STEPS;
    stepStartTime = now;

    // Pluck the string for the new current step
    // Only pluck if we haven't already plucked this step (prevents duplicate plucks)
    if (currentStep !== lastPluckedStep) {
      pluckString(currentStep, 80);
      lastPluckedStep = currentStep;
    }
  }
}

// ============================================================================
// GPU SAMPLING SETUP
// ============================================================================

/**
 * Create a minimal render target for sampling noise values.
 * We render just the sample points to extract their noise values.
 */
let samplingTarget = new THREE.WebGLRenderTarget(MIDI_STEPS, 1, {
  minFilter: THREE.NearestFilter,
  magFilter: THREE.NearestFilter,
  format: THREE.RGBAFormat,
  type: THREE.UnsignedByteType
});

// Create a camera and scene for sampling
const samplingScene = new THREE.Scene();
const samplingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
samplingCamera.position.z = 1;

// Create sampling geometry: one pixel per sample point
let samplingGeometry = new THREE.BufferGeometry();
let samplingPoints = null;

// Sampling shader - evaluates noise at specific world positions
const samplingMaterial = new THREE.ShaderMaterial({
  uniforms: {
    uSpatialScale: material.uniforms.uSpatialScale,
    uTimeScale: material.uniforms.uTimeScale,
    uTime: material.uniforms.uTime,
    uDisplacementAmount: material.uniforms.uDisplacementAmount
  },
  vertexShader: /* glsl */`
    attribute vec3 worldPosition;
    varying vec3 vWorldPos;

    void main() {
      vWorldPos = worldPosition;
      gl_Position = vec4(position.xy, 0.0, 1.0);
      gl_PointSize = 1.0;
    }
  `,
  fragmentShader: /* glsl */`
    precision highp float;

    varying vec3 vWorldPos;

    uniform float uSpatialScale;
    uniform float uTimeScale;
    uniform float uTime;

    // ========================================================================
    // 3D SIMPLEX NOISE IMPLEMENTATION (same as main shader)
    // ========================================================================

    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x * 34.0) + 1.0) * x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float snoise3d(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }

    uniform float uDisplacementAmount;

    void main() {
      // Sample 3D noise at world position with time animation
      vec3 p = vWorldPos * uSpatialScale + vec3(0.0, 0.0, uTime * uTimeScale);
      float noise = snoise3d(p);

      // Calculate displacement (same as vertex shader)
      float displacement = noise * uDisplacementAmount;

      // Calculate radial depth: original radius (1.0) + displacement
      // Normalize vWorldPos to get the direction, then add displacement
      vec3 normalizedPos = normalize(vWorldPos);
      float baseRadius = length(vWorldPos); // Should be ~1.0 for sphere surface
      float actualRadius = baseRadius + displacement;

      // Map radius to [0, 1] range for MIDI
      // Center (radius 1.0) = 0.5, mountains > 0.5, valleys < 0.5
      float value = (actualRadius - (1.0 - uDisplacementAmount)) / (uDisplacementAmount * 2.0);
      value = clamp(value, 0.0, 1.0);

      // Output the radial depth value
      gl_FragColor = vec4(vec3(value), 1.0);
    }
  `
});

/**
 * Rebuild sampling geometry when step count changes
 */
function rebuildSamplingGeometry() {
  // Dispose old geometry
  if (samplingGeometry) {
    samplingGeometry.dispose();
  }

  // Recreate render target with new size
  if (samplingTarget) {
    samplingTarget.dispose();
  }
  samplingTarget = new THREE.WebGLRenderTarget(MIDI_STEPS, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  });

  // Create new geometry
  samplingGeometry = new THREE.BufferGeometry();
  const samplingPositions = new Float32Array(MIDI_STEPS * 3);

  samplePoints.forEach((point, i) => {
    // Map sample points to screen space [-1, 1]
    const x = (i / MIDI_STEPS) * 2 - 1 + (1 / MIDI_STEPS);
    samplingPositions[i * 3] = x;
    samplingPositions[i * 3 + 1] = 0;
    samplingPositions[i * 3 + 2] = 0;
  });

  samplingGeometry.setAttribute('position', new THREE.BufferAttribute(samplingPositions, 3));

  // Store world positions as attribute
  const worldPositions = new Float32Array(MIDI_STEPS * 3);
  samplePoints.forEach((point, i) => {
    worldPositions[i * 3] = point.x;
    worldPositions[i * 3 + 1] = point.y;
    worldPositions[i * 3 + 2] = point.z;
  });
  samplingGeometry.setAttribute('worldPosition', new THREE.BufferAttribute(worldPositions, 3));

  // Recreate sampling points mesh
  if (samplingPoints) {
    samplingScene.remove(samplingPoints);
  }
  samplingPoints = new THREE.Points(samplingGeometry, samplingMaterial);
  samplingScene.add(samplingPoints);
}

// Initialize beacons and tubes after all sampling infrastructure is ready
rebuildBeaconsAndTubes();

// ============================================================================
// MIDI SAMPLING FUNCTION
// ============================================================================

/**
 * Sample the 3D noise field at our fixed spatial coordinates.
 * Returns an array of 16 noise values [0..1].
 */
function sampleNoiseFromGPU() {
  const pixelBuffer = new Uint8Array(MIDI_STEPS * 4);
  
  // Render sample points to offscreen target
  renderer.setRenderTarget(samplingTarget);
  renderer.render(samplingScene, samplingCamera);
  renderer.setRenderTarget(null);
  
  // Read pixel data
  renderer.readRenderTargetPixels(
    samplingTarget,
    0, 0,
    MIDI_STEPS, 1,
    pixelBuffer
  );
  
  // Extract values
  const values = [];
  for (let i = 0; i < MIDI_STEPS; i++) {
    const r = pixelBuffer[i * 4];
    values.push(r / 255);
  }
  
  return values;
}

// ============================================================================
// INTERACTIVE STRING CONTROLS
// ============================================================================

// Raycaster for detecting mouse interaction with tube strings
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const mouse3D = new THREE.Vector3();
let hoveredString = null;
let activeString = null;

// String physics state - stores vibration data for each string
const stringPhysics = [];

/**
 * Initialize physics state for a string
 */
function initStringPhysics(index) {
  return {
    index: index,
    displacement: new THREE.Vector3(0, 0, 0), // Current displacement from rest
    velocity: new THREE.Vector3(0, 0, 0),      // Current velocity
    isVibrating: false,
    dampening: 0.95,  // Energy loss per frame (0-1)
    stiffness: 0.3,   // Spring force (how quickly it returns to center)
    originalCurve: null // Store original curve for restoration
  };
}

/**
 * Send MIDI pitch bend message
 * @param {number} channel - MIDI channel (0-15)
 * @param {number} value - Pitch bend value (0-16383, center is 8192)
 */
function sendPitchBend(channel, value) {
  if (!midiOutput) return;

  // Clamp value to valid range
  const clampedValue = Math.max(0, Math.min(16383, Math.round(value)));

  // Pitch bend is 14-bit: split into LSB and MSB
  const lsb = clampedValue & 0x7F;
  const msb = (clampedValue >> 7) & 0x7F;

  // Send pitch bend message (0xE0 + channel)
  midiOutput.send([0xE0 | channel, lsb, msb]);
}

/**
 * Get 3D world position from mouse intersection
 */
function getMouseWorldPosition(intersectPoint) {
  // Project the intersection point to get a 3D world position
  return intersectPoint.clone();
}

/**
 * Update mouse position in normalized device coordinates (-1 to +1)
 */
function onMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update raycaster
  raycaster.setFromCamera(mouse, camera);

  // Priority 1: If molding sphere with Shift key, handle that
  if (isMoldingSphere && event.shiftKey) {
    // IMPORTANT: Update moldRaycaster with current mouse position
    moldRaycaster.setFromCamera(mouse, camera);
    const sphereIntersects = moldRaycaster.intersectObject(noiseMesh);
    if (sphereIntersects.length > 0) {
      const intersectPoint = sphereIntersects[0].point;

      // Transform intersection point to local space (account for rotation group)
      const localPoint = noiseRotationGroup.worldToLocal(intersectPoint.clone());

      // Add deformation at intersection point
      addClayDeformation(localPoint, clayPushStrength);

      lastMoldPoint = localPoint.clone();
    }
    return; // Don't process string interaction while molding
  }

  // Priority 2: Handle string interaction (existing code)
  // Get all tube meshes
  const tubeMeshes = tubeSegments.map(seg => seg.mesh);

  // Check for intersections
  const intersects = raycaster.intersectObjects(tubeMeshes);

  // Reset previous hover state
  if (hoveredString !== null && !activeString) {
    const prevSeg = tubeSegments[hoveredString];
    if (prevSeg) {
      prevSeg.material.opacity = 0.6;
      prevSeg.material.color.setHex(0xff0000);
    }
  }

  if (intersects.length > 0) {
    // Find which tube segment was hit
    const hitMesh = intersects[0].object;
    const segmentIndex = tubeSegments.findIndex(seg => seg.mesh === hitMesh);

    if (segmentIndex !== -1) {
      hoveredString = segmentIndex;

      // Store 3D mouse position for string dragging
      mouse3D.copy(getMouseWorldPosition(intersects[0].point));

      // Visual feedback - highlight the string
      const seg = tubeSegments[segmentIndex];
      if (!activeString || activeString.index !== segmentIndex) {
        seg.material.opacity = 0.9;
        seg.material.color.setRGB(1.0, 0.8, 0.2);
      }

      // If actively dragging, update the string deformation
      if (activeString && activeString.index === segmentIndex) {
        updateStringDeformation(segmentIndex, mouse3D);
      }
    }
  } else {
    hoveredString = null;
  }
}

/**
 * Deform the string curve based on mouse drag position
 */
function updateStringDeformation(stringIndex, dragPosition) {
  const seg = tubeSegments[stringIndex];
  const physics = stringPhysics[stringIndex];

  if (!seg || !physics) return;

  // Get the string's start and end points
  const start = beaconTops[stringIndex];
  const nextIndex = (stringIndex + 1) % MIDI_STEPS;
  const end = beaconTops[nextIndex];

  // Calculate original midpoint
  const originalMidpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Calculate displacement from mouse drag
  const displacement = new THREE.Vector3().subVectors(dragPosition, originalMidpoint);

  // Store displacement for physics simulation
  physics.displacement.copy(displacement);

  // Create new control point with displacement
  const midpointDir = originalMidpoint.clone().normalize();
  const baseControlPoint = originalMidpoint.clone().add(midpointDir.multiplyScalar(0.15));
  const newControlPoint = baseControlPoint.clone().add(displacement);

  // Update the tube geometry with deformed curve
  const newCurve = new THREE.QuadraticBezierCurve3(start, newControlPoint, end);

  // Dispose old geometry and create new one
  seg.mesh.geometry.dispose();
  seg.mesh.geometry = new THREE.TubeGeometry(newCurve, 20, 0.008, 8, false);

  // Store original curve if not already stored
  if (!physics.originalCurve) {
    const originalControlPoint = originalMidpoint.clone().add(midpointDir.multiplyScalar(0.15));
    physics.originalCurve = new THREE.QuadraticBezierCurve3(start, originalControlPoint, end);
  }
}

/**
 * Handle mouse down - activate string or start molding sphere
 */
function onMouseDown(event) {
  // Check if Shift key is held for sphere molding
  if (event.shiftKey) {
    moldRaycaster.setFromCamera(mouse, camera);
    const sphereIntersects = moldRaycaster.intersectObject(noiseMesh);

    if (sphereIntersects.length > 0) {
      isMoldingSphere = true;
      controls.enabled = false; // Disable orbit controls while molding

      const intersectPoint = sphereIntersects[0].point;
      const localPoint = noiseRotationGroup.worldToLocal(intersectPoint.clone());

      // Add initial deformation
      addClayDeformation(localPoint, clayPushStrength);
      lastMoldPoint = localPoint.clone();

      console.log('🎨 Clay molding started - hold Shift and drag');
      return;
    }
  }

  // Regular string interaction
  if (hoveredString !== null) {
    const seg = tubeSegments[hoveredString];
    activeString = {
      index: hoveredString,
      startY: mouse.y,
      baseOpacity: seg.material.opacity,
      initialDragPoint: mouse3D.clone()
    };

    // Initialize physics for this string if not already done
    if (!stringPhysics[hoveredString]) {
      stringPhysics[hoveredString] = initStringPhysics(hoveredString);
    }

    // Visual feedback - brighten the string
    seg.material.opacity = 1.0;
    seg.material.color.setRGB(1.0, 1.0, 0.4);

    console.log(`🎸 String ${hoveredString} activated`);
  }
}

/**
 * Handle mouse up - deactivate string and start vibration, or stop molding
 */
function onMouseUp(event) {
  // Stop molding if active
  if (isMoldingSphere) {
    isMoldingSphere = false;
    controls.enabled = true; // Re-enable orbit controls
    lastMoldPoint = null;
    console.log('🎨 Clay molding stopped');
    return;
  }

  // Regular string release
  if (activeString !== null) {
    const seg = tubeSegments[activeString.index];
    const physics = stringPhysics[activeString.index];

    // Calculate release velocity based on displacement
    // This gives the string initial momentum for vibration
    if (physics) {
      const releaseStrength = 0.5; // Adjust for more/less vibration
      physics.velocity.copy(physics.displacement).multiplyScalar(-releaseStrength);
      physics.isVibrating = true;
    }

    // Reset visual state (will be updated during vibration)
    seg.material.opacity = 0.8;

    console.log(`🎸 String ${activeString.index} released - vibrating`);
    activeString = null;
  }
}

/**
 * Pluck a string to start vibration (called when sequencer plays a note)
 * @param {number} stringIndex - Index of the string to pluck
 * @param {number} velocity - MIDI velocity (0-127) controls pluck strength
 */
function pluckString(stringIndex, velocity = 80) {
  // Initialize physics for this string if not already done
  if (!stringPhysics[stringIndex]) {
    stringPhysics[stringIndex] = initStringPhysics(stringIndex);
  }

  const physics = stringPhysics[stringIndex];
  const seg = tubeSegments[stringIndex];

  if (!physics || !seg) return;

  // Get string orientation to determine pluck direction
  const start = beaconTops[stringIndex];
  const nextIndex = (stringIndex + 1) % MIDI_STEPS;
  const end = beaconTops[nextIndex];
  const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

  // Calculate perpendicular direction for pluck
  // Use cross product to get a direction perpendicular to both the string and radial direction
  const stringDirection = new THREE.Vector3().subVectors(end, start).normalize();
  const radialDirection = midpoint.clone().normalize();
  const pluckDirection = new THREE.Vector3().crossVectors(stringDirection, radialDirection).normalize();

  // Vary pluck direction slightly based on string index for visual variety
  const rotationAngle = (stringIndex / MIDI_STEPS) * Math.PI * 2;
  pluckDirection.applyAxisAngle(stringDirection, rotationAngle);

  // Set initial displacement based on velocity (normalized 0-1)
  const pluckStrength = (velocity / 127) * 0.15; // Max displacement of 0.15 units
  physics.displacement.copy(pluckDirection.multiplyScalar(pluckStrength));

  // Set initial velocity for the pluck (opposite to displacement for spring motion)
  const initialVelocity = 0.3; // Adjust for more/less initial vibration speed
  physics.velocity.copy(physics.displacement).multiplyScalar(-initialVelocity);

  // Start vibration
  physics.isVibrating = true;

  // Store original curve if not already stored
  if (!physics.originalCurve) {
    const originalMidpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const midpointDir = originalMidpoint.clone().normalize();
    const originalControlPoint = originalMidpoint.clone().add(midpointDir.multiplyScalar(0.15));
    physics.originalCurve = new THREE.QuadraticBezierCurve3(start, originalControlPoint, end);
  }

  console.log(`🎸 String ${stringIndex} plucked with velocity ${velocity}`);
}

/**
 * Simulate spring physics for vibrating strings
 */
function updateStringPhysics() {
  for (let i = 0; i < stringPhysics.length; i++) {
    const physics = stringPhysics[i];
    if (!physics || !physics.isVibrating) continue;

    const seg = tubeSegments[i];
    if (!seg) continue;

    // Spring force: F = -k * displacement (Hooke's law)
    const springForce = physics.displacement.clone().multiplyScalar(-physics.stiffness);

    // Update velocity with spring force
    physics.velocity.add(springForce);

    // Apply dampening (energy loss)
    physics.velocity.multiplyScalar(physics.dampening);

    // Update displacement based on velocity
    physics.displacement.add(physics.velocity);

    // Check if vibration has nearly stopped
    const energy = physics.displacement.length() + physics.velocity.length();
    if (energy < 0.001) {
      // Stop vibrating and reset to original position
      physics.isVibrating = false;
      physics.displacement.set(0, 0, 0);
      physics.velocity.set(0, 0, 0);

      // Reset visual state
      seg.material.opacity = 0.6;
      seg.material.color.setHex(0xff0000);

      // Reset geometry to original curve
      if (physics.originalCurve) {
        seg.mesh.geometry.dispose();
        seg.mesh.geometry = new THREE.TubeGeometry(physics.originalCurve, 20, 0.008, 8, false);
      }

      // Reset pitch bend
      sendPitchBend(0, 8192);
      continue;
    }

    // Update geometry with current displacement
    const start = beaconTops[i];
    const nextIndex = (i + 1) % MIDI_STEPS;
    const end = beaconTops[nextIndex];

    const originalMidpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const midpointDir = originalMidpoint.clone().normalize();
    const baseControlPoint = originalMidpoint.clone().add(midpointDir.multiplyScalar(0.15));
    const newControlPoint = baseControlPoint.clone().add(physics.displacement);

    const newCurve = new THREE.QuadraticBezierCurve3(start, newControlPoint, end);
    seg.mesh.geometry.dispose();
    seg.mesh.geometry = new THREE.TubeGeometry(newCurve, 20, 0.008, 8, false);

    // Visual feedback based on displacement
    const displacementAmount = physics.displacement.length();
    seg.material.opacity = 0.6 + Math.min(displacementAmount * 2.0, 0.4);

    // Color oscillation during vibration
    const colorPhase = Math.abs(Math.sin(performance.now() * 0.01));
    seg.material.color.setRGB(1.0, 0.2 + colorPhase * 0.6, 0.2 + colorPhase * 0.6);

    // Send pitch bend based on displacement
    const bendSensitivity = 8000;
    const bendAmount = physics.displacement.length() * bendSensitivity;
    const pitchBendValue = 8192 + bendAmount * (physics.velocity.length() > 0 ? 1 : -1);
    sendPitchBend(0, pitchBendValue);
  }
}

/**
 * Update pitch bend based on active string interaction
 */
function updateStringInteraction() {
  if (activeString !== null) {
    // Calculate displacement from initial click position
    const displacement = mouse.y - activeString.startY;

    // Map displacement to pitch bend range
    // displacement range: roughly -1 to +1 (full screen drag)
    // pitch bend range: 0 to 16383 (center is 8192)

    // Scale factor: how sensitive the pitch bend is to mouse movement
    const sensitivity = 4096; // +/- 1 semitone at max displacement
    const pitchBendValue = 8192 + (displacement * sensitivity);

    sendPitchBend(0, pitchBendValue);

    // Visual feedback based on bend amount
    const seg = tubeSegments[activeString.index];
    const bendAmount = Math.abs(displacement);
    seg.material.opacity = Math.min(1.0, 0.8 + bendAmount);

    // Color shift based on bend direction
    if (displacement > 0) {
      // Bend up - shift towards cyan
      seg.material.color.setRGB(0.4, 1.0, 1.0);
    } else if (displacement < 0) {
      // Bend down - shift towards magenta
      seg.material.color.setRGB(1.0, 0.4, 1.0);
    }
  }
}

// Add event listeners
renderer.domElement.addEventListener('mousemove', onMouseMove);
renderer.domElement.addEventListener('mousedown', onMouseDown);
renderer.domElement.addEventListener('mouseup', onMouseUp);

// ============================================================================
// WEBMIDI SETUP
// ============================================================================

let midiOutput = null;
let midiInput = null;
let sequencerRunning = false;
let midiInputEnabled = true; // Toggle for MIDI input processing

// MIDI Input state tracking
const midiInputState = {
  activeNotes: new Map(), // Map of note -> {velocity, sensorIndex}
  pitchBend: 0, // -1 to 1
  modWheel: 0, // 0 to 1
  expression: 1.0 // 0 to 1
};

// MIDI Input activity log
const midiActivityLog = [];
const MAX_MIDI_LOG_ENTRIES = 10;

function logMIDIActivity(message) {
  midiActivityLog.unshift(message);
  if (midiActivityLog.length > MAX_MIDI_LOG_ENTRIES) {
    midiActivityLog.pop();
  }

  // Update UI
  const activityDiv = document.getElementById('midiInputActivity');
  if (activityDiv) {
    activityDiv.innerHTML = midiActivityLog.join('<br>');
  }
}

async function initMIDI() {
  if (!('requestMIDIAccess' in navigator)) {
    alert('WebMIDI not supported. Use Chrome/Edge on macOS.');
    return false;
  }

  try {
    const access = await navigator.requestMIDIAccess();

    // Find IAC Driver or first available output
    for (const output of access.outputs.values()) {
      if (output.name.toLowerCase().includes('iac')) {
        midiOutput = output;
        break;
      }
    }

    if (!midiOutput) {
      const firstOutput = access.outputs.values().next();
      if (!firstOutput.done) {
        midiOutput = firstOutput.value;
      }
    }

    if (!midiOutput) {
      alert('No MIDI output found. Enable IAC Driver in Audio MIDI Setup.');
      return false;
    }

    // Setup MIDI Input
    let inputCount = 0;
    for (const input of access.inputs.values()) {
      input.onmidimessage = handleMIDIMessage;
      inputCount++;
      if (!midiInput) {
        midiInput = input;
      }
    }

    console.log('✓ MIDI initialized:', midiOutput.name);
    if (inputCount > 0) {
      console.log(`✓ MIDI Input listening on ${inputCount} device(s)`);
    }
    return true;
  } catch (err) {
    console.error('MIDI error:', err);
    alert('MIDI initialization failed: ' + err.message);
    return false;
  }
}

/**
 * Handle incoming MIDI messages
 */
function handleMIDIMessage(event) {
  // Ignore MIDI input if disabled
  if (!midiInputEnabled) {
    return;
  }

  const [status, data1, data2] = event.data;
  const command = status & 0xF0;

  switch (command) {
    case 0x90: // Note On
      if (data2 > 0) { // velocity > 0
        handleMIDINoteOn(data1, data2);
      } else {
        handleMIDINoteOff(data1);
      }
      break;

    case 0x80: // Note Off
      handleMIDINoteOff(data1);
      break;

    case 0xE0: // Pitch Bend
      handleMIDIPitchBend(data1, data2);
      break;

    case 0xB0: // Control Change
      handleMIDIControlChange(data1, data2);
      break;
  }
}

/**
 * Handle incoming MIDI Note On
 */
function handleMIDINoteOn(note, velocity) {
  // Map MIDI note to sensor index
  const sensorIndex = mapNoteToSensor(note);

  // Store active note
  midiInputState.activeNotes.set(note, { velocity, sensorIndex });

  // Trigger visual feedback on corresponding sensor
  if (sensorIndex >= 0 && sensorIndex < beaconElements.length) {
    // Pluck string to start vibration
    pluckString(sensorIndex, velocity);

    // Highlight beacon
    const beaconElement = beaconElements[sensorIndex];
    if (beaconElement && beaconElement.topSphere) {
      beaconElement.topSphere.material.opacity = 1.0;
    }
  }

  // Send note through to output (MIDI thru)
  if (midiOutput) {
    midiOutput.send([0x90, note, velocity]);
  }

  logMIDIActivity(`Note On: ${note} (vel: ${velocity}) → Sensor ${sensorIndex}`);
}

/**
 * Handle incoming MIDI Note Off
 */
function handleMIDINoteOff(note) {
  const noteData = midiInputState.activeNotes.get(note);

  if (noteData) {
    const { sensorIndex } = noteData;

    // Reset beacon opacity when note is released
    if (sensorIndex >= 0 && sensorIndex < beaconElements.length) {
      const beaconElement = beaconElements[sensorIndex];
      if (beaconElement && beaconElement.topSphere) {
        beaconElement.topSphere.material.opacity = 0.6;
      }
    }

    midiInputState.activeNotes.delete(note);
    logMIDIActivity(`Note Off: ${note}`);
  }

  // Send note off through to output
  if (midiOutput) {
    midiOutput.send([0x80, note, 0]);
  }
}

/**
 * Handle incoming MIDI Pitch Bend
 */
function handleMIDIPitchBend(lsb, msb) {
  // Convert 14-bit pitch bend to -1..1 range
  const value14bit = (msb << 7) | lsb;
  midiInputState.pitchBend = (value14bit - 8192) / 8192;

  // Apply pitch bend to all active notes' strings
  for (const [, noteData] of midiInputState.activeNotes) {
    const { sensorIndex } = noteData;
    if (sensorIndex >= 0 && sensorIndex < stringPhysics.length) {
      const physics = stringPhysics[sensorIndex];
      if (physics && physics.isVibrating) {
        // Add additional displacement based on pitch bend (scaled and clamped)
        const bendAmount = Math.max(-0.05, Math.min(0.05, midiInputState.pitchBend * 0.05));
        const bendVector = new THREE.Vector3(bendAmount, 0, 0);
        physics.displacement.add(bendVector);

        // Clamp total displacement to prevent excessive vibration
        const maxDisplacement = 0.2;
        const currentMagnitude = physics.displacement.length();
        if (currentMagnitude > maxDisplacement) {
          physics.displacement.normalize().multiplyScalar(maxDisplacement);
        }
      }
    }
  }

  // Send pitch bend through to output
  if (midiOutput) {
    midiOutput.send([0xE0, lsb, msb]);
  }

  logMIDIActivity(`Pitch Bend: ${midiInputState.pitchBend.toFixed(2)}`);
}

/**
 * Handle incoming MIDI Control Change
 */
function handleMIDIControlChange(controller, value) {
  const ccNames = {
    1: 'Mod Wheel',
    11: 'Expression',
    64: 'Sustain'
  };

  switch (controller) {
    case 1: // Mod Wheel
      midiInputState.modWheel = value / 127;
      // Apply modulation to spatial scale (vibrato effect on noise)
      material.uniforms.uSpatialScale.value = 1.0 + (midiInputState.modWheel * 0.5);
      logMIDIActivity(`CC${controller} (${ccNames[controller]}): ${value} → Spatial Scale`);
      break;

    case 11: // Expression
      midiInputState.expression = value / 127;
      // Apply expression to displacement amount
      material.uniforms.uDisplacementAmount.value = 0.15 * midiInputState.expression;
      logMIDIActivity(`CC${controller} (${ccNames[controller]}): ${value} → Displacement`);
      break;

    case 64: // Sustain Pedal
      logMIDIActivity(`CC${controller} (${ccNames[controller]}): ${value}`);
      break;

    default:
      logMIDIActivity(`CC${controller}: ${value}`);
      break;
  }

  // Send CC through to output
  if (midiOutput) {
    midiOutput.send([0xB0, controller, value]);
  }
}

/**
 * Map MIDI note number to sensor index
 * Uses current scale and distributes notes across sensors
 */
function mapNoteToSensor(midiNote) {
  // Quantize to current scale
  const quantizedNote = quantizeToScale(midiNote);

  // Map note range to sensor indices
  const noteRange = MAX_NOTE - MIN_NOTE;
  const normalizedNote = (quantizedNote - MIN_NOTE) / noteRange;

  return Math.floor(normalizedNote * MIDI_STEPS) % MIDI_STEPS;
}

function noteOn(note, velocity = 80, time = 0) {
  if (midiOutput) {
    midiOutput.send([0x90, note, velocity], time);
  }
}

function noteOff(note, time = 0) {
  if (midiOutput) {
    midiOutput.send([0x80, note, 0], time);
  }
}

/**
 * Map noise value [0..1] to MIDI note [12..84]
 */
function noiseToMidiNote(value) {
  const clamped = Math.max(0, Math.min(1, value));
  const rawNote = Math.round(MIN_NOTE + clamped * (MAX_NOTE - MIN_NOTE));
  return quantizeToScale(rawNote);
}

// ============================================================================
// SEQUENCER
// ============================================================================

function scheduleNoiseSequence() {
  if (!midiOutput) return;

  // Skip scheduling if BPM is 0 (STEP_MS would be Infinity)
  if (!isFinite(STEP_MS)) return;

  const noiseValues = sampleNoiseFromGPU();
  const now = performance.now();

  let cumulativeTime = 0; // Track cumulative time for tied notes

  for (let i = 0; i < MIDI_STEPS; i++) {
    const params = stepParameters[i];

    // Skip if step is inactive (rest)
    if (!params.active) {
      cumulativeTime += STEP_MS;
      continue;
    }

    // Determine note value
    let note;
    if (params.scaleDegree !== null && scaleEnabled) {
      // Use forced scale degree (I-VII)
      note = scaleDegreeToMidiNote(params.scaleDegree);
    } else {
      // Use noise value
      const value = noiseValues[i];
      note = noiseToMidiNote(value);
    }

    // Determine velocity
    const velocity = params.velocity !== null ? params.velocity : 80;

    // Calculate note duration
    let duration = STEP_MS;

    // Apply dotted note (1.5x duration)
    if (params.dotted) {
      duration *= 1.5;
    }

    // Check if next step is tied
    let extendedDuration = duration;
    if (params.tie && i < MIDI_STEPS - 1) {
      // Count consecutive tied steps
      let tieCount = 1;
      for (let j = i + 1; j < MIDI_STEPS; j++) {
        if (stepParameters[j].tie && j < MIDI_STEPS - 1) {
          tieCount++;
        } else {
          // Include the last tied step's duration
          tieCount++;
          break;
        }
      }
      extendedDuration = STEP_MS * tieCount;
    }

    const tOn = now + cumulativeTime;
    const tOff = tOn + extendedDuration * 0.95; // 95% to avoid overlap

    noteOn(note, velocity, tOn);
    noteOff(note, tOff);

    cumulativeTime += STEP_MS;
  }

  // Note: String plucking is now handled by updateSequenceGlow()
  // to keep it perfectly synchronized with the beacon animation
}

let sequencerTimeoutId = null;

function startSequencer() {
  if (sequencerRunning) return;
  sequencerRunning = true;

  // Initialize step tracking for glow animation
  currentStep = 0;
  stepStartTime = performance.now();

  function loop() {
    if (!sequencerRunning) return;

    scheduleNoiseSequence();

    // Calculate next schedule time based on current BPM (recalculated each loop)
    // This ensures tempo changes are reflected immediately
    const barMs = STEP_MS * MIDI_STEPS;

    sequencerTimeoutId = setTimeout(loop, barMs);
  }

  loop();
  console.log('▶ Sequencer started');
}

function stopSequencer() {
  sequencerRunning = false;
  if (sequencerTimeoutId !== null) {
    clearTimeout(sequencerTimeoutId);
    sequencerTimeoutId = null;
  }
  console.log('⏹ Sequencer stopped');
}

// ============================================================================
// UI CONTROLS
// ============================================================================

const startBtn = document.getElementById('startBtn');
let started = false;

startBtn.addEventListener('click', async () => {
  if (!started) {
    const success = await initMIDI();
    if (!success) return;

    startSequencer();
    startBtn.textContent = '⏹ Stop Sequencer';
    started = true;
  } else {
    stopSequencer();
    startBtn.textContent = '▶ Start MIDI Sequencer';
    started = false;
  }
});

// Steps slider
const stepsSlider = document.getElementById('stepsSlider');
const stepsValueDisplay = document.getElementById('stepsValue');

stepsSlider.addEventListener('input', (e) => {
  const wasRunning = sequencerRunning;
  if (wasRunning) {
    stopSequencer();
  }

  MIDI_STEPS = parseInt(e.target.value);
  stepsValueDisplay.textContent = MIDI_STEPS;

  // Reinitialize step parameters with new count
  initStepParameters(MIDI_STEPS);

  // Rebuild all geometry with new step count
  rebuildBeaconsAndTubes();

  // Regenerate step buttons
  generateStepButtons();

  // Hide editor if currently editing step is now out of range
  if (currentlyEditingStep !== null && currentlyEditingStep >= MIDI_STEPS) {
    stepEditor.style.display = 'none';
    currentlyEditingStep = null;
  }

  console.log('🎚️ Steps updated to:', MIDI_STEPS);

  if (wasRunning) {
    startSequencer();
  }
});

// Time signature controls
const numeratorSlider = document.getElementById('numeratorSlider');
const denominatorSlider = document.getElementById('denominatorSlider');
const timeSigValueDisplay = document.getElementById('timeSigValue');
const newComplexityToggle = document.getElementById('newComplexityToggle');
const stockhausenPreset = document.getElementById('stockhausenPreset');

// Denominator mappings
const RATIONAL_DENOMINATORS = [2, 4, 8, 16, 32, 64, 128, 256];
const IRRATIONAL_DENOMINATORS = [2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 20, 24, 32, 48, 64, 96, 128, 192, 256];

function getDenominatorFromSlider(sliderValue, useIrrational) {
  const denominators = useIrrational ? IRRATIONAL_DENOMINATORS : RATIONAL_DENOMINATORS;
  const index = Math.min(sliderValue - 1, denominators.length - 1);
  return denominators[index];
}

function getSliderFromDenominator(denominator, useIrrational) {
  const denominators = useIrrational ? IRRATIONAL_DENOMINATORS : RATIONAL_DENOMINATORS;
  const index = denominators.indexOf(denominator);
  return index >= 0 ? index + 1 : 1;
}

function updateTimeSigDisplay() {
  const actualDenom = getDenominatorFromSlider(parseInt(denominatorSlider.value), newComplexityEnabled);
  timeSigValueDisplay.textContent = `${timeSigNumerator}/${actualDenom}`;

  const ticksPerMeasure = calculateTicksPerMeasure();
  console.log(`🎼 Time signature: ${timeSigNumerator}/${actualDenom} | PPQN: ${PPQN} | Ticks/measure: ${ticksPerMeasure.toFixed(2)}`);
}

numeratorSlider.addEventListener('input', (e) => {
  timeSigNumerator = parseInt(e.target.value);
  timeSigDenominator = getDenominatorFromSlider(parseInt(denominatorSlider.value), newComplexityEnabled);
  STEP_MS = calculateStepMS();
  updateTimeSigDisplay();
});

denominatorSlider.addEventListener('input', (e) => {
  timeSigDenominator = getDenominatorFromSlider(parseInt(e.target.value), newComplexityEnabled);
  STEP_MS = calculateStepMS();
  updateTimeSigDisplay();
});

newComplexityToggle.addEventListener('change', (e) => {
  newComplexityEnabled = e.target.checked;

  // Update denominator slider range
  if (newComplexityEnabled) {
    denominatorSlider.max = IRRATIONAL_DENOMINATORS.length;
    // Try to keep similar denominator value
    const currentValue = getDenominatorFromSlider(parseInt(denominatorSlider.value), false);
    denominatorSlider.value = getSliderFromDenominator(currentValue, true);
  } else {
    denominatorSlider.max = RATIONAL_DENOMINATORS.length;
    // Snap to nearest power of 2
    const currentValue = getDenominatorFromSlider(parseInt(denominatorSlider.value), true);
    const nearestPowerOf2 = Math.pow(2, Math.round(Math.log2(currentValue)));
    denominatorSlider.value = getSliderFromDenominator(nearestPowerOf2, false);
  }

  timeSigDenominator = getDenominatorFromSlider(parseInt(denominatorSlider.value), newComplexityEnabled);
  STEP_MS = calculateStepMS();
  updateTimeSigDisplay();

  console.log(`🎭 New Complexity mode: ${newComplexityEnabled ? 'enabled' : 'disabled'}`);
});

// Common time signature presets
const presetButtons = document.querySelectorAll('.preset-btn');

presetButtons.forEach(button => {
  button.addEventListener('click', () => {
    const preset = button.getAttribute('data-preset');
    const [num, denom] = preset.split('/').map(n => parseInt(n));

    // Set numerator
    timeSigNumerator = num;
    numeratorSlider.value = num;

    // Check if denominator requires irrational mode
    const needsIrrational = !RATIONAL_DENOMINATORS.includes(denom);

    if (needsIrrational && !newComplexityEnabled) {
      // Enable irrational mode
      newComplexityToggle.checked = true;
      newComplexityEnabled = true;
      denominatorSlider.max = IRRATIONAL_DENOMINATORS.length;
    } else if (!needsIrrational && newComplexityEnabled) {
      // Disable irrational mode if not needed
      newComplexityToggle.checked = false;
      newComplexityEnabled = false;
      denominatorSlider.max = RATIONAL_DENOMINATORS.length;
    }

    // Set denominator
    denominatorSlider.value = getSliderFromDenominator(denom, newComplexityEnabled);
    timeSigDenominator = denom;

    STEP_MS = calculateStepMS();
    updateTimeSigDisplay();

    console.log(`🎵 Preset activated: ${num}/${denom}`);
  });
});

stockhausenPreset.addEventListener('click', () => {
  // Set to 176/128
  timeSigNumerator = 176;
  numeratorSlider.value = 176;

  // Enable rational mode for 128
  if (newComplexityEnabled) {
    newComplexityToggle.checked = false;
    newComplexityEnabled = false;
    denominatorSlider.max = RATIONAL_DENOMINATORS.length;
  }

  denominatorSlider.value = getSliderFromDenominator(128, false);
  timeSigDenominator = 128;

  STEP_MS = calculateStepMS();
  updateTimeSigDisplay();

  console.log('⚡ Stockhausen preset activated: 176/128');
});

// Spatial Scale slider
const spatialScaleSlider = document.getElementById('spatialScale');
const spatialValueDisplay = document.getElementById('spatialValue');

spatialScaleSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  material.uniforms.uSpatialScale.value = value;
  samplingMaterial.uniforms.uSpatialScale.value = value;
  spatialValueDisplay.textContent = value.toFixed(2);
});

// Time Scale slider
const timeScaleSlider = document.getElementById('timeScale');
const timeValueDisplay = document.getElementById('timeValue');

timeScaleSlider.addEventListener('input', (e) => {
  const value = parseFloat(e.target.value);
  material.uniforms.uTimeScale.value = value;
  samplingMaterial.uniforms.uTimeScale.value = value;
  timeValueDisplay.textContent = value.toFixed(2);
});

// Sensor Distribution slider
const distributionSlider = document.getElementById('distributionSlider');
const distributionValueDisplay = document.getElementById('distributionValue');

distributionSlider.addEventListener('input', (e) => {
  sensorDistribution = parseFloat(e.target.value);
  updateSensorPositions(sensorDistribution);

  // Update display text
  if (sensorDistribution < 0.1) {
    distributionValueDisplay.textContent = 'Line';
  } else if (sensorDistribution > 0.9) {
    distributionValueDisplay.textContent = 'Chaos';
  } else {
    distributionValueDisplay.textContent = Math.round(sensorDistribution * 100) + '%';
  }

  console.log('🎯 Sensor distribution:', sensorDistribution.toFixed(2));
});

// BPM slider
const bpmSlider = document.getElementById('bpmSlider');
const bpmValueDisplay = document.getElementById('bpmValue');

bpmSlider.addEventListener('input', (e) => {
  BPM = parseInt(e.target.value);
  STEP_MS = calculateStepMS();
  bpmValueDisplay.textContent = BPM;
  console.log('🎵 BPM updated to:', BPM);
});

// Sensor Animation slider
const animationSlider = document.getElementById('animationSlider');
const animationValueDisplay = document.getElementById('animationValue');

animationSlider.addEventListener('input', (e) => {
  sensorAnimationSpeed = parseFloat(e.target.value);
  animationValueDisplay.textContent = sensorAnimationSpeed.toFixed(2);
  console.log('🎭 Animation speed:', sensorAnimationSpeed);
});

// Mountain/Valley Height (Displacement) slider
const displacementSlider = document.getElementById('displacementSlider');
const displacementValueDisplay = document.getElementById('displacementValue');

displacementSlider.addEventListener('input', (e) => {
  const displacement = parseFloat(e.target.value);
  material.uniforms.uDisplacementAmount.value = displacement;
  displacementValueDisplay.textContent = displacement.toFixed(2);
  console.log('⛰️ Displacement amount:', displacement);
});

// ============================================================================
// COLOR GRADIENT CONTROLS
// ============================================================================

// Helper function to convert hex color to RGB vector
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255
  } : { r: 0, g: 0, b: 0 };
}

// Helper function to update a color uniform
function updateColorUniform(uniformName, colorInput, alphaInput) {
  const rgb = hexToRgb(colorInput.value);
  const alpha = parseFloat(alphaInput.value);
  material.uniforms[uniformName].value.set(rgb.r, rgb.g, rgb.b, alpha);
}

// Color 1 controls
const color1Input = document.getElementById('color1');
const color1Alpha = document.getElementById('color1Alpha');
const color1AlphaValue = document.getElementById('color1AlphaValue');

color1Input.addEventListener('input', () => {
  updateColorUniform('uColor1', color1Input, color1Alpha);
  console.log('🎨 Color 1 updated');
});

color1Alpha.addEventListener('input', (e) => {
  const alpha = parseFloat(e.target.value);
  color1AlphaValue.textContent = alpha.toFixed(2);
  updateColorUniform('uColor1', color1Input, color1Alpha);
});

// Color 2 controls
const color2Input = document.getElementById('color2');
const color2Alpha = document.getElementById('color2Alpha');
const color2AlphaValue = document.getElementById('color2AlphaValue');

color2Input.addEventListener('input', () => {
  updateColorUniform('uColor2', color2Input, color2Alpha);
  console.log('🎨 Color 2 updated');
});

color2Alpha.addEventListener('input', (e) => {
  const alpha = parseFloat(e.target.value);
  color2AlphaValue.textContent = alpha.toFixed(2);
  updateColorUniform('uColor2', color2Input, color2Alpha);
});

// Color 3 controls
const color3Input = document.getElementById('color3');
const color3Alpha = document.getElementById('color3Alpha');
const color3AlphaValue = document.getElementById('color3AlphaValue');

color3Input.addEventListener('input', () => {
  updateColorUniform('uColor3', color3Input, color3Alpha);
  console.log('🎨 Color 3 updated');
});

color3Alpha.addEventListener('input', (e) => {
  const alpha = parseFloat(e.target.value);
  color3AlphaValue.textContent = alpha.toFixed(2);
  updateColorUniform('uColor3', color3Input, color3Alpha);
});

// Color 4 controls
const color4Input = document.getElementById('color4');
const color4Alpha = document.getElementById('color4Alpha');
const color4AlphaValue = document.getElementById('color4AlphaValue');

color4Input.addEventListener('input', () => {
  updateColorUniform('uColor4', color4Input, color4Alpha);
  console.log('🎨 Color 4 updated');
});

color4Alpha.addEventListener('input', (e) => {
  const alpha = parseFloat(e.target.value);
  color4AlphaValue.textContent = alpha.toFixed(2);
  updateColorUniform('uColor4', color4Input, color4Alpha);
});

// Color 5 controls
const color5Input = document.getElementById('color5');
const color5Alpha = document.getElementById('color5Alpha');
const color5AlphaValue = document.getElementById('color5AlphaValue');

color5Input.addEventListener('input', () => {
  updateColorUniform('uColor5', color5Input, color5Alpha);
  console.log('🎨 Color 5 updated');
});

color5Alpha.addEventListener('input', (e) => {
  const alpha = parseFloat(e.target.value);
  color5AlphaValue.textContent = alpha.toFixed(2);
  updateColorUniform('uColor5', color5Input, color5Alpha);
});

// Scale toggle
const scaleToggle = document.getElementById('scaleToggle');

scaleToggle.addEventListener('change', (e) => {
  scaleEnabled = e.target.checked;
  console.log('🎹 Scale quantization:', scaleEnabled ? 'enabled' : 'disabled');
});

// Key selection
const keySelect = document.getElementById('keySelect');
const keyNames = ['C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab', 'A', 'A#/Bb', 'B'];

keySelect.addEventListener('change', (e) => {
  currentKey = parseInt(e.target.value);
  console.log('🎹 Key changed to:', keyNames[currentKey]);
});

// Scale selection
const scaleSelect = document.getElementById('scaleSelect');

scaleSelect.addEventListener('change', (e) => {
  const scaleName = e.target.value;
  if (SCALES[scaleName]) {
    currentScale = SCALES[scaleName];
    customScalaScale = null; // Clear custom scale when selecting preset
    console.log('🎹 Scale changed to:', scaleName);
  }
});

// Scala file import
const scalaFileInput = document.getElementById('scalaFileInput');
const scalaFileName = document.getElementById('scalaFileName');

scalaFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    customScalaScale = parseScalaFile(text);
    scalaFileName.textContent = `✓ Loaded: ${file.name} (${customScalaScale.length} notes)`;
    scaleToggle.checked = true;
    scaleEnabled = true;
    console.log('🎹 Scala file loaded:', file.name);
    console.log('   Notes:', customScalaScale);
  } catch (err) {
    scalaFileName.textContent = `✗ Error: ${err.message}`;
    console.error('Scala parse error:', err);
  }
});

// ============================================================================
// STEP SEQUENCER PARAMETER UI
// ============================================================================

const stepGrid = document.getElementById('stepGrid');
const stepEditor = document.getElementById('stepEditor');
const editingStepNum = document.getElementById('editingStepNum');
const stepActive = document.getElementById('stepActive');
const stepDotted = document.getElementById('stepDotted');
const stepTie = document.getElementById('stepTie');
const stepScaleDegree = document.getElementById('stepScaleDegree');
const stepVelocity = document.getElementById('stepVelocity');
const stepVelocityValue = document.getElementById('stepVelocityValue');

let currentlyEditingStep = null;

// Generate step buttons
function generateStepButtons() {
  stepGrid.innerHTML = '';
  for (let i = 0; i < MIDI_STEPS; i++) {
    const btn = document.createElement('button');
    btn.textContent = i + 1;
    btn.style.cssText = `
      padding: 8px;
      font-size: 11px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      color: #aaa;
      cursor: pointer;
      transition: all 0.2s;
    `;
    btn.addEventListener('click', () => editStep(i));
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(102, 126, 234, 0.3)';
    });
    btn.addEventListener('mouseleave', () => {
      if (currentlyEditingStep !== i) {
        btn.style.background = 'rgba(255, 255, 255, 0.1)';
      }
    });
    stepGrid.appendChild(btn);
  }
}

// Edit a specific step
function editStep(stepIndex) {
  currentlyEditingStep = stepIndex;
  const params = stepParameters[stepIndex];

  // Update button states
  const buttons = stepGrid.children;
  for (let i = 0; i < buttons.length; i++) {
    buttons[i].style.background = i === stepIndex
      ? 'rgba(102, 126, 234, 0.4)'
      : 'rgba(255, 255, 255, 0.1)';
  }

  // Show editor and populate fields
  stepEditor.style.display = 'block';
  editingStepNum.textContent = stepIndex + 1;

  stepActive.checked = params.active;
  stepDotted.checked = params.dotted;
  stepTie.checked = params.tie;
  stepScaleDegree.value = params.scaleDegree !== null ? params.scaleDegree : '';
  stepVelocity.value = params.velocity !== null ? params.velocity : 80;
  stepVelocityValue.textContent = stepVelocity.value;
}

// Update step parameters when UI changes
stepActive.addEventListener('change', (e) => {
  if (currentlyEditingStep !== null) {
    stepParameters[currentlyEditingStep].active = e.target.checked;
  }
});

stepDotted.addEventListener('change', (e) => {
  if (currentlyEditingStep !== null) {
    stepParameters[currentlyEditingStep].dotted = e.target.checked;
  }
});

stepTie.addEventListener('change', (e) => {
  if (currentlyEditingStep !== null) {
    stepParameters[currentlyEditingStep].tie = e.target.checked;
  }
});

stepScaleDegree.addEventListener('change', (e) => {
  if (currentlyEditingStep !== null) {
    const value = e.target.value;
    stepParameters[currentlyEditingStep].scaleDegree = value ? parseInt(value) : null;
  }
});

stepVelocity.addEventListener('input', (e) => {
  stepVelocityValue.textContent = e.target.value;
  if (currentlyEditingStep !== null) {
    stepParameters[currentlyEditingStep].velocity = parseInt(e.target.value);
  }
});

// Initialize step buttons
generateStepButtons();

// ============================================================================
// CLAY MOLDING UI CONTROLS
// ============================================================================

const clayViscositySlider = document.getElementById('clayViscositySlider');
const clayViscosityValue = document.getElementById('clayViscosityValue');
const clayElasticitySlider = document.getElementById('clayElasticitySlider');
const clayElasticityValue = document.getElementById('clayElasticityValue');
const clayPushSlider = document.getElementById('clayPushSlider');
const clayPushValue = document.getElementById('clayPushValue');
const clayBrushSlider = document.getElementById('clayBrushSlider');
const clayBrushValue = document.getElementById('clayBrushValue');
const resetClayBtn = document.getElementById('resetClayBtn');

clayViscositySlider.addEventListener('input', (e) => {
  clayViscosity = parseFloat(e.target.value);
  clayViscosityValue.textContent = clayViscosity.toFixed(2);
  console.log('🎨 Clay viscosity:', clayViscosity);
});

clayElasticitySlider.addEventListener('input', (e) => {
  clayElasticity = parseFloat(e.target.value);
  clayElasticityValue.textContent = clayElasticity.toFixed(2);
  console.log('🎨 Clay elasticity:', clayElasticity);
});

clayPushSlider.addEventListener('input', (e) => {
  clayPushStrength = parseFloat(e.target.value);
  clayPushValue.textContent = clayPushStrength.toFixed(2);
  console.log('🎨 Clay push strength:', clayPushStrength);
});

clayBrushSlider.addEventListener('input', (e) => {
  clayBrushSize = parseFloat(e.target.value);
  clayBrushValue.textContent = clayBrushSize.toFixed(2);
  console.log('🎨 Clay brush size:', clayBrushSize);
});

resetClayBtn.addEventListener('click', () => {
  resetClayShape();
});

// ============================================================================
// MIDI INPUT TOGGLE
// ============================================================================

const midiInputToggle = document.getElementById('midiInputToggle');
const midiInputStatus = document.getElementById('midiInputStatus');

midiInputToggle.addEventListener('change', (e) => {
  midiInputEnabled = e.target.checked;

  // Update status display
  if (midiInputEnabled) {
    midiInputStatus.style.background = 'rgba(100, 200, 100, 0.1)';
    midiInputStatus.style.borderColor = 'rgba(100, 200, 100, 0.3)';
    midiInputStatus.style.color = '#6c6';
    midiInputStatus.textContent = '✓ MIDI Input listening';
    logMIDIActivity('MIDI Input enabled');
  } else {
    midiInputStatus.style.background = 'rgba(200, 100, 100, 0.1)';
    midiInputStatus.style.borderColor = 'rgba(200, 100, 100, 0.3)';
    midiInputStatus.style.color = '#c66';
    midiInputStatus.textContent = '✗ MIDI Input disabled';

    // Release all active notes
    for (const [note] of midiInputState.activeNotes) {
      handleMIDINoteOff(note);
    }
    midiInputState.activeNotes.clear();

    logMIDIActivity('MIDI Input disabled');
  }

  console.log(`MIDI Input ${midiInputEnabled ? 'enabled' : 'disabled'}`);
});

// ============================================================================
// ANIMATION LOOP
// ============================================================================

function animate() {
  requestAnimationFrame(animate);

  const t = performance.now() / 1000;
  material.uniforms.uTime.value = t;

  // Update sensor positions with cosine animation if enabled
  if (sensorAnimationSpeed > 0) {
    const animatedMix = [];
    for (let i = 0; i < MIDI_STEPS; i++) {
      // Each sensor gets a unique phase offset based on its index
      const phase = (i / MIDI_STEPS) * Math.PI * 2;
      // Create oscillating value between 0 and 1 using cosine
      const cosineValue = (Math.cos(t * sensorAnimationSpeed + phase) + 1.0) / 2.0;
      // Blend with base distribution value
      const blendedValue = sensorDistribution * 0.5 + cosineValue * 0.5;
      animatedMix.push(blendedValue);
    }
    updateSensorPositions(sensorDistribution, animatedMix);
  }

  // Update sequence glow animation
  updateSequenceGlow();

  // Update interactive string pitch bend
  updateStringInteraction();

  // Update string physics (vibration simulation)
  updateStringPhysics();

  // Update clay physics (deformation smoothing and elasticity)
  updateClayPhysics();

  controls.update();

  // Calculate camera rotation delta and apply to noise sphere
  // This keeps sequencer fixed in world space while sphere rotates with orbit
  currentCameraQuaternion.copy(camera.quaternion);

  // Calculate the rotation change (delta) since last frame
  deltaQuaternion.copy(currentCameraQuaternion);
  deltaQuaternion.multiply(previousCameraQuaternion.clone().invert());

  // Apply the inverse delta to noise sphere (rotates opposite to camera)
  const inverseDelta = deltaQuaternion.clone().invert();
  noiseRotationGroup.quaternion.multiply(inverseDelta);

  // Store current quaternion for next frame
  previousCameraQuaternion.copy(currentCameraQuaternion);

  renderer.render(scene, camera);
}

// ============================================================================
// WINDOW RESIZE
// ============================================================================

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// NOISE SHADER PALETTE
// ============================================================================

let currentNoiseType = 'simplex';

// ============================================================================
// GLSL NOISE FUNCTIONS LIBRARY
// ============================================================================

const noiseShaderLibrary = {
  simplex: /* glsl */`
    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x * 34.0) + 1.0) * x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    float noiseFunction(vec3 v) {
      const vec2 C = vec2(1.0/6.0, 1.0/3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + C.xxx;
      vec3 x2 = x0 - i2 + C.yyy;
      vec3 x3 = x0 - D.yyy;

      i = mod289(i);
      vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3 ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ * ns.x + ns.yyyy;
      vec4 y = y_ * ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
  `,

  perlin: /* glsl */`
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    float noiseFunction(vec3 P) {
      vec3 Pi0 = floor(P);
      vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod289(Pi0);
      Pi1 = mod289(Pi1);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = ixy0 * (1.0 / 7.0);
      vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);

      vec4 gx1 = ixy1 * (1.0 / 7.0);
      vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);

      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
      g000 *= norm0.x;
      g010 *= norm0.y;
      g100 *= norm0.z;
      g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
      g001 *= norm1.x;
      g011 *= norm1.y;
      g101 *= norm1.z;
      g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }
  `,

  fbm: /* glsl */`
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    float perlin3d(vec3 P) {
      vec3 Pi0 = floor(P);
      vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod289(Pi0);
      Pi1 = mod289(Pi1);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = ixy0 * (1.0 / 7.0);
      vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);

      vec4 gx1 = ixy1 * (1.0 / 7.0);
      vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);

      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
      g000 *= norm0.x;
      g010 *= norm0.y;
      g100 *= norm0.z;
      g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
      g001 *= norm1.x;
      g011 *= norm1.y;
      g101 *= norm1.z;
      g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }

    float noiseFunction(vec3 p) {
      float value = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;

      for (int i = 0; i < 5; i++) {
        value += perlin3d(p * frequency) * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
      }

      return value;
    }
  `,

  voronoi: /* glsl */`
    vec3 random3(vec3 p) {
      return fract(sin(vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
      )) * 43758.5453123);
    }

    float noiseFunction(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);

      float minDist = 1.0;

      for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec3 neighbor = vec3(float(x), float(y), float(z));
            vec3 point = random3(i + neighbor);
            vec3 diff = neighbor + point - f;
            float dist = length(diff);
            minDist = min(minDist, dist);
          }
        }
      }

      return (minDist - 0.5) * 2.0;
    }
  `,

  ridged: /* glsl */`
    vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
    vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
    vec3 fade(vec3 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

    float perlin3d(vec3 P) {
      vec3 Pi0 = floor(P);
      vec3 Pi1 = Pi0 + vec3(1.0);
      Pi0 = mod289(Pi0);
      Pi1 = mod289(Pi1);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = ixy0 * (1.0 / 7.0);
      vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);

      vec4 gx1 = ixy1 * (1.0 / 7.0);
      vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);

      vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
      vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
      vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
      vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
      vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
      vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
      vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
      vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
      g000 *= norm0.x;
      g010 *= norm0.y;
      g100 *= norm0.z;
      g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
      g001 *= norm1.x;
      g011 *= norm1.y;
      g101 *= norm1.z;
      g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }

    float noiseFunction(vec3 p) {
      float value = 0.0;
      float amplitude = 1.0;
      float frequency = 1.0;

      for (int i = 0; i < 4; i++) {
        float n = abs(perlin3d(p * frequency));
        n = 1.0 - n;
        n = n * n;
        value += n * amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
      }

      return (value - 0.5) * 2.0;
    }
  `,

  cellular: /* glsl */`
    vec3 random3(vec3 p) {
      return fract(sin(vec3(
        dot(p, vec3(127.1, 311.7, 74.7)),
        dot(p, vec3(269.5, 183.3, 246.1)),
        dot(p, vec3(113.5, 271.9, 124.6))
      )) * 43758.5453123);
    }

    float noiseFunction(vec3 p) {
      vec3 i = floor(p);
      vec3 f = fract(p);

      float minDist1 = 1.0;
      float minDist2 = 1.0;

      for (int z = -1; z <= 1; z++) {
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec3 neighbor = vec3(float(x), float(y), float(z));
            vec3 point = random3(i + neighbor);
            vec3 diff = neighbor + point - f;
            float dist = length(diff);

            if (dist < minDist1) {
              minDist2 = minDist1;
              minDist1 = dist;
            } else if (dist < minDist2) {
              minDist2 = dist;
            }
          }
        }
      }

      return ((minDist2 - minDist1) - 0.5) * 4.0;
    }
  `
};

// Perlin noise function (classic Perlin noise)
function perlinNoise2D(x, y) {
  // Simple 2D Perlin-style noise implementation
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);

  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

  // Pseudo-random gradient (simplified)
  const grad = (hash, x, y) => {
    const h = hash & 3;
    return ((h & 1) ? x : -x) + ((h & 2) ? y : -y);
  };

  const hash = (i) => {
    i = (i << 13) ^ i;
    return (i * (i * i * 15731 + 789221) + 1376312589) & 0x7fffffff;
  };

  const aa = grad(hash(X + hash(Y)), xf, yf);
  const ba = grad(hash(X + 1 + hash(Y)), xf - 1, yf);
  const ab = grad(hash(X + hash(Y + 1)), xf, yf - 1);
  const bb = grad(hash(X + 1 + hash(Y + 1)), xf - 1, yf - 1);

  return lerp(lerp(aa, ba, u), lerp(ab, bb, u), v);
}

// Generate 256x256 noise preview
function generateNoisePreview(noiseType, size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(size, size);

  const scale = 0.05;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let value = 0;

      switch(noiseType) {
        case 'simplex':
          // Use a 2D slice of 3D simplex (simplified approximation)
          value = Math.sin(x * scale) * Math.cos(y * scale) +
                  Math.sin(x * scale * 2) * Math.cos(y * scale * 2) * 0.5;
          break;

        case 'perlin':
          value = perlinNoise2D(x * scale, y * scale);
          break;

        case 'fbm':
          // Fractional Brownian Motion (multiple octaves)
          let amplitude = 1.0;
          let frequency = scale;
          for (let i = 0; i < 4; i++) {
            value += perlinNoise2D(x * frequency, y * frequency) * amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          break;

        case 'voronoi':
          // Voronoi/Worley noise
          const cellSize = 16;
          const cellX = Math.floor(x / cellSize);
          const cellY = Math.floor(y / cellSize);
          let minDist = Infinity;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const seedX = (cellX + dx) * cellSize + ((cellX + dx) * 73) % cellSize;
              const seedY = (cellY + dy) * cellSize + ((cellY + dy) * 149) % cellSize;
              const dist = Math.sqrt((x - seedX) ** 2 + (y - seedY) ** 2);
              minDist = Math.min(minDist, dist);
            }
          }
          value = minDist / cellSize;
          break;

        case 'ridged':
          // Ridged multifractal
          value = Math.abs(perlinNoise2D(x * scale, y * scale));
          value = 1.0 - value;
          value = value * value;
          break;

        case 'cellular':
          // Cellular automata-style
          value = Math.sin(x * scale * 3) * Math.cos(y * scale * 3);
          value = value > 0 ? 1 : -1;
          break;
      }

      // Normalize to [0, 255]
      const normalized = ((value + 1) / 2) * 255;
      const idx = (y * size + x) * 4;
      imageData.data[idx] = normalized;
      imageData.data[idx + 1] = normalized;
      imageData.data[idx + 2] = normalized;
      imageData.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

// Generate noise palette UI
function initNoisePalette() {
  const grid = document.getElementById('noiseGrid');
  grid.innerHTML = '';

  const noiseTypes = ['simplex', 'perlin', 'fbm', 'voronoi', 'ridged', 'cellular'];
  const noiseNames = ['Simplex', 'Perlin', 'FBM', 'Voronoi', 'Ridged', 'Cellular'];

  noiseTypes.forEach((type, index) => {
    const option = document.createElement('div');
    option.className = 'noise-option';
    if (type === currentNoiseType) option.classList.add('active');
    option.dataset.noiseType = type;

    const preview = generateNoisePreview(type);
    option.appendChild(preview);

    const label = document.createElement('div');
    label.className = 'noise-label';
    label.textContent = noiseNames[index];
    option.appendChild(label);

    option.addEventListener('click', () => switchNoiseType(type));

    grid.appendChild(option);
  });
}

// Generate vertex shader with selected noise type
function generateVertexShader(noiseType) {
  const noiseCode = noiseShaderLibrary[noiseType];

  return /* glsl */`
    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying float vDisplacement;

    uniform vec3 uDeformations[64];
    uniform float uSpatialScale;
    uniform float uTimeScale;
    uniform float uTime;
    uniform float uDisplacementAmount;

    ${noiseCode}

    void main() {
      vec3 deformedPosition = position;
      vec3 deformedNormal = normal;

      // Sample noise at this vertex position with time animation
      vec3 noisePos = position * uSpatialScale + vec3(0.0, 0.0, uTime * uTimeScale);
      float noiseValue = noiseFunction(noisePos);

      // Create mountains and valleys: displace along normal direction
      float displacement = noiseValue * uDisplacementAmount;
      deformedPosition += normal * displacement;
      vDisplacement = displacement;

      // Apply clay-like deformations
      for (int i = 0; i < 64; i++) {
        vec3 deformPos = uDeformations[i];
        if (length(deformPos) < 0.001) break;

        float dist = distance(position, deformPos);
        float influence = exp(-dist * dist * 8.0);
        vec3 direction = normalize(position - deformPos);
        deformedPosition += direction * influence * 0.5;
      }

      // Recalculate normal after deformation (approximate)
      deformedNormal = normalize(deformedPosition);

      // Pass world-space position to fragment shader
      vec4 worldPos = modelMatrix * vec4(deformedPosition, 1.0);
      vWorldPos = worldPos.xyz;

      // Pass deformed normal for lighting
      vNormal = normalize(normalMatrix * deformedNormal);

      // View position for specular
      vec4 mvPosition = modelViewMatrix * vec4(deformedPosition, 1.0);
      vViewPosition = -mvPosition.xyz;

      gl_Position = projectionMatrix * mvPosition;
    }
  `;
}

// Generate sampling fragment shader with selected noise type
function generateSamplingFragmentShader(noiseType) {
  const noiseCode = noiseShaderLibrary[noiseType];

  return /* glsl */`
    precision highp float;

    varying vec3 vWorldPos;

    uniform float uSpatialScale;
    uniform float uTimeScale;
    uniform float uTime;
    uniform float uDisplacementAmount;

    ${noiseCode}

    void main() {
      // Sample 3D noise at world position with time animation
      vec3 p = vWorldPos * uSpatialScale + vec3(0.0, 0.0, uTime * uTimeScale);
      float noise = noiseFunction(p);

      // Calculate displacement (same as vertex shader)
      float displacement = noise * uDisplacementAmount;

      // Calculate radial depth: original radius (1.0) + displacement
      vec3 normalizedPos = normalize(vWorldPos);
      float baseRadius = length(vWorldPos);
      float actualRadius = baseRadius + displacement;

      // Map radius to [0, 1] range for MIDI
      float value = (actualRadius - (1.0 - uDisplacementAmount)) / (uDisplacementAmount * 2.0);
      value = clamp(value, 0.0, 1.0);

      // Output the radial depth value
      gl_FragColor = vec4(vec3(value), 1.0);
    }
  `;
}

// Switch between noise types
function switchNoiseType(type) {
  if (!noiseShaderLibrary[type]) {
    console.error('❌ Unknown noise type:', type);
    return;
  }

  currentNoiseType = type;

  // Update active state in UI
  document.querySelectorAll('.noise-option').forEach(opt => {
    opt.classList.remove('active');
    if (opt.dataset.noiseType === type) {
      opt.classList.add('active');
    }
  });

  // Generate new shaders with selected noise type
  const newVertexShader = generateVertexShader(type);
  const newSamplingFragmentShader = generateSamplingFragmentShader(type);

  // Update main material shader
  material.vertexShader = newVertexShader;
  material.needsUpdate = true;

  // Update sampling material shader
  samplingMaterial.fragmentShader = newSamplingFragmentShader;
  samplingMaterial.needsUpdate = true;

  console.log('🎨 Switched to noise type:', type);
}

// Initialize the palette
initNoisePalette();

// ============================================================================
// START
// ============================================================================

// Initialize previous camera quaternion for rotation tracking
previousCameraQuaternion.copy(camera.quaternion);

animate();
console.log('🎵 3D Simplex Noise MIDI Instrument Ready');
console.log('📍 Sample points:', samplePoints.length);
console.log('🎹 Note range:', MIN_NOTE, '-', MAX_NOTE);