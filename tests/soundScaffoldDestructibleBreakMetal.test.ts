import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('DestructibleBreakMetal sound scaffold', () => {
  it('SoundId.DestructibleBreakMetal exists in the enum', () => {
    expect(SoundId.DestructibleBreakMetal).toBeDefined();
    expect(typeof SoundId.DestructibleBreakMetal).toBe('number');
  });

  it('sound manifest has a DestructibleBreakMetal entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['DestructibleBreakMetal']).toBeDefined();
  });

  it('manifest entry points to assets/audio/destructible_break_metal.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['DestructibleBreakMetal'].path).toBe('assets/audio/destructible_break_metal.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/destructible_break_metal.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for DestructibleBreakMetal', () => {
    const entry = getSoundEntry(SoundId.DestructibleBreakMetal);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/destructible_break_metal.ogg');
    expect(entry.loop).toBe(false);
  });

  it('DestructibleBreakMetal has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['DestructibleBreakMetal'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
