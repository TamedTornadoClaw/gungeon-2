import { World } from '../ecs/world';
import { EventQueue, type DamageEvent } from '../gameloop/events';
import { EventType, ParticleEffect, SoundId } from '../ecs/components';
import type { Health, Shield, Armor, Projectile } from '../ecs/components';
import { getDesignParams } from '../config/designParams';

/**
 * DamageSystem — position 10 in system execution order.
 * Consumes DamageEvents, routes damage through Shield → Armor → Health,
 * emits ParticleEvents, AudioEvents, and DamageNumberEvents.
 */
export function damageSystem(world: World, eventQueue: EventQueue): void {
  const damageEvents = eventQueue.consume<EventType.Damage>(EventType.Damage);

  for (const event of damageEvents) {
    processDamageEvent(world, eventQueue, event);
  }
}

function processDamageEvent(world: World, eventQueue: EventQueue, event: DamageEvent): void {
  const { target, source, amount, isCritical, impactPosition } = event;

  if (amount <= 0) return;

  const health = world.getComponent<Health>(target, 'Health');
  const isDestructible = world.hasComponent(target, 'DestructibleTag');

  // Handle destructible entities (they use Destructible component, not Health)
  if (isDestructible) {
    const destructible = world.getComponent<{ health: number; maxHealth: number }>(
      target,
      'Destructible',
    );
    if (destructible) {
      destructible.health = Math.max(0, destructible.health - amount);
    }

    emitParticleEvent(eventQueue, ParticleEffect.Sparks, impactPosition);
    emitAudioEvent(eventQueue, SoundId.EnemyHitFlesh, impactPosition);
    emitDamageNumberEvent(eventQueue, amount, impactPosition, isCritical);
    return;
  }

  if (!health) return;

  let remaining = amount;
  let absorbedByShieldOrArmor = false;

  // Shield absorbs first
  const shield = world.getComponent<Shield>(target, 'Shield');
  if (shield && shield.current > 0) {
    const absorbed = Math.min(shield.current, remaining);
    shield.current = Math.max(0, shield.current - remaining);
    remaining -= absorbed;
    shield.timeSinceLastHit = 0;
    absorbedByShieldOrArmor = true;
  }

  // Armor absorbs next
  if (remaining > 0) {
    const armor = world.getComponent<Armor>(target, 'Armor');
    if (armor && armor.current > 0) {
      const absorbed = Math.min(armor.current, remaining);
      armor.current = Math.max(0, armor.current - remaining);
      remaining -= absorbed;
      absorbedByShieldOrArmor = true;
    }
  }

  // Remaining goes to health
  if (remaining > 0) {
    health.current = Math.max(0, health.current - remaining);
  }

  // Write lastDamageSourceGunSlot for player projectile sources
  if (world.hasEntity(source)) {
    const projectile = world.getComponent<Projectile>(source, 'Projectile');
    if (projectile && !projectile.isEnemyProjectile && projectile.sourceGunSlot !== undefined) {
      health.lastDamageSourceGunSlot = projectile.sourceGunSlot;
    }
  }

  // Emit events
  const isEnemy = world.hasComponent(target, 'EnemyTag');
  const particleEffect = isEnemy ? ParticleEffect.BloodSplat : ParticleEffect.Sparks;
  emitParticleEvent(eventQueue, particleEffect, impactPosition);

  const soundId = absorbedByShieldOrArmor ? SoundId.EnemyHitArmor : SoundId.EnemyHitFlesh;
  emitAudioEvent(eventQueue, soundId, impactPosition);

  emitDamageNumberEvent(eventQueue, amount, impactPosition, isCritical);

  // Screen effects for player hits
  const isPlayer = world.hasComponent(target, 'PlayerTag');
  if (isPlayer) {
    const shakeParams = getDesignParams().screenEffects.shake;
    eventQueue.emit({
      type: EventType.ScreenShake,
      intensity: shakeParams.playerHitIntensity,
    });
    emitAudioEvent(eventQueue, SoundId.PlayerHitGrunt, impactPosition);
  }

  // Hit flash for critical hits
  if (isCritical) {
    eventQueue.emit({ type: EventType.HitFlash });
  }
}

function emitParticleEvent(
  eventQueue: EventQueue,
  effect: ParticleEffect,
  position: { x: number; y: number; z: number },
): void {
  eventQueue.emit({
    type: EventType.Particle,
    effect,
    position: { x: position.x, y: position.y, z: position.z },
  });
}

function emitAudioEvent(
  eventQueue: EventQueue,
  sound: SoundId,
  position: { x: number; y: number; z: number },
): void {
  eventQueue.emit({
    type: EventType.Audio,
    sound,
    position: { x: position.x, y: position.y, z: position.z },
  });
}

function emitDamageNumberEvent(
  eventQueue: EventQueue,
  amount: number,
  position: { x: number; y: number; z: number },
  isCritical: boolean,
): void {
  eventQueue.emit({
    type: EventType.DamageNumber,
    amount,
    position: { x: position.x, y: position.y, z: position.z },
    isCritical,
  });
}
