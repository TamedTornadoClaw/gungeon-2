/**
 * Camera controller for the main game camera.
 *
 * Integration: This module is consumed by the render system (src/rendering/)
 * which creates a CameraController at init and calls updateCamera each frame
 * from the game loop. See the renderer integration ticket for wiring details.
 */
import * as THREE from 'three';
import { getDesignParams } from '../config/designParams';

/** Near clip plane distance — standard for indoor/dungeon scenes */
const NEAR_CLIP = 0.1;
/** Far clip plane distance — generous ceiling for dungeon geometry */
const FAR_CLIP = 1000;
/** Below this intensity, shake is zeroed out to avoid sub-pixel jitter */
const SHAKE_EPSILON = 0.001;

export interface CameraController {
  camera: THREE.PerspectiveCamera;
  /** Current smoothed target position (what the camera is looking at) */
  targetPosition: THREE.Vector3;
  /** Current shake intensity (decays exponentially) */
  shakeIntensity: number;
  /** Scratch vector for shake offset — avoids allocation */
  shakeOffset: THREE.Vector3;
  /** Whether the camera has snapped to its first target */
  hasSnapped: boolean;
}

export function createCameraController(): CameraController {
  const params = getDesignParams();
  const { fov, angle, distance } = params.camera;

  const camera = new THREE.PerspectiveCamera(fov, 1, NEAR_CLIP, FAR_CLIP);

  // Set initial position using angle + distance offset
  const angleRad = (angle * Math.PI) / 180;
  camera.position.set(0, distance * Math.sin(angleRad), distance * Math.cos(angleRad));
  camera.lookAt(0, 0, 0);

  return {
    camera,
    targetPosition: new THREE.Vector3(0, 0, 0),
    shakeIntensity: 0,
    shakeOffset: new THREE.Vector3(),
    hasSnapped: false,
  };
}

/**
 * Update camera to follow a player position with smooth interpolation.
 * Call once per frame with the player's current world position and delta time.
 */
export function updateCamera(
  ctrl: CameraController,
  playerX: number,
  playerY: number,
  playerZ: number,
  dt: number,
): void {
  const params = getDesignParams();
  const { angle, distance, followSmoothing } = params.camera;
  const angleRad = (angle * Math.PI) / 180;

  // Snap to player on first call, then smoothly interpolate
  if (!ctrl.hasSnapped) {
    ctrl.targetPosition.set(playerX, playerY, playerZ);
    ctrl.hasSnapped = true;
  } else {
    const t = 1 - Math.pow(1 - followSmoothing, dt * 60);
    ctrl.targetPosition.x += (playerX - ctrl.targetPosition.x) * t;
    ctrl.targetPosition.y += (playerY - ctrl.targetPosition.y) * t;
    ctrl.targetPosition.z += (playerZ - ctrl.targetPosition.z) * t;
  }

  // Camera position = target + offset from angle/distance
  ctrl.camera.position.set(
    ctrl.targetPosition.x,
    ctrl.targetPosition.y + distance * Math.sin(angleRad),
    ctrl.targetPosition.z + distance * Math.cos(angleRad),
  );

  // Apply screen shake offset
  if (ctrl.shakeIntensity > SHAKE_EPSILON) {
    const { damping } = params.screenEffects.shake;
    ctrl.shakeOffset.set(
      (Math.random() * 2 - 1) * ctrl.shakeIntensity,
      (Math.random() * 2 - 1) * ctrl.shakeIntensity,
      0,
    );
    ctrl.camera.position.add(ctrl.shakeOffset);

    // Exponential decay
    ctrl.shakeIntensity *= Math.pow(damping, dt * 60);
  } else {
    ctrl.shakeIntensity = 0;
  }

  // Always look at the smoothed target
  ctrl.camera.lookAt(ctrl.targetPosition);
}

/**
 * Add screen shake with the given intensity.
 * Intensities are additive — multiple shakes stack.
 */
export function addScreenShake(ctrl: CameraController, intensity: number): void {
  ctrl.shakeIntensity += intensity;
}
