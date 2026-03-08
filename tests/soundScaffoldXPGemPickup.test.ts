import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('XPGemPickup sound scaffold', () => {
  it('SoundId.XPGemPickup exists in the enum', () => {
    expect(SoundId.XPGemPickup).toBeDefined();
    expect(typeof SoundId.XPGemPickup).toBe('number');
  });

  it('sound manifest has a XPGemPickup entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['XPGemPickup']).toBeDefined();
  });

  it('manifest entry points to assets/audio/xp_gem_pickup.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['XPGemPickup'].path).toBe('assets/audio/xp_gem_pickup.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/xp_gem_pickup.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for XPGemPickup', () => {
    const entry = getSoundEntry(SoundId.XPGemPickup);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/xp_gem_pickup.ogg');
    expect(entry.loop).toBe(false);
  });

  it('XPGemPickup has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['XPGemPickup'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
