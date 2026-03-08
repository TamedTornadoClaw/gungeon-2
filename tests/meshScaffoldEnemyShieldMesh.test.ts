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

describe('EnemyShieldMesh mesh scaffold', () => {
  it('MeshId.EnemyShieldMesh exists in the enum', () => {
    expect(MeshId.EnemyShieldMesh).toBeDefined();
    expect(typeof MeshId.EnemyShieldMesh).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyShieldMesh);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.EnemyShieldMesh, mesh);
  });

  it('uses PlaneGeometry(0.5, 0.8) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyShieldMesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    const params = (mesh.geometry as THREE.PlaneGeometry).parameters;
    expect(params.width).toBe(0.5);
    expect(params.height).toBe(0.8);
    manager.releaseMesh(MeshId.EnemyShieldMesh, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyShieldMesh);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.EnemyShieldMesh, mesh);
  });

  it('has blue-gray color', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyShieldMesh);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x6688aa);
    manager.releaseMesh(MeshId.EnemyShieldMesh, mesh);
  });

  it('has outline mesh', () => {
    const mesh = manager.acquireMesh(MeshId.EnemyShieldMesh);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.EnemyShieldMesh, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.EnemyShieldMesh);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.EnemyShieldMesh);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.EnemyShieldMesh, mesh);
    }
  });
});
