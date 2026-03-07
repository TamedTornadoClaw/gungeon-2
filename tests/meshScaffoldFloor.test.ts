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

describe('Floor mesh scaffold', () => {
  it('MeshId.Floor exists in the enum', () => {
    expect(MeshId.Floor).toBeDefined();
    expect(typeof MeshId.Floor).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Floor);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Floor, mesh);
  });

  it('uses PlaneGeometry(1, 1) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.Floor);
    expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    const params = (mesh.geometry as THREE.PlaneGeometry).parameters;
    expect(params.width).toBe(1);
    expect(params.height).toBe(1);
    manager.releaseMesh(MeshId.Floor, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Floor);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Floor, mesh);
  });

  it('has dark gray color', () => {
    const mesh = manager.acquireMesh(MeshId.Floor);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x444444);
    manager.releaseMesh(MeshId.Floor, mesh);
  });

  it('has no outline mesh (floor tiles skip outlines)', () => {
    const mesh = manager.acquireMesh(MeshId.Floor);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeUndefined();
    manager.releaseMesh(MeshId.Floor, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.Floor);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.Floor);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.Floor, mesh);
    }
  });
});
