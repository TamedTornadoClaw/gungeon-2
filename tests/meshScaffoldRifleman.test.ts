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

describe('Rifleman mesh scaffold', () => {
  it('acquires a valid Mesh for MeshId.Rifleman', () => {
    const mesh = manager.acquireMesh(MeshId.Rifleman);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Rifleman, mesh);
  });

  it('uses BoxGeometry with dimensions 1x2x1', () => {
    const mesh = manager.acquireMesh(MeshId.Rifleman);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(1);
    expect(params.height).toBe(2);
    expect(params.depth).toBe(1);
    manager.releaseMesh(MeshId.Rifleman, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Rifleman);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Rifleman, mesh);
  });

  it('has purple color (0x8822cc)', () => {
    const mesh = manager.acquireMesh(MeshId.Rifleman);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x8822cc);
    manager.releaseMesh(MeshId.Rifleman, mesh);
  });

  it('has an outline mesh as a child', () => {
    const mesh = manager.acquireMesh(MeshId.Rifleman);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    expect(outlineChild).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.Rifleman, mesh);
  });

  it('has a mesh definition registered', () => {
    const def = getMeshDef(MeshId.Rifleman);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
    expect(def.color).toBe(0x8822cc);
  });

  it('renders without errors after acquire', () => {
    const mesh = manager.acquireMesh(MeshId.Rifleman);
    expect(mesh.visible).toBe(true);
    expect(() => {
      mesh.updateMatrixWorld(true);
    }).not.toThrow();
    manager.releaseMesh(MeshId.Rifleman, mesh);
  });
});
