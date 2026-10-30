import type { WeaponId } from './weapons';

/** Persistent statistic counters that contracts can track. */
export interface CareerStats {
  matches: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  hostagesRescued: number;
  hiddenSeconds: number;
  coinsEarned: number;
  playSeconds: number;
  weaponKills: Record<WeaponId, number>;
  winsAsGuard: number;
  winsHard: number;
  bestKillsInMatch: number;
  ghostRescues: number;
}

export interface ContractDef {
  id: string;
  name: string;
  description: string;
  reward: number;
  goal: number;
  progress: (s: CareerStats) => number;
}

export const MISSION_REWARD = 15;
export const KILL_REWARD = 5;

export const CONTRACTS: ContractDef[] = [
  { id: 'first-light', name: 'First Light', description: 'Complete your first operation.', reward: 15, goal: 1, progress: (s) => s.wins },
  { id: 'clean-sweep', name: 'Clean Sweep', description: 'Eliminate 5 hostiles in a single match.', reward: 15, goal: 5, progress: (s) => s.bestKillsInMatch },
  { id: 'ghost', name: 'Ghost Protocol', description: 'Free a hostage without ever being detected that match.', reward: 15, goal: 1, progress: (s) => s.ghostRescues },
  { id: 'shadow', name: 'Shadow Walker', description: 'Stay hidden in the dark for a total of 90 seconds.', reward: 15, goal: 90, progress: (s) => Math.floor(s.hiddenSeconds) },
  { id: 'sidearm', name: 'Sidearm Specialist', description: 'Eliminate 5 hostiles with the standard pistol.', reward: 15, goal: 5, progress: (s) => s.weaponKills.pistol },
  { id: 'cqb', name: 'Close Quarters', description: 'Eliminate 10 hostiles with the MP5.', reward: 15, goal: 10, progress: (s) => s.weaponKills.mp5 },
  { id: 'marksman', name: 'Marksman', description: 'Eliminate 10 hostiles with the M4 Carbine.', reward: 15, goal: 10, progress: (s) => s.weaponKills.m4 },
  { id: 'hand-cannon', name: 'Hand Cannon', description: 'Eliminate 3 hostiles with the Desert Eagle.', reward: 15, goal: 3, progress: (s) => s.weaponKills.deagle },
  { id: 'extraction', name: 'Safe Passage', description: 'Rescue 9 hostages across your career.', reward: 15, goal: 9, progress: (s) => s.hostagesRescued },
  { id: 'hold-line', name: 'Hold the Line', description: 'Win a match playing as the Hostage Guards.', reward: 15, goal: 1, progress: (s) => s.winsAsGuard },
  { id: 'hard-target', name: 'Hard Target', description: 'Win a match on Hard difficulty.', reward: 15, goal: 1, progress: (s) => s.winsHard },
];

export const RANKS = [
  { name: 'Recruit', xp: 0 },
  { name: 'Operator', xp: 150 },
  { name: 'Specialist', xp: 450 },
  { name: 'Veteran', xp: 1000 },
  { name: 'Elite', xp: 2000 },
  { name: 'Phantom', xp: 4000 },
];
export const careerXp = (s: CareerStats) => s.kills * 10 + s.wins * 60 + s.hostagesRescued * 25 + s.matches * 5;
