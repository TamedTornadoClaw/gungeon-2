import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, GunTrait, GunType } from '../src/ecs/components';
import type { Gun } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { useUpgradeStore } from '../src/store/upgradeStore';
import { getDesignParams } from '../src/config/designParams';
import { World } from '../src/ecs/world';
import { createGun } from '../src/ecs/factories';

function resetStores() {
  useAppStore.setState({
    currentState: AppState.GunUpgrade,
    previousState: AppState.Gameplay,
    selectedSidearm: null,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
  useUpgradeStore.setState({
    gunEntityId: null,
    worldRef: null,
    xp: 0,
    traits: [GunTrait.Damage, GunTrait.Damage, GunTrait.Damage],
    traitLevels: [0, 0, 0],
  });
}

function setupGunWithXP(xp: number): { world: World; gunId: number } {
  const world = new World();
  const gunId = createGun(world, GunType.Pistol);
  const gun = world.getComponent<Gun>(gunId, 'Gun')!;
  gun.xp = xp;
  return { world, gunId };
}

describe('GunUpgradeMenu', () => {
  beforeEach(resetStores);

  describe('state transitions', () => {
    it('should transition from GunUpgrade to Gameplay', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('should reject invalid transitions from GunUpgrade', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.MainMenu)).toThrow('Invalid transition');
    });
  });

  describe('upgradeStore openUpgrade', () => {
    it('should populate store from gun component', () => {
      const { world, gunId } = setupGunWithXP(500);

      useUpgradeStore.getState().openUpgrade(gunId, world);

      const state = useUpgradeStore.getState();
      expect(state.gunEntityId).toBe(gunId);
      expect(state.worldRef).toBe(world);
      expect(state.xp).toBe(500);
      expect(state.traits).toHaveLength(3);
      expect(state.traitLevels).toEqual([0, 0, 0]);
    });

    it('should copy traits from gun component', () => {
      const { world, gunId } = setupGunWithXP(0);
      const gun = world.getComponent<Gun>(gunId, 'Gun')!;

      useUpgradeStore.getState().openUpgrade(gunId, world);

      expect(useUpgradeStore.getState().traits).toEqual([...gun.traits]);
    });

    it('should not populate store if gun entity is invalid', () => {
      const world = new World();

      useUpgradeStore.getState().openUpgrade(999, world);

      expect(useUpgradeStore.getState().gunEntityId).toBeNull();
    });
  });

  describe('spendXP', () => {
    it('should upgrade trait when player has enough XP', () => {
      const params = getDesignParams();
      const cost = params.traits.xpCosts[0];
      const { world, gunId } = setupGunWithXP(cost + 100);
      useUpgradeStore.getState().openUpgrade(gunId, world);

      const success = useUpgradeStore.getState().spendXP(0);

      expect(success).toBe(true);
      expect(useUpgradeStore.getState().traitLevels[0]).toBe(1);
      expect(useUpgradeStore.getState().xp).toBe(100);
    });

    it('should update gun ECS component on upgrade', () => {
      const params = getDesignParams();
      const cost = params.traits.xpCosts[0];
      const { world, gunId } = setupGunWithXP(cost);
      useUpgradeStore.getState().openUpgrade(gunId, world);

      useUpgradeStore.getState().spendXP(0);

      const gun = world.getComponent<Gun>(gunId, 'Gun')!;
      expect(gun.traitLevels[0]).toBe(1);
      expect(gun.xp).toBe(0);
    });

    it('should fail when XP is insufficient', () => {
      const { world, gunId } = setupGunWithXP(10);
      useUpgradeStore.getState().openUpgrade(gunId, world);

      const success = useUpgradeStore.getState().spendXP(0);

      expect(success).toBe(false);
      expect(useUpgradeStore.getState().traitLevels[0]).toBe(0);
    });

    it('should fail when trait is at max level', () => {
      const params = getDesignParams();
      const { world, gunId } = setupGunWithXP(99999);
      const gun = world.getComponent<Gun>(gunId, 'Gun')!;
      gun.traitLevels[0] = params.traits.maxLevel;
      useUpgradeStore.getState().openUpgrade(gunId, world);

      const success = useUpgradeStore.getState().spendXP(0);

      expect(success).toBe(false);
    });

    it('should fail when worldRef is null', () => {
      const success = useUpgradeStore.getState().spendXP(0);
      expect(success).toBe(false);
    });

    it('should use increasing costs per level', () => {
      const params = getDesignParams();
      const totalXP = params.traits.xpCosts[0] + params.traits.xpCosts[1] + 10;
      const { world, gunId } = setupGunWithXP(totalXP);
      useUpgradeStore.getState().openUpgrade(gunId, world);

      useUpgradeStore.getState().spendXP(0);
      expect(useUpgradeStore.getState().traitLevels[0]).toBe(1);

      useUpgradeStore.getState().spendXP(0);
      expect(useUpgradeStore.getState().traitLevels[0]).toBe(2);
      expect(useUpgradeStore.getState().xp).toBe(10);
    });

    it('should allow upgrading different traits independently', () => {
      const params = getDesignParams();
      const totalXP = params.traits.xpCosts[0] * 3;
      const { world, gunId } = setupGunWithXP(totalXP);
      useUpgradeStore.getState().openUpgrade(gunId, world);

      useUpgradeStore.getState().spendXP(0);
      useUpgradeStore.getState().spendXP(1);
      useUpgradeStore.getState().spendXP(2);

      expect(useUpgradeStore.getState().traitLevels).toEqual([1, 1, 1]);
    });
  });

  describe('closeUpgrade', () => {
    it('should clear store state', () => {
      const { world, gunId } = setupGunWithXP(500);
      useUpgradeStore.getState().openUpgrade(gunId, world);

      useUpgradeStore.getState().closeUpgrade();

      const state = useUpgradeStore.getState();
      expect(state.gunEntityId).toBeNull();
      expect(state.worldRef).toBeNull();
      expect(state.xp).toBe(0);
    });

    it('should transition to Gameplay when closing', () => {
      useAppStore.getState().transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });
  });

  describe('design params', () => {
    it('should have xpCosts array matching maxLevel', () => {
      const params = getDesignParams();
      expect(params.traits.xpCosts).toHaveLength(params.traits.maxLevel);
    });

    it('should have increasing xpCosts', () => {
      const params = getDesignParams();
      for (let i = 1; i < params.traits.xpCosts.length; i++) {
        expect(params.traits.xpCosts[i]).toBeGreaterThan(params.traits.xpCosts[i - 1]);
      }
    });

    it('should have bonusPerLevel for all GunTrait enum values', () => {
      const params = getDesignParams();
      const traitNames = [
        'Damage', 'FireRate', 'MagazineSize', 'ReloadTime', 'Spread',
        'ProjectileCount', 'ProjectileSpeed', 'Knockback',
        'CriticalChance', 'CriticalMultiplier', 'Piercing', 'Bouncing',
      ];
      for (const name of traitNames) {
        expect(params.traits.bonusPerLevel[name]).toBeDefined();
        expect(params.traits.bonusPerLevel[name]).toHaveLength(params.traits.maxLevel);
      }
    });
  });
});
