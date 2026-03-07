import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import { EventType, SoundId } from '../ecs/components';
import type { Door, Collider, Position } from '../ecs/components';

/**
 * DoorSystem — consumes DoorInteract events and opens closed doors.
 *
 * When a closed door receives a DoorInteract event:
 *   - Sets door.isOpen = true
 *   - Sets collider.isTrigger = true (no longer blocks movement)
 *   - Emits AudioEvent(DoorOpen) at the door's position
 *
 * Already-open doors are ignored (idempotent).
 * Doors stay open permanently once opened.
 */
export function doorSystem(world: World, eventQueue: EventQueue): void {
  const doorEvents = eventQueue.consume<EventType.DoorInteract>(EventType.DoorInteract);

  const processed = new Set<number>();

  for (const event of doorEvents) {
    const { doorEntity } = event;

    // Skip duplicates within the same frame
    if (processed.has(doorEntity)) continue;
    processed.add(doorEntity);

    const door = world.getComponent<Door>(doorEntity, 'Door');
    if (!door) continue;

    // Already open — ignore
    if (door.isOpen) continue;

    // Open the door
    door.isOpen = true;

    const collider = world.getComponent<Collider>(doorEntity, 'Collider');
    if (collider) {
      collider.isTrigger = true;
    }

    const position = world.getComponent<Position>(doorEntity, 'Position');
    eventQueue.emit({
      type: EventType.Audio,
      sound: SoundId.DoorOpen,
      position: position ? { x: position.x, y: position.y, z: position.z } : undefined,
    });
  }
}
