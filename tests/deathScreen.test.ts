import { describe, it, expect, beforeEach } from 'vitest';
import { AppState, GunType } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import type { RunStats } from '../src/store/appStore';

function resetStore(overrides?: Partial<ReturnType<typeof useAppStore.getState>>) {
  useAppStore.setState({
    currentState: AppState.Death,
    previousState: AppState.Gameplay,
    selectedSidearm: null,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
    ...overrides,
  });
}

describe('DeathScreen', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('state transitions', () => {
    it('transitions from Death to MainMenu', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
      expect(useAppStore.getState().previousState).toBe(AppState.Death);
    });

    it('rejects invalid transitions from Death', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.Gameplay)).toThrow('Invalid transition');
      expect(() => transition(AppState.WeaponSelect)).toThrow('Invalid transition');
      expect(() => transition(AppState.Paused)).toThrow('Invalid transition');
      expect(() => transition(AppState.Victory)).toThrow('Invalid transition');
      expect(() => transition(AppState.Loading)).toThrow('Invalid transition');
      expect(() => transition(AppState.Settings)).toThrow('Invalid transition');
    });

    it('Death is only reachable from Gameplay', () => {
      // Gameplay -> Death is valid
      useAppStore.setState({ currentState: AppState.Gameplay, previousState: null });
      useAppStore.getState().transition(AppState.Death);
      expect(useAppStore.getState().currentState).toBe(AppState.Death);

      // MainMenu -> Death is invalid
      useAppStore.setState({ currentState: AppState.MainMenu, previousState: null });
      expect(() => useAppStore.getState().transition(AppState.Death)).toThrow('Invalid transition');
    });
  });

  describe('runStats', () => {
    it('stores and retrieves run stats', () => {
      const stats: RunStats = {
        kills: 42,
        depthReached: 5,
        timeSurvived: 312.5,
        gunsUsed: [GunType.Pistol, GunType.Shotgun],
        traitsLeveled: 7,
      };
      resetStore({ runStats: stats });
      const { runStats } = useAppStore.getState();
      expect(runStats).toEqual(stats);
    });

    it('runStats can be null', () => {
      resetStore({ runStats: null });
      const { runStats } = useAppStore.getState();
      expect(runStats).toBeNull();
    });

    it('handles empty gunsUsed array', () => {
      const stats: RunStats = {
        kills: 0,
        depthReached: 1,
        timeSurvived: 5,
        gunsUsed: [],
        traitsLeveled: 0,
      };
      resetStore({ runStats: stats });
      const { runStats } = useAppStore.getState();
      expect(runStats!.gunsUsed).toEqual([]);
    });

    it('handles zero values in stats', () => {
      const stats: RunStats = {
        kills: 0,
        depthReached: 0,
        timeSurvived: 0,
        gunsUsed: [],
        traitsLeveled: 0,
      };
      resetStore({ runStats: stats });
      const { runStats } = useAppStore.getState();
      expect(runStats!.kills).toBe(0);
      expect(runStats!.depthReached).toBe(0);
      expect(runStats!.timeSurvived).toBe(0);
      expect(runStats!.traitsLeveled).toBe(0);
    });
  });
});
