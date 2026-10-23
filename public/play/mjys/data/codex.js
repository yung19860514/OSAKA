// 圖鑑（docs/01 1.3、1.4）：遊戲裡已有的用 data/towers.js、data/enemies.js 的資料；之後才上線的先列名字
export const CODEX_TOWERS = [
  'crossbow', 'cannon', 'ice', 'poison', 'alchemy', 'lightning', 'holy', 'dragon', 'flame', 'sword', 'time', 'shadow',
];

// ch＝第幾章出現；boss＝首領
export const CODEX_ENEMIES = [
  { id: 'goblin', name: '哥布林', ch: 1, desc: '基本小兵，数量多' },
  { id: 'goblin_archer', name: '哥布林弓手', ch: 1, desc: '走到一半会停下来射城门' },
  { id: 'goblin_elite', name: '哥布林精英', ch: 1, art: 'goblin', desc: '又肥又硬，漏掉会扣 3 点城门' },
  { id: 'boss_goblinking', name: '哥布林王', ch: 1, boss: true, desc: '骑着巨狼，每 6 秒冲锋一次' },
  { id: 'mushroom', name: '蘑菇怪', ch: 2, desc: '死后放出毒雾，让塔变慢' },
  { id: 'bat', name: '蝙蝠', ch: 2, desc: '飞得很快，但很脆' },
  { id: 'treant', name: '树人', ch: 2, desc: '很肉很慢' },
  { id: 'boss_witch', name: '沼泽女巫', ch: 2, boss: true, desc: '会召唤蘑菇，还能把塔变成青蛙' },
  { id: 'skeleton', name: '骷髅兵', ch: 3, desc: '死后有机会复活一次' },
  { id: 'skeleton_pirate', name: '骷髅海盗', ch: 3, desc: '举着盾牌，正面很耐打' },
  { id: 'mummy', name: '木乃伊', ch: 3, desc: '不怕中毒' },
  { id: 'boss_pirate', name: '海盗船长', ch: 3, boss: true, desc: '炮击随机格子，让塔晕眩' },
  { id: 'yeti', name: '雪怪', ch: 4, desc: '不怕冰冻，撞到会让塔晕眩' },
  { id: 'icewolf', name: '冰狼', ch: 4, desc: '成群结队，速度很快' },
  { id: 'boss_frostgiant', name: '冰霜巨人', ch: 4, boss: true, desc: '冻结全场 2 秒' },
  { id: 'lavaimp', name: '熔岩小鬼', ch: 5, desc: '不怕火，死后会爆炸' },
  { id: 'lavagolem', name: '熔岩石魔', ch: 5, desc: '超级肉，边走边召唤小鬼' },
  { id: 'boss_lavademon', name: '熔岩恶魔', ch: 5, boss: true, desc: '烧掉一格，10 秒不能放塔' },
  { id: 'boss_shadowking', name: '暗影骨王 莫克', ch: 6, boss: true, desc: '最终首领，会召唤所有首领的影子' },
];
