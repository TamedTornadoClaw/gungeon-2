import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import {
  collisionResponseSystem,
  updateSpikeCooldowns,
} from '../src/systems/collisionResponseSystem';
import type { CollisionPair } from '../src/systems/collisionDetectionSystem';
import {
  EventType,
  EnemyType,
  AIBehaviorState,
  PickupType,
  HazardType,
  ColliderShape,
  WeaponSlot,
  GunType,
} from '../src/ecs/components';
import type {
  Position,
  Velocity,
  Health,
  Invincible,
  Player,
  Projectile,
  Enemy,
  AIState,
  EnemyShield,
  Pickup,
  XPGem,
  Hazard,
  DamageOverTime,
  SpeedModifier,
  SpawnZone,
  Collider,
  Door,
  Chest,
  Destructible,
} from '../src/ecs/components';
import type { DamageEvent, DoorInteractEvent } from '../src/gameloop/events';

// ── Helpers ─────────────────────────────────────────────────────────────────

let world: World;
let eventQueue: EventQueue;

beforeEach(() => {
  world = new World();
  eventQueue = new EventQueue();
});

function makePlayer(pos: { x: number; z: number } = { x: 5, z: 5 }): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
  world.addComponent<Health>(id, 'Health', { current: 100, max: 100, lastDamageSourceGunSlot: null });
  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: 0,
    longArmSlot: 0,
    activeSlot: WeaponSlot.LongArm,
    currency: 0,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
    isStatic: false, isTrigger: false,
  });
  world.addComponent(id, 'PlayerTag', {});
  world.addComponent(id, 'ProximityFlags', {
    nearPickup: false,
    nearChest: false,
    nearShop: false,
    nearStairs: false,
  });
  return id;
}

function makeChest(pos: { x: number; z: number }): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Chest>(id, 'Chest', { isOpen: false, gunType: GunType.Pistol });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
    isStatic: true, isTrigger: false,
  });
  world.addComponent(id, 'ChestTag', {});
  return id;
}

function makeWall(pos: { x: number; z: number } = { x: 6, z: 5 }): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
    isStatic: true, isTrigger: false,
  });
  world.addComponent(id, 'WallTag', {});
  return id;
}

function makeEnemy(
  pos: { x: number; z: number },
  enemyType: EnemyType = EnemyType.KnifeRusher,
  aiState: AIBehaviorState = AIBehaviorState.Idle,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
  world.addComponent<Health>(id, 'Health', { current: 50, max: 50, lastDamageSourceGunSlot: null });
  world.addComponent<Enemy>(id, 'Enemy', { enemyType, isMini: false, hasExploded: false });
  world.addComponent<AIState>(id, 'AIState', { state: aiState, target: null, attackCooldown: 0, stateTimer: 0 });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
    isStatic: false, isTrigger: false,
  });
  world.addComponent(id, 'EnemyTag', {});
  return id;
}

function makePlayerProjectile(
  pos: { x: number; z: number },
  vel: { x: number; z: number } = { x: 0, z: -10 },
  opts?: Partial<Projectile>,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Velocity>(id, 'Velocity', { x: vel.x, y: 0, z: vel.z });
  world.addComponent<Projectile>(id, 'Projectile', {
    owner: 1,
    sourceGunSlot: WeaponSlot.LongArm,
    damage: 15,
    isCritical: false,
    knockback: 0.5,
    piercingRemaining: 0,
    bouncesRemaining: 0,
    alreadyHit: [],
    isEnemyProjectile: false,
    ...opts,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 0.2, height: 0.2, depth: 0.2,
    isStatic: false, isTrigger: true,
  });
  world.addComponent(id, 'ProjectileTag', {});
  world.addComponent(id, 'PlayerProjectileTag', {});
  return id;
}

function makeEnemyProjectile(
  pos: { x: number; z: number },
  damage: number = 12,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 10 });
  world.addComponent<Projectile>(id, 'Projectile', {
    owner: 99,
    damage,
    isCritical: false,
    knockback: 0,
    piercingRemaining: 0,
    bouncesRemaining: 0,
    alreadyHit: [],
    isEnemyProjectile: true,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 0.2, height: 0.2, depth: 0.2,
    isStatic: false, isTrigger: true,
  });
  world.addComponent(id, 'ProjectileTag', {});
  world.addComponent(id, 'EnemyProjectileTag', {});
  return id;
}

function makeXPGem(pos: { x: number; z: number }): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Pickup>(id, 'Pickup', { pickupType: PickupType.XPGem });
  world.addComponent<XPGem>(id, 'XPGem', { sourceGunEntityId: 1, amount: 10, isFlying: false });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 0.5, height: 0.5, depth: 0.5,
    isStatic: false, isTrigger: true,
  });
  world.addComponent(id, 'PickupTag', {});
  return id;
}

function makeHazard(pos: { x: number; z: number }, hazardType: HazardType): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Hazard>(id, 'Hazard', { hazardType });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 2, height: 1, depth: 2,
    isStatic: true, isTrigger: true,
  });
  world.addComponent(id, 'HazardTag', {});
  return id;
}

function makeDoor(pos: { x: number; z: number }): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Door>(id, 'Door', { isOpen: false });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 2, height: 2, depth: 0.5,
    isStatic: true, isTrigger: false,
  });
  world.addComponent(id, 'DoorTag', {});
  return id;
}

function makeDestructible(pos: { x: number; z: number }, hp: number = 30): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<Destructible>(id, 'Destructible', { health: hp, maxHealth: hp });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
    isStatic: true, isTrigger: false,
  });
  world.addComponent(id, 'DestructibleTag', {});
  return id;
}

function makeSpawnZone(pos: { x: number; z: number }): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x: pos.x, y: 0, z: pos.z });
  world.addComponent<SpawnZone>(id, 'SpawnZone', {
    width: 10, height: 10,
    enemyTypes: [EnemyType.KnifeRusher],
    enemyCount: 3,
    activated: false,
    spawnedEnemies: [],
    cleared: false,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB, width: 10, height: 1, depth: 10,
    isStatic: true, isTrigger: true,
  });
  return id;
}

function pair(a: number, b: number, overlapX: number = 0.5, overlapY: number = 0.5): CollisionPair {
  const [entityA, entityB] = a < b ? [a, b] : [b, a];
  return { entityA, entityB, overlapX, overlapY };
}

function getDamageEvents(): DamageEvent[] {
  return eventQueue.consume(EventType.Damage);
}

function getDoorInteractEvents(): DoorInteractEvent[] {
  return eventQueue.consume(EventType.DoorInteract);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('CollisionResponseSystem', () => {
  // ── Player + Wall ─────────────────────────────────────────────────────

  describe('Player + Wall', () => {
    it('pushes player out along minimum overlap axis (Z smaller)', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const wall = makeWall({ x: 6, z: 5.5 });

      collisionResponseSystem([pair(player, wall, 0.5, 0.2)], world, eventQueue);

      const pos = world.getComponent<Position>(player, 'Position')!;
      expect(pos.x).toBe(5); // X unchanged
      expect(pos.z).toBe(5 - 0.2); // pushed along Z (min overlap), away from wall
    });

    it('pushes player out along X when X is minimum overlap', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const wall = makeWall({ x: 6, z: 5 });

      collisionResponseSystem([pair(player, wall, 0.2, 0.5)], world, eventQueue);

      const pos = world.getComponent<Position>(player, 'Position')!;
      expect(pos.x).toBe(5 - 0.2);
      expect(pos.z).toBe(5);
    });

    it('pushes along X deterministically when overlaps are equal', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const wall = makeWall({ x: 6, z: 5 });

      collisionResponseSystem([pair(player, wall, 0.3, 0.3)], world, eventQueue);

      const pos = world.getComponent<Position>(player, 'Position')!;
      // overlapX <= overlapY → push along X
      expect(pos.x).toBe(5 - 0.3);
      expect(pos.z).toBe(5);
    });
  });

  // ── Player + Enemy ────────────────────────────────────────────────────

  describe('Player + Enemy', () => {
    it('KnifeRusher in Attack state deals damage to non-invincible player', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const enemy = makeEnemy({ x: 6, z: 5 }, EnemyType.KnifeRusher, AIBehaviorState.Attack);

      collisionResponseSystem([pair(player, enemy, 0.5, 0.5)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(1);
      expect(events[0].target).toBe(player);
      expect(events[0].amount).toBeGreaterThan(0);
    });

    it('KnifeRusher in Chase state does NOT deal damage', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const enemy = makeEnemy({ x: 6, z: 5 }, EnemyType.KnifeRusher, AIBehaviorState.Chase);

      collisionResponseSystem([pair(player, enemy, 0.5, 0.5)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(0);
    });

    it('pushes player and enemy apart regardless of state', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const enemy = makeEnemy({ x: 5.5, z: 5 }, EnemyType.KnifeRusher, AIBehaviorState.Chase);

      collisionResponseSystem([pair(player, enemy, 0.5, 0.8)], world, eventQueue);

      const pPos = world.getComponent<Position>(player, 'Position')!;
      const ePos = world.getComponent<Position>(enemy, 'Position')!;
      // They should be pushed apart along X (min overlap axis)
      expect(pPos.x).toBeLessThan(5);
      expect(ePos.x).toBeGreaterThan(5.5);
    });

    it('does NOT damage invincible player even from Attack state', () => {
      const player = makePlayer({ x: 5, z: 5 });
      world.addComponent<Invincible>(player, 'Invincible', { remaining: 1.0 });
      const enemy = makeEnemy({ x: 6, z: 5 }, EnemyType.KnifeRusher, AIBehaviorState.Attack);

      collisionResponseSystem([pair(player, enemy, 0.5, 0.5)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(0);
    });
  });

  // ── Player + EnemyProjectile ──────────────────────────────────────────

  describe('Player + EnemyProjectile', () => {
    it('deals damage and destroys projectile', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const proj = makeEnemyProjectile({ x: 5, z: 5 }, 12);

      collisionResponseSystem([pair(player, proj, 0.1, 0.1)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(1);
      expect(events[0].target).toBe(player);
      expect(events[0].amount).toBe(12);
      expect(world.hasEntity(proj)).toBe(false);
    });

    it('destroys projectile but no damage when player is invincible', () => {
      const player = makePlayer({ x: 5, z: 5 });
      world.addComponent<Invincible>(player, 'Invincible', { remaining: 1.0 });
      const proj = makeEnemyProjectile({ x: 5, z: 5 }, 12);

      collisionResponseSystem([pair(player, proj, 0.1, 0.1)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(0);
      expect(world.hasEntity(proj)).toBe(false);
    });
  });

  // ── PlayerProjectile + Enemy ──────────────────────────────────────────

  describe('PlayerProjectile + Enemy', () => {
    it('deals damage, applies knockback, destroys projectile', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const proj = makePlayerProjectile({ x: 6, z: 5 }, { x: 10, z: 0 }, { owner: player, knockback: 2 });
      const enemy = makeEnemy({ x: 7, z: 5 });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(1);
      expect(events[0].target).toBe(enemy);
      expect(events[0].amount).toBe(15);
      expect(world.hasEntity(proj)).toBe(false);

      // Knockback applied
      const kb = world.getComponent(enemy, 'Knockback') as { force: number; directionX: number; directionY: number };
      expect(kb).toBeDefined();
      expect(kb.force).toBe(2);
    });

    it('shield blocks frontal hit', () => {
      const enemy = makeEnemy({ x: 10, z: 5 });
      world.addComponent<EnemyShield>(enemy, 'EnemyShield', {
        health: 50, maxHealth: 50, facingAngle: 0, coverageArc: Math.PI / 4,
      });
      // Shield faces angle 0 (+z direction). Bullet approaches from +z (in front of shield).
      const proj = makePlayerProjectile({ x: 10, z: 6 }, { x: 0, z: -10 }, { damage: 15 });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      // No damage event for the enemy health — shield absorbed
      const events = getDamageEvents();
      expect(events.length).toBe(0);

      const shield = world.getComponent<EnemyShield>(enemy, 'EnemyShield')!;
      expect(shield.health).toBe(35); // 50 - 15
    });

    it('flanking hit bypasses shield', () => {
      const enemy = makeEnemy({ x: 10, z: 5 });
      world.addComponent<EnemyShield>(enemy, 'EnemyShield', {
        health: 50, maxHealth: 50, facingAngle: 0, coverageArc: Math.PI / 4,
      });
      // Bullet coming from behind (-z direction, shield faces +z)
      const proj = makePlayerProjectile({ x: 10, z: 4 }, { x: 0, z: 10 });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(1);
      expect(events[0].target).toBe(enemy);

      const shield = world.getComponent<EnemyShield>(enemy, 'EnemyShield')!;
      expect(shield.health).toBe(50); // untouched
    });

    it('shield destroyed by overkill damage — no pass-through', () => {
      const enemy = makeEnemy({ x: 10, z: 5 });
      world.addComponent<EnemyShield>(enemy, 'EnemyShield', {
        health: 5, maxHealth: 5, facingAngle: 0, coverageArc: Math.PI / 4,
      });
      // Frontal hit — bullet from +z, shield faces +z
      const proj = makePlayerProjectile({ x: 10, z: 6 }, { x: 0, z: -10 }, { damage: 20 });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      // Shield removed
      expect(world.hasComponent(enemy, 'EnemyShield')).toBe(false);
      // No damage event (damage went to shield, no pass-through)
      const events = getDamageEvents();
      expect(events.length).toBe(0);
    });
  });

  // ── Piercing ──────────────────────────────────────────────────────────

  describe('Piercing projectiles', () => {
    it('piercing bullet survives enemy hit and adds to alreadyHit', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, { piercingRemaining: 2 });
      const enemy = makeEnemy({ x: 6, z: 5 });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(true);
      const projData = world.getComponent<Projectile>(proj, 'Projectile')!;
      expect(projData.piercingRemaining).toBe(1);
      expect(projData.alreadyHit).toContain(enemy);

      const events = getDamageEvents();
      expect(events.length).toBe(1);
    });

    it('piercing bullet skips already-hit enemy', () => {
      const enemy = makeEnemy({ x: 6, z: 5 });
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, {
        piercingRemaining: 1,
        alreadyHit: [enemy],
      });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(0);
      const projData = world.getComponent<Projectile>(proj, 'Projectile')!;
      expect(projData.piercingRemaining).toBe(1); // unchanged
    });

    it('piercing=0 bullet hitting new enemy is destroyed', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, { piercingRemaining: 0 });
      const enemy = makeEnemy({ x: 6, z: 5 });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(false);
      expect(getDamageEvents().length).toBe(1);
    });
  });

  // ── Bouncing ──────────────────────────────────────────────────────────

  describe('Bouncing projectiles', () => {
    it('bouncing bullet reflects off wall instead of being destroyed', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 5 }, { bouncesRemaining: 2 });
      const wall = makeWall({ x: 6, z: 5 });

      // overlapX < overlapY → wall normal along X
      collisionResponseSystem([pair(proj, wall, 0.1, 0.5)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(true);
      const vel = world.getComponent<Velocity>(proj, 'Velocity')!;
      expect(vel.x).toBe(-10); // reflected
      expect(vel.z).toBe(5); // unchanged

      const projData = world.getComponent<Projectile>(proj, 'Projectile')!;
      expect(projData.bouncesRemaining).toBe(1);
    });

    it('bouncing=0 bullet hitting wall is destroyed', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, { bouncesRemaining: 0 });
      const wall = makeWall({ x: 6, z: 5 });

      collisionResponseSystem([pair(proj, wall, 0.1, 0.5)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(false);
    });

    it('bouncing bullet reflects away from enemy center on hit', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, { bouncesRemaining: 1 });
      const enemy = makeEnemy({ x: 6, z: 5 });

      collisionResponseSystem([pair(proj, enemy, 0.1, 0.1)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(true);
      const vel = world.getComponent<Velocity>(proj, 'Velocity')!;
      // Should reflect away from enemy center (enemy at x:6, proj at x:5, so reflected in -x)
      expect(vel.x).toBeLessThan(0);

      const projData = world.getComponent<Projectile>(proj, 'Projectile')!;
      expect(projData.bouncesRemaining).toBe(0);
      expect(projData.alreadyHit).toContain(enemy);
      expect(getDamageEvents().length).toBe(1);
    });
  });

  // ── PlayerProjectile + Player (self-immunity) ─────────────────────────

  describe('PlayerProjectile + Player (self-immunity)', () => {
    it('player is immune to own bouncing bullets', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: -10, z: 0 }, {
        owner: player, bouncesRemaining: 1,
      });

      collisionResponseSystem([pair(player, proj, 0.1, 0.1)], world, eventQueue);

      expect(getDamageEvents().length).toBe(0);
      expect(world.hasEntity(proj)).toBe(true); // bullet continues
    });
  });

  // ── Player + Pickup ───────────────────────────────────────────────────

  describe('Player + Pickup', () => {
    it('XPGem sets isFlying=true', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const gem = makeXPGem({ x: 5, z: 5 });

      collisionResponseSystem([pair(player, gem, 0.1, 0.1)], world, eventQueue);

      const xpGem = world.getComponent<XPGem>(gem, 'XPGem')!;
      expect(xpGem.isFlying).toBe(true);
    });
  });

  // ── Player + Hazard ───────────────────────────────────────────────────

  describe('Player + Hazard', () => {
    it('fire applies DamageOverTime', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const hazard = makeHazard({ x: 5, z: 5 }, HazardType.Fire);

      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);

      const dot = world.getComponent<DamageOverTime>(player, 'DamageOverTime')!;
      expect(dot).toBeDefined();
      expect(dot.damagePerSecond).toBe(10);
      expect(dot.refreshed).toBe(true);
    });

    it('fire refreshes existing DamageOverTime without stacking', () => {
      const player = makePlayer({ x: 5, z: 5 });
      world.addComponent<DamageOverTime>(player, 'DamageOverTime', {
        damagePerSecond: 10, sourceType: HazardType.Fire, refreshed: false,
      });
      const hazard = makeHazard({ x: 5, z: 5 }, HazardType.Fire);

      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);

      const dot = world.getComponent<DamageOverTime>(player, 'DamageOverTime')!;
      expect(dot.refreshed).toBe(true);
      expect(dot.damagePerSecond).toBe(10); // not doubled
    });

    it('spikes deal instant damage with cooldown', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const hazard = makeHazard({ x: 5, z: 5 }, HazardType.Spikes);

      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(1);
      expect(events[0].target).toBe(player);
      expect(events[0].amount).toBe(20);
    });

    it('spikes respect cooldown — no damage while on cooldown', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const hazard = makeHazard({ x: 5, z: 5 }, HazardType.Spikes);

      // First hit
      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);
      getDamageEvents(); // consume

      // Tick cooldown partially (0.5s of 1.0s)
      updateSpikeCooldowns(0.5, world);

      // Second hit — should be blocked
      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);
      expect(getDamageEvents().length).toBe(0);

      // Tick remaining cooldown
      updateSpikeCooldowns(0.6, world);

      // Third hit — should work
      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);
      expect(getDamageEvents().length).toBe(1);
    });

    it('water applies SpeedModifier', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const hazard = makeHazard({ x: 5, z: 5 }, HazardType.Water);

      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);

      const mod = world.getComponent<SpeedModifier>(player, 'SpeedModifier')!;
      expect(mod).toBeDefined();
      expect(mod.multiplier).toBe(0.5);
      expect(mod.refreshed).toBe(true);
    });

    it('water refreshes existing SpeedModifier', () => {
      const player = makePlayer({ x: 5, z: 5 });
      world.addComponent<SpeedModifier>(player, 'SpeedModifier', {
        multiplier: 0.5, refreshed: false,
      });
      const hazard = makeHazard({ x: 5, z: 5 }, HazardType.Water);

      collisionResponseSystem([pair(player, hazard, 0.5, 0.5)], world, eventQueue);

      const mod = world.getComponent<SpeedModifier>(player, 'SpeedModifier')!;
      expect(mod.refreshed).toBe(true);
    });

    it('invincible player ignores hazards', () => {
      const player = makePlayer({ x: 5, z: 5 });
      world.addComponent<Invincible>(player, 'Invincible', { remaining: 1 });
      const fire = makeHazard({ x: 5, z: 5 }, HazardType.Fire);
      const spikes = makeHazard({ x: 5, z: 6 }, HazardType.Spikes);

      collisionResponseSystem([
        pair(player, fire, 0.5, 0.5),
        pair(player, spikes, 0.5, 0.5),
      ], world, eventQueue);

      expect(world.hasComponent(player, 'DamageOverTime')).toBe(false);
      expect(getDamageEvents().length).toBe(0);
    });
  });

  // ── Player + Door ─────────────────────────────────────────────────────

  describe('Player + Door', () => {
    it('emits DoorInteractEvent', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const door = makeDoor({ x: 5, z: 6 });

      collisionResponseSystem([pair(player, door, 0.5, 0.5)], world, eventQueue);

      const events = getDoorInteractEvents();
      expect(events.length).toBe(1);
      expect(events[0].doorEntity).toBe(door);
    });
  });

  // ── Player + Chest ───────────────────────────────────────────────────

  describe('Player + Chest', () => {
    it('sets nearChest proximity flag on the player (aIsPlayer && bIsChest)', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const chest = makeChest({ x: 6, z: 5 });

      collisionResponseSystem([pair(player, chest, 0.5, 0.5)], world, eventQueue);

      const flags = world.getComponent<{ nearChest: boolean }>(player, 'ProximityFlags')!;
      expect(flags).toBeDefined();
      expect(flags.nearChest).toBe(true);
    });

    it('sets nearChest proximity flag on the player (bIsPlayer && aIsChest)', () => {
      const chest = makeChest({ x: 4, z: 5 });
      const player = makePlayer({ x: 5, z: 5 });

      collisionResponseSystem([pair(chest, player, 0.5, 0.5)], world, eventQueue);

      const flags = world.getComponent<{ nearChest: boolean }>(player, 'ProximityFlags')!;
      expect(flags).toBeDefined();
      expect(flags.nearChest).toBe(true);
    });
  });

  // ── Player + SpawnZone ────────────────────────────────────────────────

  describe('Player + SpawnZone', () => {
    it('activates spawn zone', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const zone = makeSpawnZone({ x: 5, z: 5 });

      collisionResponseSystem([pair(player, zone, 5, 5)], world, eventQueue);

      const sz = world.getComponent<SpawnZone>(zone, 'SpawnZone')!;
      expect(sz.activated).toBe(true);
    });

    it('does not re-activate already activated zone', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const zone = makeSpawnZone({ x: 5, z: 5 });
      const sz = world.getComponent<SpawnZone>(zone, 'SpawnZone')!;
      sz.activated = true;

      collisionResponseSystem([pair(player, zone, 5, 5)], world, eventQueue);

      expect(sz.activated).toBe(true); // still true, no side effects
    });
  });

  // ── EnemyProjectile + Wall ────────────────────────────────────────────

  describe('EnemyProjectile + Wall', () => {
    it('destroys enemy bullet on wall hit', () => {
      const proj = makeEnemyProjectile({ x: 5, z: 5 });
      const wall = makeWall({ x: 6, z: 5 });

      collisionResponseSystem([pair(proj, wall, 0.1, 0.5)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(false);
    });
  });

  // ── EnemyProjectile + Destructible ────────────────────────────────────

  describe('EnemyProjectile + Destructible', () => {
    it('destroys projectile but does NOT damage destructible', () => {
      const proj = makeEnemyProjectile({ x: 5, z: 5 });
      const dest = makeDestructible({ x: 6, z: 5 }, 30);

      collisionResponseSystem([pair(proj, dest, 0.1, 0.5)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(false);
      const d = world.getComponent<Destructible>(dest, 'Destructible')!;
      expect(d.health).toBe(30); // unchanged
      expect(getDamageEvents().length).toBe(0);
    });
  });

  // ── PlayerProjectile + Destructible ───────────────────────────────────

  describe('PlayerProjectile + Destructible', () => {
    it('emits damage event and destroys projectile', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, { damage: 15 });
      const dest = makeDestructible({ x: 6, z: 5 }, 30);

      collisionResponseSystem([pair(proj, dest, 0.1, 0.5)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(false);
      const events = getDamageEvents();
      expect(events.length).toBe(1);
      expect(events[0].target).toBe(dest);
      expect(events[0].amount).toBe(15);
    });

    it('piercing bullet survives destructible hit', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, { piercingRemaining: 1 });
      const dest = makeDestructible({ x: 6, z: 5 }, 30);

      collisionResponseSystem([pair(proj, dest, 0.1, 0.5)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(true);
      const projData = world.getComponent<Projectile>(proj, 'Projectile')!;
      expect(projData.piercingRemaining).toBe(0);
    });
  });

  // ── PlayerProjectile + Wall ───────────────────────────────────────────

  describe('PlayerProjectile + Wall (no bounce)', () => {
    it('destroys bullet', () => {
      const proj = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 }, { bouncesRemaining: 0 });
      const wall = makeWall({ x: 6, z: 5 });

      collisionResponseSystem([pair(proj, wall, 0.1, 0.5)], world, eventQueue);

      expect(world.hasEntity(proj)).toBe(false);
    });
  });

  // ── Enemy + Wall ──────────────────────────────────────────────────────

  describe('Enemy + Wall', () => {
    it('pushes enemy out of wall', () => {
      const enemy = makeEnemy({ x: 5.5, z: 5 });
      const wall = makeWall({ x: 6, z: 5 });

      collisionResponseSystem([pair(enemy, wall, 0.3, 0.8)], world, eventQueue);

      const pos = world.getComponent<Position>(enemy, 'Position')!;
      expect(pos.x).toBe(5.5 - 0.3);
    });
  });

  // ── Enemy + Enemy ─────────────────────────────────────────────────────

  describe('Enemy + Enemy', () => {
    it('pushes apart with no damage', () => {
      const e1 = makeEnemy({ x: 5, z: 5 });
      const e2 = makeEnemy({ x: 5.5, z: 5 });

      collisionResponseSystem([pair(e1, e2, 0.4, 0.8)], world, eventQueue);

      const p1 = world.getComponent<Position>(e1, 'Position')!;
      const p2 = world.getComponent<Position>(e2, 'Position')!;
      expect(p1.x).toBeLessThan(5);
      expect(p2.x).toBeGreaterThan(5.5);
      expect(getDamageEvents().length).toBe(0);
    });
  });

  // ── SuicideBomber ─────────────────────────────────────────────────────

  describe('SuicideBomber contact explosion', () => {
    it('sets health=0, hasExploded=true, damages nearby entities', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const bomber = makeEnemy({ x: 5.5, z: 5 }, EnemyType.SuicideBomber, AIBehaviorState.Attack);
      // Another enemy within explosion radius
      const nearbyEnemy = makeEnemy({ x: 7, z: 5 });

      collisionResponseSystem([pair(player, bomber, 0.5, 0.5)], world, eventQueue);

      const bomberEnemy = world.getComponent<Enemy>(bomber, 'Enemy')!;
      expect(bomberEnemy.hasExploded).toBe(true);
      const bomberHealth = world.getComponent<Health>(bomber, 'Health')!;
      expect(bomberHealth.current).toBe(0);

      const events = getDamageEvents();
      // Should damage player and nearby enemy
      const targets = events.map(e => e.target);
      expect(targets).toContain(player);
      expect(targets).toContain(nearbyEnemy);
    });

    it('does not damage invincible player in explosion', () => {
      const player = makePlayer({ x: 5, z: 5 });
      world.addComponent<Invincible>(player, 'Invincible', { remaining: 1 });
      const bomber = makeEnemy({ x: 5.5, z: 5 }, EnemyType.SuicideBomber, AIBehaviorState.Attack);
      const nearbyEnemy = makeEnemy({ x: 7, z: 5 });

      collisionResponseSystem([pair(player, bomber, 0.5, 0.5)], world, eventQueue);

      const events = getDamageEvents();
      const targets = events.map(e => e.target);
      expect(targets).not.toContain(player);
      expect(targets).toContain(nearbyEnemy);
    });

    it('does not damage entities outside explosion radius', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const bomber = makeEnemy({ x: 5.5, z: 5 }, EnemyType.SuicideBomber, AIBehaviorState.Attack);
      // Far-away enemy (distance > 3.0 explosion radius)
      const farEnemy = makeEnemy({ x: 20, z: 20 });

      collisionResponseSystem([pair(player, bomber, 0.5, 0.5)], world, eventQueue);

      const events = getDamageEvents();
      const targets = events.map(e => e.target);
      expect(targets).not.toContain(farEnemy);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('skips pair when entity has been destroyed earlier in same frame', () => {
      const proj1 = makePlayerProjectile({ x: 5, z: 5 }, { x: 10, z: 0 });
      const enemy1 = makeEnemy({ x: 6, z: 5 });
      const enemy2 = makeEnemy({ x: 7, z: 5 });

      // proj1 will be destroyed by first pair, second pair should be skipped
      collisionResponseSystem([
        pair(proj1, enemy1, 0.1, 0.1),
        pair(proj1, enemy2, 0.1, 0.1),
      ], world, eventQueue);

      const events = getDamageEvents();
      expect(events.length).toBe(1); // only first hit
    });

    it('fire + water hazards simultaneously apply both effects', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const fire = makeHazard({ x: 5, z: 5 }, HazardType.Fire);
      const water = makeHazard({ x: 5, z: 6 }, HazardType.Water);

      collisionResponseSystem([
        pair(player, fire, 0.5, 0.5),
        pair(player, water, 0.5, 0.5),
      ], world, eventQueue);

      expect(world.hasComponent(player, 'DamageOverTime')).toBe(true);
      expect(world.hasComponent(player, 'SpeedModifier')).toBe(true);
    });

    it('pair with zero overlap still processes trigger events', () => {
      const player = makePlayer({ x: 5, z: 5 });
      const gem = makeXPGem({ x: 5, z: 5 });

      collisionResponseSystem([pair(player, gem, 0, 0)], world, eventQueue);

      const xpGem = world.getComponent<XPGem>(gem, 'XPGem')!;
      expect(xpGem.isFlying).toBe(true);
    });
  });

  // ── Property-based tests ──────────────────────────────────────────────

  describe('Property-based tests', () => {
    it('invincible entities never receive damage events', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (projDamage) => {
            const w = new World();
            const eq = new EventQueue();

            const playerId = w.createEntity();
            w.addComponent<Position>(playerId, 'Position', { x: 0, y: 0, z: 0 });
            w.addComponent<Velocity>(playerId, 'Velocity', { x: 0, y: 0, z: 0 });
            w.addComponent<Health>(playerId, 'Health', { current: 100, max: 100, lastDamageSourceGunSlot: null });
            w.addComponent<Invincible>(playerId, 'Invincible', { remaining: 1 });
            w.addComponent(playerId, 'PlayerTag', {});
            w.addComponent<Collider>(playerId, 'Collider', {
              type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
              isStatic: false, isTrigger: false,
            });

            const projId = w.createEntity();
            w.addComponent<Position>(projId, 'Position', { x: 0, y: 0, z: 0 });
            w.addComponent<Velocity>(projId, 'Velocity', { x: 0, y: 0, z: 10 });
            w.addComponent<Projectile>(projId, 'Projectile', {
              owner: 99, damage: projDamage, isCritical: false,
              knockback: 0, piercingRemaining: 0, bouncesRemaining: 0,
              alreadyHit: [], isEnemyProjectile: true,
            });
            w.addComponent(projId, 'EnemyProjectileTag', {});
            w.addComponent<Collider>(projId, 'Collider', {
              type: ColliderShape.AABB, width: 0.2, height: 0.2, depth: 0.2,
              isStatic: false, isTrigger: true,
            });

            const p: CollisionPair = {
              entityA: Math.min(playerId, projId),
              entityB: Math.max(playerId, projId),
              overlapX: 0.1,
              overlapY: 0.1,
            };

            collisionResponseSystem([p], w, eq);

            const events = eq.consume(EventType.Damage);
            return events.length === 0;
          },
        ),
      );
    });

    it('push-out always resolves overlap (separates entities)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.01), max: Math.fround(5), noNaN: true }),
          fc.float({ min: Math.fround(0.01), max: Math.fround(5), noNaN: true }),
          (overlapX, overlapY) => {
            const w = new World();
            const eq = new EventQueue();

            const playerId = w.createEntity();
            w.addComponent<Position>(playerId, 'Position', { x: 5, y: 0, z: 5 });
            w.addComponent<Velocity>(playerId, 'Velocity', { x: 0, y: 0, z: 0 });
            w.addComponent<Health>(playerId, 'Health', { current: 100, max: 100, lastDamageSourceGunSlot: null });
            w.addComponent(playerId, 'PlayerTag', {});
            w.addComponent<Collider>(playerId, 'Collider', {
              type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
              isStatic: false, isTrigger: false,
            });

            const wallId = w.createEntity();
            w.addComponent<Position>(wallId, 'Position', { x: 6, y: 0, z: 6 });
            w.addComponent(wallId, 'WallTag', {});
            w.addComponent<Collider>(wallId, 'Collider', {
              type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
              isStatic: true, isTrigger: false,
            });

            const p: CollisionPair = {
              entityA: Math.min(playerId, wallId),
              entityB: Math.max(playerId, wallId),
              overlapX,
              overlapY,
            };

            collisionResponseSystem([p], w, eq);

            const playerPos = w.getComponent<Position>(playerId, 'Position')!;
            // Player should have moved
            if (overlapX <= overlapY) {
              return playerPos.x !== 5;
            } else {
              return playerPos.z !== 5;
            }
          },
        ),
      );
    });

    it('piercing bullet never hits same entity twice', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (piercing) => {
            const w = new World();
            const eq = new EventQueue();

            const projId = w.createEntity();
            w.addComponent<Position>(projId, 'Position', { x: 0, y: 0, z: 0 });
            w.addComponent<Velocity>(projId, 'Velocity', { x: 10, y: 0, z: 0 });
            w.addComponent<Projectile>(projId, 'Projectile', {
              owner: 1, damage: 10, isCritical: false,
              knockback: 0, piercingRemaining: piercing, bouncesRemaining: 0,
              alreadyHit: [], isEnemyProjectile: false,
            });
            w.addComponent(projId, 'PlayerProjectileTag', {});
            w.addComponent<Collider>(projId, 'Collider', {
              type: ColliderShape.AABB, width: 0.2, height: 0.2, depth: 0.2,
              isStatic: false, isTrigger: true,
            });

            const enemyId = w.createEntity();
            w.addComponent<Position>(enemyId, 'Position', { x: 1, y: 0, z: 0 });
            w.addComponent<Velocity>(enemyId, 'Velocity', { x: 0, y: 0, z: 0 });
            w.addComponent<Health>(enemyId, 'Health', { current: 100, max: 100, lastDamageSourceGunSlot: null });
            w.addComponent<Enemy>(enemyId, 'Enemy', { enemyType: EnemyType.KnifeRusher, isMini: false, hasExploded: false });
            w.addComponent<AIState>(enemyId, 'AIState', { state: AIBehaviorState.Idle, target: null, attackCooldown: 0, stateTimer: 0 });
            w.addComponent(enemyId, 'EnemyTag', {});
            w.addComponent<Collider>(enemyId, 'Collider', {
              type: ColliderShape.AABB, width: 1, height: 1, depth: 1,
              isStatic: false, isTrigger: false,
            });

            const p: CollisionPair = {
              entityA: Math.min(projId, enemyId),
              entityB: Math.max(projId, enemyId),
              overlapX: 0.1,
              overlapY: 0.1,
            };

            // First hit
            collisionResponseSystem([p], w, eq);
            const firstEvents = eq.consume(EventType.Damage);

            // Second hit (same pair again)
            collisionResponseSystem([p], w, eq);
            const secondEvents = eq.consume(EventType.Damage);

            return firstEvents.length === 1 && secondEvents.length === 0;
          },
        ),
      );
    });
  });
});
