import type { EventQueue } from '../gameloop/events';
import { EventType } from '../ecs/components';
import type { Vec3 } from '../types';

export interface PendingDamageNumber {
  amount: number;
  position: Vec3;
  isCritical: boolean;
}

export interface EffectsBuffer {
  damageNumbers: PendingDamageNumber[];
  shakeIntensity: number;
  hitFlashTriggered: boolean;
}

export function createEffectsBuffer(): EffectsBuffer {
  return {
    damageNumbers: [],
    shakeIntensity: 0,
    hitFlashTriggered: false,
  };
}

export function clearEffectsBuffer(buffer: EffectsBuffer): void {
  buffer.damageNumbers.length = 0;
  buffer.shakeIntensity = 0;
  buffer.hitFlashTriggered = false;
}

export function effectsPipelineSystem(
  eventQueue: EventQueue,
  buffer: EffectsBuffer,
): void {
  // Consume DamageNumberEvents
  const damageNumberEvents = eventQueue.consume(EventType.DamageNumber);
  for (const event of damageNumberEvents) {
    buffer.damageNumbers.push({
      amount: event.amount,
      position: event.position,
      isCritical: event.isCritical,
    });
  }

  // Consume ScreenShake events (additive)
  const shakeEvents = eventQueue.consume(EventType.ScreenShake);
  for (const event of shakeEvents) {
    buffer.shakeIntensity += event.intensity;
  }

  // Consume HitFlash events
  const hitFlashEvents = eventQueue.consume(EventType.HitFlash);
  if (hitFlashEvents.length > 0) {
    buffer.hitFlashTriggered = true;
  }
}
