import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import {
  EventType,
  ParticleEffect,
  SoundId,
  EnemyType,
  WeaponSlot,
} from '../ecs/components';
import type {
  Health,
  Enemy,
  Player,
  Position,
} from '../ecs/components';
import { createXPGem, createCurrency, createHealthPickup } from '../ecs/factories';
import { getDesignParams } from '../config/designParams';
import type { BaseEnemyParams, SuicideBomberParams } from '../config/designParams';
import { useAppStore } from '../store/appStore';
import { AppState } from '../ecs/components';

const ENEMY_PARAM_KEYS: Record<EnemyType, string> = {
  [EnemyType.KnifeRusher]: 'KnifeRusher',
  [EnemyType.ShieldGun]: 'ShieldGun',
  [EnemyType.Shotgunner]: 'Shotgunner',
  [EnemyType.Rifleman]: 'Rifleman',
  [EnemyType.SuicideBomber]: 'SuicideBomber',
};

/**
 * DeathSystem — position 23 in system execution order.
 * Handles entity death: enemy loot drops, bomber explosion, boss victory, player death.
 */
export function deathSystem(world: World, eventQueue: EventQueue): void {
  processPlayerDeath(world);
  processEnemyDeaths(world, eventQueue);
}

function processPlayerDeath(world: World): void {
  const players = world.query(['PlayerTag', 'Health']);
  for (const playerId of players) {
    const health = world.getComponent<Health>(playerId, 'Health');
    if (!health || health.current > 0) continue;

    useAppStore.getState().transition(AppState.Death);
    // Player is NOT destroyed — Death screen needs the entity
  }
}

function processEnemyDeaths(world: World, eventQueue: EventQueue): void {
  const params = getDesignParams();
  const enemies = world.query(['EnemyTag', 'Health', 'Enemy', 'Position']);
  const entitiesToDestroy: number[] = [];

  for (const entityId of enemies) {
    const health = world.getComponent<Health>(entityId, 'Health');
    if (!health || health.current > 0) continue;

    const enemy = world.getComponent<Enemy>(entityId, 'Enemy')!;
    const position = world.getComponent<Position>(entityId, 'Position')!;

    // SuicideBomber explosion check
    if (enemy.enemyType === EnemyType.SuicideBomber && !enemy.hasExploded) {
      handleBomberExplosion(world, eventQueue, entityId, position, params);
    }

    // Boss death → Victory
    if (world.hasComponent(entityId, 'BossTag')) {
      useAppStore.getState().transition(AppState.Victory);
    }

    // Loot drops
    spawnLootDrops(world, enemy, position, health, params);

    // Death effects
    eventQueue.emit({
      type: EventType.Particle,
      effect: ParticleEffect.BloodSplat,
      position: { x: position.x, y: position.y, z: position.z },
    });
    eventQueue.emit({
      type: EventType.Audio,
      sound: SoundId.EnemyDeath,
      position: { x: position.x, y: position.y, z: position.z },
    });

    entitiesToDestroy.push(entityId);
  }

  // Destroy all dead enemies after processing
  for (const id of entitiesToDestroy) {
    world.destroyEntity(id);
  }
}

function handleBomberExplosion(
  world: World,
  eventQueue: EventQueue,
  bomberId: number,
  bomberPos: Position,
  params: ReturnType<typeof getDesignParams>,
): void {
  const bomberParams = params.enemies.SuicideBomber as SuicideBomberParams;
  const radius = bomberParams.explosionRadius;
  const damage = bomberParams.baseDamage;
  const radiusSq = radius * radius;

  // Query all entities with Health + Position for area damage
  const targets = world.query(['Health', 'Position']);
  for (const targetId of targets) {
    if (targetId === bomberId) continue; // Skip self

    const targetPos = world.getComponent<Position>(targetId, 'Position')!;
    const dx = targetPos.x - bomberPos.x;
    const dz = targetPos.z - bomberPos.z;
    const distSq = dx * dx + dz * dz;

    if (distSq <= radiusSq) {
      eventQueue.emit({
        type: EventType.Damage,
        target: targetId,
        amount: damage,
        source: bomberId,
        isCritical: false,
        impactPosition: { x: targetPos.x, y: targetPos.y, z: targetPos.z },
      });
    }
  }

  // Explosion effects
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
}

function spawnLootDrops(
  world: World,
  enemy: Enemy,
  position: Position,
  health: Health,
  params: ReturnType<typeof getDesignParams>,
): void {
  const paramKey = ENEMY_PARAM_KEYS[enemy.enemyType];
  const enemyParams = params.enemies[paramKey as keyof typeof params.enemies] as BaseEnemyParams;

  // XP gem
  let xpAmount = enemyParams.xpDrop;
  if (enemy.isMini) {
    xpAmount *= params.enemies.depthScaling.miniBossXPMultiplier;
  }

  const sourceGunEntityId = resolveSourceGunEntity(world, health);
  if (sourceGunEntityId !== null) {
    createXPGem(
      world,
      { x: position.x, y: position.y, z: position.z },
      sourceGunEntityId,
      xpAmount,
    );
  }

  // Currency drop
  if (Math.random() < enemyParams.currencyDropChance) {
    createCurrency(
      world,
      { x: position.x, y: position.y, z: position.z },
      enemyParams.currencyDropAmount,
    );
  }

  // Health pickup drop
  if (Math.random() < params.dungeon.healthPickupDropChance) {
    createHealthPickup(
      world,
      { x: position.x, y: position.y, z: position.z },
      params.player.baseHealth * 0.2,
    );
  }
}

function resolveSourceGunEntity(world: World, health: Health): number | null {
  const slot = health.lastDamageSourceGunSlot;

  // Find the player entity to look up the gun
  const players = world.query(['PlayerTag', 'Player']);
  if (players.length === 0) return null;

  const player = world.getComponent<Player>(players[0], 'Player');
  if (!player) return null;

  if (slot === WeaponSlot.Sidearm) return player.sidearmSlot;
  if (slot === WeaponSlot.LongArm) return player.longArmSlot;

  // Fallback: lastDamageSourceGunSlot is null — use active gun
  if (player.activeSlot === WeaponSlot.Sidearm) return player.sidearmSlot;
  return player.longArmSlot;
}
