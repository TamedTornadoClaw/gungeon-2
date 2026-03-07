/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from 'react';

const STORAGE_KEY = 'gungeon-settings';

async function freshStore() {
  vi.resetModules();
  const mod = await import('../src/store/settingsStore');
  return mod;
}

describe('SettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe('interface matches states.md', () => {
    it('has masterVolume, sfxVolume, mouseSensitivity properties', async () => {
      const { useSettingsStore } = await freshStore();
      const state = useSettingsStore.getState();
      expect(state).toHaveProperty('masterVolume');
      expect(state).toHaveProperty('sfxVolume');
      expect(state).toHaveProperty('mouseSensitivity');
    });

    it('has setter functions for all settings', async () => {
      const { useSettingsStore } = await freshStore();
      const state = useSettingsStore.getState();
      expect(typeof state.setMasterVolume).toBe('function');
      expect(typeof state.setSfxVolume).toBe('function');
      expect(typeof state.setMouseSensitivity).toBe('function');
    });
  });

  describe('default values', () => {
    it('uses defaults when no localStorage entry exists', async () => {
      const { useSettingsStore, DEFAULT_MASTER_VOLUME, DEFAULT_SFX_VOLUME, DEFAULT_MOUSE_SENSITIVITY } = await freshStore();
      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(DEFAULT_MASTER_VOLUME);
      expect(state.sfxVolume).toBe(DEFAULT_SFX_VOLUME);
      expect(state.mouseSensitivity).toBe(DEFAULT_MOUSE_SENSITIVITY);
    });
  });

  describe('setters update state', () => {
    it('setMasterVolume updates masterVolume', async () => {
      const { useSettingsStore } = await freshStore();
      act(() => {
        useSettingsStore.getState().setMasterVolume(0.3);
      });
      expect(useSettingsStore.getState().masterVolume).toBe(0.3);
    });

    it('setSfxVolume updates sfxVolume', async () => {
      const { useSettingsStore } = await freshStore();
      act(() => {
        useSettingsStore.getState().setSfxVolume(0.6);
      });
      expect(useSettingsStore.getState().sfxVolume).toBe(0.6);
    });

    it('setMouseSensitivity updates mouseSensitivity', async () => {
      const { useSettingsStore } = await freshStore();
      act(() => {
        useSettingsStore.getState().setMouseSensitivity(1.0);
      });
      expect(useSettingsStore.getState().mouseSensitivity).toBe(1.0);
    });
  });

  describe('persistence', () => {
    it('persists values to localStorage on change', async () => {
      const { useSettingsStore } = await freshStore();
      act(() => {
        useSettingsStore.getState().setMasterVolume(0.42);
      });

      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.state.masterVolume).toBe(0.42);
    });

    it('persists all settings fields', async () => {
      const { useSettingsStore } = await freshStore();
      act(() => {
        useSettingsStore.getState().setMasterVolume(0.1);
        useSettingsStore.getState().setSfxVolume(0.2);
        useSettingsStore.getState().setMouseSensitivity(0.3);
      });

      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = JSON.parse(stored!);
      expect(parsed.state.masterVolume).toBe(0.1);
      expect(parsed.state.sfxVolume).toBe(0.2);
      expect(parsed.state.mouseSensitivity).toBe(0.3);
    });

    it('loads values from localStorage on init', async () => {
      const savedState = {
        state: {
          masterVolume: 0.15,
          sfxVolume: 0.25,
          mouseSensitivity: 0.75,
        },
        version: 0,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedState));

      const { useSettingsStore } = await freshStore();

      const state = useSettingsStore.getState();
      expect(state.masterVolume).toBe(0.15);
      expect(state.sfxVolume).toBe(0.25);
      expect(state.mouseSensitivity).toBe(0.75);
    });

    it('round-trips through localStorage correctly', async () => {
      const { useSettingsStore } = await freshStore();

      // Set values
      act(() => {
        useSettingsStore.getState().setMasterVolume(0.33);
        useSettingsStore.getState().setSfxVolume(0.66);
        useSettingsStore.getState().setMouseSensitivity(0.99);
      });

      // Read back from localStorage directly (simulating app restart)
      const stored = localStorage.getItem(STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.state.masterVolume).toBe(0.33);
      expect(parsed.state.sfxVolume).toBe(0.66);
      expect(parsed.state.mouseSensitivity).toBe(0.99);

      // Create a fresh store that reads from the same localStorage
      const { useSettingsStore: freshSettingsStore } = await freshStore();
      const state = freshSettingsStore.getState();
      expect(state.masterVolume).toBe(0.33);
      expect(state.sfxVolume).toBe(0.66);
      expect(state.mouseSensitivity).toBe(0.99);
    });
  });
});
