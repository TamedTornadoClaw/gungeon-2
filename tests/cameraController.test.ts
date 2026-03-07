import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import {
  createCameraController,
  updateCamera,
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

    it('positions camera using angle and distance from design params', () => {
      const { angle, distance } = params.camera;
      const angleRad = (angle * Math.PI) / 180;
      const expectedY = distance * Math.sin(angleRad);
      const expectedZ = distance * Math.cos(angleRad);

      expect(ctrl.camera.position.x).toBeCloseTo(0);
      expect(ctrl.camera.position.y).toBeCloseTo(expectedY);
      expect(ctrl.camera.position.z).toBeCloseTo(expectedZ);
    });

    it('initializes with zero shake intensity', () => {
      expect(ctrl.shakeIntensity).toBe(0);
    });

    it('initializes target position at origin', () => {
      expect(ctrl.targetPosition.x).toBe(0);
      expect(ctrl.targetPosition.y).toBe(0);
      expect(ctrl.targetPosition.z).toBe(0);
    });
  });

  describe('updateCamera', () => {
    it('smoothly interpolates toward player position', () => {
      updateCamera(ctrl, 10, 0, 5, 1 / 60);

      // After one frame, target should have moved toward player but not reached it
      expect(ctrl.targetPosition.x).toBeGreaterThan(0);
      expect(ctrl.targetPosition.x).toBeLessThan(10);
      expect(ctrl.targetPosition.z).toBeGreaterThan(0);
      expect(ctrl.targetPosition.z).toBeLessThan(5);
    });

    it('converges on player position after many frames', () => {
      const dt = 1 / 60;
      for (let i = 0; i < 600; i++) {
        updateCamera(ctrl, 10, 0, 5, dt);
      }

      expect(ctrl.targetPosition.x).toBeCloseTo(10, 1);
      expect(ctrl.targetPosition.y).toBeCloseTo(0, 1);
      expect(ctrl.targetPosition.z).toBeCloseTo(5, 1);
    });

    it('camera always looks at target position after update', () => {
      updateCamera(ctrl, 5, 0, 3, 1 / 60);

      // The camera's "look at" direction should point toward the target.
      // We verify by checking that a vector from camera to target is roughly
      // aligned with the camera's forward direction (-z in camera space).
      const cameraDir = ctrl.camera.getWorldDirection(new THREE.Vector3());
      const toTarget = ctrl.targetPosition
        .clone()
        .sub(ctrl.camera.position)
        .normalize();
      const dot = cameraDir.dot(toTarget);
      expect(dot).toBeCloseTo(1, 1);
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
              updateCamera(c, px, py, pz, dt);
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

      updateCamera(ctrl, 0, 0, 0, 1 / 60);
      expect(ctrl.shakeIntensity).toBeLessThan(initial);
      expect(ctrl.shakeIntensity).toBeGreaterThan(0);
    });

    it('shake below epsilon snaps to zero', () => {
      addScreenShake(ctrl, 0.0005);
      updateCamera(ctrl, 0, 0, 0, 1 / 60);
      expect(ctrl.shakeIntensity).toBe(0);
    });

    it('shake fully decays to zero after many frames', () => {
      addScreenShake(ctrl, 5.0);
      const dt = 1 / 60;
      for (let i = 0; i < 600; i++) {
        updateCamera(ctrl, 0, 0, 0, dt);
      }
      expect(ctrl.shakeIntensity).toBe(0);
    });
  });
});
