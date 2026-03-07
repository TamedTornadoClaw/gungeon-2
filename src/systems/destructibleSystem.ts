import { World } from '../ecs/world';
import { EventQueue } from '../gameloop/events';
import {
  EventType,
  MeshId,
  ParticleEffect,
  SoundId,
} from '../ecs/components';
import type {
  Destructible,
  Position,
  Renderable,
} from '../ecs/components';

const PARTICLE_MAP: Partial<Record<MeshId, ParticleEffect>> = {
  [MeshId.Crate]: ParticleEffect.DestructibleDebrisWood,
  [MeshId.Pillar]: ParticleEffect.DestructibleDebrisStone,
  [MeshId.Barrel]: ParticleEffect.DestructibleDebrisMetal,
};

const SOUND_MAP: Partial<Record<MeshId, SoundId>> = {
  [MeshId.Crate]: SoundId.DestructibleBreakWood,
  [MeshId.Pillar]: SoundId.DestructibleBreakStone,
  [MeshId.Barrel]: SoundId.DestructibleBreakMetal,
};

/**
 * DestructibleSystem — destroys destructibles at health <= 0,
 * emits debris particles and break sounds.
 */
export function destructibleSystem(world: World, eventQueue: EventQueue): void {
  const entities = world.query(['Destructible', 'Position', 'Renderable']);
  const toDestroy: number[] = [];

  for (const entityId of entities) {
    const destructible = world.getComponent<Destructible>(entityId, 'Destructible');
    if (!destructible || destructible.health > 0) continue;

    const position = world.getComponent<Position>(entityId, 'Position')!;
    const renderable = world.getComponent<Renderable>(entityId, 'Renderable')!;

    const particle = PARTICLE_MAP[renderable.meshId];
    if (particle !== undefined) {
      eventQueue.emit({
        type: EventType.Particle,
        effect: particle,
        position: { x: position.x, y: position.y, z: position.z },
      });
    }

    const sound = SOUND_MAP[renderable.meshId];
    if (sound !== undefined) {
      eventQueue.emit({
        type: EventType.Audio,
        sound,
        position: { x: position.x, y: position.y, z: position.z },
      });
    }

    toDestroy.push(entityId);
  }

  for (const id of toDestroy) {
    world.destroyEntity(id);
  }
}
