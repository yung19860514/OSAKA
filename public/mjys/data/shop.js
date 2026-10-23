// 商店與儲值資料（docs/02）。之後接後端時，伺服器讀同一份當價目表、發貨依據
// 價格：price＝钻石、coins＝金币（钻石只能靠遊玩取得；真錢商品在 data/products.js）
// limit：{ period: 'day' | 'week' | 'month' | 'once', max }

// VIP：累計購買金額 NT$ 門檻（平台發貨時累加）；福利直接給，不能變成可儲值的餘額
// perks：体力購買次數、活動次數、商店免費刷新、關卡金币加成
export const VIP = [
  { lv: 0, need: 0 },
  { lv: 1, need: 30, staminaBuys: 1 },
  { lv: 2, need: 100, staminaBuys: 1 },
  { lv: 3, need: 300, staminaBuys: 1, workshop: 1 },
  { lv: 4, need: 800, staminaBuys: 2, workshop: 1 },
  { lv: 5, need: 1500, staminaBuys: 2, workshop: 1, endless: 1, freeRefresh: 2 },
  { lv: 6, need: 3000, staminaBuys: 2, workshop: 1, endless: 1, freeRefresh: 2 },
  { lv: 7, need: 5000, staminaBuys: 3, workshop: 1, endless: 1, freeRefresh: 2, coinBonus: 0.05 },
  { lv: 8, need: 9000, staminaBuys: 3, workshop: 2, endless: 1, freeRefresh: 3, coinBonus: 0.05 },
  { lv: 9, need: 14000, staminaBuys: 4, workshop: 2, endless: 2, freeRefresh: 3, coinBonus: 0.05 },
  { lv: 10, need: 20000, staminaBuys: 5, workshop: 2, endless: 2, freeRefresh: 5, coinBonus: 0.1 },
];

// 钻石商品
export const GEM_ITEMS = [
  { id: 'coin1', name: '金币 ×1万', icon: 'ic_coin', price: 20, give: { coins: 10000 } },
  { id: 'coin6', name: '金币 ×6万', icon: 'ic_coin', price: 100, give: { coins: 60000 } },
  { id: 'coin20', name: '金币 ×20万', icon: 'ic_coin', price: 300, give: { coins: 200000 } },
  { id: 'chest1', name: '普通宝箱', icon: 'chest1', price: 100, chest: 'normal' },
  { id: 'chest2', name: '高级宝箱', icon: 'chest2', price: 300, chest: 'rare' },
  { id: 'chest3', name: '传说宝箱', icon: 'chest3', price: 900, chest: 'legend', limit: { period: 'week', max: 3 } },
  { id: 'partbox', name: '零件箱', icon: 'part_bolt', price: 200, give: { randomParts: 30 }, limit: { period: 'day', max: 3 } },
  { id: 'uni5', name: '万能零件 ×5', icon: 'part_universal', price: 150, give: { parts: { universal: 5 } }, limit: { period: 'week', max: 5 } },
  { id: 'deck2', name: '加速 ×3 永久', icon: 'ic_energy', price: 500, give: { speed3: true }, limit: { period: 'once', max: 1 } },
];

// 宝箱：抽幾張塔碎片、稀有度權重（普通、稀有、史詩、傳說）
export const CHESTS = {
  normal: { name: '普通宝箱', draws: 3, each: [2, 4], weight: [70, 25, 5, 0] },
  rare:   { name: '高级宝箱', draws: 5, each: [3, 6], weight: [45, 40, 13, 2], atLeast: 1 },
  legend: { name: '传说宝箱', draws: 5, each: [5, 10], weight: [20, 40, 30, 10], atLeast: 2 },
};

// 體力購買：每天第 n 次的價格
export const STAMINA_BUY = { amount: 30, prices: [50, 80, 120, 160, 200] };

// 每日商店：第 1 格固定免費金币，其他 5 格每天從 pool 抽
export const DAILY_FREE = { id: 'free', name: '免费金币', icon: 'ic_coin', give: { coins: 1000 }, free: true };
export const DAILY_POOL = [
  { id: 'frag5', name: '塔碎片 ×5', fragTower: true, n: 5, coins: 800 },
  { id: 'frag10', name: '塔碎片 ×10', fragTower: true, n: 10, price: 60 },
  { id: 'parts10', name: '零件 ×10', partType: true, n: 10, coins: 1500 },
  { id: 'parts25', name: '零件 ×25', partType: true, n: 25, price: 80 },
  { id: 'uni1', name: '万能零件 ×1', icon: 'part_universal', give: { parts: { universal: 1 } }, price: 40 },
  { id: 'stamina10', name: '体力 ×10', icon: 'ic_energy', give: { stamina: 10 }, coins: 1000 },
];
export const DAILY_REFRESH_PRICE = 30;
export const DAILY_REFRESH_MAX = 5;

// 真錢商品改成平台直購：data/products.js
