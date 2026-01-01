/**
 * Noise Material Module
 *
 * Creates ShaderMaterial for the noise sphere with customizable
 * noise type, colors, and physical properties.
 */

import * as THREE from 'three';
import { noiseShaderLibrary } from './noiseLibrary.js';
import { NOISE_DEFAULTS, COLOR_DEFAULTS } from '../config/constants.js';

/**
 * Create noise sphere shader material
 * @param {string} noiseType - Noise type (simplex, perlin, fbm, voronoi, ridged, cellular)
 * @returns {THREE.ShaderMaterial}
 */
export function createNoiseMaterial(noiseType = NOISE_DEFAULTS.DEFAULT_TYPE) {
  // Initialize empty deformation array for clay physics
  const emptyDeformations = [];
  for (let i = 0; i < 64; i++) {
    emptyDeformations.push(new THREE.Vector3(0, 0, 0));
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSpatialScale: { value: NOISE_DEFAULTS.SPATIAL_SCALE },
      uTimeScale: { value: NOISE_DEFAULTS.TIME_SCALE },
      uTime: { value: 0.0 },
      uDeformations: { value: emptyDeformations },
      uShininess: { value: 30.0 },
      uMetalness: { value: 0.2 },
      uRoughness: { value: 0.4 },
      uDisplacementAmount: { value: NOISE_DEFAULTS.DISPLACEMENT_AMOUNT },
      // Color gradient uniforms (5 color stops with alpha)
      uColor1: { value: new THREE.Vector4(
        COLOR_DEFAULTS.COLOR_1.r,
        COLOR_DEFAULTS.COLOR_1.g,
        COLOR_DEFAULTS.COLOR_1.b,
        COLOR_DEFAULTS.COLOR_1.a
      )},
      uColor2: { value: new THREE.Vector4(
        COLOR_DEFAULTS.COLOR_2.r,
        COLOR_DEFAULTS.COLOR_2.g,
        COLOR_DEFAULTS.COLOR_2.b,
        COLOR_DEFAULTS.COLOR_2.a
      )},
      uColor3: { value: new THREE.Vector4(
        COLOR_DEFAULTS.COLOR_3.r,
        COLOR_DEFAULTS.COLOR_3.g,
        COLOR_DEFAULTS.COLOR_3.b,
        COLOR_DEFAULTS.COLOR_3.a
      )},
      uColor4: { value: new THREE.Vector4(
        COLOR_DEFAULTS.COLOR_4.r,
        COLOR_DEFAULTS.COLOR_4.g,
        COLOR_DEFAULTS.COLOR_4.b,
        COLOR_DEFAULTS.COLOR_4.a
      )},
      uColor5: { value: new THREE.Vector4(
        COLOR_DEFAULTS.COLOR_5.r,
        COLOR_DEFAULTS.COLOR_5.g,
        COLOR_DEFAULTS.COLOR_5.b,
        COLOR_DEFAULTS.COLOR_5.a
      )}
    },

    vertexShader: createVertexShader(noiseType),
    fragmentShader: createFragmentShader(noiseType),

    transparent: true,
    side: THREE.DoubleSide
  });

  return material;
}

/**
 * Create vertex shader with selected noise type
 * @param {string} noiseType - Noise type
 * @returns {string} Vertex shader code
 */
function createVertexShader(noiseType) {
  const noiseFunc = noiseShaderLibrary[noiseType] || noiseShaderLibrary.simplex;

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

    ${noiseFunc}

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

      // Recalculate normal after deformation
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

/**
 * Create fragment shader with selected noise type
 * @param {string} noiseType - Noise type
 * @returns {string} Fragment shader code
 */
function createFragmentShader(noiseType) {
  const noiseFunc = noiseShaderLibrary[noiseType] || noiseShaderLibrary.simplex;

  return /* glsl */`
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

    ${noiseFunc}

    void main() {
      // Sample 3D noise at world position with time animation
      vec3 p = vWorldPos * uSpatialScale + vec3(0.0, 0.0, uTime * uTimeScale);

      // Get noise value
      float noise = noiseFunction(p);

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

      // Fresnel effect for edge glow
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
  `;
}

/**
 * Update material noise type
 * @param {THREE.ShaderMaterial} material - Material to update
 * @param {string} noiseType - New noise type
 */
export function updateMaterialNoiseType(material, noiseType) {
  material.vertexShader = createVertexShader(noiseType);
  material.fragmentShader = createFragmentShader(noiseType);
  material.needsUpdate = true;
}
