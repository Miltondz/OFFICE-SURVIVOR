import type { EnemyDefinition } from '@/types';
import { PROGRESSION } from './game.config';

export const def = (partial: Omit<EnemyDefinition, 'xpValue'>): EnemyDefinition => ({
  ...partial,
  xpValue: Math.round(partial.hp / PROGRESSION.XP_PER_HP_DIVISOR),
});

export const ENEMIES: EnemyDefinition[] = [
  def({ id: 'angry_email',       name: 'Angry Email',       hp: 20,  speed: 80,  damage: 5,  isElite: false }),
  def({ id: 'toxic_manager',     name: 'Toxic Manager',     hp: 60,  speed: 50,  damage: 12, isElite: true  }),
  def({ id: 'angry_client',      name: 'Angry Client',      hp: 40,  speed: 90,  damage: 8,  isElite: false }),
  def({ id: 'hr_rep',            name: 'HR Representative', hp: 35,  speed: 60,  damage: 10, isElite: true  }),
  def({ id: 'possessed_printer', name: 'Possessed Printer', hp: 120, speed: 30,  damage: 15, isElite: true  }),
  def({ id: 'auditor',           name: 'Auditor',           hp: 80,  speed: 40,  damage: 20, isElite: true  }),
];

export function getEnemyById(id: string): EnemyDefinition | undefined {
  return ENEMIES.find(e => e.id === id);
}
