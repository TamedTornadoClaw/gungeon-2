import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('UpgradeSpent sound scaffold', () => {
  it('SoundId.UpgradeSpent exists in the enum', () => {
    expect(SoundId.UpgradeSpent).toBeDefined();
    expect(typeof SoundId.UpgradeSpent).toBe('number');
  });

  it('sound manifest has an UpgradeSpent entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['UpgradeSpent']).toBeDefined();
  });

  it('manifest entry points to assets/audio/upgrade_spent.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['UpgradeSpent'].path).toBe('assets/audio/upgrade_spent.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/upgrade_spent.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for UpgradeSpent', () => {
    const entry = getSoundEntry(SoundId.UpgradeSpent);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/upgrade_spent.ogg');
    expect(entry.loop).toBe(false);
  });

  it('UpgradeSpent has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['UpgradeSpent'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
