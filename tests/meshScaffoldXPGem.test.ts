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

describe('XPGem mesh scaffold', () => {
  it('MeshId.XPGem exists in the enum', () => {
    expect(MeshId.XPGem).toBeDefined();
    expect(typeof MeshId.XPGem).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.XPGem);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.XPGem, mesh);
  });

  it('uses OctahedronGeometry(0.15) as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.XPGem);
    expect(mesh.geometry).toBeInstanceOf(THREE.OctahedronGeometry);
    const params = (mesh.geometry as THREE.OctahedronGeometry).parameters;
    expect(params.radius).toBe(0.15);
    manager.releaseMesh(MeshId.XPGem, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.XPGem);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.XPGem, mesh);
  });

  it('has cyan color (0x00ffff)', () => {
    const mesh = manager.acquireMesh(MeshId.XPGem);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x00ffff);
    manager.releaseMesh(MeshId.XPGem, mesh);
  });

  it('has emissive cyan glow', () => {
    const mesh = manager.acquireMesh(MeshId.XPGem);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.emissive.getHex()).toBe(0x00ffff);
    expect(mat.emissiveIntensity).toBe(0.5);
    manager.releaseMesh(MeshId.XPGem, mesh);
  });

  it('skips outline (noOutline is true for small gems)', () => {
    const mesh = manager.acquireMesh(MeshId.XPGem);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeUndefined();
    manager.releaseMesh(MeshId.XPGem, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.XPGem);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.XPGem);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.XPGem, mesh);
    }
  });
});
