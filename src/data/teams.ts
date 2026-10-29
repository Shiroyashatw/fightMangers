import { makeRng } from '../rng';
import { HEROES, POSITIONS, type Pos } from './heroes';

export interface Player {
  name: string;
  pos: Pos;
  micro: number; // 操作 1–100
  macro: number; // 意識 1–100
  prof: number[]; // 熟練度 per hero id, 0–100
}

export interface Team {
  name: string;
  players: Player[]; // ordered by POSITIONS
}

const NICKS = [
  'Fang','Ace', 'Blaze', 'Nova', 'Ghost', 'Rook', 'Viper', 'Echo', 'Kite', 'Lumen',
  'Mochi', 'Tofu', 'Zed0', 'Orca', 'Pixel', 'Rex', 'Sora', 'Taro', 'Yuki', 'Wolfy',
];

export const TEAM_SEED = 20261029;

export function makeTeams(): [Team, Team] {
  const rng = makeRng(TEAM_SEED);
  const nicks = [...NICKS];
  const team = (name: string): Team => ({
    name,
    players: POSITIONS.map((pos) => {
      const name = nicks.splice(rng.int(0, nicks.length - 1), 1)[0];
      const prof = HEROES.map((h) => (h.pos === pos ? rng.int(50, 80) : rng.int(15, 50)));
      // two signature heroes from own position
      const own = HEROES.filter((h) => h.pos === pos);
      for (let i = 0; i < 2; i++) prof[rng.pick(own).id] = rng.int(85, 100);
      return { name, pos, micro: rng.int(45, 90), macro: rng.int(45, 90), prof };
    }),
  });
  return [team('像素猛虎'), team('赤焰鳳凰')];
}
