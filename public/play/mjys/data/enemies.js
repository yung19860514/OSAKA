// 敵人（docs/01 1.4；第 1 章血量 ×1.3、擊殺魔力調高，配合較便宜的召喚，見 tools/sim.mjs）
// speed＝像素/秒，leak＝漏到城門扣幾點，mana＝擊殺給的魔力，r＝顯示半徑
// 特性：archer 停下射城門｜charge 衝刺｜sporeCloud 死後毒霧（附近的塔攻速變慢）｜flying 飛行
//       slowResist 減速只吃一半｜slowImmune 不吃減速｜poisonImmune 不中毒｜revive 死後機率復活（半血）
//       shield 單體、閃電傷害減少｜fireResist 爆炸（火炮、龍）傷害減半｜deathBlast 死後爆炸讓附近的塔暈眩
//       summon 每幾秒召喚小怪｜首領技能：witch 召蘑菇＋變青蛙｜cannon 炮擊格子暈塔｜freeze 冰凍全部塔｜burn 燒掉格子｜phases 分階段召喚
export const ENEMIES = {
  // ───── 第 1 章：邊境告急 ─────
  goblin:          { name: '哥布林', hp: 80, speed: 90, leak: 1, mana: 8, r: 30, color: 0x74c043 },
  goblin_archer:   { name: '哥布林弓手', hp: 60, speed: 100, leak: 1, mana: 8, r: 28, color: 0x9ab83a, archer: { at: 0.6, wait: 3, dmg: 1 } },
  goblin_elite:    { name: '哥布林精英', hp: 400, speed: 70, leak: 3, mana: 25, r: 42, color: 0x3f8a2a, elite: true },
  boss_goblinking: { name: '哥布林王', hp: 3300, speed: 60, leak: 10, mana: 80, r: 66, color: 0x2f7a24, boss: true, charge: { every: 6, dur: 1, mul: 3 } },
  // ───── 第 2 章：迷霧沼澤 ─────
  mushroom:        { name: '蘑菇怪', hp: 85, speed: 85, leak: 1, mana: 8, r: 30, color: 0xd04a4a, sporeCloud: { r: 150, dur: 3, mul: 0.5 } },
  bat:             { name: '蝙蝠', hp: 45, speed: 150, leak: 1, mana: 8, r: 26, color: 0x7a4ac0, flying: true },
  treant:          { name: '树人', hp: 260, speed: 55, leak: 2, mana: 16, r: 38, color: 0x5a7a2a, slowResist: true },
  treant_elite:    { name: '古树精英', hp: 480, speed: 55, leak: 3, mana: 25, r: 44, color: 0x3a5a1a, elite: true, slowResist: true },
  // ───── 第 3 章：骸骨海灣 ─────
  skeleton:        { name: '骷髅兵', hp: 80, speed: 90, leak: 1, mana: 8, r: 30, color: 0xd8d0b8, revive: { chance: 0.25 } },
  skeleton_pirate: { name: '骷髅海盗', hp: 150, speed: 75, leak: 1, mana: 10, r: 32, color: 0xb8a888, shield: 0.4 },
  mummy:           { name: '木乃伊', hp: 170, speed: 70, leak: 2, mana: 12, r: 32, color: 0xd8c898, poisonImmune: true },
  mummy_elite:     { name: '法老木乃伊', hp: 520, speed: 62, leak: 3, mana: 25, r: 44, color: 0xffd34a, elite: true, poisonImmune: true },
  boss_pirate:     { name: '海盗船长', hp: 5000, speed: 52, leak: 10, mana: 90, r: 64, color: 0x8a2a2a, boss: true, cannon: { every: 8, cells: 2, dur: 3 } },
  // ───── 第 4 章：冰封山脈 ─────
  icewolf:         { name: '冰狼', hp: 70, speed: 120, leak: 1, mana: 8, r: 30, color: 0x9fd8ff, slowResist: true },
  yeti:            { name: '雪怪', hp: 300, speed: 60, leak: 2, mana: 16, r: 40, color: 0xe8f4ff, slowImmune: true },
  yeti_elite:      { name: '雪怪王', hp: 560, speed: 58, leak: 3, mana: 25, r: 46, color: 0xc0e0ff, elite: true, slowImmune: true },
  boss_frostgiant: { name: '冰霜巨人', hp: 6200, speed: 48, leak: 10, mana: 100, r: 70, color: 0x6ab0e8, boss: true, slowImmune: true, freeze: { every: 10, dur: 2 } },
  // ───── 第 5 章：熔岩深淵 ─────
  lavaimp:         { name: '熔岩小鬼', hp: 95, speed: 100, leak: 1, mana: 8, r: 28, color: 0xff6a2a, fireResist: true, deathBlast: { r: 120, dur: 1 } },
  lavagolem:       { name: '熔岩石魔', hp: 700, speed: 50, leak: 3, mana: 30, r: 48, color: 0x5a2a1a, elite: true, fireResist: true, summon: { every: 5, type: 'lavaimp' } },
  boss_lavademon:  { name: '熔岩恶魔', hp: 7200, speed: 48, leak: 10, mana: 110, r: 70, color: 0xc0281a, boss: true, fireResist: true, burn: { every: 9, dur: 8 } },
  // ───── 第 6 章：暗影城堡 ─────
  boss_shadowking: { name: '暗影骨王 莫克', hp: 9500, speed: 45, leak: 20, mana: 150, r: 74, color: 0x4a2a6a, boss: true,
    phases: { at: [0.66, 0.33], summon: ['mummy_elite', 'yeti_elite', 'lavagolem', 'treant_elite'], count: 3, freeze: 1.5 } },
  boss_witch:      { name: '沼泽女巫', hp: 4200, speed: 50, leak: 10, mana: 90, r: 64, color: 0x6a3a8a, boss: true, witch: { summonEvery: 7, summon: 3, frogEvery: 9, frogDur: 3 } },
};
