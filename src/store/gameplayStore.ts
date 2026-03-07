import { create } from 'zustand';
import { GunType, WeaponSlot } from '../ecs/components';

export interface GunHUDData {
  gunType: GunType;
  currentAmmo: number;
  magazineSize: number;
  isReloading: boolean;
  reloadTimer: number;
  reloadTime: number;
}

export interface GameplayStore {
  currentHealth: number;
  maxHealth: number;
  currency: number;
  floorDepth: number;
  activeSlot: WeaponSlot;
  activeGun: GunHUDData | null;

  setHealth: (current: number, max: number) => void;
  setCurrency: (amount: number) => void;
  setFloorDepth: (depth: number) => void;
  setActiveSlot: (slot: WeaponSlot) => void;
  setActiveGun: (gun: GunHUDData | null) => void;
}

export const useGameplayStore = create<GameplayStore>()((set) => ({
  currentHealth: 0,
  maxHealth: 0,
  currency: 0,
  floorDepth: 1,
  activeSlot: WeaponSlot.Sidearm,
  activeGun: null,

  setHealth: (current, max) => set({ currentHealth: current, maxHealth: max }),
  setCurrency: (amount) => set({ currency: amount }),
  setFloorDepth: (depth) => set({ floorDepth: depth }),
  setActiveSlot: (slot) => set({ activeSlot: slot }),
  setActiveGun: (gun) => set({ activeGun: gun }),
}));
