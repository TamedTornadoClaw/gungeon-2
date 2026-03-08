import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('XPGemTrail particle scaffold', () => {
  it('ParticleEffect.XPGemTrail exists in the enum', () => {
    expect(ParticleEffect.XPGemTrail).toBeDefined();
    expect(typeof ParticleEffect.XPGemTrail).toBe('number');
  });

  it('particle manifest has an XPGemTrail entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['XPGemTrail']).toBeDefined();
  });

  it('manifest entry has all required numeric fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['XPGemTrail'];
    const requiredNumbers = ['count', 'lifetime', 'speed', 'spread', 'sizeStart', 'sizeEnd', 'gravity'];
    for (const field of requiredNumbers) {
      expect(typeof entry[field]).toBe('number');
    }
  });

  it('manifest entry has valid color strings', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['XPGemTrail'];
    expect(typeof entry.colorStart).toBe('string');
    expect(typeof entry.colorEnd).toBe('string');
    expect(entry.colorStart).toMatch(/^0x[0-9a-fA-F]{6}$/);
    expect(entry.colorEnd).toMatch(/^0x[0-9a-fA-F]{6}$/);
  });

  it('manifest entry has emissive boolean', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    expect(typeof manifest['XPGemTrail'].emissive).toBe('boolean');
  });

  it('getParticleEffectParams returns correct entry for XPGemTrail', () => {
    const params = getParticleEffectParams(ParticleEffect.XPGemTrail);
    expect(params).toBeDefined();
    expect(params.count).toBeGreaterThan(0);
    expect(params.lifetime).toBeGreaterThan(0);
  });

  it('XPGemTrail has reasonable values', () => {
    const params = getParticleEffectParams(ParticleEffect.XPGemTrail);
    expect(params.count).toBeGreaterThanOrEqual(1);
    expect(params.count).toBeLessThanOrEqual(100);
    expect(params.lifetime).toBeGreaterThan(0);
    expect(params.lifetime).toBeLessThanOrEqual(10);
    expect(params.speed).toBeGreaterThanOrEqual(0);
    expect(params.sizeStart).toBeGreaterThanOrEqual(0);
  });
});
