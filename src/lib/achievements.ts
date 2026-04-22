export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_win',
    title: 'INITIATIVE_GAINED',
    description: 'Archive your first victory on the Grid.',
    icon: 'Trophy',
    rarity: 'common'
  },
  {
    id: 'arena_designer',
    title: 'GRID_ARCHITECT',
    description: 'Save your first custom arena construction.',
    icon: 'Edit3',
    rarity: 'common'
  },
  {
    id: 'veteran_combatant',
    title: 'CODE_VETERAN',
    description: 'Participate in 50 combat simulations.',
    icon: 'Shield',
    rarity: 'rare'
  },
  {
    id: 'survival_expert',
    title: 'IMMORTAL_PROTOCOL',
    description: 'Survive for more than 5 minutes in a single game.',
    icon: 'Zap',
    rarity: 'epic'
  },
  {
    id: 'streak_king',
    title: 'NEURAL_STREAK',
    description: 'Achieve a 5-win streak.',
    icon: 'Flame',
    rarity: 'legendary'
  }
];
