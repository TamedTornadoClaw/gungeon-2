import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('ShotgunFire sound scaffold', () => {
  it('SoundId.ShotgunFire exists in the enum', () => {
    expect(SoundId.ShotgunFire).toBeDefined();
    expect(typeof SoundId.ShotgunFire).toBe('number');
  });

  it('sound manifest has a ShotgunFire entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['ShotgunFire']).toBeDefined();
  });

  it('manifest entry points to assets/audio/shotgun_fire.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['ShotgunFire'].path).toBe('assets/audio/shotgun_fire.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/shotgun_fire.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for ShotgunFire', () => {
    const entry = getSoundEntry(SoundId.ShotgunFire);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/shotgun_fire.ogg');
    expect(entry.loop).toBe(false);
  });

  it('ShotgunFire has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['ShotgunFire'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
