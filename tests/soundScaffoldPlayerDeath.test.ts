import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold PlayerDeath sound', () => {
  it('SoundId.PlayerDeath enum member exists', () => {
    expect(SoundId.PlayerDeath).toBeDefined();
    const name = SoundId[SoundId.PlayerDeath];
    expect(name).toBe('PlayerDeath');
  });

  it('sound manifest has a PlayerDeath entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['PlayerDeath']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.PlayerDeath);
    expect(entry.path).toBe('assets/audio/player_death.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/player_death.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.PlayerDeath);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
