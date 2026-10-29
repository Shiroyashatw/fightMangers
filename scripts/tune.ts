import { quickMatch } from '../src/quick';

declare const process: { argv: string[] };
// Runs headless matches and prints pacing numbers for balancing.
const N = Number(process.argv[2] ?? 10);
const rows = [];
for (let seed = 1; seed <= N; seed++) {
  const m = quickMatch(seed);
  m.runToEnd();
  const lv = m.heroes().map((h) => h.level);
  rows.push({
    seed, winner: m.winner ? '紅' : '藍', time: Math.round(m.t), kills: m.kills.join('-'), towers: m.towersDown.join('-'),
    lvl: `${Math.min(...lv)}-${Math.max(...lv)}`, epics: m.feed.filter((f) => f.text.includes('巨龍')).length,
  });
}
console.table(rows);
