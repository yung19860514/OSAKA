// 每日任務、七日簽到、賽季通行證（docs/01 第四節、docs/02 第四節）
// give 格式跟 data/shop.js 一樣（economy.grant）

// 每日任務：key＝存檔 daily 裡的計數欄位；完成領取給 give＋賽季經驗 exp
export const TASKS = [
  { id: 'login', name: '登录游戏', key: 'login', need: 1, give: { coins: 2000 }, exp: 20 },
  { id: 'battle', name: '完成 3 场主线战斗', key: 'mainBattles', need: 3, give: { gems: 20 }, exp: 30 },
  { id: 'merge', name: '合体 30 次', key: 'merges', need: 30, give: { randomParts: 10 }, exp: 20 },
  { id: 'kill', name: '击杀 500 个敌人', key: 'kills', need: 500, give: { coins: 5000 }, exp: 20 },
  { id: 'event', name: '参加 1 次活动', key: 'eventBattles', need: 1, give: { gems: 20 }, exp: 20 },
  { id: 'stamina', name: '消耗 20 体力', key: 'staminaUsed', need: 20, give: { stamina: 10 }, exp: 20 },
];
export const TASK_ALL = { give: { gems: 50, chests: { rare: 1 } }, exp: 50 }; // 全部完成的大獎

// 七日簽到：每天領一格，領完 7 天再從頭
export const SIGNIN = [
  { give: { coins: 3000 } },
  { give: { gems: 50 } },
  { give: { chests: { normal: 2 } } },
  { give: { randomParts: 30 } },
  { give: { gems: 100 } },
  { give: { parts: { universal: 10 } } },
  { give: { chests: { legend: 1 } }, big: true },
];

// 賽季：30 天一季、30 級、每級 100 經驗
export const SEASON = { days: 30, levels: 30, expPerLv: 100, winExp: 10, eventExp: 10 };

// 通行證獎勵：free 免費線、premium 高级線（880 钻解鎖）
export const PASS = [];
for (let lv = 1; lv <= SEASON.levels; lv++) {
  const free = lv % 5 === 0 ? { gems: 50 } : lv % 3 === 0 ? { randomParts: 15 } : { coins: 2000 + lv * 100 };
  const premium = lv % 10 === 0 ? { chests: { legend: 1 } } : lv % 5 === 0 ? { gems: 150 } : lv % 2 === 0 ? { parts: { universal: 5 } } : { randomParts: 30 };
  PASS.push({ lv, free, premium });
}
// 高级通行證用钻石解鎖（平台規格：不用真錢賣「先付錢、之後慢慢領」的東西）
export const PASS_BUY = {
  premium: { id: 'pass_premium', name: '高级通行证', gems: 880, desc: '用钻石解锁高级线全部奖励（钻石可从任务、签到、活动获得）' },
};
