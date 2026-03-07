/**
 * Damage number floating text system.
 *
 * Integration: The game loop's render phase should call `spawnDamageNumber` when
 * a damage event is emitted and `updateDamageNumbers` every frame. The expected
 * integration point is the main render loop in `src/rendering/` or the game
 * loop orchestrator in `src/gameloop/`. `clearDamageNumbers` should be called
 * on scene teardown (e.g. room transitions or returning to menu).
 */
import * as THREE from 'three';
import { getDesignParams } from '../config/designParams';

// --- Rendering constants ---
const CANVAS_WIDTH = 128;
const CANVAS_HEIGHT = 64;
const FONT_SIZE_NORMAL = 36;
const FONT_SIZE_CRIT = 48;
const STROKE_WIDTH = 4;
const BASE_SCALE = 1.0;

const COLOR_STROKE = '#000000';
const COLOR_NORMAL = '#ffffff';
const COLOR_CRIT = '#ffff00';

export interface DamageNumber {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
}

const activeNumbers: DamageNumber[] = [];

function createTextTexture(text: string, isCrit: boolean): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const fontSize = isCrit ? FONT_SIZE_CRIT : FONT_SIZE_NORMAL;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.strokeStyle = COLOR_STROKE;
  ctx.lineWidth = STROKE_WIDTH;
  ctx.strokeText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  ctx.fillStyle = isCrit ? COLOR_CRIT : COLOR_NORMAL;
  ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function spawnDamageNumber(
  scene: THREE.Scene,
  position: THREE.Vector3,
  amount: number,
  isCrit: boolean,
): void {
  const params = getDesignParams().damageNumbers;
  const texture = createTextTexture(String(Math.round(amount)), isCrit);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });

  const sprite = new THREE.Sprite(material);
  sprite.position.copy(position);

  const scale = isCrit ? BASE_SCALE * params.critScale : BASE_SCALE;
  sprite.scale.set(scale * 2, scale, 1);

  scene.add(sprite);

  activeNumbers.push({
    sprite,
    velocity: new THREE.Vector3(0, params.driftSpeed, 0),
    age: 0,
    lifetime: params.lifetime,
  });
}

export function updateDamageNumbers(scene: THREE.Scene, dt: number): void {
  for (let i = activeNumbers.length - 1; i >= 0; i--) {
    const dn = activeNumbers[i];
    dn.age += dt;

    if (dn.age >= dn.lifetime) {
      scene.remove(dn.sprite);
      dn.sprite.material.map?.dispose();
      dn.sprite.material.dispose();
      activeNumbers.splice(i, 1);
      continue;
    }

    // Drift upward
    dn.sprite.position.addScaledVector(dn.velocity, dt);

    // Fade out linearly
    const alpha = 1 - dn.age / dn.lifetime;
    (dn.sprite.material as THREE.SpriteMaterial).opacity = alpha;
  }
}

export function getActiveDamageNumbers(): ReadonlyArray<DamageNumber> {
  return activeNumbers;
}

export function clearDamageNumbers(scene: THREE.Scene): void {
  for (const dn of activeNumbers) {
    scene.remove(dn.sprite);
    dn.sprite.material.map?.dispose();
    dn.sprite.material.dispose();
  }
  activeNumbers.length = 0;
}
