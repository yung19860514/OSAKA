// 戰鬥場景：把 core/battle.js 的狀態畫出來，處理拖曳合體、介面、特效
import { W, H, CFG } from '../cfg.js';
import { S } from '../strings.js';
import { TOWERS } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { Battle, tierOf, towerRange } from '../core/battle.js';
import { makeBattleBg } from '../ui/art.js';
import { save } from '../store.js';
import { qText, FONT_BODY } from '../ui/qtext.js';
import { button, roundButton, panel, bar, OUT, GOLD } from '../ui/widgets.js';
import { addTower, towerFrame, enemySprite } from '../ui/towerArt.js';
import { eventStage } from '../data/events.js';
import { CAPTAINS } from '../data/captains.js';
import { fxPlay, fxFlash } from '../ui/skin.js';
import { captainSprite } from '../ui/towerArt.js';
import { STAGE_COUNT, localOf } from '../data/stages.js';

const D = { world: 0, fx: 3000, hud: 4000, drag: 4500, overlay: 5000 };

export class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }

  init(data) {
    this.mode = data.mode || null;      // null＝主線；workshop／endless＝活動
    this.level = data.level || 0;
    this.stageNo = Math.max(1, Math.min(STAGE_COUNT, data.stage || 1));
    const q = new URLSearchParams(location.search);
    this.debug = false; // 【平台】關閉 ?debug
  }

  create() {
    // 卡組與局外塔等級來自存檔
    const stageDef = this.mode ? eventStage(this.mode, this.level) : null;
    this.b = new Battle(stageDef ? stageDef.n : this.stageNo, { stageDef, deck: save.d.deck, towerMul: save.towerMuls(), towerStar: save.towerStars(), ...save.battleBonus() });
    this.L = this.b.layout;
    this.G = this.b.G;
    this.ts = this.L.towerScale;
    this.es = this.L.enemyScale;
    this.cy = this.L.controlsY;
    this.manaPos = { x: 112, y: this.cy };
    this.speed = 1;
    this.paused = false;
    this.ended = false;
    this.dragging = null;
    this.merged = false;
    this.dmgCount = 0;
    this.towerViews = new Map();
    this.enemyViews = new Map();
    this.shotViews = new Map();

    // 有老闆的背景圖就用，沒有就照版面自己畫一張
    const art = this.L.bg && this.textures.exists(this.L.bg);
    this.bgKey = art ? this.L.bg : makeBattleBg(this, 'bg_gen_ch' + this.b.stage.chapter, this.L);
    this.add.image(0, 0, this.bgKey).setOrigin(0).setDisplaySize(W, H);
    this.gate = art && this.L.gateArt ? null : this.add.image(this.L.gate.x - 12, this.L.gate.y - 8, 'gate_gen').setScale(0.8).setDepth(this.L.gate.y + 40);
    this.drawFrame();
    this.makeHints();
    this.makeHud();
    this.makeControls();
    this.setupDrag();
    if (this.debug) this.makeDebug();
    this.banner(S.prepare, 'gold', 90);
  }

  update(time, delta) {
    this.nowT = time; // 事件處理用同一個時間來源（不要混用 this.time.now）
    if (this.burnFx?.length) this.burnFx = this.burnFx.filter(f => { if (this.b.burnt[f.cell] > this.b.t) return true; f.img.destroy(); return false; });
    if (!this.paused && this.b.state === 'play') this.b.update(Math.min(delta, 100) / 1000 * this.speed);
    for (const e of this.b.drainEvents()) this.onEvent(e);
    this.syncTowers();
    this.syncEnemies(time);
    this.syncShots();
    this.refreshHud();
    if (this.fpsText) this.fpsText.setText(Math.round(this.game.loop.actualFps) + ' fps  t=' + this.b.t.toFixed(0));
  }

  // ───── 介面 ─────
  drawFrame() {
    const g = this.add.graphics().setDepth(D.hud - 2);
    for (let i = 0; i < 10; i++) g.fillStyle(0x140a1c, 0.6 - i * 0.055).fillRect(0, i * 17, W, 17);
    const top = this.cy - 102;
    g.fillStyle(0x000000, 0.35).fillRect(0, top - 14, W, 14);
    g.fillStyle(OUT).fillRect(0, top - 4, W, H - top + 4);
    const n = Math.ceil((H - top) / 26);
    for (let i = 0; i < n; i++) g.fillStyle(lerp(0x5a2c18, 0x2a120c, i / n), 1).fillRect(0, top + 4 + i * 26, W, 27);
    g.fillStyle(GOLD).fillRect(0, top, W, 5);
    g.fillStyle(0xfff0a0, 0.6).fillRect(0, top, W, 2);
  }

  makeHud() {
    const y = 82;
    roundButton(this, 66, y, 44, {
      color: 'blue', onClick: () => this.togglePause(true),
      icon: (g, r) => { g.fillStyle(0xffffff).fillRoundedRect(-r * 0.35, -r * 0.4, r * 0.24, r * 0.8, 4).fillRoundedRect(r * 0.11, -r * 0.4, r * 0.24, r * 0.8, 4); },
    }).setDepth(D.hud);
    const label = this.mode === 'workshop' ? S.levelNames[this.level] : this.mode === 'endless' ? S.endless : S.stageLabel(this.b.stage.chapter, localOf(this.stageNo));
    // 標籤寬度依字數縮放，血條接在後面（「第2-15关」比「第1-5关」長）
    const lt = qText(this, 118, y, label, { size: this.mode === 'endless' ? 40 : 44, style: this.mode ? 'purple' : 'gold', origin: [0, 0.5] }).setDepth(D.hud);
    if (lt.width > 200) lt.setScale(200 / lt.width);
    const bx = 118 + Math.min(200, lt.width) + 44;
    this.waveBar = bar(this, bx, y - 18, 770 - bx - 14, 36, 0x7ad04a, { depth: D.hud, value: 0 });
    this.waveText = qText(this, (bx + 770) / 2, y - 2, '', { size: 34, font: FONT_BODY }).setDepth(D.hud + 1);
    const bossKey = 'avatar_' + ({ boss_goblinking: 'goblinking', boss_witch: 'witch', boss_pirate: 'pirate', boss_frostgiant: 'frostgiant', boss_lavademon: 'lavademon', boss_shadowking: 'shadowking' }[this.b.stage.boss] || 'goblinking');
    this.bossIcon = this.add.image(800, y, this.textures.exists(bossKey) ? bossKey : 'ic_boss').setDepth(D.hud + 1);
    this.bossIcon.setScale(64 / this.bossIcon.height);
    this.add.image(866, y, 'ic_heart').setScale(0.8).setDepth(D.hud);
    this.gateText = qText(this, 900, y, String(CFG.gateHp), { size: 46, origin: [0, 0.5] }).setDepth(D.hud);
    this.speedBtn = roundButton(this, 1022, y, 42, { color: 'purple', label: '×1', size: 34, onClick: () => this.toggleSpeed() }).setDepth(D.hud);
    this.speedLabel = this.speedBtn.list.find(o => o.type === 'Text');
    // 下一波
    this.nextBtn = button(this, 930, 204, 236, 84, '', { color: 'blue', size: 32, onClick: () => { if (this.b.skipWave()) this.toast('+' + CFG.wave.skipMana + ' ' + S.mana, 930, 270, 'blue'); } }).setDepth(D.hud);
    // 技能持續中
    this.skillText = qText(this, 540, 214, '', { size: 38, style: 'gold' }).setDepth(D.hud).setVisible(false);
  }

  makeControls() {
    const cy = this.cy, mp = this.manaPos;
    // 魔力
    this.add.image(mp.x, mp.y - 4, 'ic_mana').setScale(1.15).setDepth(D.hud);
    this.manaText = qText(this, 160, mp.y - 2, '0', { size: 64, style: 'blue', origin: [0, 0.5] }).setDepth(D.hud);
    qText(this, mp.x + 52, mp.y - 58, S.mana, { size: 26, font: FONT_BODY }).setDepth(D.hud);
    // 召喚
    this.summonBtn = button(this, 540, cy, 360, 150, S.summon, {
      color: 'yellow', size: 62, labelY: -24, clickDisabled: true,
      onClick: ok => {
        if (ok) { this.b.summon(); return; }
        this.toast(this.b.emptyCells().length ? S.noMana : S.full, 540, cy - 120, 'red');
      },
    }).setDepth(D.hud);
    const costIcon = this.add.image(-34, 38, 'ic_mana').setScale(0.55);
    this.costText = qText(this, -8, 38, '', { size: 40, origin: [0, 0.5] });
    this.summonBtn.add([costIcon, this.costText]);
    // 隊長技能
    this.skillBtn = this.add.container(930, cy).setDepth(D.hud);
    const sg = this.add.graphics();
    sg.fillStyle(OUT).fillCircle(0, 4, 82);
    sg.fillStyle(0xd9780f).fillCircle(0, 0, 76);
    sg.fillStyle(0xffb81c).fillCircle(0, -4, 70);
    sg.fillStyle(0xffe27a).fillEllipse(0, -36, 96, 40);
    this.skillRing = this.add.graphics();
    this.skillGlow = this.add.image(0, 0, 'glow').setScale(4.2).setTint(0xffd34a).setAlpha(0).setBlendMode('ADD');
    const cap = this.b.captain, av = this.textures.exists('avatar_' + cap) ? 'avatar_' + cap : 'avatar_lia';
    this.skillBtn.add([this.skillGlow, sg, this.skillRing, this.add.image(0, -2, av).setScale(1.1)]);
    this.skillBtn.setSize(170, 170).setInteractive({ useHandCursor: true });
    this.skillBtn.on('pointerup', () => this.b.castSkill());
    this.skillName = CAPTAINS[cap].skill;
    this.skillLabel = qText(this, 930, cy + 108, this.skillName, { size: 28, font: FONT_BODY }).setDepth(D.hud);
    // 卡組（底下有空間才顯示）
    if (cy + 174 > H - 40) return;
    qText(this, 112, 1862, S.deck, { size: 32, font: FONT_BODY }).setDepth(D.hud);
    this.b.deck.forEach((id, k) => {
      const x = 270 + k * 135;
      const g = this.add.graphics().setDepth(D.hud);
      g.fillStyle(OUT).fillRoundedRect(x - 56, 1862 - 50, 112, 100, 18);
      g.fillStyle(0x5a3020).fillRoundedRect(x - 51, 1862 - 45, 102, 90, 14);
      addTower(this, x, 1860, id, 0, 88).setDepth(D.hud);
      qText(this, x + 34, 1862 + 26, TOWERS[id].short, { size: 26 }).setDepth(D.hud);
    });
  }

  refreshHud() {
    const b = this.b;
    this.manaText.setText(Math.floor(b.mana));
    this.costText.setText(b.summonCost());
    this.summonBtn.setEnabled(b.canSummon());
    // 波數／首領血條
    const boss = b.enemies.find(e => e.def.boss);
    if (boss) {
      this.waveBar.set(boss.hp / boss.maxHp);
      this.waveText.setText(ENEMIES[boss.type].name);
    } else {
      if (b.stage.endless) { this.waveBar.set((b.wave % 10) / 10); this.waveText.setText(S.waveNow(b.wave)); }
      else { this.waveBar.set(b.wave / b.waveTotal); this.waveText.setText(S.wave(b.wave, b.waveTotal)); }
    }
    this.gateText.setText(Math.max(0, b.gate)).setQStyle(b.gate <= 5 ? 'red' : 'white');
    if (b.gate <= 5 && this.gate) this.gate.setTint(0xff9a9a);
    // 下一波
    const can = b.canSkipWave();
    this.nextBtn.setVisible(can);
    if (can) this.nextBtn.setLabel(S.nextWave + ' ' + Math.max(0, Math.ceil(b.nextWaveAt - b.t)));
    // 技能
    const dur = b.captain === 'elsa' ? 4 : CFG.captain.skillDur;
    const ratio = b.skillActive() ? (b.skillUntil - b.t) / dur : b.energy / b.energyMax;
    const ready = b.skillReady();
    if (this._ringR !== ratio || this._ringReady !== ready) {
      this._ringR = ratio; this._ringReady = ready;
      const g = this.skillRing;
      g.clear();
      g.lineStyle(14, OUT).strokeCircle(0, 0, 90);
      g.lineStyle(9, 0x2a1408).strokeCircle(0, 0, 90);
      if (ratio > 0) g.lineStyle(9, b.skillActive() ? 0xff7a2a : ready ? 0xfff07a : 0x7fd0ff).beginPath().arc(0, 0, 90, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio).strokePath();
    }
    this.skillGlow.setAlpha(ready ? 0.55 + 0.25 * Math.sin(this.time.now / 160) : 0);
    this.skillLabel.setText(ready ? S.skillReady : this.skillName).setQStyle(ready ? 'gold' : 'white');
    this.skillText.setVisible(b.skillActive());
    if (b.skillActive()) this.skillText.setText((b.captain === 'lia' ? S.skillBanner : this.skillName) + ' ' + Math.ceil(b.skillUntil - b.t));
  }

  togglePause(on) {
    if (this.ended || on === this.paused) return; // 防呆：重複觸發不會疊兩層
    this.paused = on;
    if (!on) { this.pauseLayer?.destroy(); this.pauseLayer = null; return; }
    const c = this.overlay(0.6);
    c.add(panel(this, 540, 930, 640, 620, { fill: 0x3a1a4a }));
    c.add(qText(this, 540, 720, S.pause, { size: 84, style: 'gold' }));
    c.add(button(this, 540, 880, 400, 120, S.resume, { color: 'green', onClick: () => this.togglePause(false) }));
    c.add(button(this, 540, 1020, 400, 110, S.restart, { color: 'red', onClick: () => this.scene.restart({ stage: this.stageNo }) }));
    c.add(button(this, 540, 1150, 400, 100, S.back, { color: 'blue', onClick: () => this.scene.start(this.mode ? 'Event' : 'StageMap') }));
    this.pauseLayer = c;
  }

  // 全螢幕遮罩＋內容容器。遮罩要放在容器「外面」較低的圖層：
  // 放在同一個容器裡時 Phaser 分不出誰在上面，遮罩會把按鈕的點擊吃掉
  overlay(alpha) {
    const dim = this.add.rectangle(0, 0, W, H, 0x000000, alpha).setOrigin(0).setDepth(D.overlay).setInteractive();
    const c = this.add.container(0, 0).setDepth(D.overlay + 1);
    c.once('destroy', () => dim.destroy());
    return c;
  }

  toggleSpeed() {
    const max = save.d.flags.speed3 ? 3 : 2; // ×3 要在商店買
    this.speed = this.speed >= max ? 1 : this.speed + 1;
    this.speedLabel.setText('×' + this.speed);
  }

  // ───── 塔 ─────
  makeTowerView(tw, cell) {
    const c = this.b.gt.center(cell), ts = this.ts;
    const v = this.add.container(c.x, c.y).setDepth(c.y);
    v.tw = tw; v.cell = cell; v.lv = 0;
    v.img = this.add.image(0, -10, `twg_${tw.type}_0`);
    v.label = qText(this, 0, 4, TOWERS[tw.type].short, { size: 44 });
    v.badge = this.add.graphics();
    v.badgeText = qText(this, 50, 36, '1', { size: 30, font: '"Lilita One", sans-serif' });
    v.add([v.img, v.label, v.badge, v.badgeText]);
    v.setSize((this.G.cw - 4) / ts, (this.G.ch + 30) / ts).setInteractive({ draggable: true, useHandCursor: true });
    v.on('pointerdown', () => { v._dragged = false; });
    v.on('pointerup', () => { if (!v._dragged) this.showTowerInfo(v); });
    this.towerViews.set(tw.id, v);
    this.updateTowerLook(v, tw);
    v.setScale(0.2 * ts);
    this.tweens.add({ targets: v, scale: ts, duration: 260, ease: 'Back.Out' });
    return v;
  }

  updateTowerLook(v, tw) {
    const tier = tierOf(tw.lv);
    const f = towerFrame(this, tw.type, tier);
    v.img.setTexture(f.key, f.frame);
    if (f.art) { // 素材塔：底座對齊格子下緣，文字標籤不用了
      v.img.setOrigin(0.5, 0.86).setPosition(0, 58);
      v.img.baseScale = 0.62;
    } else {
      v.img.setOrigin(0.5, 0.5).setPosition(0, -10);
      v.img.baseScale = 1;
    }
    v.img.setScale(v.img.baseScale);
    v.label.setVisible(!f.art);
    const col = [0xb8c0cc, 0x7ad04a, 0x3f8cff, 0x3f8cff, 0xb05cff, 0xb05cff, 0xffc13b][tw.lv - 1];
    v.badge.clear();
    v.badge.fillStyle(OUT).fillCircle(50, 38, 23);
    v.badge.fillStyle(col).fillCircle(50, 36, 19);
    v.badge.fillStyle(0xffffff, 0.35).fillEllipse(46, 28, 18, 8);
    v.badgeText.setText(tw.lv);
    if (v.lv && v.lv !== tw.lv) {
      v.img.setScale(v.img.baseScale * 1.3);
      this.tweens.add({ targets: v.img, scale: v.img.baseScale, duration: 300, ease: 'Back.Out' });
    }
    v.lv = tw.lv;
    if (tw.type === 'holy' && !v.halo && this.textures.exists('fx_holy_ring')) { // 聖光塔腳下金色光環
      v.halo = this.add.image(0, 40, 'fx_holy_ring').setBlendMode('ADD').setAlpha(0.7);
      v.halo.setScale(170 / v.halo.width, 80 / v.halo.height);
      v.addAt(v.halo, 0);
      this.tweens.add({ targets: v.halo, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 });
    }
  }

  syncTowers() {
    const seen = new Set();
    this.b.grid.forEach((tw, i) => {
      if (!tw) return;
      seen.add(tw.id);
      const v = this.towerViews.get(tw.id) || this.makeTowerView(tw, i);
      if (v.lv !== tw.lv) this.updateTowerLook(v, tw);
      // 不能攻擊的狀態：青蛙＞著火＞冰凍＞暈眩
      const t = this.b.t;
      const st = tw.frogUntil > t ? 'frog' : this.b.burnt[i] > t ? 'burn' : this.b.towerFreezeUntil > t ? 'freeze' : tw.stunUntil > t ? 'stun' : null;
      if (v.state !== st) {
        v.state = st;
        v.stateText?.destroy(); v.stateText = null;
        if (st) {
          v.img.setTint({ frog: 0x5aff5a, burn: 0xff7a4a, freeze: 0x8fd8ff, stun: 0x888888 }[st]);
          v.stateText = qText(this, 0, -70, { frog: S.frog, burn: S.burnMark, freeze: S.freezeMark, stun: S.stunMark }[st], { size: 36, style: { frog: 'green', burn: 'red', freeze: 'blue', stun: 'white' }[st] });
          v.add(v.stateText);
          this.tweens.add({ targets: v.stateText, y: -82, duration: 300, yoyo: true, repeat: -1 });
        } else v.img.clearTint();
      }
      if (v.cell !== i) {
        v.cell = i;
        if (this.dragging !== v) this.snapTower(v);
      }
    });
    for (const [id, v] of this.towerViews) {
      if (seen.has(id)) continue;
      this.towerViews.delete(id);
      v.disableInteractive();
      this.tweens.add({ targets: v, scale: 0.3, alpha: 0, duration: 160, onComplete: () => v.destroy() });
    }
  }

  snapTower(v) {
    const c = this.b.gt.center(v.cell);
    v.setDepth(c.y);
    this.tweens.add({ targets: v, x: c.x, y: c.y, scale: this.ts, duration: 140, ease: 'Quad.Out' });
  }

  showTowerInfo(v) {
    this.infoLayer?.destroy();
    const def = TOWERS[v.tw.type], c = this.b.gt.center(v.cell);
    const layer = this.add.container(0, 0).setDepth(D.fx + 10);
    if (def.range > 0 && def.range < 5000) {
      const g = this.add.graphics();
      const r = towerRange(def, v.tw.lv);
      g.fillStyle(0xffffff, 0.12).fillCircle(c.x, c.y, r);
      g.lineStyle(4, 0xffffff, 0.7).strokeCircle(c.x, c.y, r);
      layer.add(g);
    }
    layer.add(qText(this, c.x, c.y - 104 * this.ts, def.name + ' ' + S.lv(v.tw.lv), { size: 34, style: 'gold' }));
    this.infoLayer = layer;
    this.tweens.add({ targets: layer, alpha: 0, delay: 1300, duration: 300, onComplete: () => { layer.destroy(); if (this.infoLayer === layer) this.infoLayer = null; } });
  }

  // 拖曳：同種同級亮綠框、空格淡框
  makeHints() {
    this.hints = [];
    const G = this.G, pad = Math.round(G.cw * 0.04), rr = Math.round(G.ch * 0.14);
    for (let i = 0; i < this.b.cells; i++) {
      const x = G.x + (i % G.cols) * G.cw + pad, y = G.y + Math.floor(i / G.cols) * G.ch + pad;
      let g;
      if (this.textures.exists('ui_tiles_1')) { // 素材：發光綠格
        g = this.add.image(x + (G.cw - pad * 2) / 2, y + (G.ch - pad * 2) / 2, 'ui_tiles_1').setDepth(G.y - 1).setAlpha(0.9);
        g.setDisplaySize(G.cw * 1.02, G.ch * 1.05);
      } else {
        g = this.add.graphics().setDepth(G.y - 1);
        g.fillStyle(0x7aff5a, 0.3).fillRoundedRect(x, y, G.cw - pad * 2, G.ch - pad * 2, rr);
        g.lineStyle(5, 0xb6ff7a, 1).strokeRoundedRect(x, y, G.cw - pad * 2, G.ch - pad * 2, rr);
      }
      g.setVisible(false);
      this.hints.push(g);
    }
    this.hover = this.add.graphics().setDepth(G.y - 1);
  }

  showHints(tw) {
    this.b.grid.forEach((o, i) => this.hints[i].setVisible(!!o && this.b.canMerge(tw, o)));
  }

  setupDrag() {
    this.input.dragDistanceThreshold = 12;
    this.input.on('dragstart', (p, v) => {
      if (!v.tw || this.paused || this.b.state !== 'play') return;
      v._dragged = true;
      this.dragging = v;
      v.setDepth(D.drag);
      this.tweens.killTweensOf(v);
      v.setScale(this.ts * 1.12);
      this.showHints(v.tw);
    });
    this.input.on('drag', (p, v, x, y) => {
      if (this.dragging !== v) return;
      v.setPosition(x, y);
      const to = this.b.gt.at(p.worldX, p.worldY), G = this.G, pad = Math.round(G.cw * 0.04);
      this.hover.clear();
      if (to >= 0) {
        const hx = G.x + (to % G.cols) * G.cw + pad, hy = G.y + Math.floor(to / G.cols) * G.ch + pad;
        this.hover.lineStyle(5, 0xffffff, 0.9).strokeRoundedRect(hx, hy, G.cw - pad * 2, G.ch - pad * 2, Math.round(G.ch * 0.14));
      }
    });
    this.input.on('dragend', (p, v) => {
      if (this.dragging !== v) return;
      this.dragging = null;
      this.hints.forEach(h => h.setVisible(false));
      this.hover.clear();
      const from = this.b.grid.indexOf(v.tw);
      const to = this.b.gt.at(p.worldX, p.worldY);
      if (from >= 0 && to >= 0 && to !== from) this.b.move(from, to);
      const now = this.b.grid.indexOf(v.tw);
      if (now >= 0) { v.cell = now; this.snapTower(v); }
    });
  }

  // ───── 怪物 ─────
  syncEnemies(time) {
    const seen = new Set();
    for (const e of this.b.enemies) {
      seen.add(e.id);
      let v = this.enemyViews.get(e.id);
      if (!v) {
        v = this.add.container(e.x, e.y);
        // 有走路動畫素材就用素材（腳底對準路線），沒有用程式畫的
        const spr = enemySprite(this, e.type);
        v.img = spr || this.add.image(0, 0, `eng_${e.type}`);
        let hpY = -e.def.r - 22;
        if (spr) {
          const h = e.def.r * 4.2;
          spr.setOrigin(0.5, 0.8).setScale(h / spr.height);
          v.art = true;
          hpY = -h * 0.8 - 8;
        }
        const w = e.def.r * 1.7;
        v.hpBg = this.add.rectangle(-w / 2 - 3, hpY, w + 6, 14, OUT).setOrigin(0, 0.5);
        v.hpFg = this.add.rectangle(-w / 2, hpY, w, 8, 0x7ad04a).setOrigin(0, 0.5);
        v.hpW = w; v.hpY = hpY;
        v.add([v.img, v.hpBg, v.hpFg]);
        v.hpBg.setVisible(false); v.hpFg.setVisible(false);
        v.phase = Math.random() * 10;
        v.setScale(0.4 * this.es);
        this.tweens.add({ targets: v, scale: this.es, duration: 300, ease: 'Back.Out' });
        this.enemyViews.set(e.id, v);
      }
      v.setPosition(e.x, e.y).setDepth(e.y);
      if (v.dmgAcc > 0 && time >= (v.nextNum || 0)) {
        this.dmgNumber(e.x, e.y - e.def.r * 0.5, v.dmgAcc, 'num_white');
        v.dmgAcc = 0; v.nextNum = time + 250;
      }
      const stopped = e.stopUntil > this.b.t;
      const walking = !(e.def.archer && e.waitEnd != null && !e.shot) && !stopped;
      if (stopped && !v.clock) { // 時間塔：頭上掛一個小時鐘
        const tex = this.textures.exists('fx_time_stop') ? 'fx_time_stop' : 'ring';
        v.clock = this.add.image(0, v.hpY - 40, tex).setBlendMode('ADD');
        v.clock.setScale(80 / v.clock.width);
        if (tex === 'ring') v.clock.setTint(0xb48aff);
        v.add(v.clock);
      } else if (!stopped && v.clock) { v.clock.destroy(); v.clock = null; }
      if (v.clock) v.clock.rotation = time / 600;
      const f = time / 1000 * (e.charging ? 26 : 10) + v.phase;
      if (v.art) { // 素材本身有走路動畫：停下來時暫停、衝刺時加快
        if (walking && v.img.anims.isPaused) v.img.anims.resume();
        else if (!walking && v.img.anims.isPlaying) v.img.anims.pause();
        v.img.anims.timeScale = e.charging ? 2.5 : (e.slowUntil > this.b.t ? 0.6 : 1);
      } else {
        v.img.y = walking ? -Math.abs(Math.sin(f)) * 7 : 0;
        v.img.rotation = walking ? Math.sin(f) * 0.07 : 0;
      }
      if (e.dirX) v.img.setFlipX(e.dirX < 0);
      if (!e.def.boss && e.hp < e.maxHp) {
        v.hpBg.setVisible(true); v.hpFg.setVisible(true);
        const r = Math.max(0, e.hp / e.maxHp);
        v.hpFg.width = v.hpW * r;
        v.hpFg.fillColor = r > 0.5 ? 0x7ad04a : r > 0.25 ? 0xffc13b : 0xff4a3a;
      }
      const t = this.b.t;
      // Phaser 3.80 的 setTint 不會關掉 tintFill，要自己關
      if (v.flashUntil > time) v.img.setTintFill(0xffffff);
      else {
        v.img.tintFill = false;
        if (e.charging) v.img.setTint(0xff8a8a);
        else if (stopped) v.img.setTint(0xc8a0ff);
        else if (e.slowUntil > t || (this.b.captain === 'elsa' && this.b.skillActive())) v.img.setTint(0x9fe0ff);
        else if (e.burnUntil > t) v.img.setTint(0xffa070);
        else if (e.poisonUntil > t) v.img.setTint(0xb6ff8a);
        else if (v.img.baseTint) v.img.setTint(v.img.baseTint);
        else v.img.clearTint();
      }
    }
    for (const [id, v] of this.enemyViews) {
      if (seen.has(id)) continue;
      this.enemyViews.delete(id);
      if (v.dmgAcc > 0) this.dmgNumber(v.x, v.y - 20, v.dmgAcc, 'num_white');
      this.tweens.add({ targets: v, scale: 0.2, alpha: 0, duration: 140, onComplete: () => v.destroy() });
    }
  }

  // ───── 子彈 ─────
  syncShots() {
    const seen = new Set();
    for (const s of this.b.shots) {
      seen.add(s.id);
      let v = this.shotViews.get(s.id);
      if (!v) {
        v = this.add.image(s.x, s.y, `shot_${s.type}`).setDepth(D.fx);
        if (s.type === 'dragon') v.setScale(0.9);
        v.dist0 = Math.hypot(s.tx - s.sx, s.ty - s.sy) || 1;
        this.shotViews.set(s.id, v);
      }
      let y = s.y;
      if (s.type === 'cannon') { // 炮彈畫成拋物線
        const k = 1 - Math.min(1, Math.hypot(s.tx - s.x, s.ty - s.y) / v.dist0);
        y -= Math.sin(k * Math.PI) * 70;
      }
      v.setPosition(s.x, y);
      if (this.textures.get('shot_' + s.type).customData?.art) v.rotation = Math.atan2(s.vy || -1, s.vx || 0); // 素材：照飛行方向
      else if (s.type === 'crossbow' || s.type === 'ice' || s.type === 'shadow') v.rotation = Math.atan2(s.vy || -1, s.vx || 0);
      else if (s.type === 'cannon' || s.type === 'poison') v.rotation += 0.2;
      else if (s.type === 'dragon') v.setScale(0.9, 0.9 * (0.8 + 0.2 * Math.abs(Math.sin(this.time.now / 60))));
    }
    for (const [id, v] of this.shotViews) if (!seen.has(id)) { v.destroy(); this.shotViews.delete(id); }
  }

  // ───── 事件與特效 ─────
  onEvent(e) {
    switch (e.type) {
      case 'hit': { // 冰霜、毒霧命中有自己的小特效（有素材才放，太密會吵：每隻怪 0.4 秒一次）
        if ((e.kind === 'slow' || e.kind === 'poison') && e.id) {
          const vv = this.enemyViews.get(e.id), now2 = this.nowT;
          if (vv && now2 >= (vv.nextFx || 0)) {
            vv.nextFx = now2 + 400;
            if (e.kind === 'slow') fxPlay(this, 'fx_ice_sheet', e.x, e.y - 20, 110, { fps: 26 });
            else fxFlash(this, 'fx_poison_cloud', e.x, e.y - 10, 120, { alpha: 0.8, dur: 600 });
          }
        }
      }
      // falls through
      case 'hit_main': { // 閃白有冷卻（不然首領被連續打會一直是白的）；傷害數字每隻怪每 0.25 秒合併成一個
        const v = e.id && this.enemyViews.get(e.id);
        const now = this.nowT;
        if (v) {
          if (now >= (v.nextFlash || 0)) { v.flashUntil = now + 50; v.nextFlash = now + 200; }
          v.dmgAcc = (v.dmgAcc || 0) + e.dmg;
          if (e.kind === 'crit') { this.floatNum(e.x + Phaser.Math.Between(-20, 20), e.y - 70, String(Math.round(e.dmg)), 'num_red', 1.25); v.dmgAcc -= e.dmg; }
        } else this.dmgNumber(e.x, e.y, e.dmg, e.kind === 'dot' ? 'num_green' : e.kind === 'burn' ? 'num_red' : 'num_white');
        break;
      }
      case 'cone': { // 火焰塔噴火
        const tex = this.textures.exists('fx_flame_cone') ? 'fx_flame_cone' : 'puff';
        const f = this.add.image(e.x, e.y, tex).setOrigin(0.04, 0.5).setDepth(D.fx).setBlendMode('ADD').setRotation(e.ang).setAlpha(0.8);
        const k = e.r / f.width;
        f.setScale(k * 0.4, k * 0.4 * (tex === 'puff' ? 1 : 1.1));
        if (tex === 'puff') f.setTint(0xff6a1a);
        this.tweens.add({ targets: f, scaleX: k, scaleY: k * Math.tan(e.half) * 1.6, duration: 160, ease: 'Quad.Out' });
        this.tweens.add({ targets: f, alpha: 0, delay: 200, duration: 220, onComplete: () => f.destroy() });
        break;
      }
      case 'slash': { // 劍士塔：一道白色斬擊
        const g = this.add.graphics().setDepth(D.fx).setPosition(e.x, e.y - 20);
        const a = Math.atan2(e.y - e.fy, e.x - e.fx) + Math.PI / 2;
        g.lineStyle(14, 0xffffff, 1).beginPath().arc(0, 0, 46, a - 0.9, a + 0.9).strokePath();
        g.lineStyle(6, 0x9fd8ff, 1).beginPath().arc(0, 0, 54, a - 0.7, a + 0.7).strokePath();
        g.setScale(0.5);
        this.tweens.add({ targets: g, scale: 1.15, alpha: 0, duration: 260, ease: 'Quad.Out', onComplete: () => g.destroy() });
        break;
      }
      case 'timestop': { // 時間塔：時鐘法陣
        const tex = this.textures.exists('fx_time_stop') ? 'fx_time_stop' : 'ring';
        const m = this.add.image(e.x, e.y - 10, tex).setDepth(D.fx - 1).setBlendMode('ADD');
        const k = (this.G.cw * 1.7) / m.width;
        if (tex === 'ring') m.setTint(0xb48aff);
        m.setScale(k * 0.4);
        this.tweens.add({ targets: m, scale: k, angle: 40, duration: 260, ease: 'Back.Out' });
        this.tweens.add({ targets: m, alpha: 0, delay: 300, duration: 350, onComplete: () => m.destroy() });
        if (this.nowT >= (this.nextStopToast || 0)) { this.nextStopToast = this.nowT + 2500; this.toast(S.timeStop, e.x, e.y - 90, 'purple', 34); }
        break;
      }
      case 'kill': this.killFx(e); break;
      case 'boom':
        if (!fxPlay(this, 'fx_hit_sheet', e.x, e.y - 10, e.r * 2.4)) { this.ringFx(e.x, e.y, e.r, e.tower === 'dragon' ? 0xff5a2a : 0xffa23a); this.puffs(e.x, e.y, 0xffc070, 6, e.r * 0.6); }
        break;
      case 'chain': this.lightningFx(e.points); break;
      case 'fire': this.recoil(e.id); break;
      case 'mana': {
        const c = this.b.gt.center(e.cell);
        this.floatNum(c.x, c.y - 70, '+' + e.amount, 'num_blue', 1);
        this.flyMana(c.x, c.y - 40);
        break;
      }
      case 'summon': { const c = this.b.gt.center(e.cell); if (!fxPlay(this, 'fx_summon_sheet', c.x, c.y + this.G.ch * 0.3, 230)) this.ringFx(c.x, c.y, 90, 0x8fd0ff); break; }
      case 'merge': {
        const c = this.b.gt.center(e.cell);
        if (!fxPlay(this, e.skill && this.textures.exists('fx_levelup_sheet') ? 'fx_levelup_sheet' : 'fx_merge_sheet', c.x, c.y - 30, 230)) { this.ringFx(c.x, c.y, 110, 0xffd34a); this.sparks(c.x, c.y, 0xffe27a, 10); }
        this.toast(S.lv(e.lv), c.x, c.y - 100, 'gold', 44);
        this.merged = true;
        this.tip?.destroy(); this.tip = null;
        break;
      }
      case 'wave':
        if (e.boss) { this.banner(S.bossBanner, 'red', 110); this.cameras.main.shake(400, 0.006); }
        else if (e.n !== e.total && e.n > 1 && this.textures.exists('txt_battle_3')) this.bannerArt('txt_battle_3', S.waveBanner(e.n));
        else this.banner(e.n === e.total ? S.lastWave : S.waveBanner(e.n), e.n === e.total ? 'red' : 'white', 84);
        if (e.n === 2 && !this.merged) this.showTip();
        break;
      case 'leak': this.gateHit(e.dmg, e.boss); break;
      case 'arrow': this.arrowFx(e.x, e.y, e.dmg); break;
      case 'charge': this.toast(S.charge, e.x, e.y - 90, 'red', 40); break;
      case 'witchSummon': this.ringFx(e.x, e.y, 120, 0xb05cff); this.toast(S.witchSummon, e.x, e.y - 100, 'purple', 38); break;
      case 'spore': { // 毒霧：綠色雲，持續 dur 秒
        const k = this.textures.exists('fx_poison_cloud') ? 'fx_poison_cloud' : 'puff';
        const im = this.add.image(e.x, e.y, k).setDepth(D.fx - 1).setAlpha(0.75).setBlendMode('ADD'); // 黑底特效要用疊加
        if (k === 'puff') im.setTint(0x8aff5a).setBlendMode('NORMAL').setAlpha(0.5);
        im.setScale((e.r * 2) / im.width);
        this.tweens.add({ targets: im, alpha: 0, delay: (e.dur - 0.6) * 1000, duration: 600, onComplete: () => im.destroy() });
        break;
      }
      case 'frog': { // 塔變青蛙：塔變綠、上面跳出青蛙字，時間到恢復
        const v = this.towerViews.get(e.id);
        this.toast(S.frogged, e.x, e.y - 100, 'green', 40);
        if (v) { const c = this.b.gt.center(v.cell); this.ringFx(c.x, c.y, 80, 0x5aff5a); }
        break;
      }
      case 'disable': { // 海盜炮擊、熔岩小鬼爆炸：塔暈眩
        const c = this.b.gt.center(e.cell);
        if (!e.quiet) { // 炮擊：炮彈從首領飛到格子
          const ball = this.add.image(e.x, e.y, 'shot_cannon').setDepth(D.fx).setScale(1.3);
          this.tweens.add({ targets: ball, x: c.x, y: c.y, duration: 450, ease: 'Quad.In', onComplete: () => { ball.destroy(); if (!fxPlay(this, 'fx_hit_sheet', c.x, c.y - 10, 200)) this.ringFx(c.x, c.y, 90, 0xffa23a); this.cameras.main.shake(120, 0.004); } });
        }
        break;
      }
      case 'freezeAll': // 冰霜巨人：全場冰凍
        this.cameras.main.flash(250, 160, 220, 255);
        this.banner(S.towersFrozen, 'blue', 80);
        for (let i = 0; i < this.b.cells; i++) if (this.b.grid[i]) { const c = this.b.gt.center(i); fxPlay(this, 'fx_ice_sheet', c.x, c.y - 20, 150); }
        break;
      case 'burn': { // 熔岩惡魔：格子著火
        const c = this.b.gt.center(e.cell);
        this.toast(S.cellBurnt, c.x, c.y - 90, 'red', 36);
        const f = this.add.image(c.x, c.y + 10, this.textures.exists('fx_flame_cone') ? 'fx_flame_cone' : 'puff').setDepth(c.y + 50).setBlendMode('ADD').setAngle(-90);
        f.setScale((this.G.ch * 1.6) / f.height);
        if (f.texture.key === 'puff') f.setTint(0xff5a1a).setScale(2.4);
        this.tweens.add({ targets: f, alpha: 0.6, scaleY: f.scaleY * 1.15, duration: 300, yoyo: true, repeat: -1 });
        this.burnFx = this.burnFx || [];
        this.burnFx.push({ img: f, cell: e.cell });
        break;
      }
      case 'phase': // 暗影骨王：召喚影子＋冰凍
        this.cameras.main.shake(500, 0.012);
        this.cameras.main.flash(300, 120, 60, 200);
        this.banner(S.bossPhase, 'purple', 84);
        this.ringFx(e.x, e.y, 300, 0xb05cff);
        break;
      case 'revive': this.toast(S.revived, e.x, e.y - 70, 'white', 32); this.ringFx(e.x, e.y, 70, 0xd8d0b8); break;
      case 'blast': this.ringFx(e.x, e.y, e.r, 0xff6a2a); this.puffs(e.x, e.y, 0xff8a3a, 5, e.r * 0.6); break;
      case 'skill': {
        const c = e.captain || 'lia';
        const col = { lia: [255, 220, 120], borg: [255, 170, 80], karl: [255, 90, 60], elsa: [140, 210, 255] }[c];
        this.cameras.main.flash(300, ...col);
        this.captainCutIn(c);
        fxPlay(this, 'fx_skill_sheet', 540, this.G.y + this.G.ch * 2, 700, { depth: 3500 });
        // 技能名稱由 captainCutIn 顯示（不再另外跳橫幅）
        if (c === 'karl') { // 全場火焰
          this.cameras.main.shake(400, 0.008);
          for (const en of this.b.enemies) { this.puffs(en.x, en.y, 0xff7a2a, 4, 50); this.ringFx(en.x, en.y, 70, 0xff5a2a); }
        }
        if (c === 'elsa') for (const en of this.b.enemies) if (!fxPlay(this, 'fx_ice_sheet', en.x, en.y - 20, 120)) this.ringFx(en.x, en.y, 60, 0x9fe0ff);
        break;
      }
      case 'end': this.finish(e); break;
    }
  }

  dmgNumber(x, y, dmg, font) {
    if (!CFG.dmgNumbers || this.dmgCount >= CFG.maxDmgNumbers || dmg < 0.5) return;
    this.floatNum(x + Phaser.Math.Between(-34, 34), y - 30 + Phaser.Math.Between(-14, 14), String(Math.round(dmg)), font, dmg >= 1000 ? 1.15 : dmg >= 100 ? 0.95 : 0.8);
  }

  floatNum(x, y, str, font, scale = 1) {
    this.dmgCount++;
    const art = this.cache.bitmapFont.get(font)?.art; // 素材數字字型本身已經排緊
    const t = this.add.bitmapText(x, y, font, str).setOrigin(0.5).setLetterSpacing(art ? 0 : -6).setDepth(D.fx + 5).setScale(scale * 0.6);
    this.tweens.add({ targets: t, scale, duration: 120, ease: 'Back.Out' });
    this.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 200, duration: 450, onComplete: () => { t.destroy(); this.dmgCount--; } });
  }

  recoil(id) {
    const v = this.towerViews.get(id);
    if (!v || this.dragging === v) return;
    this.tweens.killTweensOf(v.img);
    const k = v.img.baseScale || 1;
    v.img.setScale(1.06 * k, 0.9 * k);
    this.tweens.add({ targets: v.img, scaleX: k, scaleY: k, duration: 140, ease: 'Quad.Out' });
  }

  killFx(e) {
    const def = ENEMIES[e.enemy];
    this.puffs(e.x, e.y, def.color, def.boss ? 18 : def.elite ? 10 : 5, def.r);
    if (def.boss) { this.cameras.main.shake(500, 0.01); this.ringFx(e.x, e.y, 240, 0xffd34a); }
    this.flyMana(e.x, e.y);
  }

  flyMana(x, y) {
    if (this.dmgCount > CFG.maxDmgNumbers) return;
    const m = this.add.image(x, y, 'ic_mana').setScale(0.45).setDepth(D.hud - 1);
    this.tweens.add({
      targets: m, x: this.manaPos.x, y: this.manaPos.y, scale: 0.3, duration: 520, ease: 'Cubic.In',
      onComplete: () => { m.destroy(); this.manaText.setScale(1.12); this.tweens.add({ targets: this.manaText, scale: 1, duration: 120 }); },
    });
  }

  puffs(x, y, color, n, spread) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'puff').setTint(color).setScale(0.3).setDepth(D.fx).setAlpha(0.9);
      const a = Math.random() * Math.PI * 2, d = spread * (0.5 + Math.random() * 0.8);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0.05, alpha: 0, duration: 380 + Math.random() * 200, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
  }

  sparks(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const p = this.add.image(x, y, 'spark').setTint(color).setScale(0.5).setDepth(D.fx + 1).setBlendMode('ADD');
      const a = i / n * Math.PI * 2, d = 90 + Math.random() * 40;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 180, scale: 0.1, alpha: 0, duration: 500, ease: 'Quad.Out', onComplete: () => p.destroy() });
    }
  }

  ringFx(x, y, r, color) {
    const ring = this.add.image(x, y, 'ring').setTint(color).setScale(0.1).setDepth(D.fx).setAlpha(0.95);
    this.tweens.add({ targets: ring, scale: r / 56, alpha: 0, duration: 320, ease: 'Quad.Out', onComplete: () => ring.destroy() });
  }

  lightningFx(points) {
    if (this.textures.exists('fx_lightning_chain_0')) { // 素材：閃電圖拉長、轉到兩點之間
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i];
        const im = this.add.image(a.x, a.y, 'fx_lightning_chain_' + (i % 3)).setOrigin(0, 0.5).setBlendMode('ADD').setDepth(D.fx + 2);
        im.setDisplaySize(Math.max(20, Math.hypot(b.x - a.x, b.y - a.y)), 46);
        im.rotation = Math.atan2(b.y - a.y, b.x - a.x);
        this.tweens.add({ targets: im, alpha: 0, delay: 60, duration: 160, onComplete: () => im.destroy() });
      }
      return;
    }
    const g = this.add.graphics().setDepth(D.fx + 2).setBlendMode('ADD');
    for (const [w, c, a] of [[16, 0x3f6fe8, 0.5], [7, 0x9fd8ff, 1], [3, 0xffffff, 1]]) {
      g.lineStyle(w, c, a).beginPath();
      g.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        const p0 = points[i - 1], p1 = points[i];
        for (let k = 1; k <= 4; k++) {
          const t = k / 4, j = k < 4 ? 18 : 0;
          g.lineTo(p0.x + (p1.x - p0.x) * t + (Math.random() - 0.5) * j, p0.y + (p1.y - p0.y) * t + (Math.random() - 0.5) * j);
        }
      }
      g.strokePath();
    }
    this.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  gateHit(dmg, big) {
    const gp = this.L.gate;
    if (this.gate) {
      this.tweens.killTweensOf(this.gate);
      this.gate.x = gp.x - 12;
      this.tweens.add({ targets: this.gate, x: this.gate.x + 8, duration: 40, yoyo: true, repeat: 3 });
    }
    this.floatNum(gp.x + 10, gp.y - 110, '-' + dmg, 'num_red', big ? 1.4 : 1);
    if (!fxFlash(this, 'fx_gate_hit', gp.x, gp.y - 40, big ? 420 : 280)) this.ringFx(gp.x, gp.y - 20, 110, 0xff4a3a);
    this.puffs(gp.x, gp.y - 30, 0xb08060, 6, 80);
    this.cameras.main.shake(big ? 450 : 120, big ? 0.012 : 0.003);
    if (!this.redFlash) {
      this.redFlash = this.add.rectangle(0, 0, W, H, 0xff0000, 0).setOrigin(0).setDepth(D.overlay - 1);
    }
    this.redFlash.setAlpha(0.22);
    this.tweens.add({ targets: this.redFlash, alpha: 0, duration: 300 });
  }

  arrowFx(x, y, dmg) {
    const a = this.add.image(x, y, 'shot_crossbow').setTint(0xff6a5a).setDepth(D.fx);
    const gp = this.L.gate;
    a.rotation = Math.atan2(gp.y - y, gp.x - x);
    this.tweens.add({ targets: a, x: gp.x, y: gp.y - 30, duration: 450, ease: 'Quad.In', onComplete: () => { a.destroy(); this.gateHit(dmg, false); } });
  }

  banner(text, style, size) {
    if (this.time.now < (this.cutInUntil || 0)) return; // 隊長特寫中，略過
    this.bannerText?.destroy();
    const t = qText(this, 540, 760, text, { size, style }).setDepth(D.hud + 5).setScale(0.3).setAlpha(0);
    this.bannerText = t;
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: t, alpha: 0, y: 720, delay: 1100, duration: 350, onComplete: () => { t.destroy(); if (this.bannerText === t) this.bannerText = null; } });
  }

  // 技能特寫：隊長從右邊滑進來（有技能影片播技能，沒有播待機），停 1 秒再滑出去
  captainCutIn(c) {
    this.bannerText?.destroy(); this.bannerText = null; // 特寫期間不要有別的橫幅
    this.cutInUntil = this.time.now + 2400;
    const band = this.add.rectangle(540, 1000, W, 520, 0x000000, 0.45).setDepth(D.hud + 8).setAlpha(0);
    // 有技能影片（16:9 橫的，特效往兩邊噴）：整張置中放大；只有待機：隊長站右邊、技能名在左
    // 技能影片是橫的（16:9）就整張置中；直的（9:16）跟待機一樣站右邊、技能名在左
    const spr = captainSprite(this, c, 1400, 1250, 640, 'skill').setDepth(D.hud + 9);
    const wide = spr.width > spr.height;
    if (wide) spr.setScale(Math.min(700 / spr.height, 1080 / spr.width));
    const name = qText(this, wide ? 540 : 330, wide ? 790 : 1000, CAPTAINS[c].skill, { size: 80, style: c === 'elsa' ? 'blue' : c === 'karl' ? 'red' : 'gold', strokeW: 12 }).setDepth(D.hud + 10).setAlpha(0);
    this.tweens.add({ targets: band, alpha: 1, duration: 150 });
    this.tweens.add({ targets: spr, x: wide ? 540 : 760, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: name, alpha: 1, x: wide ? 540 : 360, duration: 260, delay: 120 });
    const hasSkill = this.textures.exists('anim_captain_' + c + '_skill');
    this.time.delayedCall(hasSkill ? 2400 : 1300, () => {
      this.tweens.add({ targets: [band, name], alpha: 0, duration: 200 });
      this.tweens.add({ targets: spr, x: 1400, duration: 220, ease: 'Quad.In', onComplete: () => { spr.destroy(); band.destroy(); name.destroy(); } });
    });
  }

  // 字圖橫幅（「下一波」）＋下面一行小字（第 N 波）
  bannerArt(key, sub) {
    if (this.time.now < (this.cutInUntil || 0)) return;
    this.bannerText?.destroy();
    const c = this.add.container(540, 760).setDepth(D.hud + 5).setAlpha(0);
    const im = this.add.image(0, 0, key);
    im.setScale(420 / im.width);
    c.add([im, qText(this, 0, im.displayHeight / 2 + 20, sub, { size: 44 })]);
    c.setScale(0.3);
    this.bannerText = c;
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
    this.tweens.add({ targets: c, alpha: 0, y: 720, delay: 1100, duration: 350, onComplete: () => { c.destroy(); if (this.bannerText === c) this.bannerText = null; } });
  }

  toast(text, x, y, style = 'white', size = 36) {
    const t = qText(this, x, y, text, { size, style }).setDepth(D.hud + 6);
    this.tweens.add({ targets: t, y: y - 50, alpha: 0, delay: 500, duration: 400, onComplete: () => t.destroy() });
  }

  showTip() {
    if (this.tip) return;
    const ty = this.G.y - 45;
    const c = this.add.container(540, ty).setDepth(D.hud + 2);
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.6).fillRoundedRect(-330, -30, 660, 60, 30);
    c.add([g, qText(this, 0, -2, S.mergeTip, { size: 32, style: 'gold', font: FONT_BODY })]);
    this.tweens.add({ targets: c, y: ty - 8, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.tip = c;
    this.time.delayedCall(12000, () => { if (this.tip === c) { c.destroy(); this.tip = null; } });
  }

  // ───── 結算：寫進存檔，跳到結算頁 ─────
  finish(r) {
    if (this.ended) return;
    this.ended = true;
    this.infoLayer?.destroy();
    const rewards = this.mode ? save.finishEvent(r) : save.finishStage(r);
    this.time.delayedCall(r.win ? 900 : 1200, () => this.scene.start('Result', { result: r, rewards, bg: this.bgKey }));
  }

  // ───── 調試（網址加 ?debug） ─────
  makeDebug() {
    this.fpsText = this.add.text(16, 1500, '', { fontFamily: 'monospace', fontSize: '26px', color: '#ffffff', backgroundColor: '#00000088' }).setDepth(D.overlay + 1);
    const acts = [
      [S.dbgMana, () => { this.b.mana += 500; }],
      [S.dbgWave, () => { this.b.queue = []; this.b.skipWave(); }],
      [S.dbgKill, () => this.b.debugKillAll()],
      [S.dbgBoss, () => this.b.debugSpawnBoss()],
      [S.dbgWin, () => this.b.debugWin()],
    ];
    acts.forEach(([label, fn], i) => button(this, 120 + i * 170, 410, 156, 64, label, { color: 'grey', size: 26, onClick: fn }).setDepth(D.overlay + 1).setAlpha(0.85));
    this.input.keyboard.on('keydown-M', acts[0][1]);
    this.input.keyboard.on('keydown-N', acts[1][1]);
    this.input.keyboard.on('keydown-K', acts[2][1]);
    this.input.keyboard.on('keydown-B', acts[3][1]);
    this.input.keyboard.on('keydown-W', acts[4][1]);
    this.input.keyboard.on('keydown-S', () => this.b.summon());
  }
}

function lerp(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
