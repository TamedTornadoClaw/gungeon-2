import { create } from 'zustand';
import { GunTrait } from '../ecs/components';
import type { Gun } from '../ecs/components';
import type { World } from '../ecs/world';
import type { EntityId } from '../types';
import { getDesignParams } from '../config/designParams';

export interface UpgradeStore {
  gunEntityId: EntityId | null;
  worldRef: World | null;
  xp: number;
  traits: [GunTrait, GunTrait, GunTrait];
  traitLevels: [number, number, number];

  openUpgrade: (gunEntityId: EntityId, world: World) => void;
  spendXP: (traitIndex: number) => boolean;
  closeUpgrade: () => void;
}

export const useUpgradeStore = create<UpgradeStore>()((set, get) => ({
  gunEntityId: null,
  worldRef: null,
  xp: 0,
  traits: [GunTrait.Damage, GunTrait.Damage, GunTrait.Damage],
  traitLevels: [0, 0, 0],

  openUpgrade: (gunEntityId, world) => {
    const gun = world.getComponent<Gun>(gunEntityId, 'Gun');
    if (!gun) return;
    set({
      gunEntityId,
      worldRef: world,
      xp: gun.xp,
      traits: [...gun.traits] as [GunTrait, GunTrait, GunTrait],
      traitLevels: [...gun.traitLevels] as [number, number, number],
    });
  },

  spendXP: (traitIndex) => {
    const { gunEntityId, worldRef, xp, traitLevels } = get();
    if (!worldRef || gunEntityId === null) return false;

    const gun = worldRef.getComponent<Gun>(gunEntityId, 'Gun');
    if (!gun) return false;

    const params = getDesignParams();
    const level = traitLevels[traitIndex];
    if (level >= params.traits.maxLevel) return false;

    const cost = params.traits.xpCosts[level];
    if (xp < cost) return false;

    // Update ECS component
    gun.xp -= cost;
    gun.traitLevels[traitIndex] = level + 1;

    // Update store
    const newLevels = [...traitLevels] as [number, number, number];
    newLevels[traitIndex] = level + 1;
    set({
      xp: gun.xp,
      traitLevels: newLevels,
    });

    return true;
  },

  closeUpgrade: () =>
    set({
      gunEntityId: null,
      worldRef: null,
      xp: 0,
      traits: [GunTrait.Damage, GunTrait.Damage, GunTrait.Damage],
      traitLevels: [0, 0, 0],
    }),
}));
