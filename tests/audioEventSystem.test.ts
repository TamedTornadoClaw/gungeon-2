import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { EventQueue } from '../src/gameloop/events';
import { EventType, SoundId } from '../src/ecs/components';
import {
  audioEventSystem,
  createLoopManager,
  isLoopingSound,
} from '../src/systems/audioEventSystem';
import type { AudioManager } from '../src/audio/audioManager';

function createMockAudioManager(): AudioManager {
  return {
    play: vi.fn(),
    playLoop: vi.fn(),
    stopLoop: vi.fn(),
    stopAll: vi.fn(),
    dispose: vi.fn(),
    resumeContext: vi.fn(),
  } as unknown as AudioManager;
}

const ONE_SHOT_SOUNDS = Object.values(SoundId).filter(
  (v) => typeof v === 'number' && !isLoopingSound(v as SoundId),
) as SoundId[];

describe('audioEventSystem', () => {
  let eq: EventQueue;
  let am: AudioManager;

  beforeEach(() => {
    eq = new EventQueue();
    am = createMockAudioManager();
  });

  it('calls play() once per AudioEvent', () => {
    eq.emit({ type: EventType.Audio, sound: SoundId.PistolFire });
    eq.emit({ type: EventType.Audio, sound: SoundId.EnemyDeath });

    audioEventSystem(eq, am);

    expect(am.play).toHaveBeenCalledTimes(2);
    expect(am.play).toHaveBeenCalledWith(SoundId.PistolFire);
    expect(am.play).toHaveBeenCalledWith(SoundId.EnemyDeath);
  });

  it('drains all AudioEvents from the queue', () => {
    eq.emit({ type: EventType.Audio, sound: SoundId.Footstep });
    eq.emit({ type: EventType.Audio, sound: SoundId.Reload });

    audioEventSystem(eq, am);

    const remaining = eq.consume(EventType.Audio);
    expect(remaining).toHaveLength(0);
  });

  it('does not consume non-Audio events', () => {
    eq.emit({
      type: EventType.Damage,
      target: 1,
      amount: 10,
      source: 2,
      isCritical: false,
      impactPosition: { x: 0, y: 0, z: 0 },
    });
    eq.emit({ type: EventType.Audio, sound: SoundId.PistolFire });

    audioEventSystem(eq, am);

    const damageEvents = eq.consume(EventType.Damage);
    expect(damageEvents).toHaveLength(1);
  });

  it('handles empty event queue without error', () => {
    expect(() => audioEventSystem(eq, am)).not.toThrow();
    expect(am.play).not.toHaveBeenCalled();
  });

  it('calls play() 10 times for 10 identical events', () => {
    for (let i = 0; i < 10; i++) {
      eq.emit({ type: EventType.Audio, sound: SoundId.EnemyHitFlesh });
    }

    audioEventSystem(eq, am);

    expect(am.play).toHaveBeenCalledTimes(10);
    for (let i = 0; i < 10; i++) {
      expect(am.play).toHaveBeenNthCalledWith(i + 1, SoundId.EnemyHitFlesh);
    }
  });

  it('processes 100+ events without truncation', () => {
    const count = 150;
    for (let i = 0; i < count; i++) {
      eq.emit({ type: EventType.Audio, sound: SoundId.Explosion });
    }

    audioEventSystem(eq, am);

    expect(am.play).toHaveBeenCalledTimes(count);
  });

  it('catches error from play() and continues processing remaining events', () => {
    const playMock = vi.fn();
    playMock.mockImplementationOnce(() => {});
    playMock.mockImplementationOnce(() => {});
    playMock.mockImplementationOnce(() => {
      throw new Error('Audio decode failed');
    });
    playMock.mockImplementation(() => {});
    (am as unknown as { play: typeof playMock }).play = playMock;

    for (let i = 0; i < 5; i++) {
      eq.emit({ type: EventType.Audio, sound: SoundId.PistolFire });
    }

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => audioEventSystem(eq, am)).not.toThrow();
    expect(playMock).toHaveBeenCalledTimes(5);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('ignores looping sounds received as one-shot AudioEvents', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    eq.emit({ type: EventType.Audio, sound: SoundId.FireAmbient });
    eq.emit({ type: EventType.Audio, sound: SoundId.WaterAmbient });
    eq.emit({ type: EventType.Audio, sound: SoundId.PistolFire });

    audioEventSystem(eq, am);

    expect(am.play).toHaveBeenCalledTimes(1);
    expect(am.play).toHaveBeenCalledWith(SoundId.PistolFire);
    expect(warnSpy).toHaveBeenCalledTimes(2);

    warnSpy.mockRestore();
  });

  it('property: every non-looping AudioEvent results in exactly one play() call', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ONE_SHOT_SOUNDS), { minLength: 0, maxLength: 50 }),
        (sounds) => {
          const localEq = new EventQueue();
          const localAm = createMockAudioManager();

          for (const sound of sounds) {
            localEq.emit({ type: EventType.Audio, sound });
          }

          audioEventSystem(localEq, localAm);

          expect(localAm.play).toHaveBeenCalledTimes(sounds.length);
        },
      ),
    );
  });

  it('property: queue is fully drained after each invocation', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...ONE_SHOT_SOUNDS), { minLength: 0, maxLength: 20 }),
        (sounds) => {
          const localEq = new EventQueue();
          const localAm = createMockAudioManager();

          for (const sound of sounds) {
            localEq.emit({ type: EventType.Audio, sound });
          }

          audioEventSystem(localEq, localAm);

          const remaining = localEq.consume(EventType.Audio);
          expect(remaining).toHaveLength(0);
        },
      ),
    );
  });
});

describe('LoopManager', () => {
  let am: AudioManager;

  beforeEach(() => {
    am = createMockAudioManager();
  });

  it('starts a loop on first startLoop call', () => {
    const lm = createLoopManager(am);

    lm.startLoop(SoundId.FireAmbient);

    expect(am.playLoop).toHaveBeenCalledTimes(1);
    expect(am.playLoop).toHaveBeenCalledWith(SoundId.FireAmbient);
  });

  it('does not re-trigger a loop that is already active', () => {
    const lm = createLoopManager(am);

    lm.startLoop(SoundId.FireAmbient);
    lm.startLoop(SoundId.FireAmbient);
    lm.startLoop(SoundId.FireAmbient);

    expect(am.playLoop).toHaveBeenCalledTimes(1);
  });

  it('stops a loop on first stopLoop call', () => {
    const lm = createLoopManager(am);

    lm.startLoop(SoundId.FireAmbient);
    lm.stopLoop(SoundId.FireAmbient);

    expect(am.stopLoop).toHaveBeenCalledTimes(1);
    expect(am.stopLoop).toHaveBeenCalledWith(SoundId.FireAmbient);
  });

  it('does not call stopLoop for an inactive loop', () => {
    const lm = createLoopManager(am);

    lm.stopLoop(SoundId.FireAmbient);

    expect(am.stopLoop).not.toHaveBeenCalled();
  });

  it('tracks multiple loops independently', () => {
    const lm = createLoopManager(am);

    lm.startLoop(SoundId.FireAmbient);
    lm.startLoop(SoundId.WaterAmbient);

    expect(am.playLoop).toHaveBeenCalledTimes(2);
    expect(lm.isActive(SoundId.FireAmbient)).toBe(true);
    expect(lm.isActive(SoundId.WaterAmbient)).toBe(true);

    lm.stopLoop(SoundId.FireAmbient);

    expect(lm.isActive(SoundId.FireAmbient)).toBe(false);
    expect(lm.isActive(SoundId.WaterAmbient)).toBe(true);
  });

  it('handles rapid enter/leave without stuttering', () => {
    const lm = createLoopManager(am);

    for (let i = 0; i < 10; i++) {
      lm.startLoop(SoundId.FireAmbient);
      lm.stopLoop(SoundId.FireAmbient);
    }

    // Each start/stop transition should call exactly once per transition
    expect(am.playLoop).toHaveBeenCalledTimes(10);
    expect(am.stopLoop).toHaveBeenCalledTimes(10);
  });

  it('stopAllLoops stops all active loops', () => {
    const lm = createLoopManager(am);

    lm.startLoop(SoundId.FireAmbient);
    lm.startLoop(SoundId.WaterAmbient);

    lm.stopAllLoops();

    expect(am.stopLoop).toHaveBeenCalledWith(SoundId.FireAmbient);
    expect(am.stopLoop).toHaveBeenCalledWith(SoundId.WaterAmbient);
    expect(lm.isActive(SoundId.FireAmbient)).toBe(false);
    expect(lm.isActive(SoundId.WaterAmbient)).toBe(false);
  });

  it('stopAllLoops is safe when no loops are active', () => {
    const lm = createLoopManager(am);

    expect(() => lm.stopAllLoops()).not.toThrow();
    expect(am.stopLoop).not.toHaveBeenCalled();
  });

  it('can restart a loop after stopAllLoops', () => {
    const lm = createLoopManager(am);

    lm.startLoop(SoundId.FireAmbient);
    lm.stopAllLoops();
    lm.startLoop(SoundId.FireAmbient);

    expect(am.playLoop).toHaveBeenCalledTimes(2);
    expect(lm.isActive(SoundId.FireAmbient)).toBe(true);
  });
});

describe('isLoopingSound', () => {
  it('returns true for FireAmbient and WaterAmbient', () => {
    expect(isLoopingSound(SoundId.FireAmbient)).toBe(true);
    expect(isLoopingSound(SoundId.WaterAmbient)).toBe(true);
  });

  it('returns false for one-shot sounds', () => {
    expect(isLoopingSound(SoundId.PistolFire)).toBe(false);
    expect(isLoopingSound(SoundId.EnemyDeath)).toBe(false);
    expect(isLoopingSound(SoundId.Footstep)).toBe(false);
  });
});
