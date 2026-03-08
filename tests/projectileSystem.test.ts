import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { projectileSystem } from '../src/systems/projectileSystem';
import {
  GunType,
  GunCategory,
  GunTrait,
  WeaponSlot,
  SoundId,
  EventType,
} from '../src/ecs/components';
import type {
  Gun,
  Player,
  Position,
  Rotation,
  Projectile,
  Velocity,
  DodgeRoll,
  Health,
} from '../src/ecs/components';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeGun(overrides: Partial<Gun> = {}): Gun {
  return {
    gunType: GunType.Pistol,
    category: GunCategory.Sidearm,
    baseDamage: 15,
    baseFireRate: 3,
    baseMagazineSize: 12,
    baseReloadTime: 1,
    baseSpread: 0.02,
    baseProjectileCount: 1,
    baseProjectileSpeed: 30,
    baseKnockback: 0.5,
    baseCritChance: 0.05,
    baseCritMultiplier: 2,
    damage: 15,
    fireRate: 3,
    magazineSize: 12,
    reloadTime: 1,
    spread: 0.02,
    projectileCount: 1,
    projectileSpeed: 30,
    knockback: 0.5,
    critChance: 0.05,
    critMultiplier: 2,
    currentAmmo: 12,
    isReloading: false,
    reloadTimer: 0,
    fireCooldown: 0,
    fireRequested: false,
    traits: [GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
    ...overrides,
  };
}

function createGunEntity(world: World, gun: Gun): number {
  const id = world.createEntity();
  world.addComponent<Gun>(id, 'Gun', gun);
  return id;
}

function createTestPlayer(
  world: World,
  sidearmOverrides: Partial<Gun> = {},
  longArmOverrides: Partial<Gun> = {},
  pos: Position = { x: 0, y: 0, z: 0 },
  rot: Rotation = { y: 0 },
): { playerId: number; sidearmId: number; longArmId: number } {
  const sidearmId = createGunEntity(world, makeGun(sidearmOverrides));
  const longArmId = createGunEntity(
    world,
    makeGun({
      gunType: GunType.AssaultRifle,
      category: GunCategory.LongArm,
      ...longArmOverrides,
    }),
  );

  const playerId = world.createEntity();
  world.addComponent<Position>(playerId, 'Position', pos);
  world.addComponent<Rotation>(playerId, 'Rotation', rot);
  world.addComponent<Player>(playerId, 'Player', {
    sidearmSlot: sidearmId,
    longArmSlot: longArmId,
    activeSlot: WeaponSlot.LongArm,
    currency: 0,
  });
  world.addComponent<Health>(playerId, 'Health', {
    current: 100,
    max: 100,
    lastDamageSourceGunSlot: null,
  });
  world.addComponent<DodgeRoll>(playerId, 'DodgeRoll', {
    cooldownRemaining: 0,
    isRolling: false,
    rollTimer: 0,
    rollDirectionX: 0,
    rollDirectionY: 0,
  });
  world.addComponent(playerId, 'PlayerTag', {});

  return { playerId, sidearmId, longArmId };
}

function getGun(world: World, id: number): Gun {
  return world.getComponent<Gun>(id, 'Gun')!;
}

function countBullets(world: World): number {
  return world.query(['Projectile', 'PlayerProjectileTag']).length;
}

function getBulletProjectiles(world: World): { id: number; proj: Projectile; vel: Velocity }[] {
  return world.query(['Projectile', 'PlayerProjectileTag']).map((id) => ({
    id,
    proj: world.getComponent<Projectile>(id, 'Projectile')!,
    vel: world.getComponent<Velocity>(id, 'Velocity')!,
  }));
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ProjectileSystem', () => {
  describe('fireCooldown', () => {
    it('decrements fireCooldown by dt each frame', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, { fireCooldown: 0.5 });

      projectileSystem(world, 0.016, eq);
      expect(getGun(world, sidearmId).fireCooldown).toBeCloseTo(0.484, 5);
    });

    it('property: fireCooldown decreases by dt for any positive cooldown', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.001), max: Math.fround(10), noNaN: true }),
          fc.float({ min: Math.fround(0.001), max: Math.fround(0.1), noNaN: true }),
          (cooldown, dt) => {
            const world = new World();
            const eq = new EventQueue();
            createTestPlayer(world, { fireCooldown: cooldown });

            projectileSystem(world, dt, eq);
            // fireCooldown should have decreased
            const guns = world.query(['Gun']);
            const gun = world.getComponent<Gun>(guns[0], 'Gun')!;
            expect(gun.fireCooldown).toBeCloseTo(cooldown - dt, 5);
          },
        ),
      );
    });
  });

  describe('fireRequested clearing', () => {
    it('clears fireRequested even when conditions not met (cooldown > 0)', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        fireCooldown: 0.5,
      });

      projectileSystem(world, 0.016, eq);
      expect(getGun(world, sidearmId).fireRequested).toBe(false);
      expect(countBullets(world)).toBe(0);
    });

    it('clears fireRequested on both guns', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId, longArmId } = createTestPlayer(
        world,
        { fireRequested: true, fireCooldown: 1 },
        { fireRequested: true, fireCooldown: 1 },
      );

      projectileSystem(world, 0.016, eq);
      expect(getGun(world, sidearmId).fireRequested).toBe(false);
      expect(getGun(world, longArmId).fireRequested).toBe(false);
    });

    it('does not crash when no player exists (gun entity with fireRequested)', () => {
      const world = new World();
      const eq = new EventQueue();
      // Gun exists but no player references it
      const gunId = createGunEntity(world, makeGun({ fireRequested: true }));

      // System should not crash - it only processes player-owned guns
      expect(() => projectileSystem(world, 0.016, eq)).not.toThrow();
      // Gun's fireRequested is NOT cleared because no player references it
      // (the system only iterates player entities)
      expect(getGun(world, gunId).fireRequested).toBe(true);
    });
  });

  describe('firing', () => {
    it('fires when conditions met: cooldown <= 0, ammo > 0, not reloading', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, {
        fireRequested: true,
        fireCooldown: 0,
        currentAmmo: 12,
        isReloading: false,
      });

      projectileSystem(world, 0.016, eq);
      expect(countBullets(world)).toBe(1);
    });

    it('sets fireCooldown to 1/fireRate on fire', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        fireRate: 3,
      });

      projectileSystem(world, 0.016, eq);
      // fireCooldown was 0, would be decremented by dt first (stays 0 since > check),
      // then set to 1/3 on fire
      expect(getGun(world, sidearmId).fireCooldown).toBeCloseTo(1 / 3, 5);
    });

    it('decrements ammo by 1 on fire', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        currentAmmo: 5,
      });

      projectileSystem(world, 0.016, eq);
      expect(getGun(world, sidearmId).currentAmmo).toBe(4);
    });

    it('fire cooldown precision at high fire rate (SMG)', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        fireRate: 12,
      });

      projectileSystem(world, 1 / 60, eq);
      const gun = getGun(world, sidearmId);
      expect(gun.fireCooldown).toBeCloseTo(1 / 12, 10);
    });
  });

  describe('shotgun projectile count', () => {
    it('spawns exactly projectileCount bullets', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 6,
        gunType: GunType.Shotgun,
        category: GunCategory.LongArm,
      });

      projectileSystem(world, 0.016, eq);
      expect(countBullets(world)).toBe(6);
    });

    it('property: spawns exactly projectileCount for any count', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (count) => {
          const world = new World();
          const eq = new EventQueue();
          createTestPlayer(world, {
            fireRequested: true,
            projectileCount: count,
          });

          projectileSystem(world, 0.016, eq);
          expect(countBullets(world)).toBe(count);
        }),
      );
    });
  });

  describe('spread distribution', () => {
    it('bullet angles within spread/2 of aim direction', () => {
      const world = new World();
      const eq = new EventQueue();
      const aimAngle = Math.PI / 4;
      const spread = 0.15;

      createTestPlayer(
        world,
        {
          fireRequested: true,
          projectileCount: 6,
          spread,
          projectileSpeed: 30,
        },
        {},
        { x: 0, y: 0, z: 0 },
        { y: aimAngle },
      );

      projectileSystem(world, 0.016, eq);

      const bullets = getBulletProjectiles(world);
      expect(bullets.length).toBe(6);

      for (const b of bullets) {
        const bulletAngle = Math.atan2(-b.vel.x, -b.vel.z);
        const diff = Math.abs(bulletAngle - aimAngle);
        expect(diff).toBeLessThanOrEqual(spread / 2 + 1e-9);
      }
    });

    it('bullets have distinct offsets (not all same angle)', () => {
      const world = new World();
      const eq = new EventQueue();

      // Use a deterministic rng that returns different values
      let callCount = 0;
      const rng = () => {
        callCount++;
        return (callCount % 10) / 10;
      };

      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 6,
        spread: 0.15,
        projectileSpeed: 30,
        critChance: 0, // no crits to simplify
      });

      projectileSystem(world, 0.016, eq, undefined, rng);

      const bullets = getBulletProjectiles(world);
      const angles = bullets.map((b) => Math.atan2(-b.vel.x, -b.vel.z));
      const unique = new Set(angles.map((a) => a.toFixed(6)));
      expect(unique.size).toBeGreaterThan(1);
    });
  });

  describe('crit roll', () => {
    it('crit roll per bullet independently', () => {
      const world = new World();
      const eq = new EventQueue();

      // Deterministic rng: alternate between crit and non-crit
      // Each bullet uses 2 rng calls: spread + crit
      let call = 0;
      const rng = () => {
        call++;
        // Odd calls = spread (return 0.5 = no offset), Even calls = crit
        if (call % 2 === 1) return 0.5; // spread: (0.5 - 0.5) * spread = 0
        // For crit: alternate hit/miss with critChance = 0.5
        return call % 4 === 0 ? 0.3 : 0.7; // 0.3 < 0.5 = crit, 0.7 >= 0.5 = no crit
      };

      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 4,
        critChance: 0.5,
        critMultiplier: 2,
        damage: 10,
        spread: 0,
      });

      projectileSystem(world, 0.016, eq, undefined, rng);

      const bullets = getBulletProjectiles(world);
      expect(bullets.length).toBe(4);

      const critCount = bullets.filter((b) => b.proj.isCritical).length;
      const nonCritCount = bullets.filter((b) => !b.proj.isCritical).length;
      // With our rng pattern, we should have a mix
      expect(critCount).toBeGreaterThan(0);
      expect(nonCritCount).toBeGreaterThan(0);
    });

    it('crit damage multiplication: damage * critMultiplier', () => {
      const world = new World();
      const eq = new EventQueue();

      // Force crit: rng always returns 0 (< any critChance)
      const rng = () => 0;

      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 1,
        critChance: 1.0,
        critMultiplier: 2.0,
        damage: 10,
        spread: 0,
      });

      projectileSystem(world, 0.016, eq, undefined, rng);

      const bullets = getBulletProjectiles(world);
      expect(bullets.length).toBe(1);
      expect(bullets[0].proj.isCritical).toBe(true);
      expect(bullets[0].proj.damage).toBe(20);
    });

    it('critChance = 0 means no bullet is critical', () => {
      const world = new World();
      const eq = new EventQueue();

      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 10,
        critChance: 0,
        damage: 10,
      });

      projectileSystem(world, 0.016, eq);

      const bullets = getBulletProjectiles(world);
      expect(bullets.every((b) => !b.proj.isCritical)).toBe(true);
      expect(bullets.every((b) => b.proj.damage === 10)).toBe(true);
    });

    it('critChance = 1 means every bullet is critical', () => {
      const world = new World();
      const eq = new EventQueue();

      // rng returns 0.5 for spread, 0.5 for crit (0.5 < 1.0 = crit)
      const rng = () => 0.5;

      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 5,
        critChance: 1.0,
        critMultiplier: 2.0,
        damage: 10,
      });

      projectileSystem(world, 0.016, eq, undefined, rng);

      const bullets = getBulletProjectiles(world);
      expect(bullets.every((b) => b.proj.isCritical)).toBe(true);
      expect(bullets.every((b) => b.proj.damage === 20)).toBe(true);
    });
  });

  describe('empty magazine and reload', () => {
    it('empty mag + fire attempt: EmptyClipClick sound and starts reload', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        currentAmmo: 0,
        isReloading: false,
        fireCooldown: 0,
        reloadTime: 1.5,
      });

      projectileSystem(world, 0.016, eq);

      const gun = getGun(world, sidearmId);
      expect(gun.isReloading).toBe(true);
      expect(gun.reloadTimer).toBe(1.5);
      expect(countBullets(world)).toBe(0);

      // Check EmptyClipClick sound was emitted
      const audioEvents = eq.consume(EventType.Audio);
      expect(audioEvents.some((e) => e.sound === SoundId.EmptyClipClick)).toBe(true);
    });

    it('already reloading + fire attempt: does not restart reload', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        currentAmmo: 0,
        isReloading: true,
        reloadTimer: 0.5,
      });

      projectileSystem(world, 0.016, eq);

      const gun = getGun(world, sidearmId);
      // reloadTimer should have been decremented by dt, not reset
      expect(gun.reloadTimer).toBeCloseTo(0.5 - 0.016, 5);
      expect(gun.isReloading).toBe(true);

      // No EmptyClipClick sound
      const audioEvents = eq.consume(EventType.Audio);
      expect(audioEvents.some((e) => e.sound === SoundId.EmptyClipClick)).toBe(false);
    });

    it('reload timer completes: ammo restored, isReloading = false', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        currentAmmo: 0,
        isReloading: true,
        reloadTimer: 0.01,
        magazineSize: 12,
      });

      projectileSystem(world, 0.016667, eq);

      const gun = getGun(world, sidearmId);
      expect(gun.currentAmmo).toBe(12);
      expect(gun.isReloading).toBe(false);
    });
  });

  describe('both guns reload simultaneously', () => {
    it('both guns tick their reload timers independently', () => {
      const world = new World();
      const eq = new EventQueue();
      const dt = 0.016667;
      const { sidearmId, longArmId } = createTestPlayer(
        world,
        {
          isReloading: true,
          reloadTimer: 1.0,
          magazineSize: 12,
          currentAmmo: 0,
        },
        {
          isReloading: true,
          reloadTimer: 2.0,
          magazineSize: 30,
          currentAmmo: 0,
        },
      );

      // Run ~60 frames (1 second)
      for (let i = 0; i < 60; i++) {
        projectileSystem(world, dt, eq);
      }

      const sidearm = getGun(world, sidearmId);
      const longArm = getGun(world, longArmId);

      // Sidearm should have finished reloading (1.0s elapsed)
      expect(sidearm.isReloading).toBe(false);
      expect(sidearm.currentAmmo).toBe(12);

      // Long arm should still be reloading (needs 2.0s, only ~1.0s elapsed)
      expect(longArm.isReloading).toBe(true);
      expect(longArm.reloadTimer).toBeCloseTo(2.0 - 60 * dt, 2);
    });
  });

  describe('sourceGunSlot attribution', () => {
    it('sidearm bullets have sourceGunSlot = Sidearm', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 1,
      });

      projectileSystem(world, 0.016, eq);

      const bullets = getBulletProjectiles(world);
      expect(bullets.length).toBe(1);
      expect(bullets[0].proj.sourceGunSlot).toBe(WeaponSlot.Sidearm);
    });

    it('long arm bullets have sourceGunSlot = LongArm', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(
        world,
        {}, // sidearm: no fire
        {
          fireRequested: true,
          projectileCount: 1,
        },
      );

      projectileSystem(world, 0.016, eq);

      const bullets = getBulletProjectiles(world);
      expect(bullets.length).toBe(1);
      expect(bullets[0].proj.sourceGunSlot).toBe(WeaponSlot.LongArm);
    });
  });

  describe('firing last bullet', () => {
    it('fires with ammo=1, does NOT auto-reload on same frame', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        currentAmmo: 1,
      });

      projectileSystem(world, 0.016, eq);

      const gun = getGun(world, sidearmId);
      expect(countBullets(world)).toBe(1);
      expect(gun.currentAmmo).toBe(0);
      expect(gun.isReloading).toBe(false);
    });
  });

  describe('fire during reload rejected', () => {
    it('does not fire when isReloading=true even with ammo', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        currentAmmo: 5,
        isReloading: true,
        reloadTimer: 0.5,
      });

      projectileSystem(world, 0.016, eq);

      expect(countBullets(world)).toBe(0);
      expect(getGun(world, sidearmId).fireRequested).toBe(false);
    });
  });

  describe('piercing and bouncing from traits', () => {
    it('piercing trait level sets piercingRemaining on bullets', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 1,
        traits: [GunTrait.Piercing, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [3, 0, 0], // Piercing level 3 → bonusPerLevel["Piercing"][2] = 2
        critChance: 0,
      });

      projectileSystem(world, 0.016, eq);

      const bullets = getBulletProjectiles(world);
      expect(bullets.length).toBe(1);
      expect(bullets[0].proj.piercingRemaining).toBe(2);
      expect(bullets[0].proj.bouncesRemaining).toBe(0);
    });

    it('bouncing trait level sets bouncesRemaining on bullets', () => {
      const world = new World();
      const eq = new EventQueue();
      createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 1,
        traits: [GunTrait.Bouncing, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [2, 0, 0], // Bouncing level 2 → bonusPerLevel["Bouncing"][1] = 2
        critChance: 0,
      });

      projectileSystem(world, 0.016, eq);

      const bullets = getBulletProjectiles(world);
      expect(bullets.length).toBe(1);
      expect(bullets[0].proj.bouncesRemaining).toBe(2);
      expect(bullets[0].proj.piercingRemaining).toBe(0);
    });
  });

  describe('projectileCount = 0 edge case', () => {
    it('no bullets spawned but ammo still decrements', () => {
      const world = new World();
      const eq = new EventQueue();
      const { sidearmId } = createTestPlayer(world, {
        fireRequested: true,
        projectileCount: 0,
        currentAmmo: 5,
      });

      projectileSystem(world, 0.016, eq);

      expect(countBullets(world)).toBe(0);
      expect(getGun(world, sidearmId).currentAmmo).toBe(4);
    });
  });

  describe('fire sound events', () => {
    it('emits correct fire sound for gun type', () => {
      const soundMap: [GunType, SoundId][] = [
        [GunType.Pistol, SoundId.PistolFire],
        [GunType.SMG, SoundId.SMGFire],
        [GunType.AssaultRifle, SoundId.AssaultRifleFire],
        [GunType.Shotgun, SoundId.ShotgunFire],
        [GunType.LMG, SoundId.LMGFire],
      ];

      for (const [gunType, expectedSound] of soundMap) {
        const world = new World();
        const eq = new EventQueue();
        createTestPlayer(world, {
          fireRequested: true,
          gunType,
          projectileCount: 1,
          critChance: 0,
        });

        projectileSystem(world, 0.016, eq);

        const audioEvents = eq.consume(EventType.Audio);
        expect(audioEvents.some((e) => e.sound === expectedSound)).toBe(true);
      }
    });
  });
});
