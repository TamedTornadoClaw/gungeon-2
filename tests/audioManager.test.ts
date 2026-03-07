/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SoundId } from '../src/ecs/components';
import type { SoundManifest } from '../src/audio/audioManager';

// ── Howler mock ─────────────────────────────────────────────────────────────

let howlInstances: MockHowl[] = [];
let nextPlayId = 1;

class MockHowl {
  _src: string[];
  _volume: number;
  _loop: boolean;
  _rates = new Map<number, number>();
  _playing = new Map<number, boolean>();
  _onloaderror?: (id: number, error: unknown) => void;
  _stopped = new Set<number>();
  _unloaded = false;

  constructor(options: {
    src: string[];
    volume: number;
    loop: boolean;
    preload: boolean;
    onloaderror?: (id: number, error: unknown) => void;
  }) {
    this._src = options.src;
    this._volume = options.volume;
    this._loop = options.loop;
    this._onloaderror = options.onloaderror;
    howlInstances.push(this);
  }

  play(): number {
    const id = nextPlayId++;
    this._playing.set(id, true);
    return id;
  }

  stop(id?: number): this {
    if (id !== undefined) {
      this._playing.set(id, false);
      this._stopped.add(id);
    } else {
      for (const key of this._playing.keys()) {
        this._playing.set(key, false);
      }
    }
    return this;
  }

  volume(vol?: number, _id?: number): number | this {
    if (vol === undefined) return this._volume;
    this._volume = vol;
    return this;
  }

  rate(rate?: number, id?: number): number | this {
    if (rate === undefined) return this._rates.get(id ?? 0) ?? 1.0;
    if (id !== undefined) {
      this._rates.set(id, rate);
    }
    return this;
  }

  playing(id: number): boolean {
    return this._playing.get(id) ?? false;
  }

  unload(): void {
    this._unloaded = true;
  }

  triggerLoadError(error: string): void {
    if (this._onloaderror) {
      this._onloaderror(0, error);
    }
  }
}

const MockHowler = {
  ctx: { state: 'running', resume: vi.fn().mockResolvedValue(undefined) } as unknown as AudioContext,
};

vi.mock('howler', () => ({
  Howl: MockHowl,
  Howler: MockHowler,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeManifest(overrides: Partial<Record<string, Partial<SoundManifest[string]>>> = {}): SoundManifest {
  const base: SoundManifest = {
    PistolFire: {
      path: 'assets/audio/pistol_fire.ogg',
      volume: 0.7,
      pitchMin: 0.9,
      pitchMax: 1.1,
      maxInstances: 3,
      loop: false,
    },
    EnemyHitFlesh: {
      path: 'assets/audio/enemy_hit_flesh.ogg',
      volume: 0.5,
      pitchMin: 0.85,
      pitchMax: 1.15,
      maxInstances: 3,
      loop: false,
    },
    Explosion: {
      path: 'assets/audio/explosion.ogg',
      volume: 0.9,
      pitchMin: 0.85,
      pitchMax: 1.05,
      maxInstances: 1,
      loop: false,
    },
    MenuClick: {
      path: 'assets/audio/menu_click.ogg',
      volume: 0.5,
      pitchMin: 1.0,
      pitchMax: 1.0,
      maxInstances: 2,
      loop: false,
    },
    FireAmbient: {
      path: 'assets/audio/fire_ambient.ogg',
      volume: 0.4,
      pitchMin: 1.0,
      pitchMax: 1.0,
      maxInstances: 1,
      loop: true,
    },
    WaterAmbient: {
      path: 'assets/audio/water_ambient.ogg',
      volume: 0.3,
      pitchMin: 1.0,
      pitchMax: 1.0,
      maxInstances: 1,
      loop: true,
    },
    DoorOpen: {
      path: 'assets/audio/door_open.ogg',
      volume: 0.6,
      pitchMin: 0.95,
      pitchMax: 1.05,
      maxInstances: 1,
      loop: false,
    },
  };
  for (const [key, val] of Object.entries(overrides)) {
    if (val) {
      base[key] = { ...base[key], ...val } as SoundManifest[string];
    }
  }
  return base;
}

async function createManager(manifest?: SoundManifest) {
  vi.resetModules();
  // Re-import to get fresh module with fresh singleton state
  const settingsMod = await import('../src/store/settingsStore');
  // Reset settings to defaults
  settingsMod.useSettingsStore.setState({
    masterVolume: 1.0,
    sfxVolume: 1.0,
  });

  // We need to dynamically import AudioManager after resetting modules
  // but since howler is mocked at module level, we import directly
  const { AudioManager } = await import('../src/audio/audioManager');
  const mgr = new AudioManager(manifest ?? makeManifest());
  return { mgr, settingsMod };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AudioManager', () => {
  beforeEach(() => {
    howlInstances = [];
    nextPlayId = 1;
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up subscriptions
    vi.resetModules();
  });

  describe('Volume calculation', () => {
    it('computes effective volume as masterVolume * sfxVolume * manifest.volume', async () => {
      const { settingsMod } = await createManager();
      settingsMod.useSettingsStore.setState({ masterVolume: 0.5, sfxVolume: 0.8 });

      // The PistolFire entry has volume 0.7
      // Find the howl instance for PistolFire (first in manifest)
      const pistolHowl = howlInstances[0];
      expect(pistolHowl._volume).toBeCloseTo(0.5 * 0.8 * 0.7, 5);
    });

    it('masterVolume = 0 suppresses all audio', async () => {
      const { settingsMod } = await createManager();
      settingsMod.useSettingsStore.setState({ masterVolume: 0, sfxVolume: 1.0 });

      for (const howl of howlInstances) {
        expect(howl._volume).toBe(0);
      }
    });

    it('all volumes at 1.0 produces manifest volume exactly', async () => {
      const { settingsMod } = await createManager();
      settingsMod.useSettingsStore.setState({ masterVolume: 1.0, sfxVolume: 1.0 });

      const pistolHowl = howlInstances[0];
      expect(pistolHowl._volume).toBeCloseTo(0.7, 5);
    });
  });

  describe('Volume changes mid-playback', () => {
    it('updates looping sound volume when settings change', async () => {
      const { mgr, settingsMod } = await createManager();

      mgr.playLoop(SoundId.FireAmbient);

      // Change volume
      settingsMod.useSettingsStore.setState({ masterVolume: 0.0, sfxVolume: 1.0 });

      // Find the FireAmbient howl — it's the one with the fire_ambient path
      const fireHowl = howlInstances.find((h) => h._src[0].includes('fire_ambient'));
      expect(fireHowl).toBeDefined();
      expect(fireHowl!._volume).toBe(0);

      mgr.dispose();
    });
  });

  describe('maxInstances enforcement', () => {
    it('limits concurrent instances to maxInstances', async () => {
      const manifest = makeManifest({
        EnemyHitFlesh: { maxInstances: 3 },
      });
      const { mgr } = await createManager(manifest);

      // Play 5 times
      for (let i = 0; i < 5; i++) {
        mgr.play(SoundId.EnemyHitFlesh);
      }

      // The EnemyHitFlesh howl
      const enemyHowl = howlInstances.find((h) => h._src[0].includes('enemy_hit_flesh'));
      expect(enemyHowl).toBeDefined();

      // Count currently playing instances
      let playingCount = 0;
      for (const [, playing] of enemyHowl!._playing) {
        if (playing) playingCount++;
      }
      expect(playingCount).toBeLessThanOrEqual(3);
    });

    it('maxInstances = 1 prevents overlapping sounds', async () => {
      const manifest = makeManifest({
        Explosion: { maxInstances: 1 },
      });
      const { mgr } = await createManager(manifest);

      mgr.play(SoundId.Explosion);
      mgr.play(SoundId.Explosion);

      const explosionHowl = howlInstances.find((h) => h._src[0].includes('explosion'));
      expect(explosionHowl).toBeDefined();

      let playingCount = 0;
      for (const [, playing] of explosionHowl!._playing) {
        if (playing) playingCount++;
      }
      expect(playingCount).toBeLessThanOrEqual(1);
    });
  });

  describe('Pitch variation', () => {
    it('pitch falls within [pitchMin, pitchMax] range', async () => {
      const manifest = makeManifest({
        PistolFire: { pitchMin: 0.9, pitchMax: 1.1 },
      });
      const { mgr } = await createManager(manifest);

      const pistolHowl = howlInstances.find((h) => h._src[0].includes('pistol_fire'));
      expect(pistolHowl).toBeDefined();

      for (let i = 0; i < 100; i++) {
        mgr.play(SoundId.PistolFire);
      }

      for (const [, rate] of pistolHowl!._rates) {
        expect(rate).toBeGreaterThanOrEqual(0.9);
        expect(rate).toBeLessThanOrEqual(1.1);
      }
    });

    it('pitchMin === pitchMax produces exact pitch', async () => {
      const manifest = makeManifest({
        MenuClick: { pitchMin: 1.0, pitchMax: 1.0 },
      });
      const { mgr } = await createManager(manifest);

      const menuHowl = howlInstances.find((h) => h._src[0].includes('menu_click'));
      expect(menuHowl).toBeDefined();

      for (let i = 0; i < 10; i++) {
        mgr.play(SoundId.MenuClick);
      }

      for (const [, rate] of menuHowl!._rates) {
        expect(rate).toBe(1.0);
      }
    });

    it('pitch distribution covers the range over many calls', async () => {
      const manifest = makeManifest({
        PistolFire: { pitchMin: 0.9, pitchMax: 1.1, maxInstances: 200 },
      });
      const { mgr } = await createManager(manifest);

      const pistolHowl = howlInstances.find((h) => h._src[0].includes('pistol_fire'));

      for (let i = 0; i < 100; i++) {
        mgr.play(SoundId.PistolFire);
      }

      const rates = Array.from(pistolHowl!._rates.values());
      const minRate = Math.min(...rates);
      const maxRate = Math.max(...rates);
      expect(minRate).toBeLessThanOrEqual(0.95);
      expect(maxRate).toBeGreaterThanOrEqual(1.05);
    });
  });

  describe('Missing sound handling', () => {
    it('play() with unmapped SoundId warns and does not throw', async () => {
      // Create manifest with only PistolFire, then try to play Footstep
      const manifest: SoundManifest = {
        PistolFire: {
          path: 'assets/audio/pistol_fire.ogg',
          volume: 0.7,
          pitchMin: 0.9,
          pitchMax: 1.1,
          maxInstances: 3,
          loop: false,
        },
      };
      const { mgr } = await createManager(manifest);

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => mgr.play(SoundId.Footstep)).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('Looping sounds', () => {
    it('playLoop starts a looping sound', async () => {
      const { mgr } = await createManager();

      mgr.playLoop(SoundId.FireAmbient);

      const fireHowl = howlInstances.find((h) => h._src[0].includes('fire_ambient'));
      expect(fireHowl).toBeDefined();
      // Should have one playing instance
      let playingCount = 0;
      for (const [, playing] of fireHowl!._playing) {
        if (playing) playingCount++;
      }
      expect(playingCount).toBe(1);

      mgr.dispose();
    });

    it('stopLoop stops the looping sound', async () => {
      const { mgr } = await createManager();

      mgr.playLoop(SoundId.FireAmbient);
      mgr.stopLoop(SoundId.FireAmbient);

      const fireHowl = howlInstances.find((h) => h._src[0].includes('fire_ambient'));
      let playingCount = 0;
      for (const [, playing] of fireHowl!._playing) {
        if (playing) playingCount++;
      }
      expect(playingCount).toBe(0);

      mgr.dispose();
    });

    it('stopLoop before playLoop is a no-op (no error)', async () => {
      const { mgr } = await createManager();

      expect(() => mgr.stopLoop(SoundId.FireAmbient)).not.toThrow();

      mgr.dispose();
    });

    it('double playLoop does not create duplicate instances', async () => {
      const { mgr } = await createManager();

      mgr.playLoop(SoundId.FireAmbient);
      mgr.playLoop(SoundId.FireAmbient);

      const fireHowl = howlInstances.find((h) => h._src[0].includes('fire_ambient'));
      let playingCount = 0;
      for (const [, playing] of fireHowl!._playing) {
        if (playing) playingCount++;
      }
      expect(playingCount).toBe(1);

      mgr.dispose();
    });

    it('multiple looping sounds play simultaneously with independent control', async () => {
      const { mgr } = await createManager();

      mgr.playLoop(SoundId.FireAmbient);
      mgr.playLoop(SoundId.WaterAmbient);

      // Stop only fire
      mgr.stopLoop(SoundId.FireAmbient);

      const waterHowl = howlInstances.find((h) => h._src[0].includes('water_ambient'));
      let waterPlaying = 0;
      for (const [, playing] of waterHowl!._playing) {
        if (playing) waterPlaying++;
      }
      expect(waterPlaying).toBe(1);

      mgr.dispose();
    });
  });

  describe('Sound loading failure', () => {
    it('marks sound as failed on load error and subsequent play is no-op', async () => {
      const { mgr } = await createManager();

      const doorHowl = howlInstances.find((h) => h._src[0].includes('door_open'));
      expect(doorHowl).toBeDefined();

      // Trigger load error
      doorHowl!.triggerLoadError('File not found');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // play should be a no-op, not throw
      expect(() => mgr.play(SoundId.DoorOpen)).not.toThrow();
      warnSpy.mockRestore();

      mgr.dispose();
    });
  });

  describe('stopAll / dispose', () => {
    it('stopAll stops all playing sounds', async () => {
      const { mgr } = await createManager();

      mgr.play(SoundId.PistolFire);
      mgr.playLoop(SoundId.FireAmbient);
      mgr.stopAll();

      for (const howl of howlInstances) {
        let playingCount = 0;
        for (const [, playing] of howl._playing) {
          if (playing) playingCount++;
        }
        expect(playingCount).toBe(0);
      }

      mgr.dispose();
    });

    it('dispose unloads all Howl instances', async () => {
      const { mgr } = await createManager();

      mgr.play(SoundId.PistolFire);
      mgr.dispose();

      for (const howl of howlInstances) {
        expect(howl._unloaded).toBe(true);
      }
    });
  });

  describe('Empty manifest', () => {
    it('initializes with empty manifest without errors', async () => {
      const { mgr } = await createManager({});

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => mgr.play(SoundId.PistolFire)).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();

      mgr.dispose();
    });
  });

  describe('AudioContext resume', () => {
    it('calls ctx.resume() when context is suspended', async () => {
      const { mgr } = await createManager();

      // Simulate suspended state
      (MockHowler.ctx as { state: string }).state = 'suspended';
      mgr.resumeContext();
      expect(MockHowler.ctx.resume).toHaveBeenCalled();

      // Restore
      (MockHowler.ctx as { state: string }).state = 'running';
      mgr.dispose();
    });
  });

  describe('sounds.ts re-export', () => {
    it('re-exports SoundId from components', async () => {
      const soundsMod = await import('../src/audio/sounds');
      expect(soundsMod.SoundId).toStrictEqual(SoundId);
      // Verify specific values to ensure it's the same enum
      expect(soundsMod.SoundId.PistolFire).toBe(SoundId.PistolFire);
      expect(soundsMod.SoundId.FireAmbient).toBe(SoundId.FireAmbient);
    });
  });

  describe('manifest volume = 0 (silent placeholder)', () => {
    it('does not error when manifest volume is 0', async () => {
      const manifest = makeManifest({
        PistolFire: { volume: 0 },
      });
      const { mgr } = await createManager(manifest);

      expect(() => mgr.play(SoundId.PistolFire)).not.toThrow();

      const pistolHowl = howlInstances.find((h) => h._src[0].includes('pistol_fire'));
      expect(pistolHowl!._volume).toBe(0);

      mgr.dispose();
    });
  });
});
