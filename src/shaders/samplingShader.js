/**
 * Sampling Shader Module
 *
 * GPU-based noise sampling for sequencer. Samples noise values
 * at specific world positions for MIDI note generation.
 */

import * as THREE from 'three';
import { noiseShaderLibrary } from './noiseLibrary.js';

/**
 * Create sampling material for GPU noise sampling
 * @param {Object} mainMaterialUniforms - Reference to main material uniforms
 * @param {string} noiseType - Noise type to use
 * @returns {THREE.ShaderMaterial}
 */
export function createSamplingMaterial(mainMaterialUniforms, noiseType = 'simplex') {
  const noiseFunc = noiseShaderLibrary[noiseType] || noiseShaderLibrary.simplex;

  return new THREE.ShaderMaterial({
    uniforms: {
      uSpatialScale: mainMaterialUniforms.uSpatialScale,
      uTimeScale: mainMaterialUniforms.uTimeScale,
      uTime: mainMaterialUniforms.uTime,
      uDisplacementAmount: mainMaterialUniforms.uDisplacementAmount
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
      uniform float uDisplacementAmount;

      ${noiseFunc}

      void main() {
        // Sample 3D noise at world position with time animation
        vec3 p = vWorldPos * uSpatialScale + vec3(0.0, 0.0, uTime * uTimeScale);
        float noise = noiseFunction(p);

        float value;

        // When displacement is 0, use raw noise value directly
        if (uDisplacementAmount < 0.0001) {
          // Map noise from [-1, 1] to [0, 1]
          value = (noise + 1.0) * 0.5;
        } else {
          // Calculate displacement (same as vertex shader)
          float displacement = noise * uDisplacementAmount;

          // Calculate radial depth
          vec3 normalizedPos = normalize(vWorldPos);
          float baseRadius = length(vWorldPos);
          float actualRadius = baseRadius + displacement;

          // Map radius to [0, 1] range for MIDI
          value = (actualRadius - (1.0 - uDisplacementAmount)) / (uDisplacementAmount * 2.0);
        }

        value = clamp(value, 0.0, 1.0);

        // Output the radial depth value
        gl_FragColor = vec4(vec3(value), 1.0);
      }
    `
  });
}

/**
 * Create sampling geometry for noise sampling
 * @param {Array<THREE.Vector3>} samplePoints - Sample point positions
 * @returns {THREE.BufferGeometry}
 */
export function createSamplingGeometry(samplePoints) {
  const numPoints = samplePoints.length;
  const geometry = new THREE.BufferGeometry();

  // Screen space positions
  const samplingPositions = new Float32Array(numPoints * 3);
  for (let i = 0; i < numPoints; i++) {
    const x = (i / numPoints) * 2 - 1 + (1 / numPoints);
    samplingPositions[i * 3] = x;
    samplingPositions[i * 3 + 1] = 0;
    samplingPositions[i * 3 + 2] = 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(samplingPositions, 3));

  // World positions (will be updated dynamically)
  const worldPositions = new Float32Array(numPoints * 3);
  samplePoints.forEach((point, i) => {
    worldPositions[i * 3] = point.x;
    worldPositions[i * 3 + 1] = point.y;
    worldPositions[i * 3 + 2] = point.z;
  });

  geometry.setAttribute('worldPosition', new THREE.BufferAttribute(worldPositions, 3));

  return geometry;
}

/**
 * Update world positions in sampling geometry
 * @param {THREE.BufferGeometry} geometry - Sampling geometry
 * @param {Array<THREE.Vector3>} samplePoints - Updated sample points
 * @param {THREE.Quaternion} rotation - Noise sphere rotation
 */
export function updateSamplingWorldPositions(geometry, samplePoints, rotation) {
  const worldPositions = geometry.attributes.worldPosition.array;
  const tempVec = new THREE.Vector3();

  for (let i = 0; i < samplePoints.length; i++) {
    // Apply noise sphere's rotation to the sample point
    tempVec.copy(samplePoints[i]);
    tempVec.applyQuaternion(rotation);

    worldPositions[i * 3] = tempVec.x;
    worldPositions[i * 3 + 1] = tempVec.y;
    worldPositions[i * 3 + 2] = tempVec.z;
  }

  geometry.attributes.worldPosition.needsUpdate = true;
}

/**
 * Create render target for sampling
 * @param {number} width - Number of samples
 * @returns {THREE.WebGLRenderTarget}
 */
export function createSamplingRenderTarget(width) {
  return new THREE.WebGLRenderTarget(width, 1, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  });
}

/**
 * Sample noise from GPU render target
 * @param {THREE.WebGLRenderer} renderer - Renderer
 * @param {THREE.Scene} samplingScene - Sampling scene
 * @param {THREE.Camera} samplingCamera - Sampling camera
 * @param {THREE.WebGLRenderTarget} samplingTarget - Render target
 * @param {number} numSamples - Number of samples
 * @returns {Array<number>} Sampled noise values (0-1)
 */
export function sampleNoiseFromGPU(renderer, samplingScene, samplingCamera, samplingTarget, numSamples) {
  // Render to the sampling target
  renderer.setRenderTarget(samplingTarget);
  renderer.render(samplingScene, samplingCamera);
  renderer.setRenderTarget(null);

  // Read pixels from render target
  const pixelBuffer = new Uint8Array(numSamples * 4);
  renderer.readRenderTargetPixels(samplingTarget, 0, 0, numSamples, 1, pixelBuffer);

  // Extract values (R channel contains the noise value)
  const values = [];
  for (let i = 0; i < numSamples; i++) {
    values.push(pixelBuffer[i * 4] / 255);
  }

  return values;
}
