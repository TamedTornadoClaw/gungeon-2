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

describe('Bullet mesh scaffold', () => {
  it('MeshId.Bullet exists in the enum', () => {
    expect(MeshId.Bullet).toBeDefined();
    expect(typeof MeshId.Bullet).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Bullet);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Bullet, mesh);
  });

  it('uses SphereGeometry(0.05) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.Bullet);
    expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    const params = (mesh.geometry as THREE.SphereGeometry).parameters;
    expect(params.radius).toBe(0.05);
    manager.releaseMesh(MeshId.Bullet, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Bullet);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Bullet, mesh);
  });

  it('has yellow color (0xffff00)', () => {
    const mesh = manager.acquireMesh(MeshId.Bullet);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xffff00);
    manager.releaseMesh(MeshId.Bullet, mesh);
  });

  it('skips outline (noOutline is true for tiny projectiles)', () => {
    const mesh = manager.acquireMesh(MeshId.Bullet);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeUndefined();
    manager.releaseMesh(MeshId.Bullet, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.Bullet);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.Bullet);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.Bullet, mesh);
    }
  });
});
