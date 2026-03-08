import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Unpause sound scaffold', () => {
  it('SoundId.Unpause exists in the enum', () => {
    expect(SoundId.Unpause).toBeDefined();
    expect(typeof SoundId.Unpause).toBe('number');
  });

  it('sound manifest has an Unpause entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['Unpause']).toBeDefined();
  });

  it('manifest entry points to assets/audio/unpause.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['Unpause'].path).toBe('assets/audio/unpause.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/unpause.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for Unpause', () => {
    const entry = getSoundEntry(SoundId.Unpause);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/unpause.ogg');
    expect(entry.loop).toBe(false);
  });

  it('Unpause has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['Unpause'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
