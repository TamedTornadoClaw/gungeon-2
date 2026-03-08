import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('Explosion particle scaffold', () => {
  it('ParticleEffect.Explosion exists in the enum', () => {
    expect(ParticleEffect.Explosion).toBeDefined();
    expect(typeof ParticleEffect.Explosion).toBe('number');
  });

  it('particle manifest has an Explosion entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['Explosion']).toBeDefined();
  });

  it('manifest entry has valid numeric fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['Explosion'];
    expect(typeof entry.count).toBe('number');
    expect(typeof entry.lifetime).toBe('number');
    expect(typeof entry.speed).toBe('number');
    expect(typeof entry.spread).toBe('number');
    expect(typeof entry.sizeStart).toBe('number');
    expect(typeof entry.sizeEnd).toBe('number');
    expect(typeof entry.gravity).toBe('number');
  });

  it('manifest entry has valid string fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['Explosion'];
    expect(typeof entry.colorStart).toBe('string');
    expect(typeof entry.colorEnd).toBe('string');
  });

  it('manifest entry has valid boolean fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['Explosion'];
    expect(typeof entry.emissive).toBe('boolean');
  });

  it('getParticleEffectParams returns correct entry for Explosion', () => {
    const params = getParticleEffectParams(ParticleEffect.Explosion);
    expect(params).toBeDefined();
    expect(params.count).toBe(20);
    expect(params.spread).toBeCloseTo(6.28, 1);
    expect(params.emissive).toBe(true);
  });

  it('Explosion has positive count and lifetime', () => {
    const params = getParticleEffectParams(ParticleEffect.Explosion);
    expect(params.count).toBeGreaterThan(0);
    expect(params.lifetime).toBeGreaterThan(0);
  });

  it('Explosion has sizeStart >= sizeEnd', () => {
    const params = getParticleEffectParams(ParticleEffect.Explosion);
    expect(params.sizeStart).toBeGreaterThanOrEqual(params.sizeEnd);
  });
});
