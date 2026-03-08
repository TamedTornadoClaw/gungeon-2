import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('ComparisonScreenOpen sound scaffold', () => {
  it('SoundId.ComparisonScreenOpen exists in the enum', () => {
    expect(SoundId.ComparisonScreenOpen).toBeDefined();
    expect(typeof SoundId.ComparisonScreenOpen).toBe('number');
  });

  it('sound manifest has a ComparisonScreenOpen entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['ComparisonScreenOpen']).toBeDefined();
  });

  it('manifest entry points to assets/audio/comparison_screen_open.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['ComparisonScreenOpen'].path).toBe('assets/audio/comparison_screen_open.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/comparison_screen_open.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for ComparisonScreenOpen', () => {
    const entry = getSoundEntry(SoundId.ComparisonScreenOpen);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/comparison_screen_open.ogg');
    expect(entry.loop).toBe(false);
  });

  it('ComparisonScreenOpen has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['ComparisonScreenOpen'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
