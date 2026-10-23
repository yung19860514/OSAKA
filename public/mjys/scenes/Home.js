// 主頁（章節）：資源列、章節名、進度、戰力、卡組 5 座塔、开始战斗、選關、底部導航
import { W, H, CFG } from '../cfg.js';
import { S } from '../strings.js';
import { TOWERS } from '../data/towers.js';
import { STAGE_COUNT } from '../data/stages.js';
import { save } from '../store.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, panel, OUT, GOLD } from '../ui/widgets.js';
import { resourceBar, navBar, toast, startStage, DEPTH } from '../ui/common.js';
import { addTower, captainSprite } from '../ui/towerArt.js';
import * as E from '../economy.js';
import * as P from '../platform.js';
import { showRewards } from '../ui/common.js';
import { PER_CHAPTER, chapterOf } from '../data/stages.js';
import { ensureChapter } from '../ui/common.js';

export class HomeScene extends Phaser.Scene {
  constructor() { super('Home'); }

  create() {
    const d = save.d;
    const bgKey = this.textures.exists('bg_home') ? 'bg_home' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    const top = this.add.graphics();
    for (let i = 0; i < 12; i++) top.fillStyle(0x12061c, 0.6 - i * 0.05).fillRect(0, i * 16, W, 16);

    // 隊長頭像＋等級
    if (this.textures.exists('ui_topbar_3')) { const fr = this.add.image(84, 92, 'ui_topbar_3').setDepth(DEPTH.ui); fr.setScale(150 / fr.height); }
    const av = 'avatar_' + save.captainId();
    this.add.image(84, 86, this.textures.exists(av) ? av : 'avatar_lia').setScale(0.95).setDepth(DEPTH.ui);
    const lg = this.add.graphics().setDepth(DEPTH.ui);
    lg.fillStyle(OUT).fillRoundedRect(46, 128, 76, 36, 14);
    lg.fillStyle(0x4cc93a).fillRoundedRect(50, 131, 68, 28, 11);
    qText(this, 84, 145, 'Lv' + save.captainLv(), { size: 26, font: FONT_NUM }).setDepth(DEPTH.ui);
    this.res = resourceBar(this);

    // 章節橫幅
    const cur = save.currentStage(), C = chapterOf(cur), first = (C - 1) * PER_CHAPTER;
    if (this.textures.exists('txt_chapters_' + (C - 1))) { // 素材：章節名字圖
      const tt = this.add.image(540, 345, 'txt_chapters_' + (C - 1));
      tt.setScale(Math.min(250 / tt.height, 700 / tt.width));
      qText(this, 540, 215, S.chapterNo(C), { size: 48, style: 'white', font: FONT_BODY });
    } else if (this.textures.exists('ui_chapter_banner_0')) { // 素材：紅緞帶
      const bn = this.add.image(540, 360, 'ui_chapter_banner_0');
      bn.setScale(820 / bn.width);
      qText(this, 540, 262, S.chapterNo(C), { size: 42, style: 'white', font: FONT_BODY });
      qText(this, 540, 372, S.chapterName[C], { size: 88, style: 'gold', strokeW: 14 });
    } else {
      panel(this, 540, 345, 600, 170, { fill: 0x5a1f1a });
      qText(this, 540, 300, S.chapterNo(C), { size: 40, style: 'white', font: FONT_BODY });
      qText(this, 540, 368, S.chapterName[C], { size: 96, style: 'gold', strokeW: 14 });
    }
    let stars = 0;
    for (let k = 1; k <= PER_CHAPTER; k++) stars += save.starsOf(first + k);
    // 關卡、星數、戰力：一排三格，字放大
    const stat = (x, icon, text, style) => {
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.45).fillRoundedRect(x - 112, 505, 224, 76, 38);
      if (icon) this.add.image(x - 72, 543, icon).setScale(0.7);
      qText(this, icon ? x + 18 : x, 543, text, { size: 40, font: FONT_BODY, style: style || 'white' });
    };
    stat(300, null, S.stageProgress(Math.max(0, Math.min(d.cleared - first, PER_CHAPTER)), PER_CHAPTER));
    stat(540, 'ic_star', `${stars}/${PER_CHAPTER * 3}`);
    stat(780, null, `${S.power} ${save.power()}`, 'gold');

    // 中間：出戰隊長（有待機影片會動），點一下去隊長頁
    const cid = save.captainId();
    this.add.image(540, 1012, 'glow').setScale(5, 1.2).setTint(0x000000).setAlpha(0.45);
    const cap = captainSprite(this, cid, 540, 1020, 420);
    cap.setInteractive({ useHandCursor: true }).on('pointerup', () => this.scene.start('Captain'));

    // 卡組 5 座塔站在場上
    d.deck.forEach((id, k) => {
      const x = 152 + k * 194, y = 1170;
      this.add.image(x, y + 64, 'glow').setScale(2.6, 0.9).setTint(0x000000).setAlpha(0.35);
      const img = addTower(this, x, y - 10, id, 0, 235);
      this.tweens.add({ targets: img, y: y - 8, duration: 1300 + k * 120, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      const pg = this.add.graphics();
      pg.fillStyle(OUT).fillRoundedRect(x - 82, y + 92, 164, 66, 16);
      pg.fillStyle(0x2a120c, 0.95).fillRoundedRect(x - 78, y + 95, 156, 60, 13);
      qText(this, x, y + 112, TOWERS[id].name, { size: 30 });
      qText(this, x, y + 140, S.lv(d.towers[id].lv), { size: 24, font: FONT_NUM, style: 'gold' });
    });

    // 開始戰斗（打目前這關）、選關
    const start = button(this, 560, 1545, 470, 170, '', { color: 'yellow', onClick: () => this.start(cur) });
    start.add(qText(this, 0, -26, S.startBattle, { size: 66 }));
    start.add(this.add.image(-60, 40, 'ic_energy').setScale(0.6));
    start.add(qText(this, -30, 40, `×${CFG.stamina.cost}`, { size: 38, font: FONT_NUM, origin: [0, 0.5] }));
    start.add(qText(this, 60, 40, S.stageTitle(cur), { size: 30, font: FONT_BODY, origin: [0, 0.5] }));
    this.tweens.add({ targets: start, scale: 1.04, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.roundBtn(160, 1545, S.selectStage, () => ensureChapter(this, C, () => this.scene.start('StageMap', { ch: C })));

    this.sideBtn(985, 430, 'side_event', S.eventTitle, () => this.scene.start('Event'), save.triesLeft('workshop') + save.triesLeft('endless') > 0);
    const shopDot = !E.dailyShop().bought.includes(0);
    this.sideBtn(985, 580, 'side_shop', S.shop, () => this.scene.start('Shop', { from: 'Home' }), shopDot);
    this.sideBtn(985, 730, 'ic_gift', S.shopTabs[2], () => this.scene.start('Shop', { tab: 'packs', from: 'Home' }), E.pendingOrders().length > 0);
    // 左側：簽到、任務、賽季（有可領的亮紅點）
    this.sideBtn(95, 430, 'side_signin', S.signinTitle, () => this.scene.start('Tasks', { tab: 'signin' }), E.signinReady());
    this.sideBtn(95, 580, 'side_tasks', S.tasksTitle, () => this.scene.start('Tasks', { tab: 'tasks' }), E.tasksClaimable());
    this.sideBtn(95, 730, 'side_season', S.seasonTitle, () => this.scene.start('Season'), E.passAnyClaimable());
    navBar(this, 'chapter');
    // 平台結帳頁回來（?order=…&status=pending）→ 打開待繳費訂單；平時檢查到帳、逾期
    const ret = P.handleReturn();
    if (ret || new URLSearchParams(location.search).get('shop')) { this.scene.start('Shop', { tab: 'packs', from: 'Home', openOrder: ret }); return; }
    P.syncOrders().then(r => {
      if (!this.sys.isActive()) return;
      if (r.expired) toast(this, S.orderExpired, 540, 900, 'red', 40);
      const got = E.takeArrivals();
      if (got.length) showRewards(this, got, () => this.scene.restart(), S.arrived);
    });
    // 【平台】關閉 ?debug 測試面板
  }

  start(n) { startStage(this, n); }

  // 側邊方形按鈕（圖示＋名字，dot＝右上紅點）
  sideBtn(x, y, icon, label, cb, dot) {
    const c = this.add.container(x, y).setDepth(DEPTH.ui);
    c.add(this.add.image(0, 0, icon));
    c.add(qText(this, 0, 58, label, { size: 30 }));
    if (dot) {
      const g = this.add.graphics();
      g.fillStyle(OUT).fillCircle(40, -40, 14); g.fillStyle(0xff3a3a).fillCircle(40, -41, 11);
      c.add(g);
    }
    c.setSize(110, 130).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.92));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => { c.setScale(1); cb(); });
  }

  roundBtn(x, y, label, cb) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(OUT).fillCircle(0, 5, 86);
    g.fillStyle(0x6a2a10).fillCircle(0, 0, 80);
    g.fillStyle(0x9a4a1a).fillCircle(0, -4, 72);
    g.lineStyle(6, GOLD).strokeCircle(0, 0, 80);
    // 地圖圖示
    g.fillStyle(OUT).fillRoundedRect(-40, -52, 80, 62, 8);
    g.fillStyle(0xf4e6c8).fillRoundedRect(-35, -47, 70, 52, 6);
    g.lineStyle(4, 0xc0503a).beginPath().moveTo(-24, -10).lineTo(-6, -32).lineTo(8, -16).lineTo(26, -38).strokePath();
    g.fillStyle(0xe8453a).fillCircle(26, -38, 6);
    c.add(g);
    c.add(qText(this, 0, 42, label, { size: 38 }));
    c.setSize(170, 170).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.92));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => { c.setScale(1); cb(); });
    return c;
  }

  debugPanel() {
    let armed = false;
    const acts = [
      [S.dbgCoins, () => { save.d.coins += 10000; save.d.diamonds += 1000; save.write(); this.res.refresh(); }],
      [S.dbgStamina, () => { save.d.stamina = CFG.stamina.max; save.write(); this.res.refresh(); }],
      [S.dbgParts, () => { for (const k in save.d.parts) save.d.parts[k] += 200; save.write(); toast(this, '+200', 540, 760, 'green'); }],
      [S.dbgUnlock, () => { save.d.cleared = Math.min(STAGE_COUNT - 1, Math.ceil((save.d.cleared + 1) / 15) * 15 - 1); save.write(); this.scene.restart(); }], // 跳到這章首領前
      [S.dbgReset, b => {
        if (!armed) { armed = true; b.setLabel(S.dbgResetConfirm); return; }
        save.reset(); this.scene.restart();
      }],
    ];
    acts.forEach(([label, fn], i) => {
      const b = button(this, 120 + i * 210, 700, 200, 70, label, { color: 'grey', size: 26, onClick: () => fn(b) });
      b.setDepth(DEPTH.ui).setAlpha(0.9);
    });
  }
}
