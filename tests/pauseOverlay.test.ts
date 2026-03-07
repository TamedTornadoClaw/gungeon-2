import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';

function resetStore(state: AppState = AppState.Loading, previous: AppState | null = null) {
  useAppStore.setState({
    currentState: state,
    previousState: previous,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
}

describe('PauseOverlay', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('visibility', () => {
    it('is only relevant during Paused state', () => {
      resetStore(AppState.Paused, AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Paused);
    });

    it('is not relevant during Gameplay state', () => {
      resetStore(AppState.Gameplay, AppState.WeaponSelect);
      expect(useAppStore.getState().currentState).not.toBe(AppState.Paused);
    });

    it('is not relevant during MainMenu state', () => {
      resetStore(AppState.MainMenu);
      expect(useAppStore.getState().currentState).not.toBe(AppState.Paused);
    });
  });

  describe('transitions from Paused', () => {
    beforeEach(() => {
      resetStore(AppState.Paused, AppState.Gameplay);
    });

    it('Resume transitions to Gameplay', () => {
      useAppStore.getState().transition(AppState.Gameplay);
      expect(useAppStore.getState().currentState).toBe(AppState.Gameplay);
    });

    it('Settings transitions to Settings', () => {
      useAppStore.getState().transition(AppState.Settings);
      expect(useAppStore.getState().currentState).toBe(AppState.Settings);
    });

    it('Quit to Menu transitions to MainMenu', () => {
      useAppStore.getState().transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('rejects invalid transitions from Paused', () => {
      expect(() => useAppStore.getState().transition(AppState.Death)).toThrow(
        /Invalid transition/,
      );
    });

    it('rejects transition to Victory from Paused', () => {
      expect(() => useAppStore.getState().transition(AppState.Victory)).toThrow(
        /Invalid transition/,
      );
    });

    it('rejects transition to WeaponSelect from Paused', () => {
      expect(() => useAppStore.getState().transition(AppState.WeaponSelect)).toThrow(
        /Invalid transition/,
      );
    });
  });

  describe('previousState tracking', () => {
    it('sets previousState to Gameplay when entering Paused', () => {
      resetStore(AppState.Gameplay, AppState.WeaponSelect);
      useAppStore.getState().transition(AppState.Paused);
      expect(useAppStore.getState().previousState).toBe(AppState.Gameplay);
    });

    it('sets previousState to Paused when resuming to Gameplay', () => {
      resetStore(AppState.Paused, AppState.Gameplay);
      useAppStore.getState().transition(AppState.Gameplay);
      expect(useAppStore.getState().previousState).toBe(AppState.Paused);
    });

    it('Settings returns to Paused via previousState', () => {
      resetStore(AppState.Paused, AppState.Gameplay);
      useAppStore.getState().transition(AppState.Settings);
      expect(useAppStore.getState().currentState).toBe(AppState.Settings);
      expect(useAppStore.getState().previousState).toBe(AppState.Paused);
      useAppStore.getState().transition(AppState.Paused);
      expect(useAppStore.getState().currentState).toBe(AppState.Paused);
    });
  });
});
