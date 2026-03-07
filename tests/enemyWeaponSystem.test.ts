import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { AIBehaviorState } from '../src/ecs/components';
import type { AIState, EnemyWeapon, Position, Rotation, Projectile } from '../src/ecs/components';
import { enemyWeaponSystem } from '../src/systems/enemyWeaponSystem';

function createArmedEnemy(
  world: World,
  overrides: {
    weapon?: Partial<EnemyWeapon>;
    ai?: Partial<AIState>;
    position?: Partial<Position>;
    rotation?: Partial<Rotation>;
  } = {},
): number {
  const id = world.createEntity();
  world.addComponent<EnemyWeapon>(id, 'EnemyWeapon', {
    damage: 10,
    fireRate: 1,
    projectileSpeed: 20,
    projectileCount: 1,
    spread: 0,
    fireCooldown: 0,
    ...overrides.weapon,
  });
  world.addComponent<AIState>(id, 'AIState', {
    state: AIBehaviorState.Attack,
    target: null,
    attackCooldown: 0,
    stateTimer: 0,
    ...overrides.ai,
  });
  world.addComponent<Position>(id, 'Position', {
    x: 0,
    y: 0,
    z: 0,
    ...overrides.position,
  });
  world.addComponent<Rotation>(id, 'Rotation', {
    y: 0,
    ...overrides.rotation,
  });
  return id;
}

function countProjectiles(world: World): number {
  return world.query(['Projectile']).length;
}

function getProjectiles(world: World): Array<{ id: number; projectile: Projectile; position: Position }> {
  return world.query(['Projectile']).map((id) => ({
    id,
    projectile: world.getComponent<Projectile>(id, 'Projectile')!,
    position: world.getComponent<Position>(id, 'Position')!,
  }));
}

const DT = 1 / 60;

describe('EnemyWeaponSystem', () => {
  it('decrements fireCooldown every frame regardless of AI state', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 1.0, fireRate: 1.0 },
      ai: { state: AIBehaviorState.Chase },
    });

    enemyWeaponSystem(world, DT);

    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBeCloseTo(1.0 - DT, 10);
    expect(countProjectiles(world)).toBe(0);
  });

  it('fires immediately when entering Attack with cooldown <= 0 (Shotgunner)', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: -0.5, fireRate: 0.5, projectileCount: 5, spread: 0.2, damage: 8, projectileSpeed: 18 },
      ai: { state: AIBehaviorState.Attack },
      position: { x: 5, y: 0, z: 5 },
      rotation: { y: 0 },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(5);
    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBeCloseTo(1 / 0.5, 10);
  });

  it('spawns correct number of Shotgunner projectiles with spread', () => {
    const world = new World();
    const baseAngle = Math.PI / 4;
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, fireRate: 0.5, projectileCount: 5, spread: 0.2 },
      ai: { state: AIBehaviorState.Attack },
      rotation: { y: baseAngle },
    });

    enemyWeaponSystem(world, DT);

    const projectiles = getProjectiles(world);
    expect(projectiles).toHaveLength(5);

    for (const p of projectiles) {
      expect(p.projectile.isEnemyProjectile).toBe(true);
    }
  });

  it('Rifleman spawns exactly 1 bullet with minimal spread', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, fireRate: 0.4, projectileCount: 1, spread: 0.01 },
      ai: { state: AIBehaviorState.Attack },
      rotation: { y: 0 },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(1);
    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBeCloseTo(1 / 0.4, 10);
  });

  it('ShieldGun spawns 1 bullet with its specific spread', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, fireRate: 0.667, projectileCount: 1, spread: 0.03 },
      ai: { state: AIBehaviorState.Attack },
      rotation: { y: Math.PI },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(1);
    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBeCloseTo(1 / 0.667, 5);
  });

  it('does not fire in Chase state even with cooldown <= 0', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: -1.0 },
      ai: { state: AIBehaviorState.Chase },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(0);
    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBeCloseTo(-1.0 - DT, 10);
  });

  it('does not fire in Idle state', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0 },
      ai: { state: AIBehaviorState.Idle },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(0);
    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBeCloseTo(0 - DT, 10);
  });

  it('does not fire in Dead state', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0 },
      ai: { state: AIBehaviorState.Dead },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(0);
  });

  it('does not fire in Flee state', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0 },
      ai: { state: AIBehaviorState.Flee },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(0);
  });

  it('resets fireCooldown to exactly 1/fireRate after firing', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, fireRate: 2.5 },
      ai: { state: AIBehaviorState.Attack },
    });

    enemyWeaponSystem(world, DT);

    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBe(0.4);
  });

  it('multiple enemies fire independently in the same frame', () => {
    const world = new World();
    // Rifleman A: fires
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, projectileCount: 1, spread: 0.01 },
      ai: { state: AIBehaviorState.Attack },
    });
    // Shotgunner B: fires
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, projectileCount: 5, spread: 0.2 },
      ai: { state: AIBehaviorState.Attack },
    });
    // Rifleman C: does not fire (cooldown > 0)
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0.5, projectileCount: 1, spread: 0.01 },
      ai: { state: AIBehaviorState.Attack },
    });

    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(6);
    // Rifleman C cooldown ticked
    const weaponC = world.getComponent<EnemyWeapon>(3, 'EnemyWeapon')!;
    expect(weaponC.fireCooldown).toBeCloseTo(0.5 - DT, 10);
  });

  it('projectile speed matches EnemyWeapon config', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, projectileSpeed: 22.0, projectileCount: 1, spread: 0 },
      ai: { state: AIBehaviorState.Attack },
      rotation: { y: 0 },
    });

    // Use fixed rng to eliminate spread randomness
    enemyWeaponSystem(world, DT, () => 0.5);

    const projectiles = getProjectiles(world);
    expect(projectiles).toHaveLength(1);
    const vel = world.getComponent<{ x: number; y: number; z: number }>(projectiles[0].id, 'Velocity')!;
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    expect(speed).toBeCloseTo(22.0, 5);
  });

  it('projectile damage matches EnemyWeapon config', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, damage: 8, projectileCount: 5, spread: 0.2 },
      ai: { state: AIBehaviorState.Attack },
    });

    enemyWeaponSystem(world, DT);

    const projectiles = getProjectiles(world);
    expect(projectiles).toHaveLength(5);
    for (const p of projectiles) {
      expect(p.projectile.damage).toBe(8);
    }
  });

  it('bullet spawn position matches enemy position', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, projectileCount: 5, spread: 0.2 },
      ai: { state: AIBehaviorState.Attack },
      position: { x: 10, y: 0, z: -5 },
    });

    enemyWeaponSystem(world, DT);

    const projectiles = getProjectiles(world);
    for (const p of projectiles) {
      expect(p.position.x).toBe(10);
      expect(p.position.y).toBe(0);
      expect(p.position.z).toBe(-5);
    }
  });

  it('cooldown accumulates negative values over many frames without firing', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, fireRate: 1 },
      ai: { state: AIBehaviorState.Chase },
    });

    const frames = 600; // 10 seconds
    for (let i = 0; i < frames; i++) {
      enemyWeaponSystem(world, DT);
    }

    const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
    expect(weapon.fireCooldown).toBeCloseTo(-frames * DT, 5);
    expect(countProjectiles(world)).toBe(0);

    // Now switch to Attack — should fire immediately
    const ai = world.getComponent<AIState>(1, 'AIState')!;
    ai.state = AIBehaviorState.Attack;
    enemyWeaponSystem(world, DT);

    expect(countProjectiles(world)).toBe(1);
    expect(weapon.fireCooldown).toBe(1); // 1/fireRate = 1/1
  });

  it('enemy without EnemyWeapon is not processed', () => {
    const world = new World();
    // KnifeRusher: has AIState but no EnemyWeapon
    const id = world.createEntity();
    world.addComponent<AIState>(id, 'AIState', {
      state: AIBehaviorState.Attack,
      target: null,
      attackCooldown: 0,
      stateTimer: 0,
    });
    world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
    world.addComponent<Rotation>(id, 'Rotation', { y: 0 });

    // Should not throw or spawn bullets
    enemyWeaponSystem(world, DT);
    expect(countProjectiles(world)).toBe(0);
  });

  it('fires exactly one volley per frame (no catch-up firing)', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: -5.0, fireRate: 1, projectileCount: 3, spread: 0.1 },
      ai: { state: AIBehaviorState.Attack },
    });

    enemyWeaponSystem(world, 0.5); // large dt

    // Should fire exactly one volley of 3, not multiple to "catch up"
    expect(countProjectiles(world)).toBe(3);
  });

  it('all spawned projectiles have isEnemyProjectile = true', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, projectileCount: 5, spread: 0.2 },
      ai: { state: AIBehaviorState.Attack },
    });

    enemyWeaponSystem(world, DT);

    const projectiles = getProjectiles(world);
    for (const p of projectiles) {
      expect(p.projectile.isEnemyProjectile).toBe(true);
    }
  });

  it('spawned projectiles have EnemyProjectileTag', () => {
    const world = new World();
    createArmedEnemy(world, {
      weapon: { fireCooldown: 0, projectileCount: 1, spread: 0 },
      ai: { state: AIBehaviorState.Attack },
    });

    enemyWeaponSystem(world, DT);

    const bulletIds = world.query(['EnemyProjectileTag']);
    expect(bulletIds).toHaveLength(1);
  });

  // Property-based tests
  describe('property-based tests', () => {
    it('cooldown always decreases by exactly dt', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
          fc.float({ min: Math.fround(-10), max: Math.fround(10), noNaN: true }),
          fc.constantFrom(
            AIBehaviorState.Idle,
            AIBehaviorState.Chase,
            AIBehaviorState.Flee,
          ),
          (dt, initialCooldown, state) => {
            const world = new World();
            createArmedEnemy(world, {
              weapon: { fireCooldown: initialCooldown, fireRate: 1 },
              ai: { state },
            });

            enemyWeaponSystem(world, dt);

            const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
            // Non-attack states: cooldown decreases, no firing
            expect(weapon.fireCooldown).toBeCloseTo(initialCooldown - dt, 5);
            expect(countProjectiles(world)).toBe(0);
          },
        ),
      );
    });

    it('attack state with ready cooldown always spawns projectileCount bullets', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.float({ min: Math.fround(0.1), max: Math.fround(10), noNaN: true }),
          (projectileCount, fireRate) => {
            const world = new World();
            createArmedEnemy(world, {
              weapon: { fireCooldown: 0, fireRate, projectileCount, spread: 0.1 },
              ai: { state: AIBehaviorState.Attack },
            });

            enemyWeaponSystem(world, DT);

            expect(countProjectiles(world)).toBe(projectileCount);
            const weapon = world.getComponent<EnemyWeapon>(1, 'EnemyWeapon')!;
            expect(weapon.fireCooldown).toBeCloseTo(1 / fireRate, 5);
          },
        ),
      );
    });

    it('bullet velocity magnitude equals projectileSpeed', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(1), max: Math.fround(100), noNaN: true }),
          fc.float({ min: Math.fround(-Math.PI), max: Math.fround(Math.PI), noNaN: true }),
          (speed, angle) => {
            const world = new World();
            createArmedEnemy(world, {
              weapon: { fireCooldown: 0, projectileSpeed: speed, projectileCount: 1, spread: 0 },
              ai: { state: AIBehaviorState.Attack },
              rotation: { y: angle },
            });

            enemyWeaponSystem(world, DT, () => 0.5);

            const projectiles = world.query(['Projectile']);
            expect(projectiles).toHaveLength(1);
            const vel = world.getComponent<{ x: number; y: number; z: number }>(projectiles[0], 'Velocity')!;
            const mag = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
            expect(mag).toBeCloseTo(speed, 3);
          },
        ),
      );
    });
  });
});
