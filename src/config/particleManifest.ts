import particleManifestJson from '../../config/particle-manifest.json';
import { ParticleEffect } from '../ecs/components';
import type { ParticleEffectParams } from './designParams';

export type ParticleManifest = Record<string, ParticleEffectParams>;

const PARTICLE_EFFECT_NAMES: ReadonlyArray<string> = Object.keys(ParticleEffect).filter(
  (key) => isNaN(Number(key)),
);

export function validateParticleManifest(data: unknown): ParticleManifest {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Particle manifest must be a non-null object');
  }

  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj);

  // Every key in JSON must be a valid ParticleEffect enum name
  for (const key of keys) {
    if (!PARTICLE_EFFECT_NAMES.includes(key)) {
      throw new Error(`Unknown ParticleEffect in manifest: "${key}"`);
    }
  }

  // Every ParticleEffect enum value must have an entry
  for (const name of PARTICLE_EFFECT_NAMES) {
    if (!(name in obj)) {
      throw new Error(`Missing ParticleEffect entry in manifest: "${name}"`);
    }
  }

  // Validate each entry has required numeric/string fields
  const requiredNumbers = ['count', 'lifetime', 'speed', 'spread', 'sizeStart', 'sizeEnd', 'gravity'] as const;
  const requiredStrings = ['colorStart', 'colorEnd'] as const;

  for (const key of keys) {
    const entry = obj[key] as Record<string, unknown>;

    if (typeof entry !== 'object' || entry === null) {
      throw new Error(`Particle manifest entry "${key}" must be a non-null object`);
    }

    for (const field of requiredNumbers) {
      if (typeof entry[field] !== 'number') {
        throw new Error(`Particle manifest entry "${key}" missing or invalid numeric field "${field}"`);
      }
    }

    for (const field of requiredStrings) {
      if (typeof entry[field] !== 'string') {
        throw new Error(`Particle manifest entry "${key}" missing or invalid string field "${field}"`);
      }
    }

    if (typeof entry['emissive'] !== 'boolean') {
      throw new Error(`Particle manifest entry "${key}" missing or invalid boolean field "emissive"`);
    }
  }

  return obj as unknown as ParticleManifest;
}

let cached: ParticleManifest | null = null;

export function getParticleManifest(): ParticleManifest {
  if (cached === null) {
    cached = validateParticleManifest(particleManifestJson);
  }
  return cached;
}

export function getParticleEffectParams(effect: ParticleEffect): ParticleEffectParams {
  const manifest = getParticleManifest();
  const name = ParticleEffect[effect];
  const params = manifest[name];
  if (!params) {
    throw new Error(`No particle manifest entry for effect "${name}"`);
  }
  return params;
}
