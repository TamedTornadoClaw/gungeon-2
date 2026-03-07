import { World } from '../ecs/world';
import { createEventQueue } from './events';
import { getDesignParams } from '../config/designParams';
import { InputManager, type InputState } from '../input/inputManager';
import { AudioManager } from '../audio/audioManager';
import { inputSystem } from '../systems/inputSystem';
import { playerControlSystem } from '../systems/playerControlSystem';
import { dodgeRollSystem } from '../systems/dodgeRollSystem';
import { aiSystem } from '../systems/aiSystem';
import { projectileSystem } from '../systems/projectileSystem';
import { enemyWeaponSystem } from '../systems/enemyWeaponSystem';
import { movementSystem } from '../systems/movementSystem';
import {
  collisionDetectionSystem,
  type CollisionEntity,
} from '../systems/collisionDetectionSystem';
import {
  collisionResponseSystem,
  updateSpikeCooldowns,
} from '../systems/collisionResponseSystem';
import { damageSystem } from '../systems/damageSystem';
import { shieldRegenSystem } from '../systems/shieldRegenSystem';
import { hazardSystem } from '../systems/hazardSystem';
import { lifetimeSystem } from '../systems/lifetimeSystem';
import { pickupSystem } from '../systems/pickupSystem';
import { chestSystem } from '../systems/chestSystem';
import { shopSystem } from '../systems/shopSystem';
import { gunXPSystem } from '../systems/gunXPSystem';
import { destructibleSystem } from '../systems/destructibleSystem';
import { doorSystem } from '../systems/doorSystem';
import { spawnSystem } from '../systems/spawnSystem';
import { floorTransitionSystem, type FloorState } from '../systems/floorTransitionSystem';
import { deathSystem } from '../systems/deathSystem';
import { expireModifiersSystem } from '../systems/expireModifiersSystem';
import { particleSystem } from '../systems/particleSystem';
import { audioEventSystem } from '../systems/audioEventSystem';
import type { Position, Collider } from '../ecs/components';

export { gunStatSystem } from '../systems/gunStatSystem';
export { purchaseShopItem } from '../systems/shopSystem';
export { createLoopManager } from '../systems/audioEventSystem';
export { generateDungeon } from '../dungeon/generator';
export { createParticleRenderer } from '../rendering/particleRenderer';
export { createRenderSystem } from '../rendering/renderer';
export type { RenderSystem } from '../rendering/renderer';

const { gameLoop: gameLoopParams } = getDesignParams();
const FIXED_TIMESTEP = gameLoopParams.fixedTimestep;
const MAX_FRAME_TIME = gameLoopParams.maxFrameTime;

export interface GameLoopDeps {
  world: World;
  inputManager: InputManager;
  audioManager: AudioManager;
  floorState: FloorState;
  onRender?: (alpha: number) => void;
}

export interface GameLoop {
  start(): void;
  stop(): void;
  freeze(): void;
  resume(): void;
}

export function createGameLoop(deps: GameLoopDeps): GameLoop {
  const eventQueue = createEventQueue();

  let running = false;
  let frozen = false;
  let accumulator = 0;
  let lastTimestamp = -1;
  let rafId: number | null = null;

  function tick(timestamp: number): void {
    if (!running) return;

    rafId = requestAnimationFrame(tick);

    if (lastTimestamp < 0) {
      lastTimestamp = timestamp;
      deps.onRender?.(0);
      return;
    }

    let elapsed = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    // Guard against negative dt (browser bugs / timestamp wraps)
    if (elapsed < 0) elapsed = 0;

    if (!frozen) {
      // Spiral-of-death protection: clamp before adding to accumulator
      if (elapsed > MAX_FRAME_TIME) {
        elapsed = MAX_FRAME_TIME;
      }
      accumulator += elapsed;

      while (accumulator >= FIXED_TIMESTEP) {
        simulationStep(FIXED_TIMESTEP);
        accumulator -= FIXED_TIMESTEP;
      }
    }

    // Render even when frozen (for pause overlays)
    const alpha = frozen ? 0 : accumulator / FIXED_TIMESTEP;
    deps.onRender?.(alpha);
  }

  function simulationStep(dt: number): void {
    const { world, inputManager, audioManager, floorState } = deps;

    // 1. Input
    const input: InputState = inputSystem(inputManager);

    // 2. PlayerControl
    playerControlSystem(world, input, dt);

    // 3. DodgeRoll
    dodgeRollSystem(world, dt);

    // 4. AI
    aiSystem(world, dt, floorState.currentDepth);

    // 5. Projectile
    projectileSystem(world, dt, eventQueue);

    // 6. EnemyWeapon
    enemyWeaponSystem(world, dt);

    // 7. Movement
    movementSystem(world, dt);

    // 8. CollisionDetection
    const collisionEntities: CollisionEntity[] = world
      .query(['Position', 'Collider'])
      .map((id) => ({
        id,
        position: world.getComponent<Position>(id, 'Position')!,
        collider: world.getComponent<Collider>(id, 'Collider')!,
      }));
    const pairs = collisionDetectionSystem(collisionEntities);

    // 9. CollisionResponse
    updateSpikeCooldowns(dt, world);
    collisionResponseSystem(pairs, world, eventQueue);

    // 10. Damage
    damageSystem(world, eventQueue);

    // 11. ShieldRegen
    shieldRegenSystem(world, dt);

    // 12. Hazard
    hazardSystem(world, eventQueue, dt);

    // 13. Lifetime
    lifetimeSystem(world, dt);

    // 14. Pickup
    pickupSystem(world, input, eventQueue, dt);

    // 15. Chest
    chestSystem(world, input, eventQueue);

    // 16. Shop
    shopSystem(world, input, eventQueue);

    // 17. GunXP
    gunXPSystem(world);

    // 18. Destructible
    destructibleSystem(world, eventQueue);

    // 19. Door
    doorSystem(world, eventQueue);

    // 20. Spawn
    spawnSystem(world, floorState.currentDepth);

    // 21. FloorTransition
    floorTransitionSystem(world, input, eventQueue, floorState);

    // 22. Death
    deathSystem(world, eventQueue);

    // 23. ExpireModifiers
    expireModifiersSystem(world);

    // 24. Particle
    particleSystem(world, eventQueue, dt);

    // 25. Audio
    audioEventSystem(eventQueue, audioManager);

    // Clear event queue for next step
    eventQueue.clear();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      frozen = false;
      accumulator = 0;
      lastTimestamp = -1;
      rafId = requestAnimationFrame(tick);
    },

    stop(): void {
      if (!running) return;
      running = false;
      frozen = false;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    },

    freeze(): void {
      if (!running || frozen) return;
      frozen = true;
    },

    resume(): void {
      if (!running || !frozen) return;
      frozen = false;
      accumulator = 0;
      lastTimestamp = -1;
    },
  };
}
