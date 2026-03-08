import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('GunPickup sound scaffold', () => {
  it('SoundId.GunPickup exists in the enum', () => {
    expect(SoundId.GunPickup).toBeDefined();
    expect(typeof SoundId.GunPickup).toBe('number');
  });

  it('sound manifest has a GunPickup entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['GunPickup']).toBeDefined();
  });

  it('manifest entry points to assets/audio/gun_pickup.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['GunPickup'].path).toBe('assets/audio/gun_pickup.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/gun_pickup.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for GunPickup', () => {
    const entry = getSoundEntry(SoundId.GunPickup);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/gun_pickup.ogg');
    expect(entry.loop).toBe(false);
  });

  it('GunPickup has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['GunPickup'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
