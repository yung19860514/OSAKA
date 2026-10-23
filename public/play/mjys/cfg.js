// 《魔晶要塞》可調數值：調手感、平衡都改這裡（docs/05 第 3 節）
export const W = 1080, H = 1920;

// 放塔區：5 欄 × 4 排，每格 180×150，左上角在 (90, 900)
export const GRID = { cols: 5, rows: 4, x: 90, y: 900, cw: 180, ch: 150 };

// 第 3~6 章：每章 [第 1 關, 第 15 關] 的血量倍率（tools/tune_chapters.mjs 調的；怪物種類不同所以不是單調的）
export const CHAPTER_HP = { 3: [2.2, 4.79], 4: [3.52, 4.45], 5: [3.18, 4.16], 6: [6.5, 7.73] };
// 各章打完時預期的局外攻擊倍率（塔等級×星級×隊長），推薦戰力與調難度都用這個
export const META_END = [1, 1.5, 1.9, 2.4, 3.0, 3.7, 4.5];

export const CFG = {
  mana: { start: 50, perSec: 3 },                    // 開局魔力（再加隊長被動 +20）、每秒回復（原文件 2）
  summon: { base: 20, step: 5, max: 60 },            // 召喚費用：20 起、每次 +5、上限 60（原文件 30/+10/150 一關只召得到 12 座，見 memory.md）
  maxLevel: 7,                                       // 局內塔等級上限
  lvAtkMul: 2.2,                                     // 每升 1 級攻擊 ×2.2（大於 2 合體才划算；原文件 1.8 合體反而變弱）
  lvRangeAdd: 0.05,                                  // 每升 1 級範圍 +5%
  tierLv: [5, 7],                                    // Lv5 換第 2 型外觀、Lv7 換第 3 型
  wave: {
    firstDelay: 4,      // 開場幾秒後第 1 波
    gap: 8,             // 波與波（開始時間）至少隔幾秒
    afterSpawn: 1.5,    // 上一波怪全部出完後，至少再等幾秒
    spacing: 0.42,      // 小怪出生間隔（秒）
    eliteGap: 1.2,      // 精英出生間隔
    bossGap: 2,         // 首領前後間隔
    skipMana: 10,       // 按「下一波」提前開打的獎勵魔力
  },
  // 怪物血量：基礎血 × 關卡倍率 × waveHp(波數)
  // 關卡倍率不是一開始就全額：第 1 波只吃 stageRamp（30%）的關卡加成，第 15 波吃滿
  // （不這樣的話，後面關卡開局前幾波就把還沒成形的陣容壓垮，合體根本來不及）
  // 第 2 章起改成線性成長（原公式到第 30 關 6.2 倍，玩家養成追不上）；每多一章再接一段（tools/sim.mjs 調的）
  // 第 3 章起每章怪物組合差很多，改成每章「開頭→首領關」兩個倍率線性內插（tools/tune_chapters.mjs 跑出來的）
  stageHp: n => {
    if (n <= 30) return n <= 15 ? (1 + 0.07 * (n - 1)) * Math.pow(1.025, n - 1) : 2.8 * (1 + 0.045 * (n - 15));
    const c = Math.ceil(n / 15), l = n - (c - 1) * 15, [a, b] = CHAPTER_HP[c] || CHAPTER_HP[6];
    return a + (b - a) * (l - 1) / 14;
  },
  stageRamp: 0.3,
  waveHp: w => 1 + 0.04 * w,
  enemySpeedMul: 0.85,                               // 全部怪物速度倍率（整關太長太短調這個；第 1 章背景的路比較短所以放慢）
  gateHp: 20,
  captain: { startMana: 20, energyMax: 20, skillDur: 8, skillRate: 2 }, // 莉亞：開局 +20、20 殺充滿、攻速 ×2 持續 8 秒
  stars: { three: 20, two: 10 },                     // 城門剩多少拿 3 星／2 星
  defaultDeck: ['crossbow', 'cannon', 'ice', 'poison', 'alchemy'],
  stamina: { max: 30, regenSec: 300, cost: 5 },      // 体力上限、幾秒回 1 點、每場消耗
  rewards: {
    coinsPerStage: 300,     // 首通金币＝300×關號
    repeatCoinMul: 0.5,     // 重複通關金币減半
    firstDiamonds: 5,       // 首通钻石
    firstFrags: 6,          // 首通：該關指定塔碎片
    firstExtraFrags: 3,     // 首通：另送卡組隨機一座塔的碎片
    repeatFrags: 2,         // 重複通關：指定塔碎片
  },
  // 局外塔等級（塔頁升級）：每級攻擊 +8%；升 lv→lv+1 要 金币 100×lv、碎片 lv 個
  // 照首通碎片估算：打到第 10 關卡組約 Lv5~6（×1.35），第 14 關約 Lv6~7（×1.45），首領關要再刷幾次
  meta: { atkPerLv: 0.08, maxLv: 30, coins: lv => 100 * lv, frags: lv => lv },
  // 推薦戰力＝500×這關預期的局外倍率（全部 Lv1 的卡組＝500）
  recommend: n => { const c = Math.ceil(n / 15), l = n - (c - 1) * 15; return Math.round(500 * (META_END[c - 1] + (META_END[c] - META_END[c - 1]) * (l - 1) / 14)); },
  // 零件與升星（docs/01 3.2）：每升 1 星全屬性 +10%；不夠的普通零件可以用万能零件補
  parts: {
    types: ['bolt', 'barrel', 'crystal', 'rune'],           // 弩机、炮管、魔晶、符文
    towerPart: { crossbow: 'bolt', cannon: 'barrel', ice: 'crystal', poison: 'crystal', alchemy: 'rune', lightning: 'crystal', holy: 'rune', dragon: 'barrel', flame: 'barrel', sword: 'bolt', time: 'rune', shadow: 'bolt' },
    starCost: [null, { n: 20, u: 0 }, { n: 50, u: 5 }, { n: 120, u: 15 }, { n: 300, u: 40 }], // [目前星數] → 升下一星
    starMul: 0.1,
    maxStar: 5,
  },
  // 活動（docs/01 第四節）
  events: {
    // 零件工坊：每日 3 次、10 波短關；星期幾決定掉哪種零件（日＝符文＋万能零件）
    workshop: {
      tries: 3, waves: 10,
      weekday: { 0: 'rune', 1: 'bolt', 2: 'barrel', 3: 'crystal', 4: 'bolt', 5: 'barrel', 6: 'crystal' },
      levels: [ // need＝要先通關第幾關；eq＝難度相當於第幾關；reward＝過關零件數
        { need: 0, eq: 2, reward: 12 },
        { need: 3, eq: 5, reward: 20 },
        { need: 8, eq: 8, reward: 32 },
        { need: 12, eq: 11, reward: 50 },
      ],
    },
    // 無盡深淵：每日 2 次，波數沒有上限、每波怪血 ×growth；依撐過的波數給獎勵
    endless: { tries: 2, eq: 4, growth: 1.1, coinsPerWave: 120, partsPerWave: 2, universalEvery: 5 },
  },
  dmgNumbers: true,                                  // 顯示傷害數字
  maxDmgNumbers: 36,                                 // 同時最多幾個（太多會卡）
};
