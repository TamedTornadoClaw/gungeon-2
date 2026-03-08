import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold Footstep sound', () => {
  it('SoundId.Footstep enum member exists', () => {
    expect(SoundId.Footstep).toBeDefined();
    const name = SoundId[SoundId.Footstep];
    expect(name).toBe('Footstep');
  });

  it('sound manifest has a Footstep entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['Footstep']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.Footstep);
    expect(entry.path).toBe('assets/audio/footstep.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/footstep.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.Footstep);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
