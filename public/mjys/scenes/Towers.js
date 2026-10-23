// 塔頁：出戰卡組 5 格、8 座塔卡片（等級、碎片進度）、詳情（屬性、升級、上陣）
import { W, H, CFG } from '../cfg.js';
import { S } from '../strings.js';
import { TOWERS, RARITY, TRAIT3 } from '../data/towers.js';
import { unlockStageOf } from '../data/stages.js';
import { save } from '../store.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, roundButton, panel, bar, OUT, GOLD, shade } from '../ui/widgets.js';
import { resourceBar, navBar, overlay, toast, DEPTH } from '../ui/common.js';
import { addTower } from '../ui/towerArt.js';
import { rarityFrame } from '../ui/skin.js';

const IDS = Object.keys(TOWERS);

export class TowersScene extends Phaser.Scene {
  constructor() { super('Towers'); }

  init(data) { this.picking = data.picking || null; this.reopen = data.open || null; this.upgradedId = data.upgraded || null; }

  create() {
    const d = save.d;
    const bgKey = this.textures.exists('bg_tower') ? 'bg_tower' : this.textures.exists('bg_home') ? 'bg_home' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x12061c, bgKey === 'bg_tower' ? 0.25 : 0.62).setOrigin(0);
    this.res = resourceBar(this);
    qText(this, 540, 205, `${S.power} ${save.power()}`, { size: 46, style: 'gold', font: FONT_BODY });

    // 出戰卡組
    panel(this, 540, 420, 1010, 280, { fill: 0x3a1a2a });
    qText(this, 540, 318, S.deckTitle, { size: 40, style: 'white' });
    this.slots = d.deck.map((id, k) => this.deckSlot(k, id));
    if (this.picking) this.startPicking(this.picking);

    // 全部塔
    qText(this, 540, 615, S.towersTitle, { size: 44 });
    // 12 座塔排 3 排：卡片縮 0.86 倍，才不會被下面的零件列蓋住
    IDS.forEach((id, i) => this.card(id, 165 + (i % 4) * 250, 790 + Math.floor(i / 4) * 272));
    // 零件庫存
    const pg = this.add.graphics();
    pg.fillStyle(0x000000, 0.4).fillRoundedRect(40, 1490, 1000, 110, 26);
    ['bolt', 'barrel', 'crystal', 'rune', 'universal'].forEach((k, i) => {
      const x = 120 + i * 200;
      this.add.image(x, 1545, 'part_' + k).setScale(0.95);
      qText(this, x + 38, 1545, String(save.d.parts[k]), { size: 34, font: FONT_NUM, origin: [0, 0.5] });
    });
    navBar(this, 'tower');
    if (this.reopen) this.detail(this.reopen);
    if (this.upgradedId) {
      toast(this, this.upgradedId, 540, 380, 'gold', 64);
      for (let i = 0; i < 12; i++) {
        const p = this.add.image(540, 600, 'spark').setTint(0xffe27a).setDepth(DEPTH.overlay + 10).setBlendMode('ADD');
        const a = i / 12 * Math.PI * 2;
        this.tweens.add({ targets: p, x: 540 + Math.cos(a) * 220, y: 600 + Math.sin(a) * 220, alpha: 0, scale: 0.2, duration: 600, onComplete: () => p.destroy() });
      }
    }
  }

  frame(g, x, y, w, h, rarity, dim) {
    const sk = rarityFrame(this, x, y, w, h, dim ? 0 : rarity); // 素材外框（container 裡用）
    if (sk) { g.parentContainer ? g.parentContainer.addAt(sk, 0) : null; g._skin = sk; if (dim) sk.setTint(0x777777); return; }
    const c = RARITY[rarity].color;
    g.fillStyle(OUT).fillRoundedRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 14, 22);
    g.fillStyle(dim ? 0x555a64 : c).fillRoundedRect(x - w / 2, y - h / 2, w, h, 18);
    g.fillStyle(dim ? 0x2a2c30 : shade(c, -0.55)).fillRoundedRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 13);
    g.fillStyle(0xffffff, 0.08).fillRoundedRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, (h - 14) * 0.45, { tl: 13, tr: 13, bl: 4, br: 4 });
  }

  deckSlot(k, id) {
    const x = 145 + k * 197, y = 440;
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    c.add(g);
    this.frame(g, 0, 0, 170, 190, TOWERS[id].rarity);
    c.add(addTower(this, 0, -18, id, 0, 136));
    c.add(qText(this, 0, 66, S.lv(save.d.towers[id].lv), { size: 30, font: FONT_NUM, style: 'gold' }));
    c.setSize(170, 190).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      if (this.picking) { save.setDeck(k, this.picking); this.scene.restart({}); return; }
      this.detail(id);
    });
    return c;
  }

  card(id, x, y) {
    const def = TOWERS[id], t = save.d.towers[id], locked = !t.owned, inDeck = save.d.deck.includes(id);
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    c.add(g);
    this.frame(g, 0, 0, 226, 300, def.rarity, locked);
    const img = addTower(this, 0, -50, id, 0, 165);
    if (locked) img.setTint(0x555555);
    c.add(img);
    c.add(qText(this, 0, 48, def.name, { size: 34 }));
    if (locked) {
      c.add(this.add.image(0, -50, 'ic_lock').setScale(1.3));
      c.add(qText(this, 0, 100, S.unlockAt(unlockStageOf(id)), { size: 24, font: FONT_BODY }));
    } else {
      const need = CFG.meta.frags(t.lv), ok = save.canUpgrade(id) === 'ok';
      c.add(qText(this, -88, 92, S.lv(t.lv), { size: 30, font: FONT_NUM, style: 'gold', origin: [0, 0.5] }));
      c.add(this.add.image(46, 92, 'ic_star').setScale(0.42));
      c.add(qText(this, 66, 92, String(t.star), { size: 28, font: FONT_NUM, origin: [0, 0.5] }));
      const bg = this.add.graphics();
      bg.fillStyle(OUT).fillRoundedRect(-92, 112, 184, 28, 14);
      bg.fillStyle(0x1a0c08).fillRoundedRect(-88, 115, 176, 22, 11);
      const r = Math.min(1, t.frag / need);
      if (r > 0) bg.fillStyle(ok ? 0x4cc93a : 0x3f8cff).fillRoundedRect(-88, 115, Math.max(22, 176 * r), 22, 11);
      c.add(bg);
      c.add(qText(this, 0, 126, `${t.frag}/${need}`, { size: 22, font: FONT_NUM }));
      if (ok) { // 可以升級：綠色箭頭跳動
        const ar = this.add.graphics();
        ar.fillStyle(OUT).fillTriangle(70, 78, 98, 78, 84, 56).fillRect(77, 76, 14, 22);
        ar.fillStyle(0x7aff5a).fillTriangle(73, 76, 95, 76, 84, 60).fillRect(80, 75, 8, 20);
        c.add(ar);
        this.tweens.add({ targets: ar, y: -8, duration: 500, yoyo: true, repeat: -1 });
      }
      if (inDeck) {
        const tag = this.add.graphics();
        tag.fillStyle(OUT).fillRoundedRect(-108, -146, 92, 40, 12);
        tag.fillStyle(0x4cc93a).fillRoundedRect(-105, -143, 86, 34, 10);
        c.add([tag, qText(this, -62, -126, S.inDeck, { size: 22 })]);
      }
    }
    const K = 0.86;
    c.setScale(K).setSize(226, 300).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(K * 0.96));
    c.on('pointerout', () => c.setScale(K));
    c.on('pointerup', () => { c.setScale(K); if (locked) toast(this, S.unlockAt(unlockStageOf(id)), x, y - 150, 'white', 34); else this.detail(id); });
  }

  detail(id) {
    const def = TOWERS[id], t = save.d.towers[id], inDeck = save.d.deck.includes(id);
    const c = overlay(this, 0.6);
    c.add(panel(this, 540, 975, 880, 1330, { fill: shade(RARITY[def.rarity].color, -0.6) }));
    c.add(this.add.image(540, 500, 'glow').setScale(5).setTint(RARITY[def.rarity].color).setAlpha(0.5).setBlendMode('ADD'));
    const tier = t.star >= 5 ? 2 : t.star >= 3 ? 1 : 0; // 星數越高，詳情裡的塔外觀越華麗
    const img = addTower(this, 540, 490, id, tier, 270);
    c.add(img);
    this.tweens.add({ targets: img, y: 478, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    for (let i = 0; i < CFG.parts.maxStar; i++) c.add(this.add.image(540 + (i - 2) * 58, 650, i < t.star ? 'ic_star' : 'ic_star_empty').setScale(0.8));
    c.add(qText(this, 540, 725, `${def.name}  ${S.lv(t.lv)}`, { size: 60, style: 'gold' }));
    const rg = this.add.graphics(), rc = RARITY[def.rarity].color;
    rg.fillStyle(OUT).fillRoundedRect(480, 766, 120, 44, 14);
    rg.fillStyle(rc).fillRoundedRect(484, 769, 112, 38, 11);
    c.add([rg, qText(this, 540, 788, RARITY[def.rarity].name, { size: 28 })]);
    c.add(qText(this, 540, 845, def.desc, { size: 34, font: FONT_BODY }));

    // 屬性
    const mul = save.towerMul(id), maxed = t.lv >= CFG.meta.maxLv;
    const next = mul / (1 + CFG.meta.atkPerLv * (t.lv - 1)) * (1 + CFG.meta.atkPerLv * t.lv);
    const rows = [];
    if (def.kind === 'mana') rows.push([S.statAtk, S.manaGen(def.manaPerLv), '']);
    else if (def.kind === 'aura') rows.push([S.statAtk, S.auraBuff(Math.round(def.auraPerLv * 100)), '']);
    else {
      rows.push([S.statAtk, String(Math.round(def.atk * mul)), maxed ? '' : '→ ' + Math.round(def.atk * next)]);
      rows.push([S.statRate, S.perShot(def.interval), '']);
      rows.push([S.statRange, def.range > 5000 ? S.rangeAll : String(def.range), '']);
    }
    rows.push([S.starLv(t.star), S.starBonus(Math.round(CFG.parts.starMul * 100 * (t.star - 1))), '']);
    rows.forEach(([k, v, n], i) => {
      const y = 915 + i * 54;
      c.add(qText(this, 200, y, k, { size: 34, font: FONT_BODY, origin: [0, 0.5] }));
      c.add(qText(this, 600, y, v, { size: 36, font: FONT_BODY, origin: [1, 0.5] }));
      if (n) c.add(qText(this, 630, y, n, { size: 36, font: FONT_NUM, style: 'green', origin: [0, 0.5] }));
    });
    const tr = TRAIT3[id];
    c.add(qText(this, 540, 915 + rows.length * 54 + 10, `${S.trait3}：${tr.desc}`, { size: 32, font: FONT_BODY, style: t.star >= 3 ? 'gold' : 'white' }).setAlpha(t.star >= 3 ? 1 : 0.55));

    // 碎片（升級）與零件（升星）進度
    const cost = save.upgradeCost(id), y0 = 1215;
    c.add(qText(this, 160, y0, S.frags, { size: 30, font: FONT_BODY, origin: [0, 0.5] }));
    const fb = bar(this, 270, y0 - 15, 250, 30, t.frag >= cost.frags ? 0x4cc93a : 0x3f8cff, { value: maxed ? 1 : Math.min(1, t.frag / cost.frags) });
    c.add([fb.frame, fb.fill, qText(this, 395, y0, maxed ? S.maxLevel : `${t.frag}/${cost.frags}`, { size: 26, font: FONT_NUM })]);
    const sc = save.starCost(id), part = save.partOf(id), P = save.d.parts;
    c.add(this.add.image(580, y0, 'part_' + part).setScale(0.7));
    if (sc) {
      const pb = bar(this, 615, y0 - 15, 190, 30, P[part] >= sc.n ? 0x4cc93a : 0xb05cff, { value: Math.min(1, P[part] / sc.n) });
      c.add([pb.frame, pb.fill, qText(this, 710, y0, `${P[part]}/${sc.n}`, { size: 26, font: FONT_NUM })]);
      if (sc.u) {
        c.add(this.add.image(850, y0, 'part_universal').setScale(0.6));
        c.add(qText(this, 875, y0, `${P.universal}/${sc.u}`, { size: 26, font: FONT_NUM, origin: [0, 0.5], style: P.universal >= sc.u ? 'white' : 'red' }));
      }
    } else c.add(qText(this, 700, y0, S.starMax, { size: 30, style: 'gold' }));

    // 三個按鈕：升級／升星／上陣
    const why = save.canUpgrade(id);
    const up = button(this, 260, 1350, 250, 130, '', {
      color: why === 'ok' ? 'yellow' : 'grey', clickDisabled: true,
      onClick: () => {
        const r = save.upgrade(id);
        if (r !== 'ok') { toast(this, r === 'max' ? S.maxLevel : r === 'frags' ? S.needFrags : S.needCoins, 540, 1180, 'red', 40); return; }
        this.cameras.main.flash(200, 255, 230, 140);
        this.scene.restart({ open: id, upgraded: S.upgraded });
      },
    });
    up.add(qText(this, 0, -24, maxed ? S.maxLevel : S.upgrade, { size: 44 }));
    if (!maxed) {
      up.add(this.add.image(-46, 30, 'ic_coin').setScale(0.55));
      up.add(qText(this, -20, 30, String(cost.coins), { size: 30, font: FONT_NUM, origin: [0, 0.5], style: save.d.coins >= cost.coins ? 'white' : 'red' }));
    }
    c.add(up);
    const st = save.canStar(id);
    const sb = button(this, 540, 1350, 250, 130, sc ? S.starUp : S.starMax, {
      color: st.why === 'ok' ? 'purple' : 'grey', size: 44, clickDisabled: true,
      onClick: () => {
        const r = save.starUp(id);
        if (r !== 'ok') { toast(this, r === 'max' ? S.starMax : S.needParts, 540, 1180, 'red', 40); return; }
        this.cameras.main.flash(260, 220, 160, 255);
        this.scene.restart({ open: id, upgraded: S.starUped });
      },
    });
    c.add(sb);
    const dk = button(this, 820, 1350, 250, 130, inDeck ? S.inDeck : S.toDeck, {
      color: inDeck ? 'grey' : 'blue', size: 44,
      onClick: () => { if (inDeck) return; c.destroy(); this.startPicking(id); },
    });
    c.add(dk);
    c.add(roundButton(this, 925, 340, 40, {
      color: 'red', kind: 'close', onClick: () => c.destroy(),
      icon: (g, r) => { g.lineStyle(10, 0xffffff).lineBetween(-r * 0.35, -r * 0.35, r * 0.35, r * 0.35).lineBetween(r * 0.35, -r * 0.35, -r * 0.35, r * 0.35); },
    }));
    c.dim.on('pointerup', () => c.destroy());
  }

  // 選要被換掉的卡組格子
  startPicking(id) {
    this.picking = id;
    toast(this, S.pickSlot, 540, 590, 'gold', 44);
    this.slots.forEach(s => this.tweens.add({ targets: s, scale: 1.08, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
  }
}
