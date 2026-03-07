// TODO: Expand these as enemy and hazard varieties are implemented
export const EnemyType = {
  Bullet: 'bullet',
  Shotgunner: 'shotgunner',
  Melee: 'melee',
} as const;
export type EnemyType = (typeof EnemyType)[keyof typeof EnemyType];

export const HazardType = {
  Spikes: 'spikes',
  Pit: 'pit',
  Poison: 'poison',
} as const;
export type HazardType = (typeof HazardType)[keyof typeof HazardType];
