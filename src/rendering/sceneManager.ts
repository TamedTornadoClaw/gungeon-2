import * as THREE from 'three';
import { MeshId } from '../ecs/components';
import { createOutlineMesh } from './outlineMesh';

// ── Mesh Definitions ───────────────────────────────────────────────────────

interface MeshDef {
  geometry: () => THREE.BufferGeometry;
  color: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  /** If true, skip toon material and use MeshBasicMaterial (for outlines, glow, etc.) */
  useBasicMaterial?: boolean;
  /** If true, skip outline mesh generation */
  noOutline?: boolean;
  /** Child mesh definitions (e.g., shield on ShieldGun, gun on Player) */
  children?: MeshDef[];
}

const MESH_DEFS: Record<MeshId, MeshDef> = {
  // ── Characters ──
  [MeshId.Player]: {
    geometry: () => new THREE.BoxGeometry(1, 2, 1),
    color: 0x2255ff,
  },
  [MeshId.KnifeRusher]: {
    geometry: () => new THREE.BoxGeometry(0.8, 1.5, 0.8),
    color: 0xff2222,
  },
  [MeshId.ShieldGun]: {
    geometry: () => new THREE.BoxGeometry(1, 2, 1),
    color: 0x22cc44,
  },
  [MeshId.Shotgunner]: {
    geometry: () => new THREE.BoxGeometry(1.2, 2, 1.2),
    color: 0xff8800,
  },
  [MeshId.Rifleman]: {
    geometry: () => new THREE.BoxGeometry(0.8, 2, 0.8),
    color: 0x8822cc,
  },
  [MeshId.SuicideBomber]: {
    geometry: () => new THREE.SphereGeometry(0.6, 16, 16),
    color: 0xffdd00,
  },
  // ── Mini-bosses (same shape as base, darker, 1.5x scale applied at acquire) ──
  [MeshId.MiniBossKnifeRusher]: {
    geometry: () => new THREE.BoxGeometry(0.8, 1.5, 0.8),
    color: 0xaa1111,
  },
  [MeshId.MiniBossShieldGun]: {
    geometry: () => new THREE.BoxGeometry(1, 2, 1),
    color: 0x118833,
  },
  [MeshId.MiniBossShotgunner]: {
    geometry: () => new THREE.BoxGeometry(1.2, 2, 1.2),
    color: 0xaa5500,
  },
  [MeshId.MiniBossRifleman]: {
    geometry: () => new THREE.BoxGeometry(0.8, 2, 0.8),
    color: 0x551199,
  },
  [MeshId.MiniBossSuicideBomber]: {
    geometry: () => new THREE.SphereGeometry(0.6, 16, 16),
    color: 0xaa9900,
  },
  [MeshId.Boss]: {
    geometry: () => new THREE.BoxGeometry(2, 3, 2),
    color: 0x881111,
  },
  // ── Weapons ──
  [MeshId.Pistol]: {
    geometry: () => new THREE.BoxGeometry(0.1, 0.1, 0.3),
    color: 0x444444,
  },
  [MeshId.SMG]: {
    geometry: () => new THREE.BoxGeometry(0.1, 0.1, 0.4),
    color: 0x666666,
  },
  [MeshId.AssaultRifle]: {
    geometry: () => new THREE.BoxGeometry(0.1, 0.1, 0.5),
    color: 0x666666,
  },
  [MeshId.Shotgun]: {
    geometry: () => new THREE.BoxGeometry(0.15, 0.1, 0.5),
    color: 0x666666,
  },
  [MeshId.LMG]: {
    geometry: () => new THREE.BoxGeometry(0.15, 0.15, 0.6),
    color: 0x666666,
  },
  // ── Projectiles ──
  [MeshId.Bullet]: {
    geometry: () => new THREE.SphereGeometry(0.05, 8, 8),
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 1,
    noOutline: true,
  },
  [MeshId.EnemyBullet]: {
    geometry: () => new THREE.SphereGeometry(0.05, 8, 8),
    color: 0xff0000,
    emissive: 0xff0000,
    emissiveIntensity: 1,
    noOutline: true,
  },
  // ── Pickups ──
  [MeshId.XPGem]: {
    geometry: () => new THREE.OctahedronGeometry(0.15),
    color: 0x00ffff,
    emissive: 0x00ffff,
    emissiveIntensity: 0.5,
    noOutline: true,
  },
  [MeshId.HealthPickup]: {
    geometry: () => createCrossGeometry(),
    color: 0x22ff22,
  },
  [MeshId.Currency]: {
    geometry: () => new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16),
    color: 0xffd700,
  },
  [MeshId.GunPickupGlow]: {
    geometry: () => new THREE.TorusGeometry(0.3, 0.05, 8, 24),
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 1,
    noOutline: true,
  },
  // ── Dungeon ──
  [MeshId.Wall]: {
    geometry: () => new THREE.BoxGeometry(1, 2, 1),
    color: 0x888888,
  },
  [MeshId.Floor]: {
    geometry: () => new THREE.PlaneGeometry(1, 1),
    color: 0x444444,
    noOutline: true,
  },
  [MeshId.Pit]: {
    geometry: () => new THREE.PlaneGeometry(1, 1),
    color: 0x111111,
    noOutline: true,
  },
  [MeshId.FireHazard]: {
    geometry: () => new THREE.PlaneGeometry(1, 1),
    color: 0xff4400,
    emissive: 0xff4400,
    emissiveIntensity: 0.5,
    noOutline: true,
  },
  [MeshId.SpikeHazard]: {
    geometry: () => new THREE.PlaneGeometry(1, 1),
    color: 0x999999,
    noOutline: true,
  },
  [MeshId.WaterHazard]: {
    geometry: () => new THREE.PlaneGeometry(1, 1),
    color: 0x2266ff,
    transparent: true,
    opacity: 0.6,
    noOutline: true,
  },
  // ── Destructibles ──
  [MeshId.Crate]: {
    geometry: () => new THREE.BoxGeometry(1, 1, 1),
    color: 0x8b6914,
  },
  [MeshId.Pillar]: {
    geometry: () => new THREE.CylinderGeometry(0.4, 0.4, 2, 12),
    color: 0x999999,
  },
  [MeshId.Barrel]: {
    geometry: () => new THREE.CylinderGeometry(0.4, 0.4, 1, 12),
    color: 0x8b5a2b,
  },
  // ── Interactables ──
  [MeshId.Door]: {
    geometry: () => new THREE.BoxGeometry(1, 2, 0.2),
    color: 0x8b6914,
  },
  [MeshId.Chest]: {
    geometry: () => new THREE.BoxGeometry(0.8, 0.6, 0.6),
    color: 0x8b6914,
  },
  [MeshId.Shop]: {
    geometry: () => new THREE.BoxGeometry(2, 2, 2),
    color: 0x008888,
  },
  [MeshId.Stairs]: {
    geometry: () => createStairsGeometry(),
    color: 0x888888,
  },
  // ── Enemy shield ──
  [MeshId.EnemyShieldMesh]: {
    geometry: () => new THREE.PlaneGeometry(1.2, 1.8),
    color: 0x667788,
  },
};

// ── Helper geometry generators ─────────────────────────────────────────────

function createCrossGeometry(): THREE.BufferGeometry {
  const vertical = new THREE.BoxGeometry(0.1, 0.3, 0.1);
  const horizontal = new THREE.BoxGeometry(0.3, 0.1, 0.1);
  const merged = new THREE.BufferGeometry();
  // Merge two box geometries by combining their attributes
  const vPos = vertical.getAttribute('position');
  const hPos = horizontal.getAttribute('position');
  const vIdx = vertical.getIndex();
  const hIdx = horizontal.getIndex();

  if (!vIdx || !hIdx) {
    return vertical;
  }

  const totalVerts = vPos.count + hPos.count;
  const positions = new Float32Array(totalVerts * 3);
  positions.set(new Float32Array(vPos.array), 0);
  positions.set(new Float32Array(hPos.array), vPos.count * 3);

  const vIndices = Array.from(vIdx.array);
  const hIndices = Array.from(hIdx.array).map((i) => i + vPos.count);
  const indices = [...vIndices, ...hIndices];

  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setIndex(indices);
  merged.computeVertexNormals();

  vertical.dispose();
  horizontal.dispose();

  return merged;
}

function createStairsGeometry(): THREE.BufferGeometry {
  // Simple stepped geometry: 4 steps
  const steps: THREE.BoxGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const step = new THREE.BoxGeometry(1, 0.25, 0.25);
    step.translate(0, i * 0.25 + 0.125, -i * 0.25);
    steps.push(step);
  }

  // Merge all step geometries
  const allPositions: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  for (const step of steps) {
    const pos = step.getAttribute('position');
    const idx = step.getIndex();
    if (!idx) continue;

    for (let i = 0; i < pos.count * 3; i++) {
      allPositions.push(pos.array[i] as number);
    }
    for (let i = 0; i < idx.count; i++) {
      allIndices.push((idx.array[i] as number) + vertexOffset);
    }
    vertexOffset += pos.count;
    step.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute(
    'position',
    new THREE.BufferAttribute(new Float32Array(allPositions), 3),
  );
  merged.setIndex(allIndices);
  merged.computeVertexNormals();
  return merged;
}

// ── Material factory ───────────────────────────────────────────────────────

function createMaterial(def: MeshDef): THREE.Material {
  if (def.useBasicMaterial) {
    return new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: def.transparent,
      opacity: def.opacity ?? 1,
    });
  }

  const params: THREE.MeshToonMaterialParameters = {
    color: def.color,
    emissive: def.emissive ?? 0x000000,
    emissiveIntensity: def.emissiveIntensity ?? 0,
  };
  if (def.transparent) {
    params.transparent = true;
    params.opacity = def.opacity ?? 1;
  }
  return new THREE.MeshToonMaterial(params);
}

// ── Mesh creation ──────────────────────────────────────────────────────────

function createMeshFromDef(def: MeshDef): THREE.Mesh {
  const geometry = def.geometry();
  const material = createMaterial(def);
  const mesh = new THREE.Mesh(geometry, material);

  if (!def.noOutline) {
    const outline = createOutlineMesh(mesh);
    mesh.add(outline);
  }

  return mesh;
}

// ── Object Pool ────────────────────────────────────────────────────────────

const DEFAULT_POOL_SIZES: Partial<Record<MeshId, number>> = {
  [MeshId.Bullet]: 100,
  [MeshId.EnemyBullet]: 50,
  [MeshId.XPGem]: 50,
  [MeshId.HealthPickup]: 10,
  [MeshId.Currency]: 20,
  [MeshId.KnifeRusher]: 15,
  [MeshId.ShieldGun]: 10,
  [MeshId.Shotgunner]: 10,
  [MeshId.Rifleman]: 10,
  [MeshId.SuicideBomber]: 10,
  [MeshId.Wall]: 200,
  [MeshId.Floor]: 200,
  [MeshId.Crate]: 20,
  [MeshId.Pillar]: 10,
  [MeshId.Barrel]: 10,
};

const DEFAULT_PREALLOC = 2;

export interface SceneManager {
  scene: THREE.Scene;
  dungeonGroup: THREE.Group;
  entityGroup: THREE.Group;
  effectsGroup: THREE.Group;
  acquireMesh(meshId: MeshId): THREE.Mesh;
  releaseMesh(meshId: MeshId, mesh: THREE.Mesh): void;
  getPoolStats(): Record<MeshId, { available: number; inUse: number }>;
  dispose(): void;
}

export function createSceneManager(scene: THREE.Scene): SceneManager {
  const pools = new Map<MeshId, THREE.Mesh[]>();
  const inUseCounts = new Map<MeshId, number>();

  // Scene graph groups
  const dungeonGroup = new THREE.Group();
  dungeonGroup.name = 'DungeonGroup';
  const entityGroup = new THREE.Group();
  entityGroup.name = 'EntityGroup';
  const effectsGroup = new THREE.Group();
  effectsGroup.name = 'EffectsGroup';

  scene.add(dungeonGroup);
  scene.add(entityGroup);
  scene.add(effectsGroup);

  // Initialize pools
  const allMeshIds = Object.values(MeshId).filter(
    (v) => typeof v === 'number',
  ) as MeshId[];

  for (const meshId of allMeshIds) {
    pools.set(meshId, []);
    inUseCounts.set(meshId, 0);
  }

  // Pre-allocate
  for (const meshId of allMeshIds) {
    const count = DEFAULT_POOL_SIZES[meshId] ?? DEFAULT_PREALLOC;
    const pool = pools.get(meshId)!;
    for (let i = 0; i < count; i++) {
      const mesh = createMeshFromDef(MESH_DEFS[meshId]);
      mesh.visible = false;
      pool.push(mesh);
    }
  }

  function acquireMesh(meshId: MeshId): THREE.Mesh {
    const pool = pools.get(meshId)!;
    let mesh: THREE.Mesh;

    if (pool.length > 0) {
      mesh = pool.pop()!;
    } else {
      mesh = createMeshFromDef(MESH_DEFS[meshId]);
    }

    mesh.visible = true;
    inUseCounts.set(meshId, (inUseCounts.get(meshId) ?? 0) + 1);
    return mesh;
  }

  function releaseMesh(meshId: MeshId, mesh: THREE.Mesh): void {
    mesh.visible = false;
    mesh.position.set(0, 0, 0);
    mesh.rotation.set(0, 0, 0);
    mesh.scale.set(1, 1, 1);

    const pool = pools.get(meshId)!;
    pool.push(mesh);

    const count = inUseCounts.get(meshId) ?? 0;
    inUseCounts.set(meshId, Math.max(0, count - 1));
  }

  function getPoolStats(): Record<MeshId, { available: number; inUse: number }> {
    const stats = {} as Record<MeshId, { available: number; inUse: number }>;
    for (const meshId of allMeshIds) {
      stats[meshId] = {
        available: pools.get(meshId)!.length,
        inUse: inUseCounts.get(meshId) ?? 0,
      };
    }
    return stats;
  }

  function dispose(): void {
    for (const [, pool] of pools) {
      for (const mesh of pool) {
        mesh.geometry.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          (mesh.material as THREE.Material).dispose();
        }
      }
      pool.length = 0;
    }

    scene.remove(dungeonGroup);
    scene.remove(entityGroup);
    scene.remove(effectsGroup);
  }

  return {
    scene,
    dungeonGroup,
    entityGroup,
    effectsGroup,
    acquireMesh,
    releaseMesh,
    getPoolStats,
    dispose,
  };
}

/**
 * Returns the MeshDef for a given MeshId. Useful for testing.
 */
export function getMeshDef(meshId: MeshId): MeshDef {
  return MESH_DEFS[meshId];
}

/**
 * Returns all MeshId values.
 */
export function getAllMeshIds(): MeshId[] {
  return Object.values(MeshId).filter((v) => typeof v === 'number') as MeshId[];
}
