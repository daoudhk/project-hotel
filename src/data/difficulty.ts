export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultyDef {
  id: Difficulty;
  label: string;
  enemyCount: number; // opposing bots when the player is solo
  reaction: number; // seconds before a bot opens fire after acquiring
  aimError: number; // radians std-dev added to bot shots
  turnRate: number; // rad/s bot aim turn speed
  detectRate: number; // detection meter per second at full visibility
  hearing: number; // multiplier on noise radius
  burst: [number, number]; // rounds per burst for automatic weapons
  description: string;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: {
    id: 'easy', label: 'Easy', enemyCount: 6, reaction: 0.85, aimError: 0.12, turnRate: 3.2, detectRate: 1.3, hearing: 0.75,
    burst: [2, 4], description: 'Guards are slow to react and shoot loosely.',
  },
  normal: {
    id: 'normal', label: 'Normal', enemyCount: 8, reaction: 0.5, aimError: 0.075, turnRate: 4.6, detectRate: 2.1, hearing: 1,
    burst: [3, 5], description: 'Alert, coordinated guards. The intended experience.',
  },
  hard: {
    id: 'hard', label: 'Hard', enemyCount: 10, reaction: 0.3, aimError: 0.045, turnRate: 6.5, detectRate: 3.0, hearing: 1.25,
    burst: [3, 7], description: 'Sharp-eyed professionals. Mistakes are punished.',
  },
};
