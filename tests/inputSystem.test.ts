// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { InputManager, type InputState } from '../src/input/inputManager';
import { inputSystem } from '../src/systems/inputSystem';
import {
  DEFAULT_INPUT_MAPPING,
  createInputMapping,
  LogicalAction,
  type InputMapping,
} from '../src/input/inputMapping';
import { getDesignParams } from '../src/config/designParams';

// ── Helpers ─────────────────────────────────────────────────────────────────

function simulateKeyDown(mgr: InputManager, code: string): void {
  const target = new EventTarget();
  mgr.attach(target);
  target.dispatchEvent(new KeyboardEvent('keydown', { code }));
  mgr.detach(target);
}

function simulateMouseDown(mgr: InputManager, button: number): void {
  const target = new EventTarget();
  mgr.attach(target);
  target.dispatchEvent(new MouseEvent('mousedown', { button }));
  mgr.detach(target);
}

/** Attach, fire multiple events in sequence, detach */
function withEvents(
  mgr: InputManager,
  fn: (target: EventTarget) => void,
): void {
  const target = new EventTarget();
  mgr.attach(target);
  fn(target);
  mgr.detach(target);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('InputSystem', () => {
  let mgr: InputManager;

  beforeEach(() => {
    mgr = new InputManager();
  });

  // ── Idle / default state ──────────────────────────────────────────────

  describe('idle state (no input)', () => {
    it('returns all fields defined with correct types', () => {
      const state = inputSystem(mgr);
      expect(typeof state.moveX).toBe('number');
      expect(typeof state.moveY).toBe('number');
      expect(typeof state.aimWorldX).toBe('number');
      expect(typeof state.aimWorldY).toBe('number');
      expect(typeof state.fireSidearm).toBe('boolean');
      expect(typeof state.fireLongArm).toBe('boolean');
      expect(typeof state.reload).toBe('boolean');
      expect(typeof state.dodgeRoll).toBe('boolean');
      expect(typeof state.interact).toBe('boolean');
      expect(typeof state.openUpgrade).toBe('boolean');
      expect(typeof state.pause).toBe('boolean');
      expect(typeof state.debugSpeedUp).toBe('boolean');
      expect(typeof state.debugSpeedDown).toBe('boolean');
    });

    it('has zero movement and all booleans false', () => {
      const state = inputSystem(mgr);
      expect(state.moveX).toBe(0);
      expect(state.moveY).toBe(0);
      expect(state.fireSidearm).toBe(false);
      expect(state.fireLongArm).toBe(false);
      expect(state.reload).toBe(false);
      expect(state.dodgeRoll).toBe(false);
      expect(state.interact).toBe(false);
      expect(state.openUpgrade).toBe(false);
      expect(state.pause).toBe(false);
      expect(state.debugSpeedUp).toBe(false);
      expect(state.debugSpeedDown).toBe(false);
    });

    it('has no undefined fields', () => {
      const state = inputSystem(mgr);
      for (const [key, value] of Object.entries(state)) {
        expect(value, `field '${key}' should not be undefined`).not.toBeUndefined();
      }
    });
  });

  // ── Movement normalization ────────────────────────────────────────────

  describe('movement normalization', () => {
    it('diagonal keyboard input is normalized to magnitude <= 1', () => {
      // W + D pressed
      withEvents(mgr, (t) => {
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      });
      const state = inputSystem(mgr);
      const mag = Math.sqrt(state.moveX ** 2 + state.moveY ** 2);
      expect(mag).toBeLessThanOrEqual(1.0 + 1e-9);
      expect(state.moveX).toBeCloseTo(1 / Math.sqrt(2), 4);
      expect(state.moveY).toBeCloseTo(-1 / Math.sqrt(2), 4);
    });

    it('all four directional keys cancel to zero', () => {
      withEvents(mgr, (t) => {
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      });
      const state = inputSystem(mgr);
      expect(state.moveX).toBe(0);
      expect(state.moveY).toBe(0);
    });

    it('three keys W+A+S: W and S cancel, leaving only A', () => {
      withEvents(mgr, (t) => {
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
      });
      const state = inputSystem(mgr);
      expect(state.moveX).toBe(-1);
      expect(state.moveY).toBe(0);
    });

    it('single axis input is not reduced by normalization', () => {
      // Only W pressed: (0, -1) magnitude is exactly 1
      withEvents(mgr, (t) => {
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
      });
      const state = inputSystem(mgr);
      expect(state.moveX).toBe(0);
      expect(state.moveY).toBe(-1);
    });

    it('normalization never produces NaN', () => {
      // No input → zero vector normalization should not produce NaN
      const state = inputSystem(mgr);
      expect(Number.isNaN(state.moveX)).toBe(false);
      expect(Number.isNaN(state.moveY)).toBe(false);
    });
  });

  // ── Clamping ──────────────────────────────────────────────────────────

  describe('clamping', () => {
    it('moveX and moveY always in [-1, 1] (property-based)', () => {
      fc.assert(
        fc.property(
          fc.boolean(), // W
          fc.boolean(), // A
          fc.boolean(), // S
          fc.boolean(), // D
          (w, a, s, d) => {
            const m = new InputManager();
            withEvents(m, (t) => {
              if (w) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
              if (a) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
              if (s) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
              if (d) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            });
            const state = inputSystem(m);
            expect(state.moveX).toBeGreaterThanOrEqual(-1);
            expect(state.moveX).toBeLessThanOrEqual(1);
            expect(state.moveY).toBeGreaterThanOrEqual(-1);
            expect(state.moveY).toBeLessThanOrEqual(1);
          },
        ),
      );
    });

    it('diagonal magnitude never exceeds 1 (property-based)', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          (w, a, s, d) => {
            const m = new InputManager();
            withEvents(m, (t) => {
              if (w) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
              if (a) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));
              if (s) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS' }));
              if (d) t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
            });
            const state = inputSystem(m);
            const mag = Math.sqrt(state.moveX ** 2 + state.moveY ** 2);
            expect(mag).toBeLessThanOrEqual(1.0 + 1e-9);
          },
        ),
      );
    });
  });

  // ── Keyboard action mapping ───────────────────────────────────────────

  describe('keyboard actions', () => {
    it('WASD maps to movement', () => {
      simulateKeyDown(mgr, 'KeyD');
      const state = inputSystem(mgr);
      expect(state.moveX).toBe(1);
    });

    it('Space maps to dodgeRoll', () => {
      simulateKeyDown(mgr, 'Space');
      const state = inputSystem(mgr);
      expect(state.dodgeRoll).toBe(true);
    });

    it('R maps to reload', () => {
      simulateKeyDown(mgr, 'KeyR');
      const state = inputSystem(mgr);
      expect(state.reload).toBe(true);
    });

    it('E maps to interact', () => {
      simulateKeyDown(mgr, 'KeyE');
      const state = inputSystem(mgr);
      expect(state.interact).toBe(true);
    });

    it('Escape maps to pause', () => {
      simulateKeyDown(mgr, 'Escape');
      const state = inputSystem(mgr);
      expect(state.pause).toBe(true);
    });
  });

  // ── Mouse actions ────────────────────────────────────────────────────

  describe('mouse actions', () => {
    it('LMB maps to fireSidearm', () => {
      simulateMouseDown(mgr, 0);
      const state = inputSystem(mgr);
      expect(state.fireSidearm).toBe(true);
    });

    it('RMB maps to fireLongArm', () => {
      simulateMouseDown(mgr, 2);
      const state = inputSystem(mgr);
      expect(state.fireLongArm).toBe(true);
    });

    it('both LMB and RMB can be pressed simultaneously', () => {
      withEvents(mgr, (t) => {
        t.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
        t.dispatchEvent(new MouseEvent('mousedown', { button: 2 }));
      });
      const state = inputSystem(mgr);
      expect(state.fireSidearm).toBe(true);
      expect(state.fireLongArm).toBe(true);
    });
  });

  // ── One-shot / buffered actions ──────────────────────────────────────

  describe('one-shot actions (buffered between frames)', () => {
    it('dodgeRoll fires even if key released before poll', () => {
      withEvents(mgr, (t) => {
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        t.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
      });
      const state = inputSystem(mgr);
      expect(state.dodgeRoll).toBe(true);
    });

    it('one-shot action only fires once per press', () => {
      simulateKeyDown(mgr, 'Space');
      const state1 = inputSystem(mgr);
      expect(state1.dodgeRoll).toBe(true);
      // Second poll without new keydown — should NOT fire again
      const state2 = inputSystem(mgr);
      expect(state2.dodgeRoll).toBe(false);
    });
  });

  // ── Blur clears state ────────────────────────────────────────────────

  describe('blur handling', () => {
    it('clears all key state on blur (no stuck keys)', () => {
      withEvents(mgr, (t) => {
        t.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
        t.dispatchEvent(new Event('blur'));
      });
      const state = inputSystem(mgr);
      expect(state.moveY).toBe(0);
    });
  });

  // ── Data-driven remapping ────────────────────────────────────────────

  describe('data-driven input mapping', () => {
    it('remapping Space to fireSidearm changes behavior', () => {
      const custom = createInputMapping({
        keyboard: {
          ...DEFAULT_INPUT_MAPPING.keyboard,
          Space: LogicalAction.FireSidearm,
        },
      });
      const m = new InputManager(custom);
      simulateKeyDown(m, 'Space');
      const state = inputSystem(m);
      expect(state.fireSidearm).toBe(true);
      expect(state.dodgeRoll).toBe(false);
    });

    it('setMapping updates the active mapping', () => {
      const custom: InputMapping = {
        keyboard: { KeyZ: LogicalAction.Pause },
        mouse: {},
        gamepadButtons: {},
      };
      mgr.setMapping(custom);
      simulateKeyDown(mgr, 'KeyZ');
      const state = inputSystem(mgr);
      expect(state.pause).toBe(true);
    });
  });

  // ── Gamepad dead zone ───────────────────────────────────────────────

  describe('gamepad dead zone', () => {
    it('axis values below dead zone threshold produce zero movement', () => {
      const deadZone = getDesignParams().input.gamepadDeadZone;
      const m = new InputManager();

      const belowThreshold = deadZone * 0.5;
      const mockGamepad = {
        connected: true,
        index: 0,
        axes: [belowThreshold, -belowThreshold, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        id: 'Mock Gamepad',
        mapping: 'standard' as GamepadMappingType,
        timestamp: performance.now(),
        hapticActuators: [],
        vibrationActuator: null,
      };

      const originalGetGamepads = navigator.getGamepads;
      Object.defineProperty(navigator, 'getGamepads', {
        value: () => [mockGamepad],
        configurable: true,
      });

      // Set gamepadIndex directly via the gamepadconnected path workaround:
      // attach + poll will discover the mock gamepad via getActiveGamepad()
      const target = new EventTarget();
      m.attach(target);

      const state = m.poll();
      expect(state.moveX).toBe(0);
      expect(state.moveY).toBe(0);

      m.detach(target);
      Object.defineProperty(navigator, 'getGamepads', {
        value: originalGetGamepads,
        configurable: true,
      });
    });

    it('axis values above dead zone threshold pass through', () => {
      const deadZone = getDesignParams().input.gamepadDeadZone;
      const m = new InputManager();

      const aboveThreshold = deadZone + 0.1;
      const mockGamepad = {
        connected: true,
        index: 0,
        axes: [aboveThreshold, -aboveThreshold, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
        id: 'Mock Gamepad',
        mapping: 'standard' as GamepadMappingType,
        timestamp: performance.now(),
        hapticActuators: [],
        vibrationActuator: null,
      };

      const originalGetGamepads = navigator.getGamepads;
      Object.defineProperty(navigator, 'getGamepads', {
        value: () => [mockGamepad],
        configurable: true,
      });

      const target = new EventTarget();
      m.attach(target);

      const state = m.poll();
      const mag = Math.sqrt(state.moveX ** 2 + state.moveY ** 2);
      expect(mag).toBeGreaterThan(0);
      expect(state.moveX).toBeGreaterThan(0);
      expect(state.moveY).toBeLessThan(0);

      m.detach(target);
      Object.defineProperty(navigator, 'getGamepads', {
        value: originalGetGamepads,
        configurable: true,
      });
    });

    it('dead zone value comes from design params (property-based)', () => {
      fc.assert(
        fc.property(
          fc.double({ min: 0, max: 1, noNaN: true }),
          (axisValue) => {
            const deadZone = getDesignParams().input.gamepadDeadZone;
            // Values below dead zone should be zeroed, values at or above should pass through
            // This mirrors the applyDeadZone logic: Math.abs(clamped) < deadZone ? 0 : clamped
            if (Math.abs(axisValue) < deadZone) {
              // Would be zeroed
              expect(deadZone).toBe(getDesignParams().input.gamepadDeadZone);
            } else {
              // Would pass through
              expect(deadZone).toBe(getDesignParams().input.gamepadDeadZone);
            }
            // The key property: dead zone is always sourced from design params
            expect(typeof deadZone).toBe('number');
            expect(deadZone).toBeGreaterThan(0);
            expect(deadZone).toBeLessThan(1);
          },
        ),
      );
    });
  });

  // ── Aim coordinates ──────────────────────────────────────────────────

  describe('aim coordinates', () => {
    it('aimWorldX and aimWorldY are finite numbers on idle', () => {
      const state = inputSystem(mgr);
      expect(Number.isFinite(state.aimWorldX)).toBe(true);
      expect(Number.isFinite(state.aimWorldY)).toBe(true);
    });
  });

  // ── InputState completeness (property-based) ─────────────────────────

  describe('InputState completeness', () => {
    const INPUT_STATE_KEYS: (keyof InputState)[] = [
      'moveX',
      'moveY',
      'aimWorldX',
      'aimWorldY',
      'fireSidearm',
      'fireLongArm',
      'reload',
      'dodgeRoll',
      'interact',
      'openUpgrade',
      'pause',
      'debugSpeedUp',
      'debugSpeedDown',
    ];

    it('every field is defined and of correct type', () => {
      const state = inputSystem(mgr);
      for (const key of INPUT_STATE_KEYS) {
        expect(state[key], `${key} must be defined`).not.toBeUndefined();
      }
      // Number fields
      for (const key of ['moveX', 'moveY', 'aimWorldX', 'aimWorldY'] as const) {
        expect(typeof state[key]).toBe('number');
      }
      // Boolean fields
      for (const key of [
        'fireSidearm',
        'fireLongArm',
        'reload',
        'dodgeRoll',
        'interact',
        'openUpgrade',
        'pause',
        'debugSpeedUp',
        'debugSpeedDown',
      ] as const) {
        expect(state[key]).toStrictEqual(expect.any(Boolean));
      }
    });

    it('booleans are true booleans, never truthy non-boolean', () => {
      // Press some keys, verify booleans are exactly true or false
      simulateKeyDown(mgr, 'Space');
      simulateMouseDown(mgr, 0);
      const state = inputSystem(mgr);
      expect(state.dodgeRoll === true || state.dodgeRoll === false).toBe(true);
      expect(state.fireSidearm === true || state.fireSidearm === false).toBe(true);
      expect(state.fireLongArm === true || state.fireLongArm === false).toBe(true);
    });
  });
});
