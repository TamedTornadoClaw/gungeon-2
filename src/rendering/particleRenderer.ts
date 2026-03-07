import * as THREE from 'three';
import { ParticleEffect } from '../ecs/components';
import type { Position, Particle } from '../ecs/components';
import type { World } from '../ecs/world';
import { getParticleManifest } from '../config/particleManifest';
import type { SceneManager } from './sceneManager';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_PARTICLES_PER_TYPE = 64;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ParticleRenderer {
  update(world: World): void;
  getActiveCount(): number;
  dispose(): void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseHexColor(hex: string): number {
  return parseInt(hex.replace('0x', ''), 16);
}

function lerpColor(c1: number, c2: number, t: number): THREE.Color {
  const r1 = (c1 >> 16) & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = c1 & 0xff;
  const r2 = (c2 >> 16) & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = c2 & 0xff;

  return new THREE.Color(
    (r1 + (r2 - r1) * t) / 255,
    (g1 + (g2 - g1) * t) / 255,
    (b1 + (b2 - b1) * t) / 255,
  );
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createParticleRenderer(sceneManager: SceneManager): ParticleRenderer {
  const manifest = getParticleManifest();
  const instancedMeshes = new Map<ParticleEffect, THREE.InstancedMesh>();
  const tempMatrix = new THREE.Matrix4();
  let totalActiveCount = 0;

  // Get all ParticleEffect enum values
  const allEffects = Object.values(ParticleEffect).filter(
    (v) => typeof v === 'number',
  ) as ParticleEffect[];

  // Create one InstancedMesh per effect type
  for (const effect of allEffects) {
    const effectName = ParticleEffect[effect];
    const config = manifest[effectName];

    const geometry = new THREE.PlaneGeometry(1, 1);
    const isEmissive = config?.emissive ?? false;

    const material = new THREE.MeshBasicMaterial({
      color: config ? parseHexColor(config.colorStart) : 0xffffff,
      transparent: true,
      opacity: 1.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    if (isEmissive) {
      // MeshBasicMaterial doesn't have emissive, but it self-illuminates by default
      // which is the desired behavior for emissive particles
      material.toneMapped = false;
    }

    const instancedMesh = new THREE.InstancedMesh(
      geometry,
      material,
      MAX_PARTICLES_PER_TYPE,
    );
    instancedMesh.count = 0;
    instancedMesh.name = `Particle_${effectName}`;
    instancedMesh.frustumCulled = false;

    // Initialize instance colors
    const startColor = config
      ? new THREE.Color(parseHexColor(config.colorStart))
      : new THREE.Color(0xffffff);
    for (let i = 0; i < MAX_PARTICLES_PER_TYPE; i++) {
      instancedMesh.setColorAt(i, startColor);
    }
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }

    sceneManager.effectsGroup.add(instancedMesh);
    instancedMeshes.set(effect, instancedMesh);
  }

  function update(world: World): void {
    const particleEntities = world.query(['Particle', 'Position', 'Velocity']);

    // Group particles by effect type
    const groups = new Map<ParticleEffect, number[]>();
    for (const effect of allEffects) {
      groups.set(effect, []);
    }

    for (const entityId of particleEntities) {
      const particle = world.getComponent<Particle>(entityId, 'Particle');
      if (!particle) continue;
      const group = groups.get(particle.effect);
      if (group) {
        group.push(entityId);
      }
    }

    totalActiveCount = 0;

    for (const effect of allEffects) {
      const instancedMesh = instancedMeshes.get(effect)!;
      const entityIds = groups.get(effect)!;
      const count = Math.min(entityIds.length, MAX_PARTICLES_PER_TYPE);

      for (let i = 0; i < count; i++) {
        const entityId = entityIds[i];
        const particle = world.getComponent<Particle>(entityId, 'Particle')!;
        const pos = world.getComponent<Position>(entityId, 'Position')!;

        // Interpolation factor: 0 at start, 1 at end
        const elapsed = particle.totalLifetime - particle.remainingLifetime;
        const t = Math.min(Math.max(elapsed / particle.totalLifetime, 0), 1);

        // Interpolate size
        const size = particle.sizeStart + (particle.sizeEnd - particle.sizeStart) * t;

        // Set transform
        tempMatrix.makeScale(size, size, size);
        tempMatrix.setPosition(pos.x, pos.y, pos.z);
        instancedMesh.setMatrixAt(i, tempMatrix);

        // Interpolate color
        const color = lerpColor(particle.colorStart, particle.colorEnd, t);
        instancedMesh.setColorAt(i, color);
      }

      instancedMesh.count = count;
      if (count > 0) {
        instancedMesh.instanceMatrix.needsUpdate = true;
        if (instancedMesh.instanceColor) {
          instancedMesh.instanceColor.needsUpdate = true;
        }
      }

      // Update material opacity based on particles (use first particle's opacity for material)
      if (count > 0) {
        const firstParticle = world.getComponent<Particle>(entityIds[0], 'Particle')!;
        const mat = instancedMesh.material as THREE.MeshBasicMaterial;
        mat.opacity = firstParticle.opacity;
      }

      totalActiveCount += count;
    }
  }

  function getActiveCount(): number {
    return totalActiveCount;
  }

  function dispose(): void {
    for (const [, instancedMesh] of instancedMeshes) {
      instancedMesh.geometry.dispose();
      if (Array.isArray(instancedMesh.material)) {
        instancedMesh.material.forEach((m) => m.dispose());
      } else {
        (instancedMesh.material as THREE.Material).dispose();
      }
      sceneManager.effectsGroup.remove(instancedMesh);
    }
    instancedMeshes.clear();
    totalActiveCount = 0;
  }

  return {
    update,
    getActiveCount,
    dispose,
  };
}
