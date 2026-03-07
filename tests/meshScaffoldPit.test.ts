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

describe('Pit mesh scaffold', () => {
  it('MeshId.Pit exists in the enum', () => {
    expect(MeshId.Pit).toBeDefined();
    expect(typeof MeshId.Pit).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Pit);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Pit, mesh);
  });

  it('uses PlaneGeometry(1, 1) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.Pit);
    expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    const params = (mesh.geometry as THREE.PlaneGeometry).parameters;
    expect(params.width).toBe(1);
    expect(params.height).toBe(1);
    manager.releaseMesh(MeshId.Pit, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Pit);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Pit, mesh);
  });

  it('has near-black color', () => {
    const mesh = manager.acquireMesh(MeshId.Pit);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x111111);
    manager.releaseMesh(MeshId.Pit, mesh);
  });

  it('has no outline mesh (flat terrain)', () => {
    const mesh = manager.acquireMesh(MeshId.Pit);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeUndefined();
    manager.releaseMesh(MeshId.Pit, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.Pit);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.Pit);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.Pit, mesh);
    }
  });
});
