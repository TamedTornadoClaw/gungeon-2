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

describe('SpikeHazard mesh scaffold', () => {
  it('MeshId.SpikeHazard exists in the enum', () => {
    expect(MeshId.SpikeHazard).toBeDefined();
    expect(typeof MeshId.SpikeHazard).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.SpikeHazard);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.SpikeHazard, mesh);
  });

  it('uses a merged BufferGeometry (plane + spikes)', () => {
    const mesh = manager.acquireMesh(MeshId.SpikeHazard);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    // Merged geometry has more vertices than a plain PlaneGeometry
    const pos = mesh.geometry.getAttribute('position');
    expect(pos.count).toBeGreaterThan(4);
    manager.releaseMesh(MeshId.SpikeHazard, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.SpikeHazard);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.SpikeHazard, mesh);
  });

  it('has gray color', () => {
    const mesh = manager.acquireMesh(MeshId.SpikeHazard);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x999999);
    manager.releaseMesh(MeshId.SpikeHazard, mesh);
  });

  it('has outline mesh', () => {
    const mesh = manager.acquireMesh(MeshId.SpikeHazard);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeDefined();
    manager.releaseMesh(MeshId.SpikeHazard, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.SpikeHazard);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.SpikeHazard);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.SpikeHazard, mesh);
    }
  });
});
