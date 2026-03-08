/**
 * InputManager: captures raw keyboard, mouse, and gamepad input and produces
 * normalized InputState. Supports pointer lock for third-person camera control.
 *
 * Integration: Created at game init, polled each frame by inputSystem().
 * The camera reference comes from the CameraController created by the renderer.
 */
import * as THREE from 'three';
import type { InputMapping } from './inputMapping';
import { LogicalAction } from './inputMapping';
import { DEFAULT_INPUT_MAPPING } from './inputMapping';
import { getDesignParams } from '../config/designParams';

export interface InputState {
  moveX: number;
  moveY: number;
  aimWorldX: number;
  aimWorldY: number;
  mouseDeltaX: number;
  mouseDeltaY: number;
  pointerLockLost: boolean;
  aimYaw?: number;
  fireSidearm: boolean;
  fireLongArm: boolean;
  reload: boolean;
  dodgeRoll: boolean;
  interact: boolean;
  openUpgrade: boolean;
  pause: boolean;
  debugSpeedUp: boolean;
  debugSpeedDown: boolean;
}

export class InputManager {
  private readonly keysDown = new Set<string>();
  private readonly keysPressed = new Set<string>();
  private readonly mouseButtonsDown = new Set<number>();
  private readonly mouseButtonsPressed = new Set<number>();

  private mouseScreenX = 0;
  private mouseScreenY = 0;
  private lastAimWorldX = 0;
  private lastAimWorldY = 0;

  // Pointer lock mouse deltas (accumulated between polls)
  private _mouseDeltaX = 0;
  private _mouseDeltaY = 0;
  private _pointerLockLost = false;

  private gamepadIndex: number | null = null;
  private lastInputSource: 'keyboard' | 'gamepad' = 'keyboard';

  private mapping: InputMapping;
  private camera: THREE.Camera | null = null;
  private domElement: HTMLElement | null = null;

  // Reusable Three.js objects to avoid per-frame allocation
  private readonly raycaster = new THREE.Raycaster();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly ndcVec = new THREE.Vector2();
  private readonly intersectPoint = new THREE.Vector3();

  constructor(mapping?: InputMapping) {
    this.mapping = mapping ?? DEFAULT_INPUT_MAPPING;
  }

  setMapping(mapping: InputMapping): void {
    this.mapping = mapping;
  }

  getMapping(): InputMapping {
    return this.mapping;
  }

  setCamera(camera: THREE.Camera, domElement: HTMLElement): void {
    this.camera = camera;
    this.domElement = domElement;
  }

  get isPointerLocked(): boolean {
    return typeof document !== 'undefined' && this.domElement != null
      && document.pointerLockElement === this.domElement;
  }

  requestPointerLock(): void {
    this.domElement?.requestPointerLock();
  }

  exitPointerLock(): void {
    if (typeof document !== 'undefined' && document.pointerLockElement) {
      document.exitPointerLock();
    }
  }

  attach(target: EventTarget): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
    target.addEventListener('mousedown', this.onMouseDown as EventListener);
    target.addEventListener('mouseup', this.onMouseUp as EventListener);
    target.addEventListener('mousemove', this.onMouseMove as EventListener);
    target.addEventListener('contextmenu', this.onContextMenu as EventListener);
    target.addEventListener('blur', this.onBlur as EventListener);

    if (typeof document !== 'undefined') {
      document.addEventListener('pointerlockchange', this.onPointerLockChange);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.onGamepadConnected as EventListener);
      window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected as EventListener);
    }
  }

  detach(target: EventTarget): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener);
    target.removeEventListener('keyup', this.onKeyUp as EventListener);
    target.removeEventListener('mousedown', this.onMouseDown as EventListener);
    target.removeEventListener('mouseup', this.onMouseUp as EventListener);
    target.removeEventListener('mousemove', this.onMouseMove as EventListener);
    target.removeEventListener('contextmenu', this.onContextMenu as EventListener);
    target.removeEventListener('blur', this.onBlur as EventListener);

    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('gamepadconnected', this.onGamepadConnected as EventListener);
      window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected as EventListener);
    }
  }

  poll(): InputState {
    const actionStates = new Map<LogicalAction, boolean>();

    // Keyboard actions
    for (const [code, action] of Object.entries(this.mapping.keyboard)) {
      if (this.isActionOneShot(action)) {
        if (this.keysPressed.has(code)) {
          actionStates.set(action, true);
          this.lastInputSource = 'keyboard';
        }
      } else {
        if (this.keysDown.has(code)) {
          actionStates.set(action, true);
          this.lastInputSource = 'keyboard';
        }
      }
    }

    // Mouse button actions
    for (const [buttonStr, action] of Object.entries(this.mapping.mouse)) {
      const button = Number(buttonStr);
      if (this.isActionOneShot(action)) {
        if (this.mouseButtonsPressed.has(button)) {
          actionStates.set(action, true);
          this.lastInputSource = 'keyboard';
        }
      } else {
        if (this.mouseButtonsDown.has(button)) {
          actionStates.set(action, true);
          this.lastInputSource = 'keyboard';
        }
      }
    }

    // Gamepad
    let gpMoveX = 0;
    let gpMoveY = 0;
    let gpAimX: number | undefined;
    let gpAimY: number | undefined;

    const gp = this.getActiveGamepad();
    if (gp) {
      // Left stick → movement
      gpMoveX = this.applyDeadZone(gp.axes[0] ?? 0);
      gpMoveY = this.applyDeadZone(gp.axes[1] ?? 0);

      // Right stick → aim (axes 2/3)
      const rawAimX = gp.axes[2] ?? 0;
      const rawAimY = gp.axes[3] ?? 0;
      const aimDeadAppliedX = this.applyDeadZone(rawAimX);
      const aimDeadAppliedY = this.applyDeadZone(rawAimY);
      if (aimDeadAppliedX !== 0 || aimDeadAppliedY !== 0) {
        gpAimX = aimDeadAppliedX;
        gpAimY = aimDeadAppliedY;
      }

      if (gpMoveX !== 0 || gpMoveY !== 0) {
        this.lastInputSource = 'gamepad';
      }

      // Gamepad buttons
      for (const [buttonStr, action] of Object.entries(this.mapping.gamepadButtons)) {
        const idx = Number(buttonStr);
        if (idx < gp.buttons.length && gp.buttons[idx].pressed) {
          actionStates.set(action, true);
          this.lastInputSource = 'gamepad';
        }
      }
    }

    // Compute movement from keyboard
    let kbMoveX = 0;
    let kbMoveY = 0;
    if (actionStates.get(LogicalAction.MoveRight)) kbMoveX += 1;
    if (actionStates.get(LogicalAction.MoveLeft)) kbMoveX -= 1;
    if (actionStates.get(LogicalAction.MoveUp)) kbMoveY -= 1;
    if (actionStates.get(LogicalAction.MoveDown)) kbMoveY += 1;

    // Merge: last active input source wins for movement
    let moveX: number;
    let moveY: number;
    if (this.lastInputSource === 'gamepad' && (gpMoveX !== 0 || gpMoveY !== 0)) {
      moveX = gpMoveX;
      moveY = gpMoveY;
    } else if (kbMoveX !== 0 || kbMoveY !== 0) {
      moveX = kbMoveX;
      moveY = kbMoveY;
    } else {
      moveX = gpMoveX;
      moveY = gpMoveY;
    }

    // Clamp
    moveX = clamp(moveX, -1, 1);
    moveY = clamp(moveY, -1, 1);

    // Normalize diagonal
    const mag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (mag > 1) {
      moveX /= mag;
      moveY /= mag;
    }

    // Aim: when pointer locked, skip raycasting. Otherwise use mouse → world raycast.
    if (!this.isPointerLocked) {
      if (gpAimX !== undefined && gpAimY !== undefined && this.lastInputSource === 'gamepad') {
        this.lastAimWorldX = gpAimX;
        this.lastAimWorldY = gpAimY;
      } else {
        this.updateAimFromMouse();
      }
    }

    // Capture mouse deltas and pointer lock lost flag, then reset
    const mouseDeltaX = this._mouseDeltaX;
    const mouseDeltaY = this._mouseDeltaY;
    const pointerLockLost = this._pointerLockLost;
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
    this._pointerLockLost = false;

    // Clear per-frame event buffers
    this.keysPressed.clear();
    this.mouseButtonsPressed.clear();

    return {
      moveX,
      moveY,
      aimWorldX: this.lastAimWorldX,
      aimWorldY: this.lastAimWorldY,
      mouseDeltaX,
      mouseDeltaY,
      pointerLockLost,
      fireSidearm: actionStates.get(LogicalAction.FireSidearm) === true,
      fireLongArm: actionStates.get(LogicalAction.FireLongArm) === true,
      reload: actionStates.get(LogicalAction.Reload) === true,
      dodgeRoll: actionStates.get(LogicalAction.DodgeRoll) === true,
      interact: actionStates.get(LogicalAction.Interact) === true,
      openUpgrade: actionStates.get(LogicalAction.OpenUpgrade) === true,
      pause: actionStates.get(LogicalAction.Pause) === true,
      debugSpeedUp: actionStates.get(LogicalAction.DebugSpeedUp) === true,
      debugSpeedDown: actionStates.get(LogicalAction.DebugSpeedDown) === true,
    };
  }

  private isActionOneShot(action: LogicalAction): boolean {
    // One-shot actions fire once on key-down, not continuously while held
    return action === LogicalAction.DodgeRoll
      || action === LogicalAction.Interact
      || action === LogicalAction.OpenUpgrade
      || action === LogicalAction.Pause
      || action === LogicalAction.Reload
      || action === LogicalAction.DebugSpeedUp
      || action === LogicalAction.DebugSpeedDown;
  }

  private updateAimFromMouse(): void {
    if (!this.camera || !this.domElement) return;
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Convert screen coords to NDC [-1, 1] using CSS layout rect
    this.ndcVec.set(
      ((this.mouseScreenX - rect.left) / rect.width) * 2 - 1,
      -((this.mouseScreenY - rect.top) / rect.height) * 2 + 1,
    );

    this.raycaster.setFromCamera(this.ndcVec, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this.intersectPoint);
    if (hit) {
      if (Number.isFinite(hit.x) && Number.isFinite(hit.z)) {
        this.lastAimWorldX = hit.x;
        this.lastAimWorldY = hit.z;
      }
    }
  }

  private applyDeadZone(value: number): number {
    const clamped = clamp(value, -1, 1);
    return Math.abs(clamped) < getDesignParams().input.gamepadDeadZone ? 0 : clamped;
  }

  private getActiveGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    if (this.gamepadIndex !== null) {
      const gp = navigator.getGamepads()[this.gamepadIndex];
      if (gp?.connected) return gp;
      this.gamepadIndex = null;
    }
    // Find first connected gamepad
    const gamepads = navigator.getGamepads();
    for (let i = 0; i < gamepads.length; i++) {
      if (gamepads[i]?.connected) {
        this.gamepadIndex = i;
        return gamepads[i];
      }
    }
    return null;
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keysDown.has(e.code)) {
      this.keysPressed.add(e.code);
    }
    this.keysDown.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    if (!this.mouseButtonsDown.has(e.button)) {
      this.mouseButtonsPressed.add(e.button);
    }
    this.mouseButtonsDown.add(e.button);
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    this.mouseButtonsDown.delete(e.button);
  };

  private readonly onMouseMove = (e: MouseEvent): void => {
    this.mouseScreenX = e.clientX;
    this.mouseScreenY = e.clientY;

    // Accumulate pointer lock deltas
    if (this.isPointerLocked) {
      this._mouseDeltaX += e.movementX;
      this._mouseDeltaY += e.movementY;
    }
  };

  private readonly onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private readonly onBlur = (): void => {
    this.keysDown.clear();
    this.keysPressed.clear();
    this.mouseButtonsDown.clear();
    this.mouseButtonsPressed.clear();
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
  };

  private readonly onPointerLockChange = (): void => {
    if (typeof document !== 'undefined' && document.pointerLockElement !== this.domElement) {
      this._pointerLockLost = true;
    }
  };

  private readonly onGamepadConnected = (e: GamepadEvent): void => {
    if (this.gamepadIndex === null) {
      this.gamepadIndex = e.gamepad.index;
    }
  };

  private readonly onGamepadDisconnected = (e: GamepadEvent): void => {
    if (this.gamepadIndex === e.gamepad.index) {
      this.gamepadIndex = null;
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
