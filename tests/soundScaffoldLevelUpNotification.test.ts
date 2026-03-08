import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('LevelUpNotification sound scaffold', () => {
  it('SoundId.LevelUpNotification exists in the enum', () => {
    expect(SoundId.LevelUpNotification).toBeDefined();
    expect(typeof SoundId.LevelUpNotification).toBe('number');
  });

  it('sound manifest has a LevelUpNotification entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['LevelUpNotification']).toBeDefined();
  });

  it('manifest entry points to assets/audio/level_up_notification.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['LevelUpNotification'].path).toBe('assets/audio/level_up_notification.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/level_up_notification.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for LevelUpNotification', () => {
    const entry = getSoundEntry(SoundId.LevelUpNotification);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/level_up_notification.ogg');
    expect(entry.loop).toBe(false);
  });

  it('LevelUpNotification has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['LevelUpNotification'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
