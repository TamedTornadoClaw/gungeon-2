import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('PlayerHitGrunt sound scaffold', () => {
  it('SoundId.PlayerHitGrunt exists in the enum', () => {
    expect(SoundId.PlayerHitGrunt).toBeDefined();
    expect(typeof SoundId.PlayerHitGrunt).toBe('number');
  });

  it('sound manifest has a PlayerHitGrunt entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['PlayerHitGrunt']).toBeDefined();
  });

  it('manifest entry points to assets/audio/player_hit_grunt.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['PlayerHitGrunt'].path).toBe('assets/audio/player_hit_grunt.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/player_hit_grunt.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for PlayerHitGrunt', () => {
    const entry = getSoundEntry(SoundId.PlayerHitGrunt);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/player_hit_grunt.ogg');
    expect(entry.loop).toBe(false);
  });

  it('PlayerHitGrunt has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['PlayerHitGrunt'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
