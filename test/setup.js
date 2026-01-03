/**
 * Test Setup
 *
 * Global test configuration and mocks for Vitest
 */

import { vi } from 'vitest';

// Mock Web MIDI API
global.navigator.requestMIDIAccess = vi.fn(() =>
  Promise.resolve({
    inputs: new Map(),
    outputs: new Map([
      ['test-output', {
        name: 'IAC Driver Test',
        send: vi.fn(),
      }]
    ]),
  })
);

// Mock performance.now() for consistent timing
let mockTime = 0;
global.performance.now = vi.fn(() => mockTime);
global.setMockTime = (time) => { mockTime = time; };
global.advanceMockTime = (delta) => { mockTime += delta; };

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16));
global.cancelAnimationFrame = vi.fn(clearTimeout);

// Mock WebGL context
HTMLCanvasElement.prototype.getContext = vi.fn((type) => {
  if (type === 'webgl' || type === 'webgl2') {
    return {
      clearColor: vi.fn(),
      clear: vi.fn(),
      viewport: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      getExtension: vi.fn(),
      getParameter: vi.fn(() => 16),
      createShader: vi.fn(() => ({})),
      shaderSource: vi.fn(),
      compileShader: vi.fn(),
      createProgram: vi.fn(() => ({})),
      attachShader: vi.fn(),
      linkProgram: vi.fn(),
      useProgram: vi.fn(),
      getShaderParameter: vi.fn(() => true),
      getProgramParameter: vi.fn(() => true),
      createBuffer: vi.fn(() => ({})),
      bindBuffer: vi.fn(),
      bufferData: vi.fn(),
      createTexture: vi.fn(() => ({})),
      bindTexture: vi.fn(),
      texImage2D: vi.fn(),
      texParameteri: vi.fn(),
      createFramebuffer: vi.fn(() => ({})),
      bindFramebuffer: vi.fn(),
      framebufferTexture2D: vi.fn(),
      checkFramebufferStatus: vi.fn(() => 36053), // FRAMEBUFFER_COMPLETE
      readPixels: vi.fn(),
      deleteBuffer: vi.fn(),
      deleteTexture: vi.fn(),
      deleteFramebuffer: vi.fn(),
      deleteShader: vi.fn(),
      deleteProgram: vi.fn(),
    };
  }
  return null;
});

// Suppress console warnings during tests (optional)
// global.console.warn = vi.fn();
