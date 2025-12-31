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

// Lighting for better 3D perception
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// ============================================================================
// 3D SIMPLEX NOISE SHADER
// ============================================================================

const simplexNoiseShader = {
  uniforms: {
    uSpatialScale: { value: 0.5 },
    uTimeScale: { value: 0.3 },
    uTime: { value: 0.0 }
  },

  vertexShader: /* glsl */`
    varying vec3 vWorldPos;
    varying vec3 vNormal;

    void main() {
      // Pass world-space position to fragment shader
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPos = worldPos.xyz;
      
      // Pass normal for lighting
      vNormal = normalize(normalMatrix * normal);
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: /* glsl */`
    precision highp float;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    
    uniform float uSpatialScale;
    uniform float uTimeScale;
    uniform float uTime;

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
      
      // Create color gradient based on noise value
      // Blue (low) -> Cyan -> Green -> Yellow -> Red (high)
      vec3 color;
      if (value < 0.25) {
        color = mix(vec3(0.0, 0.0, 0.5), vec3(0.0, 0.5, 1.0), value * 4.0);
      } else if (value < 0.5) {
        color = mix(vec3(0.0, 0.5, 1.0), vec3(0.0, 1.0, 0.5), (value - 0.25) * 4.0);
      } else if (value < 0.75) {
        color = mix(vec3(0.0, 1.0, 0.5), vec3(1.0, 1.0, 0.0), (value - 0.5) * 4.0);
      } else {
        color = mix(vec3(1.0, 1.0, 0.0), vec3(1.0, 0.2, 0.0), (value - 0.75) * 4.0);
      }
      
      // Apply simple Lambertian lighting
      vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
      float diffuse = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.5;

      gl_FragColor = vec4(color * diffuse, 0.5);
    }
  `
};

// ============================================================================
// CREATE 3D MESH WITH NOISE MATERIAL
// ============================================================================

const geometry = new THREE.SphereGeometry(1, 64, 64);
const material = new THREE.ShaderMaterial({
  uniforms: simplexNoiseShader.uniforms,
  vertexShader: simplexNoiseShader.vertexShader,
  fragmentShader: simplexNoiseShader.fragmentShader,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.5
});

const noiseMesh = new THREE.Mesh(geometry, material);
scene.add(noiseMesh);

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

/**
 * Update sensor positions by morphing between line and random positions
 * with optional cosine-based animation for each point
 * Also updates beacon poles and tube connections
 */
function updateSensorPositions(mix, animatedMix = null) {
  for (let i = 0; i < MIDI_STEPS; i++) {
    // Use animated mix if provided, otherwise use static mix
    const currentMix = animatedMix !== null ? animatedMix[i] : mix;

    // Linear interpolation between line and random positions
    samplePoints[i].lerpVectors(linePositions[i], randomPositions[i], currentMix);

    // Normalize to ensure sensor stays on sphere surface (radius = 1.0)
    samplePoints[i].normalize();
  }

  // Update beacon poles and tops
  for (let i = 0; i < MIDI_STEPS; i++) {
    const basePos = samplePoints[i].clone();
    const direction = basePos.clone().normalize();
    const topPos = basePos.clone().add(direction.multiplyScalar(BEACON_HEIGHT));

    // Update beacon top position
    beaconTops[i].copy(topPos);

    // Update pole position and orientation
    const poleIndex = i * 2;
    const topIndex = i * 2 + 1;

    if (beaconPoles[poleIndex]) {
      beaconPoles[poleIndex].position.copy(basePos).lerp(topPos, 0.5);
      beaconPoles[poleIndex].quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction
      );
    }

    if (beaconPoles[topIndex]) {
      beaconPoles[topIndex].position.copy(topPos);
    }
  }

  // Recreate tube connections with new positions
  tubeSegments.forEach(seg => {
    scene.remove(seg.mesh);
    seg.mesh.geometry.dispose();
  });
  tubeSegments.length = 0;

  for (let i = 0; i < MIDI_STEPS; i++) {
    const nextIndex = (i + 1) % MIDI_STEPS;
    const start = beaconTops[i];
    const end = beaconTops[nextIndex];

    // Calculate control point for quadratic curve that bows outward
    // Midpoint between the two beacon tops
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    // Push midpoint outward along its direction from origin
    // This ensures the curve bows away from the sphere surface
    const midpointDir = midpoint.clone().normalize();
    const controlPoint = midpoint.clone().add(midpointDir.multiplyScalar(0.15));

    // Create quadratic bezier curve
    const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.008, 8, false);
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.5
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tubeSegments.push({ mesh: tube, material: tubeMaterial, index: i });
    scene.add(tube);
  }

  // Update the sampling geometry world positions
  const worldPositions = samplingGeometry.attributes.worldPosition.array;
  for (let i = 0; i < MIDI_STEPS; i++) {
    worldPositions[i * 3] = samplePoints[i].x;
    worldPositions[i * 3 + 1] = samplePoints[i].y;
    worldPositions[i * 3 + 2] = samplePoints[i].z;
  }
  samplingGeometry.attributes.worldPosition.needsUpdate = true;
}

// Height of beacon poles above sphere surface
const BEACON_HEIGHT = 0.3;

// Create beacon poles rising from each sensor position
let beaconPoles = [];
let beaconTops = []; // Track top positions of beacons
let tubeSegments = [];

/**
 * Rebuild all beacons and tubes when step count changes
 */
function rebuildBeaconsAndTubes() {
  // Clear existing beacons
  beaconPoles.forEach(beacon => {
    scene.remove(beacon);
    beacon.geometry.dispose();
    beacon.material.dispose();
  });
  beaconPoles = [];
  beaconTops = [];

  // Clear existing tubes
  tubeSegments.forEach(seg => {
    scene.remove(seg.mesh);
    seg.mesh.geometry.dispose();
    seg.mesh.material.dispose();
  });
  tubeSegments = [];

  // Regenerate positions with new step count
  const newLinePositions = generateLinePositions();
  const newRandomPositions = generateRandomPositions();

  linePositions.length = 0;
  randomPositions.length = 0;
  samplePoints.length = 0;

  newLinePositions.forEach(p => linePositions.push(p));
  newRandomPositions.forEach(p => randomPositions.push(p));
  newLinePositions.forEach(p => samplePoints.push(p.clone()));

  // Create new beacons
  for (let i = 0; i < MIDI_STEPS; i++) {
    const basePos = samplePoints[i].clone();
    const direction = basePos.clone().normalize();
    const topPos = basePos.clone().add(direction.multiplyScalar(BEACON_HEIGHT));

    // Create pole geometry (cylinder)
    const poleGeometry = new THREE.CylinderGeometry(0.01, 0.015, BEACON_HEIGHT, 8);
    const poleMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.8
    });
    const pole = new THREE.Mesh(poleGeometry, poleMaterial);

    // Position and orient the pole
    pole.position.copy(basePos).lerp(topPos, 0.5);
    pole.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction
    );

    beaconPoles.push(pole);
    beaconTops.push(topPos);
    scene.add(pole);

    // Create glowing top sphere
    const topGeometry = new THREE.SphereGeometry(0.025, 16, 16);
    const topMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.9
    });
    const topSphere = new THREE.Mesh(topGeometry, topMaterial);
    topSphere.position.copy(topPos);
    scene.add(topSphere);
    beaconPoles.push(topSphere); // Store for later updates
  }

  // Create tube connections between beacon tops
  for (let i = 0; i < MIDI_STEPS; i++) {
    const nextIndex = (i + 1) % MIDI_STEPS;
    const start = beaconTops[i];
    const end = beaconTops[nextIndex];

    // Calculate control point for quadratic curve that bows outward
    // Midpoint between the two beacon tops
    const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    // Push midpoint outward along its direction from origin
    // This ensures the curve bows away from the sphere surface
    const midpointDir = midpoint.clone().normalize();
    const controlPoint = midpoint.clone().add(midpointDir.multiplyScalar(0.15));

    // Create quadratic bezier curve
    const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
    const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.008, 8, false);
    const tubeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.6,
      emissive: 0xff0000,
      emissiveIntensity: 0.3,
      roughness: 0.5,
      metalness: 0.5
    });

    const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
    tubeSegments.push({ mesh: tube, material: tubeMaterial, index: i });
    scene.add(tube);
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
      seg.material.emissiveIntensity = 0.3;
      seg.material.color.setHex(0xff0000);
    });

    // Reset beacon poles to default state
    for (let i = 0; i < MIDI_STEPS; i++) {
      const poleIndex = i * 2;
      const topIndex = i * 2 + 1;
      if (beaconPoles[poleIndex]) {
        beaconPoles[poleIndex].material.opacity = 0.8;
        beaconPoles[poleIndex].material.color.setHex(0xff3300);
      }
      if (beaconPoles[topIndex]) {
        beaconPoles[topIndex].material.opacity = 0.9;
        beaconPoles[topIndex].material.color.setHex(0xff0000);
      }
    }
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
      seg.material.emissiveIntensity = 0.3 + fade * 0.7; // 0.3 to 1.0
      seg.material.color.setRGB(1.0, 0.4 * fade, 0);
    } else if (seg.index === nextStep) {
      // Next tube segment: fading in
      seg.material.opacity = 0.6 + progress * 0.3;
      seg.material.emissiveIntensity = 0.3 + progress * 0.5;
      seg.material.color.setRGB(1.0, 0.2 + progress * 0.2, 0);
    } else {
      // All other tubes: dim
      seg.material.opacity = 0.6;
      seg.material.emissiveIntensity = 0.3;
      seg.material.color.setHex(0xff0000);
    }
  });

  // Update beacon poles and tops
  for (let i = 0; i < MIDI_STEPS; i++) {
    const poleIndex = i * 2;
    const topIndex = i * 2 + 1;

    if (i === currentStep) {
      // Current beacon: bright
      const brightness = 1.0 - progress * 0.3;
      if (beaconPoles[poleIndex]) {
        beaconPoles[poleIndex].material.opacity = 1.0;
        beaconPoles[poleIndex].material.color.setRGB(1.0, 0.5 * brightness, 0);
      }
      if (beaconPoles[topIndex]) {
        beaconPoles[topIndex].material.opacity = 1.0;
        beaconPoles[topIndex].material.color.setRGB(1.0, 0.3 * brightness, 0);
        // Pulse the size
        const scale = 1.0 + Math.sin(progress * Math.PI) * 0.3;
        beaconPoles[topIndex].scale.setScalar(scale);
      }
    } else if (i === nextStep) {
      // Next beacon: fading in
      if (beaconPoles[poleIndex]) {
        beaconPoles[poleIndex].material.opacity = 0.8 + progress * 0.2;
        beaconPoles[poleIndex].material.color.setRGB(1.0, 0.2 + progress * 0.3, 0);
      }
      if (beaconPoles[topIndex]) {
        beaconPoles[topIndex].material.opacity = 0.9 + progress * 0.1;
        beaconPoles[topIndex].material.color.setRGB(1.0, 0.1 + progress * 0.2, 0);
        const scale = 1.0 + progress * 0.2;
        beaconPoles[topIndex].scale.setScalar(scale);
      }
    } else {
      // All other beacons: dim
      if (beaconPoles[poleIndex]) {
        beaconPoles[poleIndex].material.opacity = 0.8;
        beaconPoles[poleIndex].material.color.setHex(0xff3300);
      }
      if (beaconPoles[topIndex]) {
        beaconPoles[topIndex].material.opacity = 0.9;
        beaconPoles[topIndex].material.color.setHex(0xff0000);
        beaconPoles[topIndex].scale.setScalar(1.0);
      }
    }
  }

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
    uTime: material.uniforms.uTime
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
  fragmentShader: simplexNoiseShader.fragmentShader.replace(
    'varying vec3 vNormal;',
    '// vNormal removed for sampling'
  ).replace(
    /vec3 lightDir[^;]*;[\s\S]*gl_FragColor = vec4\(color \* diffuse, 0\.5\);/,
    'gl_FragColor = vec4(vec3(value), 1.0);'
  )
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

  // Get all tube meshes
  const tubeMeshes = tubeSegments.map(seg => seg.mesh);

  // Check for intersections
  const intersects = raycaster.intersectObjects(tubeMeshes);

  // Reset previous hover state
  if (hoveredString !== null && !activeString) {
    const prevSeg = tubeSegments[hoveredString];
    if (prevSeg) {
      prevSeg.material.emissiveIntensity = 0.3;
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
        seg.material.emissiveIntensity = 0.7;
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
 * Handle mouse down - activate string
 */
function onMouseDown(event) {
  if (hoveredString !== null) {
    const seg = tubeSegments[hoveredString];
    activeString = {
      index: hoveredString,
      startY: mouse.y,
      baseEmissive: seg.material.emissiveIntensity,
      initialDragPoint: mouse3D.clone()
    };

    // Initialize physics for this string if not already done
    if (!stringPhysics[hoveredString]) {
      stringPhysics[hoveredString] = initStringPhysics(hoveredString);
    }

    // Visual feedback - brighten the string
    seg.material.emissiveIntensity = 1.0;
    seg.material.color.setRGB(1.0, 1.0, 0.4);

    console.log(`🎸 String ${hoveredString} activated`);
  }
}

/**
 * Handle mouse up - deactivate string and start vibration
 */
function onMouseUp(event) {
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
    seg.material.emissiveIntensity = 0.5;

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
      seg.material.emissiveIntensity = 0.3;
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
    seg.material.emissiveIntensity = 0.3 + displacementAmount * 5.0;

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
    seg.material.emissiveIntensity = 1.0 + bendAmount * 2.0;

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
let sequencerRunning = false;

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
    
    console.log('✓ MIDI initialized:', midiOutput.name);
    return true;
  } catch (err) {
    console.error('MIDI error:', err);
    alert('MIDI initialization failed: ' + err.message);
    return false;
  }
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

  for (let i = 0; i < MIDI_STEPS; i++) {
    const value = noiseValues[i];
    const note = noiseToMidiNote(value);
    const velocity = 80;

    const tOn = now + i * STEP_MS;
    const tOff = tOn + STEP_MS * 0.8;

    noteOn(note, velocity, tOn);
    noteOff(note, tOff);
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

  // Rebuild all geometry with new step count
  rebuildBeaconsAndTubes();

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

  controls.update();
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
// START
// ============================================================================

animate();
console.log('🎵 3D Simplex Noise MIDI Instrument Ready');
console.log('📍 Sample points:', samplePoints.length);
console.log('🎹 Note range:', MIN_NOTE, '-', MAX_NOTE);