import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { gunStatSystem } from '../src/systems/gunStatSystem';
import { GunTrait, GunType, GunCategory } from '../src/ecs/components';
import type { Gun } from '../src/ecs/components';
import { getDesignParams } from '../src/config/designParams';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createGun(
  world: World,
  overrides: Partial<Gun> = {},
): number {
  const params = getDesignParams();
  const gunParams = params.guns['Pistol'];

  const defaults: Gun = {
    gunType: GunType.Pistol,
    category: GunCategory.Sidearm,
    baseDamage: gunParams.damage,
    baseFireRate: gunParams.fireRate,
    baseMagazineSize: gunParams.magazineSize,
    baseReloadTime: gunParams.reloadTime,
    baseSpread: gunParams.spread,
    baseProjectileCount: gunParams.projectileCount,
    baseProjectileSpeed: gunParams.projectileSpeed,
    baseKnockback: gunParams.knockback,
    baseCritChance: gunParams.critChance,
    baseCritMultiplier: gunParams.critMultiplier,
    damage: gunParams.damage,
    fireRate: gunParams.fireRate,
    magazineSize: gunParams.magazineSize,
    reloadTime: gunParams.reloadTime,
    spread: gunParams.spread,
    projectileCount: gunParams.projectileCount,
    projectileSpeed: gunParams.projectileSpeed,
    knockback: gunParams.knockback,
    critChance: gunParams.critChance,
    critMultiplier: gunParams.critMultiplier,
    currentAmmo: gunParams.magazineSize,
    isReloading: false,
    reloadTimer: 0,
    fireCooldown: 0,
    fireRequested: false,
    traits: [GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
  };

  const gun: Gun = { ...defaults, ...overrides };
  const id = world.createEntity();
  world.addComponent<Gun>(id, 'Gun', gun);
  return id;
}

function getGun(world: World, id: number): Gun {
  return world.getComponent<Gun>(id, 'Gun')!;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('GunStatSystem', () => {
  const params = getDesignParams();
  const bonusPerLevel = params.traits.bonusPerLevel;

  describe('All traits at level 0 (no bonuses)', () => {
    it('computed stats equal base stats', () => {
      const world = new World();
      const id = createGun(world);
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.damage).toBe(gun.baseDamage);
      expect(gun.fireRate).toBe(gun.baseFireRate);
      expect(gun.magazineSize).toBe(gun.baseMagazineSize);
      expect(gun.reloadTime).toBe(gun.baseReloadTime);
      expect(gun.spread).toBe(gun.baseSpread);
      expect(gun.projectileCount).toBe(gun.baseProjectileCount);
      expect(gun.projectileSpeed).toBe(gun.baseProjectileSpeed);
      expect(gun.knockback).toBe(gun.baseKnockback);
      expect(gun.critChance).toBe(gun.baseCritChance);
      expect(gun.critMultiplier).toBe(gun.baseCritMultiplier);
    });
  });

  describe('Single trait at level 1', () => {
    it('only the upgraded trait stat changes', () => {
      const world = new World();
      const id = createGun(world, { traitLevels: [1, 0, 0] });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.damage).toBe(15 + bonusPerLevel['Damage'][0]);
      expect(gun.critChance).toBe(gun.baseCritChance);
      expect(gun.critMultiplier).toBe(gun.baseCritMultiplier);
      expect(gun.fireRate).toBe(gun.baseFireRate);
    });
  });

  describe('Trait at max level (level 5)', () => {
    it('uses correct array index (level - 1 = 4)', () => {
      const world = new World();
      const id = createGun(world, { traitLevels: [5, 0, 0] });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.damage).toBe(15 + bonusPerLevel['Damage'][4]);
    });
  });

  describe('MagazineSize rounding', () => {
    it('rounds to nearest integer using Math.round', () => {
      const world = new World();
      // Use a fractional baseMagazineSize to test rounding
      const id = createGun(world, {
        baseMagazineSize: 10.4,
        magazineSize: 10.4,
        traits: [GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [0, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.magazineSize).toBe(10);
    });

    it('rounds 0.5 up (Math.round behavior)', () => {
      const world = new World();
      const id = createGun(world, {
        baseMagazineSize: 10.5,
        magazineSize: 10.5,
        traits: [GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [0, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.magazineSize).toBe(11);
    });

    it('rounds integer results correctly', () => {
      const world = new World();
      const smgParams = params.guns['SMG'];
      const id = createGun(world, {
        gunType: GunType.SMG,
        baseMagazineSize: smgParams.magazineSize,
        magazineSize: smgParams.magazineSize,
        traits: [GunTrait.FireRate, GunTrait.MagazineSize, GunTrait.ProjectileSpeed],
        traitLevels: [0, 1, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.magazineSize).toBe(40 + bonusPerLevel['MagazineSize'][0]);
    });
  });

  describe('ReloadTime clamping', () => {
    it('clamps to minimum 0.2s when result goes below', () => {
      const world = new World();
      const id = createGun(world, {
        baseReloadTime: 0.5,
        reloadTime: 0.5,
        traits: [GunTrait.ReloadTime, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [5, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      // 0.5 + (-0.6) = -0.1, clamped to 0.2
      expect(gun.reloadTime).toBe(0.2);
    });

    it('does not clamp when result is above minimum', () => {
      const world = new World();
      const id = createGun(world, {
        baseReloadTime: 1.0,
        reloadTime: 1.0,
        traits: [GunTrait.ReloadTime, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [5, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      // 1.0 + (-0.6) = 0.4
      expect(gun.reloadTime).toBe(0.4);
    });

    it('keeps exact boundary value of 0.2', () => {
      const world = new World();
      const id = createGun(world, {
        baseReloadTime: 0.2,
        reloadTime: 0.2,
        traits: [GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [0, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.reloadTime).toBe(0.2);
    });

    it('clamps 0.19 to 0.2', () => {
      const world = new World();
      const id = createGun(world, {
        baseReloadTime: 0.19,
        reloadTime: 0.19,
        traits: [GunTrait.Damage, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [0, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.reloadTime).toBe(0.2);
    });
  });

  describe('Stats not covered by traits use base value', () => {
    it('untraited stats equal base values even with all traits at max', () => {
      const world = new World();
      // Pistol traits: Damage, CriticalChance, CriticalMultiplier
      // These don't affect fireRate, magazineSize, reloadTime, spread, etc.
      const id = createGun(world, { traitLevels: [5, 5, 5] });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.fireRate).toBe(gun.baseFireRate);
      expect(gun.magazineSize).toBe(gun.baseMagazineSize);
      expect(gun.reloadTime).toBe(gun.baseReloadTime);
      expect(gun.spread).toBe(gun.baseSpread);
      expect(gun.projectileCount).toBe(gun.baseProjectileCount);
      expect(gun.projectileSpeed).toBe(gun.baseProjectileSpeed);
      expect(gun.knockback).toBe(gun.baseKnockback);
    });
  });

  describe('All three traits at different levels', () => {
    it('Shotgun with mixed trait levels', () => {
      const world = new World();
      const shotgunParams = params.guns['Shotgun'];
      const id = createGun(world, {
        gunType: GunType.Shotgun,
        category: GunCategory.LongArm,
        baseDamage: shotgunParams.damage,
        baseFireRate: shotgunParams.fireRate,
        baseMagazineSize: shotgunParams.magazineSize,
        baseReloadTime: shotgunParams.reloadTime,
        baseSpread: shotgunParams.spread,
        baseProjectileCount: shotgunParams.projectileCount,
        baseProjectileSpeed: shotgunParams.projectileSpeed,
        baseKnockback: shotgunParams.knockback,
        baseCritChance: shotgunParams.critChance,
        baseCritMultiplier: shotgunParams.critMultiplier,
        damage: shotgunParams.damage,
        fireRate: shotgunParams.fireRate,
        magazineSize: shotgunParams.magazineSize,
        reloadTime: shotgunParams.reloadTime,
        spread: shotgunParams.spread,
        projectileCount: shotgunParams.projectileCount,
        projectileSpeed: shotgunParams.projectileSpeed,
        knockback: shotgunParams.knockback,
        critChance: shotgunParams.critChance,
        critMultiplier: shotgunParams.critMultiplier,
        traits: [GunTrait.ProjectileCount, GunTrait.Spread, GunTrait.Damage],
        traitLevels: [2, 3, 1],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.projectileCount).toBe(6 + bonusPerLevel['ProjectileCount'][1]);
      expect(gun.spread).toBeCloseTo(0.15 + bonusPerLevel['Spread'][2]);
      expect(gun.damage).toBe(8 + bonusPerLevel['Damage'][0]);
      // Untraited stats unchanged
      expect(gun.fireRate).toBe(shotgunParams.fireRate);
      expect(gun.reloadTime).toBe(shotgunParams.reloadTime);
    });
  });

  describe('Piercing and Bouncing trait bonuses', () => {
    it('Piercing trait adds to base stat (no basePiercing on Gun)', () => {
      // Piercing/Bouncing don't map to a base stat on the Gun component.
      // They are special traits. The system should not crash.
      const world = new World();
      const id = createGun(world, {
        traits: [GunTrait.Piercing, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [3, 0, 0],
      });
      // Should not crash
      gunStatSystem(world);
      const gun = getGun(world, id);

      // Piercing has no corresponding computed stat on Gun, so it doesn't
      // modify any stat. The ProjectileSystem reads traitLevels directly.
      // All base stats should remain unchanged.
      expect(gun.damage).toBe(gun.baseDamage);
    });

    it('Bouncing trait does not crash', () => {
      const world = new World();
      const id = createGun(world, {
        traits: [GunTrait.Bouncing, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [5, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);
      expect(gun.damage).toBe(gun.baseDamage);
    });
  });

  describe('LMG with all traits at level 5', () => {
    it('applies max bonuses correctly', () => {
      const world = new World();
      const lmgParams = params.guns['LMG'];
      const id = createGun(world, {
        gunType: GunType.LMG,
        category: GunCategory.LongArm,
        baseDamage: lmgParams.damage,
        baseFireRate: lmgParams.fireRate,
        baseMagazineSize: lmgParams.magazineSize,
        baseReloadTime: lmgParams.reloadTime,
        baseSpread: lmgParams.spread,
        baseProjectileCount: lmgParams.projectileCount,
        baseProjectileSpeed: lmgParams.projectileSpeed,
        baseKnockback: lmgParams.knockback,
        baseCritChance: lmgParams.critChance,
        baseCritMultiplier: lmgParams.critMultiplier,
        damage: lmgParams.damage,
        fireRate: lmgParams.fireRate,
        magazineSize: lmgParams.magazineSize,
        reloadTime: lmgParams.reloadTime,
        spread: lmgParams.spread,
        projectileCount: lmgParams.projectileCount,
        projectileSpeed: lmgParams.projectileSpeed,
        knockback: lmgParams.knockback,
        critChance: lmgParams.critChance,
        critMultiplier: lmgParams.critMultiplier,
        traits: [GunTrait.Damage, GunTrait.MagazineSize, GunTrait.Knockback],
        traitLevels: [5, 5, 5],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      expect(gun.damage).toBe(12 + 16);
      expect(gun.magazineSize).toBe(80 + 24);
      expect(gun.knockback).toBe(1.0 + 2.0);
    });
  });

  describe('Idempotency', () => {
    it('calling twice produces same result', () => {
      const world = new World();
      const id = createGun(world, { traitLevels: [3, 2, 1] });
      gunStatSystem(world);
      const after1 = { ...getGun(world, id) };
      gunStatSystem(world);
      const after2 = getGun(world, id);

      expect(after2.damage).toBe(after1.damage);
      expect(after2.critChance).toBe(after1.critChance);
      expect(after2.critMultiplier).toBe(after1.critMultiplier);
      expect(after2.fireRate).toBe(after1.fireRate);
      expect(after2.magazineSize).toBe(after1.magazineSize);
    });
  });

  describe('Uses base stats, not previously computed stats', () => {
    it('upgrading from level 1 to level 2 recalculates from base', () => {
      const world = new World();
      const id = createGun(world, { traitLevels: [1, 0, 0] });
      gunStatSystem(world);
      const gun = getGun(world, id);
      expect(gun.damage).toBe(15 + bonusPerLevel['Damage'][0]);

      // Upgrade to level 2
      gun.traitLevels[0] = 2;
      gunStatSystem(world);
      expect(gun.damage).toBe(15 + bonusPerLevel['Damage'][1]);
    });
  });

  describe('Multiple guns processed independently', () => {
    it('each gun gets its own stats', () => {
      const world = new World();
      const id1 = createGun(world, { traitLevels: [3, 0, 0] });

      const smgParams = params.guns['SMG'];
      const id2 = createGun(world, {
        gunType: GunType.SMG,
        baseDamage: smgParams.damage,
        baseFireRate: smgParams.fireRate,
        baseMagazineSize: smgParams.magazineSize,
        damage: smgParams.damage,
        fireRate: smgParams.fireRate,
        magazineSize: smgParams.magazineSize,
        traits: [GunTrait.FireRate, GunTrait.MagazineSize, GunTrait.ProjectileSpeed],
        traitLevels: [2, 0, 0],
      });
      gunStatSystem(world);

      const gun1 = getGun(world, id1);
      const gun2 = getGun(world, id2);

      expect(gun1.damage).toBe(15 + bonusPerLevel['Damage'][2]);
      expect(gun2.fireRate).toBe(smgParams.fireRate + bonusPerLevel['FireRate'][1]);
      // Gun1 fireRate unchanged, Gun2 damage unchanged
      expect(gun1.fireRate).toBe(3.0);
      expect(gun2.damage).toBe(smgParams.damage);
    });
  });

  describe('Negative spread after bonuses', () => {
    it('allows negative spread (no clamping per spec)', () => {
      const world = new World();
      const id = createGun(world, {
        baseSpread: 0.02,
        spread: 0.02,
        traits: [GunTrait.Spread, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
        traitLevels: [5, 0, 0],
      });
      gunStatSystem(world);
      const gun = getGun(world, id);

      // 0.02 + (-0.05) = -0.03
      expect(gun.spread).toBeCloseTo(0.02 + bonusPerLevel['Spread'][4]);
    });
  });

  describe('No Gun component entities are skipped', () => {
    it('entities without Gun component do not crash', () => {
      const world = new World();
      world.createEntity(); // entity with no components
      const id = createGun(world);
      gunStatSystem(world);
      const gun = getGun(world, id);
      expect(gun.damage).toBe(gun.baseDamage);
    });
  });

  describe('Property-based tests', () => {
    it('computed stat >= base stat for positive-bonus traits', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          (level) => {
            const world = new World();
            // Damage always has positive bonuses
            const id = createGun(world, { traitLevels: [level, 0, 0] });
            gunStatSystem(world);
            const gun = getGun(world, id);
            return gun.damage >= gun.baseDamage;
          },
        ),
      );
    });

    it('magazineSize is always an integer', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (l1, l2, l3) => {
            const world = new World();
            const smgParams = params.guns['SMG'];
            const id = createGun(world, {
              gunType: GunType.SMG,
              baseMagazineSize: smgParams.magazineSize,
              magazineSize: smgParams.magazineSize,
              traits: [GunTrait.FireRate, GunTrait.MagazineSize, GunTrait.ProjectileSpeed],
              traitLevels: [l1, l2, l3],
            });
            gunStatSystem(world);
            const gun = getGun(world, id);
            return Number.isInteger(gun.magazineSize);
          },
        ),
      );
    });

    it('reloadTime never goes below 0.2', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.double({ min: 0.1, max: 5.0, noNaN: true }),
          (level, baseReload) => {
            const world = new World();
            const id = createGun(world, {
              baseReloadTime: baseReload,
              reloadTime: baseReload,
              traits: [GunTrait.ReloadTime, GunTrait.CriticalChance, GunTrait.CriticalMultiplier],
              traitLevels: [level, 0, 0],
            });
            gunStatSystem(world);
            const gun = getGun(world, id);
            return gun.reloadTime >= 0.2;
          },
        ),
      );
    });

    it('system is idempotent for any trait level combination', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          (l1, l2, l3) => {
            const world = new World();
            const id = createGun(world, { traitLevels: [l1, l2, l3] });
            gunStatSystem(world);
            const after1 = { ...getGun(world, id) };
            gunStatSystem(world);
            const after2 = getGun(world, id);
            return (
              after2.damage === after1.damage &&
              after2.fireRate === after1.fireRate &&
              after2.magazineSize === after1.magazineSize &&
              after2.reloadTime === after1.reloadTime &&
              after2.critChance === after1.critChance &&
              after2.critMultiplier === after1.critMultiplier
            );
          },
        ),
      );
    });
  });
});
