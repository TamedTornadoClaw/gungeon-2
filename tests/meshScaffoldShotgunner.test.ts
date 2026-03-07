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

describe('Shotgunner mesh scaffold', () => {
  it('acquires a valid Mesh for MeshId.Shotgunner', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgunner);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Shotgunner, mesh);
  });

  it('uses BoxGeometry with dimensions 1.2x2x1.2', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgunner);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(1.2);
    expect(params.height).toBe(2);
    expect(params.depth).toBe(1.2);
    manager.releaseMesh(MeshId.Shotgunner, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgunner);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Shotgunner, mesh);
  });

  it('has orange color (0xff8800)', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgunner);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xff8800);
    manager.releaseMesh(MeshId.Shotgunner, mesh);
  });

  it('has an outline mesh as a child', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgunner);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    expect(outlineChild).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.Shotgunner, mesh);
  });

  it('has a mesh definition registered', () => {
    const def = getMeshDef(MeshId.Shotgunner);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
    expect(def.color).toBe(0xff8800);
  });

  it('renders without errors after acquire', () => {
    const mesh = manager.acquireMesh(MeshId.Shotgunner);
    expect(mesh.visible).toBe(true);
    expect(() => {
      mesh.updateMatrixWorld(true);
    }).not.toThrow();
    manager.releaseMesh(MeshId.Shotgunner, mesh);
  });
});
