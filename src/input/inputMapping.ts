/**
 * Data-driven input mapping: physical keys/buttons → logical actions.
 *
 * Integration: InputManager reads this mapping to translate raw input events
 * into logical actions. Change the mapping to rebind controls without code edits.
 */

export type LogicalAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'fireSidearm'
  | 'fireLongArm'
  | 'reload'
  | 'dodgeRoll'
  | 'interact'
  | 'openUpgrade'
  | 'pause';

export interface InputMapping {
  keyboard: Record<string, LogicalAction>;
  mouse: Record<number, LogicalAction>;
  gamepadButtons: Record<number, LogicalAction>;
}

export const DEFAULT_INPUT_MAPPING: InputMapping = {
  keyboard: {
    KeyW: 'moveUp',
    KeyS: 'moveDown',
    KeyA: 'moveLeft',
    KeyD: 'moveRight',
    KeyR: 'reload',
    Space: 'dodgeRoll',
    KeyE: 'interact',
    KeyU: 'openUpgrade',
    Escape: 'pause',
  },
  mouse: {
    0: 'fireSidearm',  // LMB
    2: 'fireLongArm',  // RMB
  },
  gamepadButtons: {
    // Standard gamepad mapping (https://w3c.github.io/gamepad/#remapping)
    5: 'fireSidearm',   // RB
    7: 'fireLongArm',   // RT
    2: 'reload',        // X
    0: 'dodgeRoll',     // A
    3: 'interact',      // Y
    8: 'pause',         // Back/Select
    1: 'openUpgrade',   // B
  },
};

export function createInputMapping(overrides?: Partial<InputMapping>): InputMapping {
  if (!overrides) return { ...DEFAULT_INPUT_MAPPING };
  return {
    keyboard: { ...DEFAULT_INPUT_MAPPING.keyboard, ...overrides.keyboard },
    mouse: { ...DEFAULT_INPUT_MAPPING.mouse, ...overrides.mouse },
    gamepadButtons: { ...DEFAULT_INPUT_MAPPING.gamepadButtons, ...overrides.gamepadButtons },
  };
}
