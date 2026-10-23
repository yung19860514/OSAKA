// 活動關卡：零件工坊（10 波）、無盡深淵（無限波）
import { CFG } from '../cfg.js';
import { buildStage } from './stages.js';

// 零件工坊：借主線第 eq 關的前 9 波，第 10 波＝那關的最後一波（精英）
export function buildWorkshop(level) {
  const L = CFG.events.workshop.levels[level];
  const base = buildStage(L.eq);
  const n = CFG.events.workshop.waves;
  return { n: L.eq, chapter: 1, mode: 'workshop', level, waves: [...base.waves.slice(0, n - 1), base.waves[base.waves.length - 1]], hpMul: base.hpMul };
}

// 無盡深淵：第 w 波 7+w 隻（上限 30），每 4 隻 1 弓手、每 5 波加精英、每 10 波來一隻哥布林王；血量每波 ×growth
export function buildEndless() {
  const E = CFG.events.endless, W = CFG.wave;
  const base = CFG.stageHp(E.eq);
  return {
    n: E.eq, chapter: 1, mode: 'endless', endless: true, hpMul: base,
    hpAt: w => base * Math.pow(E.growth, w - 1),
    waveAt(w) {
      const list = [];
      const count = Math.min(30, 7 + w);
      for (let i = 0; i < count; i++) list.push({ type: i % 4 === 3 ? 'goblin_archer' : 'goblin', gap: W.spacing });
      for (let i = 0; i < Math.floor(w / 5); i++) list.push({ type: 'goblin_elite', gap: W.eliteGap });
      if (w % 10 === 0) list.push({ type: 'boss_goblinking', gap: W.bossGap });
      return list;
    },
  };
}

export function eventStage(mode, level) {
  return mode === 'workshop' ? buildWorkshop(level) : mode === 'endless' ? buildEndless() : null;
}
