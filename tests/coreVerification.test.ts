/**
 * Core Systems and Rendering Verification — Integration Tests
 *
 * Verifies that dungeon generation produces entities, the player entity
 * exists with required components, the game loop can run simulation frames,
 * the movement system moves entities, and collision detection produces
 * collision events.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/ecs/world';
import {
  GunType,
  EnemyType,
  ColliderShape,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  Position,
  PreviousPosition,
  Velocity,
  Health,
  Player,
  Collider,
  Gun,
} from '../src/ecs/components';
import {
  createPlayer,
  createEnemy,
  createWall,
} from '../src/ecs/factories';
import { generateDungeon } from '../src/dungeon/generator';
import { createDungeonEntities } from '../src/dungeon/dungeonEntityCreator';
import { movementSystem } from '../src/systems/movementSystem';
import {
  collisionDetectionSystem,
  rebuildStatics,
  resetCollisionState,
} from '../src/systems/collisionDetectionSystem';
import type { CollisionEntity } from '../src/systems/collisionDetectionSystem';

describe('Core Verification', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    resetCollisionState();
  });

  describe('Dungeon generation produces entities', () => {
    it('generates dungeon data with rooms and corridors', () => {
      const dungeon = generateDungeon(42, 1);
      expect(dungeon.rooms.length).toBeGreaterThan(0);
      expect(dungeon.corridors.length).toBeGreaterThan(0);
      expect(dungeon.playerStart).toBeDefined();
      expect(dungeon.stairsPosition).toBeDefined();
    });

    it('creates entities from dungeon data', () => {
      const dungeon = generateDungeon(42, 1);
      createDungeonEntities(world, dungeon, 1);

      expect(result.wallIds.length).toBeGreaterThan(0);
      expect(result.floorIds.length).toBeGreaterThan(0);
      expect(result.spawnZoneIds.length).toBeGreaterThan(0);

      // Verify wall entities have Position and Collider
      for (const wallId of result.wallIds) {
        expect(world.hasComponent(wallId, 'Position')).toBe(true);
        expect(world.hasComponent(wallId, 'Collider')).toBe(true);
        expect(world.hasComponent(wallId, 'WallTag')).toBe(true);
      }
    });

    it('generates different dungeons for different seeds', () => {
      const dungeon1 = generateDungeon(1, 1);
      const dungeon2 = generateDungeon(999, 1);

      const pos1 = dungeon1.playerStart;
      const pos2 = dungeon2.playerStart;

      // Different seeds should produce different layouts
      const sameLaout =
        pos1.x === pos2.x && pos1.z === pos2.z &&
        dungeon1.rooms.length === dungeon2.rooms.length;
      expect(sameLaout).toBe(false);
    });
  });

  describe('Player entity exists with required components', () => {
    it('creates player with all core components', () => {
      const playerId = createPlayer(world, { x: 0, y: 0, z: 0 }, GunType.AssaultRifle);

      expect(world.hasComponent(playerId, 'Position')).toBe(true);
      expect(world.hasComponent(playerId, 'PreviousPosition')).toBe(true);
      expect(world.hasComponent(playerId, 'Velocity')).toBe(true);
      expect(world.hasComponent(playerId, 'Rotation')).toBe(true);
      expect(world.hasComponent(playerId, 'Health')).toBe(true);
      expect(world.hasComponent(playerId, 'Player')).toBe(true);
      expect(world.hasComponent(playerId, 'Collider')).toBe(true);
      expect(world.hasComponent(playerId, 'Renderable')).toBe(true);
      expect(world.hasComponent(playerId, 'PlayerTag')).toBe(true);
      expect(world.hasComponent(playerId, 'DodgeRoll')).toBe(true);
    });

    it('player has two gun slots referencing valid gun entities', () => {
      const playerId = createPlayer(world, { x: 0, y: 0, z: 0 }, GunType.SMG);
      const player = world.getComponent<Player>(playerId, 'Player')!;

      expect(player.activeSlot).toBe(WeaponSlot.LongArm);

      // Both gun entities should exist and have Gun components
      expect(world.hasEntity(player.sidearmSlot)).toBe(true);
      expect(world.hasEntity(player.longArmSlot)).toBe(true);
      expect(world.hasComponent(player.sidearmSlot, 'Gun')).toBe(true);
      expect(world.hasComponent(player.longArmSlot, 'Gun')).toBe(true);

      // Sidearm should be Pistol
      const sidearmGun = world.getComponent<Gun>(player.sidearmSlot, 'Gun')!;
      expect(sidearmGun.gunType).toBe(GunType.Pistol);

      // Long arm should be what we requested
      const longArmGun = world.getComponent<Gun>(player.longArmSlot, 'Gun')!;
      expect(longArmGun.gunType).toBe(GunType.SMG);
    });

    it('player health is initialized to max', () => {
      const playerId = createPlayer(world, { x: 5, y: 0, z: 10 }, GunType.Shotgun);
      const health = world.getComponent<Health>(playerId, 'Health')!;

      expect(health.current).toBe(health.max);
      expect(health.current).toBeGreaterThan(0);
    });
  });

  describe('Game loop can run simulation frames', () => {
    it('movement system processes entities over multiple frames', () => {
      const playerId = createPlayer(world, { x: 0, y: 0, z: 0 }, GunType.Pistol);

      // Give the player velocity
      const vel = world.getComponent<Velocity>(playerId, 'Velocity')!;
      vel.x = 60; // 60 units/sec
      vel.z = 30;

      const dt = 1 / 60; // One fixed timestep

      // Run 60 frames (1 second of game time)
      for (let i = 0; i < 60; i++) {
        movementSystem(world, dt);
      }

      const pos = world.getComponent<Position>(playerId, 'Position')!;
      // After 1 second at 60 units/sec, x should be ~60
      expect(pos.x).toBeCloseTo(60, 0);
      expect(pos.z).toBeCloseTo(30, 0);
    });

    it('simulation frame updates multiple entities independently', () => {
      const player = createPlayer(world, { x: 0, y: 0, z: 0 }, GunType.Pistol);
      const enemy = createEnemy(world, EnemyType.KnifeRusher, { x: 10, y: 0, z: 10 }, 1, false);

      // Set velocities
      const playerVel = world.getComponent<Velocity>(player, 'Velocity')!;
      playerVel.x = 5;
      const enemyVel = world.getComponent<Velocity>(enemy, 'Velocity')!;
      enemyVel.x = -3;

      const dt = 1 / 60;
      movementSystem(world, dt);

      const playerPos = world.getComponent<Position>(player, 'Position')!;
      const enemyPos = world.getComponent<Position>(enemy, 'Position')!;

      expect(playerPos.x).toBeCloseTo(5 * dt, 5);
      expect(enemyPos.x).toBeCloseTo(10 + (-3) * dt, 5);
    });
  });

  describe('Movement system moves entities', () => {
    it('integrates velocity into position', () => {
      const id = world.createEntity();
      world.addComponent<Position>(id, 'Position', { x: 10, y: 0, z: 20 });
      world.addComponent<PreviousPosition>(id, 'PreviousPosition', { x: 10, y: 0, z: 20 });
      world.addComponent<Velocity>(id, 'Velocity', { x: 100, y: 0, z: -50 });

      const dt = 0.1;
      movementSystem(world, dt);

      const pos = world.getComponent<Position>(id, 'Position')!;
      expect(pos.x).toBeCloseTo(20, 5);  // 10 + 100*0.1
      expect(pos.z).toBeCloseTo(15, 5);  // 20 + (-50)*0.1
    });

    it('saves previous position before moving', () => {
      const id = world.createEntity();
      world.addComponent<Position>(id, 'Position', { x: 5, y: 0, z: 5 });
      world.addComponent<PreviousPosition>(id, 'PreviousPosition', { x: 0, y: 0, z: 0 });
      world.addComponent<Velocity>(id, 'Velocity', { x: 10, y: 0, z: 10 });

      movementSystem(world, 1);

      const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;
      // Previous should be where the entity was before this frame
      expect(prev.x).toBe(5);
      expect(prev.z).toBe(5);
    });

    it('does not move entities without velocity', () => {
      const id = world.createEntity();
      world.addComponent<Position>(id, 'Position', { x: 7, y: 0, z: 3 });
      // No Velocity component

      movementSystem(world, 1 / 60);

      const pos = world.getComponent<Position>(id, 'Position')!;
      expect(pos.x).toBe(7);
      expect(pos.z).toBe(3);
    });
  });

  describe('Collision detection produces collision events', () => {
    it('detects AABB overlap between two entities', () => {
      const entities: CollisionEntity[] = [
        {
          id: 1 as unknown as import('../src/types').EntityId,
          position: { x: 0, y: 0, z: 0 },
          collider: { type: ColliderShape.AABB, width: 2, height: 2, depth: 2, isStatic: false, isTrigger: false },
        },
        {
          id: 2 as unknown as import('../src/types').EntityId,
          position: { x: 1, y: 0, z: 0 },
          collider: { type: ColliderShape.AABB, width: 2, height: 2, depth: 2, isStatic: false, isTrigger: false },
        },
      ];

      const pairs = collisionDetectionSystem(entities);
      expect(pairs.length).toBe(1);
      expect(pairs[0].entityA).toBe(entities[0].id);
      expect(pairs[0].entityB).toBe(entities[1].id);
      expect(pairs[0].overlapX).toBeGreaterThan(0);
    });

    it('produces no collisions for separated entities', () => {
      const entities: CollisionEntity[] = [
        {
          id: 1 as unknown as import('../src/types').EntityId,
          position: { x: 0, y: 0, z: 0 },
          collider: { type: ColliderShape.AABB, width: 1, height: 1, depth: 1, isStatic: false, isTrigger: false },
        },
        {
          id: 2 as unknown as import('../src/types').EntityId,
          position: { x: 100, y: 0, z: 100 },
          collider: { type: ColliderShape.AABB, width: 1, height: 1, depth: 1, isStatic: false, isTrigger: false },
        },
      ];

      const pairs = collisionDetectionSystem(entities);
      expect(pairs.length).toBe(0);
    });

    it('detects player-wall collision using ECS entities', () => {
      const playerId = createPlayer(world, { x: 0, y: 0, z: 0 }, GunType.Pistol);
      const wallId = createWall(world, { x: 0.5, y: 0, z: 0 }, { x: 2, y: 2, z: 2 });

      const playerPos = world.getComponent<Position>(playerId, 'Position')!;
      const playerCol = world.getComponent<Collider>(playerId, 'Collider')!;
      const wallPos = world.getComponent<Position>(wallId, 'Position')!;
      const wallCol = world.getComponent<Collider>(wallId, 'Collider')!;

      const allEntities: CollisionEntity[] = [
        { id: playerId, position: playerPos, collider: playerCol },
        { id: wallId, position: wallPos, collider: wallCol },
      ];

      // Wall is static — must call rebuildStatics first so the system
      // caches static entities for dynamic-vs-static collision checks.
      rebuildStatics(allEntities);
      const pairs = collisionDetectionSystem(allEntities);
      expect(pairs.length).toBe(1);
    });

    it('detects player-enemy collision', () => {
      const playerId = createPlayer(world, { x: 5, y: 0, z: 5 }, GunType.Pistol);
      const enemyId = createEnemy(world, EnemyType.Rifleman, { x: 5.5, y: 0, z: 5 }, 1, false);

      const entitiesToCheck: CollisionEntity[] = [];
      for (const id of world.query(['Position', 'Collider'])) {
        const pos = world.getComponent<Position>(id, 'Position')!;
        const col = world.getComponent<Collider>(id, 'Collider')!;
        if (!col.isStatic) {
          entitiesToCheck.push({ id, position: pos, collider: col });
        }
      }

      const pairs = collisionDetectionSystem(entitiesToCheck);
      // Player and enemy are close enough to collide
      const hasPlayerEnemyPair = pairs.some(p =>
        (p.entityA === playerId && p.entityB === enemyId) ||
        (p.entityA === enemyId && p.entityB === playerId)
      );
      expect(hasPlayerEnemyPair).toBe(true);
    });
  });

  describe('Full integration: dungeon + player + simulation', () => {
    it('creates a dungeon, places player, runs frames, and detects collisions', () => {
      // Generate and populate dungeon
      const dungeon = generateDungeon(123, 1);
      createDungeonEntities(world, dungeon, 1);
      const playerId = createPlayer(world, dungeon.playerStart, GunType.AssaultRifle);

      // Verify world has entities
      expect(world.getEntityCount()).toBeGreaterThan(10);

      // Give player velocity toward a wall
      const vel = world.getComponent<Velocity>(playerId, 'Velocity')!;
      vel.x = 100;

      // Run several simulation frames
      const dt = 1 / 60;
      for (let i = 0; i < 10; i++) {
        movementSystem(world, dt);
      }

      // Player should have moved
      const pos = world.getComponent<Position>(playerId, 'Position')!;
      expect(pos.x).not.toBe(dungeon.playerStart.x);

      // Gather collision entities and run detection
      const collisionEntities: CollisionEntity[] = [];
      for (const id of world.query(['Position', 'Collider'])) {
        collisionEntities.push({
          id,
          position: world.getComponent<Position>(id, 'Position')!,
          collider: world.getComponent<Collider>(id, 'Collider')!,
        });
      }

      // There should be some entities to test
      expect(collisionEntities.length).toBeGreaterThan(5);

      // Run collision detection - this verifies the system doesn't crash
      // with real dungeon data
      const pairs = collisionDetectionSystem(collisionEntities);
      // Pairs may or may not exist depending on player position,
      // but the system should execute without error
      expect(Array.isArray(pairs)).toBe(true);
    });
  });
});
