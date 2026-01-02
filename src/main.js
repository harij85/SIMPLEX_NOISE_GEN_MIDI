/**
 * Main Entry Point
 *
 * Orchestrates all modules, sets up the application lifecycle,
 * and wires together the interactive 3D noise MIDI instrument.
 */

import * as THREE from 'three';

// Configuration
import {
  getNumSteps, setNumSteps,
  getCurrentStep,
  updateTime,
  getTime,
  setMousePosition,
  getActiveString, setActiveString,
  setEditingStep, getEditingStep,
  setSensorDistribution, getSensorDistribution,
  setSensorAnimationSpeed, getSensorAnimationSpeed,
  setCurrentNoiseType, getCurrentNoiseType
} from './config/globalState.js';

// MIDI System
import { initMIDI, sendMIDIMessage } from './midi/midiIO.js';
import { setMIDIInputEnabled } from './midi/midiState.js';
import {
  setNoteOnCallback,
  setNoteOffCallback,
  setPitchBendCallback,
  setControlChangeCallback,
  setMapNoteToSensorCallback
} from './midi/midiHandlers.js';

// Physics
import {
  createStringPhysics,
  pluckString,
  updateStringPhysicsStep,
  applyStringDisplacement
} from './physics/stringPhysics.js';
import {
  updateClayPhysics,
  getDeformationsForShader,
  setClayViscosity,
  setClayElasticity,
  setClayPushStrength,
  setClayBrushSize,
  clearDeformations,
  setMoldingState,
  moldAtPoint
} from './physics/clayPhysics.js';

// Sequencer
import { setBPM, setTimeSig } from './sequencer/scheduler.js';
import {
  initStepParameters,
  getStepParameters,
  setStepActive,
  setStepDotted,
  setStepTie,
  setStepScaleDegree,
  setStepVelocity,
  getStepParameter
} from './sequencer/stepParameters.js';
import {
  startSequencer,
  stopSequencer,
  isSequencerRunning,
  updateCurrentStep,
  setSampleNoiseCallback,
  setSendNoteOnCallback,
  setSendNoteOffCallback
} from './sequencer/sequencer.js';

// Scene
import {
  initScene,
  getScene,
  getRenderer,
  getCamera,
  updateControls,
  enableControls,
  disableControls,
  render,
  getNoiseRotationGroup
} from './scene/sceneManager.js';
import { addAmbientLight } from './scene/lighting.js';
import {
  createSensors,
  highlightBeacon,
  updateBeaconAnimations
} from './scene/sensors.js';
import {
  createStrings,
  updateStringGeometry,
  updateStringVisuals,
  getTubeSegments
} from './scene/strings.js';

// Shaders
import { createNoiseMaterial, updateMaterialNoiseType } from './shaders/noiseMaterial.js';
import {
  createSamplingMaterial,
  createSamplingGeometry,
  updateSamplingWorldPositions,
  createSamplingRenderTarget,
  sampleNoiseFromGPU
} from './shaders/samplingShader.js';

// Utils
import {
  setScaleEnabled,
  setRootNote,
  setScaleIntervals,
  loadScalaFile
} from './utils/scales.js';
import { createFibonacciSphere, generateLinePositions } from './utils/geometry.js';

// Application state
let noiseSphere = null;
let noiseMaterial = null;
let stringMeshes = [];
let stringPhysicsArray = [];
let beaconMeshes = [];

// Sensor position arrays for distribution morphing
let linePositions = [];
let randomPositions = [];
let targetSamplePoints = [];
const POSITION_SMOOTHING = 0.15;

// Sampling system
let samplingScene = null;
let samplingCamera = null;
let samplingMaterial = null;
let samplingGeometry = null;
let samplingPoints = null;
let samplingTarget = null;

// Raycasting for interactions
let raycaster = null;
let isMouseDown = false;

// Animation
let animationId = null;

/**
 * Initialize the entire application
 */
async function init() {
  console.log('Initializing 3D Noise MIDI Instrument...');

  // Initialize Three.js scene
  initScene();
  const renderer = getRenderer();
  const scene = getScene();
  const camera = getCamera();

  // Add lighting
  addAmbientLight(0xffffff, 0.8);

  // Initialize MIDI
  const midiReady = await initMIDI();
  if (!midiReady) {
    console.warn('MIDI initialization failed');
  }

  // Initialize raycaster for mouse interactions
  raycaster = new THREE.Raycaster();

  // Create noise sphere
  const numSteps = getNumSteps();
  noiseMaterial = createNoiseMaterial(getCurrentNoiseType());
  const sphereGeometry = new THREE.SphereGeometry(1, 128, 64);
  noiseSphere = new THREE.Mesh(sphereGeometry, noiseMaterial);
  getNoiseRotationGroup().add(noiseSphere);

  // Create sensors (beacons)
  const sensorPositions = createFibonacciSphere(numSteps);

  // Initialize position arrays for morphing
  linePositions = generateLinePositions(numSteps);
  randomPositions = sensorPositions.map(pos => pos.clone());
  targetSamplePoints = sensorPositions.map(pos => pos.clone());

  beaconMeshes = createSensors(sensorPositions);
  beaconMeshes.forEach(beacon => getNoiseRotationGroup().add(beacon));

  // Create strings connecting beacons
  stringMeshes = createStrings(sensorPositions);
  stringMeshes.forEach(string => getNoiseRotationGroup().add(string));

  // Initialize string physics
  stringPhysicsArray = [];
  for (let i = 0; i < numSteps; i++) {
    stringPhysicsArray.push(createStringPhysics());
  }

  // Initialize step parameters
  initStepParameters(numSteps);

  // Set up GPU sampling system
  setupSamplingSystem(renderer, sensorPositions);

  // Wire up callbacks
  setupCallbacks();

  // Set up UI event handlers
  setupUI();

  // Set up mouse/keyboard interactions
  setupInteractions();

  // Generate noise palette
  generateNoisePalette();

  // Update step grid UI
  updateStepGridUI();

  // Start animation loop
  animate();

  console.log('Initialization complete!');
}

/**
 * Set up GPU-based noise sampling system
 */
function setupSamplingSystem(renderer, sensorPositions) {
  const numSteps = getNumSteps();

  // Create sampling scene and camera
  samplingScene = new THREE.Scene();
  samplingCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // Create sampling material and geometry
  samplingMaterial = createSamplingMaterial(noiseMaterial.uniforms, getCurrentNoiseType());
  samplingGeometry = createSamplingGeometry(sensorPositions);
  samplingPoints = sensorPositions;

  const samplingMesh = new THREE.Points(samplingGeometry, samplingMaterial);
  samplingScene.add(samplingMesh);

  // Create render target
  samplingTarget = createSamplingRenderTarget(numSteps);
}

/**
 * Wire up all module callbacks
 */
function setupCallbacks() {
  // MIDI Input callbacks
  setNoteOnCallback((note, velocity, sensorIndex) => {
    if (sensorIndex >= 0 && sensorIndex < stringPhysicsArray.length) {
      pluckString(stringPhysicsArray[sensorIndex], velocity / 127);
      highlightBeacon(beaconMeshes[sensorIndex]);
    }
  });

  setNoteOffCallback((note, sensorIndex) => {
    // Note off handling if needed
  });

  setPitchBendCallback((bendAmount) => {
    // Apply pitch bend to active strings
    const activeString = getActiveString();
    if (activeString !== null && activeString.index >= 0) {
      const physics = stringPhysicsArray[activeString.index];
      if (physics) {
        physics.displacement.y = bendAmount * 0.5;
      }
    }
  });

  setControlChangeCallback((controller, value) => {
    // CC1 (Mod Wheel) controls spatial scale
    if (controller === 1) {
      const scale = 0.1 + (value / 127) * 1.9;
      noiseMaterial.uniforms.uSpatialScale.value = scale;
      document.getElementById('spatialScale').value = scale;
      document.getElementById('spatialValue').textContent = scale.toFixed(2);
    }
  });

  // Map MIDI notes to sensors
  setMapNoteToSensorCallback((note) => {
    const numSteps = getNumSteps();
    const noteRange = MIDI_CONFIG.MAX_NOTE - MIDI_CONFIG.MIN_NOTE;
    const normalizedNote = (note - MIDI_CONFIG.MIN_NOTE) / noteRange;
    return Math.floor(normalizedNote * numSteps) % numSteps;
  });

  // Sequencer callbacks
  setSampleNoiseCallback(() => {
    // Update sampling world positions with sphere rotation
    const rotation = getNoiseRotationGroup().quaternion;
    updateSamplingWorldPositions(samplingGeometry, samplingPoints, rotation);

    // Sample noise from GPU
    const renderer = getRenderer();
    const numSteps = getNumSteps();
    return sampleNoiseFromGPU(renderer, samplingScene, samplingCamera, samplingTarget, numSteps);
  });

  setSendNoteOnCallback((note, velocity, time) => {
    sendMIDIMessage([0x90, note, velocity]);
    logActivity(`Seq Note On: ${note} (vel: ${velocity})`);
  });

  setSendNoteOffCallback((note, time) => {
    sendMIDIMessage([0x80, note, 0]);
  });
}

/**
 * Set up UI event handlers
 */
function setupUI() {
  // Start/Stop button
  const startBtn = document.getElementById('startBtn');
  startBtn.addEventListener('click', () => {
    if (isSequencerRunning()) {
      stopSequencer();
      startBtn.textContent = '▶ Start MIDI Sequencer';
    } else {
      startSequencer();
      startBtn.textContent = '⏸ Stop MIDI Sequencer';
    }
  });

  // BPM slider
  const bpmSlider = document.getElementById('bpmSlider');
  const bpmValue = document.getElementById('bpmValue');
  bpmSlider.addEventListener('input', (e) => {
    const bpm = parseFloat(e.target.value);
    setBPM(bpm);
    bpmValue.textContent = bpm;
  });

  // Steps slider
  const stepsSlider = document.getElementById('stepsSlider');
  const stepsValue = document.getElementById('stepsValue');
  stepsSlider.addEventListener('input', (e) => {
    const steps = parseInt(e.target.value);
    handleStepsChange(steps);
    stepsValue.textContent = steps;
  });

  // Time signature controls
  const numeratorSlider = document.getElementById('numeratorSlider');
  const denominatorSlider = document.getElementById('denominatorSlider');
  const timeSigValue = document.getElementById('timeSigValue');
  const newComplexityToggle = document.getElementById('newComplexityToggle');

  const updateTimeSig = () => {
    let numerator = parseInt(numeratorSlider.value);
    let denominator;

    if (newComplexityToggle.checked) {
      // Irrational mode: denominator = raw value
      denominator = parseInt(denominatorSlider.value);
    } else {
      // Traditional mode: denominator = 2^value
      const exp = parseInt(denominatorSlider.value);
      denominator = Math.pow(2, exp);
    }

    setTimeSig(numerator, denominator);
    timeSigValue.textContent = `${numerator}/${denominator}`;
  };

  numeratorSlider.addEventListener('input', updateTimeSig);
  denominatorSlider.addEventListener('input', updateTimeSig);
  newComplexityToggle.addEventListener('change', () => {
    if (newComplexityToggle.checked) {
      denominatorSlider.max = 256;
      denominatorSlider.value = 4;
    } else {
      denominatorSlider.max = 8;
      denominatorSlider.value = 2;
    }
    updateTimeSig();
  });

  // Time signature presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      const [num, den] = preset.split('/').map(n => parseInt(n));
      setTimeSig(num, den);
      numeratorSlider.value = num;
      timeSigValue.textContent = preset;
    });
  });

  // Stockhausen preset
  document.getElementById('stockhausenPreset').addEventListener('click', () => {
    setTimeSig(176, 128);
    numeratorSlider.value = 176;
    timeSigValue.textContent = '176/128';
  });

  // Spatial scale
  const spatialScale = document.getElementById('spatialScale');
  const spatialValue = document.getElementById('spatialValue');
  spatialScale.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    noiseMaterial.uniforms.uSpatialScale.value = value;
    spatialValue.textContent = value.toFixed(2);
  });

  // Time scale
  const timeScale = document.getElementById('timeScale');
  const timeValue = document.getElementById('timeValue');
  timeScale.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    noiseMaterial.uniforms.uTimeScale.value = value;
    timeValue.textContent = value.toFixed(2);
  });

  // Sensor distribution
  const distributionSlider = document.getElementById('distributionSlider');
  const distributionValue = document.getElementById('distributionValue');
  distributionSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    setSensorDistribution(value);
    distributionValue.textContent = value === 0 ? 'Line' : value === 1 ? 'Chaos' : value.toFixed(2);
  });

  // Sensor animation speed
  const animationSlider = document.getElementById('animationSlider');
  const animationValue = document.getElementById('animationValue');
  animationSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    setSensorAnimationSpeed(value);
    animationValue.textContent = value.toFixed(2);
  });

  // Displacement amount
  const displacementSlider = document.getElementById('displacementSlider');
  const displacementValue = document.getElementById('displacementValue');
  displacementSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    noiseMaterial.uniforms.uDisplacementAmount.value = value;
    displacementValue.textContent = value.toFixed(2);
  });

  // Color gradient controls
  setupColorControls();

  // Scale controls
  setupScaleControls();

  // Step sequencer controls
  setupStepSequencerControls();

  // Clay molding controls
  setupClayControls();

  // MIDI input toggle
  const midiInputToggle = document.getElementById('midiInputToggle');
  midiInputToggle.addEventListener('change', (e) => {
    setMIDIInputEnabled(e.target.checked);
    const status = document.getElementById('midiInputStatus');
    if (e.target.checked) {
      status.style.background = 'rgba(100, 200, 100, 0.1)';
      status.style.borderColor = 'rgba(100, 200, 100, 0.3)';
      status.style.color = '#6c6';
      status.textContent = '✓ MIDI Input listening';
    } else {
      status.style.background = 'rgba(200, 100, 100, 0.1)';
      status.style.borderColor = 'rgba(200, 100, 100, 0.3)';
      status.style.color = '#c66';
      status.textContent = '✗ MIDI Input disabled';
    }
  });
}

/**
 * Set up color gradient controls
 */
function setupColorControls() {
  for (let i = 1; i <= 5; i++) {
    const colorPicker = document.getElementById(`color${i}`);
    const alphaSlider = document.getElementById(`color${i}Alpha`);
    const alphaValue = document.getElementById(`color${i}AlphaValue`);

    const updateColor = () => {
      const hex = colorPicker.value;
      const r = parseInt(hex.substr(1, 2), 16) / 255;
      const g = parseInt(hex.substr(3, 2), 16) / 255;
      const b = parseInt(hex.substr(5, 2), 16) / 255;
      const a = parseFloat(alphaSlider.value);

      noiseMaterial.uniforms[`uColor${i}`].value.set(r, g, b, a);
      alphaValue.textContent = a.toFixed(2);
    };

    colorPicker.addEventListener('input', updateColor);
    alphaSlider.addEventListener('input', updateColor);
  }
}

/**
 * Set up scale controls
 */
function setupScaleControls() {
  const scaleToggle = document.getElementById('scaleToggle');
  const keySelect = document.getElementById('keySelect');
  const scaleSelect = document.getElementById('scaleSelect');
  const scalaFileInput = document.getElementById('scalaFileInput');
  const scalaFileName = document.getElementById('scalaFileName');

  scaleToggle.addEventListener('change', (e) => {
    setScaleEnabled(e.target.checked);
  });

  keySelect.addEventListener('change', (e) => {
    setRootNote(parseInt(e.target.value));
  });

  scaleSelect.addEventListener('change', (e) => {
    const scaleName = e.target.value;
    // Scale intervals defined in scales.js
    setScaleIntervals(scaleName);
  });

  scalaFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      loadScalaFile(text);
      scalaFileName.textContent = `Loaded: ${file.name}`;
    }
  });
}

/**
 * Set up step sequencer controls
 */
function setupStepSequencerControls() {
  const stepActive = document.getElementById('stepActive');
  const stepDotted = document.getElementById('stepDotted');
  const stepTie = document.getElementById('stepTie');
  const stepScaleDegree = document.getElementById('stepScaleDegree');
  const stepVelocity = document.getElementById('stepVelocity');
  const stepVelocityValue = document.getElementById('stepVelocityValue');

  stepActive.addEventListener('change', (e) => {
    const stepIndex = getEditingStep();
    if (stepIndex !== null) {
      setStepActive(stepIndex, e.target.checked);
      updateStepGridUI();
    }
  });

  stepDotted.addEventListener('change', (e) => {
    const stepIndex = getEditingStep();
    if (stepIndex !== null) {
      setStepDotted(stepIndex, e.target.checked);
    }
  });

  stepTie.addEventListener('change', (e) => {
    const stepIndex = getEditingStep();
    if (stepIndex !== null) {
      setStepTie(stepIndex, e.target.checked);
    }
  });

  stepScaleDegree.addEventListener('change', (e) => {
    const stepIndex = getEditingStep();
    if (stepIndex !== null) {
      const degree = e.target.value === '' ? null : parseInt(e.target.value);
      setStepScaleDegree(stepIndex, degree);
    }
  });

  stepVelocity.addEventListener('input', (e) => {
    const stepIndex = getEditingStep();
    const velocity = parseInt(e.target.value);
    if (stepIndex !== null) {
      setStepVelocity(stepIndex, velocity);
    }
    stepVelocityValue.textContent = velocity;
  });
}

/**
 * Set up clay molding controls
 */
function setupClayControls() {
  const viscositySlider = document.getElementById('clayViscositySlider');
  const viscosityValue = document.getElementById('clayViscosityValue');
  const elasticitySlider = document.getElementById('clayElasticitySlider');
  const elasticityValue = document.getElementById('clayElasticityValue');
  const pushSlider = document.getElementById('clayPushSlider');
  const pushValue = document.getElementById('clayPushValue');
  const brushSlider = document.getElementById('clayBrushSlider');
  const brushValue = document.getElementById('clayBrushValue');
  const resetBtn = document.getElementById('resetClayBtn');

  viscositySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    setClayViscosity(value);
    viscosityValue.textContent = value.toFixed(2);
  });

  elasticitySlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    setClayElasticity(value);
    elasticityValue.textContent = value.toFixed(2);
  });

  pushSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    setClayPushStrength(value);
    pushValue.textContent = value.toFixed(2);
  });

  brushSlider.addEventListener('input', (e) => {
    const value = parseFloat(e.target.value);
    setClayBrushSize(value);
    brushValue.textContent = value.toFixed(2);
  });

  resetBtn.addEventListener('click', () => {
    clearDeformations();
  });
}

/**
 * Set up mouse and keyboard interactions
 */
function setupInteractions() {
  const renderer = getRenderer();
  const canvas = renderer.domElement;

  // Mouse move - update position
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalizedX = (x / rect.width) * 2 - 1;
    const normalizedY = -(y / rect.height) * 2 + 1;
    setMousePosition(x, y, normalizedX, normalizedY);

    // Handle clay molding
    if (e.shiftKey && isMouseDown) {
      handleClayMolding(normalizedX, normalizedY, e.ctrlKey);
    }
  });

  // Mouse down
  canvas.addEventListener('mousedown', (e) => {
    isMouseDown = true;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const normalizedX = (x / rect.width) * 2 - 1;
    const normalizedY = -(y / rect.height) * 2 + 1;

    // String interaction (without shift)
    if (!e.shiftKey) {
      handleStringClick(normalizedX, normalizedY);
    } else {
      // Clay molding (with shift)
      disableControls();
      setMoldingState(true);
      handleClayMolding(normalizedX, normalizedY, e.ctrlKey);
    }
  });

  // Mouse up
  canvas.addEventListener('mouseup', () => {
    isMouseDown = false;
    setActiveString(null);
    setMoldingState(false);
    enableControls();
  });

  // Mouse leave canvas
  canvas.addEventListener('mouseleave', () => {
    isMouseDown = false;
    setActiveString(null);
    setMoldingState(false);
    enableControls();
  });
}

/**
 * Handle string click interaction
 */
function handleStringClick(normalizedX, normalizedY) {
  const camera = getCamera();
  raycaster.setFromCamera({ x: normalizedX, y: normalizedY }, camera);

  const intersects = raycaster.intersectObjects(stringMeshes);
  if (intersects.length > 0) {
    const stringIndex = stringMeshes.indexOf(intersects[0].object);
    if (stringIndex !== -1) {
      const point = intersects[0].point;
      setActiveString({
        index: stringIndex,
        startY: point.y,
        initialDisplacement: 0
      });

      // Pluck the string
      pluckString(stringPhysicsArray[stringIndex], 0.8);
      highlightBeacon(beaconMeshes[stringIndex]);
    }
  }
}

/**
 * Handle clay molding interaction
 */
function handleClayMolding(normalizedX, normalizedY, isPulling) {
  const camera = getCamera();
  raycaster.setFromCamera({ x: normalizedX, y: normalizedY }, camera);

  const intersects = raycaster.intersectObject(noiseSphere);
  if (intersects.length > 0) {
    const point = intersects[0].point.clone();
    const localPoint = getNoiseRotationGroup().worldToLocal(point);
    moldAtPoint(localPoint, !isPulling);
  }
}

/**
 * Handle steps change (resize sensors, strings, physics)
 */
function handleStepsChange(newSteps) {
  setNumSteps(newSteps);

  // Remove old objects
  beaconMeshes.forEach(beacon => getNoiseRotationGroup().remove(beacon));
  stringMeshes.forEach(string => getNoiseRotationGroup().remove(string));

  // Create new sensor positions
  const sensorPositions = createFibonacciSphere(newSteps);
  samplingPoints = sensorPositions;

  // Create new beacons and strings
  beaconMeshes = createSensors(sensorPositions);
  beaconMeshes.forEach(beacon => getNoiseRotationGroup().add(beacon));

  stringMeshes = createStrings(sensorPositions);
  stringMeshes.forEach(string => getNoiseRotationGroup().add(string));

  // Recreate string physics
  stringPhysicsArray = [];
  for (let i = 0; i < newSteps; i++) {
    stringPhysicsArray.push(createStringPhysics());
  }

  // Reinitialize step parameters
  initStepParameters(newSteps);

  // Update sampling geometry
  samplingGeometry.dispose();
  samplingGeometry = createSamplingGeometry(sensorPositions);
  samplingScene.children[0].geometry = samplingGeometry;

  // Recreate sampling target
  samplingTarget.dispose();
  samplingTarget = createSamplingRenderTarget(newSteps);

  // Update step grid UI
  updateStepGridUI();
}

/**
 * Update sensor distribution with morphing and animation
 */
function updateSensorDistribution() {
  const distribution = getSensorDistribution();
  const animationSpeed = getSensorAnimationSpeed();
  const time = getTime();
  const numSteps = getNumSteps();

  // Calculate animated mix values if animation is enabled
  let animatedMix = null;
  if (animationSpeed > 0) {
    animatedMix = [];
    for (let i = 0; i < numSteps; i++) {
      const phase = (i / numSteps) * Math.PI * 2;
      const cosineValue = (Math.cos(time * animationSpeed + phase) + 1.0) / 2.0;
      const blendedValue = distribution * 0.5 + cosineValue * 0.5;
      animatedMix.push(blendedValue);
    }
  }

  // Update target positions
  for (let i = 0; i < numSteps; i++) {
    const currentMix = animatedMix !== null ? animatedMix[i] : distribution;
    targetSamplePoints[i].lerpVectors(linePositions[i], randomPositions[i], currentMix);
    targetSamplePoints[i].normalize();
    samplingPoints[i].lerp(targetSamplePoints[i], POSITION_SMOOTHING);
  }

  // Update beacon and string positions
  for (let i = 0; i < numSteps; i++) {
    const nextIndex = (i + 1) % numSteps;

    if (beaconMeshes[i]) {
      const basePos = samplingPoints[i].clone();
      const direction = basePos.clone().normalize();
      const beaconPos = basePos.clone().add(direction.multiplyScalar(0.1)); // BEACON_HEIGHT
      beaconMeshes[i].position.copy(beaconPos);
    }

    // Update string geometry to connect to next beacon
    if (stringMeshes[i]) {
      const basePos1 = samplingPoints[i].clone();
      const dir1 = basePos1.clone().normalize();
      const beaconPos1 = basePos1.clone().add(dir1.multiplyScalar(0.1));

      const basePos2 = samplingPoints[nextIndex].clone();
      const dir2 = basePos2.clone().normalize();
      const beaconPos2 = basePos2.clone().add(dir2.multiplyScalar(0.1));

      // Find the segment index and update it properly
      const tubeSegments = getTubeSegments();
      const segment = tubeSegments[i];
      if (segment) {
        segment.mesh.geometry.dispose();
        const midpoint = new THREE.Vector3().addVectors(beaconPos1, beaconPos2).multiplyScalar(0.5);
        const midpointDir = midpoint.clone().normalize();
        const controlPoint = midpoint.clone().add(midpointDir.multiplyScalar(0.15));
        const curve = new THREE.QuadraticBezierCurve3(beaconPos1, controlPoint, beaconPos2);
        segment.mesh.geometry = new THREE.TubeGeometry(curve, 16, 0.01, 8, false);
      }
    }
  }

  // Update sampling geometry world positions
  updateSamplingWorldPositions(samplingGeometry, samplingPoints, getNoiseRotationGroup().quaternion);
}

/**
 * Update sequence glow animation for beacons and strings
 */
function updateSequenceGlow() {
  if (!isSequencerRunning()) {
    return;
  }

  const currentStepIndex = updateCurrentStep();

  // Highlight current step beacon
  if (beaconMeshes[currentStepIndex]) {
    highlightBeacon(beaconMeshes[currentStepIndex]);

    // Also pluck the string if it's active
    const param = getStepParameter(currentStepIndex);
    if (param && param.active && stringPhysicsArray[currentStepIndex]) {
      const velocity = param.velocity !== null ? param.velocity / 127 : 0.6;
      pluckString(stringPhysicsArray[currentStepIndex], velocity);
    }
  }
}

/**
 * Update step grid UI
 */
function updateStepGridUI() {
  const stepGrid = document.getElementById('stepGrid');
  const numSteps = getNumSteps();
  const stepParams = getStepParameters();
  const currentStep = getCurrentStep();

  stepGrid.innerHTML = '';

  for (let i = 0; i < numSteps; i++) {
    const btn = document.createElement('button');
    btn.textContent = i + 1;
    btn.style.padding = '8px';
    btn.style.fontSize = '11px';
    btn.style.borderRadius = '4px';
    btn.style.cursor = 'pointer';
    btn.style.border = 'none';
    btn.style.transition = 'all 0.2s';

    // Style based on state
    const param = stepParams[i];
    if (!param.active) {
      btn.style.background = 'rgba(100, 100, 100, 0.3)';
      btn.style.color = '#666';
    } else if (i === currentStep) {
      btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      btn.style.color = '#fff';
      btn.style.boxShadow = '0 0 10px rgba(102, 126, 234, 0.5)';
    } else {
      btn.style.background = 'rgba(255, 255, 255, 0.1)';
      btn.style.color = '#aaa';
    }

    btn.addEventListener('click', () => {
      openStepEditor(i);
    });

    stepGrid.appendChild(btn);
  }
}

/**
 * Open step editor for a specific step
 */
function openStepEditor(stepIndex) {
  setEditingStep(stepIndex);

  const param = getStepParameter(stepIndex);
  const stepEditor = document.getElementById('stepEditor');
  const editingStepNum = document.getElementById('editingStepNum');

  editingStepNum.textContent = stepIndex + 1;
  stepEditor.style.display = 'block';

  document.getElementById('stepActive').checked = param.active;
  document.getElementById('stepDotted').checked = param.dotted;
  document.getElementById('stepTie').checked = param.tie;
  document.getElementById('stepScaleDegree').value = param.scaleDegree === null ? '' : param.scaleDegree;
  document.getElementById('stepVelocity').value = param.velocity || 80;
  document.getElementById('stepVelocityValue').textContent = param.velocity || 80;
}

/**
 * 2D Perlin noise implementation for previews
 */
function perlinNoise2D(x, y) {
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + t * (b - a);

  const X = Math.floor(x) & 255;
  const Y = Math.floor(y) & 255;

  const xf = x - Math.floor(x);
  const yf = y - Math.floor(y);

  const u = fade(xf);
  const v = fade(yf);

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

/**
 * Generate 256x256 noise preview bitmap
 */
function generateNoisePreview(noiseType, size = 256) {
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
          value = Math.sin(x * scale) * Math.cos(y * scale) +
                  Math.sin(x * scale * 2) * Math.cos(y * scale * 2) * 0.5;
          break;

        case 'perlin':
          value = perlinNoise2D(x * scale, y * scale);
          break;

        case 'fbm':
          let amplitude = 1.0;
          let frequency = scale;
          for (let i = 0; i < 4; i++) {
            value += perlinNoise2D(x * frequency, y * frequency) * amplitude;
            amplitude *= 0.5;
            frequency *= 2.0;
          }
          break;

        case 'voronoi':
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
          value = Math.abs(perlinNoise2D(x * scale, y * scale));
          value = 1.0 - value;
          value = value * value;
          break;

        case 'cellular':
          value = Math.sin(x * scale * 3) * Math.cos(y * scale * 3);
          value = value > 0 ? 1 : -1;
          break;
      }

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

/**
 * Generate noise shader palette with 256x256 bitmaps
 */
function generateNoisePalette() {
  const noiseGrid = document.getElementById('noiseGrid');
  const noiseTypes = ['simplex', 'perlin', 'fbm', 'voronoi', 'ridged', 'cellular'];
  const noiseNames = ['Simplex', 'Perlin', 'FBM', 'Voronoi', 'Ridged', 'Cellular'];

  noiseTypes.forEach((noiseType, index) => {
    const option = document.createElement('div');
    option.className = 'noise-option';
    if (noiseType === getCurrentNoiseType()) {
      option.classList.add('active');
    }

    const preview = generateNoisePreview(noiseType, 256);
    option.appendChild(preview);

    const label = document.createElement('div');
    label.className = 'noise-label';
    label.textContent = noiseNames[index];

    option.appendChild(label);

    option.addEventListener('click', () => {
      setCurrentNoiseType(noiseType);
      updateMaterialNoiseType(noiseMaterial, noiseType);

      // Update sampling material
      samplingMaterial.dispose();
      samplingMaterial = createSamplingMaterial(noiseMaterial.uniforms, noiseType);
      samplingScene.children[0].material = samplingMaterial;

      // Update active state
      document.querySelectorAll('.noise-option').forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
    });

    noiseGrid.appendChild(option);
  });
}

/**
 * Animation loop
 */
function animate() {
  animationId = requestAnimationFrame(animate);

  const deltaTime = 0.016; // ~60fps
  updateTime(deltaTime);

  // Update noise material time
  noiseMaterial.uniforms.uTime.value = getTime();

  // Update clay physics
  updateClayPhysics();
  noiseMaterial.uniforms.uDeformations.value = getDeformationsForShader();

  // Update sensor positions with distribution morphing
  updateSensorDistribution();

  // Update sequence glow (beacon highlighting)
  updateSequenceGlow();

  // Update beacon animations
  updateBeaconAnimations(beaconMeshes);

  // Update string physics and visuals
  for (let i = 0; i < stringPhysicsArray.length; i++) {
    const physics = stringPhysicsArray[i];
    updateStringPhysicsStep(physics);

    if (physics.isVibrating) {
      const displacement = applyStringDisplacement(physics);
      updateStringGeometry(stringMeshes[i], samplingPoints[i], displacement);
    }
  }

  updateStringVisuals(stringMeshes, stringPhysicsArray);

  // Update step grid to show current step
  updateStepGridUI();

  // Update controls
  updateControls();

  // Render scene
  render();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
