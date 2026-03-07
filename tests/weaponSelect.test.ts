import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, GunType, GunCategory } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { getDesignParams } from '../src/config/designParams';

function resetStore() {
  useAppStore.setState({
    currentState: AppState.WeaponSelect,
    previousState: AppState.MainMenu,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
}

describe('WeaponSelect', () => {
  beforeEach(resetStore);

  describe('gun categorization', () => {
    it('should have at least one sidearm in design params', () => {
      const params = getDesignParams();
      const sidearms = Object.entries(params.guns).filter(
        ([, g]) => g.category === GunCategory[GunCategory.Sidearm],
      );
      expect(sidearms.length).toBeGreaterThanOrEqual(1);
    });

    it('should have at least one long arm in design params', () => {
      const params = getDesignParams();
      const longArms = Object.entries(params.guns).filter(
        ([, g]) => g.category === GunCategory[GunCategory.LongArm],
      );
      expect(longArms.length).toBeGreaterThanOrEqual(1);
    });

    it('every gun in design params should have a valid category', () => {
      const params = getDesignParams();
      const validCategories = [
        GunCategory[GunCategory.Sidearm],
        GunCategory[GunCategory.LongArm],
      ];
      for (const [name, gun] of Object.entries(params.guns)) {
        expect(validCategories).toContain(gun.category);
        expect(GunType[name as keyof typeof GunType]).toBeDefined();
      }
    });

    it('every gun type enum should have design params', () => {
      const params = getDesignParams();
      const gunTypeNames = Object.keys(GunType).filter((k) => isNaN(Number(k)));
      for (const name of gunTypeNames) {
        expect(params.guns[name]).toBeDefined();
      }
    });
  });

  describe('state transitions', () => {
    it('should transition from WeaponSelect to Gameplay', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('should transition from WeaponSelect to MainMenu (back)', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('should reject invalid transitions from WeaponSelect', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.Death)).toThrow('Invalid transition');
    });

    it('should reject transition to Paused from WeaponSelect', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.Paused)).toThrow('Invalid transition');
    });
  });

  describe('selectedLongArm store field', () => {
    it('should start as null', () => {
      expect(useAppStore.getState().selectedLongArm).toBeNull();
    });

    it('should store selected long arm gun type', () => {
      useAppStore.setState({ selectedLongArm: GunType.SMG });
      expect(useAppStore.getState().selectedLongArm).toBe(GunType.SMG);
    });

    it('should persist selectedLongArm through transition to Gameplay', () => {
      useAppStore.setState({ selectedLongArm: GunType.Shotgun });
      useAppStore.getState().transition(AppState.Gameplay);
      expect(useAppStore.getState().selectedLongArm).toBe(GunType.Shotgun);
    });
  });

  describe('gun stats from design params', () => {
    it('all guns should have positive damage', () => {
      const params = getDesignParams();
      for (const [, gun] of Object.entries(params.guns)) {
        expect(gun.damage).toBeGreaterThan(0);
      }
    });

    it('all guns should have positive fire rate', () => {
      const params = getDesignParams();
      for (const [, gun] of Object.entries(params.guns)) {
        expect(gun.fireRate).toBeGreaterThan(0);
      }
    });

    it('all guns should have positive magazine size', () => {
      const params = getDesignParams();
      for (const [, gun] of Object.entries(params.guns)) {
        expect(gun.magazineSize).toBeGreaterThan(0);
      }
    });

    it('all guns should have 3 traits', () => {
      const params = getDesignParams();
      for (const [, gun] of Object.entries(params.guns)) {
        expect(gun.traits).toHaveLength(3);
      }
    });
  });
});
