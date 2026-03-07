import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshId } from '../src/ecs/components';
import {
  createSceneManager,
  getAllMeshIds,
  type SceneManager,
} from '../src/rendering/sceneManager';

let scene: THREE.Scene;
let manager: SceneManager;

beforeEach(() => {
  scene = new THREE.Scene();
  manager = createSceneManager(scene);
});

// ── Mesh Factory ────────────────────────────────────────────────────────────

describe('mesh factory', () => {
  it('every MeshId produces a valid Mesh', () => {
    for (const meshId of getAllMeshIds()) {
      const mesh = manager.acquireMesh(meshId);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.geometry).toBeDefined();
      expect(mesh.material).toBeDefined();
      manager.releaseMesh(meshId, mesh);
    }
  });

  it('uses MeshToonMaterial for character meshes', () => {
    const characterIds = [
      MeshId.Player,
      MeshId.KnifeRusher,
      MeshId.ShieldGun,
      MeshId.Shotgunner,
      MeshId.Rifleman,
      MeshId.Boss,
    ];

    for (const meshId of characterIds) {
      const mesh = manager.acquireMesh(meshId);
      expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
      manager.releaseMesh(meshId, mesh);
    }
  });

  it('uses MeshToonMaterial for weapon meshes', () => {
    const weaponIds = [
      MeshId.Pistol,
      MeshId.SMG,
      MeshId.AssaultRifle,
      MeshId.Shotgun,
      MeshId.LMG,
    ];

    for (const meshId of weaponIds) {
      const mesh = manager.acquireMesh(meshId);
      expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
      manager.releaseMesh(meshId, mesh);
    }
  });

  it('outline meshes are children of character meshes', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.Player, mesh);
  });

  it('small/emissive meshes skip outlines', () => {
    const noOutlineIds = [
      MeshId.Bullet,
      MeshId.EnemyBullet,
      MeshId.XPGem,
      MeshId.GunPickupGlow,
      MeshId.Floor,
      MeshId.Pit,
    ];

    for (const meshId of noOutlineIds) {
      const mesh = manager.acquireMesh(meshId);
      const outlineChild = mesh.children.find(
        (c) =>
          c instanceof THREE.Mesh &&
          (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
      );
      expect(outlineChild).toBeUndefined();
      manager.releaseMesh(meshId, mesh);
    }
  });

  it('bullet meshes have emissive material', () => {
    const bullet = manager.acquireMesh(MeshId.Bullet);
    const mat = bullet.material as THREE.MeshToonMaterial;
    expect(mat.emissiveIntensity).toBeGreaterThan(0);
    manager.releaseMesh(MeshId.Bullet, bullet);

    const enemyBullet = manager.acquireMesh(MeshId.EnemyBullet);
    const enemyMat = enemyBullet.material as THREE.MeshToonMaterial;
    expect(enemyMat.emissiveIntensity).toBeGreaterThan(0);
    manager.releaseMesh(MeshId.EnemyBullet, enemyBullet);
  });

  it('water hazard is transparent', () => {
    const mesh = manager.acquireMesh(MeshId.WaterHazard);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(1);
    manager.releaseMesh(MeshId.WaterHazard, mesh);
  });
});

// ── Object Pool ─────────────────────────────────────────────────────────────

describe('object pool', () => {
  it('acquire returns a visible mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    expect(mesh.visible).toBe(true);
    manager.releaseMesh(MeshId.Player, mesh);
  });

  it('release hides the mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    manager.releaseMesh(MeshId.Player, mesh);
    expect(mesh.visible).toBe(false);
  });

  it('release resets position, rotation, and scale', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    mesh.position.set(5, 10, 15);
    mesh.rotation.set(1, 2, 3);
    mesh.scale.set(2, 2, 2);
    manager.releaseMesh(MeshId.Player, mesh);

    expect(mesh.position.x).toBe(0);
    expect(mesh.position.y).toBe(0);
    expect(mesh.position.z).toBe(0);
    expect(mesh.scale.x).toBe(1);
  });

  it('released mesh can be reacquired', () => {
    const mesh1 = manager.acquireMesh(MeshId.Bullet);
    manager.releaseMesh(MeshId.Bullet, mesh1);
    const mesh2 = manager.acquireMesh(MeshId.Bullet);
    expect(mesh2).toBe(mesh1);
    expect(mesh2.visible).toBe(true);
    manager.releaseMesh(MeshId.Bullet, mesh2);
  });

  it('pool stats track acquire and release', () => {
    const initialStats = manager.getPoolStats();
    const initialAvailable = initialStats[MeshId.Player].available;

    const mesh = manager.acquireMesh(MeshId.Player);
    const statsAfterAcquire = manager.getPoolStats();
    expect(statsAfterAcquire[MeshId.Player].available).toBe(initialAvailable - 1);
    expect(statsAfterAcquire[MeshId.Player].inUse).toBe(1);

    manager.releaseMesh(MeshId.Player, mesh);
    const statsAfterRelease = manager.getPoolStats();
    expect(statsAfterRelease[MeshId.Player].available).toBe(initialAvailable);
    expect(statsAfterRelease[MeshId.Player].inUse).toBe(0);
  });

  it('pool is pre-allocated for high-count entities', () => {
    const stats = manager.getPoolStats();
    expect(stats[MeshId.Bullet].available).toBeGreaterThanOrEqual(100);
    expect(stats[MeshId.Wall].available).toBeGreaterThanOrEqual(200);
    expect(stats[MeshId.Floor].available).toBeGreaterThanOrEqual(200);
  });

  it('creates new mesh when pool is exhausted', () => {
    // Drain the player pool
    const stats = manager.getPoolStats();
    const count = stats[MeshId.Player].available;
    const meshes: THREE.Mesh[] = [];

    for (let i = 0; i < count + 1; i++) {
      meshes.push(manager.acquireMesh(MeshId.Player));
    }

    // All should be valid meshes
    for (const mesh of meshes) {
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      expect(mesh.visible).toBe(true);
    }

    // Clean up
    for (const mesh of meshes) {
      manager.releaseMesh(MeshId.Player, mesh);
    }
  });
});

// ── Scene Graph Structure ───────────────────────────────────────────────────

describe('scene graph structure', () => {
  it('creates DungeonGroup, EntityGroup, EffectsGroup', () => {
    expect(manager.dungeonGroup).toBeInstanceOf(THREE.Group);
    expect(manager.entityGroup).toBeInstanceOf(THREE.Group);
    expect(manager.effectsGroup).toBeInstanceOf(THREE.Group);
  });

  it('groups are named correctly', () => {
    expect(manager.dungeonGroup.name).toBe('DungeonGroup');
    expect(manager.entityGroup.name).toBe('EntityGroup');
    expect(manager.effectsGroup.name).toBe('EffectsGroup');
  });

  it('groups are added to the scene', () => {
    expect(scene.children).toContain(manager.dungeonGroup);
    expect(scene.children).toContain(manager.entityGroup);
    expect(scene.children).toContain(manager.effectsGroup);
  });

  it('dispose removes groups from scene', () => {
    manager.dispose();
    expect(scene.children).not.toContain(manager.dungeonGroup);
    expect(scene.children).not.toContain(manager.entityGroup);
    expect(scene.children).not.toContain(manager.effectsGroup);
  });
});

// ── Complete Coverage ───────────────────────────────────────────────────────

describe('complete MeshId coverage', () => {
  it('getAllMeshIds returns every enum value', () => {
    const allIds = getAllMeshIds();
    const enumValues = Object.values(MeshId).filter(
      (v) => typeof v === 'number',
    ) as MeshId[];
    expect(allIds).toHaveLength(enumValues.length);
    for (const id of enumValues) {
      expect(allIds).toContain(id);
    }
  });

  it('every MeshId has a geometry generator that produces valid geometry', () => {
    for (const meshId of getAllMeshIds()) {
      const mesh = manager.acquireMesh(meshId);
      expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
      const posAttr = mesh.geometry.getAttribute('position');
      expect(posAttr).toBeDefined();
      expect(posAttr.count).toBeGreaterThan(0);
      manager.releaseMesh(meshId, mesh);
    }
  });
});
