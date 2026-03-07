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

describe('SuicideBomber mesh scaffold', () => {
  it('MeshId.SuicideBomber exists in the enum', () => {
    expect(MeshId.SuicideBomber).toBeDefined();
    expect(typeof MeshId.SuicideBomber).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.SuicideBomber);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.SuicideBomber, mesh);
  });

  it('uses SphereGeometry(0.6, 16, 16) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.SuicideBomber);
    expect(mesh.geometry).toBeInstanceOf(THREE.SphereGeometry);
    const params = (mesh.geometry as THREE.SphereGeometry).parameters;
    expect(params.radius).toBe(0.6);
    expect(params.widthSegments).toBe(16);
    expect(params.heightSegments).toBe(16);
    manager.releaseMesh(MeshId.SuicideBomber, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.SuicideBomber);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.SuicideBomber, mesh);
  });

  it('has yellow color (0xffdd00)', () => {
    const mesh = manager.acquireMesh(MeshId.SuicideBomber);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xffdd00);
    manager.releaseMesh(MeshId.SuicideBomber, mesh);
  });

  it('has an outline mesh child (BackSide material)', () => {
    const mesh = manager.acquireMesh(MeshId.SuicideBomber);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.SuicideBomber, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.SuicideBomber);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.SuicideBomber);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.SuicideBomber, mesh);
    }
  });
});
