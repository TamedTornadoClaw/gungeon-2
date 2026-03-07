import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createOutlineMesh } from '../src/rendering/outlineMesh';

function makeMesh(geometry: THREE.BufferGeometry): THREE.Mesh {
  return new THREE.Mesh(geometry, new THREE.MeshToonMaterial({ color: 0xff0000 }));
}

describe('createOutlineMesh', () => {
  it('returns a Mesh', () => {
    const original = makeMesh(new THREE.BoxGeometry(1, 1, 1));
    const outline = createOutlineMesh(original);
    expect(outline).toBeInstanceOf(THREE.Mesh);
  });

  it('uses black BackSide material', () => {
    const original = makeMesh(new THREE.BoxGeometry(1, 1, 1));
    const outline = createOutlineMesh(original);
    const mat = outline.material as THREE.MeshBasicMaterial;
    expect(mat.side).toBe(THREE.BackSide);
    expect(mat.color.getHex()).toBe(0x000000);
  });

  it('is scaled larger than the original', () => {
    const original = makeMesh(new THREE.BoxGeometry(1, 1, 1));
    const outline = createOutlineMesh(original);
    expect(outline.scale.x).toBeGreaterThan(1);
    expect(outline.scale.y).toBeGreaterThan(1);
    expect(outline.scale.z).toBeGreaterThan(1);
  });

  it('shares geometry with the original mesh', () => {
    const original = makeMesh(new THREE.BoxGeometry(1, 1, 1));
    const outline = createOutlineMesh(original);
    expect(outline.geometry).toBe(original.geometry);
  });

  it('works with all placeholder geometries', () => {
    const geometries = [
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.CylinderGeometry(0.5, 0.5, 1),
      new THREE.SphereGeometry(0.5),
      new THREE.ConeGeometry(0.5, 1),
    ];

    for (const geo of geometries) {
      const original = makeMesh(geo);
      const outline = createOutlineMesh(original);
      expect(outline).toBeInstanceOf(THREE.Mesh);
      expect(outline.geometry).toBe(original.geometry);
      expect((outline.material as THREE.MeshBasicMaterial).side).toBe(THREE.BackSide);
    }
  });
});
