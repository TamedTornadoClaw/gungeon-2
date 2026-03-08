import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('FireAmbient sound scaffold', () => {
  it('SoundId.FireAmbient exists in the enum', () => {
    expect(SoundId.FireAmbient).toBeDefined();
    expect(typeof SoundId.FireAmbient).toBe('number');
  });

  it('sound manifest has a FireAmbient entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['FireAmbient']).toBeDefined();
  });

  it('manifest entry points to assets/audio/fire_ambient.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['FireAmbient'].path).toBe('assets/audio/fire_ambient.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/fire_ambient.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for FireAmbient', () => {
    const entry = getSoundEntry(SoundId.FireAmbient);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/fire_ambient.ogg');
    expect(entry.loop).toBe(true);
  });

  it('FireAmbient has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['FireAmbient'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
