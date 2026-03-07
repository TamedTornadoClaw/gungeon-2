import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MeshId } from '../src/ecs/components';
import { getMeshDef, getAllMeshIds } from '../src/rendering/sceneManager';

describe('MiniBossKnifeRusher mesh scaffold', () => {
  it('MeshId.MiniBossKnifeRusher exists in MeshId enum', () => {
    expect(MeshId.MiniBossKnifeRusher).toBeDefined();
    expect(getAllMeshIds()).toContain(MeshId.MiniBossKnifeRusher);
  });

  it('has a mesh definition', () => {
    const def = getMeshDef(MeshId.MiniBossKnifeRusher);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
  });

  it('creates BoxGeometry with dimensions 1.2x2.2x1.2', () => {
    const def = getMeshDef(MeshId.MiniBossKnifeRusher);
    const geo = def.geometry();
    expect(geo).toBeInstanceOf(THREE.BoxGeometry);
    const params = (geo as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(1.2);
    expect(params.height).toBe(2.2);
    expect(params.depth).toBe(1.2);
  });

  it('uses dark red color (0xaa1111)', () => {
    const def = getMeshDef(MeshId.MiniBossKnifeRusher);
    expect(def.color).toBe(0xaa1111);
  });

  it('does not skip outline generation', () => {
    const def = getMeshDef(MeshId.MiniBossKnifeRusher);
    expect(def.noOutline).toBeFalsy();
  });
});
