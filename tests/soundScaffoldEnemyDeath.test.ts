import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold EnemyDeath sound', () => {
  it('SoundId.EnemyDeath enum member exists', () => {
    expect(SoundId.EnemyDeath).toBeDefined();
    const name = SoundId[SoundId.EnemyDeath];
    expect(name).toBe('EnemyDeath');
  });

  it('sound manifest has an EnemyDeath entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['EnemyDeath']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.EnemyDeath);
    expect(entry.path).toBe('assets/audio/enemy_death.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/enemy_death.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.EnemyDeath);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
