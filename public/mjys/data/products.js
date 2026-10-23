// 平台直購商品（D:\dev\遊戲串接規格.md v0.3）
// 規則：台幣直接買「道具」，不賣钻石、金币等遊戲幣；钻石只能靠遊玩取得
// price＝建議售價（NT$）。正式售價以平台 /prices 查詢結果為準（platform.js），平台沒列的商品不顯示
// sku 格式 <gameId>:<種類>:<代號>，上架後不可改；要改內容就開新 sku、舊的下架
// kind：item 道具｜pack 卡包（機率型，要有機率說明）｜pass 有效期特權｜bundle 組合包
// limitPerAccount：每帳號總共限買幾次（平台也會檢查）｜period：遊戲自己的週期限購（每日／每週／每月特惠）
export const GAME_ID = 'mjys'; // ⏳ 平台正式分配後替換

export const PRODUCTS = [
  { sku: 'mjys:bundle:first_buy', kind: 'bundle', name: '新手首购包', icon: 'ic_gift', price: 30, badge: '超值',
    desc: '雷电塔碎片 20、高级宝箱 2、体力 60、万能零件 5', limitPerAccount: 1, maxPerOrder: 1,
    give: { frags: { lightning: 20 }, chests: { rare: 2 }, stamina: 60, parts: { universal: 5 } } },
  { sku: 'mjys:pass:monthly', kind: 'pass', pass: 'monthly', name: '月卡特权', icon: 'card_gold', price: 150, durationDays: 30, stackable: true, maxPerOrder: 3,
    desc: '30 天：关卡金币 +20%、体力购买 +2 次、商店免费刷新 +1、零件工坊 +1 次',
    perks: { coinBonus: 0.2, staminaBuys: 2, freeRefresh: 1, workshop: 1 } },
  { sku: 'mjys:pass:weekly', kind: 'pass', pass: 'weekly', name: '周卡特权', icon: 'card_silver', price: 60, durationDays: 7, stackable: true, maxPerOrder: 4,
    desc: '7 天：关卡金币 +10%、体力购买 +1 次',
    perks: { coinBonus: 0.1, staminaBuys: 1 } },
  { sku: 'mjys:bundle:daily', kind: 'bundle', name: '每日特惠', icon: 'ic_gift', price: 30, maxPerOrder: 1, period: { period: 'day', max: 1 },
    desc: '随机零件 30、普通宝箱 2、体力 30', give: { randomParts: 30, chests: { normal: 2 }, stamina: 30 } },
  { sku: 'mjys:bundle:weekly', kind: 'bundle', name: '每周特惠', icon: 'chest2', price: 150, maxPerOrder: 1, period: { period: 'week', max: 1 },
    desc: '高级宝箱 3、万能零件 10、体力 60', give: { chests: { rare: 3 }, parts: { universal: 10 }, stamina: 60 } },
  { sku: 'mjys:bundle:monthly', kind: 'bundle', name: '每月特惠', icon: 'chest3', price: 600, maxPerOrder: 1, period: { period: 'month', max: 1 },
    desc: '传说宝箱 4、高级宝箱 3、万能零件 40', give: { chests: { legend: 4, rare: 3 }, parts: { universal: 40 } } },
  { sku: 'mjys:pack:chest_rare_10', kind: 'pack', odds: 'rare', name: '高级宝箱 ×10', icon: 'chest2', price: 300, maxPerOrder: 10,
    desc: '开 10 个高级宝箱，每个至少 1 张稀有以上', give: { chests: { rare: 10 } } },
  { sku: 'mjys:pack:chest_legend_1', kind: 'pack', odds: 'legend', name: '传说宝箱', icon: 'chest3', price: 150, maxPerOrder: 10,
    desc: '每个至少 1 张史诗以上', give: { chests: { legend: 1 } } },
  { sku: 'mjys:pack:chest_legend_5', kind: 'pack', odds: 'legend', name: '传说宝箱 ×5', icon: 'chest3', price: 600, maxPerOrder: 10,
    desc: '比单买便宜 150', give: { chests: { legend: 5 } } },
  { sku: 'mjys:item:parts_supply', kind: 'item', name: '零件补给', icon: 'part_universal', price: 60, maxPerOrder: 2, period: { period: 'week', max: 2 },
    desc: '卡组最缺的零件 ×120', give: { neededParts: 120 } },
  { sku: 'mjys:item:universal_20', kind: 'item', name: '万能零件 ×20', icon: 'part_universal', price: 150, maxPerOrder: 10,
    desc: '可当任何零件使用', give: { parts: { universal: 20 } } },
  { sku: 'mjys:item:stamina_60', kind: 'item', name: '体力药水 ×60', icon: 'ic_energy', price: 30, maxPerOrder: 10,
    desc: '立即回复 60 体力', give: { stamina: 60 } },
  { sku: 'mjys:item:speed3', kind: 'item', name: '三倍速（永久）', icon: 'ic_energy', price: 150, limitPerAccount: 1, maxPerOrder: 1,
    desc: '战斗可以开 ×3 加速', give: { speed3: true } },
  { sku: 'mjys:bundle:power_big', kind: 'bundle', name: '战力豪华包', icon: 'chest3', price: 1990, maxPerOrder: 5,
    desc: '传说宝箱 12、高级宝箱 10、万能零件 100', give: { chests: { legend: 12, rare: 10 }, parts: { universal: 100 } } },
];

export const productOf = sku => PRODUCTS.find(p => p.sku === sku);

// 結帳規則（平台 /prices 會回傳 minOrder／maxOrder，以平台為準）
export const ORDER_RULES = { minOrder: 30, maxOrder: 20000, payDays: 3 };
