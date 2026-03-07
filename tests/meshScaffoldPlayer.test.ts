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

describe('Player mesh scaffold', () => {
  it('acquires a valid Player mesh', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.Player, mesh);
  });

  it('geometry is a 1x2x1 box', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    const geo = mesh.geometry;
    expect(geo).toBeInstanceOf(THREE.BufferGeometry);

    // BoxGeometry(1,2,1) produces a bounding box of size (1,2,1)
    geo.computeBoundingBox();
    const box = geo.boundingBox!;
    const size = new THREE.Vector3();
    box.getSize(size);
    expect(size.x).toBeCloseTo(1);
    expect(size.y).toBeCloseTo(2);
    expect(size.z).toBeCloseTo(1);

    manager.releaseMesh(MeshId.Player, mesh);
  });

  it('uses MeshToonMaterial', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    expect(mesh.material).toBeInstanceOf(THREE.MeshToonMaterial);
    manager.releaseMesh(MeshId.Player, mesh);
  });

  it('material color is blue (0x2255ff)', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    const mat = mesh.material as THREE.MeshToonMaterial;
    expect(mat.color.getHex()).toBe(0x2255ff);
    manager.releaseMesh(MeshId.Player, mesh);
  });

  it('has an outline mesh child (BackSide material)', () => {
    const mesh = manager.acquireMesh(MeshId.Player);
    const outline = mesh.children.find(
      (c) =>
        c instanceof THREE.Mesh &&
        (c.material as THREE.MeshBasicMaterial).side === THREE.BackSide,
    );
    expect(outline).toBeDefined();
    expect(outline).toBeInstanceOf(THREE.Mesh);
    manager.releaseMesh(MeshId.Player, mesh);
  });

  it('getMeshDef returns a valid definition for Player', () => {
    const def = getMeshDef(MeshId.Player);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
    expect(def.color).toBe(0x2255ff);
    expect(def.noOutline).toBeFalsy();
  });
});
