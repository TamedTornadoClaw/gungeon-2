// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { EventType, ParticleEffect, SoundId, EnemyType, WeaponSlot } from '../src/ecs/components';
import type { Health, Enemy } from '../src/ecs/components';
import { damageSystem } from '../src/systems/damageSystem';
import { deathSystem } from '../src/systems/deathSystem';
import {
  effectsPipelineSystem,
  createEffectsBuffer,
  clearEffectsBuffer,
} from '../src/systems/effectsPipelineSystem';
import {
  createScreenShakeState,
  triggerShake,
  updateScreenShake,
  createHitFlashState,
  triggerHitFlash,
  updateHitFlash,
  createDamageVignetteState,
  updateDamageVignette,
} from '../src/rendering/screenEffects';
import * as THREE from 'three';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createPlayerEntity(world: World, hp: number): number {
  const id = world.createEntity();
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: 100,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent(id, 'Position', { x: 0, y: 0, z: 0 });
  world.addComponent(id, 'PlayerTag', {});
  world.addComponent(id, 'Player', {
    sidearmSlot: createGunStub(world),
    longArmSlot: createGunStub(world),
    activeSlot: WeaponSlot.LongArm,
    currency: 0,
  });
  return id;
}

function createGunStub(world: World): number {
  const id = world.createEntity();
  world.addComponent(id, 'Gun', {
    gunType: 0, xp: 0, category: 0,
    baseDamage: 10, baseFireRate: 1, baseMagazineSize: 10,
    baseReloadTime: 1, baseSpread: 0, baseProjectileCount: 1,
    baseProjectileSpeed: 10, baseKnockback: 0, baseCritChance: 0,
    baseCritMultiplier: 1, damage: 10, fireRate: 1, magazineSize: 10,
    reloadTime: 1, spread: 0, projectileCount: 1, projectileSpeed: 10,
    knockback: 0, critChance: 0, critMultiplier: 1, currentAmmo: 10,
    isReloading: false, reloadTimer: 0, fireCooldown: 0, fireRequested: false,
    traits: [0, 1, 2], traitLevels: [0, 0, 0], forcedUpgradeTriggered: false,
  });
  return id;
}

function createEnemyEntity(
  world: World,
  hp: number,
  enemyType: EnemyType,
  pos = { x: 0, y: 0, z: 0 },
  opts?: { hasExploded?: boolean },
): number {
  const id = world.createEntity();
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: 100,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Enemy>(id, 'Enemy', {
    enemyType,
    isMini: false,
    hasExploded: opts?.hasExploded ?? false,
  });
  world.addComponent(id, 'Position', pos);
  world.addComponent(id, 'EnemyTag', {});
  return id;
}

function emitDamage(
  eq: EventQueue,
  target: number,
  source: number,
  amount: number,
  isCritical = false,
  impactPosition = { x: 1, y: 2, z: 3 },
): void {
  eq.emit({
    type: EventType.Damage,
    target,
    source,
    amount,
    isCritical,
    impactPosition,
  });
}

// ── EffectsPipelineSystem Tests ─────────────────────────────────────────────

describe('effectsPipelineSystem', () => {
  it('consumes DamageNumberEvents into the buffer', () => {
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();

    eq.emit({ type: EventType.DamageNumber, amount: 15, position: { x: 1, y: 2, z: 3 }, isCritical: false });
    eq.emit({ type: EventType.DamageNumber, amount: 30, position: { x: 4, y: 5, z: 6 }, isCritical: true });

    effectsPipelineSystem(eq, buffer);

    expect(buffer.damageNumbers).toHaveLength(2);
    expect(buffer.damageNumbers[0]).toEqual({ amount: 15, position: { x: 1, y: 2, z: 3 }, isCritical: false });
    expect(buffer.damageNumbers[1]).toEqual({ amount: 30, position: { x: 4, y: 5, z: 6 }, isCritical: true });
  });

  it('consumes ScreenShake events additively', () => {
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();

    eq.emit({ type: EventType.ScreenShake, intensity: 0.3 });
    eq.emit({ type: EventType.ScreenShake, intensity: 0.6 });

    effectsPipelineSystem(eq, buffer);

    expect(buffer.shakeIntensity).toBeCloseTo(0.9);
  });

  it('consumes HitFlash events', () => {
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();

    eq.emit({ type: EventType.HitFlash });

    effectsPipelineSystem(eq, buffer);

    expect(buffer.hitFlashTriggered).toBe(true);
  });

  it('does not set hitFlash when no HitFlash events exist', () => {
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();

    eq.emit({ type: EventType.DamageNumber, amount: 10, position: { x: 0, y: 0, z: 0 }, isCritical: false });

    effectsPipelineSystem(eq, buffer);

    expect(buffer.hitFlashTriggered).toBe(false);
  });

  it('clearEffectsBuffer resets all fields', () => {
    const buffer = createEffectsBuffer();
    buffer.damageNumbers.push({ amount: 10, position: { x: 0, y: 0, z: 0 }, isCritical: false });
    buffer.shakeIntensity = 0.5;
    buffer.hitFlashTriggered = true;

    clearEffectsBuffer(buffer);

    expect(buffer.damageNumbers).toHaveLength(0);
    expect(buffer.shakeIntensity).toBe(0);
    expect(buffer.hitFlashTriggered).toBe(false);
  });

  it('removes consumed events from queue (does not leave them for later consumers)', () => {
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();

    eq.emit({ type: EventType.DamageNumber, amount: 10, position: { x: 0, y: 0, z: 0 }, isCritical: false });
    eq.emit({ type: EventType.ScreenShake, intensity: 0.3 });
    eq.emit({ type: EventType.HitFlash });

    effectsPipelineSystem(eq, buffer);

    // All consumed — queue should have nothing left for these types
    expect(eq.consume(EventType.DamageNumber)).toHaveLength(0);
    expect(eq.consume(EventType.ScreenShake)).toHaveLength(0);
    expect(eq.consume(EventType.HitFlash)).toHaveLength(0);
  });
});

// ── DamageSystem Screen Effect Emission Tests ───────────────────────────────

describe('damageSystem screen effect wiring', () => {
  it('emits ParticleEvent, AudioEvent, and DamageNumberEvent for enemy hit', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyEntity(world, 100, EnemyType.KnifeRusher);
    const source = world.createEntity();

    emitDamage(eq, target, source, 15);
    damageSystem(world, eq);

    const particles = eq.consume(EventType.Particle);
    expect(particles.length).toBeGreaterThanOrEqual(1);
    expect(particles[0].effect).toBe(ParticleEffect.BloodSplat);

    const audio = eq.consume(EventType.Audio);
    expect(audio.length).toBeGreaterThanOrEqual(1);
    expect(audio[0].sound).toBe(SoundId.EnemyHitFlesh);

    const dmgNumbers = eq.consume(EventType.DamageNumber);
    expect(dmgNumbers).toHaveLength(1);
    expect(dmgNumbers[0].amount).toBe(15);
    expect(dmgNumbers[0].isCritical).toBe(false);
  });

  it('emits ScreenShake event when player takes damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const player = createPlayerEntity(world, 100);
    const source = world.createEntity();

    emitDamage(eq, player, source, 20);
    damageSystem(world, eq);

    const shakes = eq.consume(EventType.ScreenShake);
    expect(shakes).toHaveLength(1);
    expect(shakes[0].intensity).toBeCloseTo(0.3);
  });

  it('emits PlayerHitGrunt audio when player takes damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const player = createPlayerEntity(world, 100);
    const source = world.createEntity();

    emitDamage(eq, player, source, 20);
    damageSystem(world, eq);

    const audio = eq.consume(EventType.Audio);
    const gruntEvents = audio.filter(e => e.sound === SoundId.PlayerHitGrunt);
    expect(gruntEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('emits HitFlash event for critical hits', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyEntity(world, 100, EnemyType.KnifeRusher);
    const source = world.createEntity();

    emitDamage(eq, target, source, 30, true);
    damageSystem(world, eq);

    const flashes = eq.consume(EventType.HitFlash);
    expect(flashes).toHaveLength(1);
  });

  it('does not emit HitFlash for non-critical hits', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyEntity(world, 100, EnemyType.KnifeRusher);
    const source = world.createEntity();

    emitDamage(eq, target, source, 15, false);
    damageSystem(world, eq);

    const flashes = eq.consume(EventType.HitFlash);
    expect(flashes).toHaveLength(0);
  });

  it('does not emit ScreenShake when enemy (not player) takes damage', () => {
    const world = new World();
    const eq = new EventQueue();
    const target = createEnemyEntity(world, 100, EnemyType.KnifeRusher);
    const source = world.createEntity();

    emitDamage(eq, target, source, 15);
    damageSystem(world, eq);

    const shakes = eq.consume(EventType.ScreenShake);
    expect(shakes).toHaveLength(0);
  });
});

// ── DeathSystem Explosion Screen Effect Tests ───────────────────────────────

describe('deathSystem explosion screen effects', () => {
  it('emits ScreenShake and HitFlash for bomber explosion on death', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerEntity(world, 100);
    createEnemyEntity(world, 0, EnemyType.SuicideBomber, { x: 0, y: 0, z: 0 }, { hasExploded: false });

    deathSystem(world, eq);

    const shakes = eq.consume(EventType.ScreenShake);
    expect(shakes.length).toBeGreaterThanOrEqual(1);
    expect(shakes[0].intensity).toBeCloseTo(0.6);

    const flashes = eq.consume(EventType.HitFlash);
    expect(flashes.length).toBeGreaterThanOrEqual(1);
  });

  it('does not emit explosion effects for already-exploded bomber', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerEntity(world, 100);
    createEnemyEntity(world, 0, EnemyType.SuicideBomber, { x: 0, y: 0, z: 0 }, { hasExploded: true });

    deathSystem(world, eq);

    const shakes = eq.consume(EventType.ScreenShake);
    expect(shakes).toHaveLength(0);
  });

  it('emits death particles and audio for every enemy death', () => {
    const world = new World();
    const eq = new EventQueue();
    createPlayerEntity(world, 100);
    createEnemyEntity(world, 0, EnemyType.Shotgunner, { x: 5, y: 0, z: 5 });

    deathSystem(world, eq);

    const particles = eq.consume(EventType.Particle);
    const bloodParticles = particles.filter(p => p.effect === ParticleEffect.BloodSplat);
    expect(bloodParticles).toHaveLength(1);

    const audio = eq.consume(EventType.Audio);
    const deathSounds = audio.filter(a => a.sound === SoundId.EnemyDeath);
    expect(deathSounds).toHaveLength(1);
  });
});

// ── Full Pipeline Integration Tests ─────────────────────────────────────────

describe('full effects pipeline integration', () => {
  it('damage → DamageNumberEvent → effectsPipeline buffers it', () => {
    const world = new World();
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();
    const target = createEnemyEntity(world, 100, EnemyType.KnifeRusher);
    const source = world.createEntity();

    emitDamage(eq, target, source, 15);
    damageSystem(world, eq);
    effectsPipelineSystem(eq, buffer);

    expect(buffer.damageNumbers).toHaveLength(1);
    expect(buffer.damageNumbers[0].amount).toBe(15);
    expect(buffer.damageNumbers[0].isCritical).toBe(false);
  });

  it('critical hit → HitFlash + DamageNumber with isCritical=true', () => {
    const world = new World();
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();
    const target = createEnemyEntity(world, 100, EnemyType.KnifeRusher);
    const source = world.createEntity();

    emitDamage(eq, target, source, 30, true);
    damageSystem(world, eq);
    effectsPipelineSystem(eq, buffer);

    expect(buffer.damageNumbers).toHaveLength(1);
    expect(buffer.damageNumbers[0].isCritical).toBe(true);
    expect(buffer.hitFlashTriggered).toBe(true);
  });

  it('player hit → ScreenShake buffered at correct intensity', () => {
    const world = new World();
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();
    const player = createPlayerEntity(world, 100);
    const source = world.createEntity();

    emitDamage(eq, player, source, 20);
    damageSystem(world, eq);
    effectsPipelineSystem(eq, buffer);

    expect(buffer.shakeIntensity).toBeCloseTo(0.3);
  });

  it('multiple damage events produce independent effects', () => {
    const world = new World();
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();
    const e1 = createEnemyEntity(world, 100, EnemyType.KnifeRusher, { x: 0, y: 0, z: 0 });
    const e2 = createEnemyEntity(world, 100, EnemyType.Shotgunner, { x: 5, y: 0, z: 5 });
    const e3 = createEnemyEntity(world, 100, EnemyType.Rifleman, { x: 10, y: 0, z: 10 });
    const source = world.createEntity();

    emitDamage(eq, e1, source, 10);
    emitDamage(eq, e2, source, 20);
    emitDamage(eq, e3, source, 30);
    damageSystem(world, eq);
    effectsPipelineSystem(eq, buffer);

    expect(buffer.damageNumbers).toHaveLength(3);
    expect(buffer.damageNumbers.map(d => d.amount)).toEqual([10, 20, 30]);
  });

  it('explosion produces both shake and flash in buffer', () => {
    const world = new World();
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();
    createPlayerEntity(world, 100);
    createEnemyEntity(world, 0, EnemyType.SuicideBomber, { x: 0, y: 0, z: 0 }, { hasExploded: false });

    deathSystem(world, eq);
    effectsPipelineSystem(eq, buffer);

    expect(buffer.shakeIntensity).toBeCloseTo(0.6);
    expect(buffer.hitFlashTriggered).toBe(true);
  });
});

// ── Screen Shake Properties ─────────────────────────────────────────────────

describe('screen shake properties', () => {
  it('shake intensity decays exponentially with damping', () => {
    const state = createScreenShakeState();
    const camera = new THREE.PerspectiveCamera();
    const basePos = { x: 0, y: 0, z: 20 };

    triggerShake(state, 0.6);

    const intensities: number[] = [];
    for (let i = 0; i < 5; i++) {
      updateScreenShake(state, camera, basePos);
      intensities.push(state.intensity);
    }

    // Each intensity should be less than the previous (decaying)
    for (let i = 1; i < intensities.length; i++) {
      expect(intensities[i]).toBeLessThan(intensities[i - 1]);
    }
  });

  it('multiple shake sources stack additively', () => {
    const state = createScreenShakeState();
    triggerShake(state, 0.3);
    triggerShake(state, 0.6);
    expect(state.intensity).toBeCloseTo(0.9);
  });

  it('intensity never increases without new trigger (property test)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(2.0), noNaN: true }),
        fc.integer({ min: 1, max: 20 }),
        (initialIntensity, frames) => {
          const state = createScreenShakeState();
          const camera = new THREE.PerspectiveCamera();
          const basePos = { x: 0, y: 0, z: 20 };

          triggerShake(state, initialIntensity);

          let prev = state.intensity;
          for (let i = 0; i < frames; i++) {
            updateScreenShake(state, camera, basePos);
            expect(state.intensity).toBeLessThanOrEqual(prev);
            prev = state.intensity;
          }
        },
      ),
    );
  });
});

// ── Damage Vignette Properties ──────────────────────────────────────────────

describe('damage vignette properties', () => {
  it('activates when health drops below threshold', () => {
    const state = createDamageVignetteState();
    updateDamageVignette(state, 0.016, 20, 100); // 20% < 25% threshold
    expect(state.active).toBe(true);
  });

  it('deactivates when health is above threshold', () => {
    const state = createDamageVignetteState();
    updateDamageVignette(state, 0.016, 20, 100); // activate
    expect(state.active).toBe(true);

    updateDamageVignette(state, 0.016, 50, 100); // heal above
    expect(state.active).toBe(false);
  });

  it('property: active iff health < threshold', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 0, max: 100, noNaN: true }),
        fc.float({ min: 1, max: 100, noNaN: true }),
        (current, max) => {
          const state = createDamageVignetteState();
          updateDamageVignette(state, 0.016, current, max);
          const fraction = current / max;
          expect(state.active).toBe(fraction < 0.25);
        },
      ),
    );
  });
});

// ── Hit Flash Properties ────────────────────────────────────────────────────

describe('hit flash properties', () => {
  it('starts active and deactivates after duration', () => {
    const state = createHitFlashState();
    state.element = document.createElement('div');

    triggerHitFlash(state);
    expect(state.active).toBe(true);

    // Advance past duration (0.08s)
    updateHitFlash(state, 0.1);
    expect(state.active).toBe(false);
  });
});

// ── Edge Cases ──────────────────────────────────────────────────────────────

describe('effects pipeline edge cases', () => {
  it('handles burst of 20+ damage events without dropping', () => {
    const world = new World();
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();

    const enemies: number[] = [];
    for (let i = 0; i < 25; i++) {
      enemies.push(createEnemyEntity(world, 100, EnemyType.KnifeRusher, { x: i, y: 0, z: 0 }));
    }
    const source = world.createEntity();

    for (const target of enemies) {
      emitDamage(eq, target, source, 10);
    }

    damageSystem(world, eq);
    effectsPipelineSystem(eq, buffer);

    expect(buffer.damageNumbers).toHaveLength(25);
  });

  it('handles empty event queue gracefully', () => {
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();

    effectsPipelineSystem(eq, buffer);

    expect(buffer.damageNumbers).toHaveLength(0);
    expect(buffer.shakeIntensity).toBe(0);
    expect(buffer.hitFlashTriggered).toBe(false);
  });

  it('DamageNumberEvent position matches impact position', () => {
    const world = new World();
    const eq = new EventQueue();
    const buffer = createEffectsBuffer();
    const target = createEnemyEntity(world, 100, EnemyType.KnifeRusher, { x: 10, y: 0, z: 5 });
    const source = world.createEntity();

    emitDamage(eq, target, source, 15, false, { x: 10, y: 0, z: 5 });
    damageSystem(world, eq);
    effectsPipelineSystem(eq, buffer);

    expect(buffer.damageNumbers[0].position).toEqual({ x: 10, y: 0, z: 5 });
  });
});
