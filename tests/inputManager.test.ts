/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { InputManager } from '../src/input/inputManager';

// Minimal mock of DOM for pointer lock tests
function createMockDomElement(): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600,
    x: 0, y: 0, toJSON: () => ({}),
  });
  el.requestPointerLock = vi.fn();
  return el;
}

describe('InputManager', () => {
  let manager: InputManager;
  let domElement: HTMLCanvasElement;

  beforeEach(() => {
    manager = new InputManager();
    domElement = createMockDomElement();
    manager.attach(document);
  });

  afterEach(() => {
    manager.detach(document);
  });

  describe('mouse deltas (pointer lock)', () => {
    it('accumulates movementX/Y when pointer locked', () => {
      // Simulate pointer lock
      manager.setCamera({ isCamera: true } as never, domElement);
      Object.defineProperty(document, 'pointerLockElement', {
        value: domElement,
        writable: true,
        configurable: true,
      });

      // Simulate mouse move events with movementX/Y
      const event1 = new MouseEvent('mousemove', {
        movementX: 10, movementY: 5,
        clientX: 400, clientY: 300,
      });
      document.dispatchEvent(event1);

      const event2 = new MouseEvent('mousemove', {
        movementX: -3, movementY: 7,
        clientX: 397, clientY: 307,
      });
      document.dispatchEvent(event2);

      const state = manager.poll();
      expect(state.mouseDeltaX).toBe(7); // 10 + (-3)
      expect(state.mouseDeltaY).toBe(12); // 5 + 7

      // Clean up
      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });
    });

    it('deltas are zero when not locked', () => {
      manager.setCamera({ isCamera: true } as never, domElement);
      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });

      const event = new MouseEvent('mousemove', {
        movementX: 10, movementY: 5,
        clientX: 400, clientY: 300,
      });
      document.dispatchEvent(event);

      const state = manager.poll();
      expect(state.mouseDeltaX).toBe(0);
      expect(state.mouseDeltaY).toBe(0);
    });

    it('poll resets deltas (consumed once)', () => {
      manager.setCamera({ isCamera: true } as never, domElement);
      Object.defineProperty(document, 'pointerLockElement', {
        value: domElement, writable: true, configurable: true,
      });

      const event = new MouseEvent('mousemove', {
        movementX: 10, movementY: 5,
        clientX: 400, clientY: 300,
      });
      document.dispatchEvent(event);

      // First poll consumes deltas
      const state1 = manager.poll();
      expect(state1.mouseDeltaX).toBe(10);

      // Second poll has zero
      const state2 = manager.poll();
      expect(state2.mouseDeltaX).toBe(0);
      expect(state2.mouseDeltaY).toBe(0);

      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });
    });
  });

  describe('isPointerLocked', () => {
    it('returns true when pointerLockElement matches domElement', () => {
      manager.setCamera({ isCamera: true } as never, domElement);
      Object.defineProperty(document, 'pointerLockElement', {
        value: domElement, writable: true, configurable: true,
      });

      expect(manager.isPointerLocked).toBe(true);

      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });
    });

    it('returns false when pointerLockElement is null', () => {
      manager.setCamera({ isCamera: true } as never, domElement);
      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });

      expect(manager.isPointerLocked).toBe(false);
    });
  });

  describe('requestPointerLock / exitPointerLock', () => {
    it('requestPointerLock calls domElement.requestPointerLock()', () => {
      manager.setCamera({ isCamera: true } as never, domElement);
      manager.requestPointerLock();
      expect(domElement.requestPointerLock).toHaveBeenCalledOnce();
    });

    it('exitPointerLock calls document.exitPointerLock()', () => {
      // Ensure exitPointerLock exists on document
      if (!document.exitPointerLock) {
        (document as Record<string, unknown>).exitPointerLock = vi.fn();
      }
      Object.defineProperty(document, 'pointerLockElement', {
        value: domElement, writable: true, configurable: true,
      });
      const exitSpy = vi.spyOn(document, 'exitPointerLock').mockImplementation(() => {});
      manager.exitPointerLock();
      expect(exitSpy).toHaveBeenCalledOnce();
      exitSpy.mockRestore();

      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });
    });
  });

  describe('pointerLockLost', () => {
    it('one-shot flag set when lock exits', () => {
      manager.setCamera({ isCamera: true } as never, domElement);

      // Simulate pointer lock change where element no longer matches
      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });
      document.dispatchEvent(new Event('pointerlockchange'));

      const state = manager.poll();
      expect(state.pointerLockLost).toBe(true);

      // Second poll should not have it
      const state2 = manager.poll();
      expect(state2.pointerLockLost).toBe(false);
    });
  });

  describe('onBlur clears deltas', () => {
    it('clears accumulated deltas on blur', () => {
      manager.setCamera({ isCamera: true } as never, domElement);
      Object.defineProperty(document, 'pointerLockElement', {
        value: domElement, writable: true, configurable: true,
      });

      const event = new MouseEvent('mousemove', {
        movementX: 50, movementY: 30,
        clientX: 400, clientY: 300,
      });
      document.dispatchEvent(event);

      // Blur clears
      document.dispatchEvent(new Event('blur'));

      const state = manager.poll();
      expect(state.mouseDeltaX).toBe(0);
      expect(state.mouseDeltaY).toBe(0);

      Object.defineProperty(document, 'pointerLockElement', {
        value: null, writable: true, configurable: true,
      });
    });
  });

  describe('existing functionality preserved', () => {
    it('keyboard movement still works', () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
      const state = manager.poll();
      expect(state.moveX).toBe(1);
    });

    it('mouse button fire still works', () => {
      // LMB (button 0) is FireLongArm in default mapping
      document.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      const state = manager.poll();
      expect(state.fireLongArm).toBe(true);
    });
  });
});
