import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { floorTransitionSystem } from '../src/systems/floorTransitionSystem';
import type { FloorState } from '../src/systems/floorTransitionSystem';
import {
  GunType,
  GunTrait,
  GunCategory,
  WeaponSlot,
  EnemyType,
  ColliderShape,
  MeshId,
  PickupType,
  HazardType,
  ParticleEffect,
} from '../src/ecs/components';
import type {
  Position,
  PreviousPosition,
  Player,
  Health,
  Gun,
  DodgeRoll,
  Stairs,
} from '../src/ecs/components';
import type { InputState } from '../src/input/inputManager';

function makeInput(overrides: Partial<InputState> = {}): InputState {
  return {
    moveX: 0,
    moveY: 0,
    aimWorldX: 0,
    aimWorldY: 0,
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    pointerLockLost: false,
    fireSidearm: false,
    fireLongArm: false,
    reload: false,
    dodgeRoll: false,
    interact: false,
    openUpgrade: false,
    pause: false,
    debugSpeedUp: false,
    debugSpeedDown: false,
    ...overrides,
  };
}

function makeFloorState(depth = 1, seed = 42): FloorState {
  return { currentDepth: depth, seed };
}

function createGunEntity(world: World, overrides: Partial<Gun> = {}): number {
  const id = world.createEntity();
  world.addComponent<Gun>(id, 'Gun', {
    gunType: GunType.Pistol,
    category: GunCategory.Sidearm,
    baseDamage: 15,
    baseFireRate: 3,
    baseMagazineSize: 12,
    baseReloadTime: 1,
    baseSpread: 0.02,
    baseProjectileCount: 1,
    baseProjectileSpeed: 30,
    baseKnockback: 0.5,
    baseCritChance: 0.05,
    baseCritMultiplier: 2,
    damage: 15,
    fireRate: 3,
    magazineSize: 12,
    reloadTime: 1,
    spread: 0.02,
    projectileCount: 1,
    projectileSpeed: 30,
    knockback: 0.5,
    critChance: 0.05,
    critMultiplier: 2,
    currentAmmo: 12,
    isReloading: false,
    reloadTimer: 0,
    fireCooldown: 0,
    fireRequested: false,
    traits: [GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
    ...overrides,
  });
  return id;
}

function createTestPlayer(
  world: World,
  nearStairs: boolean,
  playerOverrides: Partial<Player> = {},
  healthOverrides: Partial<Health> = {},
): { playerId: number; sidearmId: number; longArmId: number } {
  const sidearmId = createGunEntity(world);
  const longArmId = createGunEntity(world, {
    gunType: GunType.AssaultRifle,
    category: GunCategory.LongArm,
  });

  const playerId = world.createEntity();
  world.addComponent<Position>(playerId, 'Position', { x: 0, y: 0, z: 0 });
  world.addComponent<PreviousPosition>(playerId, 'PreviousPosition', { x: 0, y: 0, z: 0 });
  world.addComponent(playerId, 'Velocity', { x: 0, y: 0, z: 0 });
  world.addComponent(playerId, 'Rotation', { y: 0 });
  world.addComponent<Health>(playerId, 'Health', {
    current: 100,
    max: 100,
    lastDamageSourceGunSlot: null,
    ...healthOverrides,
  });
  world.addComponent<Player>(playerId, 'Player', {
    sidearmSlot: sidearmId,
    longArmSlot: longArmId,
    activeSlot: WeaponSlot.LongArm,
    currency: 0,
    ...playerOverrides,
  });
  world.addComponent<DodgeRoll>(playerId, 'DodgeRoll', {
    cooldownRemaining: 0,
    isRolling: false,
    rollTimer: 0,
    rollDirectionX: 0,
    rollDirectionY: 0,
  });
  world.addComponent(playerId, 'Collider', {
    type: ColliderShape.AABB,
    width: 1,
    height: 2,
    depth: 1,
    isStatic: false,
    isTrigger: false,
  });
  world.addComponent(playerId, 'Renderable', {
    meshId: MeshId.Player,
    visible: true,
    scale: 1,
  });
  world.addComponent(playerId, 'PlayerTag', {});
  world.addComponent(playerId, 'ProximityFlags', {
    nearPickup: false,
    nearChest: false,
    nearShop: false,
    nearDoor: false,
    nearStairs,
  });

  return { playerId, sidearmId, longArmId };
}

function addEnemies(world: World, count: number): number[] {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const id = world.createEntity();
    world.addComponent<Position>(id, 'Position', { x: i * 5, y: 0, z: i * 5 });
    world.addComponent(id, 'Health', { current: 50, max: 50, lastDamageSourceGunSlot: null });
    world.addComponent(id, 'Enemy', { enemyType: EnemyType.KnifeRusher, isMini: false, hasExploded: false });
    world.addComponent(id, 'EnemyTag', {});
    ids.push(id);
  }
  return ids;
}

function addWalls(world: World, count: number): number[] {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const id = world.createEntity();
    world.addComponent<Position>(id, 'Position', { x: i * 10, y: 0, z: 0 });
    world.addComponent(id, 'WallTag', {});
    ids.push(id);
  }
  return ids;
}

function addPickups(world: World, count: number): number[] {
  const ids: number[] = [];
  for (let i = 0; i < count; i++) {
    const id = world.createEntity();
    world.addComponent<Position>(id, 'Position', { x: i * 3, y: 0, z: i * 3 });
    world.addComponent(id, 'Pickup', { pickupType: PickupType.XPGem });
    world.addComponent(id, 'PickupTag', {});
    ids.push(id);
  }
  return ids;
}

function addStairs(world: World): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: 50, y: 0, z: 50 });
  world.addComponent<Stairs>(id, 'Stairs', { targetDepth: 2 });
  world.addComponent(id, 'StairsTag', {});
  return id;
}

describe('FloorTransitionSystem', () => {
  describe('basic floor transition', () => {
    it('destroys all entities except player and guns, increments depth, generates new dungeon', () => {
      const world = new World();
      const eq = new EventQueue();
      const { playerId, sidearmId, longArmId } = createTestPlayer(world, true);
      const enemies = addEnemies(world, 10);
      const walls = addWalls(world, 5);
      const pickups = addPickups(world, 2);
      const stairsId = addStairs(world);
      const floorState = makeFloorState(1);

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      // Depth incremented
      expect(floorState.currentDepth).toBe(2);

      // Player and guns survive
      expect(world.hasEntity(playerId)).toBe(true);
      expect(world.hasEntity(sidearmId)).toBe(true);
      expect(world.hasEntity(longArmId)).toBe(true);

      // Old entities destroyed
      for (const id of enemies) expect(world.hasEntity(id)).toBe(false);
      for (const id of walls) expect(world.hasEntity(id)).toBe(false);
      for (const id of pickups) expect(world.hasEntity(id)).toBe(false);
      expect(world.hasEntity(stairsId)).toBe(false);

      // New dungeon entities exist (walls, stairs, spawn zones, etc.)
      expect(world.getEntityCount()).toBeGreaterThan(3);
    });
  });

  describe('player state preservation', () => {
    it('preserves player health, currency, and gun state across transition', () => {
      const world = new World();
      const eq = new EventQueue();
      const sidearmId = createGunEntity(world, {
        xp: 300,
        traitLevels: [2, 1, 0],
        currentAmmo: 5,
        isReloading: true,
        reloadTimer: 0.7,
      });
      const longArmId = createGunEntity(world, {
        gunType: GunType.AssaultRifle,
        category: GunCategory.LongArm,
        xp: 150,
      });

      const playerId = world.createEntity();
      world.addComponent<Position>(playerId, 'Position', { x: 0, y: 0, z: 0 });
      world.addComponent<PreviousPosition>(playerId, 'PreviousPosition', { x: 0, y: 0, z: 0 });
      world.addComponent<Health>(playerId, 'Health', { current: 55, max: 100, lastDamageSourceGunSlot: null });
      world.addComponent<Player>(playerId, 'Player', {
        sidearmSlot: sidearmId,
        longArmSlot: longArmId,
        activeSlot: WeaponSlot.LongArm,
        currency: 42,
      });
      world.addComponent(playerId, 'PlayerTag', {});
      world.addComponent(playerId, 'ProximityFlags', {
        nearPickup: false, nearChest: false, nearShop: false, nearDoor: false, nearStairs: true,
      });
      addStairs(world);

      const floorState = makeFloorState(1);
      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      // Player state preserved
      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(55);
      expect(health.max).toBe(100);

      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.currency).toBe(42);

      // Gun state preserved
      const sidearm = world.getComponent<Gun>(sidearmId, 'Gun')!;
      expect(sidearm.xp).toBe(300);
      expect(sidearm.traitLevels).toEqual([2, 1, 0]);
      expect(sidearm.currentAmmo).toBe(5);
      expect(sidearm.isReloading).toBe(true);
      expect(sidearm.reloadTimer).toBe(0.7);

      const longArm = world.getComponent<Gun>(longArmId, 'Gun')!;
      expect(longArm.xp).toBe(150);
    });
  });

  describe('gun entity survival', () => {
    it('gun entities referenced by player survive transition', () => {
      const world = new World();
      const eq = new EventQueue();
      const { playerId, sidearmId, longArmId } = createTestPlayer(world, true);
      addStairs(world);

      const floorState = makeFloorState(1);
      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      expect(world.hasEntity(sidearmId)).toBe(true);
      expect(world.hasEntity(longArmId)).toBe(true);

      const player = world.getComponent<Player>(playerId, 'Player')!;
      expect(player.sidearmSlot).toBe(sidearmId);
      expect(player.longArmSlot).toBe(longArmId);

      // Gun components are still accessible
      expect(world.getComponent<Gun>(sidearmId, 'Gun')).toBeDefined();
      expect(world.getComponent<Gun>(longArmId, 'Gun')).toBeDefined();
    });
  });

  describe('no transition conditions', () => {
    it('does nothing when interact is not pressed', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, true);
      addEnemies(world, 3);
      addStairs(world);
      const floorState = makeFloorState(3);
      const entityCountBefore = world.getEntityCount();

      floorTransitionSystem(world, makeInput({ interact: false }), eq, floorState);

      expect(floorState.currentDepth).toBe(3);
      expect(world.getEntityCount()).toBe(entityCountBefore);
    });

    it('does nothing when nearStairs is false even if interact is pressed', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, false);
      addEnemies(world, 3);
      addStairs(world);
      const floorState = makeFloorState(3);
      const entityCountBefore = world.getEntityCount();

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      expect(floorState.currentDepth).toBe(3);
      expect(world.getEntityCount()).toBe(entityCountBefore);
    });
  });

  describe('boss floor transition', () => {
    it('generates boss floor when depth reaches bossFloorDepth (9 -> 10)', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, true);
      addStairs(world);
      const floorState = makeFloorState(9);

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      expect(floorState.currentDepth).toBe(10);

      // Should have a boss entity
      const bossEntities = world.query(['BossTag']);
      expect(bossEntities.length).toBeGreaterThanOrEqual(1);
    });

    it('does not generate stairs on boss floor', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, true);
      addStairs(world);
      const floorState = makeFloorState(9);

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      const stairsEntities = world.query(['StairsTag']);
      expect(stairsEntities).toHaveLength(0);
    });
  });

  describe('transition past boss floor', () => {
    it('generates non-boss floor when transitioning past depth 10', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, true);
      addStairs(world);
      const floorState = makeFloorState(10);

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      expect(floorState.currentDepth).toBe(11);

      // Should NOT have a boss entity
      const bossEntities = world.query(['BossTag']);
      expect(bossEntities).toHaveLength(0);

      // Should have stairs for the next floor
      const stairsEntities = world.query(['StairsTag']);
      expect(stairsEntities.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('first transition (depth 1 -> 2)', () => {
    it('increments to depth 2 and generates new dungeon', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, true);
      addStairs(world);
      const floorState = makeFloorState(1);

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      expect(floorState.currentDepth).toBe(2);
      // New dungeon entities exist
      expect(world.getEntityCount()).toBeGreaterThan(3);
    });
  });

  describe('all entity types cleaned up', () => {
    it('destroys all non-player entity types during transition', () => {
      const world = new World();
      const eq = new EventQueue();
      const { playerId, sidearmId, longArmId } = createTestPlayer(world, true);

      // Add every entity type
      addEnemies(world, 3);
      addWalls(world, 2);
      addPickups(world, 2);
      addStairs(world);

      // Hazard
      const hazardId = world.createEntity();
      world.addComponent(hazardId, 'Position', { x: 10, y: 0, z: 10 });
      world.addComponent(hazardId, 'Hazard', { hazardType: HazardType.Fire });
      world.addComponent(hazardId, 'HazardTag', {});

      // Door
      const doorId = world.createEntity();
      world.addComponent(doorId, 'Position', { x: 20, y: 0, z: 20 });
      world.addComponent(doorId, 'Door', { isOpen: false });
      world.addComponent(doorId, 'DoorTag', {});

      // Destructible
      const destructId = world.createEntity();
      world.addComponent(destructId, 'Position', { x: 30, y: 0, z: 30 });
      world.addComponent(destructId, 'Destructible', { health: 30, maxHealth: 30 });
      world.addComponent(destructId, 'DestructibleTag', {});

      // SpawnZone
      const szId = world.createEntity();
      world.addComponent(szId, 'Position', { x: 40, y: 0, z: 40 });
      world.addComponent(szId, 'SpawnZone', {
        width: 10, height: 10, enemyTypes: [EnemyType.KnifeRusher],
        enemyCount: 3, activated: false, spawnedEnemies: [], cleared: false,
      });

      // Particle
      const particleId = world.createEntity();
      world.addComponent(particleId, 'Position', { x: 15, y: 0, z: 15 });
      world.addComponent(particleId, 'Particle', {
        effect: ParticleEffect.MuzzleFlash,
        totalLifetime: 1, remainingLifetime: 0.5,
        sizeStart: 1, sizeEnd: 0, colorStart: 0xffffff, colorEnd: 0x000000,
        opacity: 1, gravity: 0,
      });

      // Projectile
      const projId = world.createEntity();
      world.addComponent(projId, 'Position', { x: 25, y: 0, z: 25 });
      world.addComponent(projId, 'ProjectileTag', {});

      const floorState = makeFloorState(1);
      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      // Only player + guns survive from original entities
      expect(world.hasEntity(playerId)).toBe(true);
      expect(world.hasEntity(sidearmId)).toBe(true);
      expect(world.hasEntity(longArmId)).toBe(true);

      expect(world.hasEntity(hazardId)).toBe(false);
      expect(world.hasEntity(doorId)).toBe(false);
      expect(world.hasEntity(destructId)).toBe(false);
      expect(world.hasEntity(szId)).toBe(false);
      expect(world.hasEntity(particleId)).toBe(false);
      expect(world.hasEntity(projId)).toBe(false);
    });
  });

  describe('rapid double-interact prevention', () => {
    it('clears nearStairs flag after transition to prevent double transition', () => {
      const world = new World();
      const eq = new EventQueue();
      const { playerId } = createTestPlayer(world, true);
      addStairs(world);
      const floorState = makeFloorState(1);

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      // nearStairs should be false after transition
      const flags = world.getComponent<{ nearStairs: boolean }>(playerId, 'ProximityFlags');
      expect(flags?.nearStairs).toBe(false);

      // Second call should not transition
      const depthAfterFirst = floorState.currentDepth;
      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);
      expect(floorState.currentDepth).toBe(depthAfterFirst);
    });
  });

  describe('player position reset', () => {
    it('moves player to new floor start position', () => {
      const world = new World();
      const eq = new EventQueue();
      const { playerId } = createTestPlayer(world, true);
      addStairs(world);
      const floorState = makeFloorState(1);

      // Player starts at origin
      const posBefore = world.getComponent<Position>(playerId, 'Position')!;
      expect(posBefore.x).toBe(0);
      expect(posBefore.z).toBe(0);

      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      // Player moved to new floor's start
      const posAfter = world.getComponent<Position>(playerId, 'Position')!;
      const prevPos = world.getComponent<PreviousPosition>(playerId, 'PreviousPosition')!;
      // Position and PreviousPosition should match
      expect(posAfter.x).toBe(prevPos.x);
      expect(posAfter.z).toBe(prevPos.z);
    });
  });

  describe('edge cases', () => {
    it('handles transition while player is mid-dodge-roll', () => {
      const world = new World();
      const eq = new EventQueue();

      const sidearmId = createGunEntity(world);
      const longArmId = createGunEntity(world, {
        gunType: GunType.AssaultRifle,
        category: GunCategory.LongArm,
      });

      const playerId = world.createEntity();
      world.addComponent<Position>(playerId, 'Position', { x: 0, y: 0, z: 0 });
      world.addComponent<PreviousPosition>(playerId, 'PreviousPosition', { x: 0, y: 0, z: 0 });
      world.addComponent<Health>(playerId, 'Health', { current: 100, max: 100, lastDamageSourceGunSlot: null });
      world.addComponent<Player>(playerId, 'Player', {
        sidearmSlot: sidearmId,
        longArmSlot: longArmId,
        activeSlot: WeaponSlot.LongArm,
        currency: 0,
      });
      world.addComponent<DodgeRoll>(playerId, 'DodgeRoll', {
        cooldownRemaining: 0,
        isRolling: true,
        rollTimer: 0.15,
        rollDirectionX: 1,
        rollDirectionY: 0,
      });
      world.addComponent(playerId, 'PlayerTag', {});
      world.addComponent(playerId, 'ProximityFlags', {
        nearPickup: false, nearChest: false, nearShop: false, nearDoor: false, nearStairs: true,
      });
      addStairs(world);

      const floorState = makeFloorState(1);
      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      // Dodge roll state preserved
      const roll = world.getComponent<DodgeRoll>(playerId, 'DodgeRoll')!;
      expect(roll.isRolling).toBe(true);
      expect(roll.rollTimer).toBe(0.15);
    });

    it('handles transition while gun is mid-reload', () => {
      const world = new World();
      const eq = new EventQueue();
      const sidearmId = createGunEntity(world, {
        isReloading: true,
        reloadTimer: 0.5,
        currentAmmo: 0,
      });
      const longArmId = createGunEntity(world, {
        gunType: GunType.AssaultRifle,
        category: GunCategory.LongArm,
      });

      const playerId = world.createEntity();
      world.addComponent<Position>(playerId, 'Position', { x: 0, y: 0, z: 0 });
      world.addComponent<PreviousPosition>(playerId, 'PreviousPosition', { x: 0, y: 0, z: 0 });
      world.addComponent<Health>(playerId, 'Health', { current: 100, max: 100, lastDamageSourceGunSlot: null });
      world.addComponent<Player>(playerId, 'Player', {
        sidearmSlot: sidearmId,
        longArmSlot: longArmId,
        activeSlot: WeaponSlot.LongArm,
        currency: 0,
      });
      world.addComponent(playerId, 'PlayerTag', {});
      world.addComponent(playerId, 'ProximityFlags', {
        nearPickup: false, nearChest: false, nearShop: false, nearDoor: false, nearStairs: true,
      });
      addStairs(world);

      const floorState = makeFloorState(1);
      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      const sidearm = world.getComponent<Gun>(sidearmId, 'Gun')!;
      expect(sidearm.isReloading).toBe(true);
      expect(sidearm.reloadTimer).toBe(0.5);
      expect(sidearm.currentAmmo).toBe(0);
    });

    it('player at 1 health survives transition', () => {
      const world = new World();
      const eq = new EventQueue();
      const { playerId } = createTestPlayer(world, true, {}, { current: 1 });
      addStairs(world);

      const floorState = makeFloorState(1);
      floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

      expect(world.hasEntity(playerId)).toBe(true);
      const health = world.getComponent<Health>(playerId, 'Health')!;
      expect(health.current).toBe(1);
    });

    it('handles transition with DamageOverTime and SpeedModifier on player', () => {
      const world = new World();
      const eq = new EventQueue();
      const { playerId } = createTestPlayer(world, true);
      addStairs(world);

      // Add modifiers from hazards
      world.addComponent(playerId, 'DamageOverTime', {
        damagePerSecond: 10,
        sourceType: HazardType.Fire,
        refreshed: false,
      });
      world.addComponent(playerId, 'SpeedModifier', {
        multiplier: 0.5,
        refreshed: false,
      });

      const floorState = makeFloorState(1);

      // Should not crash
      expect(() => {
        floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);
      }).not.toThrow();

      // Player survives with modifiers still attached
      expect(world.hasEntity(playerId)).toBe(true);
      expect(world.hasComponent(playerId, 'DamageOverTime')).toBe(true);
      expect(world.hasComponent(playerId, 'SpeedModifier')).toBe(true);
    });

    it('runs without error when no player exists', () => {
      const world = new World();
      const eq = new EventQueue();
      const floorState = makeFloorState(1);

      expect(() => {
        floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);
      }).not.toThrow();
      expect(floorState.currentDepth).toBe(1);
    });
  });

  describe('property-based', () => {
    it('depth always increments by exactly 1 on successful transition', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (startDepth) => {
            const world = new World();
            const eq = new EventQueue();
            createTestPlayer(world, true);
            addStairs(world);
            const floorState = makeFloorState(startDepth);

            floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

            expect(floorState.currentDepth).toBe(startDepth + 1);
          },
        ),
      );
    });

    it('player and gun entities always survive transition regardless of depth', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (startDepth) => {
            const world = new World();
            const eq = new EventQueue();
            const { playerId, sidearmId, longArmId } = createTestPlayer(world, true);
            addStairs(world);
            const floorState = makeFloorState(startDepth);

            floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);

            expect(world.hasEntity(playerId)).toBe(true);
            expect(world.hasEntity(sidearmId)).toBe(true);
            expect(world.hasEntity(longArmId)).toBe(true);
          },
        ),
      );
    });

    it('no transition occurs when interact is false regardless of nearStairs', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          fc.integer({ min: 1, max: 50 }),
          (nearStairs, depth) => {
            const world = new World();
            const eq = new EventQueue();
            createTestPlayer(world, nearStairs);
            addStairs(world);
            const floorState = makeFloorState(depth);

            floorTransitionSystem(world, makeInput({ interact: false }), eq, floorState);

            expect(floorState.currentDepth).toBe(depth);
          },
        ),
      );
    });

    it('enemy stat scaling does not produce Infinity or NaN at extreme depths', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 999, max: 1000 }),
          (startDepth) => {
            const world = new World();
            const eq = new EventQueue();
            createTestPlayer(world, true);
            addStairs(world);
            const floorState = makeFloorState(startDepth);

            expect(() => {
              floorTransitionSystem(world, makeInput({ interact: true }), eq, floorState);
            }).not.toThrow();

            expect(floorState.currentDepth).toBe(startDepth + 1);
          },
        ),
      );
    });
  });
});
