import { SoundId, EventType } from '../ecs/components';
import type { EventQueue } from '../gameloop/events';
import type { AudioManager } from '../audio/audioManager';

const LOOPING_SOUND_IDS: ReadonlySet<SoundId> = new Set([
  SoundId.FireAmbient,
  SoundId.WaterAmbient,
]);

export function isLoopingSound(soundId: SoundId): boolean {
  return LOOPING_SOUND_IDS.has(soundId);
}

export interface LoopManager {
  startLoop(soundId: SoundId): void;
  stopLoop(soundId: SoundId): void;
  stopAllLoops(): void;
  isActive(soundId: SoundId): boolean;
}

export function createLoopManager(audioManager: AudioManager): LoopManager {
  const activeLoops = new Set<SoundId>();

  return {
    startLoop(soundId: SoundId): void {
      if (activeLoops.has(soundId)) return;
      activeLoops.add(soundId);
      audioManager.playLoop(soundId);
    },
    stopLoop(soundId: SoundId): void {
      if (!activeLoops.has(soundId)) return;
      activeLoops.delete(soundId);
      audioManager.stopLoop(soundId);
    },
    stopAllLoops(): void {
      for (const soundId of activeLoops) {
        audioManager.stopLoop(soundId);
      }
      activeLoops.clear();
    },
    isActive(soundId: SoundId): boolean {
      return activeLoops.has(soundId);
    },
  };
}

export function audioEventSystem(
  eventQueue: EventQueue,
  audioManager: AudioManager,
): void {
  const events = eventQueue.consume(EventType.Audio);

  for (const event of events) {
    if (LOOPING_SOUND_IDS.has(event.sound)) {
      console.warn(
        `[AudioEventSystem] Looping sound ${SoundId[event.sound]} received as one-shot event; ignoring. Use LoopManager instead.`,
      );
      continue;
    }

    try {
      audioManager.play(event.sound);
    } catch (error) {
      console.warn(
        `[AudioEventSystem] Error playing sound ${SoundId[event.sound]}:`,
        error,
      );
    }
  }
}
