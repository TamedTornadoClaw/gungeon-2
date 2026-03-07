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

describe('ShieldGun mesh scaffold', () => {
  it('MeshId.ShieldGun exists in the enum', () => {
    expect(MeshId.ShieldGun).toBeDefined();
    expect(typeof MeshId.ShieldGun).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('uses BoxGeometry(1, 2, 1) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(1);
    expect(params.height).toBe(2);
    expect(params.depth).toBe(1);
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('has green color (0x22cc44)', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x22cc44);
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('has an outline mesh child (BackSide material)', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('has EnemyShieldMesh child (shield plane)', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    const shieldChild = mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.name === 'EnemyShieldMesh',
    );
    expect(shieldChild).toBeDefined();
    expect(shieldChild).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('EnemyShieldMesh child is hidden by default', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    const shieldChild = mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.name === 'EnemyShieldMesh',
    );
    expect(shieldChild!.visible).toBe(false);
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('EnemyShieldMesh uses PlaneGeometry', () => {
    const mesh = manager.acquireMesh(MeshId.ShieldGun);
    const shieldChild = mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.name === 'EnemyShieldMesh',
    ) as THREE.Mesh;
    expect(shieldChild.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    manager.releaseMesh(MeshId.ShieldGun, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.ShieldGun);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.ShieldGun);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.ShieldGun, mesh);
    }
  });
});
