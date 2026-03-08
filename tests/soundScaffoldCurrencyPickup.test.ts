import { describe, it, expect } from 'vitest';
import { SoundId } from '../src/ecs/components';
import { getSoundEntry } from '../src/config/soundManifest';
import soundManifestJson from '../config/sound-manifest.json';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('CurrencyPickup sound scaffold', () => {
  it('SoundId.CurrencyPickup exists in the enum', () => {
    expect(SoundId.CurrencyPickup).toBeDefined();
    expect(typeof SoundId.CurrencyPickup).toBe('number');
  });

  it('sound manifest has a CurrencyPickup entry', () => {
    const manifest = soundManifestJson as Record<string, unknown>;
    expect(manifest['CurrencyPickup']).toBeDefined();
  });

  it('manifest entry points to assets/audio/currency_pickup.ogg', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    expect(manifest['CurrencyPickup'].path).toBe('assets/audio/currency_pickup.ogg');
  });

  it('placeholder audio file exists on disk', () => {
    const filePath = resolve(__dirname, '..', 'assets/audio/currency_pickup.ogg');
    expect(existsSync(filePath)).toBe(true);
  });

  it('getSoundEntry returns correct entry for CurrencyPickup', () => {
    const entry = getSoundEntry(SoundId.CurrencyPickup);
    expect(entry).toBeDefined();
    expect(entry.path).toBe('assets/audio/currency_pickup.ogg');
    expect(entry.loop).toBe(false);
  });

  it('CurrencyPickup has reasonable volume', () => {
    const manifest = soundManifestJson as Record<string, Record<string, unknown>>;
    const volume = manifest['CurrencyPickup'].volume as number;
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });
});
