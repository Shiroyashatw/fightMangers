export type Pt = { x: number; y: number };

export const W = 320;
export const H = 200;

// 藍方左下，紅方右上；河道是左上到右下的對角線。
export const FOUNTAIN: Pt[] = [{ x: 12, y: 188 }, { x: 308, y: 12 }];
export const NEXUS: Pt[] = [{ x: 30, y: 170 }, { x: 290, y: 30 }];
export const NEXUS_TOWER: Pt[] = [{ x: 46, y: 154 }, { x: 274, y: 46 }];

// blue → red waypoints for top / mid / bot
export const LANES: Pt[][] = [
  [NEXUS[0], { x: 22, y: 22 }, NEXUS[1]],
  [NEXUS[0], NEXUS[1]],
  [NEXUS[0], { x: 298, y: 178 }, NEXUS[1]],
];

export const lanePath = (team: number, lane: number) => (team === 0 ? LANES[lane] : [...LANES[lane]].reverse());

const mirror = (p: Pt): Pt => ({ x: W - p.x, y: H - p.y });
const BLUE_CAMPS: Pt[] = [{ x: 70, y: 95 }, { x: 120, y: 150 }, { x: 190, y: 160 }];
export const CAMPS: Pt[][] = [BLUE_CAMPS, BLUE_CAMPS.map(mirror)];
export const EPIC_POS: Pt = { x: 200, y: 125 };

export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

export function pointAt(path: Pt[], f: number): Pt {
  const segs = path.slice(1).map((p, i) => dist(path[i], p));
  let left = segs.reduce((a, b) => a + b, 0) * f;
  for (let i = 0; i < segs.length; i++) {
    if (left <= segs[i]) {
      const k = left / segs[i];
      return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k };
    }
    left -= segs[i];
  }
  return path[path.length - 1];
}

// tower positions [team][lane][tier], tier 0 = outer, 1 = inner
export const TOWERS: Pt[][][] = [0, 1].map((team) =>
  LANES.map((path) => (team === 0 ? [0.36, 0.18] : [0.64, 0.82]).map((f) => pointAt(path, f))),
);
