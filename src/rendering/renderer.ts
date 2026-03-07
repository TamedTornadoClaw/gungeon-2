import * as THREE from 'three';
import { createCameraController, type CameraController } from './cameraController';

export { spawnDamageNumber, updateDamageNumbers, clearDamageNumbers, getActiveDamageNumbers } from './damageNumbers';
export type { DamageNumber } from './damageNumbers';
export { createCameraController, updateCamera, addScreenShake } from './cameraController';
export type { CameraController } from './cameraController';

export interface RendererContext {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  cameraController: CameraController;
  ambientLight: THREE.AmbientLight;
  directionalLight: THREE.DirectionalLight;
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

  return { renderer, scene, camera, cameraController, ambientLight, directionalLight };
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
}

export function unmountRenderer(ctx: RendererContext): void {
  const canvas = ctx.renderer.domElement;
  canvas.parentElement?.removeChild(canvas);
}

export function renderFrame(ctx: RendererContext, _alpha: number): void {
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

    // Alpha represents the interpolation factor between the last fixed
    // timestep state and the current one.  The game loop is responsible
    // for computing the true alpha; here we pass dt so the caller can
    // derive it.  When no game loop is connected yet, default to 1.
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
