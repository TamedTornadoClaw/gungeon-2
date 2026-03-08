import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('WaterAmbient sound scaffold', () => {
  it('SoundId.WaterAmbient exists in the enum', () => {
    expect(SoundId.WaterAmbient).toBeDefined();
    expect(typeof SoundId.WaterAmbient).toBe('number');
  });

  it('sound manifest has a WaterAmbient entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['WaterAmbient']).toBeDefined();
  });

  it('manifest entry points to assets/audio/water_ambient.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['WaterAmbient'].path).toBe('assets/audio/water_ambient.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/water_ambient.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for WaterAmbient', () => {
    const entry = getSoundEntry(SoundId.WaterAmbient);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/water_ambient.ogg');
    expect(entry.loop).toBe(true);
  });

  it('WaterAmbient has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['WaterAmbient'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
