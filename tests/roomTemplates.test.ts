import { describe, it, expect } from 'vitest';
import {
  ROOM_TEMPLATES,
  DESTRUCTIBLE_MESH,
  type RoomTemplate,
} from '../src/dungeon/roomTemplates.js';
import { getDesignParams } from '../src/config/designParams.js';
import { DestructibleType, HazardType, MeshId } from '../src/ecs/components.js';

const params = getDesignParams();
const { roomMinSize, roomMaxSize } = params.dungeon;

describe('Room Templates', () => {
  it('defines at least 5 distinct templates', () => {
    expect(ROOM_TEMPLATES.length).toBeGreaterThanOrEqual(5);
  });

  it('has at least 3 distinct dimension combinations', () => {
    const dimensions = new Set(
      ROOM_TEMPLATES.map((t) => `${t.width}x${t.height}`)
    );
    expect(dimensions.size).toBeGreaterThanOrEqual(3);
  });

  describe.each(ROOM_TEMPLATES.map((t, i) => ({ t, i })))(
    'template $i ("$t.name")',
    ({ t }: { t: RoomTemplate }) => {
      it(`width (${t.width}) is within [${roomMinSize}, ${roomMaxSize}]`, () => {
        expect(t.width).toBeGreaterThanOrEqual(roomMinSize);
        expect(t.width).toBeLessThanOrEqual(roomMaxSize);
      });

      it(`height (${t.height}) is within [${roomMinSize}, ${roomMaxSize}]`, () => {
        expect(t.height).toBeGreaterThanOrEqual(roomMinSize);
        expect(t.height).toBeLessThanOrEqual(roomMaxSize);
      });

      it('has at least one spawn zone', () => {
        expect(t.spawnZones.length).toBeGreaterThanOrEqual(1);
      });

      it('spawn zones are fully within room bounds', () => {
        for (const zone of t.spawnZones) {
          const left = zone.x - zone.width / 2;
          const right = zone.x + zone.width / 2;
          const top = zone.z - zone.height / 2;
          const bottom = zone.z + zone.height / 2;

          expect(left).toBeGreaterThanOrEqual(0);
          expect(right).toBeLessThanOrEqual(t.width);
          expect(top).toBeGreaterThanOrEqual(0);
          expect(bottom).toBeLessThanOrEqual(t.height);
        }
      });

      it('spawn zone enemy counts are within config bounds', () => {
        const { min, max } = params.dungeon.enemiesPerRoom;
        for (const zone of t.spawnZones) {
          expect(zone.enemyCount).toBeGreaterThanOrEqual(min);
          expect(zone.enemyCount).toBeLessThanOrEqual(max);
        }
      });

      it('spawn zones have non-empty enemyTypes', () => {
        for (const zone of t.spawnZones) {
          expect(zone.enemyTypes.length).toBeGreaterThanOrEqual(1);
        }
      });

      it('hazard placements use valid HazardType values', () => {
        const validTypes = new Set(Object.values(HazardType));
        for (const hazard of t.hazards) {
          expect(validTypes.has(hazard.hazardType)).toBe(true);
        }
      });

      it('hazard placements are within room bounds', () => {
        for (const hazard of t.hazards) {
          const left = hazard.x - hazard.width / 2;
          const right = hazard.x + hazard.width / 2;
          const top = hazard.z - hazard.height / 2;
          const bottom = hazard.z + hazard.height / 2;

          expect(left).toBeGreaterThanOrEqual(0);
          expect(right).toBeLessThanOrEqual(t.width);
          expect(top).toBeGreaterThanOrEqual(0);
          expect(bottom).toBeLessThanOrEqual(t.height);
        }
      });

      it('destructible placements use valid types', () => {
        const validTypes = new Set(Object.values(DestructibleType));
        for (const d of t.destructibles) {
          expect(validTypes.has(d.destructibleType)).toBe(true);
        }
      });

      it('destructible placements map to valid MeshIds', () => {
        for (const d of t.destructibles) {
          const meshId = DESTRUCTIBLE_MESH[d.destructibleType];
          expect(Object.values(MeshId)).toContain(meshId);
        }
      });

      it('destructible positions are within room bounds', () => {
        for (const d of t.destructibles) {
          expect(d.x).toBeGreaterThanOrEqual(0);
          expect(d.x).toBeLessThanOrEqual(t.width);
          expect(d.z).toBeGreaterThanOrEqual(0);
          expect(d.z).toBeLessThanOrEqual(t.height);
        }
      });

      it('chest placement (if present) is within room bounds', () => {
        if (t.chestPlacement) {
          expect(t.chestPlacement.x).toBeGreaterThanOrEqual(0);
          expect(t.chestPlacement.x).toBeLessThanOrEqual(t.width);
          expect(t.chestPlacement.z).toBeGreaterThanOrEqual(0);
          expect(t.chestPlacement.z).toBeLessThanOrEqual(t.height);
        }
      });

      it('shop placement (if present) is within room bounds', () => {
        if (t.shopPlacement) {
          expect(t.shopPlacement.x).toBeGreaterThanOrEqual(0);
          expect(t.shopPlacement.x).toBeLessThanOrEqual(t.width);
          expect(t.shopPlacement.z).toBeGreaterThanOrEqual(0);
          expect(t.shopPlacement.z).toBeLessThanOrEqual(t.height);
        }
      });

      it('no destructible is placed at a spawn zone center', () => {
        for (const zone of t.spawnZones) {
          for (const d of t.destructibles) {
            const samePos = d.x === zone.x && d.z === zone.z;
            expect(
              samePos,
              `Destructible at (${d.x},${d.z}) sits on spawn zone center (${zone.x},${zone.z})`
            ).toBe(false);
          }
        }
      });

      it('no two destructibles occupy the same position', () => {
        const positions = new Set<string>();
        for (const d of t.destructibles) {
          const key = `${d.x},${d.z}`;
          expect(positions.has(key), `Duplicate destructible at (${key})`).toBe(false);
          positions.add(key);
        }
      });

      it('total placement area does not exceed ~80% of floor area', () => {
        const floorArea = t.width * t.height;

        let placementArea = 0;
        // Hazard areas
        for (const h of t.hazards) {
          placementArea += h.width * h.height;
        }
        // Destructibles: 1x1 unit each
        placementArea += t.destructibles.length;
        // Chest/shop: 1x1 unit each
        if (t.chestPlacement) placementArea += 1;
        if (t.shopPlacement) placementArea += 1;

        expect(placementArea / floorArea).toBeLessThanOrEqual(0.8);
      });
    }
  );

  it('some templates have chest placements and some do not', () => {
    const withChest = ROOM_TEMPLATES.filter((t) => t.chestPlacement !== null);
    const withoutChest = ROOM_TEMPLATES.filter(
      (t) => t.chestPlacement === null
    );
    expect(withChest.length).toBeGreaterThanOrEqual(1);
    expect(withoutChest.length).toBeGreaterThanOrEqual(1);
  });

  it('some templates have shop placements and some do not', () => {
    const withShop = ROOM_TEMPLATES.filter((t) => t.shopPlacement !== null);
    const withoutShop = ROOM_TEMPLATES.filter(
      (t) => t.shopPlacement === null
    );
    expect(withShop.length).toBeGreaterThanOrEqual(1);
    expect(withoutShop.length).toBeGreaterThanOrEqual(1);
  });

  it('no template dimensions fall below minimum', () => {
    for (const t of ROOM_TEMPLATES) {
      expect(t.width).toBeGreaterThanOrEqual(roomMinSize);
      expect(t.height).toBeGreaterThanOrEqual(roomMinSize);
    }
  });

  it('no template dimensions exceed maximum', () => {
    for (const t of ROOM_TEMPLATES) {
      expect(t.width).toBeLessThanOrEqual(roomMaxSize);
      expect(t.height).toBeLessThanOrEqual(roomMaxSize);
    }
  });

  it('includes non-square templates', () => {
    const nonSquare = ROOM_TEMPLATES.filter((t) => t.width !== t.height);
    expect(nonSquare.length).toBeGreaterThanOrEqual(1);
  });

  it('exports are pure data with no functions', () => {
    expect(Array.isArray(ROOM_TEMPLATES)).toBe(true);
    for (const template of ROOM_TEMPLATES) {
      const values = Object.values(template);
      for (const value of values) {
        expect(typeof value).not.toBe('function');
      }
    }
  });
});
