import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('MenuClick sound scaffold', () => {
  it('SoundId.MenuClick exists in the enum', () => {
    expect(SoundId.MenuClick).toBeDefined();
    expect(typeof SoundId.MenuClick).toBe('number');
  });

  it('sound manifest has a MenuClick entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['MenuClick']).toBeDefined();
  });

  it('manifest entry points to assets/audio/menu_click.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['MenuClick'].path).toBe('assets/audio/menu_click.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/menu_click.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for MenuClick', () => {
    const entry = getSoundEntry(SoundId.MenuClick);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/menu_click.ogg');
    expect(entry.loop).toBe(false);
  });

  it('MenuClick has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['MenuClick'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
