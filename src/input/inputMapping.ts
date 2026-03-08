/**
 * Data-driven input mapping: physical keys/buttons → logical actions.
 *
 * Integration: InputManager reads this mapping to translate raw input events
 * into logical actions. Change the mapping to rebind controls without code edits.
 */

import { LogicalAction } from '../ecs/components';
export { LogicalAction } from '../ecs/components';

export interface InputMapping {
  keyboard: Record<string, LogicalAction>;
  mouse: Record<number, LogicalAction>;
  gamepadButtons: Record<number, LogicalAction>;
}

export const DEFAULT_INPUT_MAPPING: InputMapping = {
  keyboard: {
    KeyW: LogicalAction.MoveUp,
    KeyS: LogicalAction.MoveDown,
    KeyA: LogicalAction.MoveLeft,
    KeyD: LogicalAction.MoveRight,
    KeyR: LogicalAction.Reload,
    Space: LogicalAction.DodgeRoll,
    KeyE: LogicalAction.Interact,
    KeyU: LogicalAction.OpenUpgrade,
    Escape: LogicalAction.Pause,
    BracketRight: LogicalAction.DebugSpeedUp,
    BracketLeft: LogicalAction.DebugSpeedDown,
  },
  mouse: {
    0: LogicalAction.FireSidearm,  // LMB
    2: LogicalAction.FireLongArm,  // RMB
  },
  gamepadButtons: {
    // Standard gamepad mapping (https://w3c.github.io/gamepad/#remapping)
    5: LogicalAction.FireSidearm,   // RB
    7: LogicalAction.FireLongArm,   // RT
    2: LogicalAction.Reload,        // X
    0: LogicalAction.DodgeRoll,     // A
    3: LogicalAction.Interact,      // Y
    8: LogicalAction.Pause,         // Back/Select
    1: LogicalAction.OpenUpgrade,   // B
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
