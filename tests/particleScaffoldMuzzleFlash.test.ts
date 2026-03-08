import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('MuzzleFlash particle scaffold', () => {
  it('ParticleEffect.MuzzleFlash exists in the enum', () => {
    expect(ParticleEffect.MuzzleFlash).toBeDefined();
    expect(typeof ParticleEffect.MuzzleFlash).toBe('number');
  });

  it('particle manifest has a MuzzleFlash entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['MuzzleFlash']).toBeDefined();
  });

  it('manifest entry has valid numeric fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['MuzzleFlash'];
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
    const entry = manifest['MuzzleFlash'];
    expect(typeof entry.colorStart).toBe('string');
    expect(typeof entry.colorEnd).toBe('string');
  });

  it('manifest entry has valid boolean fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['MuzzleFlash'];
    expect(typeof entry.emissive).toBe('boolean');
  });

  it('getParticleEffectParams returns correct entry for MuzzleFlash', () => {
    const params = getParticleEffectParams(ParticleEffect.MuzzleFlash);
    expect(params).toBeDefined();
    expect(params.count).toBe(5);
    expect(params.lifetime).toBe(0.15);
    expect(params.speed).toBe(8.0);
    expect(params.emissive).toBe(true);
  });

  it('MuzzleFlash has positive count and lifetime', () => {
    const params = getParticleEffectParams(ParticleEffect.MuzzleFlash);
    expect(params.count).toBeGreaterThan(0);
    expect(params.lifetime).toBeGreaterThan(0);
  });

  it('MuzzleFlash sizeStart >= sizeEnd', () => {
    const params = getParticleEffectParams(ParticleEffect.MuzzleFlash);
    expect(params.sizeStart).toBeGreaterThanOrEqual(params.sizeEnd);
  });
});
