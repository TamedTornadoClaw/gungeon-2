import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('DestructibleDebrisMetal particle scaffold', () => {
  it('ParticleEffect.DestructibleDebrisMetal exists in the enum', () => {
    expect(ParticleEffect.DestructibleDebrisMetal).toBeDefined();
    expect(typeof ParticleEffect.DestructibleDebrisMetal).toBe('number');
  });

  it('particle manifest has a DestructibleDebrisMetal entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['DestructibleDebrisMetal']).toBeDefined();
  });

  it('manifest entry has valid numeric fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['DestructibleDebrisMetal'];
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
    const entry = manifest['DestructibleDebrisMetal'];
    expect(entry.colorStart).toMatch(/^0x[0-9a-fA-F]{6}$/);
    expect(entry.colorEnd).toMatch(/^0x[0-9a-fA-F]{6}$/);
  });

  it('manifest entry has emissive boolean', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    expect(typeof manifest['DestructibleDebrisMetal'].emissive).toBe('boolean');
  });

  it('getParticleEffectParams returns correct entry for DestructibleDebrisMetal', () => {
    const params = getParticleEffectParams(ParticleEffect.DestructibleDebrisMetal);
    expect(params).toBeDefined();
    expect(params.count).toBe(10);
    expect(params.lifetime).toBe(0.5);
    expect(params.speed).toBe(7.0);
    expect(params.emissive).toBe(false);
  });
});
