import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('PistolFire sound scaffold', () => {
  it('SoundId.PistolFire exists in the enum', () => {
    expect(SoundId.PistolFire).toBeDefined();
    expect(typeof SoundId.PistolFire).toBe('number');
  });

  it('sound manifest has a PistolFire entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['PistolFire']).toBeDefined();
  });

  it('manifest entry points to assets/audio/pistol_fire.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['PistolFire'].path).toBe('assets/audio/pistol_fire.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/pistol_fire.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for PistolFire', () => {
    const entry = getSoundEntry(SoundId.PistolFire);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/pistol_fire.ogg');
    expect(entry.loop).toBe(false);
  });

  it('PistolFire has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['PistolFire'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
