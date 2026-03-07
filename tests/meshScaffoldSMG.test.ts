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

describe('SMG mesh scaffold', () => {
  it('acquires a valid Mesh for MeshId.SMG', () => {
    const mesh = manager.acquireMesh(MeshId.SMG);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.SMG, mesh);
  });

  it('uses CylinderGeometry with dimensions 0.1x0.6x0.1', () => {
    const mesh = manager.acquireMesh(MeshId.SMG);
    expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    const params = (mesh.geometry as THREE.CylinderGeometry).parameters;
    expect(params.radiusTop).toBe(0.05);
    expect(params.radiusBottom).toBe(0.05);
    expect(params.height).toBe(0.6);
    manager.releaseMesh(MeshId.SMG, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.SMG);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.SMG, mesh);
  });

  it('has dark gray color (0x666666)', () => {
    const mesh = manager.acquireMesh(MeshId.SMG);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x666666);
    manager.releaseMesh(MeshId.SMG, mesh);
  });

  it('has an outline mesh as a child', () => {
    const mesh = manager.acquireMesh(MeshId.SMG);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    expect(outlineChild).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.SMG, mesh);
  });

  it('has a mesh definition registered', () => {
    const def = getMeshDef(MeshId.SMG);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
    expect(def.color).toBe(0x666666);
  });

  it('renders without errors after acquire', () => {
    const mesh = manager.acquireMesh(MeshId.SMG);
    expect(mesh.visible).toBe(true);
    expect(() => {
      mesh.updateMatrixWorld(true);
    }).not.toThrow();
    manager.releaseMesh(MeshId.SMG, mesh);
  });
});
