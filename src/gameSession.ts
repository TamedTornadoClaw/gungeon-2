import { World } from './ecs/world';
import { createGameLoop, buildAimCollisionMesh, disposeAimCollisionMesh, type GameLoop } from './gameloop/gameLoop';
import { createEffectsBuffer } from './systems/effectsPipelineSystem';
import { createRenderSystem, type RenderSystem } from './rendering/renderer';
import { initRenderer, mountRenderer, disposeRenderer, type RendererContext } from './rendering/renderer';
import { InputManager } from './input/inputManager';
import { getAudioManager } from './audio/audioManager';
import { generateDungeon } from './dungeon/generator';
import { createDungeonEntities } from './dungeon/dungeonEntityCreator';
import { createPlayer } from './ecs/factories';
import { initialReveal } from './systems/visibilitySystem';
import { GunType } from './ecs/components';
import { useAppStore } from './store/appStore';
import type { FloorState } from './systems/floorTransitionSystem';

export interface GameSession {
  gameLoop: GameLoop;
  world: World;
  rendererCtx: RendererContext;
  renderSystem: RenderSystem;
  inputManager: InputManager;
  floorState: FloorState;
  cleanup: () => void;
}

export function createGameSession(canvasContainer: HTMLElement): GameSession {
  const state = useAppStore.getState();
  const selectedLongArm = state.selectedLongArm ?? GunType.AssaultRifle;

  const world = new World();
  const floorState: FloorState = { currentDepth: 1, seed: Date.now() };
  const dungeon = generateDungeon(floorState.seed, floorState.currentDepth);
  createDungeonEntities(world, dungeon, floorState.currentDepth);
  createPlayer(world, dungeon.playerStart, selectedLongArm);
  initialReveal(world);
  buildAimCollisionMesh(world);

  const rendererCtx = initRenderer();
  mountRenderer(rendererCtx, canvasContainer);

  const renderSystem = createRenderSystem(rendererCtx);

  const inputManager = new InputManager();
  inputManager.setCamera(rendererCtx.camera, rendererCtx.renderer.domElement);
  inputManager.attach(document);

  const audioManager = getAudioManager();
  const effectsBuffer = createEffectsBuffer();

  const gameLoop = createGameLoop({
    world,
    inputManager,
    audioManager,
    cameraController: rendererCtx.cameraController,
    floorState,
    effectsBuffer,
    onRender: (alpha) => renderSystem.update(world, alpha, 0),
  });

  // Click on canvas to request pointer lock
  const canvas = rendererCtx.renderer.domElement;
  const onCanvasClick = () => inputManager.requestPointerLock();
  canvas.addEventListener('click', onCanvasClick);

  const cleanup = () => {
    canvas.removeEventListener('click', onCanvasClick);
    inputManager.exitPointerLock();
    renderSystem.releaseAll();
    inputManager.detach(document);
    disposeAimCollisionMesh();
    disposeRenderer(rendererCtx);
  };

  return { gameLoop, world, rendererCtx, renderSystem, inputManager, floorState, cleanup };
}
