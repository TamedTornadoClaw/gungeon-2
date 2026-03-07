import { create } from 'zustand';
import { GunTrait } from '../ecs/components';
import type { Gun } from '../ecs/components';
import type { World } from '../ecs/world';
import type { EntityId } from '../types';
import { getDesignParams } from '../config/designParams';
import { gunStatSystem } from '../systems/gunStatSystem';

export interface UpgradeTraitData {
  trait: GunTrait;
  level: number;
  maxLevel: number;
  cost: number | null;
}

export interface UpgradeStore {
  gunEntityId: EntityId | null;
  gunXP: number;
  traits: UpgradeTraitData[];
  upgradesSpent: number;
  worldRef: World | null;

  openUpgrade: (gunEntityId: EntityId, world: World) => void;
  spendUpgrade: (traitIndex: number) => boolean;
  closeUpgrade: () => void;
}

function readGunData(world: World, gunEntityId: EntityId) {
  const gun = world.getComponent<Gun>(gunEntityId, 'Gun');
  if (!gun) return null;

  const params = getDesignParams();
  const { xpCosts, maxLevel } = params.traits;

  const traits: UpgradeTraitData[] = gun.traits.map((trait, i) => {
    const level = gun.traitLevels[i];
    const cost = level < maxLevel ? xpCosts[level] : null;
    return { trait, level, maxLevel, cost };
  });

  return { xp: gun.xp, traits };
}

export const useUpgradeStore = create<UpgradeStore>()((set, get) => ({
  gunEntityId: null,
  gunXP: 0,
  traits: [],
  upgradesSpent: 0,
  worldRef: null,

  openUpgrade: (gunEntityId, world) => {
    const data = readGunData(world, gunEntityId);
    if (!data) return;

    set({
      gunEntityId,
      worldRef: world,
      gunXP: data.xp,
      traits: data.traits,
      upgradesSpent: 0,
    });
  },

  spendUpgrade: (traitIndex) => {
    const { gunEntityId, worldRef } = get();
    if (!worldRef || gunEntityId === null) return false;

    const gun = worldRef.getComponent<Gun>(gunEntityId, 'Gun');
    if (!gun) return false;

    const params = getDesignParams();
    const { xpCosts, maxLevel } = params.traits;

    const level = gun.traitLevels[traitIndex];
    if (level >= maxLevel) return false;

    const cost = xpCosts[level];
    if (gun.xp < cost) return false;

    // Apply upgrade
    gun.xp -= cost;
    gun.traitLevels[traitIndex] = level + 1;

    // Recalculate gun stats
    gunStatSystem(worldRef);

    // Re-read gun data for UI
    const data = readGunData(worldRef, gunEntityId);
    if (!data) return false;

    set((state) => ({
      gunXP: data.xp,
      traits: data.traits,
      upgradesSpent: state.upgradesSpent + 1,
    }));

    return true;
  },

  closeUpgrade: () =>
    set({
      gunEntityId: null,
      gunXP: 0,
      traits: [],
      upgradesSpent: 0,
      worldRef: null,
    }),
}));
