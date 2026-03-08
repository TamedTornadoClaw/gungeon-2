import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('HealthPickup sound scaffold', () => {
  it('SoundId.HealthPickup exists in the enum', () => {
    expect(SoundId.HealthPickup).toBeDefined();
    expect(typeof SoundId.HealthPickup).toBe('number');
  });

  it('sound manifest has a HealthPickup entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['HealthPickup']).toBeDefined();
  });

  it('manifest entry points to assets/audio/health_pickup.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['HealthPickup'].path).toBe('assets/audio/health_pickup.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/health_pickup.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for HealthPickup', () => {
    const entry = getSoundEntry(SoundId.HealthPickup);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/health_pickup.ogg');
    expect(entry.loop).toBe(false);
  });

  it('HealthPickup has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['HealthPickup'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
