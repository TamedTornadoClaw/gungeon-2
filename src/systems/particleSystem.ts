/**
 * ParticleSystem — consumes ParticleEvents, spawns particle entities per manifest,
 * updates active particles (position, size, opacity, gravity) each frame,
 * and removes expired particles.
 *
 * Each particle is an entity with Position, Velocity, and Particle components.
 * Particles have NO Collider, NO Lifetime — this system manages its own lifecycle.
 *
 * Integration: Called by the game loop each fixed-timestep tick.
 */
import type { World } from '../ecs/world';
import type { EventQueue } from '../gameloop/events';
import { EventType, ParticleEffect } from '../ecs/components';
import type { Position, Velocity, Particle } from '../ecs/components';
import { getDesignParams } from '../config/designParams';
import type { ParticleEffectParams } from '../config/designParams';

function parseColor(hex: string): number {
  return parseInt(hex.replace('0x', ''), 16);
}

export function particleSystem(world: World, eventQueue: EventQueue, dt: number): void {
  const params = getDesignParams().particles;
  const effectsConfig = params.effects;

  // 1. Consume all ParticleEvents and spawn particles
  const events = eventQueue.consume(EventType.Particle);

  for (const event of events) {
    const effectName = ParticleEffect[event.effect];
    const config: ParticleEffectParams | undefined = effectsConfig[effectName];

    if (!config) {
      console.warn(`ParticleSystem: no manifest entry for effect "${effectName}"`);
      continue;
    }

    if (config.count <= 0) continue;

    // Check particle cap before spawning
    const currentParticles = world.query(['Particle']);
    const available = Math.max(0, params.maxParticles - currentParticles.length);
    const toSpawn = Math.min(config.count, available);

    const colorStart = parseColor(config.colorStart);
    const colorEnd = parseColor(config.colorEnd);

    for (let i = 0; i < toSpawn; i++) {
      const angle = config.spread === 0
        ? 0
        : (Math.random() - 0.5) * config.spread;
      const speed = config.speed * (0.5 + Math.random() * 0.5);

      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      const id = world.createEntity();
      world.addComponent<Position>(id, 'Position', {
        x: event.position.x,
        y: event.position.y,
        z: event.position.z,
      });
      world.addComponent<Velocity>(id, 'Velocity', {
        x: vx,
        y: vy,
        z: 0,
      });
      world.addComponent<Particle>(id, 'Particle', {
        effect: event.effect,
        totalLifetime: config.lifetime,
        remainingLifetime: config.lifetime,
        sizeStart: config.sizeStart,
        sizeEnd: config.sizeEnd,
        colorStart,
        colorEnd,
        opacity: 1.0,
        gravity: config.gravity,
      });
    }
  }

  // 2. Update all active particles
  if (dt <= 0) return;

  const particleEntities = world.query(['Particle', 'Position', 'Velocity']);
  const toDestroy: number[] = [];

  for (const id of particleEntities) {
    const particle = world.getComponent<Particle>(id, 'Particle')!;
    const pos = world.getComponent<Position>(id, 'Position')!;
    const vel = world.getComponent<Velocity>(id, 'Velocity')!;

    // Apply gravity to velocity (downward = negative y)
    if (particle.gravity !== 0) {
      vel.y -= particle.gravity * dt;
    }

    // Update position
    pos.x += vel.x * dt;
    pos.y += vel.y * dt;
    pos.z += vel.z * dt;

    // Decrement lifetime
    particle.remainingLifetime -= dt;

    // Interpolation factor: 0 at start, 1 at end
    const elapsed = particle.totalLifetime - particle.remainingLifetime;
    const t = Math.min(Math.max(elapsed / particle.totalLifetime, 0), 1);

    // Interpolate size
    // Size is stored via the Particle component for the renderer to read
    // (sizeStart + (sizeEnd - sizeStart) * t) — computed by renderer

    // Interpolate opacity: 1.0 → 0.0
    particle.opacity = 1.0 - t;

    if (particle.remainingLifetime <= 0) {
      toDestroy.push(id);
    }
  }

  for (const id of toDestroy) {
    world.destroyEntity(id);
  }
}
