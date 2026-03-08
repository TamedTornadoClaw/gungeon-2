import * as THREE from 'three';
import { MeshId } from '../ecs/components';
import { getDesignParams } from '../config/designParams';
import { createOutlineMesh } from './outlineMesh';

// ── Mesh Definitions ───────────────────────────────────────────────────────

interface MeshDef {
  geometry: () => THREE.BufferGeometry;
  color: number;
  emissive?: number;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  /** If true, skip outline mesh generation */
  noOutline?: boolean;
}

/** Child meshes attached to parent mesh types (hidden by default) */
const CHILD_MESH_IDS: Partial<Record<MeshId, MeshId[]>> = {
  [MeshId.Player]: [
    MeshId.Pistol,
    MeshId.SMG,
    MeshId.AssaultRifle,
    MeshId.Shotgun,
    MeshId.LMG,
  ],
  [MeshId.ShieldGun]: [MeshId.EnemyShieldMesh],
};

function parseHexColor(hex: string): number {
  return parseInt(hex.replace('0x', ''), 16);
}

/** Helper: create geometry with origin at its base (y=0) instead of center */
function baseOrigin(geo: THREE.BufferGeometry, height: number): THREE.BufferGeometry {
  geo.translate(0, height / 2, 0);
  return geo;
}

/** Geometry factories — origin at base (y=0) for all volumetric meshes */
const MESH_GEOMETRIES: Record<MeshId, () => THREE.BufferGeometry> = {
  [MeshId.Player]: () => baseOrigin(new THREE.BoxGeometry(1, 2, 1), 2),
  [MeshId.KnifeRusher]: () => baseOrigin(new THREE.BoxGeometry(0.8, 1.5, 0.8), 1.5),
  [MeshId.ShieldGun]: () => baseOrigin(new THREE.BoxGeometry(1, 2, 1), 2),
  [MeshId.Shotgunner]: () => baseOrigin(new THREE.BoxGeometry(1.2, 2, 1.2), 2),
  [MeshId.Rifleman]: () => baseOrigin(new THREE.BoxGeometry(1, 2, 1), 2),
  [MeshId.SuicideBomber]: () => baseOrigin(new THREE.SphereGeometry(0.6, 16, 16), 0.6),
  [MeshId.MiniBossKnifeRusher]: () => baseOrigin(new THREE.BoxGeometry(1.2, 2.2, 1.2), 2.2),
  [MeshId.MiniBossShieldGun]: () => baseOrigin(new THREE.BoxGeometry(1.4, 2.5, 1.4), 2.5),
  [MeshId.MiniBossShotgunner]: () => baseOrigin(new THREE.BoxGeometry(1.4, 2.5, 1.4), 2.5),
  [MeshId.MiniBossRifleman]: () => baseOrigin(new THREE.BoxGeometry(1.4, 2.5, 1.4), 2.5),
  [MeshId.MiniBossSuicideBomber]: () => baseOrigin(new THREE.BoxGeometry(1.2, 2, 1.2), 2),
  [MeshId.Boss]: () => baseOrigin(new THREE.BoxGeometry(2, 3, 2), 3),
  [MeshId.Pistol]: () => baseOrigin(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), 0.5),
  [MeshId.SMG]: () => baseOrigin(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), 0.6),
  [MeshId.AssaultRifle]: () => baseOrigin(new THREE.BoxGeometry(0.1, 0.1, 0.5), 0.1),
  [MeshId.Shotgun]: () => baseOrigin(new THREE.BoxGeometry(0.15, 0.1, 0.5), 0.1),
  [MeshId.LMG]: () => baseOrigin(new THREE.BoxGeometry(0.15, 0.15, 0.6), 0.15),
  [MeshId.Bullet]: () => baseOrigin(new THREE.SphereGeometry(0.05, 8, 8), 0.05),
  [MeshId.EnemyBullet]: () => baseOrigin(new THREE.SphereGeometry(0.05, 8, 8), 0.05),
  [MeshId.XPGem]: () => baseOrigin(new THREE.OctahedronGeometry(0.15), 0.15),
  [MeshId.HealthPickup]: () => { const g = createCrossGeometry(); g.translate(0, 0.15, 0); return g; },
  [MeshId.Currency]: () => baseOrigin(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 16), 0.05),
  [MeshId.GunPickupGlow]: () => baseOrigin(new THREE.TorusGeometry(0.3, 0.05, 8, 24), 0.05),
  [MeshId.Wall]: () => baseOrigin(new THREE.BoxGeometry(1, 3, 1), 3),
  [MeshId.Floor]: () => createXZPlaneGeometry(),
  [MeshId.Pit]: () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0.01, 0); return g; },
  [MeshId.FireHazard]: () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0.01, 0); return g; },
  [MeshId.SpikeHazard]: () => createSpikeHazardGeometry(),
  [MeshId.WaterHazard]: () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); g.translate(0, 0.01, 0); return g; },
  [MeshId.Crate]: () => baseOrigin(new THREE.BoxGeometry(0.5, 0.5, 0.5), 0.5),
  [MeshId.Pillar]: () => baseOrigin(new THREE.CylinderGeometry(0.4, 0.4, 2, 12), 2),
  [MeshId.Barrel]: () => baseOrigin(new THREE.CylinderGeometry(0.4, 0.4, 1, 12), 1),
  [MeshId.Door]: () => baseOrigin(new THREE.BoxGeometry(1, 1.5, 0.15), 1.5),
  [MeshId.Chest]: () => baseOrigin(new THREE.BoxGeometry(0.8, 0.6, 0.6), 0.6),
  [MeshId.Shop]: () => baseOrigin(new THREE.BoxGeometry(1, 1, 0.8), 1),
  [MeshId.Stairs]: () => createStairsGeometry(),
  [MeshId.EnemyShieldMesh]: () => { const g = new THREE.PlaneGeometry(0.5, 0.8); g.translate(0, 0.4, 0); return g; },
};

/** MeshIds that skip outline generation — structural, not tunable */
const NO_OUTLINE_MESHES = new Set<MeshId>([
  MeshId.Bullet,
  MeshId.EnemyBullet,
  MeshId.XPGem,
  MeshId.GunPickupGlow,
  MeshId.Floor,
  MeshId.Pit,
  MeshId.FireHazard,
  MeshId.WaterHazard,
]);

function buildMeshDefs(): Record<MeshId, MeshDef> {
  const { sceneMeshes } = getDesignParams();
  const defs = {} as Record<MeshId, MeshDef>;

  const allIds = Object.values(MeshId).filter(
    (v) => typeof v === 'number',
  ) as MeshId[];

  for (const meshId of allIds) {
    const name = MeshId[meshId];
    const def: MeshDef = {
      geometry: MESH_GEOMETRIES[meshId],
      color: parseHexColor(sceneMeshes.colors[name]),
    };

    const emissiveEntry = sceneMeshes.emissive[name];
    if (emissiveEntry) {
      def.emissive = parseHexColor(emissiveEntry.color);
      def.emissiveIntensity = emissiveEntry.intensity;
    }

    const transparencyEntry = sceneMeshes.transparency[name];
    if (transparencyEntry) {
      def.transparent = true;
      def.opacity = transparencyEntry.opacity;
    }

    if (NO_OUTLINE_MESHES.has(meshId)) {
      def.noOutline = true;
    }

    defs[meshId] = def;
  }

  return defs;
}

let _meshDefs: Record<MeshId, MeshDef> | null = null;
function getMeshDefs(): Record<MeshId, MeshDef> {
  if (_meshDefs === null) {
    _meshDefs = buildMeshDefs();
  }
  return _meshDefs;
}

// ── Helper geometry generators ─────────────────────────────────────────────

function createXZPlaneGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  // Two triangles forming a 1x1 quad in the XZ plane at y=0
  // CCW winding when viewed from above (+Y looking down)
  const positions = new Float32Array([
    -0.5, 0,  0.5,
     0.5, 0,  0.5,
     0.5, 0, -0.5,
    -0.5, 0,  0.5,
     0.5, 0, -0.5,
    -0.5, 0, -0.5,
  ]);
  const normals = new Float32Array([
    0, 1, 0,  0, 1, 0,  0, 1, 0,
    0, 1, 0,  0, 1, 0,  0, 1, 0,
  ]);
  const uvs = new Float32Array([
    0, 1,  1, 1,  1, 0,
    0, 1,  1, 0,  0, 0,
  ]);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

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

function createSpikeHazardGeometry(): THREE.BufferGeometry {
  // Gray plane with small pyramid spikes
  const plane = new THREE.PlaneGeometry(1, 1);
  plane.rotateX(-Math.PI / 2);

  const spikes: THREE.ConeGeometry[] = [];
  const offsets = [
    [-0.25, -0.25],
    [0.25, -0.25],
    [0, 0],
    [-0.25, 0.25],
    [0.25, 0.25],
  ];
  for (const [x, z] of offsets) {
    const spike = new THREE.ConeGeometry(0.08, 0.2, 4);
    spike.translate(x, 0.1, z);
    spikes.push(spike);
  }

  const allPositions: number[] = [];
  const allIndices: number[] = [];
  let vertexOffset = 0;

  for (const geo of [plane, ...spikes]) {
    const pos = geo.getAttribute('position');
    const idx = geo.getIndex();
    if (!idx) continue;

    for (let i = 0; i < pos.count * 3; i++) {
      allPositions.push(pos.array[i] as number);
    }
    for (let i = 0; i < idx.count; i++) {
      allIndices.push((idx.array[i] as number) + vertexOffset);
    }
    vertexOffset += pos.count;
    geo.dispose();
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

function createMeshFromDef(def: MeshDef, meshId?: MeshId): THREE.Mesh {
  const geometry = def.geometry();
  const material = createMaterial(def);
  const mesh = new THREE.Mesh(geometry, material);

  if (!def.noOutline) {
    const outline = createOutlineMesh(mesh);
    mesh.add(outline);
  }

  // Attach child meshes (hidden by default)
  if (meshId !== undefined) {
    const childIds = CHILD_MESH_IDS[meshId];
    if (childIds) {
      for (const childId of childIds) {
        const childDef = getMeshDefs()[childId];
        const childMesh = createMeshFromDef(childDef);
        childMesh.visible = false;
        childMesh.name = MeshId[childId];
        mesh.add(childMesh);
      }
    }
  }

  return mesh;
}

// ── Object Pool ────────────────────────────────────────────────────────────

function getPoolSize(meshId: MeshId): number {
  const { sceneMeshes } = getDesignParams();
  const name = MeshId[meshId];
  return sceneMeshes.poolSizes[name] ?? sceneMeshes.defaultPoolSize;
}

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
    const count = getPoolSize(meshId);
    const pool = pools.get(meshId)!;
    const meshDefs = getMeshDefs();
    for (let i = 0; i < count; i++) {
      const mesh = createMeshFromDef(meshDefs[meshId], meshId);
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
      mesh = createMeshFromDef(getMeshDefs()[meshId], meshId);
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

    // Hide all child meshes (weapons, shields, etc.)
    const childIds = CHILD_MESH_IDS[meshId];
    if (childIds) {
      for (const child of mesh.children) {
        if (child instanceof THREE.Mesh && child.name) {
          child.visible = false;
        }
      }
    }

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
  return getMeshDefs()[meshId];
}

/**
 * Returns all MeshId values.
 */
export function getAllMeshIds(): MeshId[] {
  return Object.values(MeshId).filter((v) => typeof v === 'number') as MeshId[];
}
