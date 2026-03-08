import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('EmptyClipClick sound scaffold', () => {
  it('SoundId.EmptyClipClick exists in the enum', () => {
    expect(SoundId.EmptyClipClick).toBeDefined();
    expect(typeof SoundId.EmptyClipClick).toBe('number');
  });

  it('sound manifest has an EmptyClipClick entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['EmptyClipClick']).toBeDefined();
  });

  it('manifest entry points to assets/audio/empty_clip_click.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['EmptyClipClick'].path).toBe('assets/audio/empty_clip_click.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/empty_clip_click.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for EmptyClipClick', () => {
    const entry = getSoundEntry(SoundId.EmptyClipClick);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/empty_clip_click.ogg');
    expect(entry.loop).toBe(false);
  });

  it('EmptyClipClick has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['EmptyClipClick'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
