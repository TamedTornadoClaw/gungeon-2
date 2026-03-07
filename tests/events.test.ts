import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import {
  EventQueue,
  EventType,
  type DamageEvent,
  type ParticleEvent,
  type AudioEvent,
  type DamageNumberEvent,
  type DoorInteractEvent,
  type GameEvent,
} from '../src/gameloop/events';
import { ParticleEffect, SoundId } from '../src/ecs/components';

describe('EventQueue', () => {
  let queue: EventQueue;

  beforeEach(() => {
    queue = new EventQueue();
  });

  it('returns empty array when no events of type exist', () => {
    expect(queue.consume(EventType.Damage)).toEqual([]);
  });

  it('emits and consumes a single event', () => {
    const event: DamageEvent = {
      type: EventType.Damage,
      target: 1,
      amount: 25,
      source: 2,
      isCritical: false,
      impactPosition: { x: 0, y: 0, z: 0 },
    };

    queue.emit(event);
    const consumed = queue.consume(EventType.Damage);

    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toEqual(event);
  });

  it('consumes removes events of that type from the queue', () => {
    queue.emit({
      type: EventType.Damage,
      target: 1,
      amount: 10,
      source: 2,
      isCritical: false,
      impactPosition: { x: 0, y: 0, z: 0 },
    });

    queue.consume(EventType.Damage);
    const second = queue.consume(EventType.Damage);

    expect(second).toEqual([]);
  });

  it('only consumes events of the requested type', () => {
    const damage: DamageEvent = {
      type: EventType.Damage,
      target: 1,
      amount: 10,
      source: 2,
      isCritical: false,
      impactPosition: { x: 0, y: 0, z: 0 },
    };
    const audio: AudioEvent = {
      type: EventType.Audio,
      sound: SoundId.PistolFire,
      position: { x: 1, y: 0, z: 0 },
    };

    queue.emit(damage);
    queue.emit(audio);

    const consumed = queue.consume(EventType.Damage);
    expect(consumed).toHaveLength(1);
    expect(consumed[0]).toEqual(damage);

    // Audio event should still be in the queue
    const audioEvents = queue.consume(EventType.Audio);
    expect(audioEvents).toHaveLength(1);
    expect(audioEvents[0]).toEqual(audio);
  });

  it('emits and consumes multiple events of the same type', () => {
    for (let i = 0; i < 5; i++) {
      queue.emit({
        type: EventType.Particle,
        effect: ParticleEffect.MuzzleFlash,
        position: { x: i, y: 0, z: 0 },
      });
    }

    const consumed = queue.consume(EventType.Particle);
    expect(consumed).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect((consumed[i] as ParticleEvent).position.x).toBe(i);
    }
  });

  it('clear removes all events', () => {
    queue.emit({
      type: EventType.Damage,
      target: 1,
      amount: 10,
      source: 2,
      isCritical: false,
      impactPosition: { x: 0, y: 0, z: 0 },
    });
    queue.emit({
      type: EventType.Audio,
      sound: SoundId.Explosion,
    });
    queue.emit({
      type: EventType.Particle,
      effect: ParticleEffect.Explosion,
      position: { x: 0, y: 0, z: 0 },
    });

    queue.clear();

    expect(queue.consume(EventType.Damage)).toEqual([]);
    expect(queue.consume(EventType.Audio)).toEqual([]);
    expect(queue.consume(EventType.Particle)).toEqual([]);
  });

  it('handles all five event types', () => {
    const damage: DamageEvent = {
      type: EventType.Damage,
      target: 1,
      amount: 50,
      source: 2,
      isCritical: true,
      impactPosition: { x: 1, y: 2, z: 3 },
    };
    const particle: ParticleEvent = {
      type: EventType.Particle,
      effect: ParticleEffect.BloodSplat,
      position: { x: 1, y: 2, z: 3 },
    };
    const audio: AudioEvent = {
      type: EventType.Audio,
      sound: SoundId.EnemyHitFlesh,
    };
    const damageNumber: DamageNumberEvent = {
      type: EventType.DamageNumber,
      amount: 50,
      position: { x: 1, y: 2, z: 3 },
      isCritical: true,
    };
    const doorInteract: DoorInteractEvent = {
      type: EventType.DoorInteract,
      doorEntity: 42,
    };

    queue.emit(damage);
    queue.emit(particle);
    queue.emit(audio);
    queue.emit(damageNumber);
    queue.emit(doorInteract);

    expect(queue.consume(EventType.Damage)).toEqual([damage]);
    expect(queue.consume(EventType.Particle)).toEqual([particle]);
    expect(queue.consume(EventType.Audio)).toEqual([audio]);
    expect(queue.consume(EventType.DamageNumber)).toEqual([damageNumber]);
    expect(queue.consume(EventType.DoorInteract)).toEqual([doorInteract]);
  });

  // ── Property-based tests ──────────────────────────────────────────────────

  it('consume by type returns correct partition (property)', () => {
    const eventTypeValues = Object.values(EventType);
    const soundValues = Object.values(SoundId);
    const particleValues = Object.values(ParticleEffect);

    const arbEventType = fc.constantFrom(...eventTypeValues);

    const arbEvent: fc.Arbitrary<GameEvent> = arbEventType.chain((type) => {
      switch (type) {
        case EventType.Damage:
          return fc.record({
            type: fc.constant(EventType.Damage as const),
            target: fc.nat(),
            amount: fc.nat(),
            source: fc.nat(),
            isCritical: fc.boolean(),
            impactPosition: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
          });
        case EventType.Particle:
          return fc.record({
            type: fc.constant(EventType.Particle as const),
            effect: fc.constantFrom(...particleValues),
            position: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
          });
        case EventType.Audio:
          return fc.record({
            type: fc.constant(EventType.Audio as const),
            sound: fc.constantFrom(...soundValues),
            position: fc.option(fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }), { nil: undefined }),
          });
        case EventType.DamageNumber:
          return fc.record({
            type: fc.constant(EventType.DamageNumber as const),
            amount: fc.nat(),
            position: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
            isCritical: fc.boolean(),
          });
        case EventType.DoorInteract:
          return fc.record({
            type: fc.constant(EventType.DoorInteract as const),
            doorEntity: fc.nat(),
          });
        default:
          return fc.constant({ type: EventType.Damage, target: 0, amount: 0, source: 0, isCritical: false, impactPosition: { x: 0, y: 0, z: 0 } } as GameEvent);
      }
    });

    fc.assert(
      fc.property(fc.array(arbEvent), arbEventType, (events, targetType) => {
        const q = new EventQueue();
        for (const e of events) q.emit(e);

        const consumed = q.consume(targetType);
        const expectedCount = events.filter((e) => e.type === targetType).length;
        expect(consumed).toHaveLength(expectedCount);
        expect(consumed.every((e) => e.type === targetType)).toBe(true);
      }),
    );
  });

  it('emit order is preserved (property)', () => {
    fc.assert(
      fc.property(fc.array(fc.nat(), { minLength: 1, maxLength: 50 }), (ids) => {
        const q = new EventQueue();
        for (const id of ids) {
          q.emit({
            type: EventType.Damage,
            target: id,
            amount: 0,
            source: 0,
            isCritical: false,
            impactPosition: { x: 0, y: 0, z: 0 },
          });
        }
        const consumed = q.consume(EventType.Damage) as DamageEvent[];
        expect(consumed.map((e) => e.target)).toEqual(ids);
      }),
    );
  });

  it('consumed + remaining = original set (property)', () => {
    const arbEvent: fc.Arbitrary<GameEvent> = fc.oneof(
      fc.record({
        type: fc.constant(EventType.Damage as const),
        target: fc.nat(),
        amount: fc.nat(),
        source: fc.nat(),
        isCritical: fc.boolean(),
        impactPosition: fc.record({ x: fc.float(), y: fc.float(), z: fc.float() }),
      }),
      fc.record({
        type: fc.constant(EventType.Audio as const),
        sound: fc.constantFrom(...Object.values(SoundId)),
      }),
    );

    fc.assert(
      fc.property(fc.array(arbEvent), (events) => {
        const q = new EventQueue();
        for (const e of events) q.emit(e);

        const consumed = q.consume(EventType.Damage);
        const remaining = q.consume(EventType.Audio);

        expect(consumed.length + remaining.length).toBe(events.length);
      }),
    );
  });

  it('AudioEvent position is optional', () => {
    const withoutPos: AudioEvent = {
      type: EventType.Audio,
      sound: SoundId.MenuClick,
    };
    const withPos: AudioEvent = {
      type: EventType.Audio,
      sound: SoundId.PistolFire,
      position: { x: 5, y: 0, z: 3 },
    };

    queue.emit(withoutPos);
    queue.emit(withPos);

    const consumed = queue.consume(EventType.Audio);
    expect(consumed).toHaveLength(2);
    expect(consumed[0].position).toBeUndefined();
    expect(consumed[1].position).toEqual({ x: 5, y: 0, z: 3 });
  });
});
