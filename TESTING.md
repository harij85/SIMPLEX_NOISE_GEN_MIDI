# Testing Documentation

Comprehensive testing guide for the 3D Noise MIDI Instrument application.

## Table of Contents

1. [Overview](#overview)
2. [Test Infrastructure](#test-infrastructure)
3. [Running Tests](#running-tests)
4. [Test Coverage](#test-coverage)
5. [Unit Tests](#unit-tests)
6. [Integration Tests](#integration-tests)
7. [Writing New Tests](#writing-new-tests)
8. [Continuous Integration](#continuous-integration)

## Overview

The application uses **Vitest** as the testing framework, providing fast, modern testing with native ES modules support and excellent TypeScript/JSX handling.

### Test Philosophy

- **Unit Tests**: Test individual modules in isolation
- **Integration Tests**: Test module interactions and workflows
- **Coverage Goals**: Aim for >80% code coverage on critical paths
- **Fast Feedback**: Tests should run quickly (<5s for unit tests)

## Test Infrastructure

### Framework: Vitest

Vitest is chosen for its:
- Native ES modules support
- Fast execution with smart watch mode
- Compatible with Vite build tool
- Rich assertion library
- Code coverage built-in

### Environment: happy-dom

Uses `happy-dom` for lightweight DOM simulation, suitable for testing:
- Canvas operations
- WebGL context creation
- Browser APIs (Web MIDI, Performance)

### Configuration

See [vitest.config.js](vitest.config.js) for full configuration.

Key settings:
- Environment: `happy-dom`
- Globals: `true` (for describe, it, expect)
- Coverage: v8 provider with text/json/html reporters
- Setup: [test/setup.js](test/setup.js) for global mocks

## Running Tests

### Basic Commands

```bash
# Run all tests in watch mode
npm test

# Run tests once and exit
npm run test:run

# Run tests with UI dashboard
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

### Watch Mode

Watch mode automatically reruns tests when files change:

```bash
npm test
```

Press `h` in watch mode to see available commands:
- `a` - run all tests
- `f` - run only failed tests
- `u` - update snapshots
- `p` - filter by filename
- `t` - filter by test name
- `q` - quit

### UI Dashboard

The Vitest UI provides a visual test runner:

```bash
npm run test:ui
```

Then open http://localhost:51204/__vitest__/ in your browser.

Features:
- Visual test tree
- Real-time test execution
- Console output per test
- Code coverage visualization
- Performance metrics

### Coverage Reports

Generate coverage reports:

```bash
npm run test:coverage
```

Coverage outputs:
- **Text**: Terminal summary
- **HTML**: `coverage/index.html` (open in browser)
- **JSON**: `coverage/coverage-final.json` (for CI)

Coverage thresholds:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

## Test Coverage

### Current Coverage

Run `npm run test:coverage` to see current coverage.

### Module Coverage

| Module | Coverage | Priority |
|--------|----------|----------|
| config/globalState.js | ✅ 100% | High |
| sequencer/stepParameters.js | ✅ 100% | High |
| sequencer/scheduler.js | ✅ 100% | High |
| physics/stringPhysics.js | ✅ 95% | High |
| utils/scales.js | ✅ 100% | High |
| utils/geometry.js | ✅ 95% | High |
| midi/midiIO.js | ⚠️ 60% | Medium |
| shaders/* | ⏸️ Excluded | Low |

### Excluded from Coverage

- `shaders/noiseLibrary.js` - GLSL shader code
- Configuration files (*.config.js)
- Test files (test/**)
- Node modules

## Unit Tests

Unit tests verify individual module functionality in isolation.

### Location

All unit tests are in `test/unit/`:

```
test/unit/
├── globalState.test.js       # Global state management
├── stepParameters.test.js    # Step sequencer parameters
├── scheduler.test.js         # BPM and timing calculations
├── stringPhysics.test.js     # String vibration physics
├── scales.test.js            # Musical scale system
└── geometry.test.js          # 3D geometry utilities
```

### Example Unit Test

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { setBPM, getBPM } from '../../src/sequencer/scheduler.js';

describe('Scheduler', () => {
  beforeEach(() => {
    setBPM(120);
  });

  it('should set and get BPM', () => {
    setBPM(140);
    expect(getBPM()).toBe(140);
  });

  it('should calculate step duration', () => {
    setBPM(120);
    const stepMs = getStepMS();
    expect(stepMs).toBeCloseTo(500, 1);
  });
});
```

### Unit Test Patterns

#### Setup and Teardown

Use `beforeEach` and `afterEach` for test isolation:

```javascript
describe('Module', () => {
  let instance;

  beforeEach(() => {
    instance = createInstance();
  });

  afterEach(() => {
    instance.cleanup();
  });
});
```

#### Assertions

Common assertion patterns:

```javascript
// Equality
expect(value).toBe(42);
expect(array).toEqual([1, 2, 3]);

// Truthiness
expect(value).toBeTruthy();
expect(value).toBeFalsy();

// Numbers
expect(value).toBeGreaterThan(10);
expect(value).toBeCloseTo(3.14, 2);

// Arrays/Objects
expect(array).toHaveLength(5);
expect(obj).toHaveProperty('key', 'value');

// Functions
expect(() => fn()).toThrow();
expect(() => fn()).not.toThrow();
```

## Integration Tests

Integration tests verify module interactions and complete workflows.

### Location

All integration tests are in `test/integration/`:

```
test/integration/
├── sequencer.test.js         # Complete sequencer workflow
└── physics.test.js           # Combined physics systems
```

### Sequencer Integration Test

Tests complete MIDI sequencer workflow:

```javascript
describe('Sequencer Integration', () => {
  it('should execute full workflow', async () => {
    // 1. Initialize MIDI
    await initMIDI();

    // 2. Configure pattern
    initStepParameters(8);
    setStepActive(0, true);
    setStepActive(2, true);
    setStepActive(4, true);

    // 3. Set tempo
    setBPM(128);

    // 4. Start sequencer
    startSequencer();
    expect(isSequencerRunning()).toBe(true);

    // 5. Stop sequencer
    stopSequencer();
    expect(isSequencerRunning()).toBe(false);
  });
});
```

### Physics Integration Test

Tests combined string and clay physics:

```javascript
describe('Physics Integration', () => {
  it('should handle simultaneous systems', () => {
    // Create strings
    const strings = [createStringPhysics(), createStringPhysics()];

    // Pluck strings
    strings.forEach(s => pluckString(s, 0.8));

    // Create clay deformations
    moldAtPoint(0.5, 0.5, 0.1);

    // Update both systems
    strings.forEach(s => updateStringPhysicsStep(s));
    updateClayPhysics();

    // Verify both active
    expect(strings[0].isVibrating).toBe(true);
    expect(getDeformationsForShader().length).toBeGreaterThan(0);
  });
});
```

## Writing New Tests

### Test File Structure

```javascript
/**
 * Module Name Tests
 *
 * Description of what's being tested
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { functionToTest } from '../../src/module/file.js';

describe('Module Name', () => {
  beforeEach(() => {
    // Setup
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = prepareInput();

      // Act
      const result = functionToTest(input);

      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

### Best Practices

1. **One assertion per test** (when possible)
2. **Descriptive test names**: "should calculate BPM correctly"
3. **Arrange-Act-Assert pattern**: Setup, execute, verify
4. **Test edge cases**: null, 0, negative, max values
5. **Isolate tests**: No dependencies between tests
6. **Mock external dependencies**: MIDI, WebGL, file system

### Mocking

Global mocks are in [test/setup.js](test/setup.js):

```javascript
// Mock Web MIDI API
global.navigator.requestMIDIAccess = vi.fn(() =>
  Promise.resolve({
    outputs: new Map([
      ['test', { name: 'Test Output', send: vi.fn() }]
    ])
  })
);
```

Module-specific mocks:

```javascript
import { vi } from 'vitest';

const mockFn = vi.fn();
mockFn.mockReturnValue(42);
expect(mockFn()).toBe(42);
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run test:run
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Local Pre-commit Hook

Add to `.git/hooks/pre-commit`:

```bash
#!/bin/sh
npm run test:run
```

Make executable:

```bash
chmod +x .git/hooks/pre-commit
```

## Test Organization

### Naming Conventions

- **Files**: `moduleName.test.js`
- **Describe blocks**: Match module/class name
- **Test names**: Start with "should"

### Directory Structure

```
test/
├── setup.js                  # Global test setup
├── unit/                     # Unit tests
│   ├── globalState.test.js
│   ├── stepParameters.test.js
│   └── ...
├── integration/              # Integration tests
│   ├── sequencer.test.js
│   └── physics.test.js
└── fixtures/                 # Test data (optional)
    └── scalaFiles/
```

## Debugging Tests

### VS Code Configuration

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Tests",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "test:run"],
  "console": "integratedTerminal"
}
```

### Console Logging

```javascript
it('should debug issue', () => {
  const value = computeValue();
  console.log('Debug:', value);  // Visible in test output
  expect(value).toBe(42);
});
```

### Focused Tests

Run single test file:

```bash
npm test -- globalState.test.js
```

Run single test:

```javascript
it.only('should run only this test', () => {
  // ...
});
```

## Performance Testing

Vitest tracks test execution time. Slow tests (>1s) are highlighted.

### Benchmarking

```javascript
import { bench, describe } from 'vitest';

describe('Performance', () => {
  bench('fibonacci calculation', () => {
    fibonacci(30);
  });
});
```

## Coverage Goals

### Priority Modules (>90%)

- Global state management
- Step parameters
- Scheduler timing
- String physics
- Scale system

### Medium Priority (>75%)

- MIDI I/O
- Clay physics
- Geometry utilities
- Scene management

### Low Priority (>50%)

- UI event handlers
- Visual effects
- Shader utilities

## Common Issues

### Issue: Tests timeout

**Solution**: Increase timeout in test:

```javascript
it('slow operation', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Issue: WebGL context fails

**Solution**: Check test/setup.js WebGL mock is complete.

### Issue: MIDI mock not working

**Solution**: Ensure `navigator.requestMIDIAccess` is mocked before import.

### Issue: Flaky tests

**Solution**: Check for:
- Race conditions
- Shared state between tests
- Time-dependent logic
- Random values

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Vitest API Reference](https://vitest.dev/api/)
- [Testing Best Practices](https://testingjavascript.com/)
- [Jest/Vitest Matchers](https://vitest.dev/api/expect.html)

## Summary

The testing infrastructure provides comprehensive coverage of the application's core functionality:

✅ **Unit Tests**: 6 test files covering critical modules
✅ **Integration Tests**: 2 test files verifying workflows
✅ **Fast Execution**: Tests run in <5 seconds
✅ **Coverage Reporting**: HTML and JSON output
✅ **Watch Mode**: Instant feedback during development
✅ **UI Dashboard**: Visual test exploration

Run `npm test` to start testing!

---

## MIDI Tracker Display Testing

### Unit Tests

The MIDI tracker display has comprehensive unit tests in `test/unit/midiTracker.test.js`:

```bash
npm run test:run -- test/unit/midiTracker.test.js
```

#### Test Coverage (22 tests)

✅ **Basic Functionality** (3 tests)
- Tracker div element creation
- Single MIDI note addition with GPU column
- Correct note information display (STEP | GPU | NOTE | VEL | DUR)

✅ **Note Name Conversion** (5 tests)
- MIDI 60 → C4
- MIDI 69 → A4
- MIDI 48 → C3
- MIDI 72 → C5
- MIDI 61 → C#4

✅ **Multiple Notes** (3 tests)
- Sequential note addition
- Reverse chronological order (newest first)
- Step number incrementing

✅ **Row Limit** (2 tests)
- Dynamic row maximum (matches step count)
- Oldest rows removed when exceeding limit

✅ **Row Highlighting** (2 tests)
- Newest row highlighted
- Previous row highlight removed

✅ **Edge Cases** (5 tests)
- Very high MIDI notes (127)
- Very low MIDI notes (0)
- Low velocity (1)
- High velocity (127)
- Duration rounding

✅ **Clock Sync** (2 tests)
- Clear tracker on step 0 (loop restart)
- Maintain fresh data for each loop

### Browser Console Debugging

When the application runs in the browser, these console logs help debug tracker issues:

#### Expected Console Output

When sequencer plays a note:

```
[Note Callback] Note ON: { note: 60, velocity: 80, time: 1234.567, stepIndex: 0 }
[Clock Sync] Step 1 - Tracker cleared
[Note Callback] Calling updateMIDIMonitor with estimatedDuration: 450
[MIDI Tracker] updateMIDIMonitor called: { note: 60, velocity: 80, duration: 450 }
[MIDI Tracker] Creating row: { stepNumber: 1, noteName: 'C4', velocity: 80, durationMs: 450 }
[Clock Sync] Tracker cleared for new loop
```

#### Error: Tracker div not found

```
[MIDI Tracker] trackerRows div not found!
```

This means `<div id="trackerRows">` is missing or hasn't loaded yet.

### Debugging Checklist

If the tracker is not updating in the browser, check these in order:

#### 1. Check HTML Element Exists

Open browser console:
```javascript
document.getElementById('trackerRows')
```

**Expected**: Returns the div element
**If null**: HTML hasn't loaded or has wrong ID

#### 2. Check if Sequencer is Running

1. Open browser console
2. Click "Start" button in UI
3. Look for `[Note Callback] Note ON:` messages

**Expected**: Console logs appear every step
**If not**: Sequencer isn't generating notes

#### 3. Check getCurrentStep Function

Open browser console:
```javascript
import('./src/config/globalState.js').then(m => console.log('Current step:', m.getCurrentStep()));
```

**Expected**: Returns a number (0-15 internally, displayed as 01-16)
**If error**: Import is failing

#### 4. Manual Tracker Test

Open browser console:
```javascript
const trackerDiv = document.getElementById('trackerRows');
console.log('Tracker div:', trackerDiv);
console.log('Tracker children before:', trackerDiv.children.length);

// Create test row
const row = document.createElement('div');
row.textContent = 'TEST ROW';
trackerDiv.appendChild(row);

console.log('Tracker children after:', trackerDiv.children.length);
```

**Expected**: Row count increases
**If not**: DOM manipulation is blocked

#### 5. Check Note Callback Registration

Verify in `src/main.js` (lines 339-362):
- `setSendNoteOnCallback` is called
- Callback function is defined
- Callback registered BEFORE sequencer starts

### Common Issues

#### Issue 1: "trackerRows div not found"

**Cause**: HTML element doesn't exist or wrong ID
**Solution**: Check `index.html` line 741 for `<div id="trackerRows">`

#### Issue 2: No console logs at all

**Cause**: Sequencer not running or callbacks not firing
**Solution**:
1. Click "Start" button
2. Check if sequencer is actually running
3. Verify MIDI output is initialized

#### Issue 3: Logs appear but no visual update

**Cause**: CSS or display issue
**Solution**: Check if tracker div is visible:
```javascript
const div = document.getElementById('trackerRows');
console.log('Computed style:', window.getComputedStyle(div).display);
```

#### Issue 4: Updates stop after first note

**Cause**: Error in tracker update function
**Solution**: Check browser console for JavaScript errors

### Expected Behavior

When working correctly:

1. Start sequencer by clicking "Start" button
2. Every step plays → console logs appear
3. **Clock sync: Tracker clears when step 1 plays** (loop restart)
4. New row appears at TOP of tracker display
5. Each row shows: **STEP | GPU | NOTE | VEL | DUR(ms)**
6. GPU column displays color swatch from noise sampling
7. Tracker dynamically adjusts to show all steps (4-32 rows)
8. Tracker shows only current loop data (01-16, not duplicates)
9. Newest row has subtle highlight (rgba(255, 255, 255, 0.05))
10. Previous row highlight fades to transparent

### File Locations

- **Tracker implementation**: `src/main.js` lines 1313-1385
- **Tracker HTML**: `index.html` lines 727-752
- **Tracker tests**: `test/unit/midiTracker.test.js`
- **Note callbacks**: `src/main.js` lines 339-362

### Quick Test Command

Run only the tracker tests:
```bash
npm run test:run -- test/unit/midiTracker.test.js
```

All 119 tests (97 original + 22 tracker):
```bash
npm run test:run
```

### Clock Sync Implementation

The tracker implements an internal master clock that syncs on step 1:

**Current Implementation:**
- Tracker clears automatically when step 0 (displayed as step 1) plays
- Shows only the current loop's data (no historical duplicates)
- Updates on note ON (not note OFF) to prevent duplicate entries
- Uses estimated duration based on step timing
- Prepares for future OSC/UDP clock sync from Max/Ableton

**Console Output:**
```
[Clock Sync] Step 1 - Tracker cleared
[Note Callback] Note ON: { note: 60, velocity: 80, time: 1234.567, stepIndex: 0 }
[Note Callback] Calling updateMIDIMonitor with estimatedDuration: 450
```

**Note ON vs Note OFF:**
- Tracker updates only on note ON events (with estimated duration)
- Note OFF events send MIDI but don't update tracker
- This prevents duplicate entries (09 09, 10 10, etc.)

**Future Enhancement:**
This internal clock system is designed to accept external clock signals via OSC/UDP from DAWs like Max or Ableton, enabling perfect sync across multiple systems.
