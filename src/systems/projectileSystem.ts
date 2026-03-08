import { World } from '../ecs/world';
import { GunType, WeaponSlot, SoundId, ParticleEffect, EventType } from '../ecs/components';
import type { Gun, Player, Position, Rotation, Projectile } from '../ecs/components';
import { createPlayerBullet } from '../ecs/factories';
import { EventQueue } from '../gameloop/events';
import { getDesignParams } from '../config/designParams';
import type { EntityId } from '../types';

export interface AimTarget {
  x: number;
  y: number;
  z: number;
}

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
 *
 * aimTarget: world XZ point where the camera crosshair hits the ground plane.
 * Bullets are spawned at a muzzle offset from the player and directed toward this point.
 */
export function projectileSystem(
  world: World,
  dt: number,
  eventQueue: EventQueue,
  aimTarget?: AimTarget,
  rng: () => number = Math.random,
): void {
  const playerEntities = world.query(['Player', 'Position', 'Rotation']);

  for (const playerId of playerEntities) {
    const player = world.getComponent<Player>(playerId, 'Player')!;
    const playerPos = world.getComponent<Position>(playerId, 'Position')!;
    const playerRot = world.getComponent<Rotation>(playerId, 'Rotation')!;

    processGun(world, dt, eventQueue, rng, playerId, player.sidearmSlot, WeaponSlot.Sidearm, playerPos, playerRot, aimTarget);
    processGun(world, dt, eventQueue, rng, playerId, player.longArmSlot, WeaponSlot.LongArm, playerPos, playerRot, aimTarget);
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
  aimTarget?: AimTarget,
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

      const params = getDesignParams();
      const { muzzleForwardOffset, muzzleHeight } = params.projectiles;

      // Muzzle position: offset forward from player center
      const faceFwdX = -Math.sin(playerRot.y);
      const faceFwdZ = -Math.cos(playerRot.y);
      const muzzleX = playerPos.x + faceFwdX * muzzleForwardOffset;
      const muzzleY = muzzleHeight;
      const muzzleZ = playerPos.z + faceFwdZ * muzzleForwardOffset;

      // 3D aim direction: from muzzle toward BVH raycast hit point,
      // falling back to the player's facing direction if no aim target.
      let baseDirX = faceFwdX;
      let baseDirY = 0;
      let baseDirZ = faceFwdZ;
      if (aimTarget) {
        const toAimX = aimTarget.x - muzzleX;
        const toAimY = aimTarget.y - muzzleY;
        const toAimZ = aimTarget.z - muzzleZ;
        const toAimMag = Math.sqrt(toAimX * toAimX + toAimY * toAimY + toAimZ * toAimZ);
        if (toAimMag > 0.01) {
          baseDirX = toAimX / toAimMag;
          baseDirY = toAimY / toAimMag;
          baseDirZ = toAimZ / toAimMag;
        }
      }

      // Horizontal angle for spread application
      const baseAngle = Math.atan2(-baseDirX, -baseDirZ);
      // Pitch angle (elevation)
      const basePitch = Math.asin(baseDirY);

      for (let i = 0; i < gun.projectileCount; i++) {
        // Spread: random offset within [-spread/2, +spread/2] on horizontal angle
        const spreadOffset = (rng() - 0.5) * gun.spread;
        const bulletAngle = baseAngle + spreadOffset;

        const cp = Math.cos(basePitch);
        const vx = -Math.sin(bulletAngle) * cp * gun.projectileSpeed;
        const vy = Math.sin(basePitch) * gun.projectileSpeed;
        const vz = -Math.cos(bulletAngle) * cp * gun.projectileSpeed;

        // Crit roll per bullet
        const isCrit = rng() < gun.critChance;
        const bulletDamage = isCrit ? gun.damage * gun.critMultiplier : gun.damage;

        const bulletId = createPlayerBullet(
          world,
          { x: muzzleX, y: muzzleY, z: muzzleZ },
          { x: vx, y: vy, z: vz },
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

      // Muzzle flash particle at muzzle position
      eventQueue.emit({
        type: EventType.Particle,
        effect: ParticleEffect.MuzzleFlash,
        position: { x: muzzleX, y: muzzleY, z: muzzleZ },
      });

      // Fire sound
      eventQueue.emit({
        type: EventType.Audio,
        sound: GUN_FIRE_SOUNDS[gun.gunType],
        position: { x: muzzleX, y: muzzleY, z: muzzleZ },
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
