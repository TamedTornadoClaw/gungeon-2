import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { doorSystem } from '../src/systems/doorSystem';
import {
  EventType,
  SoundId,
  ColliderShape,
} from '../src/ecs/components';
import type {
  Door,
  Collider,
  Position,
} from '../src/ecs/components';
import type { AudioEvent } from '../src/gameloop/events';

function createDoorEntity(
  world: World,
  isOpen: boolean,
  isTrigger?: boolean,
): number {
  const id = world.createEntity();
  world.addComponent<Door>(id, 'Door', { isOpen });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: 2,
    height: 2,
    depth: 0.5,
    isStatic: true,
    isTrigger: isTrigger ?? isOpen,
  });
  world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
  return id;
}

function getAudioEvents(eventQueue: EventQueue): AudioEvent[] {
  return eventQueue.consume<EventType.Audio>(EventType.Audio);
}

describe('DoorSystem', () => {
  it('opens a closed door', () => {
    const world = new World();
    const eq = new EventQueue();
    const doorId = createDoorEntity(world, false);

    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    doorSystem(world, eq);

    const door = world.getComponent<Door>(doorId, 'Door')!;
    const collider = world.getComponent<Collider>(doorId, 'Collider')!;
    expect(door.isOpen).toBe(true);
    expect(collider.isTrigger).toBe(true);

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(1);
    expect(audioEvents[0].sound).toBe(SoundId.DoorOpen);
  });

  it('ignores DoorInteract on an already-open door', () => {
    const world = new World();
    const eq = new EventQueue();
    const doorId = createDoorEntity(world, true, true);

    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    doorSystem(world, eq);

    const door = world.getComponent<Door>(doorId, 'Door')!;
    expect(door.isOpen).toBe(true);

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(0);
  });

  it('only opens the targeted door among multiple doors', () => {
    const world = new World();
    const eq = new EventQueue();
    const door1 = createDoorEntity(world, false);
    const door2 = createDoorEntity(world, false);
    const door3 = createDoorEntity(world, false);

    eq.emit({ type: EventType.DoorInteract, doorEntity: door2 });
    doorSystem(world, eq);

    expect(world.getComponent<Door>(door1, 'Door')!.isOpen).toBe(false);
    expect(world.getComponent<Door>(door2, 'Door')!.isOpen).toBe(true);
    expect(world.getComponent<Door>(door3, 'Door')!.isOpen).toBe(false);

    expect(world.getComponent<Collider>(door1, 'Collider')!.isTrigger).toBe(false);
    expect(world.getComponent<Collider>(door2, 'Collider')!.isTrigger).toBe(true);
    expect(world.getComponent<Collider>(door3, 'Collider')!.isTrigger).toBe(false);

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(1);
  });

  it('deduplicates multiple DoorInteract events for the same door in one frame', () => {
    const world = new World();
    const eq = new EventQueue();
    const doorId = createDoorEntity(world, false);

    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    doorSystem(world, eq);

    const door = world.getComponent<Door>(doorId, 'Door')!;
    expect(door.isOpen).toBe(true);

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(1);
  });

  it('handles DoorInteract event with invalid/destroyed entity ID', () => {
    const world = new World();
    const eq = new EventQueue();

    eq.emit({ type: EventType.DoorInteract, doorEntity: 9999 });
    expect(() => doorSystem(world, eq)).not.toThrow();

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(0);
  });

  it('door remains open permanently across multiple frames', () => {
    const world = new World();
    const eq = new EventQueue();
    const doorId = createDoorEntity(world, false);

    // Frame 1: open the door
    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    doorSystem(world, eq);
    getAudioEvents(eq); // consume audio events

    // Frames 2-4: no events
    for (let i = 0; i < 3; i++) {
      doorSystem(world, eq);
      const audioEvents = getAudioEvents(eq);
      expect(audioEvents).toHaveLength(0);
    }

    const door = world.getComponent<Door>(doorId, 'Door')!;
    const collider = world.getComponent<Collider>(doorId, 'Collider')!;
    expect(door.isOpen).toBe(true);
    expect(collider.isTrigger).toBe(true);
  });

  it('handles door entity with no Collider component gracefully', () => {
    const world = new World();
    const eq = new EventQueue();
    const doorId = world.createEntity();
    world.addComponent<Door>(doorId, 'Door', { isOpen: false });
    world.addComponent<Position>(doorId, 'Position', { x: 0, y: 0, z: 0 });

    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    expect(() => doorSystem(world, eq)).not.toThrow();

    const door = world.getComponent<Door>(doorId, 'Door')!;
    expect(door.isOpen).toBe(true);

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(1);
  });

  it('handles no events in queue gracefully', () => {
    const world = new World();
    const eq = new EventQueue();
    createDoorEntity(world, false);
    createDoorEntity(world, false);
    createDoorEntity(world, false);

    expect(() => doorSystem(world, eq)).not.toThrow();
    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(0);
  });

  it('emits audio event with door position', () => {
    const world = new World();
    const eq = new EventQueue();
    const doorId = world.createEntity();
    world.addComponent<Door>(doorId, 'Door', { isOpen: false });
    world.addComponent<Collider>(doorId, 'Collider', {
      type: ColliderShape.AABB,
      width: 2,
      height: 2,
      depth: 0.5,
      isStatic: true,
      isTrigger: false,
    });
    world.addComponent<Position>(doorId, 'Position', { x: 5, y: 0, z: 10 });

    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    doorSystem(world, eq);

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(1);
    expect(audioEvents[0].position).toEqual({ x: 5, y: 0, z: 10 });
  });

  it('emits audio event without position when door has no Position component', () => {
    const world = new World();
    const eq = new EventQueue();
    const doorId = world.createEntity();
    world.addComponent<Door>(doorId, 'Door', { isOpen: false });
    world.addComponent<Collider>(doorId, 'Collider', {
      type: ColliderShape.AABB,
      width: 2,
      height: 2,
      depth: 0.5,
      isStatic: true,
      isTrigger: false,
    });

    eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
    doorSystem(world, eq);

    const audioEvents = getAudioEvents(eq);
    expect(audioEvents).toHaveLength(1);
    expect(audioEvents[0].position).toBeUndefined();
  });

  // Property-based tests
  describe('property-based', () => {
    it('opening any closed door always results in isOpen=true and isTrigger=true', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100 }),
          (doorCount) => {
            const world = new World();
            const eq = new EventQueue();
            const doorIds: number[] = [];

            for (let i = 0; i < doorCount; i++) {
              doorIds.push(createDoorEntity(world, false));
            }

            // Open all doors
            for (const id of doorIds) {
              eq.emit({ type: EventType.DoorInteract, doorEntity: id });
            }
            doorSystem(world, eq);

            for (const id of doorIds) {
              const door = world.getComponent<Door>(id, 'Door')!;
              const collider = world.getComponent<Collider>(id, 'Collider')!;
              expect(door.isOpen).toBe(true);
              expect(collider.isTrigger).toBe(true);
            }
          },
        ),
      );
    });

    it('doors without events are never modified', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          fc.integer({ min: 0, max: 49 }),
          (doorCount, targetIndex) => {
            const clampedTarget = targetIndex % doorCount;
            const world = new World();
            const eq = new EventQueue();
            const doorIds: number[] = [];

            for (let i = 0; i < doorCount; i++) {
              doorIds.push(createDoorEntity(world, false));
            }

            // Only open one door
            eq.emit({ type: EventType.DoorInteract, doorEntity: doorIds[clampedTarget] });
            doorSystem(world, eq);

            for (let i = 0; i < doorCount; i++) {
              const door = world.getComponent<Door>(doorIds[i], 'Door')!;
              if (i === clampedTarget) {
                expect(door.isOpen).toBe(true);
              } else {
                expect(door.isOpen).toBe(false);
              }
            }
          },
        ),
      );
    });

    it('duplicate events for the same door never produce more than one AudioEvent', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          (dupeCount) => {
            const world = new World();
            const eq = new EventQueue();
            const doorId = createDoorEntity(world, false);

            for (let i = 0; i < dupeCount; i++) {
              eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
            }
            doorSystem(world, eq);

            const audioEvents = getAudioEvents(eq);
            expect(audioEvents).toHaveLength(1);
          },
        ),
      );
    });

    it('opening an already-open door never emits audio', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          (eventCount) => {
            const world = new World();
            const eq = new EventQueue();
            const doorId = createDoorEntity(world, true, true);

            for (let i = 0; i < eventCount; i++) {
              eq.emit({ type: EventType.DoorInteract, doorEntity: doorId });
            }
            doorSystem(world, eq);

            const audioEvents = getAudioEvents(eq);
            expect(audioEvents).toHaveLength(0);
          },
        ),
      );
    });
  });
});
