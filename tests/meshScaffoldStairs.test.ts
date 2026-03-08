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

describe('Stairs mesh scaffold', () => {
  it('MeshId.Stairs exists in the enum', () => {
    expect(MeshId.Stairs).toBeDefined();
    expect(typeof MeshId.Stairs).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Stairs);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Stairs, mesh);
  });

  it('uses merged step geometry with vertices', () => {
    const mesh = manager.acquireMesh(MeshId.Stairs);
    const pos = mesh.geometry.getAttribute('position');
    expect(pos).toBeDefined();
    expect(pos.count).toBeGreaterThan(0);
    manager.releaseMesh(MeshId.Stairs, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Stairs);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Stairs, mesh);
  });

  it('has gray color', () => {
    const mesh = manager.acquireMesh(MeshId.Stairs);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x888888);
    manager.releaseMesh(MeshId.Stairs, mesh);
  });

  it('has outline mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Stairs);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.Stairs, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.Stairs);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.Stairs);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.Stairs, mesh);
    }
  });
});
