import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import { ParticleEffect } from '../src/ecs/components';
import type { Position, Velocity, Particle } from '../src/ecs/components';
import { World } from '../src/ecs/world';
import { createSceneManager, type SceneManager } from '../src/rendering/sceneManager';
import { createParticleRenderer, type ParticleRenderer } from '../src/rendering/particleRenderer';

let scene: THREE.Scene;
let sceneManager: SceneManager;
let particleRenderer: ParticleRenderer;
let world: World;

beforeEach(() => {
  scene = new THREE.Scene();
  sceneManager = createSceneManager(scene);
  particleRenderer = createParticleRenderer(sceneManager);
  world = new World();
});

afterEach(() => {
  particleRenderer.dispose();
  sceneManager.dispose();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function addParticleEntity(
  effect: ParticleEffect,
  x: number,
  y: number,
  z: number,
  opts?: Partial<{ totalLifetime: number; remainingLifetime: number; sizeStart: number; sizeEnd: number; colorStart: number; colorEnd: number; opacity: number; gravity: number }>,
): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y, z });
  world.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
  world.addComponent<Particle>(id, 'Particle', {
    effect,
    totalLifetime: opts?.totalLifetime ?? 1.0,
    remainingLifetime: opts?.remainingLifetime ?? 1.0,
    sizeStart: opts?.sizeStart ?? 0.3,
    sizeEnd: opts?.sizeEnd ?? 0.05,
    colorStart: opts?.colorStart ?? 0xffff00,
    colorEnd: opts?.colorEnd ?? 0xff8800,
    opacity: opts?.opacity ?? 1.0,
    gravity: opts?.gravity ?? 0,
  });
  return id;
}

function findParticleMesh(effect: ParticleEffect): THREE.InstancedMesh | undefined {
  const name = `Particle_${ParticleEffect[effect]}`;
  const found = sceneManager.effectsGroup.children.find((c) => c.name === name);
  if (found && found instanceof THREE.InstancedMesh) return found;
  return undefined;
}

// ── Instance tracking ──────────────────────────────────────────────────────

describe('active count tracking', () => {
  it('starts with zero active particles', () => {
    expect(particleRenderer.getActiveCount()).toBe(0);
  });

  it('tracks active count after update', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 1, 0, 0);
    addParticleEntity(ParticleEffect.MuzzleFlash, 2, 0, 0);
    addParticleEntity(ParticleEffect.BloodSplat, 3, 0, 0);

    particleRenderer.update(world);

    expect(particleRenderer.getActiveCount()).toBe(3);
  });

  it('count decreases when entities are destroyed', () => {
    const id1 = addParticleEntity(ParticleEffect.MuzzleFlash, 1, 0, 0);
    addParticleEntity(ParticleEffect.MuzzleFlash, 2, 0, 0);

    particleRenderer.update(world);
    expect(particleRenderer.getActiveCount()).toBe(2);

    world.destroyEntity(id1);
    particleRenderer.update(world);
    expect(particleRenderer.getActiveCount()).toBe(1);
  });

  it('tracks multiple effect types independently', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 1, 0, 0);
    addParticleEntity(ParticleEffect.MuzzleFlash, 2, 0, 0);
    addParticleEntity(ParticleEffect.BloodSplat, 3, 0, 0);
    addParticleEntity(ParticleEffect.Sparks, 4, 0, 0);

    particleRenderer.update(world);

    const muzzleMesh = findParticleMesh(ParticleEffect.MuzzleFlash);
    const bloodMesh = findParticleMesh(ParticleEffect.BloodSplat);
    const sparksMesh = findParticleMesh(ParticleEffect.Sparks);

    expect(muzzleMesh!.count).toBe(2);
    expect(bloodMesh!.count).toBe(1);
    expect(sparksMesh!.count).toBe(1);
    expect(particleRenderer.getActiveCount()).toBe(4);
  });
});

// ── Instanced rendering ────────────────────────────────────────────────────

describe('instanced rendering', () => {
  it('creates one InstancedMesh per ParticleEffect type', () => {
    const effectNames = Object.keys(ParticleEffect).filter((k) => isNaN(Number(k)));
    for (const name of effectNames) {
      const found = sceneManager.effectsGroup.children.find(
        (c) => c.name === `Particle_${name}`,
      );
      expect(found, `${name} should have an InstancedMesh`).toBeDefined();
      expect(found).toBeInstanceOf(THREE.InstancedMesh);
    }
  });

  it('all particle meshes are in effectsGroup', () => {
    const particleChildren = sceneManager.effectsGroup.children.filter(
      (c) => c.name.startsWith('Particle_'),
    );
    const effectCount = Object.keys(ParticleEffect).filter((k) => isNaN(Number(k))).length;
    expect(particleChildren.length).toBe(effectCount);
  });
});

// ── Position from matrix ────────────────────────────────────────────────────

describe('position updates', () => {
  it('sets instance matrix position from entity Position', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 5, 10, 15);

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    expect(mesh.count).toBe(1);

    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);

    expect(position.x).toBeCloseTo(5);
    expect(position.y).toBeCloseTo(10);
    expect(position.z).toBeCloseTo(15);
  });

  it('updates positions when entities move', () => {
    const id = addParticleEntity(ParticleEffect.Sparks, 1, 2, 3);

    particleRenderer.update(world);

    const pos = world.getComponent<Position>(id, 'Position')!;
    pos.x = 10;
    pos.y = 20;
    pos.z = 30;

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.Sparks)!;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);

    expect(position.x).toBeCloseTo(10);
    expect(position.y).toBeCloseTo(20);
    expect(position.z).toBeCloseTo(30);
  });
});

// ── Size interpolation ──────────────────────────────────────────────────────

describe('size interpolation', () => {
  it('applies sizeStart at the beginning of lifetime', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 0, 0, 0, {
      totalLifetime: 1.0,
      remainingLifetime: 1.0,
      sizeStart: 0.5,
      sizeEnd: 0.1,
    });

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);

    const scale = new THREE.Vector3();
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

    expect(scale.x).toBeCloseTo(0.5);
    expect(scale.y).toBeCloseTo(0.5);
  });

  it('interpolates size toward sizeEnd as lifetime decreases', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 0, 0, 0, {
      totalLifetime: 1.0,
      remainingLifetime: 0.5, // halfway through
      sizeStart: 1.0,
      sizeEnd: 0.0,
    });

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);

    const scale = new THREE.Vector3();
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

    // At t=0.5, size should be lerp(1.0, 0.0, 0.5) = 0.5
    expect(scale.x).toBeCloseTo(0.5);
  });

  it('reaches sizeEnd at end of lifetime', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 0, 0, 0, {
      totalLifetime: 1.0,
      remainingLifetime: 0.0, // at the end
      sizeStart: 0.5,
      sizeEnd: 0.1,
    });

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(0, matrix);

    const scale = new THREE.Vector3();
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

    expect(scale.x).toBeCloseTo(0.1);
  });
});

// ── Color interpolation ─────────────────────────────────────────────────────

describe('color interpolation', () => {
  it('uses colorStart at beginning of lifetime', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 0, 0, 0, {
      totalLifetime: 1.0,
      remainingLifetime: 1.0,
      colorStart: 0xff0000,
      colorEnd: 0x0000ff,
    });

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    const color = new THREE.Color();
    mesh.getColorAt(0, color);

    // At t=0, color should be red
    expect(color.r).toBeCloseTo(1.0);
    expect(color.g).toBeCloseTo(0.0);
    expect(color.b).toBeCloseTo(0.0);
  });

  it('interpolates color at midpoint', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 0, 0, 0, {
      totalLifetime: 1.0,
      remainingLifetime: 0.5,
      colorStart: 0xff0000,
      colorEnd: 0x0000ff,
    });

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    const color = new THREE.Color();
    mesh.getColorAt(0, color);

    // At t=0.5, red and blue should be roughly equal
    expect(color.r).toBeCloseTo(0.5, 1);
    expect(color.b).toBeCloseTo(0.5, 1);
  });

  it('reaches colorEnd at end of lifetime', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 0, 0, 0, {
      totalLifetime: 1.0,
      remainingLifetime: 0.0,
      colorStart: 0xff0000,
      colorEnd: 0x0000ff,
    });

    particleRenderer.update(world);

    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    const color = new THREE.Color();
    mesh.getColorAt(0, color);

    expect(color.r).toBeCloseTo(0.0);
    expect(color.b).toBeCloseTo(1.0);
  });
});

// ── Emissive particles ──────────────────────────────────────────────────────

describe('emissive particles', () => {
  it('MuzzleFlash uses a material without tone mapping (emissive look)', () => {
    const mesh = findParticleMesh(ParticleEffect.MuzzleFlash)!;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    // Emissive particles have toneMapped=false for bright appearance
    expect(mat.toneMapped).toBe(false);
  });

  it('BloodSplat uses default tone mapping (non-emissive)', () => {
    const mesh = findParticleMesh(ParticleEffect.BloodSplat)!;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    expect(mat.toneMapped).toBe(true);
  });
});

// ── Cleanup ─────────────────────────────────────────────────────────────────

describe('cleanup', () => {
  it('dispose removes all particle meshes from effectsGroup', () => {
    const particleChildren = sceneManager.effectsGroup.children.filter(
      (c) => c.name.startsWith('Particle_'),
    );
    expect(particleChildren.length).toBeGreaterThan(0);

    particleRenderer.dispose();

    const remaining = sceneManager.effectsGroup.children.filter(
      (c) => c.name.startsWith('Particle_'),
    );
    expect(remaining.length).toBe(0);
  });

  it('getActiveCount returns 0 after dispose', () => {
    addParticleEntity(ParticleEffect.MuzzleFlash, 1, 0, 0);
    particleRenderer.update(world);
    expect(particleRenderer.getActiveCount()).toBe(1);

    particleRenderer.dispose();
    expect(particleRenderer.getActiveCount()).toBe(0);
  });
});

// ── Pool overflow ──────────────────────────────────────────────────────────

describe('pool overflow', () => {
  it('does not crash when particle count exceeds pool max and clamps to 64', () => {
    const overCount = 80;
    for (let i = 0; i < overCount; i++) {
      addParticleEntity(ParticleEffect.Explosion, i, 0, 0);
    }

    expect(() => particleRenderer.update(world)).not.toThrow();

    const mesh = findParticleMesh(ParticleEffect.Explosion)!;
    expect(mesh.count).toBe(64);
  });
});

// ── Property-based tests ────────────────────────────────────────────────────

describe('property-based: particle count and positions', () => {
  it('active count matches spawned particle count', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            x: fc.float({ min: -100, max: 100, noNaN: true }),
            y: fc.float({ min: -100, max: 100, noNaN: true }),
            z: fc.float({ min: -100, max: 100, noNaN: true }),
          }),
          { minLength: 0, maxLength: 50 },
        ),
        (particles) => {
          const s = new THREE.Scene();
          const sm = createSceneManager(s);
          const pr = createParticleRenderer(sm);
          const w = new World();

          for (const p of particles) {
            const id = w.createEntity();
            w.addComponent<Position>(id, 'Position', { x: p.x, y: p.y, z: p.z });
            w.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
            w.addComponent<Particle>(id, 'Particle', {
              effect: ParticleEffect.MuzzleFlash,
              totalLifetime: 1.0,
              remainingLifetime: 1.0,
              sizeStart: 0.3,
              sizeEnd: 0.05,
              colorStart: 0xffff00,
              colorEnd: 0xff8800,
              opacity: 1.0,
              gravity: 0,
            });
          }

          pr.update(w);

          const expected = Math.min(particles.length, 64);
          expect(pr.getActiveCount()).toBe(expected);

          pr.dispose();
          sm.dispose();
        },
      ),
      { numRuns: 30 },
    );
  });

  it('size interpolation is always between sizeStart and sizeEnd', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(2.0), noNaN: true }),
        fc.float({ min: Math.fround(0.0), max: Math.fround(1.0), noNaN: true }),
        fc.float({ min: Math.fround(0.0), max: Math.fround(1.0), noNaN: true }),
        (sizeStart, sizeEnd, tFraction) => {
          const s = new THREE.Scene();
          const sm = createSceneManager(s);
          const pr = createParticleRenderer(sm);
          const w = new World();

          const totalLifetime = 1.0;
          const remainingLifetime = totalLifetime * (1.0 - tFraction);

          const id = w.createEntity();
          w.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
          w.addComponent<Velocity>(id, 'Velocity', { x: 0, y: 0, z: 0 });
          w.addComponent<Particle>(id, 'Particle', {
            effect: ParticleEffect.Sparks,
            totalLifetime,
            remainingLifetime,
            sizeStart,
            sizeEnd,
            colorStart: 0xffffff,
            colorEnd: 0x000000,
            opacity: 1.0,
            gravity: 0,
          });

          pr.update(w);

          const mesh = sm.effectsGroup.children.find(
            (c) => c.name === 'Particle_Sparks',
          ) as THREE.InstancedMesh;
          const matrix = new THREE.Matrix4();
          mesh.getMatrixAt(0, matrix);

          const scale = new THREE.Vector3();
          matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

          const minSize = Math.min(sizeStart, sizeEnd);
          const maxSize = Math.max(sizeStart, sizeEnd);

          expect(scale.x).toBeGreaterThanOrEqual(minSize - 0.01);
          expect(scale.x).toBeLessThanOrEqual(maxSize + 0.01);

          pr.dispose();
          sm.dispose();
        },
      ),
      { numRuns: 50 },
    );
  });
});
