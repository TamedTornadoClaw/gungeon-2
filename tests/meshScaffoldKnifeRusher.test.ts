import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { MeshId } from '../src/ecs/components';
import { getMeshDef, getAllMeshIds } from '../src/rendering/sceneManager';

describe('KnifeRusher mesh scaffold', () => {
  it('MeshId.KnifeRusher exists in MeshId enum', () => {
    expect(MeshId.KnifeRusher).toBeDefined();
    expect(getAllMeshIds()).toContain(MeshId.KnifeRusher);
  });

  it('has a mesh definition', () => {
    const def = getMeshDef(MeshId.KnifeRusher);
    expect(def).toBeDefined();
    expect(def.geometry).toBeTypeOf('function');
  });

  it('creates BoxGeometry with dimensions 0.8x1.5x0.8', () => {
    const def = getMeshDef(MeshId.KnifeRusher);
    const geo = def.geometry();
    expect(geo).toBeInstanceOf(THREE.BoxGeometry);
    const params = (geo as THREE.BoxGeometry).parameters;
    expect(params.width).toBe(0.8);
    expect(params.height).toBe(1.5);
    expect(params.depth).toBe(0.8);
  });

  it('uses red color (0xff2222)', () => {
    const def = getMeshDef(MeshId.KnifeRusher);
    expect(def.color).toBe(0xff2222);
  });

  it('does not skip outline generation', () => {
    const def = getMeshDef(MeshId.KnifeRusher);
    expect(def.noOutline).toBeFalsy();
  });
});
