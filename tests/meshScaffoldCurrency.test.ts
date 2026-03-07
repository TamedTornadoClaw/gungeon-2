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

describe('Currency mesh scaffold', () => {
  it('MeshId.Currency exists in the enum', () => {
    expect(MeshId.Currency).toBeDefined();
    expect(typeof MeshId.Currency).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Currency);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.Currency, mesh);
  });

  it('uses CylinderGeometry as coin-shaped placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.Currency);
    expect(mesh.geometry).toBeInstanceOf(THREE.CylinderGeometry);
    const params = (mesh.geometry as THREE.CylinderGeometry).parameters;
    expect(params.radiusTop).toBe(0.15);
    expect(params.radiusBottom).toBe(0.15);
    expect(params.height).toBe(0.05);
    manager.releaseMesh(MeshId.Currency, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Currency);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Currency, mesh);
  });

  it('has gold color (0xffd700)', () => {
    const mesh = manager.acquireMesh(MeshId.Currency);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xffd700);
    manager.releaseMesh(MeshId.Currency, mesh);
  });

  it('has outline mesh (not in no-outline set)', () => {
    const mesh = manager.acquireMesh(MeshId.Currency);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.Currency, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.Currency);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.Currency);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.Currency, mesh);
    }
  });
});
