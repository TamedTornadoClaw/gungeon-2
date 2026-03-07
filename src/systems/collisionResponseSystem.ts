/**
 * CollisionResponseSystem — Position 9 in system execution order.
 *
 * Interprets collision pairs from CollisionDetectionSystem based on component
 * composition and emits game events or sets flags accordingly.
 *
 * Integration: Called by the game loop each fixed-timestep tick, after
 * collisionDetectionSystem. Produces DamageEvents consumed by damageSystem.
 */

import type { EntityId } from '../types';
import type { CollisionPair } from './collisionDetectionSystem';
import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import {
  EventType,
  EnemyType,
  AIBehaviorState,
  PickupType,
  HazardType,
  ParticleEffect,
  SoundId,
} from '../ecs/components';
import type {
  Position,
  Velocity,
  Health,
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
} from '../ecs/components';
import { getDesignParams } from '../config/designParams';

// ── Spike Cooldown Tracking ───────────────────────────────────────────────

const spikeCooldowns = new Map<EntityId, number>();

export function updateSpikeCooldowns(dt: number): void {
  for (const [id, remaining] of spikeCooldowns) {
    const updated = remaining - dt;
    if (updated <= 0) {
      spikeCooldowns.delete(id);
    } else {
      spikeCooldowns.set(id, updated);
    }
  }
}

export function resetSpikeCooldowns(): void {
  spikeCooldowns.clear();
}

// ── Proximity Flag Reset ──────────────────────────────────────────────────

interface ProximityFlags {
  nearPickup: boolean;
  nearChest: boolean;
  nearShop: boolean;
  nearStairs: boolean;
}

function resetProximityFlags(world: World): void {
  const players = world.query(['PlayerTag']);
  for (const id of players) {
    const flags = world.getComponent<ProximityFlags>(id, 'ProximityFlags');
    if (flags) {
      flags.nearPickup = false;
      flags.nearChest = false;
      flags.nearShop = false;
      flags.nearStairs = false;
    }
  }
}

// ── Main System ───────────────────────────────────────────────────────────

export function collisionResponseSystem(
  pairs: CollisionPair[],
  world: World,
  eventQueue: EventQueue,
): void {
  resetProximityFlags(world);

  for (const pair of pairs) {
    const { entityA, entityB } = pair;

    if (!world.hasEntity(entityA) || !world.hasEntity(entityB)) continue;

    handlePair(pair, world, eventQueue);
  }
}

// ── Pair Dispatch ─────────────────────────────────────────────────────────

function handlePair(pair: CollisionPair, world: World, eventQueue: EventQueue): void {
  const { entityA, entityB } = pair;

  // Identify entity types by component composition
  const aIsPlayer = world.hasComponent(entityA, 'PlayerTag');
  const bIsPlayer = world.hasComponent(entityB, 'PlayerTag');
  const aIsEnemy = world.hasComponent(entityA, 'EnemyTag');
  const bIsEnemy = world.hasComponent(entityB, 'EnemyTag');
  const aIsPlayerProj = world.hasComponent(entityA, 'PlayerProjectileTag');
  const bIsPlayerProj = world.hasComponent(entityB, 'PlayerProjectileTag');
  const aIsEnemyProj = world.hasComponent(entityA, 'EnemyProjectileTag');
  const bIsEnemyProj = world.hasComponent(entityB, 'EnemyProjectileTag');
  const aIsWall = world.hasComponent(entityA, 'WallTag');
  const bIsWall = world.hasComponent(entityB, 'WallTag');
  const aIsPickup = world.hasComponent(entityA, 'PickupTag');
  const bIsPickup = world.hasComponent(entityB, 'PickupTag');
  const aIsHazard = world.hasComponent(entityA, 'HazardTag');
  const bIsHazard = world.hasComponent(entityB, 'HazardTag');
  const aIsDoor = world.hasComponent(entityA, 'DoorTag');
  const bIsDoor = world.hasComponent(entityB, 'DoorTag');
  const aIsChest = world.hasComponent(entityA, 'ChestTag');
  const bIsChest = world.hasComponent(entityB, 'ChestTag');
  const aIsShop = world.hasComponent(entityA, 'ShopTag');
  const bIsShop = world.hasComponent(entityB, 'ShopTag');
  const aIsStairs = world.hasComponent(entityA, 'StairsTag');
  const bIsStairs = world.hasComponent(entityB, 'StairsTag');
  const aIsDestructible = world.hasComponent(entityA, 'DestructibleTag');
  const bIsDestructible = world.hasComponent(entityB, 'DestructibleTag');
  const aIsSpawnZone = world.hasComponent(entityA, 'SpawnZone');
  const bIsSpawnZone = world.hasComponent(entityB, 'SpawnZone');

  // PlayerProjectile + Player = no effect (immune to own bullets)
  if ((aIsPlayerProj && bIsPlayer) || (aIsPlayer && bIsPlayerProj)) return;

  // Player + Wall
  if (aIsPlayer && bIsWall) return handlePlayerWall(entityA, entityB, pair, world);
  if (bIsPlayer && aIsWall) return handlePlayerWall(entityB, entityA, pair, world);

  // Player + Enemy
  if (aIsPlayer && bIsEnemy) return handlePlayerEnemy(entityA, entityB, pair, world, eventQueue);
  if (bIsPlayer && aIsEnemy) return handlePlayerEnemy(entityB, entityA, pair, world, eventQueue);

  // Player + EnemyProjectile
  if (aIsPlayer && bIsEnemyProj) return handlePlayerEnemyProjectile(entityA, entityB, world, eventQueue);
  if (bIsPlayer && aIsEnemyProj) return handlePlayerEnemyProjectile(entityB, entityA, world, eventQueue);

  // Player + Pickup
  if (aIsPlayer && bIsPickup) return handlePlayerPickup(entityA, entityB, world);
  if (bIsPlayer && aIsPickup) return handlePlayerPickup(entityB, entityA, world);

  // Player + Hazard
  if (aIsPlayer && bIsHazard) return handlePlayerHazard(entityA, entityB, world, eventQueue);
  if (bIsPlayer && aIsHazard) return handlePlayerHazard(entityB, entityA, world, eventQueue);

  // Player + Door
  if (aIsPlayer && bIsDoor) return handlePlayerDoor(entityB, eventQueue);
  if (bIsPlayer && aIsDoor) return handlePlayerDoor(entityA, eventQueue);

  // Player + Chest
  if (aIsPlayer && bIsChest) return handlePlayerChest(entityA, world);
  if (bIsPlayer && aIsChest) return handlePlayerChest(entityB, world);

  // Player + Shop
  if (aIsPlayer && bIsShop) return handlePlayerShop(entityA, world);
  if (bIsPlayer && aIsShop) return handlePlayerShop(entityB, world);

  // Player + Stairs
  if (aIsPlayer && bIsStairs) return handlePlayerStairs(entityA, world);
  if (bIsPlayer && aIsStairs) return handlePlayerStairs(entityB, world);

  // Player + SpawnZone
  if (aIsPlayer && bIsSpawnZone) return handlePlayerSpawnZone(entityB, world);
  if (bIsPlayer && aIsSpawnZone) return handlePlayerSpawnZone(entityA, world);

  // PlayerProjectile + Enemy
  if (aIsPlayerProj && bIsEnemy) return handlePlayerProjectileEnemy(entityA, entityB, world, eventQueue);
  if (bIsPlayerProj && aIsEnemy) return handlePlayerProjectileEnemy(entityB, entityA, world, eventQueue);

  // PlayerProjectile + Wall
  if (aIsPlayerProj && bIsWall) return handleProjectileWall(entityA, entityB, pair, world);
  if (bIsPlayerProj && aIsWall) return handleProjectileWall(entityB, entityA, pair, world);

  // PlayerProjectile + Destructible
  if (aIsPlayerProj && bIsDestructible) return handlePlayerProjectileDestructible(entityA, entityB, world, eventQueue);
  if (bIsPlayerProj && aIsDestructible) return handlePlayerProjectileDestructible(entityB, entityA, world, eventQueue);

  // EnemyProjectile + Wall
  if (aIsEnemyProj && bIsWall) return void world.destroyEntity(entityA);
  if (bIsEnemyProj && aIsWall) return void world.destroyEntity(entityB);

  // EnemyProjectile + Destructible
  if (aIsEnemyProj && bIsDestructible) return void world.destroyEntity(entityA);
  if (bIsEnemyProj && aIsDestructible) return void world.destroyEntity(entityB);

  // Enemy + Wall
  if (aIsEnemy && bIsWall) return pushOut(entityA, entityB, pair, world);
  if (bIsEnemy && aIsWall) return pushOut(entityB, entityA, pair, world);

  // Enemy + Enemy
  if (aIsEnemy && bIsEnemy) return pushApart(entityA, entityB, pair, world);
}

// ── Push-out Helpers ──────────────────────────────────────────────────────

function pushOut(
  dynamicId: EntityId,
  _staticId: EntityId,
  pair: CollisionPair,
  world: World,
): void {
  const pos = world.getComponent<Position>(dynamicId, 'Position');
  const staticPos = world.getComponent<Position>(_staticId, 'Position');
  if (!pos || !staticPos) return;

  if (pair.overlapX <= pair.overlapY) {
    // Push along X
    pos.x += pos.x < staticPos.x ? -pair.overlapX : pair.overlapX;
  } else {
    // Push along Z (overlapY in CollisionPair corresponds to Z axis)
    pos.z += pos.z < staticPos.z ? -pair.overlapY : pair.overlapY;
  }
}

function pushApart(
  idA: EntityId,
  idB: EntityId,
  pair: CollisionPair,
  world: World,
): void {
  const posA = world.getComponent<Position>(idA, 'Position');
  const posB = world.getComponent<Position>(idB, 'Position');
  if (!posA || !posB) return;

  const halfOverlap = pair.overlapX <= pair.overlapY
    ? pair.overlapX / 2
    : pair.overlapY / 2;

  if (pair.overlapX <= pair.overlapY) {
    const dir = posA.x < posB.x ? -1 : 1;
    posA.x += dir * halfOverlap;
    posB.x -= dir * halfOverlap;
  } else {
    const dir = posA.z < posB.z ? -1 : 1;
    posA.z += dir * halfOverlap;
    posB.z -= dir * halfOverlap;
  }
}

// ── Player + Wall ─────────────────────────────────────────────────────────

function handlePlayerWall(
  playerId: EntityId,
  wallId: EntityId,
  pair: CollisionPair,
  world: World,
): void {
  pushOut(playerId, wallId, pair, world);
}

// ── Player + Enemy ────────────────────────────────────────────────────────

function handlePlayerEnemy(
  playerId: EntityId,
  enemyId: EntityId,
  pair: CollisionPair,
  world: World,
  eventQueue: EventQueue,
): void {
  pushApart(playerId, enemyId, pair, world);

  const enemy = world.getComponent<Enemy>(enemyId, 'Enemy');
  const aiState = world.getComponent<AIState>(enemyId, 'AIState');
  if (!enemy || !aiState) return;

  // SuicideBomber contact explosion
  if (enemy.enemyType === EnemyType.SuicideBomber && aiState.state === AIBehaviorState.Attack && !enemy.hasExploded) {
    handleSuicideBomberExplosion(enemyId, world, eventQueue);
    return;
  }

  // KnifeRusher contact damage
  if (
    (enemy.enemyType === EnemyType.KnifeRusher) &&
    aiState.state === AIBehaviorState.Attack &&
    !world.hasComponent(playerId, 'Invincible')
  ) {
    const health = world.getComponent<Health>(enemyId, 'Health');
    const playerPos = world.getComponent<Position>(playerId, 'Position');
    if (health && playerPos) {
      const params = getDesignParams();
      const enemyParams = params.enemies.KnifeRusher;
      eventQueue.emit({
        type: EventType.Damage,
        target: playerId,
        amount: enemyParams.baseDamage,
        source: enemyId,
        isCritical: false,
        impactPosition: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
      });
    }
  }
}

// ── SuicideBomber Explosion ───────────────────────────────────────────────

function handleSuicideBomberExplosion(
  bomberId: EntityId,
  world: World,
  eventQueue: EventQueue,
): void {
  const enemy = world.getComponent<Enemy>(bomberId, 'Enemy')!;
  const bomberHealth = world.getComponent<Health>(bomberId, 'Health');
  const bomberPos = world.getComponent<Position>(bomberId, 'Position');
  if (!bomberHealth || !bomberPos) return;

  enemy.hasExploded = true;
  bomberHealth.current = 0;

  const params = getDesignParams();
  const explosionRadius = (params.enemies.SuicideBomber as unknown as { explosionRadius: number }).explosionRadius;
  const explosionDamage = params.enemies.SuicideBomber.baseDamage;

  // Emit explosion effects
  eventQueue.emit({
    type: EventType.Particle,
    effect: ParticleEffect.Explosion,
    position: { x: bomberPos.x, y: bomberPos.y, z: bomberPos.z },
  });
  eventQueue.emit({
    type: EventType.Audio,
    sound: SoundId.Explosion,
    position: { x: bomberPos.x, y: bomberPos.y, z: bomberPos.z },
  });

  // Area damage query — find all entities with Health within explosion radius
  const healthEntities = world.query(['Health', 'Position']);
  for (const targetId of healthEntities) {
    if (targetId === bomberId) continue;
    if (world.hasComponent(targetId, 'Invincible')) continue;

    const targetPos = world.getComponent<Position>(targetId, 'Position')!;
    const dx = targetPos.x - bomberPos.x;
    const dz = targetPos.z - bomberPos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist <= explosionRadius) {
      eventQueue.emit({
        type: EventType.Damage,
        target: targetId,
        amount: explosionDamage,
        source: bomberId,
        isCritical: false,
        impactPosition: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
      });
    }
  }
}

// ── Player + EnemyProjectile ──────────────────────────────────────────────

function handlePlayerEnemyProjectile(
  playerId: EntityId,
  projectileId: EntityId,
  world: World,
  eventQueue: EventQueue,
): void {
  const projectile = world.getComponent<Projectile>(projectileId, 'Projectile');
  if (!projectile) return;

  if (!world.hasComponent(playerId, 'Invincible')) {
    const playerPos = world.getComponent<Position>(playerId, 'Position');
    if (playerPos) {
      eventQueue.emit({
        type: EventType.Damage,
        target: playerId,
        amount: projectile.damage,
        source: projectileId,
        isCritical: false,
        impactPosition: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
      });
    }
  }

  world.destroyEntity(projectileId);
}

// ── Player + Pickup ───────────────────────────────────────────────────────

function handlePlayerPickup(
  playerId: EntityId,
  pickupId: EntityId,
  world: World,
): void {
  const pickup = world.getComponent<Pickup>(pickupId, 'Pickup');
  if (!pickup) return;

  if (pickup.pickupType === PickupType.XPGem) {
    const xpGem = world.getComponent<XPGem>(pickupId, 'XPGem');
    if (xpGem) {
      xpGem.isFlying = true;
    }
  } else {
    // Health, Currency, Gun — set nearPickup flag
    const flags = world.getComponent<ProximityFlags>(playerId, 'ProximityFlags');
    if (flags) {
      flags.nearPickup = true;
    }
  }
}

// ── Player + Hazard ───────────────────────────────────────────────────────

function handlePlayerHazard(
  playerId: EntityId,
  hazardId: EntityId,
  world: World,
  eventQueue: EventQueue,
): void {
  if (world.hasComponent(playerId, 'Invincible')) return;

  const hazard = world.getComponent<Hazard>(hazardId, 'Hazard');
  if (!hazard) return;

  const params = getDesignParams();

  switch (hazard.hazardType) {
    case HazardType.Fire: {
      const existing = world.getComponent<DamageOverTime>(playerId, 'DamageOverTime');
      if (existing) {
        existing.refreshed = true;
      } else {
        world.addComponent<DamageOverTime>(playerId, 'DamageOverTime', {
          damagePerSecond: params.hazards.fire.damagePerSecond,
          sourceType: HazardType.Fire,
          refreshed: true,
        });
      }
      break;
    }
    case HazardType.Spikes: {
      const cooldownRemaining = spikeCooldowns.get(playerId);
      if (cooldownRemaining === undefined || cooldownRemaining <= 0) {
        const playerPos = world.getComponent<Position>(playerId, 'Position');
        eventQueue.emit({
          type: EventType.Damage,
          target: playerId,
          amount: params.hazards.spikes.damage,
          source: hazardId,
          isCritical: false,
          impactPosition: playerPos
            ? { x: playerPos.x, y: playerPos.y, z: playerPos.z }
            : { x: 0, y: 0, z: 0 },
        });
        spikeCooldowns.set(playerId, params.hazards.spikes.cooldown);
      }
      break;
    }
    case HazardType.Water: {
      const existing = world.getComponent<SpeedModifier>(playerId, 'SpeedModifier');
      if (existing) {
        existing.refreshed = true;
      } else {
        world.addComponent<SpeedModifier>(playerId, 'SpeedModifier', {
          multiplier: params.hazards.water.speedMultiplier,
          refreshed: true,
        });
      }
      break;
    }
  }
}

// ── Player + Door ─────────────────────────────────────────────────────────

function handlePlayerDoor(doorId: EntityId, eventQueue: EventQueue): void {
  eventQueue.emit({
    type: EventType.DoorInteract,
    doorEntity: doorId,
  });
}

// ── Player + Chest/Shop/Stairs/SpawnZone ──────────────────────────────────

function handlePlayerChest(playerId: EntityId, world: World): void {
  const flags = world.getComponent<ProximityFlags>(playerId, 'ProximityFlags');
  if (flags) flags.nearChest = true;
}

function handlePlayerShop(playerId: EntityId, world: World): void {
  const flags = world.getComponent<ProximityFlags>(playerId, 'ProximityFlags');
  if (flags) flags.nearShop = true;
}

function handlePlayerStairs(playerId: EntityId, world: World): void {
  const flags = world.getComponent<ProximityFlags>(playerId, 'ProximityFlags');
  if (flags) flags.nearStairs = true;
}

function handlePlayerSpawnZone(spawnZoneId: EntityId, world: World): void {
  const zone = world.getComponent<SpawnZone>(spawnZoneId, 'SpawnZone');
  if (zone && !zone.activated) {
    zone.activated = true;
  }
}

// ── PlayerProjectile + Enemy ──────────────────────────────────────────────

function handlePlayerProjectileEnemy(
  projectileId: EntityId,
  enemyId: EntityId,
  world: World,
  eventQueue: EventQueue,
): void {
  const projectile = world.getComponent<Projectile>(projectileId, 'Projectile');
  if (!projectile) return;

  // Check alreadyHit
  if (projectile.alreadyHit.includes(enemyId)) return;

  const enemyPos = world.getComponent<Position>(enemyId, 'Position');
  if (!enemyPos) return;

  // Shield check
  const shield = world.getComponent<EnemyShield>(enemyId, 'EnemyShield');
  let shieldBlocked = false;

  if (shield && shield.health > 0) {
    const projPos = world.getComponent<Position>(projectileId, 'Position');
    if (projPos) {
      // Direction from enemy to projectile = where the projectile is relative to enemy
      const fromAngle = Math.atan2(projPos.x - enemyPos.x, projPos.z - enemyPos.z);
      // Check if projectile is within the shield's coverage arc
      let angleDiff = fromAngle - shield.facingAngle;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      if (Math.abs(angleDiff) <= shield.coverageArc) {
        // Shield blocks the hit
        shield.health = Math.max(0, shield.health - projectile.damage);
        if (shield.health <= 0) {
          world.removeComponent(enemyId, 'EnemyShield');
        }
        shieldBlocked = true;

        eventQueue.emit({
          type: EventType.Particle,
          effect: ParticleEffect.Sparks,
          position: { x: enemyPos.x, y: enemyPos.y, z: enemyPos.z },
        });
        eventQueue.emit({
          type: EventType.Audio,
          sound: SoundId.EnemyHitArmor,
          position: { x: enemyPos.x, y: enemyPos.y, z: enemyPos.z },
        });
      }
    }
  }

  if (!shieldBlocked) {
    // Deal damage to enemy health
    eventQueue.emit({
      type: EventType.Damage,
      target: enemyId,
      amount: projectile.damage,
      source: projectileId,
      isCritical: projectile.isCritical,
      impactPosition: { x: enemyPos.x, y: enemyPos.y, z: enemyPos.z },
    });

    // Apply knockback
    if (projectile.knockback > 0) {
      const projPos = world.getComponent<Position>(projectileId, 'Position');
      if (projPos) {
        const dx = enemyPos.x - projPos.x;
        const dz = enemyPos.z - projPos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist > 0) {
          world.addComponent(enemyId, 'Knockback', {
            force: projectile.knockback,
            directionX: dx / dist,
            directionY: dz / dist,
          });
        }
      }
    }
  }

  // Handle piercing
  if (projectile.piercingRemaining > 0) {
    projectile.piercingRemaining--;
    projectile.alreadyHit.push(enemyId);
    return;
  }

  // Handle bouncing
  if (projectile.bouncesRemaining > 0) {
    projectile.bouncesRemaining--;
    projectile.alreadyHit.push(enemyId);
    // Reflect velocity away from enemy center
    const projPos = world.getComponent<Position>(projectileId, 'Position');
    const vel = world.getComponent<Velocity>(projectileId, 'Velocity');
    if (projPos && vel) {
      const dx = projPos.x - enemyPos.x;
      const dz = projPos.z - enemyPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist > 0) {
        const nx = dx / dist;
        const nz = dz / dist;
        const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
        vel.x = nx * speed;
        vel.z = nz * speed;
      }
    }
    return;
  }

  // No piercing or bouncing — destroy projectile
  world.destroyEntity(projectileId);
}

// ── PlayerProjectile + Wall ───────────────────────────────────────────────

function handleProjectileWall(
  projectileId: EntityId,
  wallId: EntityId,
  pair: CollisionPair,
  world: World,
): void {
  const projectile = world.getComponent<Projectile>(projectileId, 'Projectile');
  if (!projectile) {
    world.destroyEntity(projectileId);
    return;
  }

  if (projectile.bouncesRemaining > 0) {
    projectile.bouncesRemaining--;
    const vel = world.getComponent<Velocity>(projectileId, 'Velocity');
    if (vel) {
      // Reflect along the axis of minimum overlap
      if (pair.overlapX <= pair.overlapY) {
        vel.x = -vel.x;
      } else {
        vel.z = -vel.z;
      }
    }
    // Push projectile out of wall to prevent re-collision
    const projPos = world.getComponent<Position>(projectileId, 'Position');
    const wallPos = world.getComponent<Position>(wallId, 'Position');
    if (projPos && wallPos) {
      if (pair.overlapX <= pair.overlapY) {
        projPos.x += projPos.x < wallPos.x ? -pair.overlapX : pair.overlapX;
      } else {
        projPos.z += projPos.z < wallPos.z ? -pair.overlapY : pair.overlapY;
      }
    }
    return;
  }

  world.destroyEntity(projectileId);
}

// ── PlayerProjectile + Destructible ───────────────────────────────────────

function handlePlayerProjectileDestructible(
  projectileId: EntityId,
  destructibleId: EntityId,
  world: World,
  eventQueue: EventQueue,
): void {
  const projectile = world.getComponent<Projectile>(projectileId, 'Projectile');
  if (!projectile) {
    world.destroyEntity(projectileId);
    return;
  }

  const destPos = world.getComponent<Position>(destructibleId, 'Position');
  const impactPos = destPos
    ? { x: destPos.x, y: destPos.y, z: destPos.z }
    : { x: 0, y: 0, z: 0 };

  // Emit damage for destructible
  eventQueue.emit({
    type: EventType.Damage,
    target: destructibleId,
    amount: projectile.damage,
    source: projectileId,
    isCritical: projectile.isCritical,
    impactPosition: impactPos,
  });

  // Handle piercing
  if (projectile.piercingRemaining > 0) {
    projectile.piercingRemaining--;
    projectile.alreadyHit.push(destructibleId);
    return;
  }

  world.destroyEntity(projectileId);
}
