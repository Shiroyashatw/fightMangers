import { makeRng } from '../rng';
import { CAMPS, EPIC_POS, FOUNTAIN, H, LANES, TOWERS, W, dist, type Pt } from '../sim/map';
import { shapeSprite } from './sprites';

export const S = 4; // 世界像素 / 模擬單位
const CLIFF = 14; // 懸崖高度（世界像素）

const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function segDist(p: Pt, a: Pt, b: Pt) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - a.x - k * dx, p.y - a.y - k * dy);
}
const SEGS = LANES.flatMap((l) => l.slice(1).map((b, i) => [l[i], b] as const));
const CAMP_PTS = CAMPS.flat();
function laneDist(p: Pt) {
  let d = Infinity;
  for (const [a, b] of SEGS) d = Math.min(d, segDist(p, a, b));
  return d;
}
const riverDist = (p: Pt) => Math.abs(H * p.x - W * p.y) / Math.hypot(W, H);
const blueSide = (p: Pt) => p.y / H > p.x / W;

// 野區是高台；兵線、河道、基地、巨龍巢穴是低地
const isHigh = (p: Pt) => laneDist(p) > 9 && riverDist(p) > 10 && FOUNTAIN.every((f) => dist(p, f) > 34) && dist(p, EPIC_POS) > 17;

type RGB = [number, number, number];
const rgb = (hex: string): RGB => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB;
const P = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, rgb(v)])) as Record<string, RGB>;
const C = P({
  meadow: '#5d9a45', meadowDark: '#4f8a3b', meadowLight: '#73b057',
  dirt: '#b08a57', dirtDark: '#8f6c40', pebble: '#c9a774', cobble: '#9a9690', cobbleDark: '#6f6c68',
  water: '#2f74b5', waterDeep: '#255f99', foam: '#a5d6f5', sand: '#d8c38a', sandDark: '#bba56c',
  plank: '#9a6a3a', plankDark: '#6e4626',
  rock: '#8a7a66', rockLight: '#a8977f', rockDark: '#5e5244', rockDeep: '#3e362d',
  campFloor: '#6a5a3c', campDark: '#57492f',
  ruin: '#b5ab96', ruinDark: '#8f8572', rune: '#a77ad6',
  castle: '#6f7f99', castleDark: '#56647c', mortar: '#3b4456',
  basalt: '#3c3235', basaltDark: '#2c2427', lava: '#ff7b1c', lavaGlow: '#c0471a',
});
// 高台草地：藍方翠綠、紅方秋色
const HIGH = [
  P({ base: '#3f7f34', dark: '#346d2b', light: '#55994a', rim: '#7cc062', flower: '#9fd3ff' }),
  P({ base: '#7a7a34', dark: '#66652b', light: '#94903f', rim: '#b8ae5a', flower: '#ffb36b' }),
];
const mul = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

function buildHighMask() {
  const mw = (W * S) >> 1, mh = (H * S) >> 1;
  const mask = new Uint8Array(mw * mh);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) mask[y * mw + x] = isHigh({ x: (x * 2) / S, y: (y * 2) / S }) ? 1 : 0;
  return (x: number, y: number) => x >= 0 && y >= 0 && x < W * S && y < H * S && mask[(y >> 1) * mw + (x >> 1)] === 1;
}

function terrain(x: number, y: number, high: (x: number, y: number) => boolean): RGB {
  const p = { x: x / S, y: y / S };
  const n = hash(x, y);
  const tile = hash(x >> 4, y >> 4);

  if (high(x, y)) {
    const g = HIGH[blueSide(p) ? 0 : 1];
    if (!high(x, y - 2) || (!high(x, y - 4) && n < 0.5)) return g.rim; // 高台邊緣受光
    if (CAMP_PTS.some((c) => dist(p, c) < 9)) return n < 0.2 ? C.campDark : C.campFloor;
    if (n < 0.012) return g.flower;
    return n < 0.28 + tile * 0.2 ? g.dark : n > 0.94 ? g.light : g.base;
  }
  // 懸崖側面
  for (let d = 1; d <= CLIFF; d++) {
    if (!high(x, y - d)) continue;
    if (d > CLIFF - 2) return C.rockDeep;
    const streak = hash(x >> 1, 7) < 0.3;
    const base = d < 3 ? C.rockLight : d > CLIFF - 5 ? C.rockDark : C.rock;
    return streak ? mul(base, 0.85) : n < 0.08 ? C.rockDark : base;
  }
  const shadow = [CLIFF + 2, CLIFF + 6, CLIFF + 10].some((d) => high(x - 4, y - d)) ? 0.72 : 1;
  return mul(low(x, y, p, n, tile), shadow);
}

function low(x: number, y: number, p: Pt, n: number, tile: number): RGB {
  const fb = dist(p, FOUNTAIN[0]), fr = dist(p, FOUNTAIN[1]);
  if (fb < 34) { // 藍方城堡石板
    const mortar = y % 8 === 0 || ((y >> 3) & 1 ? (x + 8) % 16 === 0 : x % 16 === 0);
    return mortar ? C.mortar : n < 0.15 ? C.castleDark : C.castle;
  }
  if (fr < 34) { // 紅方火山岩與熔岩裂縫
    const crack = hash(x >> 3, y >> 3) < 0.09 && hash(x >> 1, y >> 1) < 0.6;
    if (crack) return n < 0.5 ? C.lava : C.lavaGlow;
    return n < 0.3 ? C.basaltDark : C.basalt;
  }
  const lane = laneDist(p), river = riverDist(p), epic = dist(p, EPIC_POS);
  if (epic < 17) { // 巨龍巢穴遺跡
    if (Math.abs(epic - 12) < 0.6) return C.rune;
    const crackLine = (x + y) % 19 === 0 && n < 0.6;
    return crackLine ? C.ruinDark : ((x >> 3) + (y >> 3)) & 1 ? C.ruin : n < 0.2 ? C.ruinDark : mul(C.ruin, 0.92);
  }
  if (river < 7 && lane < 4.5) { // 木橋
    if ((y & 7) === 0 || lane > 3.9) return C.plankDark;
    return n < 0.1 ? C.plankDark : C.plank;
  }
  if (river < 6) {
    const wave = (x + Math.floor(y * 1.6)) % 23 === 0 && n < 0.7;
    return wave ? C.foam : river < 3.5 ? C.waterDeep : C.water;
  }
  if (river < 8) return river < 7 ? C.sandDark : n < river - 7 ? C.meadow : C.sand;
  if (lane < 3.6) return n < 0.04 ? C.pebble : n < 0.12 ? C.dirtDark : C.dirt;
  if (lane < 4.6) return hash(x >> 2, y >> 2) < 0.5 ? C.cobble : C.cobbleDark; // 路邊石
  if (n < 0.02 && tile < 0.6) return C.meadowLight;
  return n < 0.3 + tile * 0.2 ? C.meadowDark : C.meadow;
}

interface Prop { p: Pt; kind: string; team: number; k: number }

function placeProps(high: (x: number, y: number) => boolean): Prop[] {
  const rng = makeRng(11);
  const props: Prop[] = [];
  const add = (p: Pt, kind: string, team = 2, k = 1) => props.push({ p, kind, team, k });
  const free = (p: Pt, gap: number) => props.every((o) => dist(o.p, p) >= gap);
  const towers = TOWERS.flat(2);
  const highAt = (p: Pt) => high(Math.round(p.x * S), Math.round(p.y * S));

  // 高台森林：藍方綠樹松樹、紅方秋樹枯樹
  for (let i = 0; i < 6000; i++) {
    const p = { x: rng.next() * W, y: rng.next() * H + 4 };
    if (!highAt(p) || !highAt({ x: p.x, y: p.y - 6 }) || !highAt({ x: p.x, y: p.y + 3 })) continue;
    if (CAMP_PTS.some((c) => dist(p, c) < 13) || !free(p, 7.5)) continue;
    const r = rng.next();
    const kind = blueSide(p) ? (r < 0.55 ? 'tree' : r < 0.85 ? 'pine' : 'bush') : (r < 0.55 ? 'autumn' : r < 0.7 ? 'dead' : r < 0.85 ? 'pine' : 'bush');
    add(p, kind, 2, kind === 'bush' ? 1 : 2);
  }
  for (let i = 0; i < 2500; i++) { // 林下的小東西
    const p = { x: rng.next() * W, y: rng.next() * H };
    if (!highAt(p) || !free(p, 4)) continue;
    add(p, rng.next() < 0.4 ? 'shroom' : 'flower', blueSide(p) ? 0 : 1);
  }
  // 營地：營火與石頭圍一圈
  for (const c of CAMP_PTS) {
    add({ x: c.x + 6, y: c.y - 5 }, 'fire');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      add({ x: c.x + Math.cos(a) * 10, y: c.y + Math.sin(a) * 8 }, i % 2 ? 'rock' : 'shroom');
    }
  }
  // 兵線兩側
  for (let i = 0; i < 3000; i++) {
    const p = { x: rng.next() * W, y: rng.next() * H };
    const lane = laneDist(p);
    if (lane < 5.5 || lane > 9 || highAt(p) || riverDist(p) < 9 || FOUNTAIN.some((f) => dist(p, f) < 36)) continue;
    if (towers.some((t) => dist(t, p) < 8) || !free(p, 5)) continue;
    const r = rng.next();
    add(p, r < 0.35 ? 'bush' : r < 0.6 ? 'rock' : r < 0.85 ? 'flower' : 'fence', blueSide(p) ? 0 : 1);
  }
  // 河道：蓮葉、蘆葦、石頭
  for (let i = 0; i < 3000; i++) {
    const p = { x: rng.next() * W, y: rng.next() * H };
    const river = riverDist(p);
    if (laneDist(p) < 8 || dist(p, EPIC_POS) < 19 || FOUNTAIN.some((f) => dist(p, f) < 36) || !free(p, 4)) continue;
    if (river < 4.5) { if (rng.next() < 0.25) add(p, 'lily'); }
    else if (river > 6.2 && river < 8.5 && !highAt(p)) add(p, rng.next() < 0.75 ? 'reed' : 'rock');
  }
  // 基地
  FOUNTAIN.forEach((f, team) => {
    const toward = team === 0 ? 1 : -1;
    for (let i = 0; i < 7; i++) {
      const a = (team === 0 ? -Math.PI / 2 : Math.PI / 2) + (i / 6) * (Math.PI / 2) * toward;
      add({ x: f.x + Math.cos(a) * 27, y: f.y + Math.sin(a) * 27 }, i % 2 ? 'brazier' : 'banner', team);
    }
    for (let i = 0; i < 6; i++) {
      const p = { x: f.x + toward * (8 + rng.next() * 16), y: f.y - toward * (8 + rng.next() * 16) };
      if (laneDist(p) > 5) add(p, team === 0 ? 'crate' : 'lava', team);
    }
  });
  // 巨龍巢穴：石柱、骨頭、水晶
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    add({ x: EPIC_POS.x + Math.cos(a) * 15, y: EPIC_POS.y + Math.sin(a) * 11 }, i % 3 === 2 ? 'broken' : 'pillar');
  }
  for (let i = 0; i < 8; i++) {
    const a = rng.next() * Math.PI * 2, r = 5 + rng.next() * 7;
    add({ x: EPIC_POS.x + Math.cos(a) * r, y: EPIC_POS.y + Math.sin(a) * r * 0.7 }, i < 5 ? 'bone' : 'crystal');
  }
  return props.sort((a, b) => a.p.y - b.p.y);
}

let cached: HTMLCanvasElement | null = null;

// 生成一次約 0.6 秒，之後每場比賽共用
export function mapImage() {
  return (cached ??= buildMap());
}

function buildMap() {
  const cv = document.createElement('canvas');
  cv.width = W * S; cv.height = H * S;
  const ctx = cv.getContext('2d')!;
  const high = buildHighMask();
  const img = ctx.createImageData(cv.width, cv.height);
  for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
    const [r, g, b] = terrain(x, y, high);
    const i = (y * cv.width + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  for (const { p, kind, team, k } of placeProps(high)) {
    const spr = shapeSprite(kind, team);
    const w = spr.width * k, h = spr.height * k;
    if (kind !== 'lily' && kind !== 'flower') { // 投影
      ctx.fillStyle = 'rgba(10,20,10,0.28)';
      ctx.beginPath(); ctx.ellipse(p.x * S + w * 0.15, p.y * S, w * 0.45, Math.max(2, w * 0.16), 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.drawImage(spr, Math.round(p.x * S - w / 2), Math.round(p.y * S - h), w, h);
  }
  return cv;
}
