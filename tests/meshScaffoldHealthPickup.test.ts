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

describe('HealthPickup mesh scaffold', () => {
  it('MeshId.HealthPickup exists in the enum', () => {
    expect(MeshId.HealthPickup).toBeDefined();
    expect(typeof MeshId.HealthPickup).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.HealthPickup);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.HealthPickup, mesh);
  });

  it('uses cross-shaped geometry (merged BoxGeometry)', () => {
    const mesh = manager.acquireMesh(MeshId.HealthPickup);
    // Cross geometry is a merged BufferGeometry from two boxes
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    // Two boxes merged: each box has 24 vertices, total 48
    const posAttr = mesh.geometry.getAttribute('position');
    expect(posAttr.count).toBe(48);
    manager.releaseMesh(MeshId.HealthPickup, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.HealthPickup);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.HealthPickup, mesh);
  });

  it('has green color (0x22ff22)', () => {
    const mesh = manager.acquireMesh(MeshId.HealthPickup);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x22ff22);
    manager.releaseMesh(MeshId.HealthPickup, mesh);
  });

  it('has outline mesh (not in NO_OUTLINE set)', () => {
    const mesh = manager.acquireMesh(MeshId.HealthPickup);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.HealthPickup, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.HealthPickup);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.HealthPickup);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.HealthPickup, mesh);
    }
  });
});
