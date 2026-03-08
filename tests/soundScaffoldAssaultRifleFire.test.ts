import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold AssaultRifleFire sound', () => {
  it('SoundId.AssaultRifleFire enum member exists', () => {
    expect(SoundId.AssaultRifleFire).toBeDefined();
    const name = SoundId[SoundId.AssaultRifleFire];
    expect(name).toBe('AssaultRifleFire');
  });

  it('sound manifest has an AssaultRifleFire entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['AssaultRifleFire']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.AssaultRifleFire);
    expect(entry.path).toBe('assets/audio/assault_rifle_fire.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/assault_rifle_fire.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.AssaultRifleFire);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
