import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Pause sound scaffold', () => {
  it('SoundId.Pause exists in the enum', () => {
    expect(SoundId.Pause).toBeDefined();
    expect(typeof SoundId.Pause).toBe('number');
  });

  it('sound manifest has a Pause entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['Pause']).toBeDefined();
  });

  it('manifest entry points to assets/audio/pause.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['Pause'].path).toBe('assets/audio/pause.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/pause.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for Pause', () => {
    const entry = getSoundEntry(SoundId.Pause);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/pause.ogg');
    expect(entry.loop).toBe(false);
  });

  it('Pause has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['Pause'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
