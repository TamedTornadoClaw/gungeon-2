/**
 * Screen effects module: shake, hit flash, and damage vignette.
 *
 * Integration point: the render system (src/rendering/) creates a ScreenEffects
 * instance, mounts it on the canvas container, and calls updateScreenEffects()
 * every frame from the game loop.
 */

import * as THREE from 'three';
import { getDesignParams } from '../config/designParams';

/** Intensity threshold below which shake is considered settled. */
const SHAKE_INTENSITY_THRESHOLD = 0.001;

/** Background color for the hit flash overlay. */
const HIT_FLASH_COLOR = 'white';

/** Z-index for the hit flash overlay. */
const HIT_FLASH_Z_INDEX = '10';

/** Z-index for the damage vignette overlay. */
const VIGNETTE_Z_INDEX = '9';

/** CSS gradient for the damage vignette effect. */
const VIGNETTE_GRADIENT =
  'radial-gradient(ellipse at center, transparent 50%, rgba(255, 0, 0, 0.6) 100%)';

// --- Screen Shake ---

export interface ScreenShakeState {
  intensity: number;
  offsetX: number;
  offsetY: number;
}

export function createScreenShakeState(): ScreenShakeState {
  return { intensity: 0, offsetX: 0, offsetY: 0 };
}

export function triggerShake(
  state: ScreenShakeState,
  intensity: number,
): void {
  // Additive — multiple shakes stack
  state.intensity += intensity;
}

export function triggerPlayerHitShake(state: ScreenShakeState): void {
  const params = getDesignParams().screenEffects.shake;
  triggerShake(state, params.playerHitIntensity);
}

export function triggerExplosionShake(state: ScreenShakeState): void {
  const params = getDesignParams().screenEffects.shake;
  triggerShake(state, params.explosionIntensity);
}

export function triggerBigHitShake(state: ScreenShakeState): void {
  const params = getDesignParams().screenEffects.shake;
  triggerShake(state, params.bigHitIntensity);
}

export function updateScreenShake(
  state: ScreenShakeState,
  camera: THREE.PerspectiveCamera,
  baseCameraPos: { x: number; y: number; z: number },
): void {
  const params = getDesignParams().screenEffects.shake;

  if (state.intensity > SHAKE_INTENSITY_THRESHOLD) {
    state.offsetX = (Math.random() * 2 - 1) * state.intensity;
    state.offsetY = (Math.random() * 2 - 1) * state.intensity;
    state.intensity *= params.damping;
  } else {
    state.intensity = 0;
    state.offsetX = 0;
    state.offsetY = 0;
  }

  camera.position.set(
    baseCameraPos.x + state.offsetX,
    baseCameraPos.y + state.offsetY,
    baseCameraPos.z,
  );
}

// --- Hit Flash ---

export interface HitFlashState {
  active: boolean;
  elapsed: number;
  element: HTMLDivElement | null;
}

export function createHitFlashState(): HitFlashState {
  return { active: false, elapsed: 0, element: null };
}

export function mountHitFlash(
  state: HitFlashState,
  container: HTMLElement,
): void {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.inset = '0';
  div.style.backgroundColor = HIT_FLASH_COLOR;
  div.style.opacity = '0';
  div.style.pointerEvents = 'none';
  div.style.zIndex = HIT_FLASH_Z_INDEX;
  container.appendChild(div);
  state.element = div;
}

export function unmountHitFlash(state: HitFlashState): void {
  if (state.element) {
    state.element.parentElement?.removeChild(state.element);
    state.element = null;
  }
}

export function triggerHitFlash(state: HitFlashState): void {
  state.active = true;
  state.elapsed = 0;
}

export function updateHitFlash(state: HitFlashState, dt: number): void {
  if (!state.active || !state.element) return;

  const params = getDesignParams().screenEffects.hitFlash;
  state.elapsed += dt;

  if (state.elapsed >= params.duration) {
    state.active = false;
    state.element.style.opacity = '0';
    return;
  }

  const progress = state.elapsed / params.duration;
  const opacity = params.opacity * (1 - progress);
  state.element.style.opacity = String(opacity);
}

// --- Damage Vignette ---

export interface DamageVignetteState {
  active: boolean;
  elapsed: number;
  element: HTMLDivElement | null;
}

export function createDamageVignetteState(): DamageVignetteState {
  return { active: false, elapsed: 0, element: null };
}

export function mountDamageVignette(
  state: DamageVignetteState,
  container: HTMLElement,
): void {
  const div = document.createElement('div');
  div.style.position = 'absolute';
  div.style.inset = '0';
  div.style.pointerEvents = 'none';
  div.style.zIndex = VIGNETTE_Z_INDEX;
  div.style.opacity = '0';
  div.style.background = VIGNETTE_GRADIENT;
  container.appendChild(div);
  state.element = div;
}

export function unmountDamageVignette(state: DamageVignetteState): void {
  if (state.element) {
    state.element.parentElement?.removeChild(state.element);
    state.element = null;
  }
}

export function updateDamageVignette(
  state: DamageVignetteState,
  dt: number,
  currentHealth: number,
  maxHealth: number,
): void {
  const params = getDesignParams().screenEffects.damageVignette;
  const healthFraction = currentHealth / maxHealth;
  const shouldBeActive = healthFraction < params.healthThreshold;

  if (shouldBeActive) {
    state.active = true;
    state.elapsed += dt;
    if (state.element) {
      const pulse =
        0.5 + 0.5 * Math.sin(state.elapsed * params.pulseSpeed * Math.PI * 2);
      state.element.style.opacity = String(pulse);
    }
  } else {
    state.active = false;
    state.elapsed = 0;
    if (state.element) {
      state.element.style.opacity = '0';
    }
  }
}

// --- Combined screen effects manager ---

export interface ScreenEffects {
  shake: ScreenShakeState;
  hitFlash: HitFlashState;
  damageVignette: DamageVignetteState;
}

export function createScreenEffects(): ScreenEffects {
  return {
    shake: createScreenShakeState(),
    hitFlash: createHitFlashState(),
    damageVignette: createDamageVignetteState(),
  };
}

export function mountScreenEffects(
  effects: ScreenEffects,
  container: HTMLElement,
): void {
  mountHitFlash(effects.hitFlash, container);
  mountDamageVignette(effects.damageVignette, container);
}

export function unmountScreenEffects(effects: ScreenEffects): void {
  unmountHitFlash(effects.hitFlash);
  unmountDamageVignette(effects.damageVignette);
}

export function updateScreenEffects(
  effects: ScreenEffects,
  dt: number,
  camera: THREE.PerspectiveCamera,
  baseCameraPos: { x: number; y: number; z: number },
  currentHealth: number,
  maxHealth: number,
): void {
  updateScreenShake(effects.shake, camera, baseCameraPos);
  updateHitFlash(effects.hitFlash, dt);
  updateDamageVignette(effects.damageVignette, dt, currentHealth, maxHealth);
}
