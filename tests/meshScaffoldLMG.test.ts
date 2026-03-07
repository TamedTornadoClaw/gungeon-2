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

describe('LMG mesh scaffold', () => {
  it('acquires a valid Mesh for MeshId.LMG', () => {
    const mesh = manager.acquireMesh(MeshId.LMG);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.LMG, mesh);
  });

  it('uses BoxGeometry with dimensions 0.15x0.15x0.6', () => {
    const mesh = manager.acquireMesh(MeshId.LMG);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(0.15);
    expect(params.height).toBe(0.15);
    expect(params.depth).toBe(0.6);
    manager.releaseMesh(MeshId.LMG, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.LMG);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.LMG, mesh);
  });

  it('has gray color (0x666666)', () => {
    const mesh = manager.acquireMesh(MeshId.LMG);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x666666);
    manager.releaseMesh(MeshId.LMG, mesh);
  });

  it('has an outline mesh as a child', () => {
    const mesh = manager.acquireMesh(MeshId.LMG);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    expect(outlineChild).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.LMG, mesh);
  });

  it('has a mesh definition registered', () => {
    const def = getMeshDef(MeshId.LMG);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
    expect(def.color).toBe(0x666666);
  });

  it('renders without errors after acquire', () => {
    const mesh = manager.acquireMesh(MeshId.LMG);
    expect(mesh.visible).toBe(true);
    expect(() => {
      mesh.updateMatrixWorld(true);
    }).not.toThrow();
    manager.releaseMesh(MeshId.LMG, mesh);
  });
});
