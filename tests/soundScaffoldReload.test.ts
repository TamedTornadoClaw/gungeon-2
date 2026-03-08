import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold Reload sound', () => {
  it('SoundId.Reload enum member exists', () => {
    expect(SoundId.Reload).toBeDefined();
    const name = SoundId[SoundId.Reload];
    expect(name).toBe('Reload');
  });

  it('sound manifest has a Reload entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['Reload']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.Reload);
    expect(entry.path).toBe('assets/audio/reload.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/reload.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.Reload);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
