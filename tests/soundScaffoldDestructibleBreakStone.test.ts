import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('DestructibleBreakStone sound scaffold', () => {
  it('SoundId.DestructibleBreakStone exists in the enum', () => {
    expect(SoundId.DestructibleBreakStone).toBeDefined();
    expect(typeof SoundId.DestructibleBreakStone).toBe('number');
  });

  it('sound manifest has a DestructibleBreakStone entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['DestructibleBreakStone']).toBeDefined();
  });

  it('manifest entry points to assets/audio/destructible_break_stone.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['DestructibleBreakStone'].path).toBe('assets/audio/destructible_break_stone.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/destructible_break_stone.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for DestructibleBreakStone', () => {
    const entry = getSoundEntry(SoundId.DestructibleBreakStone);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/destructible_break_stone.ogg');
    expect(entry.loop).toBe(false);
  });

  it('DestructibleBreakStone has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['DestructibleBreakStone'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
