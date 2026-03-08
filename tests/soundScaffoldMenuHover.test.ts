import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('MenuHover sound scaffold', () => {
  it('SoundId.MenuHover exists in the enum', () => {
    expect(SoundId.MenuHover).toBeDefined();
    expect(typeof SoundId.MenuHover).toBe('number');
  });

  it('sound manifest has a MenuHover entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['MenuHover']).toBeDefined();
  });

  it('manifest entry points to assets/audio/menu_hover.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['MenuHover'].path).toBe('assets/audio/menu_hover.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/menu_hover.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for MenuHover', () => {
    const entry = getSoundEntry(SoundId.MenuHover);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/menu_hover.ogg');
    expect(entry.loop).toBe(false);
  });

  it('MenuHover has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['MenuHover'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
