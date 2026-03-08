import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('Scaffold DodgeRollWhoosh sound', () => {
  it('SoundId.DodgeRollWhoosh enum member exists', () => {
    expect(SoundId.DodgeRollWhoosh).toBeDefined();
    const name = SoundId[SoundId.DodgeRollWhoosh];
    expect(name).toBe('DodgeRollWhoosh');
  });

  it('sound manifest has a DodgeRollWhoosh entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['DodgeRollWhoosh']).toBeDefined();
  });

  it('manifest entry points to the correct file path', () => {
    const entry = getSoundEntry(SoundId.DodgeRollWhoosh);
    expect(entry.path).toBe('assets/audio/dodge_roll_whoosh.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/dodge_roll_whoosh.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('manifest entry has valid properties', () => {
    const entry = getSoundEntry(SoundId.DodgeRollWhoosh);
    expect(entry.volume).toBeGreaterThanOrEqual(0);
    expect(entry.volume).toBeLessThanOrEqual(1);
    expect(entry.loop).toBe(false);
    expect(entry.maxInstances).toBeGreaterThanOrEqual(1);
  });
});
