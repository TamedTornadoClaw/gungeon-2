import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('EnemyHitArmor sound scaffold', () => {
  it('SoundId.EnemyHitArmor exists in the enum', () => {
    expect(SoundId.EnemyHitArmor).toBeDefined();
    expect(typeof SoundId.EnemyHitArmor).toBe('number');
  });

  it('sound manifest has an EnemyHitArmor entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['EnemyHitArmor']).toBeDefined();
  });

  it('manifest entry points to assets/audio/enemy_hit_armor.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['EnemyHitArmor'].path).toBe('assets/audio/enemy_hit_armor.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/enemy_hit_armor.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for EnemyHitArmor', () => {
    const entry = getSoundEntry(SoundId.EnemyHitArmor);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/enemy_hit_armor.ogg');
    expect(entry.loop).toBe(false);
  });

  it('EnemyHitArmor has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['EnemyHitArmor'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
