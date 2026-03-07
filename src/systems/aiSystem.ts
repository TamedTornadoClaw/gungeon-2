/**
 * AISystem — Per-type enemy AI behavior with state machine transitions.
 *
 * System execution order: 4 (after DodgeRollSystem, before ProjectileSystem).
 * Sets Velocity on enemies; MovementSystem integrates.
 *
 * State machine per type:
 *   Idle → Chase (player in detection range)
 *   Chase → Attack (player in attack range)
 *   Attack → Chase (player moves out of attack range)
 *   Chase → Idle (player moves out of detection range)
 *   SuicideBomber: once Chase, stays Chase (no Attack state)
 */
import type { World } from '../ecs/world';
import type {
  Position,
  Velocity,
  Rotation,
  Health,
  Enemy,
  AIState,
} from '../ecs/components';
import {
  AIBehaviorState,
  EnemyType,
} from '../ecs/components';
import { getDesignParams } from '../config/designParams';
import type { BaseEnemyParams, MeleeEnemyParams, RangedEnemyParams } from '../config/designParams';

/** Retreat threshold for Shotgunner — fraction of attack range */
const SHOTGUNNER_RETREAT_FRACTION = 0.3;

/** Rifleman preferred distance — fraction of attack range */
const RIFLEMAN_PREFERRED_DISTANCE_FRACTION = 0.7;

interface EnemyRanges {
  detectionRange: number;
  attackRange: number;
  speed: number;
  attackCooldown: number;
}

function getEnemyRanges(enemyType: EnemyType, isMini: boolean, depth: number): EnemyRanges {
  const params = getDesignParams();
  const scaling = params.enemies.depthScaling;

  const baseParamsMap: Record<EnemyType, BaseEnemyParams> = {
    [EnemyType.KnifeRusher]: params.enemies.KnifeRusher,
    [EnemyType.ShieldGun]: params.enemies.ShieldGun,
    [EnemyType.Shotgunner]: params.enemies.Shotgunner,
    [EnemyType.Rifleman]: params.enemies.Rifleman,
    [EnemyType.SuicideBomber]: params.enemies.SuicideBomber,
  };

  const base = baseParamsMap[enemyType];
  const speedScale = 1 + depth * scaling.speedMultiplierPerDepth;
  let speed = base.baseSpeed * speedScale;
  let detectionRange = base.detectionRange;

  // Attack range: melee/ranged types have it, SuicideBomber does not
  let attackRange = 0;
  let attackCooldown = 0;
  if (enemyType !== EnemyType.SuicideBomber) {
    const withRange = base as MeleeEnemyParams | RangedEnemyParams;
    attackRange = withRange.attackRange;
    attackCooldown = withRange.attackCooldown;
  }

  // Mini-boss / boss stat multiplier
  if (isMini) {
    speed *= scaling.miniBossStatMultiplier;
    detectionRange *= scaling.miniBossStatMultiplier;
    attackRange *= scaling.miniBossStatMultiplier;
  }

  return { detectionRange, attackRange, speed, attackCooldown };
}

function distanceBetween(a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function directionTo(from: Position, to: Position): { dx: number; dz: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const mag = Math.sqrt(dx * dx + dz * dz);
  if (mag === 0) return { dx: 0, dz: 0 };
  return { dx: dx / mag, dz: dz / mag };
}

export function aiSystem(world: World, dt: number, depth: number = 0): void {
  // Find the player
  const playerIds = world.query(['Player', 'Position', 'Health']);
  if (playerIds.length === 0) return;

  const playerId = playerIds[0];
  const playerHealth = world.getComponent<Health>(playerId, 'Health')!;
  const playerPos = world.getComponent<Position>(playerId, 'Position')!;
  const playerDead = playerHealth.current <= 0;

  // Query all enemies with AI
  const enemyIds = world.query(['Enemy', 'AIState', 'Position', 'Velocity']);

  for (const id of enemyIds) {
    const enemy = world.getComponent<Enemy>(id, 'Enemy')!;
    const ai = world.getComponent<AIState>(id, 'AIState')!;
    const pos = world.getComponent<Position>(id, 'Position')!;
    const vel = world.getComponent<Velocity>(id, 'Velocity')!;
    const rotation = world.getComponent<Rotation>(id, 'Rotation');

    // Skip dead enemies
    if (ai.state === AIBehaviorState.Dead) {
      vel.x = 0;
      vel.z = 0;
      continue;
    }

    const health = world.getComponent<Health>(id, 'Health');
    if (health && health.current <= 0) {
      ai.state = AIBehaviorState.Dead;
      ai.target = null;
      vel.x = 0;
      vel.z = 0;
      continue;
    }

    // Decrement attack cooldown
    if (ai.attackCooldown > 0) {
      ai.attackCooldown = Math.max(0, ai.attackCooldown - dt);
    }

    const ranges = getEnemyRanges(enemy.enemyType, enemy.isMini, depth);
    const dist = distanceBetween(pos, playerPos);

    // If player is dead, go idle
    if (playerDead) {
      ai.state = AIBehaviorState.Idle;
      ai.target = null;
      vel.x = 0;
      vel.z = 0;
      continue;
    }

    // State machine
    switch (ai.state) {
      case AIBehaviorState.Idle: {
        if (dist <= ranges.detectionRange) {
          ai.state = AIBehaviorState.Chase;
          ai.target = playerId;
          // Start moving toward player immediately
          const dir = directionTo(pos, playerPos);
          vel.x = dir.dx * ranges.speed;
          vel.z = dir.dz * ranges.speed;
          if (rotation) {
            rotation.y = Math.atan2(dir.dx, dir.dz);
          }
        } else {
          vel.x = 0;
          vel.z = 0;
        }
        break;
      }

      case AIBehaviorState.Chase: {
        // Lost detection?
        if (dist > ranges.detectionRange) {
          // SuicideBomber never goes back to Idle once chasing
          if (enemy.enemyType !== EnemyType.SuicideBomber) {
            ai.state = AIBehaviorState.Idle;
            ai.target = null;
            vel.x = 0;
            vel.z = 0;
            break;
          }
        }

        ai.target = playerId;

        // SuicideBomber never transitions to Attack — always chases
        if (enemy.enemyType === EnemyType.SuicideBomber) {
          const dir = directionTo(pos, playerPos);
          vel.x = dir.dx * ranges.speed;
          vel.z = dir.dz * ranges.speed;
          if (rotation) {
            rotation.y = Math.atan2(dir.dx, dir.dz);
          }
          break;
        }

        // In attack range and cooldown ready?
        if (dist <= ranges.attackRange && ai.attackCooldown <= 0) {
          ai.state = AIBehaviorState.Attack;
          ai.attackCooldown = ranges.attackCooldown;
          // Fall through to Attack handling below by recursing the switch
          // Actually, set velocity for attack state inline
          handleAttackVelocity(enemy.enemyType, pos, playerPos, vel, rotation, ranges, dist);
          break;
        }

        // Chase toward player
        const dir = directionTo(pos, playerPos);
        vel.x = dir.dx * ranges.speed;
        vel.z = dir.dz * ranges.speed;
        if (rotation) {
          rotation.y = Math.atan2(dir.dx, dir.dz);
        }
        break;
      }

      case AIBehaviorState.Attack: {
        ai.target = playerId;

        // Player moved out of attack range? Back to chase
        if (dist > ranges.attackRange) {
          ai.state = AIBehaviorState.Chase;
          const dir = directionTo(pos, playerPos);
          vel.x = dir.dx * ranges.speed;
          vel.z = dir.dz * ranges.speed;
          if (rotation) {
            rotation.y = Math.atan2(dir.dx, dir.dz);
          }
          break;
        }

        // Player moved out of detection range? (shouldn't normally happen but handle it)
        if (dist > ranges.detectionRange) {
          ai.state = AIBehaviorState.Idle;
          ai.target = null;
          vel.x = 0;
          vel.z = 0;
          break;
        }

        // Cooldown expired while in attack range — re-attack
        if (ai.attackCooldown <= 0) {
          ai.attackCooldown = ranges.attackCooldown;
        }

        handleAttackVelocity(enemy.enemyType, pos, playerPos, vel, rotation, ranges, dist);
        break;
      }

      case AIBehaviorState.Flee: {
        // Flee away from player
        const dir = directionTo(pos, playerPos);
        vel.x = -dir.dx * ranges.speed;
        vel.z = -dir.dz * ranges.speed;
        if (rotation) {
          rotation.y = Math.atan2(dir.dx, dir.dz);
        }

        // If we've fled far enough, go back to chase/idle
        if (dist > ranges.attackRange) {
          ai.state = dist <= ranges.detectionRange ? AIBehaviorState.Chase : AIBehaviorState.Idle;
        }
        break;
      }
    }
  }
}

function handleAttackVelocity(
  enemyType: EnemyType,
  pos: Position,
  playerPos: Position,
  vel: Velocity,
  rotation: Rotation | undefined,
  ranges: EnemyRanges,
  dist: number,
): void {
  const dir = directionTo(pos, playerPos);

  // Face the player
  if (rotation) {
    rotation.y = Math.atan2(dir.dx, dir.dz);
  }

  switch (enemyType) {
    case EnemyType.KnifeRusher:
      // Melee: stop and attack
      vel.x = 0;
      vel.z = 0;
      break;

    case EnemyType.ShieldGun:
      // Stop moving, fire from behind shield
      vel.x = 0;
      vel.z = 0;
      break;

    case EnemyType.Shotgunner: {
      // Retreat if player too close
      const retreatThreshold = ranges.attackRange * SHOTGUNNER_RETREAT_FRACTION;
      if (dist < retreatThreshold) {
        vel.x = -dir.dx * ranges.speed;
        vel.z = -dir.dz * ranges.speed;
      } else {
        vel.x = 0;
        vel.z = 0;
      }
      break;
    }

    case EnemyType.Rifleman: {
      // Maintain distance — back away if too close
      const preferredDist = ranges.attackRange * RIFLEMAN_PREFERRED_DISTANCE_FRACTION;
      if (dist < preferredDist) {
        vel.x = -dir.dx * ranges.speed;
        vel.z = -dir.dz * ranges.speed;
      } else {
        vel.x = 0;
        vel.z = 0;
      }
      break;
    }

    default:
      vel.x = 0;
      vel.z = 0;
      break;
  }
}
