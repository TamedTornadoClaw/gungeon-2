import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('DoorOpen sound scaffold', () => {
  it('SoundId.DoorOpen exists in the enum', () => {
    expect(SoundId.DoorOpen).toBeDefined();
    expect(typeof SoundId.DoorOpen).toBe('number');
  });

  it('sound manifest has a DoorOpen entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['DoorOpen']).toBeDefined();
  });

  it('manifest entry points to assets/audio/door_open.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['DoorOpen'].path).toBe('assets/audio/door_open.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/door_open.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for DoorOpen', () => {
    const entry = getSoundEntry(SoundId.DoorOpen);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/door_open.ogg');
    expect(entry.loop).toBe(false);
  });

  it('DoorOpen has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['DoorOpen'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
