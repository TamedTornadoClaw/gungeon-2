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

describe('GunPickupGlow mesh scaffold', () => {
  it('MeshId.GunPickupGlow exists in the enum', () => {
    expect(MeshId.GunPickupGlow).toBeDefined();
    expect(typeof MeshId.GunPickupGlow).toBe('number');
  });

  it('produces a valid THREE.Mesh', () => {
    const mesh = manager.acquireMesh(MeshId.GunPickupGlow);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(mesh.material).toBeDefined();
    manager.releaseMesh(MeshId.GunPickupGlow, mesh);
  });

  it('uses TorusGeometry as placeholder', () => {
    const mesh = manager.acquireMesh(MeshId.GunPickupGlow);
    expect(mesh.geometry).toBeInstanceOf(THREE.TorusGeometry);
    const params = (mesh.geometry as THREE.TorusGeometry).parameters;
    expect(params.radius).toBe(0.3);
    expect(params.tube).toBe(0.05);
    manager.releaseMesh(MeshId.GunPickupGlow, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.GunPickupGlow);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.GunPickupGlow, mesh);
  });

  it('has white color (0xffffff)', () => {
    const mesh = manager.acquireMesh(MeshId.GunPickupGlow);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0xffffff);
    manager.releaseMesh(MeshId.GunPickupGlow, mesh);
  });

  it('skips outline (noOutline is true for glow ring)', () => {
    const mesh = manager.acquireMesh(MeshId.GunPickupGlow);
    const outlineChild = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outlineChild).toBeUndefined();
    manager.releaseMesh(MeshId.GunPickupGlow, mesh);
  });

  it('getMeshDef returns a valid definition', () => {
    const def = getMeshDef(MeshId.GunPickupGlow);
    expect(def).toBeDefined();
    expect(typeof def.geometry).toBe('function');
    expect(typeof def.color).toBe('number');
  });

  it('renders without errors when acquired and released multiple times', () => {
    for (let i = 0; i < 5; i++) {
      const mesh = manager.acquireMesh(MeshId.GunPickupGlow);
      expect(mesh).toBeInstanceOf(THREE.Mesh);
      manager.releaseMesh(MeshId.GunPickupGlow, mesh);
    }
  });
});
