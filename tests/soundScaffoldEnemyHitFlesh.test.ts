import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('EnemyHitFlesh sound scaffold', () => {
  it('SoundId.EnemyHitFlesh exists in the enum', () => {
    expect(SoundId.EnemyHitFlesh).toBeDefined();
    expect(typeof SoundId.EnemyHitFlesh).toBe('number');
  });

  it('sound manifest has an EnemyHitFlesh entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['EnemyHitFlesh']).toBeDefined();
  });

  it('manifest entry points to assets/audio/enemy_hit_flesh.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['EnemyHitFlesh'].path).toBe('assets/audio/enemy_hit_flesh.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/enemy_hit_flesh.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for EnemyHitFlesh', () => {
    const entry = getSoundEntry(SoundId.EnemyHitFlesh);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/enemy_hit_flesh.ogg');
    expect(entry.loop).toBe(false);
  });

  it('EnemyHitFlesh has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['EnemyHitFlesh'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
