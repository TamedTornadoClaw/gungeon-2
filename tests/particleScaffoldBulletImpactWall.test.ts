import { describe, it, expect } from 'vitest';
import { ParticleEffect } from '../src/ecs/components';
import { getParticleEffectParams } from '../src/config/particleManifest';
import particleManifestJson from '../config/particle-manifest.json';

describe('BulletImpactWall particle scaffold', () => {
  it('ParticleEffect.BulletImpactWall exists in the enum', () => {
    expect(ParticleEffect.BulletImpactWall).toBeDefined();
    expect(typeof ParticleEffect.BulletImpactWall).toBe('number');
  });

  it('particle manifest has a BulletImpactWall entry', () => {
    const manifest = particleManifestJson as Record<string, unknown>;
    expect(manifest['BulletImpactWall']).toBeDefined();
  });

  it('manifest entry has valid numeric fields', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    const entry = manifest['BulletImpactWall'];
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
    const entry = manifest['BulletImpactWall'];
    expect(entry.colorStart).toMatch(/^0x[0-9a-fA-F]{6}$/);
    expect(entry.colorEnd).toMatch(/^0x[0-9a-fA-F]{6}$/);
  });

  it('manifest entry has emissive boolean', () => {
    const manifest = particleManifestJson as Record<string, Record<string, unknown>>;
    expect(typeof manifest['BulletImpactWall'].emissive).toBe('boolean');
  });

  it('getParticleEffectParams returns correct entry for BulletImpactWall', () => {
    const params = getParticleEffectParams(ParticleEffect.BulletImpactWall);
    expect(params).toBeDefined();
    expect(params.count).toBe(4);
    expect(params.lifetime).toBe(0.2);
    expect(params.speed).toBe(6.0);
    expect(params.emissive).toBe(false);
  });
});
