import { HEROES } from '../data/heroes';
import { H, W, dist, type Pt } from '../sim/map';
import type { Ev, Match, Unit } from '../sim/match';
import { S, mapImage } from './mapArt';
import { TEAM_COLOR, heroSprite, shapeSprite, toPx, weaponOf, weaponSprite } from './sprites';

const VIEW_W = 960, VIEW_H = 600;
const LIFE = { proj: 0.2, aoe: 0.45, text: 0.9, death: 0.5 };
const SIZE: Record<string, number> = { epic: 2, nexus: 2, tower: 2 }; // 放大倍數
const ATK_TIME = 0.32, CAST_TIME = 0.45;

interface Fx { ev: Ev; born: number }

// 自動導播：找交戰最激烈的地方，依範圍縮放
class Director {
  x = (W * S) / 2; y = (H * S) / 2; z = 1;
  private focus = -1;
  private holdUntil = 0;
  manual: { p: Pt; until: number } | null = null;

  private heat(m: Match, h: Unit) {
    let s = 0;
    for (const o of m.units) {
      if (!o.alive || o.kind !== 'hero' || dist(o, h) > 45) continue;
      s += m.t - o.lastAtk < 2 ? 3 : 0.4;
      if (o.team !== h.team) s += 1;
    }
    if (m.epic.alive && m.epic.aggro >= 0 && dist(m.epic, h) < 40) s += 3;
    return s;
  }

  update(m: Match, dt: number) {
    let target: Pt, viewW: number;
    if (this.manual && performance.now() < this.manual.until) {
      target = this.manual.p; viewW = 140;
    } else {
      this.manual = null;
      const heroes = m.heroes().filter((h) => h.alive);
      const cur = m.byId.get(this.focus);
      const best = heroes.map((h) => ({ h, s: this.heat(m, h) })).sort((a, b) => b.s - a.s)[0];
      if (best && (!cur?.alive || (m.t > this.holdUntil && best.s > this.heat(m, cur) * 1.3))) {
        this.focus = best.h.id; this.holdUntil = m.t + 4;
      }
      const f = m.byId.get(this.focus);
      const group = f?.alive ? heroes.filter((h) => dist(h, f) < 35) : [];
      if (!f?.alive || !group.length) { target = { x: W / 2, y: H / 2 }; viewW = W; }
      else {
        // 重心偏向焦點英雄，避免拍到兩群人中間的空地
        const cx = group.reduce((s, h) => s + h.x, 0) / group.length, cy = group.reduce((s, h) => s + h.y, 0) / group.length;
        target = { x: (cx + f.x) / 2, y: (cy + f.y) / 2 };
        viewW = Math.max(100, Math.min(240, Math.max(...group.map((h) => dist(h, target))) * 2 + 70));
      }
    }
    const k = 1 - Math.exp(-dt * 2.5);
    this.z += (VIEW_W / (viewW * S) - this.z) * k;
    this.x += (target.x * S - this.x) * k;
    this.y += (target.y * S - this.y) * k;
    // 不要拍到地圖外
    const hw = VIEW_W / 2 / this.z, hh = VIEW_H / 2 / this.z;
    this.x = Math.max(Math.min(hw, (W * S) / 2), Math.min(W * S - Math.min(hw, (W * S) / 2), this.x));
    this.y = Math.max(Math.min(hh, (H * S) / 2), Math.min(H * S - Math.min(hh, (H * S) / 2), this.y));
  }
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private mini: CanvasRenderingContext2D;
  private bg = mapImage();
  private miniBg = (() => { // 小地圖底圖只縮一次
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const c = cv.getContext('2d')!;
    c.imageSmoothingEnabled = true;
    c.drawImage(this.bg, 0, 0, W, H);
    return cv;
  })();
  private prev = new Map<number, Pt>();
  private alpha = 1;
  private fx: Fx[] = [];
  private cam = new Director();
  private last = performance.now();

  constructor(canvas: HTMLCanvasElement, minimap: HTMLCanvasElement) {
    canvas.width = VIEW_W; canvas.height = VIEW_H;
    minimap.width = W; minimap.height = H;
    this.ctx = canvas.getContext('2d')!;
    this.mini = minimap.getContext('2d')!;
    minimap.onclick = (e) => {
      const r = minimap.getBoundingClientRect();
      this.cam.manual = { p: { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H }, until: performance.now() + 5000 };
    };
  }

  collect(m: Match) { for (const ev of m.events) this.fx.push({ ev, born: m.t }); }

  // 模擬每 0.1 秒一步；記下上一步的位置，畫面在兩步之間補間才不會一格一格跳
  snapshot(m: Match) {
    this.prev.clear();
    for (const u of m.units) this.prev.set(u.id, { x: u.x, y: u.y });
  }

  private pos(u: Unit): Pt {
    const p = this.prev.get(u.id);
    if (!p || Math.abs(p.x - u.x) + Math.abs(p.y - u.y) > 30) return u; // 回城、復活直接瞬移
    return { x: p.x + (u.x - p.x) * this.alpha, y: p.y + (u.y - p.y) * this.alpha };
  }

  private sx(x: number) { return (x * S - this.cam.x) * this.cam.z + VIEW_W / 2; }
  private sy(y: number) { return (y * S - this.cam.y) * this.cam.z + VIEW_H / 2; }

  draw(m: Match, alpha = 1) {
    this.alpha = alpha;
    const now = performance.now();
    this.cam.update(m, Math.min(0.1, (now - this.last) / 1000));
    this.last = now;
    const ctx = this.ctx, z = this.cam.z;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10131a'; ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // 平移取整數像素，鏡頭移動時像素才不會抖
    ctx.setTransform(z, 0, 0, z, Math.round(VIEW_W / 2 - this.cam.x * z), Math.round(VIEW_H / 2 - this.cam.y * z));
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.bg, 0, 0);

    const shown = m.units.filter((u) => u.alive || u.kind === 'tower' || u.kind === 'nexus').sort((a, b) => a.y - b.y);
    for (const u of shown) this.drawUnit(m, u);
    this.fx = this.fx.filter((f) => m.t - f.born < LIFE[f.ev.type]);
    for (const f of this.fx) if (f.ev.type !== 'text') this.drawFx(f, m.t - f.born);

    // 介面層用螢幕座標，字和血條才會清楚
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const u of shown) if (u.alive) this.bars(m, u);
    for (const f of this.fx) if (f.ev.type === 'text') this.drawFx(f, m.t - f.born);
    this.drawMinimap(m);
  }

  private heroIdOf(m: Match, u: Unit) { return u.heroId >= 0 ? u.heroId : m.byId.get(u.owner)?.heroId ?? 0; }

  private spriteOf(m: Match, u: Unit, flash = false) {
    const heroLike = u.kind === 'hero' || u.summon === 'clone';
    const img = heroLike ? heroSprite(this.heroIdOf(m, u), u.team, flash) : shapeSprite(u.summon ?? u.kind, u.team, flash);
    return { img, k: SIZE[u.kind] ?? 1, heroLike };
  }

  private drawUnit(m: Match, u: Unit) {
    const ctx = this.ctx;
    const at = this.pos(u);
    const px = Math.round(at.x * S), py = Math.round(at.y * S);
    if (!u.alive) { // 廢墟
      ctx.fillStyle = '#3a3a44'; ctx.fillRect(px - 20, py - 8, 40, 12);
      ctx.fillStyle = '#5a5a66'; ctx.fillRect(px - 14, py - 14, 10, 8); ctx.fillRect(px + 4, py - 12, 8, 6);
      ctx.fillStyle = '#2a2a33'; ctx.fillRect(px - 2, py - 10, 4, 4);
      return;
    }
    const flash = m.t - u.hitT < 0.08;
    const { img, k, heroLike } = this.spriteOf(m, u, flash);
    const w = img.width * k, h = img.height * k;
    const a = (m.t - u.lastAtk) / ATK_TIME; // 0→1 普攻動畫進度
    const c = (m.t - u.castT) / CAST_TIME; // 0→1 施法動畫進度
    const heroId = heroLike ? this.heroIdOf(m, u) : -1;
    const wpn = heroLike ? weaponOf(heroId) : null;
    const melee = wpn ? wpn.melee : u.range < 20;

    // 身體：近戰往前撲、遠程後座力、走路上下晃
    let dx = 0;
    if (a < 1) dx = melee ? (a < 0.35 ? a / 0.35 : 1 - (a - 0.35) / 0.65) * 5 : a < 0.25 ? -2 : 0;
    const bob = heroLike && a >= 1 && Math.floor(m.t * 6 + u.id) % 2 ? -1 : 0;

    if (c < 1 && heroLike) { // 施法光圈
      ctx.globalAlpha = 1 - c;
      ctx.strokeStyle = HEROES[heroId].color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py, 14 + c * 10, 5 + c * 4, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fff';
      for (let i = 0; i < 4; i++) ctx.fillRect(px - 10 + i * 6, py - 6 - c * 26 - (i % 2) * 6, 2, 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = heroLike ? TEAM_COLOR[u.team] + '77' : 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(px, py, Math.min(w * 0.4, 30), Math.max(3, Math.min(w * 0.14, 10)), 0, 0, Math.PI * 2); ctx.fill();

    const x = px - w / 2 + dx * u.fx, y = py - h + bob + 2;
    ctx.save();
    if (u.summon === 'clone') ctx.globalAlpha = 0.55;
    if (u.fx < 0) { ctx.translate(2 * px, 0); ctx.scale(-1, 1); }
    ctx.drawImage(img, u.fx < 0 ? 2 * px - x - w : x, y, w, h);
    ctx.restore();

    if (wpn) {
      // 武器繞著手旋轉：近戰先舉起再往前砍；遠程舉起瞄準；施法高舉
      let ang = wpn.idle;
      if (c < 1) ang = -0.5;
      else if (a < 1) {
        if (melee) ang = a < 0.12 ? wpn.idle - 1.4 * (a / 0.12) : a < 0.4 ? wpn.idle - 1.4 + 3.2 * ((a - 0.12) / 0.28) : wpn.idle + 1.8 * (1 - (a - 0.4) / 0.6);
        else ang = wpn.idle + (a < 0.3 ? 1.1 : 1.1 * (1 - (a - 0.3) / 0.7));
      }
      const hx = x + toPx(wpn.hand[0]), hy = y + toPx(wpn.hand[1]);
      const wx = u.fx < 0 ? 2 * px - hx : hx;
      ctx.save();
      if (u.summon === 'clone') ctx.globalAlpha = 0.55;
      ctx.translate(wx, hy); ctx.scale(u.fx, 1); ctx.rotate(ang);
      ctx.drawImage(weaponSprite(heroId, u.team), -toPx(wpn.pivot[0]), -toPx(wpn.pivot[1]));
      ctx.restore();
      if (a < 1 && melee && a > 0.15 && a < 0.55) { // 斬擊光弧
        ctx.globalAlpha = 1 - (a - 0.15) / 0.4;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
        ctx.beginPath();
        if (u.fx > 0) ctx.arc(wx, hy - 4, 18, -1.3, 0.9); else ctx.arc(wx, hy - 4, 18, Math.PI - 0.9, Math.PI + 1.3);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (a < 0.2 && !melee) { // 出手閃光
        ctx.fillStyle = '#fff6c8';
        ctx.fillRect(wx + u.fx * 10 - 3, hy - 10, 6, 6);
      }
    }

    if (u.stunT > m.t) {
      ctx.fillStyle = '#ffe66d';
      const t = m.t * 8;
      for (let i = 0; i < 3; i++) ctx.fillRect(px + Math.cos(t + i * 2.1) * 10 - 2, y - 6 + Math.sin(t + i * 2.1) * 3, 4, 4);
    }
    if (u.shields.length) {
      ctx.strokeStyle = 'rgba(159,232,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(px, py - h / 2, w * 0.6, h * 0.6, 0, 0, Math.PI * 2); ctx.stroke();
    }
    if (u.team < 2 && m.epicBuff[u.team] > m.t && u.kind === 'hero') {
      ctx.fillStyle = '#c39bd3'; ctx.fillRect(px - 2, y - 8, 4, 4);
    }
  }

  private bars(m: Match, u: Unit) {
    if (u.kind === 'minion' && u.hp >= u.maxHp) return;
    const ctx = this.ctx, z = this.cam.z;
    const { img, k } = this.spriteOf(m, u);
    const at = this.pos(u);
    const x = this.sx(at.x), top = this.sy(at.y) - img.height * k * z - 6;
    const w = u.kind === 'hero' ? 44 : u.kind === 'minion' ? 18 : u.kind === 'summon' ? 22 : 56;
    if (x < -60 || x > VIEW_W + 60 || top < -40 || top > VIEW_H + 40) return;
    ctx.fillStyle = '#111'; ctx.fillRect(x - w / 2 - 1, top - 1, w + 2, 7);
    ctx.fillStyle = u.team < 2 ? TEAM_COLOR[u.team] : '#e0e0e0';
    ctx.fillRect(x - w / 2, top, (w * Math.max(0, u.hp)) / u.maxHp, 5);
    const shield = u.shields.reduce((s, x) => s + x.amt, 0);
    if (shield > 0) { ctx.fillStyle = '#e8f7ff'; ctx.fillRect(x - w / 2, top, Math.min(w, (w * shield) / u.maxHp), 2); }
    if (u.kind === 'hero') {
      ctx.fillStyle = '#111'; ctx.fillRect(x - w / 2 - 15, top - 3, 14, 11);
      ctx.fillStyle = '#ffd166'; ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center';
      ctx.fillText(String(u.level), x - w / 2 - 8, top + 6);
      if (z > 1.4) {
        ctx.font = '12px "Microsoft JhengHei", sans-serif';
        const label = `${u.player!.name}・${HEROES[u.heroId].name}`;
        ctx.fillStyle = '#111'; ctx.fillText(label, x + 1, top - 5);
        ctx.fillStyle = '#fff'; ctx.fillText(label, x, top - 6);
      }
    }
  }

  private drawFx(f: Fx, age: number) {
    const ctx = this.ctx;
    const e = f.ev;
    const k = age / LIFE[e.type];
    ctx.globalAlpha = Math.max(0, 1 - k);
    switch (e.type) {
      case 'proj': {
        for (let i = 0; i < 3; i++) { // 飛行物加拖尾
          const q = Math.max(0, Math.min(1, k * 1.5) - i * 0.08);
          const x = Math.round((e.x + (e.x2 - e.x) * q) * S), y = Math.round((e.y + (e.y2 - e.y) * q) * S - 16);
          const r = 4 - i;
          ctx.fillStyle = e.color; ctx.fillRect(x - r, y - r, r * 2, r * 2);
          if (!i) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 1, y - 1, 2, 2); }
        }
        break;
      }
      case 'aoe': {
        ctx.strokeStyle = e.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(e.x * S, e.y * S, e.r * S * (0.5 + 0.5 * k), e.r * S * 0.55 * (0.5 + 0.5 * k), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = e.color; ctx.globalAlpha *= 0.2; ctx.fill();
        break;
      }
      case 'text': {
        ctx.font = 'bold 13px "Microsoft JhengHei", sans-serif'; ctx.textAlign = 'center';
        const x = this.sx(e.x), y = this.sy(e.y) - 20 - k * 20;
        ctx.fillStyle = '#111'; ctx.fillText(e.text, x + 1, y + 1);
        ctx.fillStyle = e.color; ctx.fillText(e.text, x, y);
        break;
      }
      case 'death':
        ctx.fillStyle = '#e8e8e8';
        for (let i = 0; i < 6; i++) ctx.fillRect(e.x * S + Math.cos(i) * k * 24 - 2, e.y * S - 6 + Math.sin(i) * k * 14 - 2, 4, 4);
        break;
    }
    ctx.globalAlpha = 1;
  }

  private drawMinimap(m: Match) {
    const c = this.mini;
    c.drawImage(this.miniBg, 0, 0);
    for (const u of m.units) {
      if (!u.alive && u.kind !== 'tower' && u.kind !== 'nexus') continue;
      c.fillStyle = !u.alive ? '#444' : u.team < 2 ? TEAM_COLOR[u.team] : '#ddd';
      const r = u.kind === 'hero' ? 5 : u.kind === 'minion' || u.kind === 'summon' ? 2 : u.kind === 'camp' ? 3 : 5;
      if (u.kind === 'hero') { c.fillStyle = '#fff'; c.fillRect(u.x - 3.5, u.y - 3.5, 7, 7); c.fillStyle = TEAM_COLOR[u.team]; }
      c.fillRect(u.x - r / 2, u.y - r / 2, r, r);
    }
    const z = this.cam.z;
    c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.strokeRect((this.cam.x - VIEW_W / 2 / z) / S, (this.cam.y - VIEW_H / 2 / z) / S, VIEW_W / z / S, VIEW_H / z / S);
  }
}
