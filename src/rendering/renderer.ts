import * as THREE from 'three';
import { createCameraController, updateCamera, type CameraController } from './cameraController';
import { createSceneManager, type SceneManager } from './sceneManager';
import { createInstancedRenderer, type InstancedRenderer } from './instancedRenderer';
import { MeshId, GunType, WeaponSlot } from '../ecs/components';
import type { Position, PreviousPosition, Rotation, Renderable, Player, Gun } from '../ecs/components';
import type { World } from '../ecs/world';
import type { EntityId } from '../types';

export { spawnDamageNumber, updateDamageNumbers, clearDamageNumbers, getActiveDamageNumbers } from './damageNumbers';
export type { DamageNumber } from './damageNumbers';
export { createCameraController, updateCamera, addScreenShake } from './cameraController';
export type { CameraController } from './cameraController';

export {
  createScreenEffects,
  mountScreenEffects,
  unmountScreenEffects,
  updateScreenEffects,
  triggerShake,
  triggerPlayerHitShake,
  triggerExplosionShake,
  triggerBigHitShake,
  triggerHitFlash,
} from './screenEffects';
export type { ScreenEffects, ScreenShakeState, HitFlashState, DamageVignetteState } from './screenEffects';

export { createSceneManager, getAllMeshIds, getMeshDef } from './sceneManager';
export type { SceneManager } from './sceneManager';

export { createInstancedRenderer } from './instancedRenderer';
export type { InstancedRenderer } from './instancedRenderer';

export interface RendererContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cameraController: CameraController;
  sceneManager: SceneManager;
  instancedRenderer: InstancedRenderer;
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
  _resizeCleanup: (() => void) | null;
}

export function initRenderer(): RendererContext {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();

  const cameraController = createCameraController();
  const camera = cameraController.camera;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(10, 20, 10);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.set(2048, 2048);
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 100;
  directionalLight.shadow.camera.left = -30;
  directionalLight.shadow.camera.right = 30;
  directionalLight.shadow.camera.top = 30;
  directionalLight.shadow.camera.bottom = -30;
  scene.add(directionalLight);

  const sceneManager = createSceneManager(scene);
  const instancedRenderer = createInstancedRenderer(sceneManager);

  return { renderer, scene, camera, cameraController, sceneManager, instancedRenderer, ambientLight, directionalLight, _resizeCleanup: null };
}

export function mountRenderer(
  ctx: RendererContext,
  container: HTMLElement,
): void {
  const { width, height } = container.getBoundingClientRect();
  ctx.renderer.setSize(width, height);
  ctx.camera.aspect = width / height;
  ctx.camera.updateProjectionMatrix();
  container.appendChild(ctx.renderer.domElement);

  const onResize = (): void => {
    const { width: w, height: h } = container.getBoundingClientRect();
    if (w === 0 || h === 0) return;
    ctx.renderer.setSize(w, h);
    ctx.camera.aspect = w / h;
    ctx.camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  ctx._resizeCleanup = () => {
    window.removeEventListener('resize', onResize);
  };
}

export function unmountRenderer(ctx: RendererContext): void {
  if (ctx._resizeCleanup) {
    ctx._resizeCleanup();
    ctx._resizeCleanup = null;
  }
  const canvas = ctx.renderer.domElement;
  canvas.parentElement?.removeChild(canvas);
}

// ── GunType to MeshId mapping ──────────────────────────────────────────────

const GUN_TYPE_TO_MESH_ID: Record<GunType, MeshId> = {
  [GunType.Pistol]: MeshId.Pistol,
  [GunType.SMG]: MeshId.SMG,
  [GunType.AssaultRifle]: MeshId.AssaultRifle,
  [GunType.Shotgun]: MeshId.Shotgun,
  [GunType.LMG]: MeshId.LMG,
};

const WEAPON_MESH_NAMES = new Set([
  MeshId[MeshId.Pistol],
  MeshId[MeshId.SMG],
  MeshId[MeshId.AssaultRifle],
  MeshId[MeshId.Shotgun],
  MeshId[MeshId.LMG],
]);

// ── Render System ──────────────────────────────────────────────────────────

export interface RenderSystem {
  /** Call each render frame with the interpolation alpha and dt */
  update(world: World, alpha: number, dt: number): void;
  /** Release all tracked meshes back to pool */
  releaseAll(): void;
  /** Get the entity-to-mesh map (for testing) */
  getMeshMap(): ReadonlyMap<EntityId, THREE.Mesh>;
}

export function createRenderSystem(ctx: RendererContext): RenderSystem {
  const meshMap = new Map<EntityId, THREE.Mesh>();
  const meshIdMap = new Map<EntityId, MeshId>();

  function update(world: World, alpha: number, dt: number): void {
    // 1. Update instanced meshes (bullets, enemies, pickups, dungeon tiles)
    ctx.instancedRenderer.update(world, alpha);

    // 2. Sync individual (non-instanced) meshes
    syncIndividualMeshes(world, alpha);

    // 3. Update camera to follow player
    updateCameraFollow(world, alpha, dt);

    // 4. Render
    ctx.renderer.render(ctx.scene, ctx.camera);
  }

  function syncIndividualMeshes(world: World, alpha: number): void {
    const entities = world.query(['Position', 'Renderable']);
    const currentEntities = new Set<EntityId>();

    for (const entityId of entities) {
      const renderable = world.getComponent<Renderable>(entityId, 'Renderable');
      if (!renderable) continue;

      // Skip instanced mesh types — handled by instancedRenderer
      if (ctx.instancedRenderer.isInstanced(renderable.meshId)) continue;

      currentEntities.add(entityId);

      let mesh = meshMap.get(entityId);
      const prevMeshId = meshIdMap.get(entityId);

      // If meshId changed, release old mesh and acquire new one
      if (mesh && prevMeshId !== undefined && prevMeshId !== renderable.meshId) {
        ctx.sceneManager.entityGroup.remove(mesh);
        ctx.sceneManager.releaseMesh(prevMeshId, mesh);
        mesh = undefined;
      }

      // Acquire mesh from pool if needed
      if (!mesh) {
        mesh = ctx.sceneManager.acquireMesh(renderable.meshId);
        ctx.sceneManager.entityGroup.add(mesh);
        meshMap.set(entityId, mesh);
        meshIdMap.set(entityId, renderable.meshId);
      }

      // Handle visibility
      mesh.visible = renderable.visible;
      if (!renderable.visible) continue;

      // Interpolate position
      const pos = world.getComponent<Position>(entityId, 'Position')!;
      const prev = world.getComponent<PreviousPosition>(entityId, 'PreviousPosition');
      const x = prev ? prev.x + (pos.x - prev.x) * alpha : pos.x;
      const y = prev ? prev.y + (pos.y - prev.y) * alpha : pos.y;
      const z = prev ? prev.z + (pos.z - prev.z) * alpha : pos.z;
      mesh.position.set(x, y, z);

      // Sync rotation
      const rotation = world.getComponent<Rotation>(entityId, 'Rotation');
      if (rotation) {
        mesh.rotation.y = rotation.y;
      }

      // Sync scale
      mesh.scale.set(renderable.scale, renderable.scale, renderable.scale);

      // Handle weapon visibility for player
      if (renderable.meshId === MeshId.Player) {
        updateWeaponVisibility(world, entityId, mesh);
      }
    }

    // Release meshes for destroyed entities
    for (const [entityId, mesh] of meshMap) {
      if (!currentEntities.has(entityId)) {
        const meshId = meshIdMap.get(entityId)!;
        ctx.sceneManager.entityGroup.remove(mesh);
        ctx.sceneManager.releaseMesh(meshId, mesh);
        meshMap.delete(entityId);
        meshIdMap.delete(entityId);
      }
    }
  }

  function updateWeaponVisibility(world: World, playerEntityId: EntityId, playerMesh: THREE.Mesh): void {
    const player = world.getComponent<Player>(playerEntityId, 'Player');
    if (!player) return;

    // Determine active gun type
    const activeGunEntityId = player.activeSlot === WeaponSlot.Sidearm
      ? player.sidearmSlot
      : player.longArmSlot;
    const activeGun = world.getComponent<Gun>(activeGunEntityId, 'Gun');
    const activeWeaponMeshName = activeGun
      ? MeshId[GUN_TYPE_TO_MESH_ID[activeGun.gunType]]
      : null;

    // Show only the active weapon child mesh
    for (const child of playerMesh.children) {
      if (child instanceof THREE.Mesh && WEAPON_MESH_NAMES.has(child.name)) {
        child.visible = child.name === activeWeaponMeshName;
      }
    }
  }

  function updateCameraFollow(world: World, alpha: number, dt: number): void {
    const playerEntities = world.query(['Position', 'Player']);
    if (playerEntities.length === 0) return;

    const playerEntityId = playerEntities[0];
    const pos = world.getComponent<Position>(playerEntityId, 'Position')!;
    const prev = world.getComponent<PreviousPosition>(playerEntityId, 'PreviousPosition');

    const x = prev ? prev.x + (pos.x - prev.x) * alpha : pos.x;
    const y = prev ? prev.y + (pos.y - prev.y) * alpha : pos.y;
    const z = prev ? prev.z + (pos.z - prev.z) * alpha : pos.z;

    updateCamera(ctx.cameraController, x, y, z, dt);
  }

  function releaseAll(): void {
    for (const [entityId, mesh] of meshMap) {
      const meshId = meshIdMap.get(entityId)!;
      ctx.sceneManager.entityGroup.remove(mesh);
      ctx.sceneManager.releaseMesh(meshId, mesh);
    }
    meshMap.clear();
    meshIdMap.clear();
  }

  function getMeshMap(): ReadonlyMap<EntityId, THREE.Mesh> {
    return meshMap;
  }

  return { update, releaseAll, getMeshMap };
}

// ── Legacy renderFrame (backwards-compatible) ──────────────────────────────

export function renderFrame(ctx: RendererContext, alpha: number, world?: World): void {
  if (world) {
    ctx.instancedRenderer.update(world, alpha);
  }
  ctx.renderer.render(ctx.scene, ctx.camera);
}

let rafId: number | null = null;

export function startRenderLoop(
  ctx: RendererContext,
  onFrame: (alpha: number) => void,
): void {
  let lastTime = performance.now();

  function loop(now: number): void {
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const alpha = dt > 0 ? 1 : 0;

    onFrame(alpha);
    renderFrame(ctx, alpha);

    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);
}

export function stopRenderLoop(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

export function disposeRenderer(ctx: RendererContext): void {
  stopRenderLoop();
  unmountRenderer(ctx);
  ctx.instancedRenderer.dispose();
  ctx.sceneManager.dispose();
  ctx.renderer.dispose();
  ctx.scene.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) {
        object.material.forEach((m) => m.dispose());
      } else {
        object.material.dispose();
      }
    }
  });
  ctx.scene.clear();
}
