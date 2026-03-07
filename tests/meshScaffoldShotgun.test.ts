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

describe('Shotgun mesh scaffold', () => {
  it('acquires a valid Mesh for MeshId.Shotgun', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgun);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Shotgun, mesh);
  });

  it('uses BoxGeometry with dimensions 0.15x0.1x0.5', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgun);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(0.15);
    expect(params.height).toBe(0.1);
    expect(params.depth).toBe(0.5);
    manager.releaseMesh(MeshId.Shotgun, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgun);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Shotgun, mesh);
  });

  it('has gray color (0x666666)', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgun);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x666666);
    manager.releaseMesh(MeshId.Shotgun, mesh);
  });

  it('has an outline mesh as a child', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgun);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    expect(outlineChild).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.Shotgun, mesh);
  });

  it('has a mesh definition registered', () => {
    const def = getMeshDef(MeshId.Shotgun);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
    expect(def.color).toBe(0x666666);
  });

  it('renders without errors after acquire', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgun);
    expect(mesh.visible).toBe(true);
    expect(() => {
      mesh.updateMatrixWorld(true);
    }).not.toThrow();
    manager.releaseMesh(MeshId.Shotgun, mesh);
  });
});
