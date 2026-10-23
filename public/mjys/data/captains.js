// 隊長（docs/01 1.5）：被動＋主動技（擊殺累積能量，滿了按技能鈕）
// unlock：default 一開始就有｜stage 通關第 n 關｜gems 用钻石買｜soon 之後開放
// 隊長等級：每級全體塔攻擊 +2%，升級吃金币
export const CAPTAINS = {
  lia: {
    name: '莉亚', title: '小队长', unlock: { type: 'default' }, energy: 20,
    passive: '开局魔力 +20', skill: '鼓舞号令', skillDesc: '全体塔攻速 ×2，持续 8 秒',
  },
  borg: {
    name: '博格', title: '矮人工匠', unlock: { type: 'stage', n: 15 }, energy: 18,
    passive: '召唤费用 -10%', skill: '紧急改造', skillDesc: '随机一座塔立刻升 1 级',
  },
  karl: {
    name: '卡尔', title: '龙骑士', unlock: { type: 'gems', price: 680 }, energy: 30,
    passive: '火炮塔、龙巢攻击 +15%', skill: '火龙横扫', skillDesc: '所有敌人失去 30% 当前血量（首领 15%）',
  },
  elsa: {
    name: '艾莎', title: '冰霜法师', unlock: { type: 'stage', n: 60 }, energy: 20, // 第 4 章打完冰霜巨人加入
    passive: '冰霜塔减速 +10%', skill: '冰封大地', skillDesc: '冻结所有敌人 4 秒',
  },
};
export const CAPTAIN_LV = { max: 20, atkPerLv: 0.02, coins: lv => 300 * lv };
export const CAPTAIN_IDS = Object.keys(CAPTAINS);
