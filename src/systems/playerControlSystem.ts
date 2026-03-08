/**
 * PlayerControlSystem — Translates InputState into player entity changes:
 * velocity from movement, rotation from aim, fire requests, reload,
 * dodge roll initiation, interact/upgrade/pause flags.
 *
 * System execution order: 2 (after InputSystem, before DodgeRollSystem).
 *
 * Integration: Called by the game loop each fixed-timestep tick with the
 * InputState produced by InputSystem.
 */
import type { InputState } from '../input/inputManager';
import type { World } from '../ecs/world';
import type {
  Position,
  Velocity,
  Rotation,
  Player,
  DodgeRoll,
  Gun,
  SpeedModifier,
} from '../ecs/components';
import { WeaponSlot, AppState } from '../ecs/components';
import { getDesignParams } from '../config/designParams';
import { useAppStore } from '../store/appStore';

/**
 * Check whether a gun has enough XP to upgrade any trait by at least one level.
 */
function canUpgradeGun(gun: Gun): boolean {
  const params = getDesignParams();
  const { xpCosts, maxLevel } = params.traits;
  for (let i = 0; i < gun.traits.length; i++) {
    const level = gun.traitLevels[i];
    if (level < maxLevel && gun.xp >= xpCosts[level]) {
      return true;
    }
  }
  return false;
}

export function playerControlSystem(world: World, input: InputState, _dt: number): void {
  const params = getDesignParams();
  const movementSpeed = params.player.baseMovementSpeed;
  const rollSpeed = params.player.dodgeRoll.speed;
  const rollDuration = params.player.dodgeRoll.duration;
  const rollCooldown = params.player.dodgeRoll.cooldown;

  const playerIds = world.query(['Player', 'Position', 'Velocity', 'Rotation']);
  for (const id of playerIds) {
    const player = world.getComponent<Player>(id, 'Player')!;
    const position = world.getComponent<Position>(id, 'Position')!;
    const velocity = world.getComponent<Velocity>(id, 'Velocity')!;
    const rotation = world.getComponent<Rotation>(id, 'Rotation')!;
    const dodgeRoll = world.getComponent<DodgeRoll>(id, 'DodgeRoll');

    // ── Dodge Roll Initiation ──────────────────────────────────────────
    if (input.dodgeRoll && dodgeRoll && !dodgeRoll.isRolling && dodgeRoll.cooldownRemaining <= 0) {
      // Determine roll direction from movement input, or default to facing direction
      let rdx = input.moveX;
      let rdy = input.moveY;
      const rmag = Math.sqrt(rdx * rdx + rdy * rdy);
      if (rmag > 0) {
        rdx /= rmag;
        rdy /= rmag;
      } else {
        // Roll in facing direction
        rdx = Math.sin(rotation.y);
        rdy = Math.cos(rotation.y);
      }
      dodgeRoll.isRolling = true;
      dodgeRoll.rollTimer = rollDuration;
      dodgeRoll.cooldownRemaining = rollCooldown;
      dodgeRoll.rollDirectionX = rdx;
      dodgeRoll.rollDirectionY = rdy;
    }

    // ── Velocity ───────────────────────────────────────────────────────
    if (dodgeRoll?.isRolling) {
      // Rolling overrides velocity — ignores movement input
      velocity.x = dodgeRoll.rollDirectionX * rollSpeed;
      velocity.z = dodgeRoll.rollDirectionY * rollSpeed;
    } else {
      // Normal movement
      let mx = input.moveX;
      let mz = input.moveY;

      // Normalize diagonal so magnitude doesn't exceed 1
      const mag = Math.sqrt(mx * mx + mz * mz);
      if (mag > 1) {
        mx /= mag;
        mz /= mag;
      }

      let speed = movementSpeed;

      // Apply SpeedModifier if present
      const speedMod = world.getComponent<SpeedModifier>(id, 'SpeedModifier');
      if (speedMod) {
        speed *= speedMod.multiplier;
      }

      velocity.x = mx * speed;
      velocity.z = mz * speed;
    }

    // ── Rotation (aim) ─────────────────────────────────────────────────
    const dx = input.aimWorldX - position.x;
    const dz = input.aimWorldY - position.z;
    rotation.y = Math.atan2(dx, dz);

    // ── Gun references ─────────────────────────────────────────────────
    const sidearmGun = world.getComponent<Gun>(player.sidearmSlot, 'Gun');
    const longArmGun = world.getComponent<Gun>(player.longArmSlot, 'Gun');

    // Clear fireRequested on both guns each frame
    if (sidearmGun) sidearmGun.fireRequested = false;
    if (longArmGun) longArmGun.fireRequested = false;

    // ── Fire ───────────────────────────────────────────────────────────
    // At most one gun fires per frame. Sidearm takes priority if both pressed.
    let fired = false;

    if (input.fireSidearm && sidearmGun && !fired) {
      player.activeSlot = WeaponSlot.Sidearm;
      sidearmGun.fireRequested = true;
      fired = true;
    }

    if (input.fireLongArm && longArmGun && !fired) {
      player.activeSlot = WeaponSlot.LongArm;
      longArmGun.fireRequested = true;
      fired = true;
    }

    // ── Reload ─────────────────────────────────────────────────────────
    if (input.reload) {
      const activeGun = player.activeSlot === WeaponSlot.Sidearm ? sidearmGun : longArmGun;
      if (activeGun && !activeGun.isReloading) {
        activeGun.isReloading = true;
        activeGun.reloadTimer = activeGun.reloadTime;
      }
    }

    // ── Open Upgrade ───────────────────────────────────────────────────
    if (input.openUpgrade) {
      const activeGun = player.activeSlot === WeaponSlot.Sidearm ? sidearmGun : longArmGun;
      if (activeGun && canUpgradeGun(activeGun)) {
        useAppStore.getState().transition(AppState.GunUpgrade);
      }
    }

    // ── Pause ──────────────────────────────────────────────────────────
    if (input.pause) {
      useAppStore.getState().transition(AppState.Paused);
    }
  }
}
