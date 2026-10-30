import { CareerStats, CONTRACTS, careerXp, KILL_REWARD, MISSION_REWARD, RANKS } from '../data/missions';
import { SKILL_MAP } from '../data/skills';
import { load, remove, save } from './storage';

export interface Profile {
  version: 1;
  callsign: string;
  coins: number;
  skills: Record<string, number>;
  stats: CareerStats;
  claimedContracts: string[];
  history: { date: number; won: boolean; team: string; difficulty: string; kills: number; coins: number; duration: number }[];
}

const KEY = 'project-hotel.profile.v1';
const freshStats = (): CareerStats => ({
  matches: 0, wins: 0, losses: 0, kills: 0, deaths: 0, shots: 0, hits: 0, hostagesRescued: 0, hiddenSeconds: 0, coinsEarned: 0,
  playSeconds: 0, weaponKills: { pistol: 0, mp5: 0, m4: 0, deagle: 0 }, winsAsGuard: 0, winsHard: 0, bestKillsInMatch: 0, ghostRescues: 0,
});
const fresh = (): Profile => ({ version: 1, callsign: 'Operator', coins: 0, skills: {}, stats: freshStats(), claimedContracts: [], history: [] });

export interface MatchResult {
  won: boolean;
  team: 'AT' | 'GUARD';
  difficulty: 'easy' | 'normal' | 'hard';
  kills: number;
  deaths: number;
  shots: number;
  hits: number;
  coinsCollected: number;
  rescues: number;
  ghostRescues: number;
  hiddenSeconds: number;
  duration: number;
  weaponKills: CareerStats['weaponKills'];
}

export interface MatchRewards {
  coinsCollected: number;
  missionBonus: number;
  contracts: { name: string; reward: number }[];
  total: number;
}

class ProfileStore {
  private p: Profile;
  constructor() {
    const loaded = load<Profile>(KEY, fresh());
    loaded.stats = { ...freshStats(), ...loaded.stats, weaponKills: { ...freshStats().weaponKills, ...(loaded.stats?.weaponKills ?? {}) } };
    this.p = loaded;
  }
  get() {
    return this.p;
  }
  private commit() {
    save(KEY, this.p);
  }
  skillLevel(id: string) {
    return this.p.skills[id] ?? 0;
  }
  nextCost(id: string): number | null {
    const def = SKILL_MAP.get(id);
    if (!def) return null;
    const lv = this.skillLevel(id);
    return lv >= def.costs.length ? null : def.costs[lv];
  }
  upgrade(id: string): boolean {
    const cost = this.nextCost(id);
    if (cost === null || this.p.coins < cost) return false;
    this.p.coins -= cost;
    this.p.skills[id] = this.skillLevel(id) + 1;
    this.commit();
    return true;
  }
  rank() {
    const xp = careerXp(this.p.stats);
    let idx = 0;
    RANKS.forEach((r, i) => { if (xp >= r.xp) idx = i; });
    const next = RANKS[idx + 1];
    return { name: RANKS[idx].name, index: idx, xp, next: next?.xp ?? null, prev: RANKS[idx].xp };
  }
  setCallsign(name: string) {
    this.p.callsign = name.slice(0, 18) || 'Operator';
    this.commit();
  }
  /** Fold a finished match into the career and pay out rewards. */
  recordMatch(r: MatchResult): MatchRewards {
    const s = this.p.stats;
    s.matches++;
    if (r.won) s.wins++; else s.losses++;
    s.kills += r.kills;
    s.deaths += r.deaths;
    s.shots += r.shots;
    s.hits += r.hits;
    s.hostagesRescued += r.rescues;
    s.ghostRescues += r.ghostRescues;
    s.hiddenSeconds += r.hiddenSeconds;
    s.playSeconds += r.duration;
    s.bestKillsInMatch = Math.max(s.bestKillsInMatch, r.kills);
    for (const k of Object.keys(r.weaponKills) as (keyof CareerStats['weaponKills'])[]) s.weaponKills[k] += r.weaponKills[k];
    if (r.won && r.team === 'GUARD') s.winsAsGuard++;
    if (r.won && r.difficulty === 'hard') s.winsHard++;
    const missionBonus = r.won ? MISSION_REWARD : 0;
    const contracts: { name: string; reward: number }[] = [];
    for (const c of CONTRACTS) {
      if (this.p.claimedContracts.includes(c.id)) continue;
      if (c.progress(s) >= c.goal) {
        this.p.claimedContracts.push(c.id);
        contracts.push({ name: c.name, reward: c.reward });
      }
    }
    const total = r.coinsCollected + missionBonus + contracts.reduce((a, c) => a + c.reward, 0);
    this.p.coins += total;
    s.coinsEarned += total;
    this.p.history.unshift({ date: Date.now(), won: r.won, team: r.team, difficulty: r.difficulty, kills: r.kills, coins: total, duration: r.duration });
    this.p.history = this.p.history.slice(0, 12);
    this.commit();
    return { coinsCollected: r.coinsCollected, missionBonus, contracts, total };
  }
  reset() {
    remove(KEY);
    this.p = fresh();
    this.commit();
  }
}

export const profile = new ProfileStore();
export { KILL_REWARD };
