// 首批 8 座塔（docs/05 3.3）。atk＝Lv1 攻擊，interval＝秒/發，range＝像素
// kind：single 單體｜splash 濺射｜slow 減速｜poison 中毒｜mana 產魔力｜chain 連鎖｜aura 光環｜dragon 小龍
//       cone 扇形噴火＋燒傷｜melee 近戰（射程短、傷害高、打不到飛的）｜stop 定時讓範圍內怪停住｜assassin 打血最少的、會暴擊
// 毒霧的每秒中毒傷害 dot 也跟攻擊一樣吃等級倍率（只乘 Lv 的話 Lv7 會太弱）
export const TOWERS = {
  crossbow:  { name: '弩箭塔', short: '弩', rarity: 0, kind: 'single', atk: 12, interval: 0.5, range: 320, shotSpeed: 1700, desc: '快速射击单个敌人', color: 0xb0743a },
  cannon:    { name: '火炮塔', short: '炮', rarity: 0, kind: 'splash', atk: 30, interval: 1.6, range: 300, shotSpeed: 950, splash: 90, desc: '炮弹落地爆炸，炸伤一片敌人', color: 0x56535e },
  ice:       { name: '冰霜塔', short: '冰', rarity: 0, kind: 'slow', atk: 8, interval: 0.8, range: 300, shotSpeed: 1300, slow: 0.3, slowDur: 2, desc: '冰冻敌人，移动速度减慢30%', color: 0x4fb8f0 },
  poison:    { name: '毒雾塔', short: '毒', rarity: 0, kind: 'poison', atk: 5, interval: 1.0, range: 280, shotSpeed: 1100, dot: 4, dotDur: 4, desc: '让敌人中毒，持续掉血', color: 0x5cc23c },
  alchemy:   { name: '炼金塔', short: '金', rarity: 1, kind: 'mana', atk: 0, interval: 5, range: 0, manaPerLv: 4, desc: '不攻击，每5秒产生魔力', color: 0xa65cf0 },
  lightning: { name: '雷电塔', short: '雷', rarity: 1, kind: 'chain', atk: 18, interval: 1.2, range: 340, chain: 3, chainMul: 0.7, chainRange: 230, desc: '闪电在敌人之间跳跃，最多打3个', color: 0x3f6fe8 },
  holy:      { name: '圣光塔', short: '圣', rarity: 2, kind: 'aura', atk: 0, interval: 0, range: 0, auraPerLv: 0.15, desc: '让周围8格的塔攻击提升', color: 0xf2d27a },
  flame:     { name: '火焰塔', short: '火', rarity: 1, kind: 'cone', atk: 10, interval: 0.9, range: 250, cone: 0.6, burn: 6, burnDur: 3, desc: '扇形喷火烧一片，还会持续烧伤', color: 0xff6a2a },
  sword:     { name: '剑士塔', short: '剑', rarity: 1, kind: 'melee', atk: 48, interval: 1.0, range: 250, desc: '只砍身边的敌人，但伤害最高（打不到飞的）', color: 0xc8c8d8 },
  time:      { name: '时间塔', short: '时', rarity: 2, kind: 'stop', atk: 0, interval: 6, range: 290, stop: 1.8, stopPerLv: 0.3, desc: '每 6 秒让范围内的敌人停住（首领减半）', color: 0x8a5ae8 },
  shadow:    { name: '暗影刺客', short: '影', rarity: 2, kind: 'assassin', atk: 16, interval: 0.7, range: 340, shotSpeed: 1900, crit: 0.3, critMul: 3, desc: '专打血最少的敌人，30% 机率三倍暴击', color: 0x5a3a8a },
  dragon:    { name: '龙巢', short: '龙', rarity: 3, kind: 'dragon', atk: 40, interval: 2.0, range: 99999, shotSpeed: 700, splash: 120, desc: '小龙飞向最前面的敌人，爆炸伤害一片', color: 0xe2483a },
};

// 3 星特性：desc 給畫面顯示，mod 把塔的數值改掉（戰鬥開始時套用）
export const TRAIT3 = {
  crossbow:  { desc: '攻速 +15%', mod: d => ({ ...d, interval: d.interval * 0.85 }) },
  cannon:    { desc: '爆炸范围 +25%', mod: d => ({ ...d, splash: d.splash * 1.25 }) },
  ice:       { desc: '减速提高到 40%', mod: d => ({ ...d, slow: 0.4 }) },
  poison:    { desc: '中毒时间延长到 6 秒', mod: d => ({ ...d, dotDur: 6 }) },
  alchemy:   { desc: '产魔力 +25%', mod: d => ({ ...d, manaPerLv: d.manaPerLv * 1.25 }) },
  lightning: { desc: '闪电多跳 1 个', mod: d => ({ ...d, chain: d.chain + 1 }) },
  holy:      { desc: '光环加成 +5%', mod: d => ({ ...d, auraPerLv: d.auraPerLv + 0.05 }) },
  flame:     { desc: '烧伤伤害 +50%', mod: d => ({ ...d, burn: d.burn * 1.5 }) },
  sword:     { desc: '连砍：同时砍 2 个敌人', mod: d => ({ ...d, cleave: 2 }) },
  time:      { desc: '每 4.5 秒发动一次', mod: d => ({ ...d, interval: 4.5 }) },
  shadow:    { desc: '暴击机率提高到 45%', mod: d => ({ ...d, crit: 0.45 }) },
  dragon:    { desc: '爆炸范围 +30%', mod: d => ({ ...d, splash: d.splash * 1.3 }) },
};

export const RARITY = [
  { name: '普通', color: 0xb8c0cc },
  { name: '稀有', color: 0x3f8cff },
  { name: '史诗', color: 0xb05cff },
  { name: '传说', color: 0xffc13b },
];
