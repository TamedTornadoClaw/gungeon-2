import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import {
  spawnDamageNumber,
  updateDamageNumbers,
  clearDamageNumbers,
  getActiveDamageNumbers,
} from '../src/rendering/damageNumbers';

// Mock canvas for createTextTexture
const mockContext = {
  clearRect: vi.fn(),
  strokeText: vi.fn(),
  fillText: vi.fn(),
  font: '',
  textAlign: '',
  textBaseline: '',
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
};

vi.stubGlobal('document', {
  createElement: (tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0,
        height: 0,
        getContext: () => mockContext,
      };
    }
    throw new Error(`Unexpected createElement("${tag}")`);
  },
});

describe('damageNumbers', () => {
  let scene: THREE.Scene;

  beforeEach(() => {
    scene = new THREE.Scene();
    clearDamageNumbers(scene);
  });

  describe('spawnDamageNumber', () => {
    it('adds a sprite to the scene', () => {
      const pos = new THREE.Vector3(1, 2, 3);
      spawnDamageNumber(scene, pos, 10, false);

      const active = getActiveDamageNumbers();
      expect(active).toHaveLength(1);
      expect(active[0].sprite).toBeInstanceOf(THREE.Sprite);
      expect(scene.children).toContain(active[0].sprite);
    });

    it('positions the sprite at the given position', () => {
      const pos = new THREE.Vector3(5, 10, 15);
      spawnDamageNumber(scene, pos, 25, false);

      const sprite = getActiveDamageNumbers()[0].sprite;
      expect(sprite.position.x).toBe(5);
      expect(sprite.position.y).toBe(10);
      expect(sprite.position.z).toBe(15);
    });
  });

  describe('updateDamageNumbers', () => {
    it('moves the sprite upward over time', () => {
      const pos = new THREE.Vector3(0, 0, 0);
      spawnDamageNumber(scene, pos, 10, false);

      const startY = getActiveDamageNumbers()[0].sprite.position.y;
      updateDamageNumbers(scene, 0.1);
      const endY = getActiveDamageNumbers()[0].sprite.position.y;

      expect(endY).toBeGreaterThan(startY);
    });

    it('fades opacity over time', () => {
      spawnDamageNumber(scene, new THREE.Vector3(), 10, false);
      updateDamageNumbers(scene, 0.1);

      const material = getActiveDamageNumbers()[0].sprite
        .material as THREE.SpriteMaterial;
      expect(material.opacity).toBeLessThan(1);
    });
  });

  describe('expiry and removal', () => {
    it('removes expired damage numbers from the scene', () => {
      spawnDamageNumber(scene, new THREE.Vector3(), 10, false);
      const sprite = getActiveDamageNumbers()[0].sprite;
      const lifetime = getActiveDamageNumbers()[0].lifetime;

      // Advance past lifetime
      updateDamageNumbers(scene, lifetime + 0.1);

      expect(getActiveDamageNumbers()).toHaveLength(0);
      expect(scene.children).not.toContain(sprite);
    });
  });

  describe('clearDamageNumbers', () => {
    it('removes all active numbers', () => {
      spawnDamageNumber(scene, new THREE.Vector3(0, 0, 0), 5, false);
      spawnDamageNumber(scene, new THREE.Vector3(1, 1, 1), 10, true);
      expect(getActiveDamageNumbers()).toHaveLength(2);

      clearDamageNumbers(scene);
      expect(getActiveDamageNumbers()).toHaveLength(0);
    });
  });
});
