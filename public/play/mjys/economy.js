// 商店、平台直購（購物車、訂單、發貨）、特權、VIP 的邏輯（資料在 data/shop.js、data/products.js，存檔在 store.js）
// 平台規格（D:\dev\遊戲串接規格.md）：台幣直接買道具，不賣钻石；結帳、收款在平台，繳費完成平台通知遊戲伺服器發貨
// fulfillOrder／refundOrder 是「遊戲伺服器收到平台通知時要做的事」：原型在瀏覽器裡跑（測試用「模擬已繳費」），接後端時整段搬到伺服器
import { CFG } from './cfg.js';
import { TOWERS } from './data/towers.js';
import { save } from './store.js';
import {
  VIP, GEM_ITEMS, CHESTS, STAMINA_BUY, DAILY_FREE, DAILY_POOL, DAILY_REFRESH_PRICE, DAILY_REFRESH_MAX,
} from './data/shop.js';
import { PRODUCTS, productOf } from './data/products.js';
import { TASKS, TASK_ALL, SIGNIN, SEASON, PASS, PASS_BUY } from './data/season.js';

const d = () => save.d;

// ───── 日期 ─────
export const dayNum = (t = Date.now()) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);
export function periodKey(period) {
  const n = dayNum();
  if (period === 'day') return 'd' + n;
  if (period === 'week') return 'w' + Math.floor((n + 3) / 7); // 1970-01-01 是星期四，+3 讓每週從星期一開始
  if (period === 'month') { const t = new Date(); return 'm' + t.getFullYear() + '-' + t.getMonth(); }
  return 'once';
}

// ───── 限購 ─────
export function limitLeft(id, limit) {
  if (!limit) return Infinity;
  const rec = d().limits[id];
  const used = rec && rec.key === periodKey(limit.period) ? rec.n : 0;
  return Math.max(0, limit.max - used);
}
function useLimit(id, limit) {
  if (!limit) return;
  const key = periodKey(limit.period), rec = d().limits[id];
  d().limits[id] = { key, n: (rec && rec.key === key ? rec.n : 0) + 1 };
}

// ───── VIP ─────
export function vip() {
  const paid = d().vipPaid;
  let cur = VIP[0];
  for (const v of VIP) if (paid >= v.need) cur = v;
  const next = VIP.find(v => v.lv === cur.lv + 1) || null;
  return { ...cur, paid, next };
}
export const vipPerk = k => save.perk(k); // VIP＋特權

// ───── 發獎：give → 實際加進存檔，回傳顯示用清單 [{ icon | tower, n }] ─────
function rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
export function grant(give) {
  const D = d(), out = [];
  const push = (e) => { const f = out.find(o => o.icon === e.icon && o.tower === e.tower); if (f) f.n += e.n; else out.push({ ...e }); };
  if (give.gems) { D.diamonds += give.gems; push({ icon: 'ic_gem', n: give.gems }); }
  if (give.coins) { D.coins += give.coins; push({ icon: 'ic_coin', n: give.coins }); }
  if (give.stamina) { D.stamina += give.stamina; push({ icon: 'ic_energy', n: give.stamina }); }
  for (const [k, n] of Object.entries(give.parts || {})) { D.parts[k] += n; push({ icon: 'part_' + k, n }); }
  if (give.randomParts) {
    const t = CFG.parts.types;
    for (let i = 0; i < give.randomParts; i++) { const k = t[rnd(0, t.length - 1)]; D.parts[k]++; push({ icon: 'part_' + k, n: 1 }); }
  }
  if (give.neededParts) { // 給卡組裡最缺的那種零件
    const need = {};
    for (const id of D.deck) { const k = CFG.parts.towerPart[id]; need[k] = (need[k] || 0) + 1; }
    const k = Object.keys(need).sort((a, b) => D.parts[a] - D.parts[b] || need[b] - need[a])[0];
    D.parts[k] += give.neededParts; push({ icon: 'part_' + k, n: give.neededParts });
  }
  for (const [id, n] of Object.entries(give.frags || {})) { D.towers[id].frag += n; push({ tower: id, n }); }
  for (const [kind, n] of Object.entries(give.chests || {})) for (let i = 0; i < n; i++) for (const e of openChest(kind)) push(e);
  if (give.speed3) { D.flags.speed3 = true; push({ icon: 'ic_energy', n: 3, label: '×3' }); }
  return out;
}

// 宝箱：依稀有度權重抽已擁有的塔，給碎片
export function openChest(kind) {
  const C = CHESTS[kind], D = d(), out = [];
  const owned = Object.keys(TOWERS).filter(id => D.towers[id].owned);
  const byR = r => owned.filter(id => TOWERS[id].rarity === r);
  const total = C.weight.reduce((a, b) => a + b, 0);
  for (let i = 0; i < C.draws; i++) {
    let r = 0, x = Math.random() * total;
    while (x >= C.weight[r]) { x -= C.weight[r]; r++; }
    if (C.atLeast && i === 0) r = Math.max(r, C.atLeast);  // 第一抽保底
    while (r > 0 && !byR(r).length) r--;                   // 沒有那個稀有度的塔就往下找
    const list = byR(r);
    const id = list[rnd(0, list.length - 1)];
    const n = rnd(C.each[0], C.each[1]);
    D.towers[id].frag += n;
    const f = out.find(o => o.tower === id);
    if (f) f.n += n; else out.push({ tower: id, n });
  }
  return out;
}

// ───── 钻石商品 ─────
// n＝一次買幾個（商店可以選數量）
export function buyGemItem(item, n = 1) {
  const D = d();
  if (limitLeft(item.id, item.limit) < n) return { why: 'limit' };
  if (D.diamonds < item.price * n) return { why: 'gems' };
  D.diamonds -= item.price * n;
  const out = [];
  for (let k = 0; k < n; k++) {
    useLimit(item.id, item.limit);
    for (const e of item.chest ? openChest(item.chest) : grant(item.give)) {
      const f = out.find(o => o.icon === e.icon && o.tower === e.tower && o.label === e.label);
      if (f) f.n += e.n; else out.push({ ...e });
    }
  }
  save.write();
  return { why: 'ok', got: out };
}

// ───── 体力 ─────
export function staminaBuysLeft() { return Math.max(0, STAMINA_BUY.prices.length + vipPerk('staminaBuys') - (d().staminaBuys.key === periodKey('day') ? d().staminaBuys.n : 0)); }
export function staminaPrice() {
  const used = d().staminaBuys.key === periodKey('day') ? d().staminaBuys.n : 0;
  return STAMINA_BUY.prices[Math.min(used, STAMINA_BUY.prices.length - 1)];
}
export function buyStamina() {
  const D = d();
  if (staminaBuysLeft() <= 0) return { why: 'limit' };
  const p = staminaPrice();
  if (D.diamonds < p) return { why: 'gems' };
  D.diamonds -= p;
  const key = periodKey('day');
  D.staminaBuys = { key, n: (D.staminaBuys.key === key ? D.staminaBuys.n : 0) + 1 };
  const got = grant({ stamina: STAMINA_BUY.amount });
  save.write();
  return { why: 'ok', got };
}

// ───── 每日商店 ─────
export function dailyShop() {
  const D = d(), key = periodKey('day');
  if (!D.shopDaily || D.shopDaily.key !== key) D.shopDaily = { key, refreshes: 0, items: genDaily(key, 0), bought: [] };
  return D.shopDaily;
}
function genDaily(key, refresh) {
  let seed = 0;
  for (const ch of key + ':' + refresh) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const owned = Object.keys(TOWERS).filter(id => d().towers[id].owned);
  const items = [{ ...DAILY_FREE }];
  const pool = [...DAILY_POOL];
  for (let i = 0; i < 5 && pool.length; i++) { // 不重複抽
    const base = pool.splice(Math.floor(r() * pool.length), 1)[0];
    const it = { ...base, uid: base.id + i };
    if (base.fragTower) { const id = owned[Math.floor(r() * owned.length)]; it.give = { frags: { [id]: base.n } }; it.tower = id; it.name = `${TOWERS[id].name}碎片 ×${base.n}`; }
    if (base.partType) { const k = CFG.parts.types[Math.floor(r() * 4)]; it.give = { parts: { [k]: base.n } }; it.icon = 'part_' + k; it.partKey = k; }
    items.push(it);
  }
  return items;
}
export function refreshCost() {
  const s = dailyShop(), free = vipPerk('freeRefresh');
  if (s.refreshes >= DAILY_REFRESH_MAX + free) return null;
  return s.refreshes < free ? 0 : DAILY_REFRESH_PRICE;
}
export function refreshDaily() {
  const s = dailyShop(), cost = refreshCost();
  if (cost == null) return { why: 'limit' };
  if (d().diamonds < cost) return { why: 'gems' };
  d().diamonds -= cost;
  s.refreshes++;
  s.items = genDaily(s.key, s.refreshes);
  s.bought = [];
  save.write();
  return { why: 'ok' };
}
export function buyDaily(i) {
  const s = dailyShop(), it = s.items[i], D = d();
  if (!it || s.bought.includes(i)) return { why: 'limit' };
  if (it.price && D.diamonds < it.price) return { why: 'gems' };
  if (it.coins && D.coins < it.coins) return { why: 'coins' };
  if (it.price) D.diamonds -= it.price;
  if (it.coins) D.coins -= it.coins;
  s.bought.push(i);
  const got = grant(it.give);
  save.write();
  return { why: 'ok', got };
}

// ───── 平台直購：購物車 ─────
// 還能再加幾個進購物車（0＝不能加：已達單筆上限、每帳號限購、週期限購、已擁有）
export const cartQty = sku => d().cart.find(c => c.sku === sku)?.qty || 0;
export const cartCount = () => d().cart.reduce((a, c) => a + c.qty, 0);
export const pendingOrders = () => d().orders.filter(o => o.status === 'pending');
const pendingQty = sku => pendingOrders().reduce((a, o) => a + (o.items.find(i => i.sku === sku)?.qty || 0), 0);
export function owned(p) { return !!(p.give?.speed3 && d().flags.speed3); }
export function addLeft(p) {
  const D = d(), inCart = cartQty(p.sku), inPend = pendingQty(p.sku);
  if (owned(p)) return 0;
  let left = (p.maxPerOrder ?? 99) - inCart;
  if (p.limitPerAccount) left = Math.min(left, p.limitPerAccount - (D.purchased[p.sku] || 0) - inPend - inCart);
  if (p.period) left = Math.min(left, limitLeft(p.sku, p.period) - inPend - inCart);
  return Math.max(0, left);
}
export function addToCart(sku, n = 1) {
  const p = productOf(sku);
  if (!p || addLeft(p) < n) return 'limit';
  const c = d().cart.find(x => x.sku === sku);
  if (c) c.qty += n; else d().cart.push({ sku, qty: n });
  save.write();
  return 'ok';
}
export function setCartQty(sku, qty) {
  const c = d().cart.find(x => x.sku === sku);
  if (!c) return;
  const p = productOf(sku), max = c.qty + (p ? addLeft(p) : 0);
  c.qty = Math.max(0, Math.min(max, qty));
  if (!c.qty) d().cart = d().cart.filter(x => x !== c);
  save.write();
}
export function clearCart() { d().cart = []; save.write(); }

// ───── 平台直購：發貨（平台通知 order.paid → 遊戲伺服器） ─────
// 同一筆 orderId 只發一次；整筆一起發；超過限購或 sku 不存在回 409（平台退款）
export function fulfillOrder(o) {
  const D = d();
  if (D.delivered[o.orderId]) return { code: 200, status: 'delivered', dup: true, got: D.delivered[o.orderId].got };
  for (const it of o.items) {
    const p = productOf(it.sku);
    if (!p || it.qty < 1) return { code: 409, status: 'rejected' };
    if (p.limitPerAccount && (D.purchased[it.sku] || 0) + it.qty > p.limitPerAccount) return { code: 409, status: 'rejected' };
    if (owned(p)) return { code: 409, status: 'rejected' };
  }
  const out = [];
  const push = e => { const f = out.find(x => x.icon === e.icon && x.tower === e.tower && x.label === e.label && !x.pass); if (f && !e.pass) f.n += e.n; else out.push({ ...e }); };
  for (const it of o.items) {
    const p = productOf(it.sku);
    for (let k = 0; k < it.qty; k++) {
      if (p.give) grant(p.give).forEach(push);
      if (p.kind === 'pass') { // 特權：立即生效，重複購買累加天數
        const cur = D.passes[p.pass], start = cur != null && cur >= dayNum() ? cur + 1 : dayNum();
        D.passes[p.pass] = start + p.durationDays - 1;
        const f = out.find(x => x.pass === p.pass);
        if (f) f.n += p.durationDays; else out.push({ icon: p.icon, n: p.durationDays, pass: p.pass });
      }
      if (p.period) useLimit(p.sku, p.period);
    }
    D.purchased[it.sku] = (D.purchased[it.sku] || 0) + it.qty;
  }
  for (const e of out) if (e.pass) e.label = `+${e.n}天`;
  D.vipPaid += o.total;
  D.delivered[o.orderId] = { at: Date.now(), items: o.items, total: o.total, got: out, status: 'delivered' };
  const ord = D.orders.find(x => x.orderId === o.orderId);
  if (ord) ord.status = 'paid';
  D.arrivals.push(o.orderId);
  trimOrders();
  save.write();
  return { code: 200, status: 'delivered', got: out };
}
// 退款（平台通知 order.refunded）：收回商品；已經用掉的回報 consumed，交給客服
export function refundOrder(orderId) {
  const D = d(), rec = D.delivered[orderId];
  if (!rec) return { status: 'not_found' };
  if (rec.status !== 'delivered') return { status: rec.status };
  let consumed = false;
  const take = (have, n) => { if (have < n) consumed = true; return Math.max(0, have - n); };
  for (const e of rec.got) {
    if (e.tower) D.towers[e.tower].frag = take(D.towers[e.tower].frag, e.n);
    else if (e.pass) D.passes[e.pass] = (D.passes[e.pass] ?? dayNum()) - e.n;
    else if (e.label === '×3') D.flags.speed3 = false;
    else if (e.icon === 'ic_energy') D.stamina = take(D.stamina, e.n);
    else if (e.icon?.startsWith('part_')) { const k = e.icon.slice(5); D.parts[k] = take(D.parts[k], e.n); }
  }
  for (const it of rec.items) D.purchased[it.sku] = Math.max(0, (D.purchased[it.sku] || 0) - it.qty);
  D.vipPaid = Math.max(0, D.vipPaid - rec.total);
  rec.status = 'refunded';
  save.write();
  return { status: consumed ? 'consumed' : 'refunded' };
}
// 待繳費訂單過期：繳費期限過了就取消（不發貨），回傳剛過期的筆數
export function expireOrders(now = Date.now()) {
  let n = 0;
  for (const o of d().orders) if (o.status === 'pending' && now > Date.parse(o.payment.expiresAt)) { o.status = 'expired'; n++; }
  if (n) { trimOrders(); save.write(); }
  return n;
}
function trimOrders() { // 結案的訂單只留最近 20 筆
  const D = d(), done = D.orders.filter(o => o.status !== 'pending');
  if (done.length > 20) { const drop = new Set(done.slice(0, done.length - 20)); D.orders = D.orders.filter(o => !drop.has(o)); }
}
// 「購買的商品已到帳」：取出還沒跳過通知的到帳內容
export function takeArrivals() {
  const D = d(), out = [];
  for (const id of D.arrivals) for (const e of D.delivered[id]?.got || []) {
    const f = out.find(x => x.icon === e.icon && x.tower === e.tower && x.label === e.label && !e.pass);
    if (f) f.n += e.n; else out.push({ ...e });
  }
  D.arrivals = [];
  if (out.length) save.write();
  return out;
}

// ───── 每日任務 ─────
export function taskState() {
  const t = save.today();
  return TASKS.map(k => ({ ...k, have: Math.min(k.need, t[k.key] || 0), done: (t[k.key] || 0) >= k.need, claimed: t.claimed.includes(k.id) }));
}
export function claimTask(id) {
  const st = taskState().find(k => k.id === id);
  if (!st || !st.done || st.claimed) return null;
  save.today().claimed.push(id);
  save.addSeasonExp(st.exp);
  const got = grant(st.give);
  save.write();
  return got;
}
export const allTasksClaimed = () => taskState().every(k => k.claimed);
export function claimTaskBonus() {
  const t = save.today();
  if (t.allClaimed || !allTasksClaimed()) return null;
  t.allClaimed = true;
  save.addSeasonExp(TASK_ALL.exp);
  const got = grant(TASK_ALL.give);
  save.write();
  return got;
}
export const tasksClaimable = () => taskState().some(k => k.done && !k.claimed) || (allTasksClaimed() && !save.today().allClaimed);

// ───── 七日簽到 ─────
export const signinIndex = () => d().signin.count % SIGNIN.length;
export const signinReady = () => d().signin.last !== periodKey('day');
export function claimSignin() {
  if (!signinReady()) return null;
  const i = signinIndex();
  d().signin = { count: d().signin.count + 1, last: periodKey('day') };
  const got = grant(SIGNIN[i].give);
  save.write();
  return got;
}

// ───── 通行證 ─────
export function passClaimable(lv, track) {
  const s = save.season();
  if (lv > save.seasonLevel()) return false;
  if (track === 'premium' && !s.hasPremium) return false;
  return !s[track].includes(lv);
}
export function claimPass(lv, track) {
  if (!passClaimable(lv, track)) return null;
  save.season()[track].push(lv);
  const got = grant(PASS[lv - 1][track]);
  save.write();
  return got;
}
export function claimPassAll() {
  const got = [];
  for (const p of PASS) for (const tr of ['free', 'premium']) if (passClaimable(p.lv, tr)) got.push(...claimPass(p.lv, tr));
  return got;
}
export const passAnyClaimable = () => PASS.some(p => passClaimable(p.lv, 'free') || passClaimable(p.lv, 'premium'));
// 解鎖高级通行證：用钻石（钻石只能靠遊玩取得；平台規格不建議用真錢賣「先付錢、之後慢慢領」的通行證）
export function buyPass() {
  const s = save.season();
  if (s.hasPremium) return { why: 'limit' };
  if (d().diamonds < PASS_BUY.premium.gems) return { why: 'gems' };
  d().diamonds -= PASS_BUY.premium.gems;
  s.hasPremium = true;
  save.write();
  return { why: 'ok' };
}

export { VIP, GEM_ITEMS, PRODUCTS, CHESTS, STAMINA_BUY, DAILY_REFRESH_MAX, TASKS, SIGNIN, PASS, PASS_BUY, SEASON };
