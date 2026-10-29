import { HEROES, ROLE_STATS, type BuffStat, type Effect, type Skill, type SummonKind } from '../data/heroes';
import type { Player, Team } from '../data/teams';
import { makeRng, type Rng } from '../rng';
import { CAMPS, EPIC_POS, FOUNTAIN, H, NEXUS, NEXUS_TOWER, TOWERS, W, dist, lanePath, type Pt } from './map';

export const DT = 0.1;
export const MAX_TIME = 900;
const LANE_OF = { top: 0, mid: 1, adc: 2, sup: 2, jng: -1 } as const;
const LATE = 120; // 之後全隊集結推塔
const EPIC_FIRST = 75;

export type Kind = 'hero' | 'minion' | 'tower' | 'nexus' | 'camp' | 'epic' | 'summon';

export interface Unit {
  id: number; kind: Kind; team: number; // 0 藍 1 紅 2 中立
  x: number; y: number; r: number;
  hp: number; maxHp: number; atk: number; range: number; atkCd: number; atkT: number; spd: number;
  alive: boolean; target: number; goal: Pt | null;
  stunT: number;
  slows: { pct: number; t: number }[];
  buffs: { stat: BuffStat; pct: number; t: number }[];
  shields: { amt: number; t: number }[];
  dots: { dps: number; t: number; src: number }[];
  lastAtk: number; castT: number; hitT: number; fx: number; // 動畫用
  // hero
  heroId: number; player: Player | null; level: number; xp: number; cds: number[];
  em: number; ema: number; // 實際操作 / 意識（含熟練度）
  respawnT: number; recallT: number; thinkT: number; gank: number;
  k: number; d: number; a: number; dmg: number; taken: number;
  hitBy: Map<number, number>;
  // lane / structures
  lane: number; wp: number; tier: number;
  aggro: number; aggroT: number;
  home: Pt | null;
  // summon
  owner: number; expire: number; summon: SummonKind | null;
}

export type Ev =
  | { type: 'proj'; x: number; y: number; x2: number; y2: number; color: string }
  | { type: 'aoe'; x: number; y: number; r: number; color: string }
  | { type: 'text'; x: number; y: number; text: string; color: string }
  | { type: 'death'; x: number; y: number };

export interface Feed { t: number; text: string; team: number }

export interface Pick { hero: number; player: number } // player index in team

const ENEMY_FX = ['dmg', 'stun', 'slow', 'dot'];

export class Match {
  t = 0;
  units: Unit[] = [];
  byId = new Map<number, Unit>();
  events: Ev[] = [];
  feed: Feed[] = [];
  winner = -1;
  kills = [0, 0];
  towersDown = [0, 0];
  epicBuff = [0, 0];
  epicSpawn = EPIC_FIRST;
  epic!: Unit;
  nextWave = 3;
  rng: Rng;
  private nextId = 1;
  private pending: { at: number; caster: Unit; pt: Pt; skill: Skill }[] = [];

  constructor(public sides: [Team, Team], picks: [Pick[], Pick[]], seed: number) {
    this.rng = makeRng(seed);
    for (const team of [0, 1]) {
      for (const p of picks[team]) this.addHero(team, p.hero, sides[team].players[p.player]);
      TOWERS[team].forEach((lane, li) =>
        lane.forEach((pt, tier) => this.addStruct('tower', team, pt, tier === 0 ? 1500 : 1800, li, tier)));
      this.addStruct('tower', team, NEXUS_TOWER[team], 2200, -1, 2);
      this.addStruct('nexus', team, NEXUS[team], 2600, -1, 3);
      for (const c of CAMPS[team]) {
        const u = this.add(this.base('camp', 2, c, 420, 22, 10, 1.2, 16));
        u.home = { ...c };
      }
    }
    this.epic = this.add(this.base('epic', 2, EPIC_POS, 3200, 55, 14, 1.2, 14));
    this.epic.home = { ...EPIC_POS };
    this.epic.alive = false;
    this.epic.r = 6;
  }

  // ---------- setup ----------
  private base(kind: Kind, team: number, p: Pt, hp: number, atk: number, range: number, atkCd: number, spd: number): Unit {
    return {
      id: this.nextId++, kind, team, x: p.x, y: p.y, r: 3,
      hp, maxHp: hp, atk, range, atkCd, atkT: 0, spd,
      alive: true, target: -1, goal: null, stunT: 0, slows: [], buffs: [], shields: [], dots: [],
      lastAtk: -9, castT: -9, hitT: -9, fx: 1,
      heroId: -1, player: null, level: 1, xp: 0, cds: [0, 0, 0], em: 50, ema: 50,
      respawnT: 0, recallT: 0, thinkT: 0, gank: -1,
      k: 0, d: 0, a: 0, dmg: 0, taken: 0, hitBy: new Map(),
      lane: -1, wp: 1, tier: -1, aggro: -1, aggroT: 0, home: null,
      owner: -1, expire: 0, summon: null,
    };
  }
  private add(u: Unit) { this.units.push(u); this.byId.set(u.id, u); return u; }

  private addHero(team: number, heroId: number, player: Player) {
    const h = HEROES[heroId];
    const s = ROLE_STATS[h.role];
    const u = this.add(this.base('hero', team, FOUNTAIN[team], s.hp, s.atk, s.range, s.atkCd, s.spd));
    const prof = 0.8 + player.prof[heroId] / 250;
    Object.assign(u, { heroId, player, em: player.micro * prof, ema: player.macro * prof, lane: LANE_OF[player.pos] });
  }

  private addStruct(kind: Kind, team: number, p: Pt, hp: number, lane: number, tier: number) {
    const u = this.add(this.base(kind, team, p, hp, kind === 'tower' ? 110 : 0, 42, 1, 0));
    Object.assign(u, { lane, tier, r: 5 });
  }

  heroes(team?: number) { return this.units.filter((u) => u.kind === 'hero' && (team === undefined || u.team === team)); }

  // ---------- main loop ----------
  step() {
    if (this.winner >= 0) return;
    this.events = [];
    this.t += DT;
    const t = this.t;

    if (t >= this.nextWave) { this.spawnWave(); this.nextWave += 25; }
    if (!this.epic.alive && t >= this.epicSpawn) this.revive(this.epic, this.epic.home!);
    for (const u of this.units) {
      if (u.alive) continue;
      if (u.kind === 'camp' && t >= u.respawnT) this.revive(u, u.home!);
      if (u.kind === 'hero' && t >= u.respawnT) this.revive(u, FOUNTAIN[u.team]);
    }
    for (const p of this.pending.filter((p) => p.at <= t)) this.resolve(p.caster, p.pt, p.skill);
    this.pending = this.pending.filter((p) => p.at > t);

    for (const u of this.units) if (u.alive) this.tickStatus(u);
    for (const u of this.units) {
      if (!u.alive || u.stunT > t) continue;
      switch (u.kind) {
        case 'hero': this.heroAi(u); break;
        case 'minion': this.minionAi(u); break;
        case 'tower': this.towerAi(u); break;
        case 'camp': case 'epic': this.neutralAi(u); break;
        case 'summon': this.summonAi(u); break;
      }
    }
    this.separate();
    for (const u of this.units) {
      if (!u.alive && (u.kind === 'minion' || u.kind === 'summon')) this.byId.delete(u.id);
    }
    this.units = this.units.filter((u) => this.byId.has(u.id));

    // shortcut: 時間到用推塔數、擊殺數判勝負；真正的平衡做好後應該很少觸發
    if (t >= MAX_TIME && this.winner < 0) {
      const [a, b] = this.towersDown;
      this.winner = a !== b ? (a > b ? 0 : 1) : this.kills[0] >= this.kills[1] ? 0 : 1;
    }
  }

  private revive(u: Unit, p: Pt) {
    Object.assign(u, { alive: true, hp: u.maxHp, x: p.x, y: p.y, target: -1, goal: null, aggro: -1,
      stunT: 0, slows: [], buffs: [], shields: [], dots: [], recallT: 0 });
  }

  private spawnWave() {
    const m = 1 + this.t / 240;
    for (const team of [0, 1]) {
      for (let lane = 0; lane < 3; lane++) {
        for (let i = 0; i < 3; i++) {
          const ranged = i === 2;
          const p = NEXUS[team];
          const u = this.add(this.base('minion', team, { x: p.x + i * 2, y: p.y - i * 2 }, (ranged ? 180 : 260) * m,
            (ranged ? 22 : 16) * (1 + this.t / 300), ranged ? 32 : 10, ranged ? 1.2 : 1, 18));
          Object.assign(u, { lane, wp: 1, r: 2 });
        }
      }
    }
  }

  private tickStatus(u: Unit) {
    const t = this.t;
    for (const d of u.dots) this.deal(this.byId.get(d.src), u, d.dps * DT);
    u.dots = u.dots.filter((d) => d.t > t);
    u.slows = u.slows.filter((s) => s.t > t);
    u.buffs = u.buffs.filter((b) => b.t > t);
    u.shields = u.shields.filter((s) => s.t > t && s.amt > 0);
    u.atkT -= DT;
    if (u.kind === 'hero' && u.alive) {
      this.giveXp(u, 2 * DT); // 被壓制的一方也會慢慢成長
      const atFountain = dist(u, FOUNTAIN[u.team]) < 22;
      u.hp = Math.min(u.maxHp, u.hp + u.maxHp * (atFountain ? 0.15 : 0.004) * DT);
      if (u.recallT > 0 && t >= u.recallT) { Object.assign(u, FOUNTAIN[u.team]); u.recallT = 0; }
      // 泉水雷射
      const enemyFountain = FOUNTAIN[1 - u.team];
      if (dist(u, enemyFountain) < 30) this.deal(undefined, u, 400 * DT);
    }
    if (u.kind === 'summon' && t >= u.expire) u.alive = false;
  }

  private separate() {
    const movers = this.units.filter((u) => u.alive && (u.kind === 'hero' || u.kind === 'minion' || u.kind === 'summon'));
    for (let i = 0; i < movers.length; i++) {
      for (let j = i + 1; j < movers.length; j++) {
        const a = movers[i], b = movers[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const gap = a.kind === 'hero' && b.kind === 'hero' ? 6 : 4; // 英雄圖比較大，站開一點
        if (d >= gap || d === 0) continue;
        const push = (gap - d) * 0.25;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
  }

  // ---------- queries ----------
  vulnerable(u: Unit): boolean {
    if (u.kind !== 'tower' && u.kind !== 'nexus') return true;
    const own = this.units.filter((s) => s.team === u.team && s.kind === 'tower');
    if (u.tier === 0) return true;
    if (u.tier === 1) return !own.some((s) => s.lane === u.lane && s.tier === 0 && s.alive);
    if (u.tier === 2) return own.some((s) => s.tier === 1 && !s.alive);
    return !own.some((s) => s.tier === 2 && s.alive);
  }

  private targetable(by: Unit, u: Unit | undefined): u is Unit {
    return !!u && u.alive && u.team !== by.team && this.vulnerable(u);
  }

  private near(p: Pt, r: number, pred: (u: Unit) => boolean) {
    return this.units.filter((u) => u.alive && pred(u) && dist(p, u) <= r);
  }

  private enemyHeroesNear(u: Unit, p: Pt, r: number) {
    return this.near(p, r, (o) => o.kind === 'hero' && o.team !== u.team && o.team !== 2);
  }

  private underEnemyTower(u: Unit, p: Pt) {
    const tw = this.units.find((s) => s.kind === 'tower' && s.alive && s.team !== u.team && dist(s, p) <= s.range + 4);
    if (!tw) return false;
    return !this.near(tw, tw.range, (m) => m.kind === 'minion' && m.team === u.team).length;
  }

  private buffSum(u: Unit, stat: BuffStat) { return u.buffs.filter((b) => b.stat === stat).reduce((s, b) => s + b.pct, 0); }
  private atkMult(u: Unit) { return 1 + this.buffSum(u, 'atk') + (u.team < 2 && this.epicBuff[u.team] > this.t ? 0.25 : 0); }
  private lvl(u: Unit) { return 1 + 0.12 * (u.level - 1); }

  // ---------- combat ----------
  private moveTo(u: Unit, p: Pt) {
    const dx = p.x - u.x, dy = p.y - u.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.5) return;
    const slow = Math.max(0, ...u.slows.map((s) => s.pct));
    const step = Math.min(d, u.spd * (1 - slow) * (1 + this.buffSum(u, 'spd')) * DT);
    u.x = Math.max(2, Math.min(W - 2, u.x + (dx / d) * step));
    u.y = Math.max(2, Math.min(H - 2, u.y + (dy / d) * step));
    if (Math.abs(dx) > 0.3) u.fx = Math.sign(dx);
  }

  private attackOrMove(u: Unit, tgt: Unit) {
    if (dist(u, tgt) <= u.range + tgt.r) {
      if (u.atkT <= 0) this.basicAttack(u, tgt);
      if (Math.abs(tgt.x - u.x) > 0.3) u.fx = Math.sign(tgt.x - u.x);
    } else this.moveTo(u, tgt);
  }

  private basicAttack(u: Unit, tgt: Unit) {
    let dmg = u.atk * this.atkMult(u);
    if (u.kind === 'hero') dmg *= (0.85 + u.em / 400) * this.lvl(u);
    if (u.range > 20) this.events.push({ type: 'proj', x: u.x, y: u.y, x2: tgt.x, y2: tgt.y, color: u.kind === 'tower' ? '#ffe66d' : '#fff' });
    u.atkT = u.atkCd / (1 + this.buffSum(u, 'as'));
    u.lastAtk = this.t;
    this.deal(u, tgt, dmg);
  }

  private credit(src: Unit | undefined) {
    if (src?.kind === 'summon') return this.byId.get(src.owner) ?? src;
    return src;
  }

  private deal(src: Unit | undefined, tgt: Unit, amt: number) {
    if (!tgt.alive || amt <= 0) return;
    for (const s of tgt.shields) {
      const used = Math.min(s.amt, amt);
      s.amt -= used; amt -= used;
    }
    tgt.hp -= amt;
    tgt.hitT = this.t;
    const c = this.credit(src);
    if (tgt.kind === 'hero') {
      tgt.recallT = 0;
      tgt.taken += amt;
      if (c?.kind === 'hero') {
        c.dmg += amt;
        tgt.hitBy.set(c.id, this.t);
        // 塔會優先打攻擊己方英雄的敵人
        for (const tw of this.near(c, 46, (s) => s.kind === 'tower' && s.team === tgt.team)) {
          tw.aggro = c.id; tw.aggroT = this.t + 2;
        }
      }
    }
    if ((tgt.kind === 'camp' || tgt.kind === 'epic') && src) tgt.aggro = src.id;
    if (tgt.hp <= 0) this.kill(tgt, c);
  }

  private giveXp(h: Unit, n: number) {
    if (h.kind !== 'hero' || !h.alive) return;
    h.xp += n;
    while (h.level < 10 && h.xp >= 60 + h.level * 40) {
      h.xp -= 60 + h.level * 40;
      h.level++;
      const s = ROLE_STATS[HEROES[h.heroId].role];
      h.maxHp += s.hp * 0.08; h.hp += s.hp * 0.08; h.atk += s.atk * 0.06;
    }
  }

  private name(u: Unit | undefined) {
    if (!u) return '泉水';
    if (u.kind === 'hero') return `${u.player!.name}(${HEROES[u.heroId].name})`;
    return { minion: '小兵', tower: '防禦塔', nexus: '主堡', camp: '野怪', epic: '巨龍', summon: '召喚物', hero: '' }[u.kind];
  }

  private kill(v: Unit, killer: Unit | undefined) {
    v.alive = false;
    v.hp = 0;
    this.events.push({ type: 'death', x: v.x, y: v.y });
    const kt = killer && killer.team < 2 ? killer.team : v.team < 2 ? 1 - v.team : -1;
    if (kt < 0 && (v.kind === 'camp' || v.kind === 'epic')) {
      if (v.kind === 'camp') v.respawnT = this.t + 40; else this.epicSpawn = this.t + 100;
      return;
    }
    const teamHeroes = (team: number, p: Pt, r: number) => this.near(p, r, (h) => h.kind === 'hero' && h.team === team);
    switch (v.kind) {
      case 'hero': {
        v.d++;
        v.respawnT = this.t + 8 + v.level * 3;
        if (killer && killer.team < 2) this.kills[killer.team]++;
        if (killer?.kind === 'hero') { killer.k++; this.giveXp(killer, 60 + 20 * v.level); }
        for (const [id, at] of v.hitBy) {
          const h = this.byId.get(id);
          if (h && h !== killer && this.t - at < 8) { h.a++; this.giveXp(h, 30); }
        }
        v.hitBy.clear();
        this.feed.push({ t: this.t, text: `${this.name(killer)} 擊殺 ${this.name(v)}`, team: kt });
        break;
      }
      case 'minion':
        for (const h of teamHeroes(1 - v.team, v, 70)) this.giveXp(h, 14);
        break;
      case 'camp':
        v.respawnT = this.t + 40;
        for (const h of teamHeroes(kt, v, 60)) this.giveXp(h, 50);
        break;
      case 'epic':
        this.epicBuff[kt] = this.t + 60;
        this.epicSpawn = this.t + 100;
        for (const h of this.heroes(kt)) this.giveXp(h, 80);
        this.feed.push({ t: this.t, text: `${this.sides[kt].name} 擊殺巨龍！`, team: kt });
        break;
      case 'tower':
        this.towersDown[1 - v.team]++;
        for (const h of this.heroes(1 - v.team)) this.giveXp(h, 40);
        this.feed.push({ t: this.t, text: `${this.sides[1 - v.team].name} 摧毀防禦塔`, team: 1 - v.team });
        break;
      case 'nexus':
        this.winner = 1 - v.team;
        break;
    }
  }

  // ---------- AI ----------
  private minionAi(u: Unit) {
    let tgt = this.byId.get(u.target);
    if (!this.targetable(u, tgt) || tgt.team === 2 || dist(u, tgt) > 36) {
      tgt = this.near(u, 30, (o) => o.team !== u.team && o.team !== 2 && this.vulnerable(o))
        .sort((a, b) => dist(u, a) - dist(u, b))[0];
      u.target = tgt?.id ?? -1;
    }
    if (tgt) return this.attackOrMove(u, tgt);
    const path = lanePath(u.team, u.lane);
    if (u.wp < path.length - 1 && dist(u, path[u.wp]) < 4) u.wp++;
    this.moveTo(u, path[u.wp]);
  }

  private towerAi(u: Unit) {
    if (u.atkT > 0) return;
    const forced = this.byId.get(u.aggro);
    let tgt: Unit | undefined;
    if (forced?.alive && this.t < u.aggroT && dist(u, forced) <= u.range) tgt = forced;
    else {
      const foes = this.near(u, u.range, (o) => o.team !== u.team && o.team !== 2 && o.kind !== 'tower' && o.kind !== 'nexus')
        .sort((a, b) => dist(u, a) - dist(u, b));
      tgt = foes.find((o) => o.kind !== 'hero') ?? foes[0];
    }
    u.target = tgt?.id ?? -1;
    if (tgt) {
      u.atk = 110 * (1 + this.t / 600);
      this.basicAttack(u, tgt);
    }
  }

  private neutralAi(u: Unit) {
    const tgt = this.byId.get(u.aggro);
    const leash = u.kind === 'epic' ? 60 : 50;
    if (tgt?.alive && dist(tgt, u.home!) < leash) return this.attackOrMove(u, tgt);
    u.aggro = -1;
    if (dist(u, u.home!) > 1) { this.moveTo(u, u.home!); u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.2 * DT); }
  }

  private summonAi(u: Unit) {
    const owner = this.byId.get(u.owner);
    if (u.summon === 'totem') {
      for (const h of this.near(u, 40, (o) => o.kind === 'hero' && o.team === u.team)) h.hp = Math.min(h.maxHp, h.hp + u.atk * DT);
      return;
    }
    let tgt = owner ? this.byId.get(owner.target) : undefined;
    if (!this.targetable(u, tgt)) tgt = this.near(u, u.summon === 'turret' ? u.range : 40, (o) => o.team !== u.team && o.kind !== 'tower' && o.kind !== 'nexus')[0];
    if (tgt && (u.summon !== 'turret' || dist(u, tgt) <= u.range)) return this.attackOrMove(u, tgt);
    if (owner && u.summon !== 'turret' && dist(u, owner) > 12) this.moveTo(u, owner);
  }

  private heroAi(h: Unit) {
    if (h.recallT > 0) return; // 回城讀條中
    if (this.t >= h.thinkT) {
      this.think(h);
      h.thinkT = this.t + 1.1 - h.ema / 150 + this.rng.next() * 0.2;
    }
    this.castSkills(h);
    const tgt = this.byId.get(h.target);
    if (this.targetable(h, tgt)) this.attackOrMove(h, tgt);
    else if (h.goal) this.moveTo(h, h.goal);
  }

  private think(h: Unit) {
    const t = this.t;
    const hp = h.hp / h.maxHp;
    const fountain = FOUNTAIN[h.team];
    h.target = -1;
    h.goal = null;
    if (dist(h, fountain) < 22 && hp < 0.95) { h.goal = fountain; return; }
    if (hp < 0.15 + h.ema * 0.0025) {
      h.goal = fountain;
      if (!this.enemyHeroesNear(h, h, 55).length && dist(h, fountain) > 40) h.recallT = t + 4;
      return;
    }

    const foes = this.enemyHeroesNear(h, h, 60);
    if (foes.length) {
      const allies = this.near(h, 60, (o) => o.kind === 'hero' && o.team === h.team);
      const power = (us: Unit[]) => us.reduce((s, u) => s + u.hp * this.lvl(u), 0);
      const conf = power(allies) / power(foes);
      // 意識越低，對局勢的判斷越不準
      const noise = (this.rng.next() - 0.5) * (100 - Math.min(100, h.ema)) / 100;
      const prey = foes
        .filter((f) => !this.underEnemyTower(h, f) || (f.hp / f.maxHp < 0.25 && hp > 0.5))
        .sort((a, b) => a.hp - b.hp)[0];
      if (prey && (conf + noise > 0.85 || prey.hp / prey.maxHp < 0.25)) { h.target = prey.id; return; }
      if (conf + noise < 0.6) {
        const d = dist(h, fountain) || 1;
        h.goal = { x: h.x + ((fountain.x - h.x) / d) * 30, y: h.y + ((fountain.y - h.y) / d) * 30 };
        return;
      }
    }

    // 支援附近被打的隊友
    const ally = this.heroes(h.team).find((a) => a !== h && a.alive && dist(a, h) < 100
      && this.enemyHeroesNear(h, a, 40).length > 0);
    if (ally && this.rng.next() < h.ema / 120) { h.goal = { x: ally.x, y: ally.y }; return; }

    // 史詩野怪
    const epic = this.epic;
    const react = Math.max(0, 10 - h.ema / 10); // 意識高的人更早到位
    if (epic.alive ? t >= this.epicSpawn + react : this.epicSpawn - t < 8 - react) {
      if (!epic.alive || dist(h, epic) > 40 || foes.length) { h.goal = { ...EPIC_POS }; return; }
      h.target = epic.id;
      return;
    }

    const enemyUp = this.heroes(1 - h.team).filter((e) => e.alive).length;
    if (enemyUp <= 2) return this.laneLogic(h, this.pushLane(h.team)); // 人數優勢就推塔
    if (t < LATE && h.lane < 0) return this.jungle(h);
    this.laneLogic(h, t < LATE ? h.lane : this.pushLane(h.team));
  }

  private jungle(h: Unit) {
    const gank = this.byId.get(h.gank);
    if (gank?.alive && gank.hp / gank.maxHp < 0.7 && this.t < h.thinkT + 10) { h.goal = { x: gank.x, y: gank.y }; return; }
    h.gank = -1;
    if (this.rng.next() < h.ema / 500) {
      const victim = this.heroes(1 - h.team).find((e) => e.alive && e.hp / e.maxHp < 0.6 && dist(e, h) < 140
        && !this.underEnemyTower(h, e));
      if (victim) { h.gank = victim.id; h.goal = { x: victim.x, y: victim.y }; return; }
    }
    const camp = this.units
      .filter((u) => u.kind === 'camp' && u.alive)
      .sort((a, b) => this.campCost(h, a) - this.campCost(h, b))[0];
    if (!camp) return this.laneLogic(h, 1);
    if (dist(h, camp) < 50) h.target = camp.id;
    else h.goal = camp.home;
  }

  private campCost(h: Unit, c: Unit) {
    const own = CAMPS[h.team].some((p) => dist(p, c.home!) < 1);
    return dist(h, c) + (own ? 0 : 80);
  }

  // 敵方塔最少的那一路
  pushLane(team: number) {
    const left = [0, 1, 2].map((l) => this.units.filter((u) => u.kind === 'tower' && u.team !== team && u.lane === l && u.alive).length);
    const min = Math.min(...left);
    return left[1] === min ? 1 : left.indexOf(min);
  }

  private nextTower(team: number, lane: number) {
    const enemy = this.units.filter((u) => (u.kind === 'tower' || u.kind === 'nexus') && u.team !== team && u.alive);
    return enemy.find((u) => u.lane === lane && u.tier === 0) ?? enemy.find((u) => u.lane === lane && u.tier === 1)
      ?? enemy.find((u) => u.tier === 2) ?? enemy.find((u) => u.kind === 'nexus')!;
  }

  private laneLogic(h: Unit, lane: number) {
    const tw = this.nextTower(h.team, lane);
    if (!tw) return;
    const tanked = this.near(tw, tw.range, (m) => m.kind === 'minion' && m.team === h.team).length > 0;
    const groupNear = this.near(tw, 60, (o) => o.kind === 'hero' && o.team === h.team).length >= 3;
    if (this.vulnerable(tw) && dist(h, tw) < 70 && (tanked || groupNear)) { h.target = tw.id; return; }

    const minion = this.near(h, 50, (m) => m.kind === 'minion' && m.team !== h.team && !this.underEnemyTower(h, m))
      .sort((a, b) => a.hp - b.hp)[0];
    if (minion) { h.target = minion.id; return; }

    const path = lanePath(h.team, lane);
    const prog = (m: Unit) => m.wp * 10000 - dist(m, path[m.wp]);
    const front = this.units.filter((m) => m.alive && m.kind === 'minion' && m.team === h.team && m.lane === lane)
      .sort((a, b) => prog(b) - prog(a))[0];
    let goal: Pt;
    if (front) goal = { x: front.x, y: front.y };
    else {
      const own = this.units.filter((u) => u.kind === 'tower' && u.team === h.team && u.lane === lane && u.alive)
        .sort((a, b) => a.tier - b.tier)[0];
      goal = own ? { x: own.x, y: own.y } : NEXUS_TOWER[h.team];
    }
    if (!tanked && !groupNear && dist(goal, tw) < tw.range + 6) {
      const d = dist(goal, tw) || 1;
      goal = { x: tw.x + ((goal.x - tw.x) / d) * (tw.range + 8), y: tw.y + ((goal.y - tw.y) / d) * (tw.range + 8) };
    }
    h.goal = goal;
  }

  // ---------- skills ----------
  private castSkills(h: Unit) {
    for (let i = 0; i < 3; i++) {
      if (i === 2 && h.level < 4) continue;
      if (h.cds[i] > this.t) continue;
      const sk = HEROES[h.heroId].skills[i];
      if (this.tryCast(h, sk, i === 2)) {
        h.cds[i] = this.t + sk.cd;
        h.castT = this.t;
        this.events.push({ type: 'text', x: h.x, y: h.y - 8, text: sk.name, color: h.team === 0 ? '#9fd3ff' : '#ffb3b3' });
        return;
      }
    }
  }

  private tryCast(h: Unit, sk: Skill, ult: boolean): boolean {
    const has = (k: Effect['k']) => sk.effects.some((e) => e.k === k);
    const hp = h.hp / h.maxHp;
    const cur = this.byId.get(h.target);
    const inFight = this.targetable(h, cur) && cur.kind !== 'minion' && dist(h, cur) < h.range + 20;
    const foesNear = this.enemyHeroesNear(h, h, 60);

    switch (sk.target) {
      case 'enemy': {
        let tgt = this.targetable(h, cur) && (cur.kind === 'hero' || cur.kind === 'camp' || cur.kind === 'epic')
          && dist(h, cur) <= sk.range + cur.r ? cur : undefined;
        tgt ??= this.enemyHeroesNear(h, h, sk.range).sort((a, b) => a.hp - b.hp)[0];
        if (!tgt) return false;
        if (ult) {
          if (tgt.kind !== 'hero') return false;
          const crowd = sk.area ? this.enemyHeroesNear(h, tgt, sk.area).length : 1;
          if (crowd < 2 && tgt.hp / tgt.maxHp > 0.6) return false;
        }
        const dash = sk.effects.find((e) => e.k === 'dash');
        if (dash?.k === 'dash') this.dashToward(h, tgt, dash.dist);
        const pt = { x: tgt.x, y: tgt.y };
        if (sk.delay) this.pending.push({ at: this.t + sk.delay, caster: h, pt, skill: sk });
        else this.resolve(h, pt, sk, tgt);
        return true;
      }
      case 'around': {
        const heroes = this.enemyHeroesNear(h, h, sk.area!);
        const neutral = inFight && cur!.team === 2 && dist(h, cur!) <= sk.area!;
        if (ult ? heroes.length < 2 && !heroes.some((e) => e.hp / e.maxHp < 0.5) : !heroes.length && !neutral) return false;
        this.resolve(h, { x: h.x, y: h.y }, sk);
        return true;
      }
      case 'ally': {
        const ally = this.near(h, sk.range, (o) => o.kind === 'hero' && o.team === h.team)
          .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
        if (!ally) return false;
        const ahp = ally.hp / ally.maxHp;
        const allyTgt = this.byId.get(ally.target);
        const ok = has('heal') ? ahp < 0.65
          : has('shield') ? ahp < 0.7 && this.enemyHeroesNear(h, ally, 60).length > 0
          : this.targetable(ally, allyTgt) && allyTgt.kind !== 'minion';
        if (!ok) return false;
        this.apply(h, ally, sk.effects);
        this.events.push({ type: 'aoe', x: ally.x, y: ally.y, r: 6, color: '#7dffa0' });
        return true;
      }
      case 'allies': {
        const allies = this.near(h, sk.area!, (o) => o.kind === 'hero' && o.team === h.team);
        const ok = has('heal')
          ? allies.some((a) => a.hp / a.maxHp < 0.5) || allies.filter((a) => a.hp / a.maxHp < 0.7).length >= 2
          : foesNear.length >= (ult ? 2 : 1);
        if (!ok) return false;
        for (const a of allies) this.apply(h, a, sk.effects);
        this.events.push({ type: 'aoe', x: h.x, y: h.y, r: Math.min(sk.area!, 40), color: '#7dffa0' });
        return true;
      }
      case 'self': {
        const ok = sk.effects.some((e) => {
          switch (e.k) {
            case 'dash': return hp < 0.5 && this.enemyHeroesNear(h, h, 35).length > 0;
            case 'heal': return hp < 0.6;
            case 'shield': return hp < 0.75 && foesNear.length > 0;
            case 'summon': return inFight;
            case 'buff': return e.stat === 'spd' ? (hp < 0.4 && foesNear.length > 0) || (inFight && cur!.kind === 'hero' && dist(h, cur!) > h.range) : inFight;
            default: return false;
          }
        });
        if (!ok) return false;
        if (has('dash')) {
          const away = foesNear.sort((a, b) => dist(h, a) - dist(h, b))[0];
          const from = away ?? { x: h.x + 1, y: h.y - 1 };
          const d = dist(h, from) || 1;
          const dash = sk.effects.find((e) => e.k === 'dash')!;
          if (dash.k === 'dash') this.dashTo(h, { x: h.x + ((h.x - from.x) / d) * dash.dist, y: h.y + ((h.y - from.y) / d) * dash.dist });
        }
        this.apply(h, h, sk.effects);
        return true;
      }
    }
  }

  private dashToward(h: Unit, tgt: Unit, maxDist: number) {
    const d = dist(h, tgt);
    const go = Math.max(0, Math.min(maxDist, d - 6));
    this.dashTo(h, { x: h.x + ((tgt.x - h.x) / (d || 1)) * go, y: h.y + ((tgt.y - h.y) / (d || 1)) * go });
  }

  private dashTo(h: Unit, p: Pt) {
    h.x = Math.max(2, Math.min(W - 2, p.x));
    h.y = Math.max(2, Math.min(H - 2, p.y));
  }

  private resolve(h: Unit, pt: Pt, sk: Skill, primary?: Unit) {
    const color = HEROES[h.heroId].color;
    const targets = sk.area
      ? this.near(pt, sk.area, (o) => o.team !== h.team && o.kind !== 'tower' && o.kind !== 'nexus')
      : primary?.alive ? [primary] : [];
    if (sk.area) this.events.push({ type: 'aoe', x: pt.x, y: pt.y, r: sk.area, color });
    else if (primary) this.events.push({ type: 'proj', x: h.x, y: h.y, x2: pt.x, y2: pt.y, color });
    for (const tgt of targets) {
      if (tgt.kind === 'hero' && this.rng.next() > this.hitChance(h, tgt)) {
        this.events.push({ type: 'text', x: tgt.x, y: tgt.y - 6, text: 'MISS', color: '#ccc' });
        continue;
      }
      this.apply(h, tgt, sk.effects.filter((e) => ENEMY_FX.includes(e.k)));
    }
  }

  hitChance(h: Unit, tgt: Unit) {
    return Math.max(0.35, Math.min(0.95, 0.72 + (h.em - tgt.em) / 150));
  }

  private apply(h: Unit, tgt: Unit, effects: Effect[]) {
    const lm = this.lvl(h);
    const t = this.t;
    for (const e of effects) {
      switch (e.k) {
        case 'dmg': {
          const exec = e.execute ? 1 + 2 * (1 - tgt.hp / tgt.maxHp) : 1;
          this.deal(h, tgt, e.amt * lm * this.atkMult(h) * exec);
          break;
        }
        case 'stun': tgt.stunT = Math.max(tgt.stunT, t + e.dur); break;
        case 'slow': tgt.slows.push({ pct: e.pct, t: t + e.dur }); break;
        case 'dot': tgt.dots.push({ dps: e.dps * lm, t: t + e.dur, src: h.id }); break;
        case 'heal': tgt.hp = Math.min(tgt.maxHp, tgt.hp + e.amt * lm); break;
        case 'shield': tgt.shields.push({ amt: e.amt * lm, t: t + e.dur }); break;
        case 'buff': tgt.buffs.push({ stat: e.stat, pct: e.pct, t: t + e.dur }); break;
        case 'summon': for (let i = 0; i < e.n; i++) this.spawnSummon(h, e.unit, e.dur, i); break;
        case 'dash': break;
      }
    }
  }

  private spawnSummon(h: Unit, kind: SummonKind, dur: number, i: number) {
    const lm = this.lvl(h);
    const s = {
      wolf: [220, 18, 10, 1, 24], clone: [180, 28, 10, 0.9, 24], turret: [300, 30, 45, 1, 0], totem: [200, 20, 0, 1, 0],
    }[kind];
    const u = this.add(this.base('summon', h.team, { x: h.x + (i ? 4 : -4), y: h.y + 3 }, s[0] * lm, s[1] * lm, s[2], s[3], s[4]));
    Object.assign(u, { owner: h.id, expire: this.t + dur, summon: kind, r: 2 });
  }

  // ---------- results ----------
  runToEnd() { while (this.winner < 0) this.step(); }
}
