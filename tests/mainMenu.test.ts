import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';

function resetStore() {
  useAppStore.setState({
    currentState: AppState.MainMenu,
    previousState: null,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
}

describe('MainMenu', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('state transitions', () => {
    it('transitions from MainMenu to WeaponSelect', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.WeaponSelect);
      expect(useAppStore.getState().currentState).toBe(AppState.WeaponSelect);
      expect(useAppStore.getState().previousState).toBe(AppState.MainMenu);
    });

    it('transitions from MainMenu to Settings', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.Settings);
      expect(useAppStore.getState().currentState).toBe(AppState.Settings);
      expect(useAppStore.getState().previousState).toBe(AppState.MainMenu);
    });

    it('rejects invalid transitions from MainMenu', () => {
      const { transition } = useAppStore.getState();
      expect(() => transition(AppState.Gameplay)).toThrow('Invalid transition');
      expect(() => transition(AppState.Death)).toThrow('Invalid transition');
      expect(() => transition(AppState.Victory)).toThrow('Invalid transition');
      expect(() => transition(AppState.Paused)).toThrow('Invalid transition');
    });

    it('MainMenu is only reachable from valid source states', () => {
      // WeaponSelect -> MainMenu
      useAppStore.setState({ currentState: AppState.WeaponSelect, previousState: AppState.MainMenu });
      useAppStore.getState().transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);

      // Death -> MainMenu
      useAppStore.setState({ currentState: AppState.Death, previousState: AppState.Gameplay });
      useAppStore.getState().transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);

      // Victory -> MainMenu
      useAppStore.setState({ currentState: AppState.Victory, previousState: AppState.Gameplay });
      useAppStore.getState().transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('Settings returns to MainMenu when previousState is MainMenu', () => {
      const { transition } = useAppStore.getState();
      transition(AppState.Settings);
      expect(useAppStore.getState().currentState).toBe(AppState.Settings);

      useAppStore.getState().transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });
  });
});
