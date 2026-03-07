import * as THREE from 'three';
import { getDesignParams } from '../config/designParams';

export interface DamageNumber {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  age: number;
  lifetime: number;
}

const activeNumbers: DamageNumber[] = [];

function createTextTexture(text: string, isCrit: boolean): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const fontSize = isCrit ? 48 : 36;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Black outline
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  ctx.strokeText(text, canvas.width / 2, canvas.height / 2);

  // Fill color: yellow for crits, white for normal
  ctx.fillStyle = isCrit ? '#ffff00' : '#ffffff';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

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

  const baseScale = 1.0;
  const scale = isCrit ? baseScale * params.critScale : baseScale;
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

export function clearDamageNumbers(scene: THREE.Scene): void {
  for (const dn of activeNumbers) {
    scene.remove(dn.sprite);
    dn.sprite.material.map?.dispose();
    dn.sprite.material.dispose();
  }
  activeNumbers.length = 0;
}
