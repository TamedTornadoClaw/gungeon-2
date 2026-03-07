import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppState, GunType, GunTrait, WeaponSlot } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { useComparisonStore } from '../src/store/comparisonStore';
import type { ComparisonGunData } from '../src/store/comparisonStore';

function resetStores() {
  useAppStore.setState({
    currentState: AppState.GunComparison,
    previousState: AppState.Gameplay,
    selectedSidearm: GunType.Pistol,
    selectedLongArm: GunType.SMG,
    comparisonGunEntityId: 42,
    comparisonSlot: WeaponSlot.LongArm,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
  useComparisonStore.getState().clearComparison();
}

function makeMockGun(overrides: Partial<ComparisonGunData> = {}): ComparisonGunData {
  return {
    gunType: GunType.Pistol,
    damage: 10,
    fireRate: 5,
    magazineSize: 12,
    reloadTime: 1.5,
    spread: 0.05,
    projectileCount: 1,
    projectileSpeed: 20,
    knockback: 1,
    critChance: 0.1,
    critMultiplier: 2,
    traits: [GunTrait.Damage, GunTrait.FireRate, GunTrait.MagazineSize],
    traitLevels: [1, 0, 2],
    ...overrides,
  };
}

describe('GunComparisonScreen', () => {
  beforeEach(resetStores);

  describe('state transitions', () => {
    it('GunComparison can only transition to Gameplay', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('rejects transition to MainMenu from GunComparison', () => {
      expect(() => useAppStore.getState().transition(AppState.MainMenu)).toThrow(
        /Invalid transition/,
      );
    });

    it('rejects transition to Paused from GunComparison', () => {
      expect(() => useAppStore.getState().transition(AppState.Paused)).toThrow(
        /Invalid transition/,
      );
    });

    it('rejects transition to Death from GunComparison', () => {
      expect(() => useAppStore.getState().transition(AppState.Death)).toThrow(
        /Invalid transition/,
      );
    });
  });

  describe('comparisonStore', () => {
    it('starts with null gun data', () => {
      const state = useComparisonStore.getState();
      expect(state.currentGun).toBeNull();
      expect(state.foundGun).toBeNull();
      expect(state.swapGuns).toBeNull();
    });

    it('setComparison populates both guns and swap callback', () => {
      const current = makeMockGun({ gunType: GunType.Pistol });
      const found = makeMockGun({ gunType: GunType.Shotgun, damage: 25 });
      const swap = vi.fn();

      useComparisonStore.getState().setComparison(current, found, swap);

      const state = useComparisonStore.getState();
      expect(state.currentGun).toEqual(current);
      expect(state.foundGun).toEqual(found);
      expect(state.swapGuns).toBe(swap);
    });

    it('clearComparison resets all data', () => {
      const current = makeMockGun();
      const found = makeMockGun({ gunType: GunType.LMG });
      useComparisonStore.getState().setComparison(current, found, vi.fn());
      useComparisonStore.getState().clearComparison();

      const state = useComparisonStore.getState();
      expect(state.currentGun).toBeNull();
      expect(state.foundGun).toBeNull();
      expect(state.swapGuns).toBeNull();
    });
  });

  describe('swap action', () => {
    it('swap callback is invoked during swap', () => {
      const swap = vi.fn();
      const current = makeMockGun({ gunType: GunType.Pistol });
      const found = makeMockGun({ gunType: GunType.Shotgun });
      useComparisonStore.getState().setComparison(current, found, swap);

      // Simulate what handleSwap does
      const { swapGuns } = useComparisonStore.getState();
      if (swapGuns) swapGuns();

      expect(swap).toHaveBeenCalledOnce();
    });

    it('swap transitions to Gameplay', () => {
      const swap = vi.fn();
      useComparisonStore.getState().setComparison(makeMockGun(), makeMockGun(), swap);

      useAppStore.getState().transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('cancel transitions to Gameplay without calling swap', () => {
      const swap = vi.fn();
      useComparisonStore.getState().setComparison(makeMockGun(), makeMockGun(), swap);

      // Cancel: transition without calling swap
      useAppStore.getState().transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
      expect(swap).not.toHaveBeenCalled();
    });
  });

  describe('gun data integrity', () => {
    it('stores all stat fields', () => {
      const gun = makeMockGun({
        gunType: GunType.AssaultRifle,
        damage: 15,
        fireRate: 10,
        magazineSize: 30,
        reloadTime: 2.0,
        spread: 0.1,
        projectileCount: 1,
        projectileSpeed: 25,
        knockback: 2,
        critChance: 0.15,
        critMultiplier: 2.5,
      });

      useComparisonStore.getState().setComparison(gun, makeMockGun(), vi.fn());
      const stored = useComparisonStore.getState().currentGun!;

      expect(stored.damage).toBe(15);
      expect(stored.fireRate).toBe(10);
      expect(stored.magazineSize).toBe(30);
      expect(stored.reloadTime).toBe(2.0);
      expect(stored.spread).toBe(0.1);
      expect(stored.projectileCount).toBe(1);
      expect(stored.projectileSpeed).toBe(25);
      expect(stored.knockback).toBe(2);
      expect(stored.critChance).toBe(0.15);
      expect(stored.critMultiplier).toBe(2.5);
    });

    it('stores traits and trait levels', () => {
      const gun = makeMockGun({
        traits: [GunTrait.Piercing, GunTrait.Knockback, GunTrait.CriticalChance],
        traitLevels: [3, 1, 0],
      });

      useComparisonStore.getState().setComparison(gun, makeMockGun(), vi.fn());
      const stored = useComparisonStore.getState().currentGun!;

      expect(stored.traits).toEqual([GunTrait.Piercing, GunTrait.Knockback, GunTrait.CriticalChance]);
      expect(stored.traitLevels).toEqual([3, 1, 0]);
    });

    it('both guns can have different types', () => {
      const current = makeMockGun({ gunType: GunType.SMG });
      const found = makeMockGun({ gunType: GunType.LMG });

      useComparisonStore.getState().setComparison(current, found, vi.fn());
      const state = useComparisonStore.getState();

      expect(state.currentGun!.gunType).toBe(GunType.SMG);
      expect(state.foundGun!.gunType).toBe(GunType.LMG);
    });
  });

  describe('comparisonGunEntityId in appStore', () => {
    it('is set when entering GunComparison', () => {
      expect(useAppStore.getState().comparisonGunEntityId).toBe(42);
    });

    it('comparisonSlot is set', () => {
      expect(useAppStore.getState().comparisonSlot).toBe(WeaponSlot.LongArm);
    });
  });
});
