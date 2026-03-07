import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { World } from '../src/ecs/world';
import { EventQueue } from '../src/gameloop/events';
import { destructibleSystem } from '../src/systems/destructibleSystem';
import {
  EventType,
  MeshId,
  ParticleEffect,
  SoundId,
  ColliderShape,
} from '../src/ecs/components';
import type {
  Destructible,
  Position,
  Renderable,
  Collider,
} from '../src/ecs/components';

// ── Helpers ─────────────────────────────────────────────────────────────────

function createDestructibleEntity(
  world: World,
  health: number,
  meshId: MeshId,
  pos: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
): number {
  const id = world.createEntity();
  world.addComponent<Destructible>(id, 'Destructible', {
    health,
    maxHealth: 30,
  });
  world.addComponent<Position>(id, 'Position', pos);
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId,
    visible: true,
    scale: 1,
  });
  world.addComponent<Collider>(id, 'Collider', {
    type: ColliderShape.AABB,
    width: 1,
    height: 1,
    depth: 1,
    isStatic: true,
    isTrigger: false,
  });
  world.addComponent(id, 'DestructibleTag', {});
  return id;
}

const TYPE_MAP: Array<{
  meshId: MeshId;
  particle: ParticleEffect;
  sound: SoundId;
  label: string;
}> = [
  { meshId: MeshId.Crate, particle: ParticleEffect.DestructibleDebrisWood, sound: SoundId.DestructibleBreakWood, label: 'Crate' },
  { meshId: MeshId.Pillar, particle: ParticleEffect.DestructibleDebrisStone, sound: SoundId.DestructibleBreakStone, label: 'Pillar' },
  { meshId: MeshId.Barrel, particle: ParticleEffect.DestructibleDebrisMetal, sound: SoundId.DestructibleBreakMetal, label: 'Barrel' },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('destructibleSystem', () => {
  let world: World;
  let eventQueue: EventQueue;

  beforeEach(() => {
    world = new World();
    eventQueue = new EventQueue();
  });

  // ── Health exactly zero ───────────────────────────────────────────────

  it('destroys entity when health is exactly zero', () => {
    const id = createDestructibleEntity(world, 0, MeshId.Crate);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id)).toBe(false);
  });

  it('emits correct particle and audio for Crate at health=0', () => {
    createDestructibleEntity(world, 0, MeshId.Crate, { x: 5, y: 0, z: 3 });
    destructibleSystem(world, eventQueue);

    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(1);
    expect(particles[0].effect).toBe(ParticleEffect.DestructibleDebrisWood);
    expect(particles[0].position).toEqual({ x: 5, y: 0, z: 3 });

    const audio = eventQueue.consume(EventType.Audio);
    expect(audio).toHaveLength(1);
    expect(audio[0].sound).toBe(SoundId.DestructibleBreakWood);
  });

  // ── Health negative (overkill) ────────────────────────────────────────

  it('destroys entity with negative health (overkill)', () => {
    const id = createDestructibleEntity(world, -50, MeshId.Barrel);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id)).toBe(false);

    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(1);
    expect(particles[0].effect).toBe(ParticleEffect.DestructibleDebrisMetal);

    const audio = eventQueue.consume(EventType.Audio);
    expect(audio).toHaveLength(1);
    expect(audio[0].sound).toBe(SoundId.DestructibleBreakMetal);
  });

  // ── Health exactly one (survival) ─────────────────────────────────────

  it('does not destroy entity with health=1', () => {
    const id = createDestructibleEntity(world, 1, MeshId.Pillar);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id)).toBe(true);

    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(0);
    const audio = eventQueue.consume(EventType.Audio);
    expect(audio).toHaveLength(0);
  });

  // ── Correct particle/audio mapping per MeshId ─────────────────────────

  describe.each(TYPE_MAP)('$label mapping', ({ meshId, particle, sound }) => {
    it(`emits ${ParticleEffect[particle]} particle and ${SoundId[sound]} sound`, () => {
      createDestructibleEntity(world, 0, meshId);
      destructibleSystem(world, eventQueue);

      const particles = eventQueue.consume(EventType.Particle);
      expect(particles).toHaveLength(1);
      expect(particles[0].effect).toBe(particle);

      const audio = eventQueue.consume(EventType.Audio);
      expect(audio).toHaveLength(1);
      expect(audio[0].sound).toBe(sound);
    });
  });

  it('emits all three correct mappings when all types destroyed in one frame', () => {
    createDestructibleEntity(world, 0, MeshId.Crate);
    createDestructibleEntity(world, 0, MeshId.Pillar);
    createDestructibleEntity(world, 0, MeshId.Barrel);
    destructibleSystem(world, eventQueue);

    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(3);
    const effects = particles.map((p) => p.effect).sort();
    expect(effects).toEqual([
      ParticleEffect.DestructibleDebrisWood,
      ParticleEffect.DestructibleDebrisStone,
      ParticleEffect.DestructibleDebrisMetal,
    ].sort());

    const audio = eventQueue.consume(EventType.Audio);
    expect(audio).toHaveLength(3);
    const sounds = audio.map((a) => a.sound).sort();
    expect(sounds).toEqual([
      SoundId.DestructibleBreakWood,
      SoundId.DestructibleBreakStone,
      SoundId.DestructibleBreakMetal,
    ].sort());
  });

  // ── Collider removed on destruction ───────────────────────────────────

  it('removes collider component when entity is destroyed', () => {
    const id = createDestructibleEntity(world, 0, MeshId.Crate);
    expect(world.hasComponent(id, 'Collider')).toBe(true);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id)).toBe(false);
    expect(world.hasComponent(id, 'Collider')).toBe(false);
  });

  // ── Multiple destructibles in one frame ───────────────────────────────

  it('destroys exactly the dead ones, leaves alive ones intact', () => {
    const dead1 = createDestructibleEntity(world, 0, MeshId.Crate);
    const dead2 = createDestructibleEntity(world, -10, MeshId.Pillar);
    const dead3 = createDestructibleEntity(world, -1, MeshId.Barrel);
    const alive1 = createDestructibleEntity(world, 5, MeshId.Crate);
    const alive2 = createDestructibleEntity(world, 1, MeshId.Pillar);

    destructibleSystem(world, eventQueue);

    expect(world.hasEntity(dead1)).toBe(false);
    expect(world.hasEntity(dead2)).toBe(false);
    expect(world.hasEntity(dead3)).toBe(false);
    expect(world.hasEntity(alive1)).toBe(true);
    expect(world.hasEntity(alive2)).toBe(true);

    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(3);
    const audio = eventQueue.consume(EventType.Audio);
    expect(audio).toHaveLength(3);
  });

  // ── Unknown/unmapped MeshId ───────────────────────────────────────────

  it('destroys entity with unmapped MeshId without crashing', () => {
    const id = createDestructibleEntity(world, 0, MeshId.Wall);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id)).toBe(false);

    // No particle or audio emitted for unmapped type
    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(0);
    const audio = eventQueue.consume(EventType.Audio);
    expect(audio).toHaveLength(0);
  });

  // ── Entity already destroyed before system runs ───────────────────────

  it('handles entity destroyed before system runs', () => {
    const id = createDestructibleEntity(world, 0, MeshId.Crate);
    world.destroyEntity(id);

    expect(() => destructibleSystem(world, eventQueue)).not.toThrow();

    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(0);
  });

  // ── Idempotency ───────────────────────────────────────────────────────

  it('is idempotent: running twice produces no duplicate events', () => {
    createDestructibleEntity(world, 0, MeshId.Crate);
    destructibleSystem(world, eventQueue);

    const particles1 = eventQueue.consume(EventType.Particle);
    const audio1 = eventQueue.consume(EventType.Audio);
    expect(particles1).toHaveLength(1);
    expect(audio1).toHaveLength(1);

    // Second run on same world — entity already gone
    destructibleSystem(world, eventQueue);

    const particles2 = eventQueue.consume(EventType.Particle);
    const audio2 = eventQueue.consume(EventType.Audio);
    expect(particles2).toHaveLength(0);
    expect(audio2).toHaveLength(0);
  });

  // ── Edge: spawned already dead ────────────────────────────────────────

  it('destroys entity spawned with health=0 on same frame', () => {
    const id = createDestructibleEntity(world, 0, MeshId.Barrel);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id)).toBe(false);
  });

  // ── Edge: overlapping destructibles ───────────────────────────────────

  it('handles two overlapping destructibles at same position', () => {
    const pos = { x: 3, y: 0, z: 3 };
    const id1 = createDestructibleEntity(world, 0, MeshId.Crate, pos);
    const id2 = createDestructibleEntity(world, 0, MeshId.Pillar, pos);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id1)).toBe(false);
    expect(world.hasEntity(id2)).toBe(false);

    const particles = eventQueue.consume(EventType.Particle);
    expect(particles).toHaveLength(2);
  });

  // ── Edge: extreme negative health ─────────────────────────────────────

  it('handles Number.MIN_SAFE_INTEGER health', () => {
    const id = createDestructibleEntity(world, Number.MIN_SAFE_INTEGER, MeshId.Crate);
    destructibleSystem(world, eventQueue);
    expect(world.hasEntity(id)).toBe(false);
  });

  // ── Property-based tests ──────────────────────────────────────────────

  describe('property-based', () => {
    it('entities with health > 0 are never destroyed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          (health) => {
            const w = new World();
            const eq = new EventQueue();
            const id = createDestructibleEntity(w, health, MeshId.Crate);
            destructibleSystem(w, eq);
            expect(w.hasEntity(id)).toBe(true);
            expect(eq.consume(EventType.Particle)).toHaveLength(0);
            expect(eq.consume(EventType.Audio)).toHaveLength(0);
          },
        ),
      );
    });

    it('entities with health <= 0 are always destroyed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: -10000, max: 0 }),
          fc.constantFrom(MeshId.Crate, MeshId.Pillar, MeshId.Barrel),
          (health, meshId) => {
            const w = new World();
            const eq = new EventQueue();
            const id = createDestructibleEntity(w, health, meshId);
            destructibleSystem(w, eq);
            expect(w.hasEntity(id)).toBe(false);
            expect(eq.consume(EventType.Particle)).toHaveLength(1);
            expect(eq.consume(EventType.Audio)).toHaveLength(1);
          },
        ),
      );
    });

    it('number of events equals number of destroyed entities', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: -100, max: 100 }), { minLength: 0, maxLength: 20 }),
          (healths) => {
            const w = new World();
            const eq = new EventQueue();
            for (const h of healths) {
              createDestructibleEntity(w, h, MeshId.Crate);
            }
            destructibleSystem(w, eq);
            const deadCount = healths.filter((h) => h <= 0).length;
            expect(eq.consume(EventType.Particle)).toHaveLength(deadCount);
            expect(eq.consume(EventType.Audio)).toHaveLength(deadCount);
          },
        ),
      );
    });
  });
});
