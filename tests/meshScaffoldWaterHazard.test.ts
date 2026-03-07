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

describe('WaterHazard mesh scaffold', () => {
  it('MeshId.WaterHazard exists in the enum', () => {
    expect(MeshId.WaterHazard).toBeDefined();
    expect(typeof MeshId.WaterHazard).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.WaterHazard);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.WaterHazard, mesh);
  });

  it('uses PlaneGeometry(1, 1) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.WaterHazard);
    expect(mesh.geometry).toBeInstanceOf(THREE.PlaneGeometry);
    const params = (mesh.geometry as THREE.PlaneGeometry).parameters;
    expect(params.width).toBe(1);
    expect(params.height).toBe(1);
    manager.releaseMesh(MeshId.WaterHazard, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.WaterHazard);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.WaterHazard, mesh);
  });

  it('has blue color', () => {
    const mesh = manager.acquireMesh(MeshId.WaterHazard);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x2266ff);
    manager.releaseMesh(MeshId.WaterHazard, mesh);
  });

  it('is transparent with opacity 0.6', () => {
    const mesh = manager.acquireMesh(MeshId.WaterHazard);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBe(0.6);
    manager.releaseMesh(MeshId.WaterHazard, mesh);
  });

  it('has no outline mesh (in NO_OUTLINE_MESHES set)', () => {
    const mesh = manager.acquireMesh(MeshId.WaterHazard);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeUndefined();
    manager.releaseMesh(MeshId.WaterHazard, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.WaterHazard);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.WaterHazard);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.WaterHazard, mesh);
    }
  });
});
