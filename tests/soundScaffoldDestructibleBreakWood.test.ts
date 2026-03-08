import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('DestructibleBreakWood sound scaffold', () => {
  it('SoundId.DestructibleBreakWood exists in the enum', () => {
    expect(SoundId.DestructibleBreakWood).toBeDefined();
    expect(typeof SoundId.DestructibleBreakWood).toBe('number');
  });

  it('sound manifest has a DestructibleBreakWood entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['DestructibleBreakWood']).toBeDefined();
  });

  it('manifest entry points to assets/audio/destructible_break_wood.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['DestructibleBreakWood'].path).toBe('assets/audio/destructible_break_wood.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/destructible_break_wood.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for DestructibleBreakWood', () => {
    const entry = getSoundEntry(SoundId.DestructibleBreakWood);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/destructible_break_wood.ogg');
    expect(entry.loop).toBe(false);
  });

  it('DestructibleBreakWood has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['DestructibleBreakWood'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
