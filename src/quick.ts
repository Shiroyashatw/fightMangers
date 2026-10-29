import { makeTeams, type Team } from './data/teams';
import { aiChoose, apply, bestAssignment, newDraft, ORDER } from './draft';
import { Match, type Pick } from './sim/match';

// AI vs AI draft + assignment; used by tests and the tuning script.
export function autoPicks(sides: [Team, Team]): [Pick[], Pick[]] {
  const d = newDraft();
  while (d.step < ORDER.length) apply(d, aiChoose(d, sides));
  return [0, 1].map((s) => {
    const who = bestAssignment(d.picks[s], sides[s]);
    return d.picks[s].map((hero, i) => ({ hero, player: who[i] }));
  }) as [Pick[], Pick[]];
}

export function quickMatch(seed: number) {
  const sides = makeTeams();
  return new Match(sides, autoPicks(sides), seed);
}
