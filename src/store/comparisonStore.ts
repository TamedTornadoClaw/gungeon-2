import { create } from 'zustand';
import type { GunTrait, GunType } from '../ecs/components';

export interface ComparisonGunData {
  gunType: GunType;
  damage: number;
  fireRate: number;
  magazineSize: number;
  reloadTime: number;
  spread: number;
  projectileCount: number;
  projectileSpeed: number;
  knockback: number;
  critChance: number;
  critMultiplier: number;
  traits: [GunTrait, GunTrait, GunTrait];
  traitLevels: [number, number, number];
}

export interface ComparisonStore {
  currentGun: ComparisonGunData | null;
  foundGun: ComparisonGunData | null;
  swapGuns: (() => void) | null;

  setComparison: (current: ComparisonGunData, found: ComparisonGunData, swap: () => void) => void;
  clearComparison: () => void;
}

export const useComparisonStore = create<ComparisonStore>()((set) => ({
  currentGun: null,
  foundGun: null,
  swapGuns: null,

  setComparison: (current, found, swap) =>
    set({ currentGun: current, foundGun: found, swapGuns: swap }),
  clearComparison: () =>
    set({ currentGun: null, foundGun: null, swapGuns: null }),
}));
