import { describe, it, expect } from 'vitest';
import { getDesignParams, validateDesignParams } from '../src/config/designParams.ts';
import designParamsJson from '../config/design-params.json';

describe('designParams', () => {
  describe('getDesignParams', () => {
    it('returns a valid DesignParams object', () => {
      const params = getDesignParams();
      expect(params).toBeDefined();
      expect(params.player).toBeDefined();
      expect(params.guns).toBeDefined();
      expect(params.traits).toBeDefined();
      expect(params.enemies).toBeDefined();
      expect(params.hazards).toBeDefined();
      expect(params.dungeon).toBeDefined();
      expect(params.shop).toBeDefined();
      expect(params.gunMechanics).toBeDefined();
      expect(params.projectiles).toBeDefined();
      expect(params.destructibles).toBeDefined();
      expect(params.camera).toBeDefined();
      expect(params.screenEffects).toBeDefined();
      expect(params.damageNumbers).toBeDefined();
      expect(params.gameLoop).toBeDefined();
    });

    it('returns the same instance on repeated calls', () => {
      const a = getDesignParams();
      const b = getDesignParams();
      expect(a).toBe(b);
    });
  });

  describe('validateDesignParams', () => {
    it('accepts the actual design-params.json', () => {
      expect(() => validateDesignParams(designParamsJson)).not.toThrow();
    });

    it('rejects null', () => {
      expect(() => validateDesignParams(null)).toThrow('Design params must be a non-null object');
    });

    it('rejects a non-object', () => {
      expect(() => validateDesignParams('string')).toThrow('Design params must be a non-null object');
    });

    it('rejects an empty object (missing all sections)', () => {
      expect(() => validateDesignParams({})).toThrow('Missing required section');
    });

    const requiredSections = [
      'player',
      'guns',
      'traits',
      'enemies',
      'hazards',
      'dungeon',
      'shop',
      'gunMechanics',
      'projectiles',
      'destructibles',
      'camera',
      'screenEffects',
      'damageNumbers',
      'gameLoop',
    ] as const;

    for (const section of requiredSections) {
      it(`rejects JSON missing the "${section}" section`, () => {
        const partial = { ...designParamsJson };
        delete (partial as Record<string, unknown>)[section];
        expect(() => validateDesignParams(partial)).toThrow(`Missing required section: "${section}"`);
      });

      it(`rejects JSON where "${section}" is null`, () => {
        const broken = { ...designParamsJson, [section]: null };
        expect(() => validateDesignParams(broken)).toThrow(`Section "${section}" must be a non-null object`);
      });
    }
  });

  describe('JSON values match TDD', () => {
    const params = getDesignParams();

    it('player base health is 100', () => {
      expect(params.player.baseHealth).toBe(100);
    });

    it('player dodge roll cooldown is 1.0', () => {
      expect(params.player.dodgeRoll.cooldown).toBe(1.0);
    });

    it('Pistol damage is 15', () => {
      expect(params.guns['Pistol'].damage).toBe(15);
    });

    it('Shotgun projectile count is 6', () => {
      expect(params.guns['Shotgun'].projectileCount).toBe(6);
    });

    it('traits max level is 5 with 5 xp cost entries', () => {
      expect(params.traits.maxLevel).toBe(5);
      expect(params.traits.xpCosts).toHaveLength(5);
    });

    it('all trait bonus arrays have 5 entries', () => {
      for (const [trait, bonuses] of Object.entries(params.traits.bonusPerLevel)) {
        expect(bonuses, `${trait} should have 5 levels`).toHaveLength(5);
      }
    });

    it('game loop fixed timestep is ~60Hz', () => {
      expect(params.gameLoop.fixedTimestep).toBeCloseTo(1 / 60, 3);
    });

    it('camera FOV is 50', () => {
      expect(params.camera.fov).toBe(50);
    });

    it('KnifeRusher base health is 30', () => {
      expect(params.enemies.KnifeRusher.baseHealth).toBe(30);
    });

    it('fire hazard does 10 DPS', () => {
      expect(params.hazards.fire.damagePerSecond).toBe(10);
    });

    it('dungeon rooms per floor is 8', () => {
      expect(params.dungeon.roomsPerFloor).toBe(8);
    });

    it('all 5 gun types are present', () => {
      const gunTypes = ['Pistol', 'SMG', 'AssaultRifle', 'Shotgun', 'LMG'];
      for (const gunType of gunTypes) {
        expect(params.guns[gunType], `${gunType} should exist`).toBeDefined();
      }
    });

    it('all 5 enemy types are present', () => {
      expect(params.enemies.KnifeRusher).toBeDefined();
      expect(params.enemies.ShieldGun).toBeDefined();
      expect(params.enemies.Shotgunner).toBeDefined();
      expect(params.enemies.Rifleman).toBeDefined();
      expect(params.enemies.SuicideBomber).toBeDefined();
    });
  });
});
