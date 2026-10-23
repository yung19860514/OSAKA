// 選關地圖：可上下捲動的長地圖（2700 高）、15 個關卡節點、資訊面板
import { W, H, CFG } from '../cfg.js';
import { S } from '../strings.js';
import { TOWERS } from '../data/towers.js';
import { STAGE_COUNT, stageInfo } from '../data/stages.js';
import { save } from '../store.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, roundButton, panel, OUT, GOLD } from '../ui/widgets.js';
import { resourceBar, backButton, overlay, toast, startStage, fixUI, DEPTH } from '../ui/common.js';
import { makeMapBg } from '../ui/art.js';
import { MAP_NODES } from '../data/layouts.js';
import { addTower, enemyIcon } from '../ui/towerArt.js';
import { PER_CHAPTER, CHAPTER_COUNT, chapterOf } from '../data/stages.js';
import { ensureChapter } from '../ui/common.js';
import { MAP_CHESTS } from '../data/layouts.js';
import { chapterData } from '../data/stages.js';
import { grant } from '../economy.js';
import { showRewards } from '../ui/common.js';

const MAP_H = 2700;
const TOP_PAD = 260; // 地圖上方多捲 260，首領關才不會被頂部的章節字擋住
// 第 n 關節點位置：由下往上之字形
export const nodePos = n => ({ x: Math.round(540 + 250 * Math.sin((n - 1) * 0.95)), y: Math.round(2520 - (n - 1) * 162) });

export class StageMapScene extends Phaser.Scene {
  constructor() { super('StageMap'); }

  init(data) { this.ch = data.ch || chapterOf(save.currentStage()); }

  create() {
    // 有地圖圖就照圖上的石台放節點，沒有就程式排之字形並自己畫地圖
    const C = this.ch, first = (C - 1) * PER_CHAPTER;
    const art = this.textures.exists('bg_map_ch' + C) && MAP_NODES[C];
    const nodes = [];
    for (let k = 1; k <= PER_CHAPTER; k++) nodes.push(art ? { x: MAP_NODES[C][k - 1][0], y: MAP_NODES[C][k - 1][1] } : nodePos(k));
    const bgKey = art ? 'bg_map_ch' + C : makeMapBg(this, 'map_gen_ch' + C, MAP_H, [{ x: 540, y: MAP_H + 40 }, ...nodes, { x: 540, y: 60 }]);
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, MAP_H);
    this.add.image(0, 0, bgKey).setOrigin(0, 1).setDisplaySize(W, TOP_PAD).setFlipY(true); // 上方多捲的地方：地圖頂端倒過來接上
    this.add.rectangle(0, -TOP_PAD, W, MAP_H + TOP_PAD, 0x000000, 0.28).setOrigin(0); // 背景壓暗一點，關卡比較清楚
    const fog = this.add.graphics(); // 最上面淡出成黑
    for (let i = 0; i < 13; i++) fog.fillStyle(0x0a0410, 0.85 - i * 0.065).fillRect(0, -TOP_PAD + i * 20, W, 20);

    const cur = save.currentStage();
    for (let k = 1; k <= PER_CHAPTER; k++) this.makeNode(first + k, nodes[k - 1], cur);
    if (art) (MAP_CHESTS[C] || []).forEach(([x, y, after], i) => this.makeChest(C, i, x, y, first + after));

    // 固定在畫面上的頂部
    const hb = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.ui - 1);
    for (let i = 0; i < 12; i++) hb.fillStyle(0x12061c, 0.75 - i * 0.06).fillRect(0, i * 16, W, 16);
    backButton(this, () => this.scene.start('Home'));
    resourceBar(this);
    const ch = this.add.container(540, 245).setScrollFactor(0).setDepth(DEPTH.ui);
    const ttKey = 'txt_chapters_' + (C - 1);
    if (this.textures.exists(ttKey)) { // 素材：章節名字圖
      const tt = this.add.image(0, 0, ttKey);
      tt.setScale(Math.min(230 / tt.height, 620 / tt.width)); // 章節名字圖放大
      ch.add(tt);
      fixUI(ch);
    }
    const cg = this.add.graphics();
    cg.fillStyle(OUT).fillRoundedRect(-250, -42, 500, 84, 30);
    cg.fillStyle(0x9a2420).fillRoundedRect(-244, -36, 488, 72, 26);
    cg.fillStyle(0xc8382e).fillRoundedRect(-244, -36, 488, 30, { tl: 26, tr: 26, bl: 6, br: 6 });
    if (!this.textures.exists(ttKey)) {
      ch.add([cg, qText(this, 0, 0, S.chapterNo(C) + '  ' + S.chapterName[C], { size: 44, style: 'gold' })]);
      fixUI(ch);
    } else cg.destroy();

    // 換章：左右箭頭（下一章要先打完這章最後一關）
    const arrow = (x, dir) => {
      const target = C + dir;
      if (target < 1 || target > CHAPTER_COUNT) return;
      const open = dir < 0 || save.d.cleared >= C * PER_CHAPTER;
      const b = roundButton(this, x, 300, 40, { kind: dir < 0 ? 'back' : 'back', color: 'blue', onClick: () => {
        if (!open) { toast(this, S.chapterLocked(C), 540, 400, 'white', 40); return; }
        ensureChapter(this, target, () => this.scene.restart({ ch: target }));
      } });
      if (dir > 0) b.list[0].setFlipX(true);
      if (!open) b.setAlpha(0.45);
      fixUI(b.setDepth(DEPTH.ui + 1));
    };
    arrow(110, -1); arrow(970, 1);

    // 捲動：停在目前那關（別章就停在最下面／最上面）
    const cam = this.cameras.main;
    cam.setBounds(0, -TOP_PAD, W, MAP_H + TOP_PAD);
    const curLocal = cur > first && cur <= first + PER_CHAPTER ? cur - first : cur > first ? PER_CHAPTER : 1;
    cam.scrollY = Phaser.Math.Clamp(nodes[curLocal - 1].y - H * 0.55, -TOP_PAD, MAP_H - H);
    this.drag = null;
    this.input.on('pointerdown', p => { this.drag = { y: p.y, scroll: cam.scrollY, moved: 0 }; this.vel = 0; });
    this.input.on('pointermove', p => {
      if (!this.drag || !p.isDown) return;
      const dy = p.y - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dy));
      const ns = Phaser.Math.Clamp(this.drag.scroll - dy, -TOP_PAD, MAP_H - H);
      this.vel = ns - cam.scrollY;
      cam.scrollY = ns;
    });
    this.input.on('pointerup', () => { this.drag = null; });
    this.input.on('wheel', (p, objs, dx, dy) => { cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, -TOP_PAD, MAP_H - H); });
  }

  update() { // 放手後的慣性
    if (this.drag || !this.vel) return;
    const cam = this.cameras.main;
    this.vel *= 0.9;
    if (Math.abs(this.vel) < 0.5) this.vel = 0;
    cam.scrollY = Phaser.Math.Clamp(cam.scrollY + this.vel, -TOP_PAD, MAP_H - H);
  }

  // 路邊寶箱：沒解鎖（灰＋鎖）／可以開（跳動發光）／開過（打開的箱子、變淡）
  makeChest(C, i, x, y, need) {
    const id = C + '-' + i, opened = !!save.d.mapChests[id], ready = !opened && save.d.cleared >= need;
    const c = this.add.container(x, y).setDepth(9);
    const sh = this.add.graphics();
    sh.fillStyle(0x000000, 0.35).fillEllipse(0, 28, 110, 34);
    c.add(sh);
    const key = opened ? (this.textures.exists('icon_chests_3') ? 'icon_chests_3' : 'chest1') : (this.textures.exists('icon_chests_0') ? 'icon_chests_0' : 'chest1');
    const im = this.add.image(0, -14, key);
    im.setScale(96 / Math.max(im.width, im.height));
    c.add(im);
    if (ready) {
      const glow = this.add.image(0, -14, 'glow').setScale(3).setTint(0xffd34a).setBlendMode('ADD').setAlpha(0.6);
      c.addAt(glow, 0);
      this.tweens.add({ targets: glow, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: im, y: -26, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else if (!opened) {
      im.setTint(0x888899);
      c.add(this.add.image(30, 10, 'ic_lock').setScale(0.5));
    } else im.setAlpha(0.65);
    c.setSize(120, 120).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      if (this.drag && this.drag.moved > 14) return;
      if (opened) { toast(this, S.claimed, x, y - this.cameras.main.scrollY - 90, 'white', 34); return; }
      if (!ready) { toast(this, S.chestNeed(need), 540, 960, 'white', 40); return; }
      save.d.mapChests[id] = true;
      const got = grant(chapterData(C).chests[i]);
      save.write();
      showRewards(this, got, () => this.scene.restart({ ch: C }));
    });
  }

  makeNode(n, p, cur) {
    const info = stageInfo(n);
    const cleared = n <= save.d.cleared, isCur = n === cur && !cleared, locked = !save.isUnlocked(n);
    const c = this.add.container(p.x, p.y).setDepth(10);
    const r = info.boss ? 62 : 48;
    const nodeArt = this.textures.exists('ui_stage_nodes_0');
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.3).fillEllipse(0, r * 0.8, r * 2.2, r * 0.7);
    if (nodeArt) { // 素材：0 鎖、1 目前、2 已過、3 首領
      c.add(g);
      const k = info.boss ? 3 : locked ? 0 : isCur ? 1 : 2;
      const im = this.add.image(0, -8, 'ui_stage_nodes_' + k);
      im.setScale((r * 2.6) / im.height);
      c.add(im);
    } else {
      const col = locked ? [0x6a6e78, 0x9aa0aa] : info.boss ? [0xa8231c, 0xe8453a] : isCur ? [0xd9780f, 0xffc13b] : [0x2a8a22, 0x4cc93a];
      g.fillStyle(OUT).fillCircle(0, 4, r + 7);
      g.fillStyle(col[0]).fillCircle(0, 0, r);
      g.fillStyle(col[1]).fillCircle(0, -5, r * 0.86);
      g.fillStyle(0xffffff, 0.3).fillEllipse(-r * 0.25, -r * 0.45, r * 0.8, r * 0.35);
      c.add(g);
    }
    if (isCur) {
      const ring = this.add.image(0, 0, 'ring').setScale(r / 50).setTint(0xfff07a).setAlpha(0.8);
      c.addAt(ring, 0);
      this.tweens.add({ targets: ring, scale: r / 36, alpha: 0, duration: 1100, repeat: -1 });
      const av = this.add.image(p.x, p.y - r - 70, 'avatar_lia').setScale(0.62).setDepth(12);
      this.tweens.add({ targets: av, y: av.y - 16, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    // 關號直接寫在節點裡（節點靠很近，外面的標籤會互相蓋到）；鎖住的右下角加小鎖頭
    if (nodeArt) { // 素材本身有鎖／勾／骷髏，關號寫在下面
      if (!info.boss) c.add(qText(this, 0, r + (cleared ? 48 : 18), String(info.local), { size: 40, font: FONT_NUM }).setAlpha(locked ? 0.8 : 1));
    } else {
      if (info.boss) c.add(this.add.image(0, -4, 'ic_boss').setScale(1.1));
      else c.add(qText(this, 0, -4, String(info.local), { size: 50, font: FONT_NUM, style: 'white' }).setAlpha(locked ? 0.75 : 1));
      if (locked) c.add(this.add.image(r * 0.62, r * 0.55, 'ic_lock').setScale(0.62));
    }
    if (cleared) {
      const st = save.starsOf(n);
      for (let i = 0; i < 3; i++) c.add(this.add.image((i - 1) * 40, r + 18 - (i === 1 ? 8 : 0), i < st ? 'ic_star' : 'ic_star_empty').setScale(0.62));
    }
    c.setSize(r * 2 + 20, r * 2 + 20).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      if (this.drag && this.drag.moved > 14) return; // 是在捲動，不是點（物件的 pointerup 比場景的先觸發，所以看 this.drag）
      if (locked) { toast(this, S.locked, 540, 960, 'white', 44); return; }
      this.openPanel(n);
    });
  }

  openPanel(n) {
    const info = stageInfo(n), d = save.d, first = n > d.cleared;
    const c = overlay(this, 0.55);
    c.add(panel(this, 540, 1000, 820, 960, { fill: 0x5a1f1a }));
    c.add(qText(this, 540, 600, S.stageTitle(n), { size: 76, style: info.boss ? 'red' : 'gold' }));
    if (info.boss) c.add(qText(this, 540, 670, S.bossStage, { size: 34, style: 'red', font: FONT_BODY }));
    const st = save.starsOf(n);
    for (let i = 0; i < 3; i++) c.add(this.add.image(440 + i * 100, 740, i < st ? 'ic_star' : 'ic_star_empty').setScale(1.1));
    const pw = save.power();
    c.add(qText(this, 300, 830, S.recommend, { size: 34, font: FONT_BODY, origin: [0, 0.5] }));
    c.add(qText(this, 780, 830, String(info.recommend), { size: 40, font: FONT_NUM, origin: [1, 0.5], style: 'gold' }));
    c.add(qText(this, 300, 885, S.myPower, { size: 34, font: FONT_BODY, origin: [0, 0.5] }));
    c.add(qText(this, 780, 885, String(pw), { size: 40, font: FONT_NUM, origin: [1, 0.5], style: pw >= info.recommend ? 'green' : 'red' }));
    c.add(qText(this, 300, 940, S.waves(info.waves), { size: 34, font: FONT_BODY, origin: [0, 0.5] }));
    c.add(qText(this, 540, 1005, S.enemies, { size: 34, font: FONT_BODY }));
    info.enemies.forEach((id, i) => {
      const x = 540 + (i - (info.enemies.length - 1) / 2) * 140;
      c.add(enemyIcon(this, x, 1085, id, 110));
    });
    c.add(qText(this, 540, 1170, first ? S.firstReward : S.reward, { size: 34, font: FONT_BODY }));
    const R = CFG.rewards;
    const items = [['ic_coin', '×' + (first ? R.coinsPerStage * n : Math.round(R.coinsPerStage * n * R.repeatCoinMul))]];
    if (first) items.push(['ic_gem', '×' + R.firstDiamonds]);
    items.push([{ tower: info.fragTower }, '×' + (first ? R.firstFrags : R.repeatFrags)]);
    items.forEach(([icon, txt], i) => {
      const x = 540 + (i - (items.length - 1) / 2) * 210;
      const im = icon.tower ? addTower(this, x - 40, 1240, icon.tower, 0, 80) : this.add.image(x - 40, 1240, icon).setScale(0.9);
      c.add([im, qText(this, x + 2, 1240, txt, { size: 36, font: FONT_NUM, origin: [0, 0.5] })]);
    });
    const go = button(this, 540, 1380, 440, 140, '', { color: 'yellow', onClick: () => startStage(this, n) });
    go.add(qText(this, 0, -20, S.startBattle, { size: 54 }));
    go.add(this.add.image(-30, 34, 'ic_energy').setScale(0.55));
    go.add(qText(this, 0, 34, '×' + CFG.stamina.cost, { size: 34, font: FONT_NUM, origin: [0, 0.5] }));
    c.add(go);
    c.add(roundButton(this, 905, 560, 40, {
      color: 'red', kind: 'close', onClick: () => c.destroy(),
      icon: (g, r) => { g.lineStyle(10, 0xffffff).lineBetween(-r * 0.35, -r * 0.35, r * 0.35, r * 0.35).lineBetween(r * 0.35, -r * 0.35, -r * 0.35, r * 0.35); },
    }));
    c.dim.on('pointerup', () => c.destroy());
    fixUI(c);
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 160 });
  }
}
