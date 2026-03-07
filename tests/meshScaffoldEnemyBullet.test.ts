import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MeshId } from '../src/ecs/components';
import {
  createSceneManager,
  getMeshDef,
  type SceneManager,
} from '../src/rendering/sceneManager';

let scene: THREE.Scene;
let manager: SceneManager;

beforeEach(() => {
  scene = new THREE.Scene();
  manager = createSceneManager(scene);
});

describe('EnemyBullet mesh scaffold', () => {
  it('MeshId.EnemyBullet exists in the enum', () => {
    expect(MeshId.EnemyBullet).toBeDefined();
    expect(typeof MeshId.EnemyBullet).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyBullet);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.EnemyBullet, mesh);
  });

  it('uses SphereGeometry(0.05) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyBullet);
    expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    const params = (mesh.geometry as THREE.SphereGeometry).parameters;
    expect(params.radius).toBe(0.05);
    manager.releaseMesh(MeshId.EnemyBullet, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyBullet);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.EnemyBullet, mesh);
  });

  it('has red color (0xff0000)', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyBullet);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xff0000);
    manager.releaseMesh(MeshId.EnemyBullet, mesh);
  });

  it('does not have an outline mesh child (bullets skip outlines)', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyBullet);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeUndefined();
    manager.releaseMesh(MeshId.EnemyBullet, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.EnemyBullet);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.EnemyBullet);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.EnemyBullet, mesh);
    }
  });
});
