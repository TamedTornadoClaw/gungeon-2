import * as THREE from 'three';
import { MeshId } from '../ecs/components';
import type { Position, PreviousPosition, Renderable } from '../ecs/components';
import type { World } from '../ecs/world';
import { getDesignParams } from '../config/designParams';
import type { SceneManager } from './sceneManager';
import { getMeshDef } from './sceneManager';

// ── Types ───────────────────────────────────────────────────────────────────

/** MeshIds that use instanced rendering (high-count entity types) */
const INSTANCED_MESH_IDS: ReadonlyArray<MeshId> = [
  MeshId.Bullet,
  MeshId.EnemyBullet,
  MeshId.XPGem,
  MeshId.HealthPickup,
  MeshId.Currency,
  MeshId.GunPickupGlow,
  MeshId.KnifeRusher,
  MeshId.ShieldGun,
  MeshId.Shotgunner,
  MeshId.Rifleman,
  MeshId.SuicideBomber,
  MeshId.Wall,
  MeshId.Floor,
  MeshId.FireHazard,
  MeshId.SpikeHazard,
  MeshId.WaterHazard,
];

export interface InstancedRenderer {
  /** Update all instanced meshes from ECS state. Call once per render frame.
   *  @param alpha Interpolation factor [0,1) between PreviousPosition and Position */
  update(world: World, alpha?: number): void;
  /** Get the current active instance count for a mesh type */
  getInstanceCount(meshId: MeshId): number;
  /** Check whether a MeshId uses instanced rendering */
  isInstanced(meshId: MeshId): boolean;
  /** Clean up all instanced meshes */
  dispose(): void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parseHexColor(hex: string): number {
  return parseInt(hex.replace('0x', ''), 16);
}

function getMaxInstances(meshId: MeshId): number {
  const { sceneMeshes } = getDesignParams();
  const name = MeshId[meshId];
  return sceneMeshes.poolSizes[name] ?? sceneMeshes.defaultPoolSize;
}

function getColor(meshId: MeshId): THREE.Color {
  const { sceneMeshes } = getDesignParams();
  const name = MeshId[meshId];
  return new THREE.Color(parseHexColor(sceneMeshes.colors[name]));
}

// ── Procedural Textures ──────────────────────────────────────────────────────

function createBrickTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill with base mortar color
  ctx.fillStyle = '#888888';
  ctx.fillRect(0, 0, size, size);

  const brickH = 16;
  const brickW = 32;
  const mortarSize = 2;
  const rows = Math.ceil(size / brickH);
  const cols = Math.ceil(size / brickW) + 1;

  for (let row = 0; row < rows; row++) {
    const offset = row % 2 === 1 ? brickW / 2 : 0;
    for (let col = -1; col < cols; col++) {
      // Per-brick color variation
      const variation = Math.floor(Math.random() * 30) - 15;
      const r = Math.min(255, Math.max(0, 140 + variation));
      const g = Math.min(255, Math.max(0, 100 + variation));
      const b = Math.min(255, Math.max(0, 80 + variation));
      ctx.fillStyle = `rgb(${r},${g},${b})`;

      const x = col * brickW + offset + mortarSize;
      const y = row * brickH + mortarSize;
      const w = brickW - mortarSize * 2;
      const h = brickH - mortarSize * 2;
      ctx.fillRect(x, y, w, h);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 3);
  return texture;
}

function createTileTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;

  const size = 128;
  const tileSize = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Fill background
  ctx.fillStyle = '#444444';
  ctx.fillRect(0, 0, size, size);

  const tiles = size / tileSize;
  for (let row = 0; row < tiles; row++) {
    for (let col = 0; col < tiles; col++) {
      // Per-tile color variation
      const variation = Math.floor(Math.random() * 20) - 10;
      const r = Math.min(255, Math.max(0, 68 + variation));
      const g = Math.min(255, Math.max(0, 68 + variation));
      const b = Math.min(255, Math.max(0, 68 + variation));
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(col * tileSize + 1, row * tileSize + 1, tileSize - 2, tileSize - 2);
    }
  }

  // Draw grid lines
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1;
  for (let i = 0; i <= tiles; i++) {
    ctx.beginPath();
    ctx.moveTo(i * tileSize, 0);
    ctx.lineTo(i * tileSize, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * tileSize);
    ctx.lineTo(size, i * tileSize);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ── Factory ─────────────────────────────────────────────────────────────────

export function createInstancedRenderer(sceneManager: SceneManager): InstancedRenderer {
  const instancedMeshes = new Map<MeshId, THREE.InstancedMesh>();
  const instancedSet = new Set<MeshId>(INSTANCED_MESH_IDS);
  const activeCounts = new Map<MeshId, number>();
  const tempMatrix = new THREE.Matrix4();

  // Create InstancedMesh for each instanced type
  for (const meshId of INSTANCED_MESH_IDS) {
    const maxCount = getMaxInstances(meshId);
    const def = getMeshDef(meshId);
    const geometry = def.geometry();
    const material = createInstanceMaterial(meshId);

    const instancedMesh = new THREE.InstancedMesh(geometry, material, maxCount);
    instancedMesh.count = 0;
    instancedMesh.name = `Instanced_${MeshId[meshId]}`;
    instancedMesh.frustumCulled = false;

    // Set default instance colors
    const color = getColor(meshId);
    for (let i = 0; i < maxCount; i++) {
      instancedMesh.setColorAt(i, color);
    }
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }

    // Add to appropriate scene group
    const group = isDungeonMesh(meshId)
      ? sceneManager.dungeonGroup
      : sceneManager.entityGroup;
    group.add(instancedMesh);

    instancedMeshes.set(meshId, instancedMesh);
    activeCounts.set(meshId, 0);
  }

  function createInstanceMaterial(meshId: MeshId): THREE.Material {
    const { sceneMeshes } = getDesignParams();
    const name = MeshId[meshId];
    const colorHex = parseHexColor(sceneMeshes.colors[name]);

    const params: THREE.MeshToonMaterialParameters = {
      color: colorHex,
    };

    const emissiveEntry = sceneMeshes.emissive[name];
    if (emissiveEntry) {
      params.emissive = parseHexColor(emissiveEntry.color);
      params.emissiveIntensity = emissiveEntry.intensity;
    }

    const transparencyEntry = sceneMeshes.transparency[name];
    if (transparencyEntry) {
      params.transparent = true;
      params.opacity = transparencyEntry.opacity;
    }

    // Apply procedural textures
    if (meshId === MeshId.Wall) {
      const brickTex = createBrickTexture();
      if (brickTex) {
        params.map = brickTex;
      }
    } else if (meshId === MeshId.Floor) {
      const tileTex = createTileTexture();
      if (tileTex) {
        params.map = tileTex;
      }
    }

    return new THREE.MeshToonMaterial(params);
  }

  function isDungeonMesh(meshId: MeshId): boolean {
    return (
      meshId === MeshId.Wall ||
      meshId === MeshId.Floor ||
      meshId === MeshId.FireHazard ||
      meshId === MeshId.SpikeHazard ||
      meshId === MeshId.WaterHazard
    );
  }

  function update(world: World, alpha: number = 1): void {
    // Query all entities with Position and Renderable
    const entities = world.query(['Position', 'Renderable']);

    // Group entities by meshId
    const groups = new Map<MeshId, Array<{ x: number; y: number; z: number; scaleX: number; scaleY: number; scaleZ: number }>>();
    for (const meshId of INSTANCED_MESH_IDS) {
      groups.set(meshId, []);
    }

    for (const entityId of entities) {
      const renderable = world.getComponent(entityId, 'Renderable') as Renderable | undefined;
      if (!renderable || !renderable.visible) continue;
      if (!instancedSet.has(renderable.meshId)) continue;

      const pos = world.getComponent(entityId, 'Position') as Position | undefined;
      if (!pos) continue;

      // Interpolate with PreviousPosition if available
      const prev = world.getComponent(entityId, 'PreviousPosition') as PreviousPosition | undefined;
      const x = prev ? prev.x + (pos.x - prev.x) * alpha : pos.x;
      const y = prev ? prev.y + (pos.y - prev.y) * alpha : pos.y;
      const z = prev ? prev.z + (pos.z - prev.z) * alpha : pos.z;

      const group = groups.get(renderable.meshId);
      if (group) {
        group.push({
          x, y, z,
          scaleX: renderable.scaleX ?? renderable.scale,
          scaleY: renderable.scale,
          scaleZ: renderable.scaleZ ?? renderable.scale,
        });
      }
    }

    // Update each instanced mesh
    for (const meshId of INSTANCED_MESH_IDS) {
      const instancedMesh = instancedMeshes.get(meshId)!;
      const entityData = groups.get(meshId)!;
      const count = Math.min(entityData.length, instancedMesh.instanceMatrix.count);

      for (let i = 0; i < count; i++) {
        const data = entityData[i];
        tempMatrix.makeScale(data.scaleX, data.scaleY, data.scaleZ);
        tempMatrix.setPosition(data.x, data.y, data.z);
        instancedMesh.setMatrixAt(i, tempMatrix);
      }

      instancedMesh.count = count;
      if (count > 0) {
        instancedMesh.instanceMatrix.needsUpdate = true;
      }

      activeCounts.set(meshId, count);
    }
  }

  function getInstanceCount(meshId: MeshId): number {
    return activeCounts.get(meshId) ?? 0;
  }

  function isInstanced(meshId: MeshId): boolean {
    return instancedSet.has(meshId);
  }

  function dispose(): void {
    for (const [meshId, instancedMesh] of instancedMeshes) {
      instancedMesh.geometry.dispose();
      if (Array.isArray(instancedMesh.material)) {
        instancedMesh.material.forEach((m) => m.dispose());
      } else {
        (instancedMesh.material as THREE.Material).dispose();
      }

      const group = isDungeonMesh(meshId)
        ? sceneManager.dungeonGroup
        : sceneManager.entityGroup;
      group.remove(instancedMesh);
    }

    instancedMeshes.clear();
    activeCounts.clear();
  }

  return {
    update,
    getInstanceCount,
    isInstanced,
    dispose,
  };
}
