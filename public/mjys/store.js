// 存檔（localStorage，key mjys_save）：讀取、版本遷移、体力回復、過關結算
// 之後接伺服器時，這份的資料結構直接當雲端存檔格式
import { CFG } from './cfg.js';
import { TOWERS } from './data/towers.js';
import { stageInfo, STAGE_COUNT, unlockStageOf } from './data/stages.js';
import { VIP } from './data/shop.js';
import { PRODUCTS } from './data/products.js';
import { SEASON } from './data/season.js';
import { CAPTAINS, CAPTAIN_LV } from './data/captains.js';
import { BUILDINGS, fortCost, VAULT } from './data/fortress.js';

const dayNo = (t = Date.now()) => Math.floor((t - new Date(t).getTimezoneOffset() * 60000) / 86400000);
const DAILY_KEYS = { workshop: 0, endless: 0, login: 1, mainBattles: 0, merges: 0, kills: 0, eventBattles: 0, staminaUsed: 0 };

const KEY = 'mjys_save';
const VER = 1;
const START_TOWERS = ['crossbow', 'cannon', 'ice', 'poison', 'alchemy'];

function fresh() {
  const towers = {};
  for (const id in TOWERS) towers[id] = { owned: START_TOWERS.includes(id), lv: 1, star: 1, frag: 0 };
  return {
    ver: VER,
    created: Date.now(),
    coins: 500,
    diamonds: 50,
    stamina: CFG.stamina.max,
    staminaAt: Date.now(),          // 上次計算体力回復的時間
    stars: {},                      // { 關號: 0~3 }
    cleared: 0,                     // 已通過的最高關號
    towers,
    deck: [...CFG.defaultDeck],
    parts: { bolt: 0, barrel: 0, crystal: 0, rune: 0, universal: 0 }, // 弩机／炮管／魔晶／符文／万能零件
    captain: { id: 'lia', lv: 1 },
    story: {},                      // 看過的劇情 { id: true }
    daily: { date: '', workshop: 0, endless: 0 }, // 今天用掉的活動次數（換日歸零）
    endlessBest: 0,                 // 無盡深淵最佳波數
    // 商店、平台直購（邏輯在 economy.js、platform.js；規格見 docs/09）
    vipPaid: 0,                     // 累計購買金額 NT$（決定 VIP 等級，發貨時累加）
    limits: {},                     // 週期限購計次 { 商品id或sku: { key: 期間, n } }
    cart: [],                       // 購物車 [{ sku, qty }]（遊戲方保存）
    orders: [],                     // 訂單（待繳費／已到帳／已逾期）[{ orderId, status, items, total, payment, createdAt }]
    delivered: {},                  // 已發貨紀錄 { orderId: { at, items, total, got, status } }：同一筆只發一次、退款時收回
    purchased: {},                  // 各 sku 累計買過幾個（limitPerAccount 用）
    passes: {},                     // 特權到期日 { monthly: 日序號（含當天） }
    arrivals: [],                   // 還沒跳過「商品已到帳」的 orderId
    shopDaily: null,                // 每日商店（每天換）
    staminaBuys: { key: '', n: 0 }, // 今天用钻石買体力幾次
    flags: { speed3: false },       // 永久解鎖：×3 加速
    signin: { count: 0, last: '' }, // 七日簽到：已領幾天、上次領的日期
    season: { id: -1, exp: 0, free: [], premium: [], hasPremium: false }, // 賽季通行證
    capts: { lia: { owned: true, lv: 1 }, borg: { owned: false, lv: 1 }, karl: { owned: false, lv: 1 }, elsa: { owned: false, lv: 1 } }, // 各隊長（出戰的是 captain.id）
    fort: { gate: 0, furnace: 0, workshop: 0, vault: 0, vaultAt: Date.now() }, // 要塞建築等級、寶庫上次領取時間
    seen: {},                       // 圖鑑：遇過的怪
    mapChests: {},                  // 地圖路邊寶箱開過的 { '章-第幾個': true }
    stats: { battles: 0, wins: 0, kills: 0 },
  };
}

// 舊版存檔補欄位（之後改結構就在這裡加一段）
function migrate(d) {
  const base = fresh();
  for (const k in base) if (d[k] === undefined) d[k] = base[k];
  for (const id in TOWERS) if (!d.towers[id]) d.towers[id] = base.towers[id];
  // 平台規格：月卡週卡改成特權（舊存檔剩下的天數照算）；儲值首充、成長基金拿掉
  if (d.cards) {
    if (d.cards.month?.until >= dayNo()) d.passes.monthly = Math.max(d.passes.monthly || 0, d.cards.month.until);
    if (d.cards.week?.until >= dayNo()) d.passes.weekly = Math.max(d.passes.weekly || 0, d.cards.week.until);
    delete d.cards;
  }
  delete d.firstCharge; delete d.fund;
  // 後來才加的塔：已經破過解鎖關的舊存檔直接補給
  for (const id in TOWERS) { const n = unlockStageOf(id); if (n && d.cleared >= n) d.towers[id].owned = true; }
  d.ver = VER;
  return d;
}

let data = null;

export const save = {
  get d() { if (!data) this.load(); return data; },
  load() {
    try {
      const raw = localStorage.getItem(KEY);
      data = raw ? migrate(JSON.parse(raw)) : fresh();
    } catch (e) { data = fresh(); }
    this.regen();
    return data;
  },
  write() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* 無痕模式存不了就算了 */ }
  },
  reset() { data = fresh(); this.write(); },

  // ───── 体力：每 5 分鐘回 1（離線也算） ─────
  regen() {
    const d = data, now = Date.now(), per = CFG.stamina.regenSec * 1000;
    if (d.stamina >= CFG.stamina.max) { d.staminaAt = now; return; }
    const n = Math.floor((now - d.staminaAt) / per);
    if (n > 0) {
      d.stamina = Math.min(CFG.stamina.max, d.stamina + n);
      d.staminaAt = d.stamina >= CFG.stamina.max ? now : d.staminaAt + n * per;
      this.write();
    }
  },
  // 距離下一點体力還有幾秒（滿了回傳 0）
  staminaNext() {
    const d = this.d;
    if (d.stamina >= CFG.stamina.max) return 0;
    return Math.max(0, Math.ceil((d.staminaAt + CFG.stamina.regenSec * 1000 - Date.now()) / 1000));
  },
  useStamina(n) {
    this.regen();
    const d = this.d;
    if (d.stamina < n) return false;
    if (d.stamina >= CFG.stamina.max) d.staminaAt = Date.now(); // 從滿的狀態開始算回復
    d.stamina -= n;
    this.track('staminaUsed', n);
    this.write();
    return true;
  },

  // ───── 關卡 ─────
  currentStage() { return Math.min(STAGE_COUNT, this.d.cleared + 1); },
  isUnlocked(n) { return n <= this.d.cleared + 1; },
  starsOf(n) { return this.d.stars[n] || 0; },
  totalStars() { return Object.values(this.d.stars).reduce((a, b) => a + b, 0); },

  // 過關／失敗結算：回傳 { first, coins, diamonds, frags: [{id, n}], unlocked: [塔id] }
  finishStage(r) {
    const d = this.d, info = stageInfo(r.stage);
    d.stats.battles++;
    d.stats.kills += r.kills;
    this.track('mainBattles', 1); this.track('kills', r.kills); this.track('merges', r.merges || 0);
    for (const t of r.seen || []) d.seen[t] = true;
    if (r.win) this.addSeasonExp(SEASON.winExp);
    const out = { first: false, coins: 0, diamonds: 0, frags: [], unlocked: [] };
    if (!r.win) { this.write(); return out; }
    d.stats.wins++;
    out.first = r.stage > d.cleared;
    const R = CFG.rewards;
    out.coins = out.first ? R.coinsPerStage * r.stage : Math.round(R.coinsPerStage * r.stage * R.repeatCoinMul);
    out.coins = Math.round(out.coins * (1 + this.perk('coinBonus'))); // 月卡／周卡特權
    out.diamonds = out.first ? R.firstDiamonds : 0;
    out.frags.push({ id: info.fragTower, n: out.first ? R.firstFrags : R.repeatFrags });
    if (out.first) { // 另外送卡組裡隨機一座塔的碎片
      const extra = d.deck[Math.floor(Math.random() * d.deck.length)];
      out.frags.push({ id: extra, n: R.firstExtraFrags });
    }
    d.coins += out.coins;
    d.diamonds += out.diamonds;
    for (const f of out.frags) d.towers[f.id].frag += f.n;
    d.stars[r.stage] = Math.max(d.stars[r.stage] || 0, r.stars);
    if (out.first) {
      d.cleared = r.stage;
      for (const id of info.unlocks) if (!d.towers[id].owned) { d.towers[id].owned = true; out.unlocked.push(id); }
      for (const [cid, c] of Object.entries(CAPTAINS)) { // 通關解鎖隊長（博格：第 15 關）
        if (c.unlock.type === 'stage' && r.stage >= c.unlock.n && !d.capts[cid].owned) { d.capts[cid].owned = true; out.newCaptain = cid; }
      }
    }
    this.write();
    return out;
  },

  // ───── 塔：升級、換卡組 ─────
  upgradeCost(id) { const lv = this.d.towers[id].lv; return { coins: CFG.meta.coins(lv), frags: CFG.meta.frags(lv) }; },
  // 回傳 'ok' / 'max' / 'frags' / 'coins' / 'locked'
  canUpgrade(id) {
    const t = this.d.towers[id], c = this.upgradeCost(id);
    if (!t.owned) return 'locked';
    if (t.lv >= CFG.meta.maxLv) return 'max';
    if (t.frag < c.frags) return 'frags';
    if (this.d.coins < c.coins) return 'coins';
    return 'ok';
  },
  upgrade(id) {
    const why = this.canUpgrade(id);
    if (why !== 'ok') return why;
    const t = this.d.towers[id], c = this.upgradeCost(id);
    t.frag -= c.frags;
    this.d.coins -= c.coins;
    t.lv++;
    this.write();
    return 'ok';
  },
  // 把 id 放到卡組第 slot 格；它原本就在卡組裡的話兩格互換
  setDeck(slot, id) {
    const deck = this.d.deck, old = deck.indexOf(id);
    if (!this.d.towers[id].owned) return false;
    if (old >= 0) [deck[old], deck[slot]] = [deck[slot], deck[old]];
    else deck[slot] = id;
    this.write();
    return true;
  },
  markStory(id) { this.d.story[id] = true; this.write(); },

  // ───── 升星：吃零件（不夠用万能零件補） ─────
  partOf(id) { return CFG.parts.towerPart[id]; },
  starCost(id) { const st = this.d.towers[id].star; return st >= CFG.parts.maxStar ? null : CFG.parts.starCost[st]; },
  // 回傳 'ok' / 'max' / 'parts' / 'locked'；plan＝實際要扣的 { part, n, uni }
  canStar(id) {
    const t = this.d.towers[id];
    if (!t.owned) return { why: 'locked' };
    const c = this.starCost(id);
    if (!c) return { why: 'max' };
    const P = this.d.parts, part = this.partOf(id);
    const fromPart = Math.min(P[part], c.n), short = c.n - fromPart;
    const uni = c.u + short;
    if (P.universal < uni) return { why: 'parts', part, need: c.n, needUni: c.u };
    return { why: 'ok', part, n: fromPart, uni, need: c.n, needUni: c.u };
  },
  starUp(id) {
    const r = this.canStar(id);
    if (r.why !== 'ok') return r.why;
    this.d.parts[r.part] -= r.n;
    this.d.parts.universal -= r.uni;
    this.d.towers[id].star++;
    this.write();
    return 'ok';
  },

  // ───── 活動：每日次數、結算 ─────
  today() {
    const d = new Date();
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (this.d.daily.date !== key) { this.d.daily = { date: key, ...DAILY_KEYS, claimed: [], allClaimed: false }; this.write(); }
    for (const k in DAILY_KEYS) if (this.d.daily[k] === undefined) this.d.daily[k] = DAILY_KEYS[k]; // 舊存檔補欄位
    if (!this.d.daily.claimed) this.d.daily.claimed = [];
    return this.d.daily;
  },
  // 特權剩幾天（0＝沒有）
  passDays(id) { const u = this.d.passes[id]; return u != null && u >= dayNo() ? u - dayNo() + 1 : 0; },
  // 加成＝VIP 等級＋生效中的特權（月卡、周卡）
  perk(k) {
    let v = VIP[0];
    for (const x of VIP) if (this.d.vipPaid >= x.need) v = x;
    let n = v[k] || 0;
    for (const p of PRODUCTS) if (p.kind === 'pass' && p.perks?.[k] && this.passDays(p.pass)) n += p.perks[k];
    return n;
  },
  vipBonus(k) { return this.perk(k); },
  triesLeft(mode) { return Math.max(0, this.triesMax(mode) - this.today()[mode]); },
  triesMax(mode) { return CFG.events[mode].tries + this.vipBonus(mode) + (mode === 'workshop' ? this.d.fort.workshop : 0); },
  useTry(mode) {
    if (this.triesLeft(mode) <= 0) return false;
    this.today()[mode]++;
    this.write();
    return true;
  },
  // 每日任務計數
  track(key, n) { const t = this.today(); t[key] = (t[key] || 0) + n; },

  // ───── 賽季 ─────
  seasonId() { return Math.floor(dayNo() / SEASON.days); },
  season() {
    const s = this.d.season, id = this.seasonId();
    if (s.id !== id) this.d.season = { id, exp: 0, free: [], premium: [], hasPremium: false };
    return this.d.season;
  },
  // 第幾季：從建立存檔那一季算第 1 季（正式版改成全服統一）
  seasonNo() { return this.seasonId() - Math.floor(dayNo(this.d.created) / SEASON.days) + 1; },
  seasonLevel() { return Math.min(SEASON.levels, 1 + Math.floor(this.season().exp / SEASON.expPerLv)); },
  seasonDaysLeft() { return SEASON.days - (dayNo() - this.seasonId() * SEASON.days); },
  addSeasonExp(n) { this.season().exp = Math.min(SEASON.levels * SEASON.expPerLv, this.season().exp + n); },

  todayPart() { return CFG.events.workshop.weekday[new Date().getDay()]; },
  // 回傳 { parts: [{id, n}], coins, record }
  finishEvent(r) {
    const d = this.d, out = { parts: [], coins: 0, record: false };
    d.stats.battles++;
    d.stats.kills += r.kills;
    this.track('eventBattles', 1); this.track('kills', r.kills); this.track('merges', r.merges || 0);
    for (const t of r.seen || []) d.seen[t] = true;
    this.addSeasonExp(SEASON.eventExp);
    const add = (id, n) => { if (n > 0) { d.parts[id] += n; out.parts.push({ id, n }); } };
    if (r.mode === 'workshop') {
      const L = CFG.events.workshop.levels[r.level], part = this.todayPart();
      // 過關拿全部；沒過依撐過的波數給一部分
      const n = r.win ? L.reward : Math.floor(L.reward * 0.6 * r.waves / CFG.events.workshop.waves);
      add(part, n);
      if (part === 'rune') add('universal', Math.ceil(n / 10)); // 星期日多送万能零件
    } else if (r.mode === 'endless') {
      const E = CFG.events.endless, w = r.waves;
      out.coins = E.coinsPerWave * w;
      d.coins += out.coins;
      const types = CFG.parts.types, got = {};
      for (let i = 0; i < w * E.partsPerWave; i++) { const t = types[Math.floor(Math.random() * types.length)]; got[t] = (got[t] || 0) + 1; }
      for (const t of types) add(t, got[t] || 0);
      add('universal', Math.floor(w / E.universalEvery));
      if (w > d.endlessBest) { d.endlessBest = w; out.record = true; }
    }
    this.write();
    return out;
  },

  // ───── 隊長 ─────
  captainId() { return this.d.captain.id; },
  captainLv(id = this.d.captain.id) { return this.d.capts[id].lv; },
  selectCaptain(id) { if (!this.d.capts[id].owned) return false; this.d.captain.id = id; this.d.captain.lv = this.d.capts[id].lv; this.write(); return true; },
  // 回傳 'ok' / 'max' / 'coins' / 'locked'
  captainUp(id) {
    const c = this.d.capts[id];
    if (!c.owned) return 'locked';
    if (c.lv >= CAPTAIN_LV.max) return 'max';
    const cost = CAPTAIN_LV.coins(c.lv);
    if (this.d.coins < cost) return 'coins';
    this.d.coins -= cost; c.lv++;
    if (this.d.captain.id === id) this.d.captain.lv = c.lv;
    this.write();
    return 'ok';
  },
  buyCaptain(id) {
    const u = CAPTAINS[id].unlock;
    if (u.type !== 'gems' || this.d.capts[id].owned) return 'no';
    if (this.d.diamonds < u.price) return 'gems';
    this.d.diamonds -= u.price; this.d.capts[id].owned = true; this.write();
    return 'ok';
  },

  // ───── 要塞 ─────
  fortLv(k) { return this.d.fort[k] || 0; },
  // 回傳 'ok' / 'max' / 'coins' / 'stars'
  fortCheck(k) {
    const lv = this.fortLv(k);
    if (lv >= BUILDINGS[k].max) return 'max';
    const c = fortCost(lv + 1);
    if (this.totalStars() < c.stars) return 'stars';
    if (this.d.coins < c.coins) return 'coins';
    return 'ok';
  },
  fortUp(k) {
    const why = this.fortCheck(k);
    if (why !== 'ok') return why;
    if (k === 'vault') this.claimVault(); // 升級前先把累積的領掉
    this.d.coins -= fortCost(this.fortLv(k) + 1).coins;
    this.d.fort[k] = this.fortLv(k) + 1;
    this.write();
    return 'ok';
  },
  vaultPending() {
    const lv = this.fortLv('vault');
    if (!lv) return 0;
    const hours = Math.min(VAULT.capHours, (Date.now() - this.d.fort.vaultAt) / 3600000);
    return Math.floor(hours * VAULT.perHour * lv);
  },
  claimVault() {
    const n = this.vaultPending();
    this.d.fort.vaultAt = Date.now();
    this.d.coins += n;
    this.write();
    return n;
  },
  battleBonus() { return { gateBonus: this.fortLv('gate') * 2, manaBonus: this.fortLv('furnace') * 10, captain: this.d.captain.id }; },

  // ───── 戰力：卡組 5 座塔的局外等級×星級×隊長等級加成 ─────
  towerMul(id) {
    const t = this.d.towers[id];
    return (1 + CFG.meta.atkPerLv * (t.lv - 1)) * (1 + CFG.parts.starMul * (t.star - 1)) * (1 + CAPTAIN_LV.atkPerLv * (this.captainLv() - 1));
  },
  towerMuls() { const m = {}; for (const id in TOWERS) m[id] = this.towerMul(id); return m; },
  towerStars() { const m = {}; for (const id in TOWERS) m[id] = this.d.towers[id].star; return m; },
  power() { return Math.round(this.d.deck.reduce((a, id) => a + 100 * this.towerMul(id), 0)); },
};

export { STAGE_COUNT };
