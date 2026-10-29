import { HEROES } from './data/heroes';
import type { Team } from './data/teams';

export type Side = 0 | 1; // 0 = 藍, 1 = 紅
export interface Step { side: Side; kind: 'ban' | 'pick' }

// 輪流各 ban 3，蛇形選角 藍1 紅2 藍2 紅2 藍2 紅1
export const ORDER: Step[] = [
  ...[0, 1, 0, 1, 0, 1].map((s) => ({ side: s as Side, kind: 'ban' as const })),
  ...[0, 1, 1, 0, 0, 1, 1, 0, 0, 1].map((s) => ({ side: s as Side, kind: 'pick' as const })),
];

export interface Draft {
  step: number;
  bans: [number[], number[]];
  picks: [number[], number[]];
}

export const newDraft = (): Draft => ({ step: 0, bans: [[], []], picks: [[], []] });

export const isTaken = (d: Draft, hero: number) =>
  [...d.bans[0], ...d.bans[1], ...d.picks[0], ...d.picks[1]].includes(hero);

export function apply(d: Draft, hero: number): void {
  const s = ORDER[d.step];
  if (!s || isTaken(d, hero)) throw new Error(`illegal draft action ${hero}`);
  (s.kind === 'ban' ? d.bans : d.picks)[s.side].push(hero);
  d.step++;
}

const free = (d: Draft) => HEROES.filter((h) => !isTaken(d, h.id));

export function aiChoose(d: Draft, teams: [Team, Team]): number {
  const s = ORDER[d.step];
  const me = teams[s.side];
  const opp = teams[1 - s.side];
  if (s.kind === 'ban') {
    // ban the opponent's best signature hero still available
    const best = (h: number) => Math.max(...opp.players.map((p) => p.prof[h]));
    return free(d).sort((a, b) => best(b.id) - best(a.id))[0].id;
  }
  // pick the highest-proficiency hero for an unfilled position, avoiding duplicate roles
  const mine = d.picks[s.side].map((id) => HEROES[id]);
  const filled = bestAssignment(d.picks[s.side], me).map((pi) => me.players[pi].pos);
  const roles = new Set(mine.map((h) => h.role));
  let best = { id: free(d)[0].id, score: -1 };
  for (const h of free(d)) {
    for (const p of me.players) {
      if (filled.includes(p.pos)) continue;
      const score = p.prof[h.id] - (roles.has(h.role) ? 40 : 0);
      if (score > best.score) best = { id: h.id, score };
    }
  }
  return best.id;
}

// For heroes[i], returns the player index who plays it, maximising total proficiency (≤5! permutations).
export function bestAssignment(heroes: number[], team: Team): number[] {
  let best: number[] = [];
  let bestScore = -1;
  const rec = (i: number, used: number[], score: number) => {
    if (i === heroes.length) {
      if (score > bestScore) { bestScore = score; best = [...used]; }
      return;
    }
    for (let p = 0; p < team.players.length; p++) {
      if (used.includes(p)) continue;
      used.push(p);
      rec(i + 1, used, score + team.players[p].prof[heroes[i]]);
      used.pop();
    }
  };
  rec(0, [], 0);
  return best;
}
