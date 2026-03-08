import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold LMGFire sound', () => {
  it('SoundId.LMGFire enum member exists', () => {
    expect(SoundId.LMGFire).toBeDefined();
    const name = SoundId[SoundId.LMGFire];
    expect(name).toBe('LMGFire');
  });

  it('sound manifest has an LMGFire entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['LMGFire']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.LMGFire);
    expect(entry.path).toBe('assets/audio/lmg_fire.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/lmg_fire.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.LMGFire);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
