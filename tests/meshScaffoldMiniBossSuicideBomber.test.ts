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

describe('MiniBossSuicideBomber mesh scaffold', () => {
  it('MeshId.MiniBossSuicideBomber exists in the enum', () => {
    expect(MeshId.MiniBossSuicideBomber).toBeDefined();
    expect(typeof MeshId.MiniBossSuicideBomber).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossSuicideBomber);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.MiniBossSuicideBomber, mesh);
  });

  it('uses BoxGeometry(1.2, 2, 1.2) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossSuicideBomber);
    expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
    const params = (mesh.geometry as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(1.2);
    expect(params.height).toBe(2);
    expect(params.depth).toBe(1.2);
    manager.releaseMesh(MeshId.MiniBossSuicideBomber, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossSuicideBomber);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.MiniBossSuicideBomber, mesh);
  });

  it('has dark yellow color (0xaa9900)', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossSuicideBomber);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xaa9900);
    manager.releaseMesh(MeshId.MiniBossSuicideBomber, mesh);
  });

  it('has an outline mesh child (BackSide material)', () => {
    const mesh = manager.acquireMesh(MeshId.MiniBossSuicideBomber);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.MiniBossSuicideBomber, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.MiniBossSuicideBomber);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.MiniBossSuicideBomber);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.MiniBossSuicideBomber, mesh);
    }
  });
});
