import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('DestructibleDebrisWood particle scaffold', () => {
  it('ParticleEffect.DestructibleDebrisWood exists in the enum', () => {
    expect(ParticleEffect.DestructibleDebrisWood).toBeDefined();
    expect(typeof ParticleEffect.DestructibleDebrisWood).toBe('number');
  });

  it('particle manifest has a DestructibleDebrisWood entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['DestructibleDebrisWood']).toBeDefined();
  });

  it('manifest entry has valid numeric fields', () => {
    const params = getParticleEffectParams(ParticleEffect.DestructibleDebrisWood);
    expect(typeof params.count).toBe('number');
    expect(params.count).toBeGreaterThan(0);
    expect(typeof params.lifetime).toBe('number');
    expect(params.lifetime).toBeGreaterThan(0);
    expect(typeof params.speed).toBe('number');
    expect(params.speed).toBeGreaterThanOrEqual(0);
    expect(typeof params.spread).toBe('number');
    expect(typeof params.gravity).toBe('number');
  });

  it('manifest entry has valid size fields', () => {
    const params = getParticleEffectParams(ParticleEffect.DestructibleDebrisWood);
    expect(typeof params.sizeStart).toBe('number');
    expect(typeof params.sizeEnd).toBe('number');
    expect(params.sizeStart).toBeGreaterThanOrEqual(params.sizeEnd);
  });

  it('manifest entry has valid color fields', () => {
    const params = getParticleEffectParams(ParticleEffect.DestructibleDebrisWood);
    expect(typeof params.colorStart).toBe('string');
    expect(typeof params.colorEnd).toBe('string');
  });

  it('manifest entry has valid emissive field', () => {
    const params = getParticleEffectParams(ParticleEffect.DestructibleDebrisWood);
    expect(typeof params.emissive).toBe('boolean');
  });

  it('DestructibleDebrisWood has expected values from manifest', () => {
    const params = getParticleEffectParams(ParticleEffect.DestructibleDebrisWood);
    expect(params.count).toBe(10);
    expect(params.lifetime).toBe(0.5);
    expect(params.speed).toBe(7.0);
    expect(params.spread).toBeCloseTo(6.28, 1);
    expect(params.gravity).toBe(12);
    expect(params.emissive).toBe(false);
  });
});
