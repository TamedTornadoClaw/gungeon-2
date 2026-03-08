import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('GunSwapConfirm sound scaffold', () => {
  it('SoundId.GunSwapConfirm exists in the enum', () => {
    expect(SoundId.GunSwapConfirm).toBeDefined();
    expect(typeof SoundId.GunSwapConfirm).toBe('number');
  });

  it('sound manifest has a GunSwapConfirm entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['GunSwapConfirm']).toBeDefined();
  });

  it('manifest entry points to assets/audio/gun_swap_confirm.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['GunSwapConfirm'].path).toBe('assets/audio/gun_swap_confirm.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/gun_swap_confirm.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for GunSwapConfirm', () => {
    const entry = getSoundEntry(SoundId.GunSwapConfirm);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/gun_swap_confirm.ogg');
    expect(entry.loop).toBe(false);
  });

  it('GunSwapConfirm has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['GunSwapConfirm'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
