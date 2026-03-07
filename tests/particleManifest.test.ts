import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components.ts';
import {
  validateParticleManifest,
  getParticleManifest,
  getParticleEffectParams,
} from '../src/config/particleManifest.ts';
import particleManifestJson from '../config/particle-manifest.json';

const PARTICLE_EFFECT_NAMES = Object.keys(ParticleEffect).filter((k) => isNaN(Number(k)));

describe('particleManifest', () => {
  describe('validateParticleManifest', () => {
    it('accepts the actual particle-manifest.json', () => {
      expect(() => validateParticleManifest(particleManifestJson)).not.toThrow();
    });

    it('rejects null', () => {
      expect(() => validateParticleManifest(null)).toThrow(
        'Particle manifest must be a non-null object',
      );
    });

    it('rejects a non-object', () => {
      expect(() => validateParticleManifest('string')).toThrow(
        'Particle manifest must be a non-null object',
      );
    });

    it('rejects an unknown ParticleEffect key', () => {
      const bad = { ...particleManifestJson, FakeEffect: { count: 1 } };
      expect(() => validateParticleManifest(bad)).toThrow('Unknown ParticleEffect in manifest: "FakeEffect"');
    });

    for (const name of PARTICLE_EFFECT_NAMES) {
      it(`rejects manifest missing "${name}"`, () => {
        const partial = { ...particleManifestJson };
        delete (partial as Record<string, unknown>)[name];
        expect(() => validateParticleManifest(partial)).toThrow(
          `Missing ParticleEffect entry in manifest: "${name}"`,
        );
      });
    }

    it('rejects entry with missing numeric field', () => {
      const bad = {
        ...particleManifestJson,
        MuzzleFlash: { ...particleManifestJson.MuzzleFlash, count: 'not a number' },
      };
      expect(() => validateParticleManifest(bad)).toThrow(
        'missing or invalid numeric field "count"',
      );
    });

    it('rejects entry with missing string field', () => {
      const bad = {
        ...particleManifestJson,
        MuzzleFlash: { ...particleManifestJson.MuzzleFlash, colorStart: 123 },
      };
      expect(() => validateParticleManifest(bad)).toThrow(
        'missing or invalid string field "colorStart"',
      );
    });

    it('rejects entry with missing boolean field', () => {
      const bad = {
        ...particleManifestJson,
        MuzzleFlash: { ...particleManifestJson.MuzzleFlash, emissive: 'yes' },
      };
      expect(() => validateParticleManifest(bad)).toThrow(
        'missing or invalid boolean field "emissive"',
      );
    });

    it('rejects entry that is null', () => {
      const bad = { ...particleManifestJson, MuzzleFlash: null };
      expect(() => validateParticleManifest(bad)).toThrow(
        'must be a non-null object',
      );
    });
  });

  describe('getParticleManifest', () => {
    it('returns a valid manifest', () => {
      const manifest = getParticleManifest();
      expect(manifest).toBeDefined();
      expect(Object.keys(manifest)).toHaveLength(PARTICLE_EFFECT_NAMES.length);
    });

    it('returns the same instance on repeated calls', () => {
      const a = getParticleManifest();
      const b = getParticleManifest();
      expect(a).toBe(b);
    });
  });

  describe('getParticleEffectParams', () => {
    it('returns params for every ParticleEffect enum value', () => {
      for (const name of PARTICLE_EFFECT_NAMES) {
        const enumVal = ParticleEffect[name as keyof typeof ParticleEffect];
        const params = getParticleEffectParams(enumVal);
        expect(params).toBeDefined();
        expect(typeof params.count).toBe('number');
        expect(typeof params.lifetime).toBe('number');
        expect(typeof params.speed).toBe('number');
        expect(typeof params.spread).toBe('number');
        expect(typeof params.sizeStart).toBe('number');
        expect(typeof params.sizeEnd).toBe('number');
        expect(typeof params.colorStart).toBe('string');
        expect(typeof params.colorEnd).toBe('string');
        expect(typeof params.gravity).toBe('number');
        expect(typeof params.emissive).toBe('boolean');
      }
    });
  });

  describe('manifest values', () => {
    it('every entry has count > 0', () => {
      const manifest = getParticleManifest();
      for (const [name, entry] of Object.entries(manifest)) {
        expect(entry.count, `${name} count should be > 0`).toBeGreaterThan(0);
      }
    });

    it('every entry has lifetime > 0', () => {
      const manifest = getParticleManifest();
      for (const [name, entry] of Object.entries(manifest)) {
        expect(entry.lifetime, `${name} lifetime should be > 0`).toBeGreaterThan(0);
      }
    });

    it('every entry has speed >= 0', () => {
      const manifest = getParticleManifest();
      for (const [name, entry] of Object.entries(manifest)) {
        expect(entry.speed, `${name} speed should be >= 0`).toBeGreaterThanOrEqual(0);
      }
    });

    it('every entry has sizeStart >= sizeEnd', () => {
      const manifest = getParticleManifest();
      for (const [name, entry] of Object.entries(manifest)) {
        expect(entry.sizeStart, `${name} sizeStart should be >= sizeEnd`).toBeGreaterThanOrEqual(
          entry.sizeEnd,
        );
      }
    });

    it('MuzzleFlash has expected values', () => {
      const params = getParticleEffectParams(ParticleEffect.MuzzleFlash);
      expect(params.count).toBe(5);
      expect(params.lifetime).toBe(0.15);
      expect(params.emissive).toBe(true);
    });

    it('Explosion has high particle count', () => {
      const params = getParticleEffectParams(ParticleEffect.Explosion);
      expect(params.count).toBe(20);
      expect(params.spread).toBeCloseTo(6.28, 1);
    });
  });
});
