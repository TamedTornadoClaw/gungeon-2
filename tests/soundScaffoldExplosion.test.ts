import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Explosion sound scaffold', () => {
  it('SoundId.Explosion exists in the enum', () => {
    expect(SoundId.Explosion).toBeDefined();
    expect(typeof SoundId.Explosion).toBe('number');
  });

  it('sound manifest has an Explosion entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['Explosion']).toBeDefined();
  });

  it('manifest entry points to assets/audio/explosion.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['Explosion'].path).toBe('assets/audio/explosion.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/explosion.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for Explosion', () => {
    const entry = getSoundEntry(SoundId.Explosion);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/explosion.ogg');
    expect(entry.loop).toBe(false);
  });

  it('Explosion has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['Explosion'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
