import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { validateSoundManifest, getSoundManifest, getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';

describe('soundManifest', () => {
  describe('validateSoundManifest', () => {
    it('accepts the actual sound-manifest.json', () => {
      expect(() => validateSoundManifest(soundManifestJson)).not.toThrow();
    });

    it('rejects null', () => {
      expect(() => validateSoundManifest(null)).toThrow(
        'Sound manifest must be a non-null object',
      );
    });

    it('rejects a non-object', () => {
      expect(() => validateSoundManifest('string')).toThrow(
        'Sound manifest must be a non-null object',
      );
    });

    it('rejects an empty object (missing all SoundId entries)', () => {
      expect(() => validateSoundManifest({})).toThrow(
        'Sound manifest is missing entry for SoundId.',
      );
    });

    it('rejects manifest with unknown key not in SoundId', () => {
      const valid = { ...soundManifestJson } as Record<string, unknown>;
      valid['NonExistentSound'] = {
        path: 'assets/audio/fake.ogg',
        volume: 0.5,
        pitchMin: 1.0,
        pitchMax: 1.0,
        maxInstances: 1,
        loop: false,
      };
      expect(() => validateSoundManifest(valid)).toThrow(
        'Sound manifest contains unknown key "NonExistentSound"',
      );
    });

    it('rejects entry with volume below 0', () => {
      const broken = { ...soundManifestJson } as Record<string, unknown>;
      broken['PistolFire'] = {
        ...(soundManifestJson as Record<string, unknown>)['PistolFire'],
        volume: -0.1,
      };
      expect(() => validateSoundManifest(broken)).toThrow(
        'volume must be a number in [0, 1]',
      );
    });

    it('rejects entry with volume above 1', () => {
      const broken = { ...soundManifestJson } as Record<string, unknown>;
      broken['PistolFire'] = {
        ...(soundManifestJson as Record<string, unknown>)['PistolFire'],
        volume: 1.5,
      };
      expect(() => validateSoundManifest(broken)).toThrow(
        'volume must be a number in [0, 1]',
      );
    });

    it('rejects entry with missing path', () => {
      const broken = { ...soundManifestJson } as Record<string, unknown>;
      const entry = {
        ...(soundManifestJson as Record<string, unknown>)['PistolFire'],
      } as Record<string, unknown>;
      delete entry.path;
      broken['PistolFire'] = entry;
      expect(() => validateSoundManifest(broken)).toThrow(
        'must have a non-empty "path" string',
      );
    });

    it('rejects entry with non-boolean loop', () => {
      const broken = { ...soundManifestJson } as Record<string, unknown>;
      broken['PistolFire'] = {
        ...(soundManifestJson as Record<string, unknown>)['PistolFire'],
        loop: 'false',
      };
      expect(() => validateSoundManifest(broken)).toThrow(
        'must have a boolean "loop" field',
      );
    });

    it('rejects entry with pitchMin > pitchMax', () => {
      const broken = { ...soundManifestJson } as Record<string, unknown>;
      broken['PistolFire'] = {
        ...(soundManifestJson as Record<string, unknown>)['PistolFire'],
        pitchMin: 2.0,
        pitchMax: 1.0,
      };
      expect(() => validateSoundManifest(broken)).toThrow(
        'pitchMin',
      );
    });

    it('rejects entry with non-integer maxInstances', () => {
      const broken = { ...soundManifestJson } as Record<string, unknown>;
      broken['PistolFire'] = {
        ...(soundManifestJson as Record<string, unknown>)['PistolFire'],
        maxInstances: 1.5,
      };
      expect(() => validateSoundManifest(broken)).toThrow(
        'must have a positive integer "maxInstances"',
      );
    });

    it('rejects entry where the value is null', () => {
      const broken = { ...soundManifestJson } as Record<string, unknown>;
      broken['PistolFire'] = null;
      expect(() => validateSoundManifest(broken)).toThrow(
        'must be a non-null object',
      );
    });
  });

  describe('completeness', () => {
    const soundIdNames = Object.keys(SoundId).filter((k) => isNaN(Number(k)));

    it('every SoundId enum member has an entry in the JSON', () => {
      const manifestKeys = Object.keys(soundManifestJson);
      for (const name of soundIdNames) {
        expect(manifestKeys, `Missing manifest entry for SoundId.${name}`).toContain(name);
      }
    });

    it('manifest has no extra keys beyond SoundId enum', () => {
      const manifestKeys = Object.keys(soundManifestJson);
      for (const key of manifestKeys) {
        expect(soundIdNames, `Extra manifest key "${key}"`).toContain(key);
      }
    });

    it('manifest key count matches SoundId enum member count', () => {
      const manifestKeys = Object.keys(soundManifestJson);
      expect(manifestKeys.length).toBe(soundIdNames.length);
    });
  });

  describe('entry properties', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;

    for (const [key, entry] of Object.entries(manifest)) {
      it(`${key} has volume in [0, 1]`, () => {
        expect(entry.volume).toBeGreaterThanOrEqual(0);
        expect(entry.volume).toBeLessThanOrEqual(1);
      });

      it(`${key} has a non-empty path string`, () => {
        expect(typeof entry.path).toBe('string');
        expect((entry.path as string).length).toBeGreaterThan(0);
      });

      it(`${key} has a boolean loop field`, () => {
        expect(typeof entry.loop).toBe('boolean');
      });
    }

    it('FireAmbient is a looping sound', () => {
      expect(manifest['FireAmbient'].loop).toBe(true);
    });

    it('WaterAmbient is a looping sound', () => {
      expect(manifest['WaterAmbient'].loop).toBe(true);
    });

    it('PistolFire is not a looping sound', () => {
      expect(manifest['PistolFire'].loop).toBe(false);
    });
  });

  describe('getSoundManifest', () => {
    it('returns a valid manifest object', () => {
      const manifest = getSoundManifest();
      expect(manifest).toBeDefined();
      expect(typeof manifest).toBe('object');
    });

    it('returns the same instance on repeated calls', () => {
      const a = getSoundManifest();
      const b = getSoundManifest();
      expect(a).toBe(b);
    });
  });

  describe('getSoundEntry', () => {
    it('returns the entry for a valid SoundId', () => {
      const entry = getSoundEntry(SoundId.PistolFire);
      expect(entry).toBeDefined();
      expect(entry.path).toBe('assets/audio/pistol_fire.ogg');
      expect(entry.volume).toBe(0.7);
      expect(entry.loop).toBe(false);
    });

    it('returns correct entry for looping sounds', () => {
      const entry = getSoundEntry(SoundId.FireAmbient);
      expect(entry.loop).toBe(true);
    });
  });
});
