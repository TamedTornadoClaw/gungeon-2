import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('KnifeSwing sound scaffold', () => {
  it('SoundId.KnifeSwing exists in the enum', () => {
    expect(SoundId.KnifeSwing).toBeDefined();
    expect(typeof SoundId.KnifeSwing).toBe('number');
  });

  it('sound manifest has a KnifeSwing entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['KnifeSwing']).toBeDefined();
  });

  it('manifest entry points to assets/audio/knife_swing.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['KnifeSwing'].path).toBe('assets/audio/knife_swing.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/knife_swing.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for KnifeSwing', () => {
    const entry = getSoundEntry(SoundId.KnifeSwing);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/knife_swing.ogg');
    expect(entry.loop).toBe(false);
  });

  it('KnifeSwing has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['KnifeSwing'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
