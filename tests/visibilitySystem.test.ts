import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '../src/ecs/world';
import { visibilitySystem, rebuildDungeonTree, resetVisibilityState } from '../src/systems/visibilitySystem';
import { rebuildStatics, resetCollisionState } from '../src/systems/collisionDetectionSystem';
import {
  ColliderShape,
  MeshId,
  AIBehaviorState,
  EnemyType,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  Position,
  Renderable,
  Collider,
  Health,
  Enemy,
  AIState,
  Player,
  DodgeRoll,
} from '../src/ecs/components';
import type { CollisionEntity } from '../src/systems/collisionDetectionSystem';

// ── Helpers ──────────────────────────────────────────────────────────────

function createPlayer(world: World, x: number, z: number): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y: 0, z });
  world.addComponent(id, 'PlayerTag', {});
  world.addComponent<Player>(id, 'Player', {
    currency: 0,
    activeSlot: WeaponSlot.Sidearm,
    sidearmSlot: -1 as number,
    longArmSlot: -1 as number,
    isSwapping: false,
    swapTimer: 0,
    swapDuration: 0.3,
  });
  return id;
}

function createDungeonFloor(world: World, x: number, z: number): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y: 0, z });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Floor,
    visible: false,
    scale: 1,
    scaleX: 1,
    scaleZ: 1,
  });
  world.addComponent(id, 'DungeonEntityTag', {});
  return id;
}

function createWall(world: World, x: number, z: number, w = 1, d = 1): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y: 0, z });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: w,
    height: 3,
    depth: d,
    isStatic: true,
    isTrigger: false,
  });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.Wall,
    visible: false,
    scale: 1,
    scaleX: w,
    scaleZ: d,
  });
  world.addComponent(id, 'WallTag', {});
  world.addComponent(id, 'DungeonEntityTag', {});
  return id;
}

function createEnemy(world: World, x: number, z: number): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y: 0, z });
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId: MeshId.KnifeRusher,
    visible: false,
    scale: 1,
  });
  world.addComponent<Health>(id, 'Health', { current: 100, max: 100, lastDamageSourceGunSlot: null });
  world.addComponent<Enemy>(id, 'Enemy', { enemyType: EnemyType.KnifeRusher, isMini: false, hasExploded: false });
  world.addComponent<AIState>(id, 'AIState', { state: AIBehaviorState.Idle, target: null, attackCooldown: 0, stateTimer: 0 });
  world.addComponent(id, 'EnemyTag', {});
  return id;
}

function rebuildStaticWalls(world: World): void {
  const entities = world.query(['Position', 'Collider']);
  const statics: CollisionEntity[] = [];
  for (const id of entities) {
    const collider = world.getComponent<Collider>(id, 'Collider')!;
    if (collider.isStatic) {
      statics.push({ id, position: world.getComponent<Position>(id, 'Position')!, collider });
    }
  }
  rebuildStatics(statics);
}

// ── Tests ────────────────────────────────────────────────────────────────

beforeEach(() => {
  resetVisibilityState();
  resetCollisionState();
});

describe('Fog of War', () => {
  it('reveals dungeon entities near the player', () => {
    const world = new World();
    createPlayer(world, 0, 0);
    const floorId = createDungeonFloor(world, 3, 3);

    rebuildDungeonTree(world);
    visibilitySystem(world);

    const renderable = world.getComponent<Renderable>(floorId, 'Renderable')!;
    expect(renderable.visible).toBe(true);
    expect(world.hasComponent(floorId, 'Revealed')).toBe(true);
  });

  it('does not reveal dungeon entities far from the player', () => {
    const world = new World();
    createPlayer(world, 0, 0);
    const floorId = createDungeonFloor(world, 50, 50);

    rebuildDungeonTree(world);
    visibilitySystem(world);

    const renderable = world.getComponent<Renderable>(floorId, 'Renderable')!;
    expect(renderable.visible).toBe(false);
    expect(world.hasComponent(floorId, 'Revealed')).toBe(false);
  });

  it('revealed entities stay visible permanently', () => {
    const world = new World();
    const playerId = createPlayer(world, 0, 0);
    const floorId = createDungeonFloor(world, 3, 3);

    rebuildDungeonTree(world);
    visibilitySystem(world);
    expect(world.getComponent<Renderable>(floorId, 'Renderable')!.visible).toBe(true);

    // Move player far away
    const pos = world.getComponent<Position>(playerId, 'Position')!;
    pos.x = 100;
    pos.z = 100;
    visibilitySystem(world);

    // Floor stays visible (permanent reveal)
    expect(world.getComponent<Renderable>(floorId, 'Renderable')!.visible).toBe(true);
  });
});

describe('Enemy LOS', () => {
  it('shows enemy with clear line of sight', () => {
    const world = new World();
    createPlayer(world, 0, 0);
    const enemyId = createEnemy(world, 5, 0);

    rebuildStaticWalls(world);
    rebuildDungeonTree(world);
    visibilitySystem(world);

    expect(world.getComponent<Renderable>(enemyId, 'Renderable')!.visible).toBe(true);
  });

  it('hides enemy occluded by a wall', () => {
    const world = new World();
    createPlayer(world, 0, 0);
    const enemyId = createEnemy(world, 10, 0);
    // Wall between player and enemy
    createWall(world, 5, 0, 2, 2);

    rebuildStaticWalls(world);
    rebuildDungeonTree(world);
    visibilitySystem(world);

    expect(world.getComponent<Renderable>(enemyId, 'Renderable')!.visible).toBe(false);
  });

  it('hides enemy beyond losMaxRange', () => {
    const world = new World();
    createPlayer(world, 0, 0);
    const enemyId = createEnemy(world, 50, 0); // beyond losMaxRange of 30

    rebuildStaticWalls(world);
    rebuildDungeonTree(world);
    visibilitySystem(world);

    expect(world.getComponent<Renderable>(enemyId, 'Renderable')!.visible).toBe(false);
  });

  it('shows enemy when wall does not block the ray', () => {
    const world = new World();
    createPlayer(world, 0, 0);
    const enemyId = createEnemy(world, 5, 0);
    // Wall off to the side — doesn't block LOS
    createWall(world, 5, 5, 2, 2);

    rebuildStaticWalls(world);
    rebuildDungeonTree(world);
    visibilitySystem(world);

    expect(world.getComponent<Renderable>(enemyId, 'Renderable')!.visible).toBe(true);
  });

  it('dynamically updates visibility as player moves', () => {
    const world = new World();
    const playerId = createPlayer(world, 0, 0);
    const enemyId = createEnemy(world, 10, 0);
    createWall(world, 5, 0, 2, 2);

    rebuildStaticWalls(world);
    rebuildDungeonTree(world);

    // Enemy occluded from (0,0)
    visibilitySystem(world);
    expect(world.getComponent<Renderable>(enemyId, 'Renderable')!.visible).toBe(false);

    // Move player past the wall
    const playerPos = world.getComponent<Position>(playerId, 'Position')!;
    playerPos.x = 7;
    visibilitySystem(world);
    expect(world.getComponent<Renderable>(enemyId, 'Renderable')!.visible).toBe(true);
  });
});
