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

describe('MiniBossShotgunner mesh scaffold', () => {
  it('MeshId.MiniBossShotgunner exists in the enum', () => {
    expect(MeshId.MiniBossShotgunner).toBeDefined();
    expect(typeof MeshId.MiniBossShotgunner).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossShotgunner);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.MiniBossShotgunner, mesh);
  });

  it('uses BoxGeometry(1.4, 2.5, 1.4) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossShotgunner);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(1.4);
    expect(params.height).toBe(2.5);
    expect(params.depth).toBe(1.4);
    manager.releaseMesh(MeshId.MiniBossShotgunner, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossShotgunner);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.MiniBossShotgunner, mesh);
  });

  it('has dark orange color (0xaa5500)', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossShotgunner);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xaa5500);
    manager.releaseMesh(MeshId.MiniBossShotgunner, mesh);
  });

  it('has an outline mesh child (BackSide material)', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossShotgunner);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.MiniBossShotgunner, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.MiniBossShotgunner);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.MiniBossShotgunner);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.MiniBossShotgunner, mesh);
    }
  });
});
