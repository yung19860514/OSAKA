// 平台串接（D:\dev\遊戲串接規格.md v0.3；說明見 docs/09_平台串接說明.md）
// 兩種模式：
//   mock：目前沒有遊戲伺服器也沒有平台測試環境 → 售價用建議價、結帳在遊戲裡模擬平台結帳頁、
//         「模擬已繳費」直接呼叫 economy.fulfillOrder（等於平台打發貨通知給遊戲伺服器）
//   live：網址加 ?platform=live，走真的平台；所有要金鑰的呼叫都經過「遊戲自己的伺服器」(API)，
//         瀏覽器端絕對不放 client_secret、伺服器金鑰、發貨金鑰（規格第 9 章）
import { GAME_ID, PRODUCTS, ORDER_RULES, productOf } from './data/products.js';
import { save } from './store.js';
import * as E from './economy.js';

const live = new URLSearchParams(location.search).get('platform') === 'live';
export const PLATFORM = {
  mode: live ? 'live' : 'mock',
  gameId: GAME_ID,
  origin: '',               // ⏳ 平台網域（例 https://<平台網域>），正式開通後填
  api: '/api/platform',     // 遊戲伺服器的代理端點（伺服器拿金鑰去問平台），後端做好前不會用到
};
export const isMock = () => PLATFORM.mode === 'mock';
// 【平台】正式結帳（黑貓PAY）接上前，結帳一律關閉，不產生模擬的繳費代碼
export const CHECKOUT_CLOSED = true;

// ───── 售價（規格 8.1）：以平台查詢結果為準；平台沒列的商品不顯示 ─────
let table = null, tableAt = 0;
function mockTable() {
  const prices = {};
  for (const p of PRODUCTS) prices[p.sku] = p.price;
  return { region: 'tw', currency: 'TWD', minOrder: ORDER_RULES.minOrder, maxOrder: ORDER_RULES.maxOrder, prices };
}
export async function loadPrices() {
  if (table && Date.now() - tableAt < 10 * 60 * 1000) return table; // 快取 10 分鐘
  if (isMock()) table = mockTable();
  else {
    try { table = await (await fetch(`${PLATFORM.api}/prices`, { credentials: 'include' })).json(); } catch (e) { table = table || { ...mockTable(), prices: {} }; }
  }
  tableAt = Date.now();
  return table;
}
if (isMock()) { table = mockTable(); tableAt = Date.now(); } // mock 不用等，畫面直接能用
export const priceOf = sku => table?.prices?.[sku];
export const rules = () => ({ min: table?.minOrder ?? ORDER_RULES.minOrder, max: table?.maxOrder ?? ORDER_RULES.maxOrder });
export const listed = list => list.filter(p => priceOf(p.sku) != null);

// ───── 購物車合計與檢查 ─────
export function cartLines() {
  return save.d.cart.map(c => ({ ...c, p: productOf(c.sku), price: priceOf(c.sku) })).filter(l => l.p && l.price != null);
}
export const cartTotal = () => cartLines().reduce((a, l) => a + l.price * l.qty, 0);
// null＝可以結帳；'empty'／'min'／'max'
export function cartProblem() {
  const t = cartTotal(), r = rules();
  if (!cartLines().length) return 'empty';
  if (t < r.min) return 'min';
  if (t > r.max) return 'max';
  return null;
}

// ───── 結帳（規格 8.2）：整個購物車一次帶到平台結帳頁 ─────
export function checkoutUrl() {
  const items = cartLines().map(l => `${l.sku}*${l.qty}`).join(',');
  const ret = `/play/${PLATFORM.gameId}/?shop=1`;
  return `${PLATFORM.origin}/checkout?game=${PLATFORM.gameId}&items=${encodeURIComponent(items)}&return=${encodeURIComponent(ret)}`;
}
// live：跳到平台。mock：建立一筆模擬的待繳費訂單（平台用自己的售價重算金額，所以這裡用 priceOf）
export function checkout() {
  if (CHECKOUT_CLOSED) return null;
  if (cartProblem()) return null;
  if (!isMock()) { location.href = checkoutUrl(); return null; }
  const now = new Date(), lines = cartLines();
  // 繳費期限：訂單建立後第 3 天的當天結束前
  const exp = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ORDER_RULES.payDays, 23, 59, 59);
  const order = {
    orderId: 'mock-' + now.getTime().toString(36) + Math.random().toString(36).slice(2, 6),
    status: 'pending',
    items: lines.map(l => ({ sku: l.sku, qty: l.qty })),
    total: cartTotal(), currency: 'TWD', createdAt: now.toISOString(),
    payment: { method: 'cvs', provider: 'ccat', store: '7-ELEVEN', code: String(Math.floor(1e11 + Math.random() * 9e11)), barcodeUrl: null, expiresAt: exp.toISOString() },
  };
  save.d.orders.push(order);
  save.d.cart = [];
  save.write();
  return order;
}
// 從平台結帳頁回來：網址帶 ?order=<id>&status=pending → 清空購物車（回傳 orderId 讓商店打開待繳費訂單）
export function handleReturn() {
  const q = new URLSearchParams(location.search);
  const id = q.get('order');
  if (q.get('status') !== 'pending' || !id) return null;
  save.d.cart = [];
  save.write();
  q.delete('order'); q.delete('status');
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
  return id;
}

// ───── 訂單同步：待繳費代碼、逾期、到帳 ─────
// 回傳 { expired: 剛過期筆數 }；到帳內容用 economy.takeArrivals() 取
export async function syncOrders() {
  if (isMock()) return { expired: E.expireOrders() };
  try {
    // 遊戲伺服器代查平台 GET /orders?status=pending（規格 8.2）；到帳由伺服器收發貨通知後寫進玩家存檔
    const r = await (await fetch(`${PLATFORM.api}/orders?status=pending`, { credentials: 'include' })).json();
    const before = E.pendingOrders().length;
    save.d.orders = [...save.d.orders.filter(o => o.status !== 'pending'), ...(r.orders || [])];
    save.write();
    return { expired: Math.max(0, before - (r.orders || []).length) };
  } catch (e) { return { expired: 0 }; }
}

// 測試環境：模擬已繳費（平台 → 遊戲伺服器 order.paid 發貨通知）
export function mockPay(orderId) {
  if (CHECKOUT_CLOSED) return null;
  const o = save.d.orders.find(x => x.orderId === orderId && x.status === 'pending');
  if (!o) return null;
  const r = E.fulfillOrder(o);
  if (r.code === 409) { o.status = 'refunded'; save.write(); } // 超過限購：平台會退款
  return r;
}

// 卡包機率說明（規格 7.2）：正式版連到平台的機率公開頁 probabilityUrl
export const probabilityUrl = sku => `${PLATFORM.origin}/play/${PLATFORM.gameId}/odds/${sku.split(':').pop()}`;
