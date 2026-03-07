import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as THREE from 'three';
import { MeshId } from '../src/ecs/components';
import type { Position, Renderable } from '../src/ecs/components';
import { World } from '../src/ecs/world';
import { createSceneManager, type SceneManager } from '../src/rendering/sceneManager';
import { createInstancedRenderer, type InstancedRenderer } from '../src/rendering/instancedRenderer';

let scene: THREE.Scene;
let sceneManager: SceneManager;
let instancedRenderer: InstancedRenderer;
let world: World;

beforeEach(() => {
  scene = new THREE.Scene();
  sceneManager = createSceneManager(scene);
  instancedRenderer = createInstancedRenderer(sceneManager);
  world = new World();
});

afterEach(() => {
  instancedRenderer.dispose();
  sceneManager.dispose();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function addEntity(meshId: MeshId, x: number, y: number, z: number, visible = true, scale = 1): number {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { x, y, z });
  world.addComponent<Renderable>(id, 'Renderable', { meshId, visible, scale });
  return id;
}

// ── Instance tracking ──────────────────────────────────────────────────────

describe('instance count tracking', () => {
  it('starts with zero instances for all types', () => {
    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(0);
    expect(instancedRenderer.getInstanceCount(MeshId.Wall)).toBe(0);
    expect(instancedRenderer.getInstanceCount(MeshId.KnifeRusher)).toBe(0);
  });

  it('tracks instance count after update', () => {
    addEntity(MeshId.Bullet, 1, 0, 0);
    addEntity(MeshId.Bullet, 2, 0, 0);
    addEntity(MeshId.Bullet, 3, 0, 0);

    instancedRenderer.update(world);

    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(3);
  });

  it('count decreases when entities are destroyed', () => {
    const id1 = addEntity(MeshId.Bullet, 1, 0, 0);
    addEntity(MeshId.Bullet, 2, 0, 0);

    instancedRenderer.update(world);
    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(2);

    world.destroyEntity(id1);
    instancedRenderer.update(world);
    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(1);
  });

  it('invisible entities are not counted', () => {
    addEntity(MeshId.Bullet, 1, 0, 0, true);
    addEntity(MeshId.Bullet, 2, 0, 0, false);

    instancedRenderer.update(world);

    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(1);
  });

  it('tracks multiple mesh types independently', () => {
    addEntity(MeshId.Bullet, 1, 0, 0);
    addEntity(MeshId.Bullet, 2, 0, 0);
    addEntity(MeshId.XPGem, 5, 0, 0);
    addEntity(MeshId.Wall, 10, 0, 0);
    addEntity(MeshId.Wall, 11, 0, 0);
    addEntity(MeshId.Wall, 12, 0, 0);

    instancedRenderer.update(world);

    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(2);
    expect(instancedRenderer.getInstanceCount(MeshId.XPGem)).toBe(1);
    expect(instancedRenderer.getInstanceCount(MeshId.Wall)).toBe(3);
  });
});

// ── Matrix updates ─────────────────────────────────────────────────────────

describe('matrix updates', () => {
  it('sets instance matrix position from entity Position', () => {
    addEntity(MeshId.Bullet, 5, 10, 15);

    instancedRenderer.update(world);

    const instancedMesh = findInstancedMesh(MeshId.Bullet);
    expect(instancedMesh).toBeDefined();
    expect(instancedMesh!.count).toBe(1);

    const matrix = new THREE.Matrix4();
    instancedMesh!.getMatrixAt(0, matrix);

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);

    expect(position.x).toBeCloseTo(5);
    expect(position.y).toBeCloseTo(10);
    expect(position.z).toBeCloseTo(15);
  });

  it('applies scale from Renderable component', () => {
    addEntity(MeshId.XPGem, 0, 0, 0, true, 2.5);

    instancedRenderer.update(world);

    const instancedMesh = findInstancedMesh(MeshId.XPGem);
    const matrix = new THREE.Matrix4();
    instancedMesh!.getMatrixAt(0, matrix);

    const scale = new THREE.Vector3();
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);

    expect(scale.x).toBeCloseTo(2.5);
    expect(scale.y).toBeCloseTo(2.5);
    expect(scale.z).toBeCloseTo(2.5);
  });

  it('updates matrices when positions change', () => {
    const id = addEntity(MeshId.Bullet, 1, 2, 3);

    instancedRenderer.update(world);

    // Move entity
    const pos = world.getComponent<Position>(id, 'Position')!;
    pos.x = 10;
    pos.y = 20;
    pos.z = 30;

    instancedRenderer.update(world);

    const instancedMesh = findInstancedMesh(MeshId.Bullet);
    const matrix = new THREE.Matrix4();
    instancedMesh!.getMatrixAt(0, matrix);

    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);

    expect(position.x).toBeCloseTo(10);
    expect(position.y).toBeCloseTo(20);
    expect(position.z).toBeCloseTo(30);
  });
});

// ── Scene graph structure ──────────────────────────────────────────────────

describe('scene graph structure', () => {
  it('dungeon meshes are children of dungeonGroup', () => {
    const dungeonMeshIds = [MeshId.Wall, MeshId.Floor, MeshId.FireHazard, MeshId.SpikeHazard, MeshId.WaterHazard];
    for (const meshId of dungeonMeshIds) {
      const found = sceneManager.dungeonGroup.children.find(
        (c) => c.name === `Instanced_${MeshId[meshId]}`,
      );
      expect(found, `${MeshId[meshId]} should be in dungeonGroup`).toBeDefined();
    }
  });

  it('entity meshes are children of entityGroup', () => {
    const entityMeshIds = [MeshId.Bullet, MeshId.EnemyBullet, MeshId.XPGem, MeshId.KnifeRusher];
    for (const meshId of entityMeshIds) {
      const found = sceneManager.entityGroup.children.find(
        (c) => c.name === `Instanced_${MeshId[meshId]}`,
      );
      expect(found, `${MeshId[meshId]} should be in entityGroup`).toBeDefined();
    }
  });
});

// ── isInstanced ────────────────────────────────────────────────────────────

describe('isInstanced', () => {
  it('returns true for instanced mesh types', () => {
    expect(instancedRenderer.isInstanced(MeshId.Bullet)).toBe(true);
    expect(instancedRenderer.isInstanced(MeshId.Wall)).toBe(true);
    expect(instancedRenderer.isInstanced(MeshId.XPGem)).toBe(true);
    expect(instancedRenderer.isInstanced(MeshId.KnifeRusher)).toBe(true);
  });

  it('returns false for non-instanced mesh types', () => {
    expect(instancedRenderer.isInstanced(MeshId.Player)).toBe(false);
    expect(instancedRenderer.isInstanced(MeshId.Boss)).toBe(false);
    expect(instancedRenderer.isInstanced(MeshId.Door)).toBe(false);
  });
});

// ── Cleanup ────────────────────────────────────────────────────────────────

describe('cleanup', () => {
  it('dispose removes instanced meshes from scene groups', () => {
    const dungeonChildCount = sceneManager.dungeonGroup.children.length;
    const entityChildCount = sceneManager.entityGroup.children.length;

    expect(dungeonChildCount).toBeGreaterThan(0);
    expect(entityChildCount).toBeGreaterThan(0);

    instancedRenderer.dispose();

    // After dispose, instanced meshes should be removed
    const hasInstancedInDungeon = sceneManager.dungeonGroup.children.some(
      (c) => c.name.startsWith('Instanced_'),
    );
    const hasInstancedInEntity = sceneManager.entityGroup.children.some(
      (c) => c.name.startsWith('Instanced_'),
    );

    expect(hasInstancedInDungeon).toBe(false);
    expect(hasInstancedInEntity).toBe(false);
  });

  it('getInstanceCount returns 0 after dispose', () => {
    addEntity(MeshId.Bullet, 1, 0, 0);
    instancedRenderer.update(world);
    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(1);

    instancedRenderer.dispose();
    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(0);
  });
});

// ── Non-instanced entities are ignored ─────────────────────────────────────

describe('non-instanced entities', () => {
  it('does not affect count for non-instanced mesh types', () => {
    addEntity(MeshId.Player, 0, 0, 0);
    addEntity(MeshId.Boss, 5, 0, 0);

    instancedRenderer.update(world);

    expect(instancedRenderer.getInstanceCount(MeshId.Player)).toBe(0);
    expect(instancedRenderer.getInstanceCount(MeshId.Boss)).toBe(0);
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────

function findInstancedMesh(meshId: MeshId): THREE.InstancedMesh | undefined {
  const name = `Instanced_${MeshId[meshId]}`;

  for (const group of [sceneManager.dungeonGroup, sceneManager.entityGroup]) {
    const found = group.children.find((c) => c.name === name);
    if (found && found instanceof THREE.InstancedMesh) {
      return found;
    }
  }
  return undefined;
}
