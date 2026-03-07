import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { gunXPSystem } from '../src/systems/gunXPSystem';
import {
  AppState,
  GunTrait,
  GunType,
  GunCategory,
  WeaponSlot,
} from '../src/ecs/components';
import type { Gun, Player } from '../src/ecs/components';
import { getDesignParams } from '../src/config/designParams';
import { useAppStore } from '../src/store/appStore';

// ── Helpers ─────────────────────────────────────────────────────────────────

const params = getDesignParams();
const { xpCosts, maxLevel } = params.traits;

function createGun(world: World, overrides: Partial<Gun> = {}): number {
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

function createPlayer(
  world: World,
  sidearmId: number,
  longArmId: number = 0,
): number {
  const id = world.createEntity();
  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: sidearmId,
    longArmSlot: longArmId,
    activeSlot: WeaponSlot.Sidearm,
    currency: 0,
  });
  return id;
}

function getGun(world: World, id: number): Gun {
  return world.getComponent<Gun>(id, 'Gun')!;
}

function resetAppStore(): void {
  useAppStore.setState({
    currentState: AppState.Gameplay,
    previousState: null,
    forcedUpgradeGunSlot: null,
  });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('gunXPSystem', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
    resetAppStore();
  });

  describe('basic threshold logic', () => {
    it('triggers forced upgrade when XP >= threshold (all traits level 0)', () => {
      const gunId = createGun(world, { xp: 50, traitLevels: [0, 0, 0] });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
      expect(useAppStore.getState().currentState).toBe(AppState.ForcedUpgrade);
      expect(useAppStore.getState().forcedUpgradeGunSlot).toBe(WeaponSlot.Sidearm);
    });

    it('does not trigger when XP is just below threshold', () => {
      const gunId = createGun(world, { xp: 49, traitLevels: [0, 0, 0] });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(false);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('triggers at exact threshold boundary (>=)', () => {
      const gunId = createGun(world, { xp: xpCosts[0], traitLevels: [0, 0, 0] });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
      expect(useAppStore.getState().currentState).toBe(AppState.ForcedUpgrade);
    });

    it('triggers with XP far exceeding threshold', () => {
      const gunId = createGun(world, { xp: 5000, traitLevels: [0, 0, 0] });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
      expect(useAppStore.getState().currentState).toBe(AppState.ForcedUpgrade);
    });
  });

  describe('re-trigger prevention', () => {
    it('does not re-trigger when forcedUpgradeTriggered is already true', () => {
      const gunId = createGun(world, {
        xp: 100,
        traitLevels: [0, 0, 0],
        forcedUpgradeTriggered: true,
      });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
      // State should remain Gameplay (no transition attempted)
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });
  });

  describe('flag reset and recheck', () => {
    it('does not trigger after reset when XP is below new threshold', () => {
      const gunId = createGun(world, {
        xp: 30,
        traitLevels: [0, 0, 0],
        forcedUpgradeTriggered: false,
      });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(false);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('re-triggers after reset when XP still above threshold', () => {
      // traits [1, 0, 0]: maxCost = max(xpCosts[1], xpCosts[0], xpCosts[0]) = 150
      const gunId = createGun(world, {
        xp: 200,
        traitLevels: [1, 0, 0],
        forcedUpgradeTriggered: false,
      });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
      expect(useAppStore.getState().currentState).toBe(AppState.ForcedUpgrade);
    });
  });

  describe('maxCost calculation', () => {
    it('uses the maximum cost across mixed trait levels', () => {
      // traits [3, 1, 4]: costs = [700, 150, 1200], maxCost = 1200
      const gunId = createGun(world, {
        xp: 1200,
        traitLevels: [3, 1, 4],
      });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
    });

    it('excludes maxed-out traits from cost calculation', () => {
      // traits [5, 0, 2]: trait 0 maxed, costs = [xpCosts[0]=50, xpCosts[2]=350], maxCost = 350
      const gunId = createGun(world, {
        xp: 350,
        traitLevels: [5, 0, 2],
      });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
    });

    it('does not trigger when all traits are at max level', () => {
      const gunId = createGun(world, {
        xp: 9999,
        traitLevels: [5, 5, 5],
      });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(false);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });
  });

  describe('both gun slots', () => {
    it('checks both guns independently — triggers only the one above threshold', () => {
      const sidearmId = createGun(world, {
        xp: 10,
        traitLevels: [0, 0, 0],
        category: GunCategory.Sidearm,
      });
      const longArmId = createGun(world, {
        xp: 200,
        traitLevels: [0, 0, 0],
        category: GunCategory.LongArm,
        gunType: GunType.SMG,
      });
      createPlayer(world, sidearmId, longArmId);

      gunXPSystem(world);

      expect(getGun(world, sidearmId).forcedUpgradeTriggered).toBe(false);
      expect(getGun(world, longArmId).forcedUpgradeTriggered).toBe(true);
      expect(useAppStore.getState().currentState).toBe(AppState.ForcedUpgrade);
      expect(useAppStore.getState().forcedUpgradeGunSlot).toBe(WeaponSlot.LongArm);
    });

    it('triggers sidearm first when both are above threshold', () => {
      const sidearmId = createGun(world, {
        xp: 100,
        traitLevels: [0, 0, 0],
        category: GunCategory.Sidearm,
      });
      const longArmId = createGun(world, {
        xp: 100,
        traitLevels: [0, 0, 0],
        category: GunCategory.LongArm,
        gunType: GunType.SMG,
      });
      createPlayer(world, sidearmId, longArmId);

      gunXPSystem(world);

      // Sidearm triggers first (deterministic order)
      expect(getGun(world, sidearmId).forcedUpgradeTriggered).toBe(true);
      expect(getGun(world, longArmId).forcedUpgradeTriggered).toBe(false);
      expect(useAppStore.getState().forcedUpgradeGunSlot).toBe(WeaponSlot.Sidearm);

      // After resolving sidearm, next call triggers long arm
      resetAppStore();
      gunXPSystem(world);

      expect(getGun(world, longArmId).forcedUpgradeTriggered).toBe(true);
      expect(useAppStore.getState().forcedUpgradeGunSlot).toBe(WeaponSlot.LongArm);
    });
  });

  describe('edge cases', () => {
    it('handles XP of 0 — no trigger', () => {
      const gunId = createGun(world, { xp: 0, traitLevels: [0, 0, 0] });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(false);
    });

    it('handles negative XP — no trigger', () => {
      const gunId = createGun(world, { xp: -10, traitLevels: [0, 0, 0] });
      createPlayer(world, gunId);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(false);
    });

    it('handles dangling gun reference — no crash', () => {
      const gunId = createGun(world, { xp: 100, traitLevels: [0, 0, 0] });
      createPlayer(world, gunId);
      world.destroyEntity(gunId);

      expect(() => gunXPSystem(world)).not.toThrow();
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('handles only sidearm populated (longArm = 0, no entity)', () => {
      const gunId = createGun(world, { xp: 50, traitLevels: [0, 0, 0] });
      createPlayer(world, gunId, 0);

      gunXPSystem(world);

      expect(getGun(world, gunId).forcedUpgradeTriggered).toBe(true);
      expect(useAppStore.getState().currentState).toBe(AppState.ForcedUpgrade);
    });

    it('does nothing when no player exists', () => {
      expect(() => gunXPSystem(world)).not.toThrow();
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });
  });

  describe('property-based tests', () => {
    it('never triggers when forcedUpgradeTriggered is true regardless of XP', () => {
      fc.assert(
        fc.property(fc.nat(10000), (xp) => {
          world = new World();
          resetAppStore();

          const gunId = createGun(world, {
            xp,
            traitLevels: [0, 0, 0],
            forcedUpgradeTriggered: true,
          });
          createPlayer(world, gunId);

          gunXPSystem(world);

          expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
        }),
      );
    });

    it('triggers iff xp >= maxCost and forcedUpgradeTriggered is false', () => {
      const levelArb = fc.integer({ min: 0, max: maxLevel });
      const traitLevelsArb = fc.tuple(levelArb, levelArb, levelArb);

      fc.assert(
        fc.property(
          fc.nat(5000),
          traitLevelsArb,
          (xp, levels) => {
            world = new World();
            resetAppStore();

            const gunId = createGun(world, {
              xp,
              traitLevels: levels as [number, number, number],
              forcedUpgradeTriggered: false,
            });
            createPlayer(world, gunId);

            // Calculate expected maxCost
            let expectedMaxCost = -1;
            for (const level of levels) {
              if (level >= maxLevel) continue;
              if (xpCosts[level] > expectedMaxCost) {
                expectedMaxCost = xpCosts[level];
              }
            }

            gunXPSystem(world);

            const gun = getGun(world, gunId);
            if (expectedMaxCost === -1) {
              // All traits maxed
              expect(gun.forcedUpgradeTriggered).toBe(false);
              expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
            } else if (xp >= expectedMaxCost) {
              expect(gun.forcedUpgradeTriggered).toBe(true);
              expect(useAppStore.getState().currentState).toBe(AppState.ForcedUpgrade);
            } else {
              expect(gun.forcedUpgradeTriggered).toBe(false);
              expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
            }
          },
        ),
      );
    });
  });
});
