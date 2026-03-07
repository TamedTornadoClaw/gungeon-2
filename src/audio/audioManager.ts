import { Howl, Howler } from 'howler';
import { SoundId } from '../ecs/components';
import { useSettingsStore } from '../store/settingsStore';
import soundManifestJson from '../../config/sound-manifest.json';

export interface SoundManifestEntry {
  path: string;
  volume: number;
  pitchMin: number;
  pitchMax: number;
  maxInstances: number;
  loop: boolean;
}

export type SoundManifest = Record<string, SoundManifestEntry>;

interface PooledSound {
  howl: Howl;
  activeIds: number[];
  failed: boolean;
}

export class AudioManager {
  private pools = new Map<SoundId, PooledSound>();
  private manifest: SoundManifest;
  private loops = new Map<SoundId, number>();
  private unsubscribe: (() => void) | null = null;

  constructor(manifest?: SoundManifest) {
    this.manifest = manifest ?? (soundManifestJson as SoundManifest);
    this.loadSounds();
    this.subscribeToSettings();
  }

  private loadSounds(): void {
    const entries = Object.entries(this.manifest);
    for (const [key, entry] of entries) {
      const soundId = SoundId[key as keyof typeof SoundId];
      if (soundId === undefined) {
        console.warn(`[AudioManager] Manifest key "${key}" does not match any SoundId enum member. Skipping.`);
        continue;
      }
      const howl = new Howl({
        src: [entry.path],
        volume: this.computeVolume(entry.volume),
        loop: entry.loop,
        preload: true,
        onloaderror: (_id: number, error: unknown) => {
          console.warn(`[AudioManager] Failed to load sound "${key}" (${entry.path}):`, error);
          const pool = this.pools.get(soundId);
          if (pool) {
            pool.failed = true;
          }
        },
      });
      this.pools.set(soundId, { howl, activeIds: [], failed: false });
    }
  }

  private computeVolume(manifestVolume: number): number {
    const { masterVolume, sfxVolume } = useSettingsStore.getState();
    return masterVolume * sfxVolume * manifestVolume;
  }

  private subscribeToSettings(): void {
    this.unsubscribe = useSettingsStore.subscribe((state) => {
      const { masterVolume, sfxVolume } = state;
      for (const [soundId, pool] of this.pools) {
        const entry = this.getManifestEntry(soundId);
        if (entry) {
          pool.howl.volume(masterVolume * sfxVolume * entry.volume);
        }
      }
    });
  }

  private getManifestEntry(soundId: SoundId): SoundManifestEntry | undefined {
    const key = SoundId[soundId];
    return this.manifest[key];
  }

  play(soundId: SoundId): void {
    const pool = this.pools.get(soundId);
    if (!pool) {
      console.warn(`[AudioManager] No sound loaded for SoundId.${SoundId[soundId]}`);
      return;
    }
    if (pool.failed) {
      return;
    }

    const entry = this.getManifestEntry(soundId);
    if (!entry) return;

    // Enforce maxInstances: clean up finished sounds, then check count
    pool.activeIds = pool.activeIds.filter((id) => pool.howl.playing(id));
    if (pool.activeIds.length >= entry.maxInstances) {
      // Evict oldest instance
      const oldest = pool.activeIds.shift();
      if (oldest !== undefined) {
        pool.howl.stop(oldest);
      }
    }

    // Randomize pitch
    const pitch =
      entry.pitchMin === entry.pitchMax
        ? entry.pitchMin
        : entry.pitchMin + Math.random() * (entry.pitchMax - entry.pitchMin);

    const id = pool.howl.play();
    pool.howl.rate(pitch, id);
    pool.activeIds.push(id);
  }

  playLoop(soundId: SoundId): void {
    // If already looping, no-op
    if (this.loops.has(soundId)) {
      return;
    }

    const pool = this.pools.get(soundId);
    if (!pool) {
      console.warn(`[AudioManager] No sound loaded for SoundId.${SoundId[soundId]}`);
      return;
    }
    if (pool.failed) {
      return;
    }

    const id = pool.howl.play();
    this.loops.set(soundId, id);
  }

  stopLoop(soundId: SoundId): void {
    const loopId = this.loops.get(soundId);
    if (loopId === undefined) {
      return;
    }

    const pool = this.pools.get(soundId);
    if (pool) {
      pool.howl.stop(loopId);
    }
    this.loops.delete(soundId);
  }

  stopAll(): void {
    for (const [, pool] of this.pools) {
      pool.howl.stop();
      pool.activeIds.length = 0;
    }
    this.loops.clear();
  }

  dispose(): void {
    this.stopAll();
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    for (const [, pool] of this.pools) {
      pool.howl.unload();
    }
    this.pools.clear();
  }

  resumeContext(): void {
    if (Howler.ctx && Howler.ctx.state === 'suspended') {
      void Howler.ctx.resume();
    }
  }
}

let audioManagerInstance: AudioManager | null = null;

export function getAudioManager(): AudioManager {
  if (!audioManagerInstance) {
    audioManagerInstance = new AudioManager();
  }
  return audioManagerInstance;
}

export function resetAudioManager(): void {
  if (audioManagerInstance) {
    audioManagerInstance.dispose();
    audioManagerInstance = null;
  }
}
