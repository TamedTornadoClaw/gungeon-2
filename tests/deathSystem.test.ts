import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { deathSystem } from '../src/systems/deathSystem';
import {
  EventType,
  ParticleEffect,
  SoundId,
  EnemyType,
  WeaponSlot,
  AppState,
  GunType,
} from '../src/ecs/components';
import type {
  Health,
  Enemy,
  Player,
  XPGem,
  CurrencyData,
  Gun,
} from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createPlayerEntity(
  world: World,
  hp: number,
  opts?: { activeSlot?: WeaponSlot; sidearmId?: number; longArmId?: number },
): number {
  const id = world.createEntity();
  const sidearmId = opts?.sidearmId ?? createGunEntity(world);
  const longArmId = opts?.longArmId ?? createGunEntity(world);
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: 100,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: sidearmId,
    longArmSlot: longArmId,
    activeSlot: opts?.activeSlot ?? WeaponSlot.LongArm,
    currency: 0,
  });
  world.addComponent(id, 'Position', { x: 0, y: 0, z: 0 });
  world.addComponent(id, 'PlayerTag', {});
  return id;
}

function createGunEntity(world: World): number {
  const id = world.createEntity();
  // Minimal gun component for testing
  world.addComponent<Partial<Gun>>(id, 'Gun', {
    gunType: GunType.Pistol,
    xp: 0,
  });
  return id;
}

function createEnemyEntity(
  world: World,
  hp: number,
  enemyType: EnemyType,
  pos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  opts?: { isMini?: boolean; hasExploded?: boolean; lastDamageSourceGunSlot?: WeaponSlot | null },
): number {
  const id = world.createEntity();
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: 100,
    lastDamageSourceGunSlot: opts?.lastDamageSourceGunSlot ?? null,
  });
  world.addComponent<Enemy>(id, 'Enemy', {
    enemyType,
    isMini: opts?.isMini ?? false,
    hasExploded: opts?.hasExploded ?? false,
  });
  world.addComponent(id, 'Position', pos);
  world.addComponent(id, 'EnemyTag', {});
  return id;
}

function createBossEntity(
  world: World,
  hp: number,
  pos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
  opts?: { lastDamageSourceGunSlot?: WeaponSlot | null },
): number {
  const id = createEnemyEntity(world, hp, EnemyType.KnifeRusher, pos, opts);
  world.addComponent(id, 'BossTag', {});
  return id;
}

function resetAppStore(): void {
  useAppStore.setState({
    currentState: AppState.Gameplay,
    previousState: null,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('DeathSystem', () => {
  let world: World;
  let eventQueue: EventQueue;

  beforeEach(() => {
    world = new World();
    eventQueue = new EventQueue();
    resetAppStore();
  });

  // ── Property: Only entities with health <= 0 are processed ──

  it('does not process entities with health > 0', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (hp) => {
        const w = new World();
        const eq = new EventQueue();
        resetAppStore();
        const sidearmId = createGunEntity(w);
        const longArmId = createGunEntity(w);
        createPlayerEntity(w, 100, { sidearmId, longArmId });
        const enemyId = createEnemyEntity(w, hp, EnemyType.KnifeRusher);

        const countBefore = w.getEntityCount();
        deathSystem(w, eq);

        expect(w.hasEntity(enemyId)).toBe(true);
        expect(w.getEntityCount()).toBe(countBefore);
      }),
    );
  });

  // ── XP gem attributed to correct gun slot ──

  it('attributes XP gem to the gun in lastDamageSourceGunSlot (LongArm)', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId, activeSlot: WeaponSlot.Sidearm });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    // Suppress random drops for clarity
    vi.spyOn(Math, 'random').mockReturnValue(1.0);

    deathSystem(world, eventQueue);

    // Find the XP gem
    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);
    const gem = world.getComponent<XPGem>(xpGems[0], 'XPGem')!;
    expect(gem.sourceGunEntityId).toBe(longArmId);
    expect(gem.amount).toBe(15); // KnifeRusher xpDrop

    vi.restoreAllMocks();
  });

  it('attributes XP gem to sidearm when lastDamageSourceGunSlot is Sidearm', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId, activeSlot: WeaponSlot.LongArm });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.Sidearm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);

    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);
    const gem = world.getComponent<XPGem>(xpGems[0], 'XPGem')!;
    expect(gem.sourceGunEntityId).toBe(sidearmId);

    vi.restoreAllMocks();
  });

  // ── lastDamageSourceGunSlot is null — fallback to active gun ──

  it('falls back to active gun when lastDamageSourceGunSlot is null', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId, activeSlot: WeaponSlot.Sidearm });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: null,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);

    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);
    const gem = world.getComponent<XPGem>(xpGems[0], 'XPGem')!;
    expect(gem.sourceGunEntityId).toBe(sidearmId); // active slot fallback

    vi.restoreAllMocks();
  });

  // ── SuicideBomber killed by gunfire (hasExploded = false) ──

  it('triggers explosion when SuicideBomber dies with hasExploded=false', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    // Player at (6,0,5) — distance 1.0 from bomber at (5,0,5), within radius 3.0
    world.getComponent(world.query(['PlayerTag'])[0], 'Position')!;
    const playerId = world.query(['PlayerTag'])[0];
    (world.getComponent(playerId, 'Position') as { x: number; y: number; z: number }).x = 6;
    (world.getComponent(playerId, 'Position') as { x: number; y: number; z: number }).z = 5;

    // Far away enemy — outside explosion radius
    const farEnemyId = createEnemyEntity(world, 100, EnemyType.Rifleman, { x: 20, y: 0, z: 20 });

    createEnemyEntity(world, 0, EnemyType.SuicideBomber, { x: 5, y: 0, z: 5 }, {
      hasExploded: false,
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    // Should emit DamageEvent for player (within radius) but NOT for far enemy
    const events = eventQueue.consume(EventType.Damage);
    const playerDamageEvents = events.filter((e) => e.target === playerId);
    const farEnemyDamageEvents = events.filter((e) => e.target === farEnemyId);
    expect(playerDamageEvents.length).toBe(1);
    expect(playerDamageEvents[0].amount).toBe(40); // SuicideBomber baseDamage
    expect(farEnemyDamageEvents.length).toBe(0);

    // Should emit Explosion particle and audio events
    const particleEvents = eventQueue.consume(EventType.Particle);
    expect(particleEvents.some((e) => e.effect === ParticleEffect.Explosion)).toBe(true);
    const audioEvents = eventQueue.consume(EventType.Audio);
    expect(audioEvents.some((e) => e.sound === SoundId.Explosion)).toBe(true);
  });

  // ── SuicideBomber contact explosion (hasExploded = true) ──

  it('does not trigger explosion when SuicideBomber dies with hasExploded=true', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    const playerId = createPlayerEntity(world, 100, { sidearmId, longArmId });
    (world.getComponent(playerId, 'Position') as { x: number; y: number; z: number }).x = 6;
    (world.getComponent(playerId, 'Position') as { x: number; y: number; z: number }).z = 5;

    createEnemyEntity(world, 0, EnemyType.SuicideBomber, { x: 5, y: 0, z: 5 }, {
      hasExploded: true,
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    // No damage events from explosion
    const damageEvents = eventQueue.consume(EventType.Damage);
    expect(damageEvents.length).toBe(0);

    // Still has death particle/audio but NOT Explosion particle/audio
    const particleEvents = eventQueue.consume(EventType.Particle);
    expect(particleEvents.some((e) => e.effect === ParticleEffect.Explosion)).toBe(false);
    expect(particleEvents.some((e) => e.effect === ParticleEffect.BloodSplat)).toBe(true);
  });

  // ── SuicideBomber still drops loot even with hasExploded=true ──

  it('drops loot for SuicideBomber regardless of hasExploded flag', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });

    createEnemyEntity(world, 0, EnemyType.SuicideBomber, { x: 5, y: 0, z: 5 }, {
      hasExploded: true,
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    // XP gem should still spawn
    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);
    const gem = world.getComponent<XPGem>(xpGems[0], 'XPGem')!;
    expect(gem.amount).toBe(18); // SuicideBomber xpDrop
  });

  // ── Boss death triggers Victory ──

  it('transitions to Victory state when boss dies', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    createBossEntity(world, 0, { x: 10, y: 0, z: 10 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    expect(useAppStore.getState().currentState).toBe(AppState.Victory);
  });

  it('boss death still spawns XP gem and emits events', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    createBossEntity(world, 0, { x: 10, y: 0, z: 10 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);

    const particleEvents = eventQueue.consume(EventType.Particle);
    expect(particleEvents.some((e) => e.effect === ParticleEffect.BloodSplat)).toBe(true);
    const audioEvents = eventQueue.consume(EventType.Audio);
    expect(audioEvents.some((e) => e.sound === SoundId.EnemyDeath)).toBe(true);
  });

  // ── Player death triggers Death state ──

  it('transitions to Death state when player health <= 0', () => {
    createPlayerEntity(world, 0);

    deathSystem(world, eventQueue);

    expect(useAppStore.getState().currentState).toBe(AppState.Death);
  });

  it('does NOT destroy the player entity on death', () => {
    const playerId = createPlayerEntity(world, 0);

    deathSystem(world, eventQueue);

    expect(world.hasEntity(playerId)).toBe(true);
  });

  // ── Player at exactly 0 health is dead ──

  it('treats player at exactly 0 health as dead', () => {
    createPlayerEntity(world, 0);

    deathSystem(world, eventQueue);

    expect(useAppStore.getState().currentState).toBe(AppState.Death);
  });

  // ── Enemy at exactly 0 health is dead ──

  it('processes enemy with exactly 0 health', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    const enemyId = createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    expect(world.hasEntity(enemyId)).toBe(false);
    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);
  });

  // ── Enemy with negative health (overkill) ──

  it('processes enemy with negative health', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    const enemyId = createEnemyEntity(world, -50, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    expect(world.hasEntity(enemyId)).toBe(false);
    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);
  });

  // ── Currency drop roll ──

  it('spawns currency when random < currencyDropChance', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    // First random call is currency (0.29 < 0.3), second is health (0.5 >= 0.05)
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValueOnce(0.29).mockReturnValueOnce(0.5);

    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const currencies = world.query(['CurrencyData']);
    expect(currencies.length).toBe(1);
    const data = world.getComponent<CurrencyData>(currencies[0], 'CurrencyData')!;
    expect(data.amount).toBe(5); // KnifeRusher currencyDropAmount
  });

  it('does NOT spawn currency when random >= currencyDropChance', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const currencies = world.query(['CurrencyData']);
    expect(currencies.length).toBe(0);
  });

  // ── Health pickup drop roll ──

  it('spawns health pickup when random < healthPickupDropChance', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    // First random: currency (0.5 >= 0.3 — no currency), second: health (0.04 < 0.05 — drops)
    const mockRandom = vi.spyOn(Math, 'random');
    mockRandom.mockReturnValueOnce(0.5).mockReturnValueOnce(0.04);

    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const healthPickups = world.query(['HealthPickupData']);
    expect(healthPickups.length).toBe(1);
  });

  // ── Multiple enemies dying same frame ──

  it('processes multiple enemies dying in the same frame', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });

    const enemy1 = createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 1, y: 0, z: 1 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });
    const enemy2 = createEnemyEntity(world, 0, EnemyType.Rifleman, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.Sidearm,
    });
    const enemy3 = createEnemyEntity(world, 0, EnemyType.Shotgunner, { x: 10, y: 0, z: 10 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    // All three destroyed
    expect(world.hasEntity(enemy1)).toBe(false);
    expect(world.hasEntity(enemy2)).toBe(false);
    expect(world.hasEntity(enemy3)).toBe(false);

    // Three XP gems
    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(3);

    // Three sets of particle + audio events
    const particleEvents = eventQueue.consume(EventType.Particle);
    expect(particleEvents.filter((e) => e.effect === ParticleEffect.BloodSplat).length).toBe(3);
    const audioEvents = eventQueue.consume(EventType.Audio);
    expect(audioEvents.filter((e) => e.sound === SoundId.EnemyDeath).length).toBe(3);
  });

  // ── Mini-boss XP scaling ──

  it('applies miniBossXPMultiplier for mini-boss enemies', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      isMini: true,
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(1);
    const gem = world.getComponent<XPGem>(xpGems[0], 'XPGem')!;
    expect(gem.amount).toBe(15 * 3.0); // xpDrop * miniBossXPMultiplier
  });

  // ── Dead entities are destroyed ──

  it('destroys dead enemy entities after processing', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });
    const enemyId = createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    expect(world.hasEntity(enemyId)).toBe(false);
  });

  // ── Explosion excludes bomber itself ──

  it('bomber explosion does not damage the bomber itself', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    const playerId = createPlayerEntity(world, 100, { sidearmId, longArmId });
    (world.getComponent(playerId, 'Position') as { x: number; y: number; z: number }).x = 50;
    (world.getComponent(playerId, 'Position') as { x: number; y: number; z: number }).z = 50;

    const bomberId = createEnemyEntity(world, 0, EnemyType.SuicideBomber, { x: 5, y: 0, z: 5 }, {
      hasExploded: false,
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const damageEvents = eventQueue.consume(EventType.Damage);
    const selfDamage = damageEvents.filter((e) => e.target === bomberId);
    expect(selfDamage.length).toBe(0);
  });

  // ── Property: currency and health drops are independent per entity ──

  it('rolls currency and health drops independently per entity', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });

    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 1, y: 0, z: 1 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    const mockRandom = vi.spyOn(Math, 'random');
    // Enemy 1: currency roll=0.1 (< 0.3, drops), health roll=0.5 (>= 0.05, no)
    // Enemy 2: currency roll=0.5 (>= 0.3, no), health roll=0.01 (< 0.05, drops)
    mockRandom
      .mockReturnValueOnce(0.1)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.01);

    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const currencies = world.query(['CurrencyData']);
    expect(currencies.length).toBe(1);
    const healthPickups = world.query(['HealthPickupData']);
    expect(healthPickups.length).toBe(1);
  });

  // ── No player in world — enemy death should not crash ──

  it('does not crash when no player exists and enemy dies', () => {
    // No player entity — no gun to attribute XP to
    createEnemyEntity(world, 0, EnemyType.KnifeRusher, { x: 5, y: 0, z: 5 });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    expect(() => deathSystem(world, eventQueue)).not.toThrow();
    vi.restoreAllMocks();

    // Enemy should be destroyed but no XP gem spawned (no player)
    const xpGems = world.query(['XPGem']);
    expect(xpGems.length).toBe(0);
  });

  // ── Particle and audio events emitted for every dying enemy ──

  it('emits exactly one ParticleEvent and one AudioEvent per dying enemy', () => {
    const sidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world);
    createPlayerEntity(world, 100, { sidearmId, longArmId });

    createEnemyEntity(world, 0, EnemyType.Rifleman, { x: 1, y: 0, z: 1 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });
    createEnemyEntity(world, 0, EnemyType.Shotgunner, { x: 10, y: 0, z: 10 }, {
      lastDamageSourceGunSlot: WeaponSlot.LongArm,
    });

    vi.spyOn(Math, 'random').mockReturnValue(1.0);
    deathSystem(world, eventQueue);
    vi.restoreAllMocks();

    const particleEvents = eventQueue.consume(EventType.Particle);
    const audioEvents = eventQueue.consume(EventType.Audio);
    expect(particleEvents.filter((e) => e.effect === ParticleEffect.BloodSplat).length).toBe(2);
    expect(audioEvents.filter((e) => e.sound === SoundId.EnemyDeath).length).toBe(2);
  });

  // ── Property-based: all dead enemies get XP gems and are destroyed ──

  it('property: every dead enemy spawns an XP gem and is destroyed', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), (count) => {
        const w = new World();
        const eq = new EventQueue();
        resetAppStore();

        const sidearmId = createGunEntity(w);
        const longArmId = createGunEntity(w);
        createPlayerEntity(w, 100, { sidearmId, longArmId });

        const enemies: number[] = [];
        for (let i = 0; i < count; i++) {
          enemies.push(
            createEnemyEntity(w, 0, EnemyType.KnifeRusher, { x: i * 5, y: 0, z: 0 }, {
              lastDamageSourceGunSlot: WeaponSlot.LongArm,
            }),
          );
        }

        const mockRandom = vi.spyOn(Math, 'random');
        mockRandom.mockReturnValue(1.0); // no currency/health drops
        deathSystem(w, eq);
        vi.restoreAllMocks();

        for (const eid of enemies) {
          expect(w.hasEntity(eid)).toBe(false);
        }
        const xpGems = w.query(['XPGem']);
        expect(xpGems.length).toBe(count);
      }),
      { numRuns: 20 },
    );
  });
});
