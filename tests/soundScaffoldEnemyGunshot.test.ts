import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('EnemyGunshot sound scaffold', () => {
  it('SoundId.EnemyGunshot exists in the enum', () => {
    expect(SoundId.EnemyGunshot).toBeDefined();
    expect(typeof SoundId.EnemyGunshot).toBe('number');
  });

  it('sound manifest has an EnemyGunshot entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['EnemyGunshot']).toBeDefined();
  });

  it('manifest entry points to assets/audio/enemy_gunshot.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['EnemyGunshot'].path).toBe('assets/audio/enemy_gunshot.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/enemy_gunshot.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for EnemyGunshot', () => {
    const entry = getSoundEntry(SoundId.EnemyGunshot);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/enemy_gunshot.ogg');
    expect(entry.loop).toBe(false);
  });

  it('EnemyGunshot has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['EnemyGunshot'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
