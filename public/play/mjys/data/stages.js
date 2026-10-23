// 章節與關卡：關號是全局的（第 1 章＝1~15、第 2 章＝16~30…），畫面上顯示「第 章-第 關」
import { CFG } from '../cfg.js';

export const PER_CHAPTER = 15;
// mobs：小兵（第一種是主力，其他每 every 隻出現一次）、elite：精英、boss：首領；from＝這章第幾關開始出現
export const CHAPTERS = [
  {
    id: 1, name: '边境告急',
    mobs: [{ type: 'goblin', from: 1 }, { type: 'goblin_archer', from: 3, every: 4 }],
    elite: 'goblin_elite', boss: 'boss_goblinking',
    frags: [null, 'crossbow', 'cannon', 'ice', 'lightning', 'flame', 'alchemy', 'flame', 'cannon', 'holy', 'ice', 'lightning', 'sword', 'alchemy', 'holy', 'dragon'],
    unlocks: { 3: ['lightning'], 5: ['flame'], 8: ['holy'], 12: ['sword'], 15: ['dragon'] },
    chests: [{ gems: 20 }, { coins: 3000 }, { randomParts: 15 }, { gems: 30 }, { chests: { normal: 1 } }],
  },
  {
    id: 2, name: '迷雾沼泽',
    mobs: [{ type: 'mushroom', from: 1 }, { type: 'bat', from: 2, every: 3 }, { type: 'treant', from: 5, every: 7 }],
    elite: 'treant_elite', boss: 'boss_witch',
    frags: [null, 'poison', 'sword', 'flame', 'alchemy', 'time', 'holy', 'time', 'poison', 'dragon', 'shadow', 'shadow', 'holy', 'sword', 'time', 'dragon'],
    unlocks: { 5: ['time'], 10: ['shadow'] },
    chests: [{ gems: 30 }, { randomParts: 25 }, { gems: 50, chests: { normal: 1 } }],
  },
  {
    id: 3, name: '骸骨海湾',
    mobs: [{ type: 'skeleton', from: 1 }, { type: 'skeleton_pirate', from: 2, every: 4 }, { type: 'mummy', from: 5, every: 6 }],
    elite: 'mummy_elite', boss: 'boss_pirate',
    frags: [null, 'crossbow', 'flame', 'lightning', 'holy', 'shadow', 'alchemy', 'dragon', 'poison', 'sword', 'cannon', 'time', 'holy', 'dragon', 'shadow', 'dragon'],
    unlocks: {},
    chests: [{ gems: 50, randomParts: 20 }],
  },
  {
    id: 4, name: '冰封山脉',
    mobs: [{ type: 'icewolf', from: 1 }, { type: 'yeti', from: 3, every: 5 }],
    elite: 'yeti_elite', boss: 'boss_frostgiant',
    frags: [null, 'ice', 'lightning', 'flame', 'dragon', 'holy', 'sword', 'poison', 'time', 'dragon', 'shadow', 'lightning', 'cannon', 'holy', 'time', 'dragon'],
    unlocks: {},
    chests: [{ gems: 50, parts: { universal: 5 } }, { gems: 80, chests: { rare: 1 } }],
  },
  {
    id: 5, name: '熔岩深渊',
    mobs: [{ type: 'lavaimp', from: 1 }, { type: 'skeleton', from: 2, every: 4 }, { type: 'mummy', from: 6, every: 7 }],
    elite: 'lavagolem', boss: 'boss_lavademon',
    frags: [null, 'lightning', 'ice', 'sword', 'holy', 'crossbow', 'dragon', 'time', 'lightning', 'shadow', 'poison', 'dragon', 'holy', 'sword', 'alchemy', 'dragon'],
    unlocks: {},
    chests: [],
  },
  {
    id: 6, name: '暗影城堡',
    mobs: [{ type: 'skeleton', from: 1 }, { type: 'icewolf', from: 1, every: 3 }, { type: 'lavaimp', from: 3, every: 4 }, { type: 'mummy', from: 6, every: 7 }],
    elite: 'yeti_elite', boss: 'boss_shadowking',
    extra: ['mummy_elite', 'lavagolem', 'treant_elite'], // 骨王召喚用，要先載圖
    frags: [null, 'dragon', 'holy', 'shadow', 'ice', 'time', 'sword', 'flame', 'alchemy', 'dragon', 'holy', 'shadow', 'ice', 'time', 'sword', 'dragon'],
    unlocks: {},
    chests: [{ gems: 100, chests: { rare: 1 } }],
  },
];
export const CHAPTER_COUNT = CHAPTERS.length;
export const STAGE_COUNT = CHAPTER_COUNT * PER_CHAPTER; // 目前開放的總關數

export const chapterOf = n => Math.ceil(n / PER_CHAPTER);
export const localOf = n => n - (chapterOf(n) - 1) * PER_CHAPTER; // 這章的第幾關（1~15）
export const chapterData = c => CHAPTERS[c - 1];

// 這座塔要打過第幾關才解鎖（起始就有的回傳 0）
export function unlockStageOf(id) {
  for (const ch of CHAPTERS) for (const [k, list] of Object.entries(ch.unlocks)) if (list.includes(id)) return (ch.id - 1) * PER_CHAPTER + Number(k);
  return 0;
}

// 選關面板要顯示的資訊
export function stageInfo(n) {
  const c = chapterOf(n), l = localOf(n), ch = chapterData(c);
  const enemies = ch.mobs.filter(m => l >= m.from).map(m => m.type);
  enemies.push(ch.elite);
  if (l === PER_CHAPTER) enemies.push(ch.boss);
  return {
    n, chapter: c, local: l, waves: 15, boss: l === PER_CHAPTER,
    recommend: CFG.recommend(n),
    enemies, fragTower: ch.frags[l], unlocks: ch.unlocks[l] || [],
  };
}

// 回傳 { n, chapter, waves: 15 波，每波是 [{ type, gap }]，hpMul }
export function buildStage(n) {
  const W = CFG.wave, waves = [];
  const c = chapterOf(n), l = localOf(n), ch = chapterData(c);
  const mobs = ch.mobs.filter(m => l >= m.from);
  const mobAt = i => {
    for (let k = mobs.length - 1; k >= 1; k--) if (i % mobs[k].every === mobs[k].every - 1) return mobs[k].type;
    return mobs[0].type;
  };
  for (let w = 1; w <= 15; w++) {
    const list = [];
    const small = k => { for (let i = 0; i < k; i++) list.push({ type: mobAt(i), gap: W.spacing }); };
    const count = 6 + w + Math.floor(l / 2);
    if (w === 15 && l === PER_CHAPTER) { // 章節最後一關最後一波：首領＋4 精英
      list.push({ type: ch.elite, gap: W.eliteGap }, { type: ch.elite, gap: W.bossGap });
      list.push({ type: ch.boss, gap: W.bossGap });
      list.push({ type: ch.elite, gap: W.eliteGap }, { type: ch.elite, gap: W.eliteGap });
    } else if (w === 15) { // 其他關最後一波：小怪＋2 精英
      small(count);
      list.push({ type: ch.elite, gap: W.eliteGap }, { type: ch.elite, gap: W.eliteGap });
    } else {
      small(count);
      if (l >= 5 && w % 5 === 0) list.push({ type: ch.elite, gap: W.eliteGap }); // 第 5 關起每 5 波 1 隻精英
    }
    waves.push(list);
  }
  return { n, chapter: c, waves, hpMul: CFG.stageHp(n), boss: ch.boss };
}
