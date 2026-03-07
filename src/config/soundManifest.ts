import { SoundId } from '../ecs/components';
import type { SoundManifestEntry, SoundManifest } from '../audio/audioManager';
import soundManifestJson from '../../config/sound-manifest.json';

// --- Validation ---

export function validateSoundManifest(data: unknown): SoundManifest {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Sound manifest must be a non-null object');
  }

  const obj = data as Record<string, unknown>;
  const soundIdNames = Object.keys(SoundId).filter(
    (k) => isNaN(Number(k)),
  );

  // Every SoundId enum member must have an entry
  for (const name of soundIdNames) {
    if (!(name in obj)) {
      throw new Error(
        `Sound manifest is missing entry for SoundId.${name}`,
      );
    }
  }

  // Validate each entry
  for (const [key, value] of Object.entries(obj)) {
    if (!soundIdNames.includes(key)) {
      throw new Error(
        `Sound manifest contains unknown key "${key}" not in SoundId enum`,
      );
    }

    if (typeof value !== 'object' || value === null) {
      throw new Error(
        `Sound manifest entry "${key}" must be a non-null object`,
      );
    }

    const entry = value as Record<string, unknown>;

    if (typeof entry.path !== 'string' || entry.path.length === 0) {
      throw new Error(
        `Sound manifest entry "${key}" must have a non-empty "path" string`,
      );
    }

    if (typeof entry.volume !== 'number' || entry.volume < 0 || entry.volume > 1) {
      throw new Error(
        `Sound manifest entry "${key}" volume must be a number in [0, 1]`,
      );
    }

    if (typeof entry.loop !== 'boolean') {
      throw new Error(
        `Sound manifest entry "${key}" must have a boolean "loop" field`,
      );
    }

    if (typeof entry.pitchMin !== 'number' || entry.pitchMin <= 0) {
      throw new Error(
        `Sound manifest entry "${key}" must have a positive "pitchMin" number`,
      );
    }

    if (typeof entry.pitchMax !== 'number' || entry.pitchMax <= 0) {
      throw new Error(
        `Sound manifest entry "${key}" must have a positive "pitchMax" number`,
      );
    }

    if (entry.pitchMin > entry.pitchMax) {
      throw new Error(
        `Sound manifest entry "${key}" pitchMin (${entry.pitchMin}) must be <= pitchMax (${entry.pitchMax})`,
      );
    }

    if (
      typeof entry.maxInstances !== 'number' ||
      !Number.isInteger(entry.maxInstances) ||
      entry.maxInstances < 1
    ) {
      throw new Error(
        `Sound manifest entry "${key}" must have a positive integer "maxInstances"`,
      );
    }
  }

  return data as SoundManifest;
}

// --- Singleton ---

let cachedManifest: SoundManifest | null = null;

export function getSoundManifest(): SoundManifest {
  if (cachedManifest === null) {
    cachedManifest = validateSoundManifest(soundManifestJson);
  }
  return cachedManifest;
}

export function getSoundEntry(soundId: SoundId): SoundManifestEntry {
  const manifest = getSoundManifest();
  const key = SoundId[soundId];
  const entry = manifest[key];
  if (!entry) {
    throw new Error(`No manifest entry for SoundId.${key}`);
  }
  return entry;
}
