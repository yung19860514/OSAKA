// 商店：每日商店／钻石商店／礼包／宝箱道具／特权（VIP＋月卡周卡）
// 真錢商品走平台直購（D:\dev\遊戲串接規格.md，platform.js）：加入購物車 → 結帳 → 7-ELEVEN 繳費 → 平台發貨通知 → 到帳
// 钻石不能用錢買，只能靠遊玩取得
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { RARITY } from '../data/towers.js';
import { CHESTS } from '../data/shop.js';
import { PRODUCTS, productOf } from '../data/products.js';
import { save } from '../store.js';
import * as E from '../economy.js';
import * as P from '../platform.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, panel, bar, OUT } from '../ui/widgets.js';
import { resourceBar, backButton, toast, showRewards, rewardIcon, overlay, fixUI } from '../ui/common.js';

const TABS = ['daily', 'gems', 'packs', 'items', 'vip'];
const KIND_COLOR = { bundle: [0xd9a020, 0x5a2a1a], pack: [0x3f8cff, 0x1a2a5a], pass: [0xb05cff, 0x3a1a5a], item: [0x4cc93a, 0x1a3a22] };
const pad2 = n => String(n).padStart(2, '0');
const fmtTime = iso => { const t = new Date(iso); return `${pad2(t.getMonth() + 1)}/${pad2(t.getDate())} ${pad2(t.getHours())}:${pad2(t.getMinutes())}`; };

export class ShopScene extends Phaser.Scene {
  constructor() { super('Shop'); }

  init(data) {
    this.tab = data.tab || 'daily';
    this.from = data.from || this.from || 'Home';
    this.openCart = data.openCart;
    this.openOrder = data.openOrder;
    this.openOrders = data.openOrders;
  }

  create() {
    const bgKey = this.textures.exists('bg_shop') ? 'bg_shop' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x12061c, 0.5).setOrigin(0);
    backButton(this, () => this.scene.start(this.from === 'Shop' ? 'Home' : this.from));
    this.res = resourceBar(this);
    TABS.forEach((t, i) => {
      const on = t === this.tab, x = 120 + i * 210;
      const b = button(this, x, 220, 196, on ? 100 : 86, S.shopTabs[i], { color: on ? 'yellow' : 'red', size: on ? 40 : 34, onClick: () => { if (!on) this.go({ tab: t }); } });
      if (on) b.setScale(1.04);
    });
    this.topRow();
    ({ daily: () => this.daily(), gems: () => this.gems(), packs: () => this.packs(), items: () => this.items(), vip: () => this.vipTab() })[this.tab]();
    if (this.openCart) this.cartView();
    else if (this.openOrder) this.orderView(this.openOrder);
    else if (this.openOrders) this.ordersView();
    // 到帳通知、逾期訂單（live 模式會問伺服器）
    P.syncOrders().then(r => {
      if (!this.sys.isActive()) return;
      if (r.expired) toast(this, S.orderExpired, 540, 900, 'red', 40);
      this.showArrivals();
    });
  }

  go(data) { this.scene.restart({ tab: this.tab, ...data }); }
  refreshAll() { this.go({}); }

  fail(why) {
    const msg = { gems: S.notEnoughGems, coins: S.notEnoughCoins, limit: S.limitReached }[why] || why;
    toast(this, msg, 540, 960, 'red', 48);
  }

  showArrivals(after) {
    const got = E.takeArrivals();
    if (got.length) showRewards(this, got, () => (after ? after() : this.refreshAll()), S.arrived);
    else after?.();
  }

  // 購物車按鈕（右）、待繳費訂單（左）：每個分頁都有
  topRow() {
    const n = E.cartCount();
    const cb = button(this, 935, 330, 230, 84, S.cart, { color: 'blue', size: 36, onClick: () => this.cartView() });
    if (n) {
      const g = this.add.graphics();
      g.fillStyle(OUT).fillCircle(98, -36, 27);
      g.fillStyle(0xe8453a).fillCircle(98, -36, 23);
      cb.add([g, qText(this, 98, -37, String(n), { size: 28, font: FONT_NUM })]);
    }
    const pend = E.pendingOrders().length;
    if (pend) {
      const pb = button(this, 215, 330, 370, 84, S.pendingN(pend), { color: 'purple', size: 32, onClick: () => this.ordersView() });
      this.tweens.add({ targets: pb, scale: 1.04, duration: 600, yoyo: true, repeat: -1 });
    }
  }

  // 一張商品卡（鑽石／金幣商品）
  card(x, y, w, h, o) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(OUT).fillRoundedRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 14, 24);
    g.fillStyle(o.rim || 0xc87a3a).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
    g.fillStyle(o.fill || 0x4a2a1a).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 16);
    g.fillStyle(0xffffff, 0.07).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, (h - 12) * 0.45, { tl: 16, tr: 16, bl: 4, br: 4 });
    c.add(g);
    const iconY = o.iconY ?? -h / 2 + 105;
    if (o.entry) c.add(rewardIcon(this, 0, iconY, o.entry, o.iconH || 110));
    c.add(qText(this, 0, -h / 2 + 30, o.title, { size: o.titleSize || 32, wrap: w - 30 }));
    if (o.limitText) c.add(qText(this, 0, h / 2 - (o.maxQty > 1 ? 168 : 118), o.limitText, { size: 24, font: FONT_BODY, style: 'gold' }));
    if (o.sold) {
      c.add(this.add.rectangle(0, 0, w, h, 0x000000, 0.55));
      c.add(qText(this, 0, 0, S.soldOut, { size: 50, style: 'red' }).setAngle(-12));
      return c;
    }
    let qty = () => 1;
    const btn = button(this, 0, h / 2 - 50, w - 50, 80, '', { color: o.btnColor || 'green', onClick: () => o.onBuy(qty()) });
    let priceT = null;
    if (o.priceIcon) {
      btn.add(this.add.image(-30, -2, o.priceIcon).setScale(0.62));
      btn.add(priceT = qText(this, -4, -4, String(o.price), { size: 38, font: FONT_NUM, origin: [0, 0.5] }));
    } else btn.add(qText(this, 0, -4, o.priceText, { size: 36 }));
    c.add(btn);
    if (o.maxQty > 1 && priceT) { // 選數量：中間顯示 ×n，按鈕上是總價
      const qT = qText(this, 0, h / 2 - 122, '×1', { size: 38, font: FONT_NUM });
      c.add(qT);
      qty = this.stepper(c, h / 2 - 122, w, o.maxQty, n => { qT.setText('×' + n); priceT.setText(String(o.price * n)); });
    }
    return c;
  }

  // 數量選擇：卡片裡一排「－ 中間 ＋」，回傳目前數量的函式；onChange(n) 讓卡片更新價格與按鈕
  stepper(c, y, w, max, onChange) {
    let n = 1;
    const set = v => { n = Math.max(1, Math.min(max, v)); minus.setEnabled(n > 1); plus.setEnabled(n < max); onChange(n); };
    const minus = button(this, -w / 2 + 46, y, 60, 54, '-', { color: 'red', size: 36, onClick: () => set(n - 1) });
    const plus = button(this, w / 2 - 46, y, 60, 54, '+', { color: 'green', size: 36, onClick: () => set(n + 1) });
    c.add([minus, plus]);
    set(1);
    return () => n;
  }

  limitText(limit, left) {
    if (!limit) return '';
    const f = { day: S.limitDay, week: S.limitWeek, month: S.limitMonth }[limit.period];
    return f ? f(`${left}/${limit.max}`) : S.limitOnce;
  }

  // ───── 平台直購商品卡：名稱、圖、內容、限購／效期、NT$ 價格、加入購物車 ─────
  productCard(x, y, w, h, p) {
    const [rim, fill] = KIND_COLOR[p.kind];
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(OUT).fillRoundedRect(-w / 2 - 5, -h / 2 - 5, w + 10, h + 14, 24);
    g.fillStyle(rim).fillRoundedRect(-w / 2, -h / 2, w, h, 20);
    g.fillStyle(fill).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 16);
    g.fillStyle(0xffffff, 0.07).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, (h - 12) * 0.4, { tl: 16, tr: 16, bl: 4, br: 4 });
    c.add(g);
    c.add(qText(this, 0, -h / 2 + 34, p.name, { size: 32, wrap: w - 30 }));
    c.add(rewardIcon(this, 0, -h / 2 + 110, { icon: p.icon }, 88));
    c.add(qText(this, 0, -h / 2 + 172, p.desc, { size: 23, font: FONT_BODY, wrap: w - 36 }).setOrigin(0.5, 0));
    // 限購／效期／已加入
    const tags = [];
    if (p.kind === 'pass') { const d = save.passDays(p.pass); if (d) tags.push(S.passLeft(d)); }
    if (p.limitPerAccount) tags.push(S.limitAccount(p.limitPerAccount));
    if (p.period) tags.push(this.limitText(p.period, E.limitLeft(p.sku, p.period)));
    if (E.cartQty(p.sku)) tags.push(S.inCart(E.cartQty(p.sku)));
    if (tags.length) c.add(qText(this, 0, h / 2 - 132, tags.join('  '), { size: 22, font: FONT_BODY, style: 'gold', wrap: w - 20 }).setOrigin(0.5, 1));
    if (p.kind === 'pack') { // 機率說明（規格 7.2）
      const t = qText(this, 0, h / 2 - 150 - (tags.length ? 30 : 0), S.odds, { size: 24, font: FONT_BODY, style: 'blue' });
      t.setInteractive({ useHandCursor: true }).on('pointerup', () => this.oddsView(p));
      c.add(t);
    }
    const unit = P.priceOf(p.sku), left = E.addLeft(p);
    const priceT = qText(this, 0, h / 2 - 104, S.ntd(unit), { size: 40, font: FONT_NUM, style: 'gold' });
    c.add(priceT);
    let qty = () => 1;
    const btn = button(this, 0, h / 2 - 44, w - 50, 70, left > 0 ? S.addCart : E.owned(p) ? S.owned : S.limitReached, {
      color: 'green', size: 32,
      onClick: () => {
        if (E.addToCart(p.sku, qty()) !== 'ok') { this.fail('limit'); return; }
        toast(this, S.addedCart, 540, 900, 'gold', 44);
        this.time.delayedCall(350, () => this.refreshAll());
      },
    });
    btn.setEnabled(left > 0);
    c.add(btn);
    if (left > 1) qty = this.stepper(c, h / 2 - 104, w, left, n => { priceT.setText(S.ntd(unit * n)); btn.setLabel(n > 1 ? S.addCartN(n) : S.addCart); });
    if (p.badge) {
      const bg = this.add.graphics();
      bg.fillStyle(OUT).fillRoundedRect(-w / 2 - 10, -h / 2 - 14, 120, 50, 14);
      bg.fillStyle(0xe8453a).fillRoundedRect(-w / 2 - 6, -h / 2 - 10, 112, 42, 11);
      c.add([bg, qText(this, -w / 2 + 50, -h / 2 + 11, p.badge, { size: 26 })]);
    }
    return c;
  }

  // ───── 每日商店 ─────
  daily() {
    const s = E.dailyShop();
    qText(this, 540, 330, S.dailyShop, { size: 44, style: 'gold' });
    s.items.forEach((it, i) => {
      const x = 190 + (i % 3) * 350, y = 660 + Math.floor(i / 3) * 470;
      const entry = it.tower ? { tower: it.tower, n: it.n } : { icon: it.icon, n: 1 };
      this.card(x, y, 320, 430, {
        title: it.name, entry, iconH: 130, sold: s.bought.includes(i),
        priceIcon: it.free ? null : it.price ? 'ic_gem' : 'ic_coin', price: it.price || it.coins, priceText: S.free,
        btnColor: it.free ? 'yellow' : 'green',
        onBuy: () => {
          const r = E.buyDaily(i);
          if (r.why !== 'ok') { this.fail(r.why); return; }
          showRewards(this, r.got, () => this.refreshAll());
        },
      });
    });
    const cost = E.refreshCost();
    qText(this, 540, 1640, S.refreshIn, { size: 30, font: FONT_BODY }).setAlpha(0.8);
    const rb = button(this, 540, 1760, 340, 110, '', {
      color: cost == null ? 'grey' : 'blue',
      onClick: () => { const r = E.refreshDaily(); if (r.why !== 'ok') { this.fail(r.why); return; } this.refreshAll(); },
    });
    if (cost) { rb.add(qText(this, -40, -4, S.refresh, { size: 40 })); rb.add(this.add.image(50, -2, 'ic_gem').setScale(0.55)); rb.add(qText(this, 72, -4, String(cost), { size: 34, font: FONT_NUM, origin: [0, 0.5] })); }
    else rb.add(qText(this, 0, -4, cost === 0 ? S.refresh + '（' + S.free + '）' : S.limitReached, { size: 36 }));
  }

  // ───── 钻石商店（钻石只能靠遊玩取得） ─────
  gems() {
    E.GEM_ITEMS.forEach((it, i) => {
      const x = 190 + (i % 3) * 350, y = 620 + Math.floor(i / 3) * 450;
      const left = E.limitLeft(it.id, it.limit);
      this.card(x, y, 320, 420, {
        title: it.name, entry: { icon: it.icon, n: 1 }, iconH: 120, sold: left <= 0 || (it.give?.speed3 && save.d.flags.speed3),
        limitText: this.limitText(it.limit, left), priceIcon: 'ic_gem', price: it.price,
        maxQty: it.give?.speed3 ? 1 : Math.min(left, 20),
        onBuy: n => {
          const r = E.buyGemItem(it, n);
          if (r.why !== 'ok') { this.fail(r.why); return; }
          showRewards(this, r.got, () => this.refreshAll());
        },
      });
    });
    qText(this, 540, 1800, S.gemsHow, { size: 28, font: FONT_BODY }).setAlpha(0.85);
  }

  // ───── 礼包（組合包） ─────
  packs() {
    const list = P.listed(PRODUCTS.filter(p => p.kind === 'bundle'));
    list.forEach((p, i) => {
      const x = 285 + (i % 2) * 510, y = 640 + Math.floor(i / 2) * 450;
      this.productCard(x, y, 480, 420, p);
    });
    qText(this, 540, 1840, S.buyNote, { size: 24, font: FONT_BODY, wrap: 980 }).setAlpha(0.85);
  }

  // ───── 宝箱（卡包）＋道具 ─────
  items() {
    const list = P.listed(PRODUCTS.filter(p => p.kind === 'pack' || p.kind === 'item'));
    list.forEach((p, i) => {
      const x = 190 + (i % 3) * 350, y = 630 + Math.floor(i / 3) * 450;
      this.productCard(x, y, 320, 430, p);
    });
    qText(this, 540, 1840, S.buyNote, { size: 24, font: FONT_BODY, wrap: 980 }).setAlpha(0.85);
  }

  // ───── 特权：VIP（累計購買金額）＋月卡周卡特權 ─────
  vipTab() {
    const v = E.vip();
    panel(this, 540, 520, 1000, 230, { fill: 0x3a1a4a, rim: 0xffc13b });
    qText(this, 110, 470, S.vip(v.lv), { size: 70, style: 'gold', origin: [0, 0.5] });
    qText(this, 110, 545, S.vipPaid(v.paid), { size: 30, font: FONT_BODY, origin: [0, 0.5] });
    if (v.next) {
      const b = bar(this, 330, 452, 640, 34, 0xffc13b, { value: (v.paid - v.need) / (v.next.need - v.need) });
      qText(this, 650, 520, S.vipNext(v.next.need - v.paid, v.next.lv), { size: 28, font: FONT_BODY });
      b.setDepth(1);
    } else qText(this, 650, 480, S.vipMax, { size: 36, style: 'gold' });
    const perks = ks => Object.keys(S.perk).filter(k => ks[k]).map(k => S.perk[k](ks[k])).join('、');
    const now = {}; for (const k in S.perk) now[k] = save.perk(k);
    qText(this, 540, 690, `${S.vipNow}：${perks(now) || S.vipNone}`, { size: 28, font: FONT_BODY, wrap: 960 });
    if (v.next) qText(this, 540, 760, `${S.vipNextPerk(v.next.lv)}：${perks(v.next) || '-'}`, { size: 26, font: FONT_BODY, wrap: 960 }).setAlpha(0.8);
    P.listed(PRODUCTS.filter(p => p.kind === 'pass')).forEach((p, i) => this.productCard(285 + i * 510, 1110, 480, 460, p));
    qText(this, 540, 1400, S.passNote, { size: 28, font: FONT_BODY, style: 'gold' });
    qText(this, 540, 1840, S.buyNote, { size: 24, font: FONT_BODY, wrap: 980 }).setAlpha(0.85);
  }

  // ───── 購物車 ─────
  cartView() {
    const c = overlay(this, 0.7);
    c.add(panel(this, 540, 980, 980, 1520, { fill: 0x2a1a3a, kind: 'popup' }));
    c.add(qText(this, 540, 300, S.cart, { size: 64, style: 'gold' }));
    const lines = P.cartLines(), r = P.rules(), total = P.cartTotal(), prob = P.cartProblem();
    if (!lines.length) c.add(qText(this, 540, 800, S.cartEmpty, { size: 40, font: FONT_BODY }).setAlpha(0.8));
    else c.add(button(this, 880, 300, 150, 66, S.clearCart, { color: 'grey', size: 28, onClick: () => { E.clearCart(); c.destroy(); this.go({ openCart: true }); } }));
    const rowH = Math.min(118, 940 / Math.max(1, lines.length));
    lines.forEach((l, i) => {
      const y = 420 + i * rowH;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.25).fillRoundedRect(90, y - rowH / 2 + 6, 900, rowH - 12, 16);
      c.add(g);
      c.add(rewardIcon(this, 150, y, { icon: l.p.icon }, Math.min(80, rowH - 30)));
      c.add(qText(this, 205, y - 18, l.p.name, { size: 30, origin: [0, 0.5] }));
      c.add(qText(this, 205, y + 22, S.ntd(l.price), { size: 24, font: FONT_NUM, origin: [0, 0.5] }).setAlpha(0.85));
      const set = q => { E.setCartQty(l.sku, q); c.destroy(); this.go({ openCart: true }); };
      c.add(button(this, 610, y, 70, 66, '-', { color: 'red', size: 40, onClick: () => set(l.qty - 1) }));
      c.add(qText(this, 680, y, String(l.qty), { size: 40, font: FONT_NUM }));
      const plus = button(this, 750, y, 70, 66, '+', { color: 'green', size: 40, onClick: ok => { if (!ok) { this.fail('limit'); return; } set(l.qty + 1); }, clickDisabled: true });
      plus.setEnabled(E.addLeft(l.p) > 0);
      c.add(plus);
      c.add(qText(this, 960, y, S.ntd(l.price * l.qty), { size: 34, font: FONT_NUM, style: 'gold', origin: [1, 0.5] }));
    });
    c.add(qText(this, 540, 1430, `${S.total}  ${S.ntd(total)}`, { size: 56, font: FONT_NUM, style: 'gold' }));
    c.add(qText(this, 540, 1500, S.orderRule(r.min, r.max), { size: 26, font: FONT_BODY }));
    if (prob === 'min') c.add(qText(this, 540, 1550, S.cartMin(r.min), { size: 28, font: FONT_BODY, style: 'red' }));
    if (prob === 'max') c.add(qText(this, 540, 1550, S.cartMax(r.max), { size: 28, font: FONT_BODY, style: 'red' }));
    c.add(button(this, 330, 1650, 300, 110, S.keepShopping, { color: 'grey', size: 38, onClick: () => { c.destroy(); this.refreshAll(); } }));
    const ck = button(this, 750, 1650, 340, 110, S.checkout, { color: 'yellow', size: 46, onClick: () => { c.destroy(); this.checkoutView(); } });
    ck.setEnabled(!prob);
    c.add(ck);
    fixUI(c);
  }

  // ───── 結帳：live 跳到平台結帳頁；mock 在遊戲裡模擬平台結帳頁 ─────
  checkoutView() {
    // 【平台】正式結帳（黑貓PAY）接上前，結帳一律關閉，不產生模擬的繳費代碼
    if (P.CHECKOUT_CLOSED) { toast(this, '結帳功能即將開放', 540, 960, 'white', 40); return; }
    if (!P.isMock()) { P.checkout(); return; }
    const c = overlay(this, 0.8);
    const g = this.add.graphics(); // 平台頁面：白底，跟遊戲畫風分開，看得出是「平台」
    g.fillStyle(0xf4f1ea).fillRoundedRect(70, 260, 940, 1420, 28);
    g.fillStyle(0x2a5ab8).fillRoundedRect(70, 260, 940, 120, { tl: 28, tr: 28, bl: 0, br: 0 });
    c.add(g);
    c.add(qText(this, 540, 320, S.checkoutTitle, { size: 48 }));
    const lines = P.cartLines();
    let y = 450;
    for (const l of lines) {
      c.add(this.add.text(120, y, `${l.p.name} ×${l.qty}`, { fontFamily: FONT_BODY, fontSize: '32px', color: '#2a2a2a' }).setOrigin(0, 0.5));
      c.add(this.add.text(960, y, S.ntd(l.price * l.qty), { fontFamily: FONT_BODY, fontSize: '32px', color: '#2a2a2a' }).setOrigin(1, 0.5));
      y += Math.min(56, 620 / lines.length);
    }
    c.add(this.add.rectangle(540, 1110, 840, 3, 0xbbbbbb));
    c.add(this.add.text(120, 1170, S.total, { fontFamily: FONT_BODY, fontSize: '40px', color: '#2a2a2a' }).setOrigin(0, 0.5));
    c.add(this.add.text(960, 1170, S.ntd(P.cartTotal()), { fontFamily: FONT_BODY, fontSize: '48px', color: '#d0302a' }).setOrigin(1, 0.5));
    c.add(this.add.text(120, 1240, S.payStore, { fontFamily: FONT_BODY, fontSize: '28px', color: '#555555' }).setOrigin(0, 0.5));
    // 同意購買條款（勾選框）
    let agreed = false;
    const box = this.add.graphics();
    const drawBox = () => { box.clear(); box.lineStyle(4, 0x2a5ab8).strokeRoundedRect(110, 1300, 50, 50, 8); if (agreed) box.lineStyle(8, 0x2a5ab8).beginPath().moveTo(120, 1325).lineTo(132, 1340).lineTo(152, 1310).strokePath(); };
    drawBox();
    const terms = this.add.text(180, 1325, S.agreeTerms, { fontFamily: FONT_BODY, fontSize: '28px', color: '#2a2a2a', wordWrap: { width: 780, useAdvancedWrap: true } }).setOrigin(0, 0.5);
    const hit = this.add.rectangle(540, 1325, 900, 90, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => { agreed = !agreed; drawBox(); });
    c.add([box, terms, hit]);
    c.add(this.add.text(540, 1410, S.mockNote, { fontFamily: FONT_BODY, fontSize: '26px', color: '#d0302a' }).setOrigin(0.5));
    c.add(button(this, 330, 1560, 300, 110, S.cancel, { color: 'grey', size: 40, onClick: () => { c.destroy(); this.go({ openCart: true }); } }));
    c.add(button(this, 750, 1560, 340, 110, S.createOrder, {
      color: 'blue', size: 42,
      onClick: () => {
        if (!agreed) { toast(this, S.mustAgree, 540, 1230, 'red', 34); return; }
        const o = P.checkout();
        c.destroy();
        if (o) this.go({ openOrder: o.orderId });
      },
    }));
    fixUI(c);
  }

  // ───── 待繳費訂單：繳費代碼、條碼、金額、期限 ─────
  ordersView() {
    const list = E.pendingOrders();
    if (list.length === 1) { this.orderView(list[0].orderId); return; }
    const c = overlay(this, 0.7);
    c.add(panel(this, 540, 960, 900, 300 + list.length * 140, { fill: 0x2a1a3a, kind: 'popup' }));
    let y = 960 - (300 + list.length * 140) / 2 + 90;
    c.add(qText(this, 540, y, S.pendingTitle, { size: 56, style: 'gold' }));
    y += 120;
    for (const o of list) {
      c.add(button(this, 540, y, 760, 116, `${S.ntd(o.total)}  ·  ${fmtTime(o.payment.expiresAt)}`, { color: 'purple', size: 36, onClick: () => { c.destroy(); this.orderView(o.orderId); } }));
      y += 140;
    }
    c.dim.on('pointerup', () => c.destroy());
    fixUI(c);
  }

  orderView(orderId) {
    const o = save.d.orders.find(x => x.orderId === orderId);
    if (!o || o.status !== 'pending') return;
    const c = overlay(this, 0.75);
    c.add(panel(this, 540, 960, 940, 1460, { fill: 0x2a1a3a, kind: 'popup' }));
    c.add(qText(this, 540, 320, S.pendingTitle, { size: 60, style: 'gold' }));
    c.add(qText(this, 540, 400, S.payStore, { size: 32, font: FONT_BODY }));
    c.add(qText(this, 540, 470, `${S.payAmount}  ${S.ntd(o.total)}`, { size: 48, font: FONT_NUM, style: 'gold' }));
    c.add(qText(this, 540, 550, S.payCode, { size: 30, font: FONT_BODY }).setAlpha(0.8));
    c.add(qText(this, 540, 620, o.payment.code.replace(/(\d{4})(?=\d)/g, '$1 '), { size: 66, font: FONT_NUM }));
    // 條碼（mock 畫假的；正式版用平台的 barcodeUrl 條碼頁）
    const g = this.add.graphics();
    g.fillStyle(0xffffff).fillRoundedRect(190, 690, 700, 190, 12);
    let x = 220, seed = 0;
    for (const ch of o.payment.code + o.orderId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    while (x < 860) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const w = 2 + (seed >>> 28) % 4;
      if ((seed >>> 8) & 1) g.fillStyle(0x111111).fillRect(x, 710, w, 150);
      x += w + 2;
    }
    c.add(g);
    c.add(qText(this, 540, 930, S.payBy(fmtTime(o.payment.expiresAt)), { size: 28, font: FONT_BODY, style: 'gold', wrap: 820 }));
    c.add(qText(this, 540, 1010, S.payHow, { size: 26, font: FONT_BODY, wrap: 820 }).setAlpha(0.85));
    let y = 1100;
    const items = o.items.map(it => `${productOf(it.sku)?.name || it.sku} ×${it.qty}`).join('、');
    c.add(qText(this, 540, y, items, { size: 26, font: FONT_BODY, wrap: 820 }).setOrigin(0.5, 0));
    if (P.isMock()) {
      c.add(button(this, 540, 1440, 560, 110, S.mockPay, {
        color: 'purple', size: 38,
        onClick: () => {
          const r = P.mockPay(orderId);
          c.destroy();
          if (r?.code === 409) { toast(this, S.orderRejected, 540, 900, 'red', 40); this.time.delayedCall(800, () => this.refreshAll()); return; }
          this.showArrivals();
        },
      }));
    }
    c.add(button(this, 540, 1580, 400, 104, S.backToGame, { color: 'grey', size: 38, onClick: () => { c.destroy(); this.refreshAll(); } }));
    fixUI(c);
  }

  // ───── 卡包機率說明（規格 7.2；正式版另外連到平台的機率公開頁） ─────
  oddsView(p) {
    const C = CHESTS[p.odds], sum = C.weight.reduce((a, b) => a + b, 0);
    const lines = [S.oddsDraws(C.draws, C.each[0], C.each[1])];
    C.weight.forEach((w, r) => { if (w) lines.push(S.oddsLine(RARITY[r].name, +(w / sum * 100).toFixed(1))); });
    if (C.atLeast) lines.push(S.oddsFloor(RARITY[C.atLeast].name));
    lines.push(S.oddsOwned);
    const c = overlay(this, 0.7);
    const h = 360 + lines.length * 64;
    c.add(panel(this, 540, 960, 860, h, { fill: 0x1a2a4a, kind: 'popup' }));
    let y = 960 - h / 2 + 80;
    c.add(qText(this, 540, y, S.oddsTitle(CHESTS[p.odds].name), { size: 50, style: 'gold' }));
    y += 100;
    for (const l of lines) { c.add(qText(this, 540, y, l, { size: 30, font: FONT_BODY, wrap: 760 })); y += 64; }
    c.add(qText(this, 540, 960 + h / 2 - 60, S.tapClose, { size: 28, font: FONT_NUM }).setAlpha(0.8));
    c.dim.on('pointerup', () => c.destroy());
    fixUI(c);
  }
}
