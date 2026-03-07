import { describe, it, expect, beforeEach } from 'vitest';
import { AppState } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import {
  useSettingsStore,
  DEFAULT_MASTER_VOLUME,
  DEFAULT_SFX_VOLUME,
  DEFAULT_MOUSE_SENSITIVITY,
} from '../src/store/settingsStore';

function resetAppStore(currentState: AppState = AppState.Settings, previousState: AppState | null = AppState.MainMenu) {
  useAppStore.setState({
    currentState,
    previousState,
    selectedSidearm: null,
    selectedLongArm: null,
    comparisonGunEntityId: null,
    comparisonSlot: null,
    forcedUpgradeGunSlot: null,
    activeShopEntityId: null,
    runStats: null,
  });
}

function resetSettingsStore() {
  useSettingsStore.setState({
    masterVolume: DEFAULT_MASTER_VOLUME,
    sfxVolume: DEFAULT_SFX_VOLUME,
    mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
  });
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    resetAppStore();
    resetSettingsStore();
  });

  describe('state transitions', () => {
    it('Settings returns to MainMenu when previousState is MainMenu', () => {
      resetAppStore(AppState.Settings, AppState.MainMenu);
      useAppStore.getState().transition(AppState.MainMenu);
      expect(useAppStore.getState().currentState).toBe(AppState.MainMenu);
    });

    it('Settings returns to Paused when previousState is Paused', () => {
      resetAppStore(AppState.Settings, AppState.Paused);
      useAppStore.getState().transition(AppState.Paused);
      expect(useAppStore.getState().currentState).toBe(AppState.Paused);
    });

    it('Settings rejects transition to state other than previousState', () => {
      resetAppStore(AppState.Settings, AppState.MainMenu);
      expect(() => useAppStore.getState().transition(AppState.Gameplay)).toThrow('Invalid transition');
    });

    it('MainMenu can transition to Settings', () => {
      resetAppStore(AppState.MainMenu, null);
      useAppStore.getState().transition(AppState.Settings);
      expect(useAppStore.getState().currentState).toBe(AppState.Settings);
      expect(useAppStore.getState().previousState).toBe(AppState.MainMenu);
    });

    it('Paused can transition to Settings', () => {
      resetAppStore(AppState.Paused, AppState.Gameplay);
      useAppStore.getState().transition(AppState.Settings);
      expect(useAppStore.getState().currentState).toBe(AppState.Settings);
      expect(useAppStore.getState().previousState).toBe(AppState.Paused);
    });
  });

  describe('settings store', () => {
    it('has correct default values', () => {
      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(DEFAULT_MASTER_VOLUME);
      expect(state.sfxVolume).toBe(DEFAULT_SFX_VOLUME);
      expect(state.mouseSensitivity).toBe(DEFAULT_MOUSE_SENSITIVITY);
    });

    it('setMasterVolume updates masterVolume', () => {
      useSettingsStore.getState().setMasterVolume(0.5);
      expect(useSettingsStore.getState().masterVolume).toBe(0.5);
    });

    it('setSfxVolume updates sfxVolume', () => {
      useSettingsStore.getState().setSfxVolume(0.3);
      expect(useSettingsStore.getState().sfxVolume).toBe(0.3);
    });

    it('setMouseSensitivity updates mouseSensitivity', () => {
      useSettingsStore.getState().setMouseSensitivity(0.9);
      expect(useSettingsStore.getState().mouseSensitivity).toBe(0.9);
    });

    it('setMasterVolume to 0 sets volume to zero', () => {
      useSettingsStore.getState().setMasterVolume(0);
      expect(useSettingsStore.getState().masterVolume).toBe(0);
    });

    it('setMasterVolume to 1 sets volume to max', () => {
      useSettingsStore.getState().setMasterVolume(1);
      expect(useSettingsStore.getState().masterVolume).toBe(1);
    });

    it('multiple setting changes are independent', () => {
      useSettingsStore.getState().setMasterVolume(0.1);
      useSettingsStore.getState().setSfxVolume(0.2);
      useSettingsStore.getState().setMouseSensitivity(0.3);
      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(0.1);
      expect(state.sfxVolume).toBe(0.2);
      expect(state.mouseSensitivity).toBe(0.3);
    });
  });
});
