/**
 * Aim raycasting — builds a BVH-accelerated collision mesh from dungeon walls
 * and provides a raycast function for the projectile system's aim target.
 *
 * Uses three-mesh-bvh: the BVH is computed once per floor on the merged wall
 * geometry, and Raycaster.intersectObject automatically uses it.
 *
 * Integration: called from gameSession at floor load, queried each sim step
 * by the game loop to find where the camera crosshair points in the world.
 */
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { World } from '../ecs/world';
import type { Position, Collider } from '../ecs/components';

// Register BVH extension on Three.js prototypes (idempotent)
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

// Scratch objects — reused every frame to avoid allocation
const _raycaster = new THREE.Raycaster();
const _origin = new THREE.Vector3();
const _dir = new THREE.Vector3();

let collisionMesh: THREE.Mesh | null = null;

/**
 * Build (or rebuild) the BVH collision mesh from all wall and door entities.
 * Call once after dungeon generation / floor transition.
 */
export function buildAimCollisionMesh(world: World): void {
  disposeAimCollisionMesh();

  const geometries: THREE.BufferGeometry[] = [];

  // Walls
  const wallIds = world.query(['Position', 'Collider', 'WallTag']);
  for (const id of wallIds) {
    const pos = world.getComponent<Position>(id, 'Position')!;
    const col = world.getComponent<Collider>(id, 'Collider')!;
    const geo = new THREE.BoxGeometry(col.width, col.height, col.depth);
    geo.translate(pos.x, pos.y + col.height / 2, pos.z);
    geometries.push(geo);
  }

  // Doors (closed doors block aim; open doors won't be hit since they're
  // visually hidden, but including all doors in the static mesh is fine —
  // a slight inaccuracy for open doors is negligible)
  const doorIds = world.query(['Position', 'Collider', 'DoorTag']);
  for (const id of doorIds) {
    const pos = world.getComponent<Position>(id, 'Position')!;
    const col = world.getComponent<Collider>(id, 'Collider')!;
    const geo = new THREE.BoxGeometry(col.width, col.height, col.depth);
    geo.translate(pos.x, pos.y + col.height / 2, pos.z);
    geometries.push(geo);
  }

  // Floor as ground-plane fallback so the ray always hits something
  const floorGeo = new THREE.PlaneGeometry(2000, 2000);
  floorGeo.rotateX(-Math.PI / 2);
  geometries.push(floorGeo);

  const merged = mergeGeometries(geometries);
  for (const g of geometries) g.dispose();
  if (!merged) return;

  merged.computeBoundsTree();

  collisionMesh = new THREE.Mesh(merged, new THREE.MeshBasicMaterial());
  collisionMesh.visible = false;
}

/**
 * Raycast from the given origin along the given direction and return the
 * world XZ hit point. Falls back to 100 units ahead if nothing is hit.
 */
export function aimRaycast(
  ox: number, oy: number, oz: number,
  dx: number, dy: number, dz: number,
): { x: number; y: number; z: number } {
  _origin.set(ox, oy, oz);
  _dir.set(dx, dy, dz).normalize();

  _raycaster.set(_origin, _dir);
  _raycaster.far = 200;

  if (collisionMesh) {
    const hits = _raycaster.intersectObject(collisionMesh);
    if (hits.length > 0) {
      return { x: hits[0].point.x, y: hits[0].point.y, z: hits[0].point.z };
    }
  }

  // Fallback: 100 units ahead
  return { x: ox + dx * 100, y: oy + dy * 100, z: oz + dz * 100 };
}

export function disposeAimCollisionMesh(): void {
  if (collisionMesh) {
    collisionMesh.geometry.disposeBoundsTree();
    collisionMesh.geometry.dispose();
    (collisionMesh.material as THREE.Material).dispose();
    collisionMesh = null;
  }
}
