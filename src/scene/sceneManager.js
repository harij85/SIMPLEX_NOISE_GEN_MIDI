/**
 * Scene Manager Module
 *
 * Manages Three.js scene, camera, renderer, and orbit controls setup.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CAMERA_CONFIG } from '../config/constants.js';

// Scene components
let renderer = null;
let scene = null;
let camera = null;
let controls = null;

// Rotation tracking for noise sphere
const previousCameraQuaternion = new THREE.Quaternion();
const currentCameraQuaternion = new THREE.Quaternion();
const deltaQuaternion = new THREE.Quaternion();

// Noise rotation group (separate from sequencer elements)
let noiseRotationGroup = null;

/**
 * Initialize Three.js scene, camera, and renderer
 */
export function initScene() {
  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  document.body.appendChild(renderer.domElement);

  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  // Camera setup
  camera = new THREE.PerspectiveCamera(
    CAMERA_CONFIG.FOV,
    window.innerWidth / window.innerHeight,
    CAMERA_CONFIG.NEAR,
    CAMERA_CONFIG.FAR
  );
  camera.position.set(0, 0, CAMERA_CONFIG.POSITION_Z);

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;

  // Noise rotation group (for camera-independent rotation)
  noiseRotationGroup = new THREE.Group();
  scene.add(noiseRotationGroup);

  // Handle window resize
  window.addEventListener('resize', handleResize);

  console.log('Scene initialized');
}

/**
 * Handle window resize
 */
function handleResize() {
  if (!camera || !renderer) return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

/**
 * Update camera rotation tracking
 * Applies rotation delta to noise sphere only
 */
export function updateCameraRotation() {
  if (!camera || !noiseRotationGroup) return;

  // Get current camera quaternion
  camera.getWorldQuaternion(currentCameraQuaternion);

  // Calculate rotation delta
  deltaQuaternion.copy(currentCameraQuaternion).invert().multiply(previousCameraQuaternion).invert();

  // Apply delta to noise rotation group
  noiseRotationGroup.quaternion.multiply(deltaQuaternion);

  // Store current as previous for next frame
  previousCameraQuaternion.copy(currentCameraQuaternion);
}

/**
 * Render the scene
 */
export function render() {
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

/**
 * Update orbit controls
 */
export function updateControls() {
  if (controls) {
    controls.update();
  }
}

/**
 * Get renderer
 * @returns {THREE.WebGLRenderer}
 */
export function getRenderer() {
  return renderer;
}

/**
 * Get scene
 * @returns {THREE.Scene}
 */
export function getScene() {
  return scene;
}

/**
 * Get camera
 * @returns {THREE.PerspectiveCamera}
 */
export function getCamera() {
  return camera;
}

/**
 * Get orbit controls
 * @returns {OrbitControls}
 */
export function getControls() {
  return controls;
}

/**
 * Get noise rotation group
 * @returns {THREE.Group}
 */
export function getNoiseRotationGroup() {
  return noiseRotationGroup;
}

/**
 * Add object to scene
 * @param {THREE.Object3D} object - Object to add
 */
export function addToScene(object) {
  if (scene) {
    scene.add(object);
  }
}

/**
 * Add object to noise rotation group
 * @param {THREE.Object3D} object - Object to add
 */
export function addToNoiseGroup(object) {
  if (noiseRotationGroup) {
    noiseRotationGroup.add(object);
  }
}

/**
 * Remove object from scene
 * @param {THREE.Object3D} object - Object to remove
 */
export function removeFromScene(object) {
  if (scene) {
    scene.remove(object);
  }
}

/**
 * Get renderer DOM element
 * @returns {HTMLCanvasElement}
 */
export function getRendererDomElement() {
  return renderer ? renderer.domElement : null;
}

/**
 * Enable orbit controls
 */
export function enableControls() {
  if (controls) {
    controls.enabled = true;
  }
}

/**
 * Disable orbit controls
 */
export function disableControls() {
  if (controls) {
    controls.enabled = false;
  }
}
