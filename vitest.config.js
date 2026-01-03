import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '*.config.js',
        'src/shaders/noiseLibrary.js', // GLSL shader code
      ]
    },
    setupFiles: ['./test/setup.js'],
    mockReset: true,
    restoreMocks: true,
  },
});
