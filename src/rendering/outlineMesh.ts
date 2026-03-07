import * as THREE from 'three';

const OUTLINE_SCALE = 1.05;

const outlineMaterial = new THREE.MeshBasicMaterial({
  color: 0x000000,
  side: THREE.BackSide,
});

export function createOutlineMesh(originalMesh: THREE.Mesh): THREE.Mesh {
  const outline = new THREE.Mesh(originalMesh.geometry, outlineMaterial);
  outline.scale.setScalar(OUTLINE_SCALE);
  return outline;
}
