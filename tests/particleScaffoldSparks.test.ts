import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('Sparks particle scaffold', () => {
  it('ParticleEffect.Sparks exists in the enum', () => {
    expect(ParticleEffect.Sparks).toBeDefined();
    expect(typeof ParticleEffect.Sparks).toBe('number');
  });

  it('particle manifest has a Sparks entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['Sparks']).toBeDefined();
  });

  it('manifest entry has valid numeric fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['Sparks'];
    expect(entry.count).toBeGreaterThan(0);
    expect(entry.lifetime).toBeGreaterThan(0);
    expect(entry.speed).toBeGreaterThan(0);
    expect(entry.spread).toBeGreaterThanOrEqual(0);
    expect(entry.sizeStart).toBeGreaterThan(0);
    expect(entry.sizeEnd).toBeGreaterThanOrEqual(0);
    expect(typeof entry.gravity).toBe('number');
  });

  it('manifest entry has valid color strings', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['Sparks'];
    expect(entry.colorStart).toMatch(/^0x[0-9a-fA-F]{6}$/);
    expect(entry.colorEnd).toMatch(/^0x[0-9a-fA-F]{6}$/);
  });

  it('manifest entry has emissive boolean', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    expect(typeof manifest['Sparks'].emissive).toBe('boolean');
  });

  it('getParticleEffectParams returns correct entry for Sparks', () => {
    const params = getParticleEffectParams(ParticleEffect.Sparks);
    expect(params).toBeDefined();
    expect(params.count).toBe(6);
    expect(params.lifetime).toBe(0.3);
    expect(params.speed).toBe(10.0);
    expect(params.emissive).toBe(true);
  });
});
