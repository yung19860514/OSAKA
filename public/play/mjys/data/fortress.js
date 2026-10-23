// 要塞建築（docs/01 3.4）：升級吃金币，並要求總星數（逼玩家回頭把關卡打到 3 星）
export const BUILDINGS = {
  gate:     { name: '城门', icon: 'nav_fort', art: 'icon_buildings_0', max: 5, desc: lv => `城门耐久 +${lv * 2}` },
  furnace:  { name: '魔晶炉', icon: 'ic_mana', art: 'icon_buildings_1', max: 5, desc: lv => `开局魔力 +${lv * 10}` },
  workshop: { name: '工坊', icon: 'part_bolt', art: 'icon_buildings_2', max: 2, desc: lv => `零件工坊每日次数 +${lv}` },
  vault:    { name: '宝库', icon: 'ic_coin', art: 'icon_currency_3', max: 5, desc: lv => `每小时产金币 ${lv * 300}（最多存 8 小时）` },
};
export const FORT_IDS = Object.keys(BUILDINGS);
// 升到 lv（下一級）要多少：金币、總星數
export const fortCost = lv => ({ coins: 1500 * lv * lv, stars: lv * 6 });
export const VAULT = { perHour: 300, capHours: 8 };
