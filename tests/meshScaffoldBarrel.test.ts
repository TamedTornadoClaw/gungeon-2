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

describe('Barrel mesh scaffold', () => {
  it('MeshId.Barrel exists in the enum', () => {
    expect(MeshId.Barrel).toBeDefined();
    expect(typeof MeshId.Barrel).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Barrel);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Barrel, mesh);
  });

  it('uses CylinderGeometry as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.Barrel);
    expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    const params = (mesh.geometry as THREE.CylinderGeometry).parameters;
    expect(params.radiusTop).toBe(0.4);
    expect(params.radiusBottom).toBe(0.4);
    expect(params.height).toBe(1);
    manager.releaseMesh(MeshId.Barrel, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Barrel);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Barrel, mesh);
  });

  it('has brown color', () => {
    const mesh = manager.acquireMesh(MeshId.Barrel);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x8b5a2b);
    manager.releaseMesh(MeshId.Barrel, mesh);
  });

  it('has outline mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Barrel);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.Barrel, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.Barrel);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.Barrel);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.Barrel, mesh);
    }
  });
});
