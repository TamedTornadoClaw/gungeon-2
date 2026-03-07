import type { EntityId, Vec3 } from '../types';
import { ParticleEffect, SoundId } from '../ecs/components';

// ── Event Type Enum ─────────────────────────────────────────────────────────

export enum EventType {
  Damage = 'Damage',
  Particle = 'Particle',
  Audio = 'Audio',
  DamageNumber = 'DamageNumber',
  DoorInteract = 'DoorInteract',
}

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

// ── Union & Type Map ────────────────────────────────────────────────────────

export type GameEvent =
  | DamageEvent
  | ParticleEvent
  | AudioEvent
  | DamageNumberEvent
  | DoorInteractEvent;

export interface EventTypeMap {
  [EventType.Damage]: DamageEvent;
  [EventType.Particle]: ParticleEvent;
  [EventType.Audio]: AudioEvent;
  [EventType.DamageNumber]: DamageNumberEvent;
  [EventType.DoorInteract]: DoorInteractEvent;
}

// ── Event Queue ─────────────────────────────────────────────────────────────

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
