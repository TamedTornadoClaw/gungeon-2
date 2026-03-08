import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold ShotgunFire sound', () => {
  it('SoundId.ShotgunFire enum member exists', () => {
    expect(SoundId.ShotgunFire).toBeDefined();
    const name = SoundId[SoundId.ShotgunFire];
    expect(name).toBe('ShotgunFire');
  });

  it('sound manifest has a ShotgunFire entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['ShotgunFire']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.ShotgunFire);
    expect(entry.path).toBe('assets/audio/shotgun_fire.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/shotgun_fire.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.ShotgunFire);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
