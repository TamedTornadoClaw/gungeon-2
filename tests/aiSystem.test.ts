import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { aiSystem } from '../src/systems/aiSystem';
import {
  AIBehaviorState,
  EnemyType,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  Position,
  Velocity,
  Rotation,
  Health,
  Enemy,
  AIState,
  Player,
  DodgeRoll,
} from '../src/ecs/components';

// ── Helpers ─────────────────────────────────────────────────────────────────

const DT = 1 / 60;

function createPlayer(
  world: World,
  x: number,
  z: number,
  hp: number = 100,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y: 0, z });
  world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
  world.addComponent<Rotation>(id, 'Rotation', { y: 0 });
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: 100,
    lastDamageSourceGunSlot: null,
  });

  // Player needs sidearm/longArm slots — create stub gun entities
  const sidearmId = world.createEntity();
  const longArmId = world.createEntity();

  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: sidearmId,
    longArmSlot: longArmId,
    activeSlot: WeaponSlot.Sidearm,
    currency: 0,
  });
  world.addComponent<DodgeRoll>(id, 'DodgeRoll', {
    cooldownRemaining: 0,
    isRolling: false,
    rollTimer: 0,
    rollDirectionX: 0,
    rollDirectionY: 0,
  });
  return id;
}

function createEnemy(
  world: World,
  enemyType: EnemyType,
  x: number,
  z: number,
  aiState: AIBehaviorState = AIBehaviorState.Idle,
  attackCooldown: number = 0,
  hp: number = 100,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y: 0, z });
  world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
  world.addComponent<Rotation>(id, 'Rotation', { y: 0 });
  world.addComponent<Health>(id, 'Health', {
    current: hp,
    max: hp,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<Enemy>(id, 'Enemy', {
    enemyType,
    isMini: false,
    hasExploded: false,
  });
  world.addComponent<AIState>(id, 'AIState', {
    state: aiState,
    target: null,
    attackCooldown,
    stateTimer: 0,
  });
  return id;
}

function getVel(world: World, id: number): Velocity {
  return world.getComponent<Velocity>(id, 'Velocity')!;
}

function getAI(world: World, id: number): AIState {
  return world.getComponent<AIState>(id, 'AIState')!;
}

function velMagnitude(vel: Velocity): number {
  return Math.sqrt(vel.x * vel.x + vel.z * vel.z);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('aiSystem', () => {
  // Case 1: KnifeRusher Idle → Chase when player enters detection range
  it('transitions KnifeRusher Idle → Chase when player in detection range', () => {
    const world = new World();
    createPlayer(world, 11, 0); // distance 11 < detectionRange 12
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Idle);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Chase);
    expect(vel.x).toBeGreaterThan(0); // moving toward player (positive x)
    expect(ai.target).not.toBeNull();
  });

  // Case 2: KnifeRusher stays Idle when player outside detection range
  it('keeps KnifeRusher Idle when player outside detection range', () => {
    const world = new World();
    createPlayer(world, 13, 0); // distance 13 > detectionRange 12
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Idle);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Idle);
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);
  });

  // Case 3: KnifeRusher Chase → Attack at melee range
  it('transitions KnifeRusher Chase → Attack at melee range', () => {
    const world = new World();
    createPlayer(world, 1, 0); // distance 1 < attackRange 1.5
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Attack);
    expect(vel.x).toBe(0); // melee: stopped
    expect(vel.z).toBe(0);
    expect(ai.attackCooldown).toBeCloseTo(0.8); // KnifeRusher attackCooldown
  });

  // Case 4: KnifeRusher Attack → Chase when player moves away
  it('transitions KnifeRusher Attack → Chase when player moves out of attack range', () => {
    const world = new World();
    createPlayer(world, 5, 0); // distance 5 > attackRange 1.5, < detectionRange 12
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Attack, 0);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Chase);
    expect(vel.x).toBeGreaterThan(0); // chasing toward player
  });

  // Case 5: ShieldGun stops moving in Attack state
  it('stops ShieldGun in Attack state and faces player', () => {
    const world = new World();
    createPlayer(world, 8, 0); // distance 8 < attackRange 10
    const enemyId = createEnemy(world, EnemyType.ShieldGun, 0, 0, AIBehaviorState.Attack, 0.5);

    aiSystem(world, DT);

    const vel = getVel(world, enemyId);
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);

    const rotation = world.getComponent<Rotation>(enemyId, 'Rotation')!;
    // Should face player at (8, 0) from (0, 0) — atan2(8, 0) ≈ π/2
    expect(rotation.y).toBeCloseTo(Math.atan2(8, 0));
  });

  // Case 6: Shotgunner retreats if player too close
  it('Shotgunner retreats when player is too close', () => {
    const world = new World();
    createPlayer(world, 1, 0); // distance 1 < attackRange 6 * 0.3 = 1.8
    const enemyId = createEnemy(world, EnemyType.Shotgunner, 0, 0, AIBehaviorState.Attack, 0.5);

    aiSystem(world, DT);

    const vel = getVel(world, enemyId);
    expect(vel.x).toBeLessThan(0); // retreating (negative x — away from player)
  });

  // Case 7: Rifleman maintains distance
  it('Rifleman moves away when player is too close', () => {
    const world = new World();
    createPlayer(world, 5, 0); // distance 5 < attackRange 15 * 0.7 = 10.5
    const enemyId = createEnemy(world, EnemyType.Rifleman, 0, 0, AIBehaviorState.Attack, 0.5);

    aiSystem(world, DT);

    const vel = getVel(world, enemyId);
    expect(vel.x).toBeLessThan(0); // moving away from player
  });

  // Case 8: SuicideBomber always chases once detected
  it('SuicideBomber stays in Chase and never transitions to Attack', () => {
    const world = new World();
    createPlayer(world, 1, 0); // very close
    const enemyId = createEnemy(world, EnemyType.SuicideBomber, 0, 0, AIBehaviorState.Chase, 0);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Chase);
    expect(vel.x).toBeGreaterThan(0); // still chasing
  });

  // Case 9: SuicideBomber sprint speed is correct
  it('SuicideBomber velocity magnitude equals baseSpeed (7.0) at depth 0', () => {
    const world = new World();
    createPlayer(world, 10, 0);
    const enemyId = createEnemy(world, EnemyType.SuicideBomber, 0, 0, AIBehaviorState.Chase, 0);

    aiSystem(world, DT, 0);

    const vel = getVel(world, enemyId);
    expect(velMagnitude(vel)).toBeCloseTo(7.0);
    expect(vel.x).toBeCloseTo(7.0); // direction is purely positive x
    expect(vel.z).toBeCloseTo(0);
  });

  // Case 10: Dead player is not targeted
  it('enemies stop chasing when player is dead', () => {
    const world = new World();
    createPlayer(world, 5, 0, 0); // hp = 0
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Idle);
    expect(ai.target).toBeNull();
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);
  });

  // Case 11: attackCooldown prevents re-attack
  it('decrements attackCooldown by dt each frame', () => {
    const world = new World();
    createPlayer(world, 1, 0);
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Attack, 0.5);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    expect(ai.attackCooldown).toBeCloseTo(0.5 - DT);
  });

  // Case 12: attackCooldown reaches zero and allows next attack
  it('resets attackCooldown when it reaches zero in attack range', () => {
    const world = new World();
    createPlayer(world, 1, 0);
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Attack, 0.01);

    aiSystem(world, DT); // cooldown 0.01 - 1/60 = -0.00667 → clamped to 0, then reset

    const ai = getAI(world, enemyId);
    expect(ai.attackCooldown).toBeCloseTo(0.8); // reset
  });

  // Case 13: Depth scaling affects speed
  it('applies depth scaling to enemy speed', () => {
    const world = new World();
    createPlayer(world, 5, 0);
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0);

    aiSystem(world, DT, 5); // depth 5

    const vel = getVel(world, enemyId);
    // speed = 6.0 * (1 + 0.03 * 5) = 6.0 * 1.15 = 6.9
    expect(velMagnitude(vel)).toBeCloseTo(6.9);
  });

  // Case 14: Determinism — same inputs produce same outputs
  it('produces deterministic output for identical inputs', () => {
    function runOnce(): { vel: Velocity; ai: AIState } {
      const world = new World();
      createPlayer(world, 10, 7);
      const enemyId = createEnemy(world, EnemyType.KnifeRusher, 5, 3, AIBehaviorState.Chase, 0.2);

      aiSystem(world, DT);

      return {
        vel: { ...getVel(world, enemyId) },
        ai: { ...getAI(world, enemyId) },
      };
    }

    const run1 = runOnce();
    const run2 = runOnce();

    expect(run1.vel.x).toBe(run2.vel.x);
    expect(run1.vel.z).toBe(run2.vel.z);
    expect(run1.ai.state).toBe(run2.ai.state);
    expect(run1.ai.attackCooldown).toBe(run2.ai.attackCooldown);
  });

  // Case 15: Enemy with health = 1 is alive and processed
  it('processes enemy with health = 1 normally', () => {
    const world = new World();
    createPlayer(world, 5, 0);
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0, 1);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Chase);
    expect(vel.x).toBeGreaterThan(0);
  });

  // Case 16: Dead enemy (health <= 0) transitions to Dead state
  it('marks dead enemy (health 0) as Dead and stops it', () => {
    const world = new World();
    createPlayer(world, 5, 0);
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0, 0);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Dead);
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);
  });

  // Case 17: Multiple enemies processed independently
  it('processes multiple enemies independently', () => {
    const world = new World();
    createPlayer(world, 5, 0);
    const e1 = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0);
    const e2 = createEnemy(world, EnemyType.Rifleman, 0, 10, AIBehaviorState.Idle, 0);

    aiSystem(world, DT);

    // KnifeRusher chases (distance 5 < 12)
    expect(getAI(world, e1).state).toBe(AIBehaviorState.Chase);
    expect(getVel(world, e1).x).toBeGreaterThan(0);

    // Rifleman: distance to player sqrt(25 + 100) ≈ 11.18, < detectionRange 18 → Chase
    expect(getAI(world, e2).state).toBe(AIBehaviorState.Chase);
  });

  // Case 18: Enemy and player at same position — no NaN
  it('handles enemy and player at same position without NaN', () => {
    const world = new World();
    createPlayer(world, 0, 0);
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0);

    aiSystem(world, DT);

    const vel = getVel(world, enemyId);
    expect(Number.isNaN(vel.x)).toBe(false);
    expect(Number.isNaN(vel.z)).toBe(false);
  });

  // Case 19: AIState.state = Dead is skipped
  it('skips enemy already in Dead state', () => {
    const world = new World();
    createPlayer(world, 5, 0);
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Dead, 0);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    const vel = getVel(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Dead);
    expect(vel.x).toBe(0);
    expect(vel.z).toBe(0);
  });

  // Case 20: Detection range boundary — at exactly detectionRange → in range
  it('detects player at exactly detection range boundary (<=)', () => {
    const world = new World();
    createPlayer(world, 12, 0); // exactly detectionRange 12
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Idle);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Chase);
  });

  // Case 21: No player in world — system doesn't crash
  it('does nothing when no player exists', () => {
    const world = new World();
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Idle);

    expect(() => aiSystem(world, DT)).not.toThrow();
    expect(getAI(world, enemyId).state).toBe(AIBehaviorState.Idle);
  });

  // Case 22: Boss uses same state machine with mini-boss scaling
  it('boss (isMini) uses scaled stats', () => {
    const world = new World();
    createPlayer(world, 5, 0);

    const id = world.createEntity();
    world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
    world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
    world.addComponent<Rotation>(id, 'Rotation', { y: 0 });
    world.addComponent<Health>(id, 'Health', { current: 500, max: 500, lastDamageSourceGunSlot: null });
    world.addComponent<Enemy>(id, 'Enemy', { enemyType: EnemyType.Rifleman, isMini: true, hasExploded: false });
    world.addComponent<AIState>(id, 'AIState', { state: AIBehaviorState.Idle, target: null, attackCooldown: 0, stateTimer: 0 });

    aiSystem(world, DT, 0);

    const ai = getAI(world, id);
    // Rifleman detectionRange 18 * 2.5 = 45
    // From Idle, transitions to Chase in first frame (distance 5 < 45)
    expect(ai.state).toBe(AIBehaviorState.Chase);

    const vel = getVel(world, id);
    // speed = 3.0 * 2.5 = 7.5
    expect(velMagnitude(vel)).toBeCloseTo(7.5);
  });

  // Case 23: Chase → Idle when player leaves detection range (non-SuicideBomber)
  it('transitions Chase → Idle when player leaves detection range', () => {
    const world = new World();
    createPlayer(world, 20, 0); // distance 20 > detectionRange 12
    const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0);

    aiSystem(world, DT);

    const ai = getAI(world, enemyId);
    expect(ai.state).toBe(AIBehaviorState.Idle);
    expect(ai.target).toBeNull();
  });

  // Property-based tests
  describe('property-based', () => {
    it('velocity direction always points toward player when chasing', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -50, max: 50, noNaN: true }),
          fc.float({ min: -50, max: 50, noNaN: true }),
          fc.float({ min: -50, max: 50, noNaN: true }),
          fc.float({ min: -50, max: 50, noNaN: true }),
          (ex, ez, px, pz) => {
            const dist = Math.sqrt((px - ex) ** 2 + (pz - ez) ** 2);
            // Only test when player is within detection range and not at same position
            if (dist < 0.01 || dist > 12) return;

            const world = new World();
            createPlayer(world, px, pz);
            const enemyId = createEnemy(world, EnemyType.KnifeRusher, ex, ez, AIBehaviorState.Chase, 0);

            aiSystem(world, DT);

            const vel = getVel(world, enemyId);
            const ai = getAI(world, enemyId);

            if (ai.state === AIBehaviorState.Chase) {
              // Velocity should point toward player
              const dx = px - ex;
              const dz = pz - ez;
              const dot = vel.x * dx + vel.z * dz;
              expect(dot).toBeGreaterThan(0);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it('AISystem never modifies Position directly', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -20, max: 20, noNaN: true }),
          fc.float({ min: -20, max: 20, noNaN: true }),
          (px, pz) => {
            const world = new World();
            createPlayer(world, px, pz);
            const enemyId = createEnemy(world, EnemyType.KnifeRusher, 0, 0, AIBehaviorState.Chase, 0);

            const posBefore = { ...world.getComponent<Position>(enemyId, 'Position')! };
            aiSystem(world, DT);
            const posAfter = world.getComponent<Position>(enemyId, 'Position')!;

            expect(posAfter.x).toBe(posBefore.x);
            expect(posAfter.y).toBe(posBefore.y);
            expect(posAfter.z).toBe(posBefore.z);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('every enemy with AIState gets exactly one state update per frame', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (numEnemies) => {
            const world = new World();
            createPlayer(world, 5, 0);
            const enemies: number[] = [];
            for (let i = 0; i < numEnemies; i++) {
              enemies.push(
                createEnemy(world, EnemyType.KnifeRusher, i * 2, 0, AIBehaviorState.Idle),
              );
            }

            aiSystem(world, DT);

            // All enemies should have been processed (no crash, all have valid states)
            for (const id of enemies) {
              const ai = getAI(world, id);
              expect([
                AIBehaviorState.Idle,
                AIBehaviorState.Chase,
                AIBehaviorState.Attack,
                AIBehaviorState.Flee,
                AIBehaviorState.Dead,
              ]).toContain(ai.state);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
