import { describe, expect, it } from 'vitest';
import { HEROES } from './data/heroes';
import { makeTeams } from './data/teams';
import { aiChoose, apply, bestAssignment, newDraft, ORDER } from './draft';
import { quickMatch } from './quick';

describe('draft', () => {
  it('follows 3 bans each then snake picks', () => {
    expect(ORDER.filter((s) => s.kind === 'ban').map((s) => s.side)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(ORDER.filter((s) => s.kind === 'pick').map((s) => s.side)).toEqual([0, 1, 1, 0, 0, 1, 1, 0, 0, 1]);
  });

  it('AI completes a legal draft and assigns one hero per player', () => {
    const teams = makeTeams();
    const d = newDraft();
    while (d.step < ORDER.length) apply(d, aiChoose(d, teams));
    const all = [...d.bans.flat(), ...d.picks.flat()];
    expect(new Set(all).size).toBe(16);
    expect(all.every((id) => id >= 0 && id < HEROES.length)).toBe(true);
    for (const s of [0, 1]) expect(new Set(bestAssignment(d.picks[s], teams[s])).size).toBe(5);
    expect(() => apply(d, all[0])).toThrow();
  });
});

describe('match', () => {
  it('is deterministic for a seed and ends with a winner', () => {
    const run = () => { const m = quickMatch(3); m.runToEnd(); return [m.winner, m.t, m.kills.join()]; };
    const a = run();
    expect(a).toEqual(run());
    expect(a[0]).toBeGreaterThanOrEqual(0);
  });

  it('usually ends in roughly 3–10 minutes', () => {
    const times = [1, 2, 3, 4, 5, 6].map((s) => { const m = quickMatch(s); m.runToEnd(); return m.t; }).sort((a, b) => a - b);
    expect(times[3]).toBeGreaterThan(150);
    expect(times[3]).toBeLessThan(600);
  });
});
