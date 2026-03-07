import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SettingsStore {
  masterVolume: number;
  sfxVolume: number;
  mouseSensitivity: number;
  setMasterVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  setMouseSensitivity: (v: number) => void;
}

export const DEFAULT_MASTER_VOLUME = 0.8;
export const DEFAULT_SFX_VOLUME = 0.8;
export const DEFAULT_MOUSE_SENSITIVITY = 0.5;

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      masterVolume: DEFAULT_MASTER_VOLUME,
      sfxVolume: DEFAULT_SFX_VOLUME,
      mouseSensitivity: DEFAULT_MOUSE_SENSITIVITY,
      setMasterVolume: (v: number) => set({ masterVolume: v }),
      setSfxVolume: (v: number) => set({ sfxVolume: v }),
      setMouseSensitivity: (v: number) => set({ mouseSensitivity: v }),
    }),
    {
      name: 'gungeon-settings',
    },
  ),
);
