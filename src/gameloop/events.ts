import type { EntityId, Vec3 } from '../types';
import { EventType, ParticleEffect, SoundId } from '../ecs/components';

// Re-export EventType so consumers can import from either location
export { EventType };

// ── Event Interfaces ────────────────────────────────────────────────────────

export interface DamageEvent {
  type: EventType.Damage;
  target: EntityId;
  amount: number;
  source: EntityId;
  isCritical: boolean;
  impactPosition: Vec3;
}

export interface ParticleEvent {
  type: EventType.Particle;
  effect: ParticleEffect;
  position: Vec3;
}

export interface AudioEvent {
  type: EventType.Audio;
  sound: SoundId;
  position?: Vec3;
}

export interface DamageNumberEvent {
  type: EventType.DamageNumber;
  amount: number;
  position: Vec3;
  isCritical: boolean;
}

export interface DoorInteractEvent {
  type: EventType.DoorInteract;
  doorEntity: EntityId;
}

export interface ScreenShakeEvent {
  type: EventType.ScreenShake;
  intensity: number;
}

export interface HitFlashEvent {
  type: EventType.HitFlash;
}

// ── Union & Type Map ────────────────────────────────────────────────────────

export type GameEvent =
  | DamageEvent
  | ParticleEvent
  | AudioEvent
  | DamageNumberEvent
  | DoorInteractEvent
  | ScreenShakeEvent
  | HitFlashEvent;

export interface EventTypeMap {
  [EventType.Damage]: DamageEvent;
  [EventType.Particle]: ParticleEvent;
  [EventType.Audio]: AudioEvent;
  [EventType.DamageNumber]: DamageNumberEvent;
  [EventType.DoorInteract]: DoorInteractEvent;
  [EventType.ScreenShake]: ScreenShakeEvent;
  [EventType.HitFlash]: HitFlashEvent;
}

// ── Event Queue ─────────────────────────────────────────────────────────────

// Integration: The game loop creates a single EventQueue instance via createEventQueue()
// and passes it to every system that emits or consumes events. At the end of each frame,
// the game loop calls eventQueue.clear() to flush unconsumed events before the next tick.

export class EventQueue {
  private events: GameEvent[] = [];

  emit(event: GameEvent): void {
    this.events.push(event);
  }

  consume<T extends EventType>(type: T): EventTypeMap[T][] {
    const matched: EventTypeMap[T][] = [];
    const remaining: GameEvent[] = [];

    for (const event of this.events) {
      if (event.type === type) {
        matched.push(event as EventTypeMap[T]);
      } else {
        remaining.push(event);
      }
    }

    this.events = remaining;
    return matched;
  }

  clear(): void {
    this.events = [];
  }
}

/** Factory for creating the per-frame event queue. Called once by the game loop at startup. */
export function createEventQueue(): EventQueue {
  return new EventQueue();
}
