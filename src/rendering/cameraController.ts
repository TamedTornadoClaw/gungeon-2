/**
 * Camera controller for third-person orbit camera.
 *
 * The camera owns orbit state (yaw/pitch). Mouse deltas drive the orbit,
 * and the player reads orbitYaw to set its facing direction.
 *
 * KEY DESIGN DECISIONS:
 * - Camera orientation is set via quaternion (yaw * pitch composition),
 *   NOT lookAt(). This ensures pitch actually controls where the camera
 *   points, so the player can aim at ceilings, floors, etc.
 * - The camera orbits a "pivot" point (player + shoulder offset), and its
 *   position is computed by stepping BACKWARD from that pivot along the
 *   camera's own forward vector by orbitDistance.
 * - Pitch convention: positive pitch = look UP. pitchMin/pitchMax should
 *   be e.g. -1.2 (look down ~69°) to +1.4 (look up ~80°).
 *
 * Split into two update functions:
 * - updateCameraOrbit: called per simulation step (60Hz), applies mouse deltas
 * - updateCameraPosition: called per render frame, positions camera behind player
 */
import * as THREE from 'three';
import { getDesignParams } from '../config/designParams';

/** Near clip plane distance — standard for indoor/dungeon scenes */
const NEAR_CLIP = 0.1;
/** Far clip plane distance — generous ceiling for dungeon geometry */
const FAR_CLIP = 1000;
/** Below this intensity, shake is zeroed out to avoid sub-pixel jitter */
const SHAKE_EPSILON = 0.001;

// Scratch objects to avoid per-frame allocation
const _yawQuat = new THREE.Quaternion();
const _pitchQuat = new THREE.Quaternion();
const _combinedQuat = new THREE.Quaternion();
const _forward = new THREE.Vector3();
const _yawAxis = new THREE.Vector3(0, 1, 0);
const _pitchAxis = new THREE.Vector3(1, 0, 0);
const _right = new THREE.Vector3();

export interface CameraController {
  camera: THREE.PerspectiveCamera;
  /** Current smoothed target position (what the camera orbits around) */
  targetPosition: THREE.Vector3;
  /** Camera orbit yaw — owned by camera, consumed by player for facing */
  orbitYaw: number;
  /** Camera orbit pitch — owned by camera. Positive = look up. */
  orbitPitch: number;
  /** Current shake intensity (decays exponentially) */
  shakeIntensity: number;
  /** Scratch vector for shake offset — avoids allocation */
  shakeOffset: THREE.Vector3;
  /** Whether the camera has snapped to its first target */
  hasSnapped: boolean;
}

export function createCameraController(): CameraController {
  const params = getDesignParams();
  const { fov, pitchMin, pitchMax } = params.camera;

  const camera = new THREE.PerspectiveCamera(fov, 1, NEAR_CLIP, FAR_CLIP);

  // Initial position doesn't matter much — updateCameraPosition will set it
  // on the first frame. Just put it somewhere reasonable.
  camera.position.set(0, 5, -6);
  camera.lookAt(0, 0, 0);

  return {
    camera,
    targetPosition: new THREE.Vector3(0, 0, 0),
    orbitYaw: 0,
    orbitPitch: (pitchMin + pitchMax) / 2,
    shakeIntensity: 0,
    shakeOffset: new THREE.Vector3(),
    hasSnapped: false,
  };
}

/**
 * Apply mouse deltas to camera orbit state.
 * Called once per simulation step (60Hz).
 *
 * Convention: positive deltaX = mouse moved right = yaw right (decrease yaw
 * in our coord system where +Z is forward at yaw=0).
 * Positive deltaY = mouse moved down = pitch down (decrease pitch).
 */
export function updateCameraOrbit(
  ctrl: CameraController,
  deltaX: number,
  deltaY: number,
): void {
  const params = getDesignParams();
  const { mouseSensitivity, pitchMin, pitchMax } = params.camera;

  // Yaw: mouse right → rotate right
  ctrl.orbitYaw -= deltaX * mouseSensitivity;

  // Wrap yaw to [-PI, PI]
  if (ctrl.orbitYaw > Math.PI) ctrl.orbitYaw -= Math.PI * 2;
  if (ctrl.orbitYaw < -Math.PI) ctrl.orbitYaw += Math.PI * 2;

  // Pitch: mouse up (negative deltaY) → pitch up (positive pitch)
  ctrl.orbitPitch -= deltaY * mouseSensitivity;
  ctrl.orbitPitch = Math.max(pitchMin, Math.min(pitchMax, ctrl.orbitPitch));
}

/**
 * Position and orient the camera behind the player using orbit state.
 * Called once per render frame with interpolated player position.
 *
 * The camera's orientation is built from a yaw-then-pitch quaternion
 * composition. Its position is then placed at:
 *   pivot - forward * orbitDistance
 * where pivot = player + (0, shoulderHeight, 0) + right * shoulderOffsetX.
 *
 * This means pitch directly controls where the camera looks — you CAN
 * aim at the ceiling, the floor, or anything in between.
 */
export function updateCameraPosition(
  ctrl: CameraController,
  playerX: number,
  playerY: number,
  playerZ: number,
  dt: number,
): void {
  const params = getDesignParams();
  const {
    followSmoothing,
    shoulderOffsetX,
    shoulderHeight,
    orbitDistance,
  } = params.camera;

  // ── Smooth target tracking ─────────────────────────────────────────
  if (!ctrl.hasSnapped) {
    ctrl.targetPosition.set(playerX, playerY, playerZ);
    ctrl.hasSnapped = true;
  } else {
    const t = 1 - Math.pow(1 - followSmoothing, dt * 60);
    ctrl.targetPosition.x += (playerX - ctrl.targetPosition.x) * t;
    ctrl.targetPosition.y += (playerY - ctrl.targetPosition.y) * t;
    ctrl.targetPosition.z += (playerZ - ctrl.targetPosition.z) * t;
  }

  // ── Build camera orientation from yaw + pitch ──────────────────────
  // Yaw rotates around world Y axis
  _yawQuat.setFromAxisAngle(_yawAxis, ctrl.orbitYaw);
  // Pitch rotates around the camera's LOCAL X axis (after yaw)
  _pitchQuat.setFromAxisAngle(_pitchAxis, ctrl.orbitPitch);
  // Combined: yaw first, then pitch in that rotated frame
  _combinedQuat.copy(_yawQuat).multiply(_pitchQuat);

  // Apply orientation to camera
  ctrl.camera.quaternion.copy(_combinedQuat);

  // ── Compute camera position ────────────────────────────────────────
  // Extract the camera's forward and right vectors from the quaternion
  _forward.set(0, 0, -1).applyQuaternion(_combinedQuat);
  _right.set(1, 0, 0).applyQuaternion(_combinedQuat);

  // Pivot point: player position + shoulder height + shoulder lateral offset
  // Shoulder offset uses the YAW-only right vector (not pitched) so the
  // shoulder doesn't shift vertically when looking up/down.
  const yawRightX = Math.cos(ctrl.orbitYaw);
  const yawRightZ = -Math.sin(ctrl.orbitYaw);

  const pivotX = ctrl.targetPosition.x + yawRightX * shoulderOffsetX;
  const pivotY = ctrl.targetPosition.y + shoulderHeight;
  const pivotZ = ctrl.targetPosition.z + yawRightZ * shoulderOffsetX;

  // Camera sits behind the pivot: pivot - forward * distance
  ctrl.camera.position.set(
    pivotX - _forward.x * orbitDistance,
    pivotY - _forward.y * orbitDistance,
    pivotZ - _forward.z * orbitDistance,
  );

  // ── Screen shake ───────────────────────────────────────────────────
  if (ctrl.shakeIntensity > SHAKE_EPSILON) {
    const { damping } = params.screenEffects.shake;

    // Shake in camera-local XY so it always looks like screen shake,
    // not world-space jitter
    const shakeX = (Math.random() * 2 - 1) * ctrl.shakeIntensity;
    const shakeY = (Math.random() * 2 - 1) * ctrl.shakeIntensity;

    ctrl.camera.position.x += _right.x * shakeX + ctrl.camera.up.x * shakeY;
    ctrl.camera.position.y += _right.y * shakeX + ctrl.camera.up.y * shakeY;
    ctrl.camera.position.z += _right.z * shakeX + ctrl.camera.up.z * shakeY;

    // Exponential decay
    ctrl.shakeIntensity *= Math.pow(damping, dt * 60);
  } else {
    ctrl.shakeIntensity = 0;
  }
}

/**
 * Return the camera's center-screen ray (origin + direction) computed from
 * orbit state. Used for aim-target raycasting against the world.
 */
export function getCameraRay(ctrl: CameraController): {
  ox: number; oy: number; oz: number;
  dx: number; dy: number; dz: number;
} {
  const params = getDesignParams();
  const { shoulderOffsetX, shoulderHeight, orbitDistance } = params.camera;

  const cp = Math.cos(ctrl.orbitPitch);
  const sp = Math.sin(ctrl.orbitPitch);
  const sy = Math.sin(ctrl.orbitYaw);
  const cy = Math.cos(ctrl.orbitYaw);

  const fwdX = -sy * cp;
  const fwdY = sp;
  const fwdZ = -cy * cp;

  const yawRightX = cy;
  const yawRightZ = -sy;

  const pivotX = ctrl.targetPosition.x + yawRightX * shoulderOffsetX;
  const pivotY = ctrl.targetPosition.y + shoulderHeight;
  const pivotZ = ctrl.targetPosition.z + yawRightZ * shoulderOffsetX;

  return {
    ox: pivotX - fwdX * orbitDistance,
    oy: pivotY - fwdY * orbitDistance,
    oz: pivotZ - fwdZ * orbitDistance,
    dx: fwdX,
    dy: fwdY,
    dz: fwdZ,
  };
}

/**
 * Add screen shake with the given intensity.
 * Intensities are additive — multiple shakes stack.
 */
export function addScreenShake(ctrl: CameraController, intensity: number): void {
  ctrl.shakeIntensity += intensity;
}