import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { pickupSystem } from '../src/systems/pickupSystem';
import {
  AppState,
  EventType,
  GunCategory,
  GunTrait,
  GunType,
  PickupType,
  SoundId,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  CurrencyData,
  Gun,
  Health,
  HealthPickupData,
  Pickup,
  Player,
  Position,
  XPGem,
} from '../src/ecs/components';
import type { InputState } from '../src/input/inputManager';
import { useAppStore } from '../src/store/appStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

function defaultInput(overrides?: Partial<InputState>): InputState {
  return {
    moveX: 0,
    moveY: 0,
    aimWorldX: 0,
    aimWorldY: 0,
    fireSidearm: false,
    fireLongArm: false,
    reload: false,
    dodgeRoll: false,
    interact: false,
    openUpgrade: false,
    pause: false,
    ...overrides,
  };
}

function makeGun(overrides?: Partial<Gun>): Gun {
  return {
    gunType: GunType.Pistol,
    category: GunCategory.Sidearm,
    baseDamage: 10,
    baseFireRate: 5,
    baseMagazineSize: 12,
    baseReloadTime: 1.5,
    baseSpread: 0.05,
    baseProjectileCount: 1,
    baseProjectileSpeed: 30,
    baseKnockback: 1,
    baseCritChance: 0.05,
    baseCritMultiplier: 2,
    damage: 10,
    fireRate: 5,
    magazineSize: 12,
    reloadTime: 1.5,
    spread: 0.05,
    projectileCount: 1,
    projectileSpeed: 30,
    knockback: 1,
    critChance: 0.05,
    critMultiplier: 2,
    currentAmmo: 12,
    isReloading: false,
    reloadTimer: 0,
    fireCooldown: 0,
    fireRequested: false,
    traits: [GunTrait.Damage, GunTrait.FireRate, GunTrait.MagazineSize],
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
    ...overrides,
  };
}

function createGunEntity(world: World, overrides?: Partial<Gun>): number {
  const id = world.createEntity();
  world.addComponent<Gun>(id, 'Gun', makeGun(overrides));
  return id;
}

function createPlayerEntity(
  world: World,
  opts?: {
    pos?: { x: number; y: number; z: number };
    hp?: number;
    maxHp?: number;
    currency?: number;
    sidearmId?: number;
    longArmId?: number;
  },
): number {
  const id = world.createEntity();
  const sidearmId = opts?.sidearmId ?? createGunEntity(world);
  const longArmId = opts?.longArmId ?? createGunEntity(world, { category: GunCategory.LongArm, gunType: GunType.AssaultRifle });
  const pos = opts?.pos ?? { x: 0, y: 0, z: 0 };

  world.addComponent<Position>(id, 'Position', { ...pos });
  world.addComponent<Health>(id, 'Health', {
    current: opts?.hp ?? 100,
    max: opts?.maxHp ?? 100,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: sidearmId,
    longArmSlot: longArmId,
    activeSlot: WeaponSlot.Sidearm,
    currency: opts?.currency ?? 0,
  });
  world.addComponent(id, 'PlayerTag', {});
  return id;
}

function createXPGemEntity(
  world: World,
  pos: { x: number; y: number; z: number },
  sourceGunEntityId: number,
  amount: number,
  isFlying: boolean,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { ...pos });
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.XPGem });
  world.addComponent<XPGem>(id, 'XPGem', { sourceGunEntityId, amount, isFlying });
  world.addComponent(id, 'PickupTag', {});
  return id;
}

function createHealthPickupEntity(
  world: World,
  pos: { x: number; y: number; z: number },
  healAmount: number,
  near: boolean,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { ...pos });
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.HealthPickup });
  world.addComponent<HealthPickupData>(id, 'HealthPickupData', { healAmount });
  world.addComponent(id, 'PickupTag', {});
  if (near) world.addComponent(id, 'NearPickup', {});
  return id;
}

function createCurrencyPickupEntity(
  world: World,
  pos: { x: number; y: number; z: number },
  amount: number,
  near: boolean,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { ...pos });
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.Currency });
  world.addComponent<CurrencyData>(id, 'CurrencyData', { amount });
  world.addComponent(id, 'PickupTag', {});
  if (near) world.addComponent(id, 'NearPickup', {});
  return id;
}

function createGunPickupEntity(
  world: World,
  pos: { x: number; y: number; z: number },
  gunOverrides?: Partial<Gun>,
  near = false,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { ...pos });
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.GunPickup });
  world.addComponent<Gun>(id, 'Gun', makeGun({
    gunType: GunType.Shotgun,
    category: GunCategory.LongArm,
    ...gunOverrides,
  }));
  world.addComponent(id, 'PickupTag', {});
  if (near) world.addComponent(id, 'NearPickup', {});
  return id;
}

// ── Tests ─────────────────────────────────────────────────────────────────

let world: World;
let eventQueue: EventQueue;

beforeEach(() => {
  world = new World();
  eventQueue = new EventQueue();
  // Reset app store to Gameplay state
  useAppStore.setState({
    currentState: AppState.Gameplay,
    previousState: AppState.WeaponSelect,
    comparisonGunEntityId: null,
    comparisonSlot: null,
  });
});

describe('XP gem flying and collection', () => {
  it('moves flying XP gem toward player each tick', () => {
    const sidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId });

    const gemId = createXPGemEntity(world, { x: 10, y: 0, z: 0 }, sidearmId, 25, true);
    const dt = 1 / 60;

    pickupSystem(world, defaultInput(), eventQueue, dt);

    const gemPos = world.getComponent<Position>(gemId, 'Position');
    // Gem should have moved closer to player (at x=0)
    expect(gemPos).toBeDefined();
    expect(gemPos!.x).toBeLessThan(10);
    expect(gemPos!.x).toBeGreaterThan(0); // Not collected yet at this distance
  });

  it('collects XP gem when it reaches the player and adds XP to source gun', () => {
    const sidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId });

    // Place gem very close to player (within collection threshold of 0.5)
    createXPGemEntity(world, { x: 0.3, y: 0, z: 0 }, sidearmId, 25, true);

    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    const gun = world.getComponent<Gun>(sidearmId, 'Gun')!;
    expect(gun.xp).toBe(25);

    // Gem should be destroyed
    expect(world.query(['XPGem']).length).toBe(0);

    // Audio event emitted
    const events = eventQueue.consume(EventType.Audio);
    expect(events.length).toBe(1);
    expect(events[0].sound).toBe(SoundId.XPGemPickup);
  });

  it('does not move XP gem with isFlying=false', () => {
    const sidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId });

    const gemId = createXPGemEntity(world, { x: 5, y: 0, z: 0 }, sidearmId, 10, false);

    for (let i = 0; i < 10; i++) {
      pickupSystem(world, defaultInput(), eventQueue, 1 / 60);
    }

    const gemPos = world.getComponent<Position>(gemId, 'Position')!;
    expect(gemPos.x).toBe(5);
    expect(gemPos.z).toBe(0);
    expect(world.hasEntity(gemId)).toBe(true);
  });

  it('collects gem immediately when spawned at player position', () => {
    const sidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId });

    createXPGemEntity(world, { x: 0, y: 0, z: 0 }, sidearmId, 50, true);

    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    const gun = world.getComponent<Gun>(sidearmId, 'Gun')!;
    expect(gun.xp).toBe(50);
    expect(world.query(['XPGem']).length).toBe(0);
  });

  it('falls back to same-slot gun when source gun entity is destroyed', () => {
    const originalSidearmId = createGunEntity(world);
    const newSidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId: newSidearmId });

    // Destroy the original gun entity (simulating gun swap)
    world.destroyEntity(originalSidearmId);

    // Gem still references old entity
    createXPGemEntity(world, { x: 0, y: 0, z: 0 }, originalSidearmId, 30, true);

    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    const gun = world.getComponent<Gun>(newSidearmId, 'Gun')!;
    expect(gun.xp).toBe(30);
    expect(world.query(['XPGem']).length).toBe(0);
  });

  it('handles double-fallback when both source and slot gun are invalid', () => {
    const originalSidearmId = createGunEntity(world);
    const longArmId = createGunEntity(world, { category: GunCategory.LongArm });
    createPlayerEntity(world, { sidearmId: 9999, longArmId });

    world.destroyEntity(originalSidearmId);

    // Gem references destroyed entity, sidearm slot points to non-existent entity
    createXPGemEntity(world, { x: 0, y: 0, z: 0 }, originalSidearmId, 20, true);

    // Should not crash — XP goes to longArm as fallback
    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    const gun = world.getComponent<Gun>(longArmId, 'Gun')!;
    expect(gun.xp).toBe(20);
    expect(world.query(['XPGem']).length).toBe(0);
  });

  it('does not collect XP gems when player is dead', () => {
    const sidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId, hp: 0 });

    const gemId = createXPGemEntity(world, { x: 0.1, y: 0, z: 0 }, sidearmId, 25, true);

    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    expect(world.hasEntity(gemId)).toBe(true);
    const gun = world.getComponent<Gun>(sidearmId, 'Gun')!;
    expect(gun.xp).toBe(0);
  });

  it('collects XP gem with amount=0 without error', () => {
    const sidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId });

    createXPGemEntity(world, { x: 0, y: 0, z: 0 }, sidearmId, 0, true);

    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    const gun = world.getComponent<Gun>(sidearmId, 'Gun')!;
    expect(gun.xp).toBe(0);
    expect(world.query(['XPGem']).length).toBe(0);
  });
});

describe('Health pickup', () => {
  it('requires both nearPickup flag and interact to collect', () => {
    createPlayerEntity(world, { hp: 70, maxHp: 100 });
    const pickupId = createHealthPickupEntity(world, { x: 1, y: 0, z: 0 }, 30, true);

    // No interact — should not collect
    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);
    expect(world.hasEntity(pickupId)).toBe(true);

    // Now interact
    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    const players = world.query(['PlayerTag', 'Health']);
    const health = world.getComponent<Health>(players[0], 'Health')!;
    expect(health.current).toBe(100);
    expect(world.hasEntity(pickupId)).toBe(false);

    const events = eventQueue.consume(EventType.Audio);
    expect(events.length).toBe(1);
    expect(events[0].sound).toBe(SoundId.HealthPickup);
  });

  it('does not collect without nearPickup flag even with interact', () => {
    createPlayerEntity(world, { hp: 70, maxHp: 100 });
    const pickupId = createHealthPickupEntity(world, { x: 1, y: 0, z: 0 }, 30, false);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    expect(world.hasEntity(pickupId)).toBe(true);
    const players = world.query(['PlayerTag', 'Health']);
    const health = world.getComponent<Health>(players[0], 'Health')!;
    expect(health.current).toBe(70);
  });

  it('clamps healing to max health', () => {
    createPlayerEntity(world, { hp: 95, maxHp: 100 });
    createHealthPickupEntity(world, { x: 1, y: 0, z: 0 }, 30, true);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    const players = world.query(['PlayerTag', 'Health']);
    const health = world.getComponent<Health>(players[0], 'Health')!;
    expect(health.current).toBe(100);
  });

  it('consumes pickup at full health (heal amount effectively 0)', () => {
    createPlayerEntity(world, { hp: 100, maxHp: 100 });
    const pickupId = createHealthPickupEntity(world, { x: 1, y: 0, z: 0 }, 30, true);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    expect(world.hasEntity(pickupId)).toBe(false);
    const players = world.query(['PlayerTag', 'Health']);
    const health = world.getComponent<Health>(players[0], 'Health')!;
    expect(health.current).toBe(100);
  });

  it('treats negative healAmount as 0 (health never decreases from heal)', () => {
    createPlayerEntity(world, { hp: 80, maxHp: 100 });
    createHealthPickupEntity(world, { x: 1, y: 0, z: 0 }, -10, true);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    const players = world.query(['PlayerTag', 'Health']);
    const health = world.getComponent<Health>(players[0], 'Health')!;
    expect(health.current).toBe(80);
  });
});

describe('Currency pickup', () => {
  it('adds currency to player on interact', () => {
    createPlayerEntity(world, { currency: 15 });
    createCurrencyPickupEntity(world, { x: 1, y: 0, z: 0 }, 10, true);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    const players = world.query(['PlayerTag', 'Player']);
    const player = world.getComponent<Player>(players[0], 'Player')!;
    expect(player.currency).toBe(25);

    const events = eventQueue.consume(EventType.Audio);
    expect(events.length).toBe(1);
    expect(events[0].sound).toBe(SoundId.CurrencyPickup);
  });

  it('does not collect without interact', () => {
    createPlayerEntity(world, { currency: 15 });
    const pickupId = createCurrencyPickupEntity(world, { x: 1, y: 0, z: 0 }, 10, true);

    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    expect(world.hasEntity(pickupId)).toBe(true);
    const players = world.query(['PlayerTag', 'Player']);
    const player = world.getComponent<Player>(players[0], 'Player')!;
    expect(player.currency).toBe(15);
  });
});

describe('Gun pickup', () => {
  it('transitions to GunComparison state on interact', () => {
    createPlayerEntity(world);
    const pickupId = createGunPickupEntity(world, { x: 1, y: 0, z: 0 }, {
      gunType: GunType.Shotgun,
      category: GunCategory.LongArm,
    }, true);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    const store = useAppStore.getState();
    expect(store.currentState).toBe(AppState.GunComparison);
    expect(store.comparisonGunEntityId).toBe(pickupId);
    expect(store.comparisonSlot).toBe(WeaponSlot.LongArm);

    // Pickup should NOT be destroyed
    expect(world.hasEntity(pickupId)).toBe(true);
  });

  it('does not trigger GunComparison when already in that state', () => {
    createPlayerEntity(world);
    createGunPickupEntity(world, { x: 1, y: 0, z: 0 }, undefined, true);

    // Already in GunComparison — transition from Gameplay → GunComparison would throw
    useAppStore.setState({ currentState: AppState.GunComparison, previousState: AppState.Gameplay });

    // Should not throw or transition
    expect(() => {
      pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);
    }).not.toThrow();
  });

  it('sets sidearm slot for sidearm-category gun pickups', () => {
    createPlayerEntity(world);
    const pickupId = createGunPickupEntity(world, { x: 1, y: 0, z: 0 }, {
      gunType: GunType.Pistol,
      category: GunCategory.Sidearm,
    }, true);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    const store = useAppStore.getState();
    expect(store.comparisonSlot).toBe(WeaponSlot.Sidearm);
    expect(store.comparisonGunEntityId).toBe(pickupId);
  });
});

describe('Multiple pickups per frame', () => {
  it('collects at most one interact pickup per frame', () => {
    createPlayerEntity(world, { hp: 70, maxHp: 100, currency: 0 });
    createHealthPickupEntity(world, { x: 1, y: 0, z: 0 }, 30, true);
    createCurrencyPickupEntity(world, { x: 1, y: 0, z: 0 }, 10, true);

    pickupSystem(world, defaultInput({ interact: true }), eventQueue, 1 / 60);

    // Only one pickup should be collected
    const players = world.query(['PlayerTag']);
    const health = world.getComponent<Health>(players[0], 'Health')!;
    const player = world.getComponent<Player>(players[0], 'Player')!;

    // One of these should have changed, but not both
    const healthCollected = health.current === 100;
    const currencyCollected = player.currency === 10;
    expect(healthCollected || currencyCollected).toBe(true);
    expect(healthCollected && currencyCollected).toBe(false);
  });

  it('does not prevent multiple XP gems from being collected in same frame', () => {
    const sidearmId = createGunEntity(world);
    createPlayerEntity(world, { sidearmId });

    createXPGemEntity(world, { x: 0, y: 0, z: 0 }, sidearmId, 10, true);
    createXPGemEntity(world, { x: 0.1, y: 0, z: 0 }, sidearmId, 15, true);

    pickupSystem(world, defaultInput(), eventQueue, 1 / 60);

    const gun = world.getComponent<Gun>(sidearmId, 'Gun')!;
    expect(gun.xp).toBe(25);
    expect(world.query(['XPGem']).length).toBe(0);
  });
});

describe('Interact gate enforcement', () => {
  it('does not collect health/currency over many frames without interact', () => {
    createPlayerEntity(world, { hp: 70, maxHp: 100, currency: 5 });
    const hpId = createHealthPickupEntity(world, { x: 1, y: 0, z: 0 }, 30, true);
    const curId = createCurrencyPickupEntity(world, { x: 1, y: 0, z: 0 }, 10, true);

    for (let i = 0; i < 100; i++) {
      pickupSystem(world, defaultInput(), eventQueue, 1 / 60);
    }

    expect(world.hasEntity(hpId)).toBe(true);
    expect(world.hasEntity(curId)).toBe(true);
    const players = world.query(['PlayerTag']);
    const health = world.getComponent<Health>(players[0], 'Health')!;
    const player = world.getComponent<Player>(players[0], 'Player')!;
    expect(health.current).toBe(70);
    expect(player.currency).toBe(5);
  });
});

describe('Property-based tests', () => {
  it('XP gem fly speed moves gem closer to player each frame', () => {
    fc.assert(
      fc.property(
        fc.float({ min: 1, max: 100, noNaN: true }),
        fc.float({ min: 1, max: 100, noNaN: true }),
        (startX, startZ) => {
          const w = new World();
          const eq = new EventQueue();
          const sidearmId = createGunEntity(w);
          createPlayerEntity(w, { sidearmId });

          const gemId = createXPGemEntity(w, { x: startX, y: 0, z: startZ }, sidearmId, 10, true);
          const dt = 1 / 60;

          const initialDist = Math.sqrt(startX * startX + startZ * startZ);

          // Skip if already within collection threshold
          if (initialDist <= 0.5) return;

          pickupSystem(w, defaultInput(), eq, dt);

          // Either collected or moved closer
          if (!w.hasEntity(gemId)) return; // collected
          const pos = w.getComponent<Position>(gemId, 'Position')!;
          const newDist = Math.sqrt(pos.x * pos.x + pos.z * pos.z);
          expect(newDist).toBeLessThan(initialDist);
        },
      ),
    );
  });

  it('health healing never exceeds max', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 1, max: 200 }),
        fc.integer({ min: 0, max: 200 }),
        (currentHp, maxHp, healAmount) => {
          const adjustedCurrent = Math.min(currentHp, maxHp);
          const w = new World();
          const eq = new EventQueue();
          useAppStore.setState({ currentState: AppState.Gameplay, previousState: AppState.WeaponSelect });

          createPlayerEntity(w, { hp: adjustedCurrent, maxHp });
          createHealthPickupEntity(w, { x: 1, y: 0, z: 0 }, healAmount, true);

          pickupSystem(w, defaultInput({ interact: true }), eq, 1 / 60);

          const players = w.query(['PlayerTag', 'Health']);
          if (players.length === 0) return;
          const health = w.getComponent<Health>(players[0], 'Health')!;
          expect(health.current).toBeLessThanOrEqual(health.max);
          expect(health.current).toBeGreaterThanOrEqual(adjustedCurrent);
        },
      ),
    );
  });

  it('currency never decreases from pickup collection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000 }),
        fc.integer({ min: 0, max: 10000 }),
        (startCurrency, pickupAmount) => {
          const w = new World();
          const eq = new EventQueue();
          useAppStore.setState({ currentState: AppState.Gameplay, previousState: AppState.WeaponSelect });

          createPlayerEntity(w, { currency: startCurrency });
          createCurrencyPickupEntity(w, { x: 1, y: 0, z: 0 }, pickupAmount, true);

          pickupSystem(w, defaultInput({ interact: true }), eq, 1 / 60);

          const players = w.query(['PlayerTag', 'Player']);
          const player = w.getComponent<Player>(players[0], 'Player')!;
          expect(player.currency).toBe(startCurrency + pickupAmount);
        },
      ),
    );
  });
});
