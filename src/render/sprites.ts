import { HEROES, type Role } from '../data/heroes';

export const TEAM_COLOR = ['#3d8bff', '#ff4d4d'];
const OUTLINE = '#1a1420';

// 半解析度手繪模板（面向右），經 Scale2x 放大 2 倍後再自動加外框。
// b/B/L 英雄色（一般/暗/亮） h 頭髮 t/T 隊伍色 s/S 皮膚 k 眼睛 w/W 金屬 o 光球 r 木頭 l 靴子
const BODIES: Record<Role, string[]> = {
  fighter: [
    '....hhhh....', '...hhhhhh...', '...tttttt...', '...sssskS...', '...ssssSS...', '....SSSS....', '..LbbbbbB...',
    '.sLbbtbbBs..', '.sLbbtbbBs..', '...bbtbbB...', '...BBBBBB...', '...bb..bb...', '...BB..BB...', '...ll..ll...',
  ],
  tank: [
    '...wwwwww...', '..wwwwwwwW..', '..wkwwwkwW..', '..WsssssSW..', '...WWWWWW...', '.ttLbbbbbB..', 'tTtLbbbbbBs.',
    'tTtLbwwbbBs.', 'tTtLbbbbbBs.', '.tt.bbbbbB..', '....BBBBBB..', '....bb..bb..', '....WW..WW..', '....ll..ll..',
  ],
  assassin: [
    '............', '....hhhh....', '...hhhhhhh..', '..hhsskskh..', '..hhSSSSSh..', '...ttttttT..', '...LbbbbB...',
    '..sLbbbbBs..', '..sLbbbbBs..', '...BbbbbB...', '...BbbbbB...', '...BB..BB...', '...bb..bb...', '...ll..ll...',
  ],
  mage: [
    '.....h......', '....hhh.....', '...hhhhh....', '..tttttttt..', '...ssskss...', '....SSSS....', '...LbbbbBs..',
    '...LbbbbB...', '..LbbttbbB..', '..LbbbbbbB..', '..LbbbbbbB..', '.LbbbbbbbbB.', '.BBBBBBBBBB.', '..ll....ll..',
  ],
  marksman: [
    '....hhhh....', '...hhhhhh...', '...tttttttt.', '...ssskss...', '....SSSS....', '...LbbbB....', '..sLbbbBs...',
    '..sLbtbBs...', '...LbtbB....', '...BbbbB....', '...BBBBB....', '...bb.bb....', '...BB.BB....', '...ll.ll....',
  ],
  support: [
    '..o.o.o.....', '..hhhhhh....', '..hsskSh....', '..hssssh....', '...SSSS.....', '..LLbbbBBs..', '..LbbtbbBs..',
    '..LbbtbbB...', '.LbbbtbbbB..', '.LbbbbbbbB..', '.LbbbbbbbB..', 'LbbbbbbbbbB.', 'BBBBBBBBBBB.', '.ll.....ll..',
  ],
};

// 武器：模板、握把（武器座標）、手的位置（身體座標）、平常的傾斜角度
export interface Weapon { rows: string[]; pivot: [number, number]; hand: [number, number]; idle: number; melee: boolean }
const WEAPONS: Record<Role, Weapon> = {
  fighter: { rows: ['.w.', '.w.', '.w.', '.w.', '.w.', '.W.', 'WrW', '.r.'], pivot: [1, 7], hand: [9, 8], idle: 0.5, melee: true },
  tank: { rows: ['WWW', 'WwW', '.r.', '.r.', '.r.'], pivot: [1, 4], hand: [10, 7], idle: 0.4, melee: true },
  assassin: { rows: ['w', 'w', 'W', 'r'], pivot: [0, 3], hand: [9, 8], idle: 1.2, melee: true },
  mage: { rows: ['.o.', 'ooo', '.o.', '.r.', '.r.', '.r.', '.r.', '.r.', '.r.', '.r.'], pivot: [1, 6], hand: [9, 6], idle: 0.1, melee: false },
  marksman: { rows: ['wr.', 'w.r', 'w.r', 'w.r', 'w.r', 'w.r', 'wr.'], pivot: [1, 3], hand: [8, 7], idle: 0, melee: false },
  support: { rows: ['.oo.', 'oLLo', '.oo.', '.rr.', '..r.', '..r.', '..r.', '..r.', '..r.', '..r.'], pivot: [2, 6], hand: [9, 6], idle: 0.1, melee: false },
};

const TREE = [
  '.....FFFF.....', '...FFLLFFFF...', '..FFLLLFFFFF..', '.FFLLFFFFFFFf.', '.FLLFFFFFFFFf.', 'FFLFFFFFFFFFff', 'FFFFFFFFFFFFff',
  'FLFFFFFFFFFfff', '.FFFFFFFFFFff.', '.fFFFFFFFFfff.', '..ffFFFFfff...', '....ffffff....', '......rr......', '.....rrrr.....',
];
const SHAPES: Record<string, string[]> = {
  tower: [
    '.....tt.....', '....tLTt....', '....tLTt....', '.....tt.....', '...WWWWWW...', '..WwwwwwwW..', '..WWWWWWWW..',
    '...wWwWwW...', '...wwwwwW...', '...wkkkwW...', '...wkkkwW...', '...wwwwwW...', '...wwwwwW...', '...wwttwW...',
    '...wwttwW...', '...wwwwwW...', '..wwwwwwWW..', '.wwwwwwwwWW.', '.WWWWWWWWWW.',
  ],
  nexus: [
    '.......tt.......', '......tLLt......', '.....tLLttt.....', '....tLLtttTt....', '....tLttttTt....', '...tLtttttTTt...',
    '...tLttttttTt...', '....tLtttTTt....', '....ttttTTTt....', '.....tttTTt.....', '......tTTt......', '...wwwwwwwwww...',
    '..wwwwwwwwwwwW..', '.wwWWWWWWWWWWWW.', '.WWWWWWWWWWWWWW.',
  ],
  minion: ['..tttt..', '.tLLttt.', '.tkttkT.', '.ttttTT.', '..wTTw..', '..l..l..'],
  camp: ['...gggg...', '..gGGggg..', '.gGgggggD.', '.gkggkggD.', '.ggggggDD.', '..DDDDDD..'],
  epic: [
    '.....P............', '....PpP.......PP..', '...PpLpP....PPpP..', '..PpLLLpPPPPpppP..', '.PpLLpppppppppP...',
    'PPpLLppppppppppP..', 'PpLoppppppppppppP.', 'PpppppLLLLLpppppPP', '.PpppLLLLLLpppppPp', '..PPppppppppppPP..',
    '...Pp.Pp...Pp.Pp..', '...PP.PP...PP.PP..',
  ],
  wolf: ['..g..g..', '.gggggg.', 'gkgggggG', '.gGGGGG.', '.g.g.g.g'],
  turret: ['...ww...', '..wWWwww', '.wwWWw..', '..tttt..', '.tTTTTt.', '.WWWWWW.'],
  totem: ['..oo..', '.oLLo.', '..oo..', '.rrrr.', '.rkkr.', '.rrrr.', '.rttr.', '.rrrr.', '.rkkr.', 'rrrrrr'],
  // 地圖裝飾
  tree: TREE,
  autumn: TREE,
  pine: [
    '....F....', '...FLF...', '...FFf...', '..FLFFf..', '..FFFff..', '.FLFFFff.', '..FFFff..', '.FLFFFff.',
    'FLFFFFfff', '.FFFFfff.', 'FFFFFFfff', '....r....', '...rrr...',
  ],
  dead: ['..r...r..', '...r.r...', 'r..rr..r.', '.r.rr.r..', '..rrrr...', '...rr....', '...rr....', '..rrrr...'],
  bush: ['..FLLF..', '.FFLFFF.', 'FFLFFFFf', '.ffffff.'],
  rock: ['..WWW..', '.WwwwW.', 'WwwwWWW', '.WWWWW.'],
  shroom: ['.ttt.', 'tLtLt', '..w..', '..w..'],
  flower: ['.t.', 'tot', '.t.'],
  reed: ['r..r', 'r.r.', '.rr.', '.F..', 'FF.F', '.FF.'],
  lily: ['.FFF.', 'FFoFF', '.FFF.'],
  banner: ['r....', 'rttt.', 'rtLt.', 'rttt.', 'rtt..', 'rt...', 'r....', 'r....', 'r....', 'rr...'],
  brazier: ['.o.o.', 'oLoLo', '.ooo.', 'WWWWW', '.WwW.', '.WwW.', 'WWWWW'],
  crate: ['rrrrr', 'rWrWr', 'rrWrr', 'rWrWr', 'rrrrr'],
  lava: ['..oooooo..', '.ooLLLooo.', 'oLLooLLooo', '.oooLLoo..', '...oooo...'],
  pillar: ['WWWWW', '.www.', '.wWw.', '.www.', '.wWw.', '.www.', '.wWw.', '.www.', '.wWw.', 'WWWWW'],
  broken: ['.w.ww', '.www.', '.wWw.', '.www.', 'WWWWW'],
  bone: ['w...w', '.www.', 'w...w'],
  crystal: ['..p..', '.pLp.', '.pLp.', 'ppLpp', '.ppp.'],
  fence: ['r..r..r.', 'rrrrrrrr', 'r..r..r.', 'rrrrrrrr', 'r..r..r.'],
  fire: ['..o..', '.oLo.', 'oLLLo', 'rrrrr'],
};

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

// Scale2x / EPX：放大 2 倍並把斜邊修圓
function scale2x(rows: string[]): string[] {
  const h = rows.length, w = rows[0].length;
  if (rows.some((r) => r.length !== w)) throw new Error(`ragged sprite: ${rows.join('|')}`);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : rows[y][x]);
  const out = Array.from({ length: h * 2 }, () => Array(w * 2).fill('.'));
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1);
    out[2 * y][2 * x] = c === a && c !== d && a !== b ? a : p;
    out[2 * y][2 * x + 1] = a === b && a !== c && b !== d ? b : p;
    out[2 * y + 1][2 * x] = d === c && d !== b && c !== a ? c : p;
    out[2 * y + 1][2 * x + 1] = b === d && b !== a && d !== c ? d : p;
  }
  return out.map((r) => r.join(''));
}

function paint(half: string[], pal: Record<string, string>, flash = false) {
  const rows = scale2x(half);
  const w = rows[0].length, h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w + 2; cv.height = h + 2;
  const ctx = cv.getContext('2d')!;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && rows[y][x] !== '.';
  for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) {
    const color = solid(x, y) ? (flash ? '#ffffff' : pal[rows[y][x]])
      : solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) ? (flash ? '#ffffff' : OUTLINE) : null;
    if (color) { ctx.fillStyle = color; ctx.fillRect(x + 1, y + 1, 1, 1); }
  }
  return cv;
}

// 模板座標 → 放大後的圖片座標（含 1px 外框）
export const toPx = (c: number) => 2 * c + 2;

const BASE_PAL = {
  s: '#f2c79b', S: '#d29a6e', k: OUTLINE, w: '#d9dee6', W: '#8b93a3', o: '#ffd166', r: '#8b5a2b', l: '#4a3020',
  g: '#6cbf4a', G: '#a5e07a', D: '#3f7f2c', p: '#9b59b6', P: '#6c3483', f: '#2e6b2a', F: '#3f8a37',
};
const PROP_PAL: Record<string, Record<string, string>> = {
  tree: { L: '#5fae4c' },
  autumn: { f: '#8a3b1c', F: '#c8612a', L: '#f0a040' },
  pine: { f: '#1d4a2e', F: '#2b6b41', L: '#4b9a5e' },
  dead: { r: '#5b4636' },
  bush: { L: '#5fae4c' },
  rock: { w: '#a7a9b0', W: '#6e7079' },
  shroom: { t: '#d94b4b', L: '#ffe0e0', w: '#efe6d0' },
  flower: { t: '#f7f3ff', o: '#ffd166' },
  reed: { r: '#a0794a' },
  lily: { F: '#4f9a4a', o: '#ff9ecb' },
  lava: { o: '#ff7b1c', L: '#ffd166' },
  pillar: { w: '#b8b2a6', W: '#7a7468' },
  broken: { w: '#b8b2a6', W: '#7a7468' },
  bone: { w: '#ece6d6' },
  crystal: { L: '#e3c6ff' },
  fence: { r: '#7a5230' },
  fire: { o: '#ff8a1c', L: '#ffe066' },
  brazier: { o: '#ff8a1c', L: '#ffe066', w: '#7d838f', W: '#4d525c' },
  crate: { W: '#5c3a1c' },
};
const cache = new Map<string, HTMLCanvasElement>();
const cached = (key: string, make: () => HTMLCanvasElement) => {
  let cv = cache.get(key);
  if (!cv) { cv = make(); cache.set(key, cv); }
  return cv;
};

function heroPal(heroId: number, team: number) {
  const c = HEROES[heroId].color;
  return {
    ...BASE_PAL, b: c, B: shade(c, 0.7), L: shade(c, 1.3), h: shade(c, 0.55),
    t: TEAM_COLOR[team], T: shade(TEAM_COLOR[team], 0.65),
  };
}

export const heroSprite = (heroId: number, team: number, flash = false) =>
  cached(`h${heroId}:${team}:${flash}`, () => paint(BODIES[HEROES[heroId].role], heroPal(heroId, team), flash));

export const weaponOf = (heroId: number) => WEAPONS[HEROES[heroId].role];
export const weaponSprite = (heroId: number, team: number) =>
  cached(`w${heroId}:${team}`, () => paint(weaponOf(heroId).rows, heroPal(heroId, team)));

export function shapeSprite(kind: string, team: number, flash = false) {
  return cached(`${kind}:${team}:${flash}`, () => {
    const tc = team < 2 ? TEAM_COLOR[team] : '#aaaaaa';
    const stone = kind === 'tower' || kind === 'nexus' ? { w: '#b8bcc6', W: '#7d838f', k: '#2a2633' } : {};
    const light = kind === 'epic' ? '#c39bd3' : shade(tc, 1.35);
    return paint(SHAPES[kind], { ...BASE_PAL, ...stone, t: tc, T: shade(tc, 0.65), L: light, ...PROP_PAL[kind] }, flash);
  });
}
