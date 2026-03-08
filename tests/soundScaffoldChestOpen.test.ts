import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('ChestOpen sound scaffold', () => {
  it('SoundId.ChestOpen exists in the enum', () => {
    expect(SoundId.ChestOpen).toBeDefined();
    expect(typeof SoundId.ChestOpen).toBe('number');
  });

  it('sound manifest has a ChestOpen entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['ChestOpen']).toBeDefined();
  });

  it('manifest entry points to assets/audio/chest_open.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['ChestOpen'].path).toBe('assets/audio/chest_open.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/chest_open.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for ChestOpen', () => {
    const entry = getSoundEntry(SoundId.ChestOpen);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/chest_open.ogg');
    expect(entry.loop).toBe(false);
  });

  it('ChestOpen has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['ChestOpen'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
