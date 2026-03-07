import { create } from 'zustand';
import { AppState, GunType, WeaponSlot } from '../ecs/components';
import type { EntityId } from '../types';

export interface RunStats {
  kills: number;
  depthReached: number;
  timeSurvived: number;
  gunsUsed: GunType[];
  traitsLeveled: number;
}

export interface AppStore {
  currentState: AppState;
  previousState: AppState | null;
  transition: (to: AppState) => void;
  selectedLongArm: GunType | null;
  comparisonGunEntityId: EntityId | null;
  comparisonSlot: WeaponSlot | null;
  forcedUpgradeGunSlot: WeaponSlot | null;
  activeShopEntityId: EntityId | null;
  runStats: RunStats | null;
}

const TRANSITION_MAP: ReadonlyMap<AppState, ReadonlySet<AppState>> = new Map([
  [AppState.Loading, new Set([AppState.MainMenu])],
  [AppState.MainMenu, new Set([AppState.WeaponSelect, AppState.Settings])],
  [AppState.WeaponSelect, new Set([AppState.Gameplay, AppState.MainMenu])],
  [AppState.Gameplay, new Set([
    AppState.Paused,
    AppState.GunComparison,
    AppState.GunUpgrade,
    AppState.ForcedUpgrade,
    AppState.ShopBrowse,
    AppState.Death,
    AppState.Victory,
  ])],
  [AppState.Paused, new Set([AppState.Gameplay, AppState.Settings, AppState.MainMenu])],
  [AppState.GunComparison, new Set([AppState.Gameplay])],
  [AppState.GunUpgrade, new Set([AppState.Gameplay])],
  [AppState.ForcedUpgrade, new Set([AppState.Gameplay])],
  [AppState.ShopBrowse, new Set([AppState.Gameplay])],
  [AppState.Death, new Set([AppState.MainMenu])],
  [AppState.Victory, new Set([AppState.MainMenu])],
  [AppState.Settings, new Set<AppState>()],
]);

export const useAppStore = create<AppStore>()((set, get) => ({
  currentState: AppState.Loading,
  previousState: null,
  selectedLongArm: null,
  comparisonGunEntityId: null,
  comparisonSlot: null,
  forcedUpgradeGunSlot: null,
  activeShopEntityId: null,
  runStats: null,

  transition: (to: AppState) => {
    const state = get();
    const from = state.currentState;

    if (!(to in AppState)) {
      throw new Error(`Invalid transition: ${AppState[from] ?? String(from)} -> ${String(to)}`);
    }

    if (from === AppState.Settings) {
      if (to !== state.previousState) {
        throw new Error(
          `Invalid transition: ${AppState[from]} -> ${AppState[to]} (Settings can only return to previousState: ${state.previousState !== null ? AppState[state.previousState] : 'null'})`,
        );
      }
      set({ currentState: to, previousState: from });
      return;
    }

    const validTargets = TRANSITION_MAP.get(from);
    if (!validTargets || !validTargets.has(to)) {
      throw new Error(`Invalid transition: ${AppState[from]} -> ${AppState[to]}`);
    }

    set({ currentState: to, previousState: from });
  },
}));
