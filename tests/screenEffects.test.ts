// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import {
  createScreenShakeState,
  triggerShake,
  triggerPlayerHitShake,
  triggerExplosionShake,
  triggerBigHitShake,
  updateScreenShake,
  createHitFlashState,
  triggerHitFlash,
  updateHitFlash,
  createDamageVignetteState,
  updateDamageVignette,
  mountHitFlash,
  unmountHitFlash,
  mountDamageVignette,
  unmountDamageVignette,
} from '../src/rendering/screenEffects';
import * as THREE from 'three';

function makeCamera(): THREE.PerspectiveCamera {
  return new THREE.PerspectiveCamera(50, 1, 0.1, 100);
}

const BASE_POS = { x: 0, y: 0, z: 20 };

describe('Screen Shake', () => {
  it('starts with zero intensity', () => {
    const state = createScreenShakeState();
    expect(state.intensity).toBe(0);
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  it('triggerShake increases intensity', () => {
    const state = createScreenShakeState();
    triggerShake(state, 0.5);
    expect(state.intensity).toBe(0.5);
  });

  it('triggerShake is additive', () => {
    const state = createScreenShakeState();
    triggerShake(state, 0.3);
    triggerShake(state, 0.2);
    expect(state.intensity).toBeCloseTo(0.5);
  });

  it('triggerPlayerHitShake sets intensity from design params', () => {
    const state = createScreenShakeState();
    triggerPlayerHitShake(state);
    expect(state.intensity).toBeCloseTo(0.3);
  });

  it('triggerExplosionShake uses explosionIntensity from design params', () => {
    const state = createScreenShakeState();
    triggerExplosionShake(state);
    expect(state.intensity).toBeCloseTo(0.6);
  });

  it('triggerBigHitShake uses bigHitIntensity from design params', () => {
    const state = createScreenShakeState();
    triggerBigHitShake(state);
    expect(state.intensity).toBeCloseTo(0.15);
  });

  it('updateScreenShake decays intensity over time', () => {
    const state = createScreenShakeState();
    const camera = makeCamera();
    triggerShake(state, 1.0);

    updateScreenShake(state, camera, BASE_POS);
    const afterOne = state.intensity;
    expect(afterOne).toBeLessThan(1.0);
    expect(afterOne).toBeGreaterThan(0);

    updateScreenShake(state, camera, BASE_POS);
    expect(state.intensity).toBeLessThan(afterOne);
  });

  it('updateScreenShake zeroes out when intensity is negligible', () => {
    const state = createScreenShakeState();
    const camera = makeCamera();
    triggerShake(state, 0.0005);

    updateScreenShake(state, camera, BASE_POS);
    expect(state.intensity).toBe(0);
    expect(state.offsetX).toBe(0);
    expect(state.offsetY).toBe(0);
  });

  it('updateScreenShake offsets camera position', () => {
    const state = createScreenShakeState();
    const camera = makeCamera();
    triggerShake(state, 1.0);

    updateScreenShake(state, camera, BASE_POS);
    const moved =
      camera.position.x !== BASE_POS.x || camera.position.y !== BASE_POS.y;
    expect(moved).toBe(true);
    expect(camera.position.z).toBe(BASE_POS.z);
  });
});

describe('Hit Flash', () => {
  it('starts inactive', () => {
    const state = createHitFlashState();
    expect(state.active).toBe(false);
    expect(state.elapsed).toBe(0);
  });

  it('triggerHitFlash activates and resets elapsed', () => {
    const state = createHitFlashState();
    triggerHitFlash(state);
    expect(state.active).toBe(true);
    expect(state.elapsed).toBe(0);
  });

  it('updateHitFlash does nothing without element', () => {
    const state = createHitFlashState();
    triggerHitFlash(state);
    // Should not throw even without a mounted element
    updateHitFlash(state, 0.016);
    expect(state.active).toBe(true);
  });

  it('updateHitFlash deactivates after duration', () => {
    const div = document.createElement('div');
    const state = createHitFlashState();
    state.element = div;
    triggerHitFlash(state);

    // Advance past the flash duration (design params: 0.08s)
    updateHitFlash(state, 0.1);
    expect(state.active).toBe(false);
    expect(div.style.opacity).toBe('0');
  });

  it('updateHitFlash fades opacity during flash', () => {
    const div = document.createElement('div');
    const state = createHitFlashState();
    state.element = div;
    triggerHitFlash(state);

    updateHitFlash(state, 0.01);
    const opacity = parseFloat(div.style.opacity);
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThanOrEqual(1);
  });
});

describe('Damage Vignette', () => {
  it('starts inactive', () => {
    const state = createDamageVignetteState();
    expect(state.active).toBe(false);
    expect(state.elapsed).toBe(0);
  });

  it('activates when health is below threshold', () => {
    const state = createDamageVignetteState();
    // healthThreshold in design params is 0.25, so 10/100 = 0.1 is below
    updateDamageVignette(state, 0.016, 10, 100);
    expect(state.active).toBe(true);
  });

  it('stays inactive when health is above threshold', () => {
    const state = createDamageVignetteState();
    updateDamageVignette(state, 0.016, 80, 100);
    expect(state.active).toBe(false);
  });

  it('deactivates when health recovers above threshold', () => {
    const state = createDamageVignetteState();
    updateDamageVignette(state, 0.016, 10, 100);
    expect(state.active).toBe(true);

    updateDamageVignette(state, 0.016, 80, 100);
    expect(state.active).toBe(false);
    expect(state.elapsed).toBe(0);
  });

  it('pulses opacity when active with element', () => {
    const div = document.createElement('div');
    const state = createDamageVignetteState();
    state.element = div;

    updateDamageVignette(state, 0.016, 10, 100);
    const opacity = parseFloat(div.style.opacity);
    expect(opacity).toBeGreaterThanOrEqual(0);
    expect(opacity).toBeLessThanOrEqual(1);
  });

  it('pulses using sine wave at pulseSpeed', () => {
    const div = document.createElement('div');
    const state = createDamageVignetteState();
    state.element = div;

    // Collect opacities over several frames to verify oscillation
    const opacities: number[] = [];
    for (let i = 0; i < 20; i++) {
      updateDamageVignette(state, 0.05, 10, 100);
      opacities.push(parseFloat(div.style.opacity));
    }

    // Should have varying values (not constant), confirming sine wave behavior
    const unique = new Set(opacities.map((o) => o.toFixed(4)));
    expect(unique.size).toBeGreaterThan(3);
  });
});

describe('Hit Flash mount/unmount', () => {
  it('mountHitFlash creates an overlay element', () => {
    const container = document.createElement('div');
    const state = createHitFlashState();
    mountHitFlash(state, container);
    expect(state.element).not.toBeNull();
    expect(container.children.length).toBe(1);
  });

  it('unmountHitFlash removes the overlay element', () => {
    const container = document.createElement('div');
    const state = createHitFlashState();
    mountHitFlash(state, container);
    unmountHitFlash(state);
    expect(state.element).toBeNull();
    expect(container.children.length).toBe(0);
  });
});

describe('Damage Vignette mount/unmount', () => {
  it('mountDamageVignette creates an overlay element', () => {
    const container = document.createElement('div');
    const state = createDamageVignetteState();
    mountDamageVignette(state, container);
    expect(state.element).not.toBeNull();
    expect(container.children.length).toBe(1);
  });

  it('unmountDamageVignette removes the overlay element', () => {
    const container = document.createElement('div');
    const state = createDamageVignetteState();
    mountDamageVignette(state, container);
    unmountDamageVignette(state);
    expect(state.element).toBeNull();
    expect(container.children.length).toBe(0);
  });
});
