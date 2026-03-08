import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('BloodSplat particle scaffold', () => {
  it('ParticleEffect.BloodSplat exists in the enum', () => {
    expect(ParticleEffect.BloodSplat).toBeDefined();
    expect(typeof ParticleEffect.BloodSplat).toBe('number');
  });

  it('particle manifest has a BloodSplat entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['BloodSplat']).toBeDefined();
  });

  it('manifest entry has valid numeric fields', () => {
    const params = getParticleEffectParams(ParticleEffect.BloodSplat);
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
    const params = getParticleEffectParams(ParticleEffect.BloodSplat);
    expect(typeof params.sizeStart).toBe('number');
    expect(typeof params.sizeEnd).toBe('number');
    expect(params.sizeStart).toBeGreaterThanOrEqual(params.sizeEnd);
  });

  it('manifest entry has valid color fields', () => {
    const params = getParticleEffectParams(ParticleEffect.BloodSplat);
    expect(typeof params.colorStart).toBe('string');
    expect(typeof params.colorEnd).toBe('string');
  });

  it('manifest entry has valid emissive field', () => {
    const params = getParticleEffectParams(ParticleEffect.BloodSplat);
    expect(typeof params.emissive).toBe('boolean');
  });

  it('BloodSplat has expected values from manifest', () => {
    const params = getParticleEffectParams(ParticleEffect.BloodSplat);
    expect(params.count).toBe(8);
    expect(params.lifetime).toBe(0.4);
    expect(params.speed).toBe(5.0);
    expect(params.spread).toBeCloseTo(3.14, 1);
    expect(params.gravity).toBe(10);
    expect(params.emissive).toBe(false);
  });
});
