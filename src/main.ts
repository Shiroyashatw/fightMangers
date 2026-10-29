import { HEROES, POS_NAMES, ROLE_NAMES } from './data/heroes';
import { makeTeams, type Team } from './data/teams';
import { aiChoose, apply, bestAssignment, isTaken, newDraft, ORDER, type Draft } from './draft';
import { Renderer } from './render/renderer';
import { heroSprite } from './render/sprites';
import { DT, Match, type Pick } from './sim/match';

const app = document.getElementById('app')!;
const teams = makeTeams();
const MINE = teams[0]; // 你帶領的隊伍
let sides: [Team, Team];
let mySide = 0;

const sideLabel = (i: number) => `<span class="${i ? 'red' : 'blue'}">${i ? '紅方' : '藍方'} ${sides[i].name}</span>`;
const $ = <T extends HTMLElement>(sel: string) => app.querySelector(sel) as T;
const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function paintSprites(team: number) {
  app.querySelectorAll<HTMLCanvasElement>('canvas[data-hero]').forEach((cv) => {
    const img = heroSprite(Number(cv.dataset.hero), team);
    cv.width = img.width; cv.height = img.height;
    cv.getContext('2d')!.drawImage(img, 0, 0);
  });
}

function title() {
  app.innerHTML = `<div class="title">
    <h1>團戰教練</h1><p class="dim">5V5 電競教練模擬</p>
    <p>你的隊伍：<b>${MINE.name}</b>　對手：<b>${teams[1].name}</b></p>
    <button class="primary" id="go">開始比賽</button></div>`;
  $('#go').onclick = () => {
    mySide = Math.random() < 0.5 ? 0 : 1;
    sides = mySide === 0 ? [teams[0], teams[1]] : [teams[1], teams[0]];
    draftScreen(newDraft());
  };
}

function rosterTable(team: Team, hover: number) {
  const top = (prof: number[]) => prof.map((v, id) => ({ v, id })).sort((a, b) => b.v - a.v).slice(0, 2)
    .map((x) => HEROES[x.id].name).join('、');
  return `<table><tr><th>位置</th><th>選手</th><th>操作</th><th>意識</th><th>招牌英雄</th>
    <th>${hover >= 0 ? HEROES[hover].name + ' 熟練度' : '熟練度（滑過英雄）'}</th></tr>
    ${team.players.map((p) => `<tr><td>${POS_NAMES[p.pos]}</td><td>${p.name}</td><td>${p.micro}</td><td>${p.macro}</td>
      <td class="dim">${top(p.prof)}</td><td class="${hover >= 0 && p.prof[hover] >= 80 ? 'hi' : ''}">${hover >= 0 ? p.prof[hover] : ''}</td></tr>`).join('')}
  </table>`;
}

function draftScreen(d: Draft) {
  let hover = -1;
  const rosters = () => {
    $('#rosters').innerHTML = [mySide, 1 - mySide].map((s) =>
      `<div class="panel side"><h3>${sideLabel(s)}${s === mySide ? '（你）' : ''}</h3>${rosterTable(sides[s], hover)}</div>`).join('');
  };
  const render = () => {
    const s = ORDER[d.step];
    const myTurn = !!s && s.side === mySide;
    const slots = (ids: number[], cls: string) => ids.map((id) => `<span class="slot ${cls}">${HEROES[id].name}</span>`).join('');
    app.innerHTML = `
      <div class="turn">${s ? `${sideLabel(s.side)} ${s.kind === 'ban' ? '禁用' : '選擇'}英雄（${d.step + 1}/${ORDER.length}）${myTurn ? ' — 輪到你' : ' — 對手思考中…'}` : 'BP 完成'}</div>
      <div class="row">
        ${[0, 1].map((i) => `<div class="panel side"><h3>${sideLabel(i)}${i === mySide ? '（你）' : ''}</h3>
          <div>禁用：${slots(d.bans[i], 'ban')}</div><div>選擇：${slots(d.picks[i], '')}</div></div>`).join('')}
      </div>
      <div class="row" style="margin-top:12px">
        <div class="grid">${HEROES.map((h) => `<button class="card" data-id="${h.id}" ${!myTurn || isTaken(d, h.id) ? 'disabled' : ''}>
          <canvas data-hero="${h.id}"></canvas><span>${h.name}<small>${ROLE_NAMES[h.role]}・${POS_NAMES[h.pos]}</small></span></button>`).join('')}
        </div>
      </div>
      ${s ? '' : '<p><button class="primary" id="next">分配英雄給選手</button></p>'}
      <div class="row" id="rosters" style="margin-top:12px"></div>`;
    paintSprites(mySide);
    rosters();
    app.querySelectorAll<HTMLButtonElement>('.card').forEach((b) => {
      b.onmouseenter = () => { hover = Number(b.dataset.id); rosters(); };
      b.onclick = () => { apply(d, Number(b.dataset.id)); render(); };
    });
    if (!s) { $('#next').onclick = () => assignScreen(d); return; }
    if (!myTurn) setTimeout(() => { apply(d, aiChoose(d, sides)); render(); }, 600);
  };
  render();
}

function assignScreen(d: Draft) {
  const me = sides[mySide];
  const mine = d.picks[mySide];
  const who = bestAssignment(mine, me);
  const heroOf = me.players.map((_, p) => mine[who.indexOf(p)]);
  const render = () => {
    const ok = new Set(heroOf).size === 5;
    app.innerHTML = `<h2>分配英雄</h2><p class="dim">已依熟練度預先分配，可以自行調整。</p>
      <div class="panel"><table><tr><th>位置</th><th>選手</th><th>操作</th><th>意識</th><th>英雄</th><th>熟練度</th></tr>
      ${me.players.map((p, i) => `<tr><td>${POS_NAMES[p.pos]}</td><td>${p.name}</td><td>${p.micro}</td><td>${p.macro}</td>
        <td><select data-p="${i}">${mine.map((h) => `<option value="${h}" ${h === heroOf[i] ? 'selected' : ''}>${HEROES[h].name}（${ROLE_NAMES[HEROES[h].role]}）</option>`).join('')}</select></td>
        <td class="${p.prof[heroOf[i]] >= 80 ? 'hi' : ''}">${p.prof[heroOf[i]]}</td></tr>`).join('')}
      </table></div>
      <p>${ok ? '' : '<span class="red">每隻英雄只能分給一位選手。</span> '}<button class="primary" id="start" ${ok ? '' : 'disabled'}>開始比賽</button></p>`;
    app.querySelectorAll<HTMLSelectElement>('select').forEach((s) => {
      s.onchange = () => { heroOf[Number(s.dataset.p)] = Number(s.value); render(); };
    });
    $('#start').onclick = () => {
      const opp = 1 - mySide;
      const oppWho = bestAssignment(d.picks[opp], sides[opp]);
      const picks: Pick[][] = [];
      picks[mySide] = heroOf.map((hero, player) => ({ hero, player }));
      picks[opp] = d.picks[opp].map((hero, i) => ({ hero, player: oppWho[i] }));
      matchScreen(picks as [Pick[], Pick[]]);
    };
  };
  render();
}

function matchScreen(picks: [Pick[], Pick[]]) {
  const m = new Match(sides, picks, (Date.now() & 0x7fffffff) >>> 0);
  app.innerHTML = `<div class="match">
    <div class="scorebar"><span>${sideLabel(0)} <b id="k0">0</b></span><span id="clock"></span><span><b id="k1">0</b> ${sideLabel(1)}</span></div>
    <div class="stage"><div class="view"><canvas id="cv"></canvas><canvas id="mini" title="點小地圖可暫時移動鏡頭"></canvas></div><div class="panel feed" id="feed"></div></div>
    <div class="row">${[1, 2, 4].map((s) => `<button data-s="${s}" class="${s === 1 ? 'on' : ''}">${s}x</button>`).join('')}
      <button data-s="0">跳過到結果</button></div>
    <div class="row"><div class="panel side" id="t0"></div><div class="panel side" id="t1"></div></div></div>`;
  const r = new Renderer($('#cv'), $('#mini'));
  let speed = 1, acc = 0, last = performance.now(), hudT = 0, over = false;
  const finish = () => { if (!over) { over = true; results(m); } };
  app.querySelectorAll<HTMLButtonElement>('[data-s]').forEach((b) => {
    b.onclick = () => {
      speed = Number(b.dataset.s);
      if (!speed) { m.runToEnd(); return finish(); }
      app.querySelectorAll('[data-s]').forEach((x) => x.classList.toggle('on', x === b));
    };
  });
  const hud = () => {
    $('#k0').textContent = String(m.kills[0]);
    $('#k1').textContent = String(m.kills[1]);
    const buff = [0, 1].filter((i) => m.epicBuff[i] > m.t).map((i) => `<span class="${i ? 'red' : 'blue'}">巨龍強化</span>`).join(' ');
    $('#clock').innerHTML = `${fmtTime(m.t)}　<span class="dim">推塔 ${m.towersDown[0]} : ${m.towersDown[1]}</span> ${buff}`;
    $('#feed').innerHTML = m.feed.slice(-30).reverse()
      .map((f) => `<div><span class="dim">${fmtTime(f.t)}</span> <span class="${f.team ? 'red' : 'blue'}">${f.text}</span></div>`).join('');
    for (const team of [0, 1]) {
      $(`#t${team}`).innerHTML = `<table><tr><th>選手</th><th>英雄</th><th>等級</th><th>K/D/A</th><th>狀態</th></tr>
        ${m.heroes(team).map((h) => `<tr><td>${h.player!.name}</td><td>${HEROES[h.heroId].name}</td><td>${h.level}</td>
          <td>${h.k}/${h.d}/${h.a}</td><td>${h.alive ? `${Math.round((h.hp / h.maxHp) * 100)}%` : `<span class="dim">復活 ${Math.ceil(h.respawnT - m.t)}s</span>`}</td></tr>`).join('')}</table>`;
    }
  };
  const frame = (now: number) => {
    if (over) return;
    acc += Math.min(0.25, (now - last) / 1000) * speed;
    last = now;
    while (acc >= DT && m.winner < 0) { m.step(); r.collect(m); acc -= DT; }
    r.draw(m);
    if (now - hudT > 250) { hud(); hudT = now; }
    if (m.winner >= 0) { hud(); setTimeout(finish, 1500); return; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function results(m: Match) {
  const won = m.winner === mySide;
  app.innerHTML = `<div class="win ${won ? 'blue' : 'red'}">${won ? '勝利！' : '敗北'}　${sides[m.winner].name} 摧毀了主堡</div>
    <p style="text-align:center" class="dim">比賽時間 ${fmtTime(m.t)}　擊殺 ${m.kills[0]} : ${m.kills[1]}　推塔 ${m.towersDown[0]} : ${m.towersDown[1]}</p>
    ${[0, 1].map((team) => `<div class="panel" style="margin-bottom:12px"><h3>${sideLabel(team)}${team === mySide ? '（你）' : ''}</h3>
      <table><tr><th>選手</th><th>位置</th><th>英雄</th><th>等級</th><th>K</th><th>D</th><th>A</th><th>輸出傷害</th><th>承受傷害</th></tr>
      ${m.heroes(team).map((h) => `<tr><td>${h.player!.name}</td><td>${POS_NAMES[h.player!.pos]}</td><td>${HEROES[h.heroId].name}</td><td>${h.level}</td>
        <td>${h.k}</td><td>${h.d}</td><td>${h.a}</td><td>${Math.round(h.dmg)}</td><td>${Math.round(h.taken)}</td></tr>`).join('')}</table></div>`).join('')}
    <p style="text-align:center"><button class="primary" id="again">再來一場</button></p>`;
  $('#again').onclick = title;
}

title();
