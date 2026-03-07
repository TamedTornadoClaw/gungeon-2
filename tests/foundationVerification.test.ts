import { describe, it, expect } from 'vitest';
import { World } from '../src/ecs/world';
import {
  AppState,
  WeaponSlot,
  GunType,
  GunCategory,
  GunTrait,
  EnemyType,
  AIBehaviorState,
  PickupType,
  HazardType,
  ColliderShape,
  ParticleEffect,
  SoundId,
  MeshId,
  EventType,
  LogicalAction,
  DestructibleType,
} from '../src/ecs/components';
import type { Position, Velocity, Health } from '../src/ecs/components';
import { useAppStore } from '../src/store/appStore';
import { getDesignParams, validateDesignParams } from '../src/config/designParams';
import { createEventQueue } from '../src/gameloop/events';
import { createPlayer, createGun } from '../src/ecs/factories';

describe('Foundation Verification', () => {
  describe('ECS World', () => {
    it('creates entities and assigns components', () => {
      const world = new World();
      const entity = world.createEntity();

      const pos: Position = { x: 1, y: 2, z: 3 };
      const vel: Velocity = { x: 0.5, y: 0, z: -1 };
      const hp: Health = { current: 100, max: 100, lastDamageSourceGunSlot: null };

      world.addComponent(entity, 'Position', pos);
      world.addComponent(entity, 'Velocity', vel);
      world.addComponent(entity, 'Health', hp);

      expect(world.getComponent<Position>(entity, 'Position')).toBe(pos);
      expect(world.getComponent<Velocity>(entity, 'Velocity')).toBe(vel);
      expect(world.getComponent<Health>(entity, 'Health')).toBe(hp);
    });

    it('queries entities by component set', () => {
      const world = new World();
      const e1 = world.createEntity();
      const e2 = world.createEntity();
      const e3 = world.createEntity();

      world.addComponent(e1, 'Position', { x: 0, y: 0, z: 0 });
      world.addComponent(e1, 'Velocity', { x: 0, y: 0, z: 0 });
      world.addComponent(e2, 'Position', { x: 1, y: 1, z: 1 });
      world.addComponent(e3, 'Velocity', { x: 2, y: 2, z: 2 });

      const result = world.query(['Position', 'Velocity']);
      expect(result).toEqual([e1]);
    });

    it('destroys entities and removes all components', () => {
      const world = new World();
      const entity = world.createEntity();
      world.addComponent(entity, 'Position', { x: 0, y: 0, z: 0 });
      world.destroyEntity(entity);

      expect(world.hasEntity(entity)).toBe(false);
      expect(world.getComponent(entity, 'Position')).toBeUndefined();
    });
  });

  describe('App State Machine', () => {
    it('transitions Loading -> MainMenu -> WeaponSelect -> Gameplay -> Paused -> Gameplay', () => {
      const store = useAppStore;
      store.setState({ currentState: AppState.Loading, previousState: null });

      store.getState().transition(AppState.MainMenu);
      expect(store.getState().currentState).toBe(AppState.MainMenu);

      store.getState().transition(AppState.WeaponSelect);
      expect(store.getState().currentState).toBe(AppState.WeaponSelect);

      store.getState().transition(AppState.Gameplay);
      expect(store.getState().currentState).toBe(AppState.Gameplay);

      store.getState().transition(AppState.Paused);
      expect(store.getState().currentState).toBe(AppState.Paused);

      store.getState().transition(AppState.Gameplay);
      expect(store.getState().currentState).toBe(AppState.Gameplay);
    });

    it('throws on invalid transitions', () => {
      const store = useAppStore;
      store.setState({ currentState: AppState.Loading, previousState: null });

      expect(() => store.getState().transition(AppState.Gameplay)).toThrow();
    });

    it('handles Settings return-to-previous correctly', () => {
      const store = useAppStore;
      store.setState({ currentState: AppState.MainMenu, previousState: null });

      store.getState().transition(AppState.Settings);
      expect(store.getState().currentState).toBe(AppState.Settings);
      expect(store.getState().previousState).toBe(AppState.MainMenu);

      store.getState().transition(AppState.MainMenu);
      expect(store.getState().currentState).toBe(AppState.MainMenu);
    });
  });

  describe('Design Params', () => {
    it('loads and validates all required sections', () => {
      const params = getDesignParams();
      expect(params).toBeDefined();
      expect(params.player).toBeDefined();
      expect(params.guns).toBeDefined();
      expect(params.traits).toBeDefined();
      expect(params.enemies).toBeDefined();
      expect(params.hazards).toBeDefined();
      expect(params.dungeon).toBeDefined();
      expect(params.shop).toBeDefined();
      expect(params.camera).toBeDefined();
      expect(params.screenEffects).toBeDefined();
      expect(params.particles).toBeDefined();
      expect(params.gameLoop).toBeDefined();
    });

    it('rejects invalid params', () => {
      expect(() => validateDesignParams(null)).toThrow();
      expect(() => validateDesignParams({})).toThrow('Missing required section');
    });

    it('has valid player config', () => {
      const params = getDesignParams();
      expect(params.player.baseHealth).toBeGreaterThan(0);
      expect(params.player.baseMovementSpeed).toBeGreaterThan(0);
      expect(params.player.dodgeRoll).toBeDefined();
    });
  });

  describe('Event System', () => {
    it('emits and consumes events by type', () => {
      const queue = createEventQueue();
      queue.emit({
        type: EventType.Audio,
        sound: SoundId.PistolFire,
      });
      queue.emit({
        type: EventType.Particle,
        effect: ParticleEffect.MuzzleFlash,
        position: { x: 0, y: 0, z: 0 },
      });

      const audioEvents = queue.consume(EventType.Audio);
      expect(audioEvents).toHaveLength(1);
      expect(audioEvents[0].sound).toBe(SoundId.PistolFire);

      const particleEvents = queue.consume(EventType.Particle);
      expect(particleEvents).toHaveLength(1);
    });

    it('clears all events', () => {
      const queue = createEventQueue();
      queue.emit({ type: EventType.Audio, sound: SoundId.Footstep });
      queue.clear();
      expect(queue.consume(EventType.Audio)).toHaveLength(0);
    });
  });

  describe('Factories', () => {
    it('creates a player entity with expected components', () => {
      const world = new World();
      const playerId = createPlayer(world, { x: 5, y: 0, z: 0 }, GunType.AssaultRifle);

      expect(world.hasEntity(playerId)).toBe(true);
      expect(world.hasComponent(playerId, 'Position')).toBe(true);
      expect(world.hasComponent(playerId, 'Velocity')).toBe(true);
      expect(world.hasComponent(playerId, 'Health')).toBe(true);
      expect(world.hasComponent(playerId, 'Player')).toBe(true);
    });

    it('creates a gun entity', () => {
      const world = new World();
      const gunId = createGun(world, GunType.Pistol);

      expect(world.hasEntity(gunId)).toBe(true);
      expect(world.hasComponent(gunId, 'Gun')).toBe(true);
    });
  });

  describe('Enum completeness', () => {
    it('all enums are defined and have expected members', () => {
      expect(AppState.Loading).toBeDefined();
      expect(AppState.Gameplay).toBeDefined();
      expect(AppState.Death).toBeDefined();
      expect(AppState.Victory).toBeDefined();

      expect(WeaponSlot.Sidearm).toBeDefined();
      expect(WeaponSlot.LongArm).toBeDefined();

      expect(GunType.Pistol).toBeDefined();
      expect(GunType.Shotgun).toBeDefined();

      expect(EnemyType.KnifeRusher).toBeDefined();
      expect(EnemyType.SuicideBomber).toBeDefined();

      expect(SoundId.PistolFire).toBeDefined();
      expect(SoundId.FloorTransition).toBeDefined();

      expect(ParticleEffect.MuzzleFlash).toBeDefined();
      expect(ParticleEffect.Explosion).toBeDefined();

      expect(MeshId.Player).toBeDefined();
      expect(MeshId.Boss).toBeDefined();

      expect(EventType.Damage).toBe('Damage');
      expect(EventType.Audio).toBe('Audio');

      expect(LogicalAction.MoveUp).toBe('moveUp');
      expect(LogicalAction.DodgeRoll).toBe('dodgeRoll');

      expect(ColliderShape.AABB).toBeDefined();
      expect(HazardType.Fire).toBeDefined();
      expect(PickupType.XPGem).toBeDefined();
      expect(AIBehaviorState.Chase).toBeDefined();
      expect(GunCategory.Sidearm).toBeDefined();
      expect(GunTrait.Damage).toBeDefined();
      expect(DestructibleType.Crate).toBe('Crate');
    });
  });
});
