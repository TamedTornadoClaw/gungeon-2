import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import {
  MeshId,
  GunType,
  GunCategory,
  GunTrait,
  WeaponSlot,
} from '../src/ecs/components';
import type {
  Position,
  PreviousPosition,
  Rotation,
  Renderable,
  Player,
  Gun,
} from '../src/ecs/components';
import { World } from '../src/ecs/world';
import { createSceneManager, type SceneManager } from '../src/rendering/sceneManager';
import { createInstancedRenderer, type InstancedRenderer } from '../src/rendering/instancedRenderer';
import { createRenderSystem, type RenderSystem, type RendererContext } from '../src/rendering/renderer';
import { createCameraController } from '../src/rendering/cameraController';
import type { EntityId } from '../src/types';

// ── Test helpers ────────────────────────────────────────────────────────────

let scene: THREE.Scene;
let sceneManager: SceneManager;
let instancedRenderer: InstancedRenderer;
let world: World;
let ctx: RendererContext;
let renderSystem: RenderSystem;

function createMockRenderer(): THREE.WebGLRenderer {
  return {
    render: () => {},
    setPixelRatio: () => {},
    setSize: () => {},
    dispose: () => {},
    domElement: {} as HTMLCanvasElement,
    shadowMap: { enabled: false, type: THREE.PCFSoftShadowMap },
    outputColorSpace: THREE.SRGBColorSpace,
  } as unknown as THREE.WebGLRenderer;
}

beforeEach(() => {
  scene = new THREE.Scene();
  sceneManager = createSceneManager(scene);
  instancedRenderer = createInstancedRenderer(sceneManager);
  world = new World();

  const cameraController = createCameraController();

  ctx = {
    renderer: createMockRenderer(),
    scene,
    camera: cameraController.camera,
    cameraController,
    sceneManager,
    instancedRenderer,
    ambientLight: new THREE.AmbientLight(),
    directionalLight: new THREE.DirectionalLight(),
  };

  renderSystem = createRenderSystem(ctx);
});

afterEach(() => {
  renderSystem.releaseAll();
  instancedRenderer.dispose();
  sceneManager.dispose();
});

function addRenderableEntity(
  meshId: MeshId,
  pos: { x: number; y: number; z: number },
  prevPos?: { x: number; y: number; z: number },
  opts?: { visible?: boolean; scale?: number; rotation?: number },
): EntityId {
  const id = world.createEntity();
  world.addComponent<Position>(id, 'Position', { ...pos });
  if (prevPos) {
    world.addComponent<PreviousPosition>(id, 'PreviousPosition', { ...prevPos });
  }
  world.addComponent<Renderable>(id, 'Renderable', {
    meshId,
    visible: opts?.visible ?? true,
    scale: opts?.scale ?? 1,
  });
  if (opts?.rotation !== undefined) {
    world.addComponent<Rotation>(id, 'Rotation', { y: opts.rotation });
  }
  return id;
}

function addPlayerEntity(
  pos: { x: number; y: number; z: number },
  prevPos?: { x: number; y: number; z: number },
  activeSlot: WeaponSlot = WeaponSlot.Sidearm,
  gunType: GunType = GunType.Pistol,
): EntityId {
  const id = addRenderableEntity(MeshId.Player, pos, prevPos);

  const gunEntity = world.createEntity();
  world.addComponent<Gun>(gunEntity, 'Gun', {
    gunType,
    category: GunCategory.Sidearm,
    baseDamage: 10, baseFireRate: 5, baseMagazineSize: 12, baseReloadTime: 1,
    baseSpread: 0, baseProjectileCount: 1, baseProjectileSpeed: 20,
    baseKnockback: 1, baseCritChance: 0.05, baseCritMultiplier: 2,
    damage: 10, fireRate: 5, magazineSize: 12, reloadTime: 1,
    spread: 0, projectileCount: 1, projectileSpeed: 20,
    knockback: 1, critChance: 0.05, critMultiplier: 2,
    currentAmmo: 12, isReloading: false, reloadTimer: 0, fireCooldown: 0,
    fireRequested: false,
    traits: [GunTrait.Damage, GunTrait.FireRate, GunTrait.MagazineSize],
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
  });

  const longArmEntity = world.createEntity();
  world.addComponent<Gun>(longArmEntity, 'Gun', {
    gunType: GunType.AssaultRifle,
    category: GunCategory.LongArm,
    baseDamage: 15, baseFireRate: 8, baseMagazineSize: 30, baseReloadTime: 1.5,
    baseSpread: 0, baseProjectileCount: 1, baseProjectileSpeed: 25,
    baseKnockback: 1.5, baseCritChance: 0.05, baseCritMultiplier: 2,
    damage: 15, fireRate: 8, magazineSize: 30, reloadTime: 1.5,
    spread: 0, projectileCount: 1, projectileSpeed: 25,
    knockback: 1.5, critChance: 0.05, critMultiplier: 2,
    currentAmmo: 30, isReloading: false, reloadTimer: 0, fireCooldown: 0,
    fireRequested: false,
    traits: [GunTrait.Damage, GunTrait.FireRate, GunTrait.MagazineSize],
    traitLevels: [0, 0, 0],
    xp: 0,
    forcedUpgradeTriggered: false,
  });

  world.addComponent<Player>(id, 'Player', {
    sidearmSlot: gunEntity,
    longArmSlot: longArmEntity,
    activeSlot,
    currency: 0,
  });

  return id;
}

// ── Position Interpolation ──────────────────────────────────────────────────

describe('position interpolation', () => {
  it('interpolates at alpha=0.5 to midpoint', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    );

    renderSystem.update(world, 0.5, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    expect(mesh.position.x).toBeCloseTo(5, 5);
    expect(mesh.position.y).toBeCloseTo(0, 5);
    expect(mesh.position.z).toBeCloseTo(0, 5);
  });

  it('interpolates at alpha=0 to PreviousPosition', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    );

    renderSystem.update(world, 0, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    expect(mesh.position.x).toBeCloseTo(0, 5);
    expect(mesh.position.y).toBeCloseTo(0, 5);
    expect(mesh.position.z).toBeCloseTo(0, 5);
  });

  it('interpolates at alpha=0.99 to near Position', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 10, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    );

    renderSystem.update(world, 0.99, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    expect(mesh.position.x).toBeCloseTo(9.9, 5);
  });

  it('handles missing PreviousPosition (uses Position directly)', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 10, y: 5, z: 3 },
    );

    renderSystem.update(world, 0.5, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    expect(mesh.position.x).toBeCloseTo(10, 5);
    expect(mesh.position.y).toBeCloseTo(5, 5);
    expect(mesh.position.z).toBeCloseTo(3, 5);
  });

  it('identical PreviousPosition and Position produces stable output (first frame)', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 5, y: 0, z: 5 },
      { x: 5, y: 0, z: 5 },
    );

    renderSystem.update(world, 0.5, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    expect(mesh.position.x).toBeCloseTo(5, 5);
    expect(mesh.position.z).toBeCloseTo(5, 5);
  });

  it('property: interpolated position is always between prev and current', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: -100, max: 100, noNaN: true, noDefaultInfinity: true }),
        fc.float({ min: 0, max: Math.fround(0.999), noNaN: true, noDefaultInfinity: true }),
        (prevX, currX, prevZ, currZ, alpha) => {
          const w = new World();
          const s = new THREE.Scene();
          const sm = createSceneManager(s);
          const ir = createInstancedRenderer(sm);
          const cc = createCameraController();
          const testCtx: RendererContext = {
            renderer: createMockRenderer(),
            scene: s,
            camera: cc.camera,
            cameraController: cc,
            sceneManager: sm,
            instancedRenderer: ir,
            ambientLight: new THREE.AmbientLight(),
            directionalLight: new THREE.DirectionalLight(),
          };
          const rs = createRenderSystem(testCtx);

          const id = w.createEntity();
          w.addComponent<Position>(id, 'Position', { x: currX, y: 0, z: currZ });
          w.addComponent<PreviousPosition>(id, 'PreviousPosition', { x: prevX, y: 0, z: prevZ });
          w.addComponent<Renderable>(id, 'Renderable', { meshId: MeshId.Player, visible: true, scale: 1 });

          rs.update(w, alpha, 1 / 60);

          const mesh = rs.getMeshMap().get(id)!;
          const minX = Math.min(prevX, currX);
          const maxX = Math.max(prevX, currX);
          const minZ = Math.min(prevZ, currZ);
          const maxZ = Math.max(prevZ, currZ);

          expect(mesh.position.x).toBeGreaterThanOrEqual(minX - 0.001);
          expect(mesh.position.x).toBeLessThanOrEqual(maxX + 0.001);
          expect(mesh.position.z).toBeGreaterThanOrEqual(minZ - 0.001);
          expect(mesh.position.z).toBeLessThanOrEqual(maxZ + 0.001);

          rs.releaseAll();
          ir.dispose();
          sm.dispose();
        },
      ),
      { numRuns: 50 },
    );
  });
});

// ── Frozen game ─────────────────────────────────────────────────────────────

describe('frozen game produces static rendering', () => {
  it('entities remain at same position across multiple render frames with constant alpha', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 5, y: 0, z: 5 },
      { x: 5, y: 0, z: 5 },
    );

    renderSystem.update(world, 0, 1 / 60);
    const mesh = renderSystem.getMeshMap().get(id)!;
    const pos1 = mesh.position.clone();

    renderSystem.update(world, 0, 1 / 60);
    const pos2 = mesh.position.clone();

    renderSystem.update(world, 0, 1 / 60);
    const pos3 = mesh.position.clone();

    expect(pos1.x).toBeCloseTo(pos2.x, 5);
    expect(pos2.x).toBeCloseTo(pos3.x, 5);
    expect(pos1.z).toBeCloseTo(pos2.z, 5);
    expect(pos2.z).toBeCloseTo(pos3.z, 5);
  });
});

// ── Instanced mesh count ────────────────────────────────────────────────────

describe('instanced mesh count matches entity count', () => {
  it('instance count matches living entities after destruction', () => {
    const ids: EntityId[] = [];
    for (let i = 0; i < 5; i++) {
      ids.push(addRenderableEntity(MeshId.KnifeRusher, { x: i, y: 0, z: 0 }));
    }

    renderSystem.update(world, 1, 1 / 60);
    expect(instancedRenderer.getInstanceCount(MeshId.KnifeRusher)).toBe(5);

    // Destroy 3 entities
    world.destroyEntity(ids[0]);
    world.destroyEntity(ids[1]);
    world.destroyEntity(ids[2]);

    renderSystem.update(world, 1, 1 / 60);
    expect(instancedRenderer.getInstanceCount(MeshId.KnifeRusher)).toBe(2);
  });
});

// ── Mesh acquisition from pool ──────────────────────────────────────────────

describe('mesh pool management', () => {
  it('acquires mesh from pool for new non-instanced entity', () => {
    const id = addRenderableEntity(MeshId.Player, { x: 0, y: 0, z: 0 });

    renderSystem.update(world, 1, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id);
    expect(mesh).toBeDefined();
    expect(mesh!.visible).toBe(true);
  });

  it('releases mesh to pool when entity is destroyed', () => {
    const id = addRenderableEntity(MeshId.Player, { x: 0, y: 0, z: 0 });

    renderSystem.update(world, 1, 1 / 60);
    expect(renderSystem.getMeshMap().has(id)).toBe(true);

    world.destroyEntity(id);
    renderSystem.update(world, 1, 1 / 60);
    expect(renderSystem.getMeshMap().has(id)).toBe(false);
  });

  it('hidden entity (visible=false) keeps mesh but hides it', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 0, y: 0, z: 0 },
      undefined,
      { visible: false },
    );

    renderSystem.update(world, 1, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id);
    expect(mesh).toBeDefined();
    expect(mesh!.visible).toBe(false);
  });
});

// ── Rotation syncing ────────────────────────────────────────────────────────

describe('rotation component applied to mesh', () => {
  it('syncs rotation.y to mesh', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 0, y: 0, z: 0 },
      undefined,
      { rotation: Math.PI / 2 },
    );

    renderSystem.update(world, 1, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 2, 5);
  });
});

// ── Scale in instance matrices ──────────────────────────────────────────────

describe('instance matrix includes scale from Renderable', () => {
  it('applies scale to non-instanced entity mesh', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 0, y: 0, z: 0 },
      undefined,
      { scale: 2.5 },
    );

    renderSystem.update(world, 1, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    expect(mesh.scale.x).toBeCloseTo(2.5, 5);
    expect(mesh.scale.y).toBeCloseTo(2.5, 5);
    expect(mesh.scale.z).toBeCloseTo(2.5, 5);
  });
});

// ── Entity without Renderable not rendered ──────────────────────────────────

describe('entity without Renderable is not rendered', () => {
  it('does not create a mesh for entity without Renderable', () => {
    const id = world.createEntity();
    world.addComponent<Position>(id, 'Position', { x: 0, y: 0, z: 0 });
    // No Renderable component

    renderSystem.update(world, 1, 1 / 60);

    expect(renderSystem.getMeshMap().has(id)).toBe(false);
  });
});

// ── Weapon mesh visibility ──────────────────────────────────────────────────

describe('player weapon mesh visibility tracks active slot', () => {
  it('shows sidearm weapon mesh when activeSlot is Sidearm', () => {
    const id = addPlayerEntity(
      { x: 0, y: 0, z: 0 },
      undefined,
      WeaponSlot.Sidearm,
      GunType.Pistol,
    );

    renderSystem.update(world, 1, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    const pistolChild = mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.name === 'Pistol',
    ) as THREE.Mesh | undefined;
    const arChild = mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.name === 'AssaultRifle',
    ) as THREE.Mesh | undefined;

    expect(pistolChild).toBeDefined();
    expect(pistolChild!.visible).toBe(true);
    if (arChild) {
      expect(arChild.visible).toBe(false);
    }
  });

  it('shows long arm weapon mesh when activeSlot is LongArm', () => {
    const id = addPlayerEntity(
      { x: 0, y: 0, z: 0 },
      undefined,
      WeaponSlot.LongArm,
      GunType.Pistol,
    );

    renderSystem.update(world, 1, 1 / 60);

    const mesh = renderSystem.getMeshMap().get(id)!;
    const arChild = mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.name === 'AssaultRifle',
    ) as THREE.Mesh | undefined;
    const pistolChild = mesh.children.find(
      (c) => c instanceof THREE.Mesh && c.name === 'Pistol',
    ) as THREE.Mesh | undefined;

    expect(arChild).toBeDefined();
    expect(arChild!.visible).toBe(true);
    if (pistolChild) {
      expect(pistolChild.visible).toBe(false);
    }
  });
});

// ── Camera follows player ───────────────────────────────────────────────────

describe('camera follows player with smoothing', () => {
  it('camera moves toward player position', () => {
    addPlayerEntity({ x: 50, y: 0, z: 50 });

    const initialCamPos = ctx.camera.position.clone();

    renderSystem.update(world, 1, 1 / 60);

    // Camera should have moved toward the player
    const afterCamPos = ctx.camera.position.clone();
    expect(afterCamPos.x).not.toBeCloseTo(initialCamPos.x, 1);
  });
});

// ── Multiple instanced mesh types ───────────────────────────────────────────

describe('multiple instanced mesh types updated independently', () => {
  it('tracks separate counts for different mesh types', () => {
    for (let i = 0; i < 10; i++) {
      addRenderableEntity(MeshId.Bullet, { x: i, y: 0, z: 0 });
    }
    for (let i = 0; i < 5; i++) {
      addRenderableEntity(MeshId.EnemyBullet, { x: i, y: 0, z: 0 });
    }
    for (let i = 0; i < 20; i++) {
      addRenderableEntity(MeshId.XPGem, { x: i, y: 0, z: 0 });
    }

    renderSystem.update(world, 1, 1 / 60);

    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(10);
    expect(instancedRenderer.getInstanceCount(MeshId.EnemyBullet)).toBe(5);
    expect(instancedRenderer.getInstanceCount(MeshId.XPGem)).toBe(20);
  });
});

// ── Instanced mesh interpolation ────────────────────────────────────────────

describe('instanced mesh position interpolation', () => {
  it('interpolates instanced entity positions using alpha', () => {
    const id = world.createEntity();
    world.addComponent<Position>(id, 'Position', { x: 10, y: 0, z: 0 });
    world.addComponent<PreviousPosition>(id, 'PreviousPosition', { x: 0, y: 0, z: 0 });
    world.addComponent<Renderable>(id, 'Renderable', { meshId: MeshId.Bullet, visible: true, scale: 1 });

    // Update with alpha=0.5
    instancedRenderer.update(world, 0.5);

    // Verify the instance count is correct
    expect(instancedRenderer.getInstanceCount(MeshId.Bullet)).toBe(1);

    // Extract the matrix from the InstancedMesh
    const bulletGroup = scene.children.find((c) => c.name === 'EntityGroup');
    expect(bulletGroup).toBeDefined();

    const instancedMesh = bulletGroup!.children.find(
      (c) => c instanceof THREE.InstancedMesh && c.name === 'Instanced_Bullet',
    ) as THREE.InstancedMesh | undefined;
    expect(instancedMesh).toBeDefined();

    const matrix = new THREE.Matrix4();
    instancedMesh!.getMatrixAt(0, matrix);
    const position = new THREE.Vector3();
    position.setFromMatrixPosition(matrix);

    expect(position.x).toBeCloseTo(5, 4);
  });
});

// ── Render system is read-only ──────────────────────────────────────────────

describe('render system is read-only', () => {
  it('does not modify Position or PreviousPosition after render', () => {
    const id = addRenderableEntity(
      MeshId.Player,
      { x: 10, y: 5, z: 3 },
      { x: 0, y: 0, z: 0 },
    );

    renderSystem.update(world, 0.5, 1 / 60);

    const pos = world.getComponent<Position>(id, 'Position')!;
    const prev = world.getComponent<PreviousPosition>(id, 'PreviousPosition')!;
    expect(pos.x).toBe(10);
    expect(pos.y).toBe(5);
    expect(pos.z).toBe(3);
    expect(prev.x).toBe(0);
    expect(prev.y).toBe(0);
    expect(prev.z).toBe(0);
  });
});

// ── Edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles entity created and destroyed in same step gracefully', () => {
    const id = addRenderableEntity(MeshId.Bullet, { x: 0, y: 0, z: 0 });
    world.destroyEntity(id);

    expect(() => renderSystem.update(world, 1, 1 / 60)).not.toThrow();
  });

  it('releaseAll returns all tracked meshes to pool', () => {
    addRenderableEntity(MeshId.Player, { x: 0, y: 0, z: 0 });
    addRenderableEntity(MeshId.Boss, { x: 5, y: 0, z: 5 });

    renderSystem.update(world, 1, 1 / 60);
    expect(renderSystem.getMeshMap().size).toBe(2);

    renderSystem.releaseAll();
    expect(renderSystem.getMeshMap().size).toBe(0);
  });
});
