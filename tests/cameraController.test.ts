import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import {
  createCameraController,
  updateCameraOrbit,
  updateCameraPosition,
  addScreenShake,
  type CameraController,
} from '../src/rendering/cameraController';
import { getDesignParams } from '../src/config/designParams';

describe('cameraController', () => {
  let ctrl: CameraController;
  const params = getDesignParams();

  beforeEach(() => {
    ctrl = createCameraController();
  });

  describe('createCameraController', () => {
    it('creates a camera with fov from design params', () => {
      expect(ctrl.camera.fov).toBe(params.camera.fov);
    });

    it('initializes with zero shake intensity', () => {
      expect(ctrl.shakeIntensity).toBe(0);
    });

    it('initializes target position at origin', () => {
      expect(ctrl.targetPosition.x).toBe(0);
      expect(ctrl.targetPosition.y).toBe(0);
      expect(ctrl.targetPosition.z).toBe(0);
    });

    it('initializes orbitYaw at 0', () => {
      expect(ctrl.orbitYaw).toBe(0);
    });

    it('initializes orbitPitch at midpoint of pitchMin and pitchMax', () => {
      const expected = (params.camera.pitchMin + params.camera.pitchMax) / 2;
      expect(ctrl.orbitPitch).toBeCloseTo(expected);
    });
  });

  describe('updateCameraOrbit', () => {
    it('applies mouse deltas × sensitivity to yaw', () => {
      const deltaX = 100;
      updateCameraOrbit(ctrl, deltaX, 0);
      expect(ctrl.orbitYaw).toBeCloseTo(-deltaX * params.camera.mouseSensitivity);
    });

    it('applies mouse deltas × sensitivity to pitch', () => {
      ctrl.orbitPitch = 0;
      const deltaY = 50;
      updateCameraOrbit(ctrl, 0, deltaY);
      const expected = -deltaY * params.camera.mouseSensitivity;
      expect(ctrl.orbitPitch).toBeCloseTo(expected);
    });

    it('clamps pitch to [pitchMin, pitchMax]', () => {
      // Push pitch way down (large positive deltaY)
      ctrl.orbitPitch = 0;
      updateCameraOrbit(ctrl, 0, 100000);
      expect(ctrl.orbitPitch).toBeCloseTo(params.camera.pitchMin);

      // Push pitch way up (large negative deltaY)
      ctrl.orbitPitch = 0;
      updateCameraOrbit(ctrl, 0, -100000);
      expect(ctrl.orbitPitch).toBeCloseTo(params.camera.pitchMax);
    });

    it('yaw wraps around ±PI correctly', () => {
      ctrl.orbitYaw = Math.PI - 0.01;
      updateCameraOrbit(ctrl, -1000, 0); // yaw increases
      expect(ctrl.orbitYaw).toBeGreaterThanOrEqual(-Math.PI);
      expect(ctrl.orbitYaw).toBeLessThanOrEqual(Math.PI);
    });

    it('zero deltas = stable camera orbit', () => {
      const initialYaw = ctrl.orbitYaw;
      const initialPitch = ctrl.orbitPitch;
      updateCameraOrbit(ctrl, 0, 0);
      expect(ctrl.orbitYaw).toBe(initialYaw);
      expect(ctrl.orbitPitch).toBe(initialPitch);
    });
  });

  describe('updateCameraPosition', () => {
    it('snaps to player position on first call', () => {
      updateCameraPosition(ctrl, 10, 0, 5, 1 / 60);
      expect(ctrl.targetPosition.x).toBe(10);
      expect(ctrl.targetPosition.z).toBe(5);
      expect(ctrl.hasSnapped).toBe(true);
    });

    it('smoothly interpolates toward player position after snap', () => {
      updateCameraPosition(ctrl, 0, 0, 0, 1 / 60);
      updateCameraPosition(ctrl, 10, 0, 5, 1 / 60);
      expect(ctrl.targetPosition.x).toBeGreaterThan(0);
      expect(ctrl.targetPosition.x).toBeLessThan(10);
      expect(ctrl.targetPosition.z).toBeGreaterThan(0);
      expect(ctrl.targetPosition.z).toBeLessThan(5);
    });

    it('converges on player position after many frames', () => {
      const dt = 1 / 60;
      for (let i = 0; i < 600; i++) {
        updateCameraPosition(ctrl, 10, 0, 5, dt);
      }
      expect(ctrl.targetPosition.x).toBeCloseTo(10, 1);
      expect(ctrl.targetPosition.y).toBeCloseTo(0, 1);
      expect(ctrl.targetPosition.z).toBeCloseTo(5, 1);
    });

    it('camera is positioned above the player (shoulderHeight)', () => {
      ctrl.orbitYaw = 0;
      ctrl.orbitPitch = 0;
      updateCameraPosition(ctrl, 0, 0, 0, 1 / 60);
      expect(ctrl.camera.position.y).toBeGreaterThan(0);
    });

    it('camera orientation is set via quaternion, not lookAt', () => {
      ctrl.orbitYaw = 0.5;
      ctrl.orbitPitch = 0.2;
      updateCameraPosition(ctrl, 0, 0, 0, 1 / 60);

      const q = ctrl.camera.quaternion;
      const isIdentity = q.x === 0 && q.y === 0 && q.z === 0 && q.w === 1;
      expect(isIdentity).toBe(false);
    });

    it('pitch controls where camera points vertically', () => {
      ctrl.orbitYaw = 0;
      ctrl.orbitPitch = 0.5;
      updateCameraPosition(ctrl, 0, 0, 0, 1 / 60);
      const forwardUp = new THREE.Vector3(0, 0, -1).applyQuaternion(ctrl.camera.quaternion);

      ctrl.orbitPitch = -0.5;
      updateCameraPosition(ctrl, 0, 0, 0, 1 / 60);
      const forwardDown = new THREE.Vector3(0, 0, -1).applyQuaternion(ctrl.camera.quaternion);

      expect(forwardUp.y).toBeGreaterThan(forwardDown.y);
    });

    it('converges for arbitrary player positions (property-based)', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          fc.float({ min: -100, max: 100, noNaN: true }),
          (px, py, pz) => {
            const c = createCameraController();
            const dt = 1 / 60;
            for (let i = 0; i < 600; i++) {
              updateCameraPosition(c, px, py, pz, dt);
            }
            expect(c.targetPosition.x).toBeCloseTo(px, 0);
            expect(c.targetPosition.y).toBeCloseTo(py, 0);
            expect(c.targetPosition.z).toBeCloseTo(pz, 0);
          },
        ),
      );
    });
  });

  describe('addScreenShake', () => {
    it('increases shake intensity additively', () => {
      addScreenShake(ctrl, 0.5);
      expect(ctrl.shakeIntensity).toBe(0.5);

      addScreenShake(ctrl, 0.3);
      expect(ctrl.shakeIntensity).toBeCloseTo(0.8);
    });

    it('stacks multiple shakes (property-based)', () => {
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: 0, max: 10, noNaN: true }), {
            minLength: 1,
            maxLength: 10,
          }),
          (intensities) => {
            const c = createCameraController();
            let total = 0;
            for (const intensity of intensities) {
              addScreenShake(c, intensity);
              total += intensity;
            }
            expect(c.shakeIntensity).toBeCloseTo(total, 4);
          },
        ),
      );
    });
  });

  describe('shake decay', () => {
    it('shake decays exponentially toward zero', () => {
      addScreenShake(ctrl, 1.0);
      const initial = ctrl.shakeIntensity;

      updateCameraPosition(ctrl, 0, 0, 0, 1 / 60);
      expect(ctrl.shakeIntensity).toBeLessThan(initial);
      expect(ctrl.shakeIntensity).toBeGreaterThan(0);
    });

    it('shake below epsilon snaps to zero', () => {
      addScreenShake(ctrl, 0.0005);
      updateCameraPosition(ctrl, 0, 0, 0, 1 / 60);
      expect(ctrl.shakeIntensity).toBe(0);
    });

    it('shake fully decays to zero after many frames', () => {
      addScreenShake(ctrl, 5.0);
      const dt = 1 / 60;
      for (let i = 0; i < 600; i++) {
        updateCameraPosition(ctrl, 0, 0, 0, dt);
      }
      expect(ctrl.shakeIntensity).toBe(0);
    });
  });
});
