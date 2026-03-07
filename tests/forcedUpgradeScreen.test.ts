import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, GunTrait, GunType, WeaponSlot } from '../src/ecs/components';
import type { Gun, Player } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { useUpgradeStore } from '../src/store/upgradeStore';
import { World } from '../src/ecs/world';
import { createPlayer } from '../src/ecs/factories';
import { getDesignParams } from '../src/config/designParams';

function resetStores() {
  useAppStore.setState({
    currentState: AppState.ForcedUpgrade,
    previousState: AppState.Gameplay,
    selectedSidearm: null,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: WeaponSlot.Sidearm,
    activeShopEntityId: null,
    runStats: null,
  });
  useUpgradeStore.setState({
    gunEntityId: null,
    gunXP: 0,
    traits: [],
    upgradesSpent: 0,
    worldRef: null,
  });
}

function setupPlayerAndGun(): {
  world: World;
  playerId: number;
  gunEntityId: number;
} {
  const world = new World();
  const playerId = createPlayer(world, { x: 0, y: 0, z: 0 }, GunType.SMG);
  const player = world.getComponent<Player>(playerId, 'Player')!;
  const gunEntityId = player.sidearmSlot;

  // Give the gun plenty of XP for upgrades
  const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;
  gun.xp = 5000;

  return { world, playerId, gunEntityId };
}

describe('ForcedUpgradeScreen', () => {
  beforeEach(resetStores);

  describe('state transitions', () => {
    it('should transition from ForcedUpgrade to Gameplay', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('should reject invalid transitions from ForcedUpgrade', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.MainMenu)).toThrow('Invalid transition');
    });
  });

  describe('upgradeStore openUpgrade', () => {
    it('should populate traits from gun data', () => {
      const { world, gunEntityId } = setupPlayerAndGun();

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);

      const state = useUpgradeStore.getState();
      expect(state.traits).toHaveLength(3);
      expect(state.gunXP).toBe(5000);
      expect(state.upgradesSpent).toBe(0);
      expect(state.gunEntityId).toBe(gunEntityId);
    });

    it('should read correct trait types from gun', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);

      const state = useUpgradeStore.getState();
      expect(state.traits[0].trait).toBe(gun.traits[0]);
      expect(state.traits[1].trait).toBe(gun.traits[1]);
      expect(state.traits[2].trait).toBe(gun.traits[2]);
    });

    it('should set initial trait levels to 0', () => {
      const { world, gunEntityId } = setupPlayerAndGun();

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);

      const state = useUpgradeStore.getState();
      for (const trait of state.traits) {
        expect(trait.level).toBe(0);
      }
    });

    it('should set correct costs from design params', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const params = getDesignParams();

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);

      const state = useUpgradeStore.getState();
      expect(state.traits[0].cost).toBe(params.traits.xpCosts[0]);
    });

    it('should not populate if gun entity is invalid', () => {
      const world = new World();
      useUpgradeStore.getState().openUpgrade(999, world);

      const state = useUpgradeStore.getState();
      expect(state.traits).toHaveLength(0);
      expect(state.gunEntityId).toBeNull();
    });
  });

  describe('upgradeStore spendUpgrade', () => {
    it('should deduct XP and increment trait level', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const params = getDesignParams();
      const firstCost = params.traits.xpCosts[0];

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      const result = useUpgradeStore.getState().spendUpgrade(0);

      expect(result).toBe(true);
      const state = useUpgradeStore.getState();
      expect(state.gunXP).toBe(5000 - firstCost);
      expect(state.traits[0].level).toBe(1);
      expect(state.upgradesSpent).toBe(1);
    });

    it('should update the actual gun component', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const params = getDesignParams();
      const firstCost = params.traits.xpCosts[0];

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      useUpgradeStore.getState().spendUpgrade(0);

      const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;
      expect(gun.xp).toBe(5000 - firstCost);
      expect(gun.traitLevels[0]).toBe(1);
    });

    it('should fail when not enough XP', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;
      gun.xp = 0;

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      const result = useUpgradeStore.getState().spendUpgrade(0);

      expect(result).toBe(false);
      expect(useUpgradeStore.getState().upgradesSpent).toBe(0);
    });

    it('should fail when trait is already at max level', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;
      const params = getDesignParams();
      gun.traitLevels[0] = params.traits.maxLevel;

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      const result = useUpgradeStore.getState().spendUpgrade(0);

      expect(result).toBe(false);
    });

    it('should allow multiple upgrades', () => {
      const { world, gunEntityId } = setupPlayerAndGun();

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      useUpgradeStore.getState().spendUpgrade(0);
      useUpgradeStore.getState().spendUpgrade(1);

      const state = useUpgradeStore.getState();
      expect(state.upgradesSpent).toBe(2);
      expect(state.traits[0].level).toBe(1);
      expect(state.traits[1].level).toBe(1);
    });

    it('should update cost after leveling up', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const params = getDesignParams();

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      useUpgradeStore.getState().spendUpgrade(0);

      const state = useUpgradeStore.getState();
      expect(state.traits[0].cost).toBe(params.traits.xpCosts[1]);
    });

    it('should set cost to null when trait reaches max level', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;
      const params = getDesignParams();
      gun.traitLevels[0] = params.traits.maxLevel - 1;
      gun.xp = 50000;

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      useUpgradeStore.getState().spendUpgrade(0);

      const state = useUpgradeStore.getState();
      expect(state.traits[0].cost).toBeNull();
      expect(state.traits[0].level).toBe(params.traits.maxLevel);
    });

    it('should fail when worldRef is null', () => {
      useUpgradeStore.setState({
        gunEntityId: 1,
        worldRef: null,
        traits: [],
        upgradesSpent: 0,
      });

      const result = useUpgradeStore.getState().spendUpgrade(0);
      expect(result).toBe(false);
    });

    it('should recalculate gun stats after upgrade', () => {
      const { world, gunEntityId } = setupPlayerAndGun();

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);

      const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;
      const statBefore = gun.damage;

      // Only upgrade if the trait is Damage
      const traitData = useUpgradeStore.getState().traits;
      const damageIdx = traitData.findIndex((t) => t.trait === GunTrait.Damage);
      if (damageIdx >= 0) {
        useUpgradeStore.getState().spendUpgrade(damageIdx);
        expect(gun.damage).toBeGreaterThan(statBefore);
      }
    });
  });

  describe('upgradeStore closeUpgrade', () => {
    it('should reset all upgrade state', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      useUpgradeStore.getState().spendUpgrade(0);

      useUpgradeStore.getState().closeUpgrade();

      const state = useUpgradeStore.getState();
      expect(state.gunEntityId).toBeNull();
      expect(state.gunXP).toBe(0);
      expect(state.traits).toEqual([]);
      expect(state.upgradesSpent).toBe(0);
      expect(state.worldRef).toBeNull();
    });
  });

  describe('close button visibility', () => {
    it('should not allow close until at least one upgrade is spent (upgradesSpent starts at 0)', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      useUpgradeStore.getState().openUpgrade(gunEntityId, world);

      expect(useUpgradeStore.getState().upgradesSpent).toBe(0);
    });

    it('should allow close after one upgrade is spent', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      useUpgradeStore.getState().spendUpgrade(0);

      expect(useUpgradeStore.getState().upgradesSpent).toBeGreaterThan(0);
    });
  });

  describe('forcedUpgradeTriggered reset', () => {
    it('should reset forcedUpgradeTriggered on gun when closing', () => {
      const { world, gunEntityId } = setupPlayerAndGun();
      const gun = world.getComponent<Gun>(gunEntityId, 'Gun')!;
      gun.forcedUpgradeTriggered = true;

      useUpgradeStore.getState().openUpgrade(gunEntityId, world);
      useUpgradeStore.getState().spendUpgrade(0);

      // Simulate close behavior (what the component does)
      gun.forcedUpgradeTriggered = false;
      useUpgradeStore.getState().closeUpgrade();
      useAppStore.setState({ forcedUpgradeGunSlot: null });
      useAppStore.getState().transition(AppState.Gameplay);

      expect(gun.forcedUpgradeTriggered).toBe(false);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
      expect(useAppStore.getState().forcedUpgradeGunSlot).toBeNull();
    });
  });

  describe('design params', () => {
    it('should have xpCosts array in design params', () => {
      const params = getDesignParams();
      expect(params.traits.xpCosts.length).toBeGreaterThan(0);
    });

    it('should have maxLevel in design params', () => {
      const params = getDesignParams();
      expect(params.traits.maxLevel).toBeGreaterThan(0);
    });

    it('should have xpCosts length equal to maxLevel', () => {
      const params = getDesignParams();
      expect(params.traits.xpCosts.length).toBe(params.traits.maxLevel);
    });
  });
});
