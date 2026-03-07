import { World } from '../ecs/world';
import { GunType, WeaponSlot, SoundId, ParticleEffect, EventType } from '../ecs/components';
import type { Gun, Player, Position, Rotation, Projectile } from '../ecs/components';
import { createPlayerBullet } from '../ecs/factories';
import { EventQueue } from '../gameloop/events';
import type { EntityId } from '../types';

const GUN_FIRE_SOUNDS: Record<GunType, SoundId> = {
  [GunType.Pistol]: SoundId.PistolFire,
  [GunType.SMG]: SoundId.SMGFire,
  [GunType.AssaultRifle]: SoundId.AssaultRifleFire,
  [GunType.Shotgun]: SoundId.ShotgunFire,
  [GunType.LMG]: SoundId.LMGFire,
};

/**
 * ProjectileSystem — handles player gun firing, reload timers, projectile spawning.
 * Runs at position 5 in the game loop, after PlayerControlSystem (2) and DodgeRollSystem (3).
 */
export function projectileSystem(
  world: World,
  dt: number,
  eventQueue: EventQueue,
  rng: () => number = Math.random,
): void {
  const playerEntities = world.query(['Player', 'Position', 'Rotation']);

  for (const playerId of playerEntities) {
    const player = world.getComponent<Player>(playerId, 'Player')!;
    const playerPos = world.getComponent<Position>(playerId, 'Position')!;
    const playerRot = world.getComponent<Rotation>(playerId, 'Rotation')!;

    processGun(world, dt, eventQueue, rng, playerId, player.sidearmSlot, WeaponSlot.Sidearm, playerPos, playerRot);
    processGun(world, dt, eventQueue, rng, playerId, player.longArmSlot, WeaponSlot.LongArm, playerPos, playerRot);
  }
}

function processGun(
  world: World,
  dt: number,
  eventQueue: EventQueue,
  rng: () => number,
  playerId: EntityId,
  gunEntityId: EntityId,
  slot: WeaponSlot,
  playerPos: Position,
  playerRot: Rotation,
): void {
  const gun = world.getComponent<Gun>(gunEntityId, 'Gun');
  if (!gun) return;

  // Tick fire cooldown
  if (gun.fireCooldown > 0) {
    gun.fireCooldown -= dt;
  }

  // Tick reload timer
  if (gun.isReloading) {
    gun.reloadTimer -= dt;
    if (gun.reloadTimer <= 0) {
      gun.currentAmmo = gun.magazineSize;
      gun.isReloading = false;
    }
  }

  // Process fire request
  const wasRequested = gun.fireRequested;
  gun.fireRequested = false;

  if (wasRequested) {
    if (!gun.isReloading && gun.fireCooldown <= 0 && gun.currentAmmo > 0) {
      // Fire
      gun.fireCooldown = 1 / gun.fireRate;
      gun.currentAmmo -= 1;

      const aimAngle = playerRot.y;

      for (let i = 0; i < gun.projectileCount; i++) {
        // Spread: random offset within [-spread/2, +spread/2]
        const spreadOffset = (rng() - 0.5) * gun.spread;
        const bulletAngle = aimAngle + spreadOffset;

        const vx = Math.sin(bulletAngle) * gun.projectileSpeed;
        const vz = Math.cos(bulletAngle) * gun.projectileSpeed;

        // Crit roll per bullet
        const isCrit = rng() < gun.critChance;
        const bulletDamage = isCrit ? gun.damage * gun.critMultiplier : gun.damage;

        const bulletId = createPlayerBullet(
          world,
          { x: playerPos.x, y: playerPos.y, z: playerPos.z },
          { x: vx, y: 0, z: vz },
          { ...gun, damage: bulletDamage },
          playerId,
          slot,
        );

        // Set isCritical on the projectile
        if (isCrit) {
          const proj = world.getComponent<Projectile>(bulletId, 'Projectile');
          if (proj) {
            proj.isCritical = true;
          }
        }
      }

      // Muzzle flash particle
      eventQueue.emit({
        type: EventType.Particle,
        effect: ParticleEffect.MuzzleFlash,
        position: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
      });

      // Fire sound
      eventQueue.emit({
        type: EventType.Audio,
        sound: GUN_FIRE_SOUNDS[gun.gunType],
        position: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
      });
    } else if (gun.currentAmmo <= 0 && !gun.isReloading) {
      // Empty mag: play click, start reload
      eventQueue.emit({
        type: EventType.Audio,
        sound: SoundId.EmptyClipClick,
        position: { x: playerPos.x, y: playerPos.y, z: playerPos.z },
      });
      gun.isReloading = true;
      gun.reloadTimer = gun.reloadTime;
    }
  }
}
