/**
 * Step Parameters Module
 *
 * Manages per-step sequencer parameters including active state,
 * duration modifiers, scale degrees, and velocity.
 */

// Step parameters array
let stepParameters = [];

/**
 * Initialize step parameters for a given number of steps
 * @param {number} numSteps - Number of steps to initialize
 */
export function initStepParameters(numSteps) {
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

/**
 * Get step parameters array
 * @returns {Array} Step parameters
 */
export function getStepParameters() {
  return stepParameters;
}

/**
 * Get parameters for a specific step
 * @param {number} index - Step index
 * @returns {Object} Step parameters
 */
export function getStepParameter(index) {
  return stepParameters[index];
}

/**
 * Set parameters for a specific step
 * @param {number} index - Step index
 * @param {Object} params - Parameter object
 */
export function setStepParameter(index, params) {
  if (index >= 0 && index < stepParameters.length) {
    stepParameters[index] = { ...stepParameters[index], ...params };
  }
}

/**
 * Set active state for a step
 * @param {number} index - Step index
 * @param {boolean} active - Active state
 */
export function setStepActive(index, active) {
  if (stepParameters[index]) {
    stepParameters[index].active = active;
  }
}

/**
 * Set dotted state for a step
 * @param {number} index - Step index
 * @param {boolean} dotted - Dotted state
 */
export function setStepDotted(index, dotted) {
  if (stepParameters[index]) {
    stepParameters[index].dotted = dotted;
  }
}

/**
 * Set tie state for a step
 * @param {number} index - Step index
 * @param {boolean} tie - Tie state
 */
export function setStepTie(index, tie) {
  if (stepParameters[index]) {
    stepParameters[index].tie = tie;
  }
}

/**
 * Set scale degree for a step
 * @param {number} index - Step index
 * @param {number|null} scaleDegree - Scale degree (1-7) or null
 */
export function setStepScaleDegree(index, scaleDegree) {
  if (stepParameters[index]) {
    stepParameters[index].scaleDegree = scaleDegree;
  }
}

/**
 * Set velocity for a step
 * @param {number} index - Step index
 * @param {number|null} velocity - Velocity (1-127) or null
 */
export function setStepVelocity(index, velocity) {
  if (stepParameters[index]) {
    stepParameters[index].velocity = velocity;
  }
}
