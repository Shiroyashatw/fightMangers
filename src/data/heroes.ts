export type Role = 'tank' | 'fighter' | 'assassin' | 'mage' | 'marksman' | 'support';
export type Pos = 'top' | 'jng' | 'mid' | 'adc' | 'sup';
export type SummonKind = 'wolf' | 'clone' | 'turret' | 'totem';
export type BuffStat = 'atk' | 'as' | 'spd';

export type Effect =
  | { k: 'dmg'; amt: number; execute?: boolean }
  | { k: 'dash'; dist: number }
  | { k: 'stun'; dur: number }
  | { k: 'slow'; pct: number; dur: number }
  | { k: 'heal'; amt: number }
  | { k: 'shield'; amt: number; dur: number }
  | { k: 'buff'; stat: BuffStat; pct: number; dur: number }
  | { k: 'summon'; unit: SummonKind; n: number; dur: number }
  | { k: 'dot'; dps: number; dur: number };

// enemy: one enemy in range (area = splash around it); around: enemies within area of caster;
// ally: lowest-hp ally hero in range; allies: all ally heroes within area; self: caster only.
export type Target = 'enemy' | 'around' | 'ally' | 'allies' | 'self';

export interface Skill {
  name: string;
  cd: number;
  range: number;
  target: Target;
  area?: number;
  delay?: number;
  effects: Effect[];
}

export interface Hero {
  id: number;
  name: string;
  role: Role;
  pos: Pos;
  color: string;
  skills: [Skill, Skill, Skill];
}

export const ROLE_NAMES: Record<Role, string> = {
  tank: '坦克', fighter: '戰士', assassin: '刺客', mage: '法師', marksman: '射手', support: '輔助',
};
export const POS_NAMES: Record<Pos, string> = {
  top: '上路', jng: '打野', mid: '中路', adc: '下路', sup: '輔助',
};
export const POSITIONS: Pos[] = ['top', 'jng', 'mid', 'adc', 'sup'];

export const ROLE_STATS: Record<Role, { hp: number; atk: number; range: number; atkCd: number; spd: number }> = {
  tank:     { hp: 900, atk: 42, range: 12, atkCd: 1.0, spd: 22 },
  fighter:  { hp: 760, atk: 58, range: 12, atkCd: 0.9, spd: 23 },
  assassin: { hp: 620, atk: 66, range: 12, atkCd: 0.8, spd: 26 },
  mage:     { hp: 540, atk: 44, range: 45, atkCd: 1.1, spd: 21 },
  marksman: { hp: 540, atk: 58, range: 50, atkCd: 0.8, spd: 21 },
  support:  { hp: 620, atk: 34, range: 40, atkCd: 1.1, spd: 22 },
};

const H = (id: number, name: string, role: Role, pos: Pos, color: string, skills: [Skill, Skill, Skill]): Hero =>
  ({ id, name, role, pos, color, skills });

export const HEROES: Hero[] = [
  // 上路
  H(0, '鐵壁', 'tank', 'top', '#9aa4b1', [
    { name: '盾擊', cd: 8, range: 15, target: 'enemy', effects: [{ k: 'dmg', amt: 70 }, { k: 'stun', dur: 1 }] },
    { name: '堅守', cd: 12, range: 0, target: 'self', effects: [{ k: 'shield', amt: 200, dur: 4 }] },
    { name: '地裂', cd: 40, range: 20, target: 'around', area: 30, effects: [{ k: 'dmg', amt: 150 }, { k: 'stun', dur: 1.5 }] },
  ]),
  H(1, '狂戰', 'fighter', 'top', '#c0392b', [
    { name: '旋斬', cd: 6, range: 15, target: 'around', area: 18, effects: [{ k: 'dmg', amt: 90 }] },
    { name: '嗜血', cd: 12, range: 0, target: 'self', effects: [{ k: 'heal', amt: 120 }, { k: 'buff', stat: 'as', pct: 0.4, dur: 4 }] },
    { name: '狂暴', cd: 40, range: 0, target: 'self', effects: [{ k: 'buff', stat: 'atk', pct: 0.8, dur: 6 }] },
  ]),
  H(2, '劍聖', 'fighter', 'top', '#e5c07b', [
    { name: '突刺', cd: 7, range: 40, target: 'enemy', effects: [{ k: 'dash', dist: 40 }, { k: 'dmg', amt: 90 }] },
    { name: '破甲', cd: 9, range: 15, target: 'enemy', effects: [{ k: 'dmg', amt: 80 }, { k: 'slow', pct: 0.4, dur: 2 }] },
    { name: '千刃', cd: 40, range: 15, target: 'around', area: 22, effects: [{ k: 'dot', dps: 70, dur: 3 }] },
  ]),
  H(3, '石像', 'tank', 'top', '#7f8c6d', [
    { name: '衝撞', cd: 10, range: 40, target: 'enemy', effects: [{ k: 'dash', dist: 40 }, { k: 'dmg', amt: 60 }, { k: 'stun', dur: 1 }] },
    { name: '岩膚', cd: 12, range: 0, target: 'self', effects: [{ k: 'shield', amt: 220, dur: 4 }] },
    { name: '隕石', cd: 45, range: 50, target: 'enemy', area: 35, effects: [{ k: 'dmg', amt: 170 }, { k: 'slow', pct: 0.5, dur: 2.5 }] },
  ]),
  // 打野
  H(4, '影刃', 'assassin', 'jng', '#5b4b8a', [
    { name: '瞬步', cd: 7, range: 45, target: 'enemy', effects: [{ k: 'dash', dist: 45 }, { k: 'dmg', amt: 100 }] },
    { name: '毒刃', cd: 8, range: 15, target: 'enemy', effects: [{ k: 'dot', dps: 30, dur: 4 }] },
    { name: '處決', cd: 35, range: 20, target: 'enemy', effects: [{ k: 'dmg', amt: 180, execute: true }] },
  ]),
  H(5, '獵狼', 'fighter', 'jng', '#8e6e53', [
    { name: '撲擊', cd: 7, range: 40, target: 'enemy', effects: [{ k: 'dash', dist: 40 }, { k: 'dmg', amt: 70 }, { k: 'slow', pct: 0.4, dur: 2 }] },
    { name: '狼群', cd: 20, range: 0, target: 'self', effects: [{ k: 'summon', unit: 'wolf', n: 2, dur: 12 }] },
    { name: '嚎叫', cd: 40, range: 0, target: 'allies', area: 80, effects: [{ k: 'buff', stat: 'as', pct: 0.5, dur: 6 }] },
  ]),
  H(6, '夜鴉', 'assassin', 'jng', '#2c2c3a', [
    { name: '鴉群', cd: 7, range: 35, target: 'enemy', area: 20, effects: [{ k: 'dmg', amt: 80 }] },
    { name: '隱匿', cd: 12, range: 0, target: 'self', effects: [{ k: 'buff', stat: 'spd', pct: 0.6, dur: 3 }] },
    { name: '啄食', cd: 35, range: 20, target: 'enemy', effects: [{ k: 'dot', dps: 80, dur: 3 }] },
  ]),
  H(7, '巨熊', 'tank', 'jng', '#6e4b2a', [
    { name: '熊掌', cd: 7, range: 15, target: 'around', area: 20, effects: [{ k: 'dmg', amt: 70 }, { k: 'slow', pct: 0.35, dur: 2 }] },
    { name: '冬眠', cd: 15, range: 0, target: 'self', effects: [{ k: 'heal', amt: 180 }] },
    { name: '怒吼', cd: 40, range: 15, target: 'around', area: 28, effects: [{ k: 'stun', dur: 1.5 }] },
  ]),
  // 中路
  H(8, '炎術士', 'mage', 'mid', '#e67e22', [
    { name: '火球', cd: 5, range: 50, target: 'enemy', effects: [{ k: 'dmg', amt: 100 }] },
    { name: '烈焰之地', cd: 10, range: 50, target: 'enemy', area: 20, effects: [{ k: 'dot', dps: 35, dur: 3 }] },
    { name: '流星雨', cd: 40, range: 55, target: 'enemy', area: 35, effects: [{ k: 'dmg', amt: 220 }] },
  ]),
  H(9, '冰后', 'mage', 'mid', '#7fc8f8', [
    { name: '冰錐', cd: 6, range: 50, target: 'enemy', effects: [{ k: 'dmg', amt: 85 }, { k: 'slow', pct: 0.4, dur: 2 }] },
    { name: '冰甲', cd: 14, range: 0, target: 'self', effects: [{ k: 'shield', amt: 160, dur: 4 }] },
    { name: '暴風雪', cd: 45, range: 55, target: 'enemy', area: 32, effects: [{ k: 'dmg', amt: 150 }, { k: 'stun', dur: 1.2 }] },
  ]),
  H(10, '雷鳴', 'mage', 'mid', '#f1c40f', [
    { name: '連鎖閃電', cd: 6, range: 50, target: 'enemy', area: 25, effects: [{ k: 'dmg', amt: 80 }] },
    { name: '閃現', cd: 14, range: 0, target: 'self', effects: [{ k: 'dash', dist: 40 }] },
    { name: '雷霆', cd: 35, range: 55, target: 'enemy', effects: [{ k: 'dmg', amt: 230 }, { k: 'stun', dur: 1 }] },
  ]),
  H(11, '幻術師', 'assassin', 'mid', '#c56cf0', [
    { name: '幻影', cd: 16, range: 0, target: 'self', effects: [{ k: 'summon', unit: 'clone', n: 1, dur: 8 }] },
    { name: '心靈衝擊', cd: 7, range: 45, target: 'enemy', effects: [{ k: 'dmg', amt: 90 }, { k: 'slow', pct: 0.4, dur: 2 }] },
    { name: '鏡像突襲', cd: 40, range: 45, target: 'enemy', area: 25, effects: [{ k: 'dash', dist: 45 }, { k: 'dmg', amt: 170 }] },
  ]),
  // 下路射手
  H(12, '神射手', 'marksman', 'adc', '#27ae60', [
    { name: '穿透箭', cd: 7, range: 60, target: 'enemy', area: 15, effects: [{ k: 'dmg', amt: 90 }] },
    { name: '疾風步', cd: 12, range: 0, target: 'self', effects: [{ k: 'dash', dist: 35 }] },
    { name: '狙擊', cd: 40, range: 90, target: 'enemy', effects: [{ k: 'dmg', amt: 260 }] },
  ]),
  H(13, '火槍', 'marksman', 'adc', '#a0522d', [
    { name: '散彈', cd: 7, range: 35, target: 'enemy', area: 18, effects: [{ k: 'dmg', amt: 90 }] },
    { name: '強化彈藥', cd: 14, range: 0, target: 'self', effects: [{ k: 'buff', stat: 'atk', pct: 0.5, dur: 4 }] },
    { name: '彈幕', cd: 40, range: 55, target: 'enemy', area: 30, effects: [{ k: 'dot', dps: 70, dur: 3 }] },
  ]),
  H(14, '弩手', 'marksman', 'adc', '#16a085', [
    { name: '淬毒箭', cd: 6, range: 55, target: 'enemy', effects: [{ k: 'dot', dps: 30, dur: 4 }] },
    { name: '捕獸夾', cd: 14, range: 45, target: 'enemy', area: 15, delay: 1, effects: [{ k: 'stun', dur: 1.5 }] },
    { name: '箭雨', cd: 40, range: 60, target: 'enemy', area: 32, effects: [{ k: 'dmg', amt: 160 }, { k: 'slow', pct: 0.5, dur: 2 }] },
  ]),
  H(15, '機械師', 'marksman', 'adc', '#95a5a6', [
    { name: '砲台', cd: 18, range: 0, target: 'self', effects: [{ k: 'summon', unit: 'turret', n: 1, dur: 12 }] },
    { name: '電網', cd: 10, range: 50, target: 'enemy', area: 20, effects: [{ k: 'slow', pct: 0.5, dur: 2 }] },
    { name: '機甲', cd: 40, range: 0, target: 'self', effects: [{ k: 'shield', amt: 250, dur: 6 }, { k: 'buff', stat: 'atk', pct: 0.5, dur: 6 }] },
  ]),
  // 輔助
  H(16, '聖女', 'support', 'sup', '#fdf6c3', [
    { name: '治癒', cd: 8, range: 50, target: 'ally', effects: [{ k: 'heal', amt: 130 }] },
    { name: '祝福', cd: 12, range: 50, target: 'ally', effects: [{ k: 'buff', stat: 'atk', pct: 0.4, dur: 5 }] },
    { name: '聖域', cd: 40, range: 0, target: 'allies', area: 50, effects: [{ k: 'heal', amt: 220 }] },
  ]),
  H(17, '守護者', 'tank', 'sup', '#2e86de', [
    { name: '盾牌衝鋒', cd: 10, range: 40, target: 'enemy', effects: [{ k: 'dash', dist: 40 }, { k: 'stun', dur: 1 }] },
    { name: '守護', cd: 10, range: 50, target: 'ally', effects: [{ k: 'shield', amt: 160, dur: 4 }] },
    { name: '堡壘', cd: 45, range: 0, target: 'allies', area: 80, effects: [{ k: 'shield', amt: 200, dur: 5 }] },
  ]),
  H(18, '吟遊詩人', 'support', 'sup', '#ff9ff3', [
    { name: '戰歌', cd: 12, range: 0, target: 'allies', area: 50, effects: [{ k: 'buff', stat: 'as', pct: 0.35, dur: 5 }] },
    { name: '不和諧音', cd: 9, range: 45, target: 'enemy', area: 22, effects: [{ k: 'slow', pct: 0.45, dur: 2 }] },
    { name: '安眠曲', cd: 45, range: 50, target: 'enemy', area: 30, effects: [{ k: 'stun', dur: 1.8 }] },
  ]),
  H(19, '巫醫', 'support', 'sup', '#6ab04c', [
    { name: '詛咒', cd: 8, range: 50, target: 'enemy', effects: [{ k: 'dot', dps: 25, dur: 4 }, { k: 'slow', pct: 0.3, dur: 2 }] },
    { name: '圖騰', cd: 18, range: 0, target: 'self', effects: [{ k: 'summon', unit: 'totem', n: 1, dur: 10 }] },
    { name: '復甦', cd: 40, range: 0, target: 'allies', area: 60, effects: [{ k: 'heal', amt: 280 }] },
  ]),
];
