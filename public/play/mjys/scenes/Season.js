// 賽季通行證：30 級，左免費線、右高級線（要買通行證），可上下捲動
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { save } from '../store.js';
import * as E from '../economy.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, panel, bar, OUT, GOLD } from '../ui/widgets.js';
import { resourceBar, backButton, showRewards, confirmDialog, rewardIcon, fixUI, toast, DEPTH } from '../ui/common.js';
import { giveIcon } from './Tasks.js';

const TOP = 640, ROW = 150;

export class SeasonScene extends Phaser.Scene {
  constructor() { super('Season'); }

  init(data) { this.keepScroll = data.scroll ?? null; }

  create() {
    const s = save.season(), lv = save.seasonLevel(), S2 = E.SEASON;
    const worldH = TOP + E.PASS.length * ROW + 120;
    const bgKey = this.textures.exists('bg_event') ? 'bg_event' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H).setScrollFactor(0);
    this.add.rectangle(0, 0, W, H, 0x12061c, 0.6).setOrigin(0).setScrollFactor(0);

    // ───── 捲動的獎勵列表 ─────
    const lineG = this.add.graphics();
    lineG.fillStyle(OUT).fillRect(530, TOP, 20, E.PASS.length * ROW);
    lineG.fillStyle(0x3a2a20).fillRect(534, TOP, 12, E.PASS.length * ROW);
    lineG.fillStyle(0xffc13b).fillRect(534, TOP, 12, Math.max(0, (lv - 0.5) * ROW));
    for (const p of E.PASS) this.row(p, lv, s.hasPremium);

    // ───── 固定在上面的標題區 ─────
    // 擋點擊：標題區下面是捲上去的獎勵格，不擋會點穿（放容器外，見 ui/common overlay 的說明）
    this.add.rectangle(0, 0, W, 600, 0x000000, 0.001).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.ui - 3).setInteractive();
    const head = this.add.container(0, 0).setDepth(DEPTH.ui - 2);
    const hg = this.add.graphics();
    hg.fillStyle(0x1a0a24, 0.97).fillRect(0, 0, W, 600);
    hg.fillStyle(GOLD).fillRect(0, 596, W, 4);
    head.add(hg);
    head.add(qText(this, 540, 200, S.seasonName(save.seasonNo()), { size: 64, style: 'gold' }));
    head.add(qText(this, 540, 262, S.seasonDays(save.seasonDaysLeft()) + '  ·  ' + S.seasonExpTip, { size: 24, font: FONT_BODY, wrap: 960 }));
    head.add(this.add.image(120, 345, 'side_season').setScale(1.05));
    head.add(qText(this, 200, 320, S.seasonLv(lv), { size: 44, style: 'gold', origin: [0, 0.5] }));
    const into = s.exp - (lv - 1) * S2.expPerLv, maxed = lv >= S2.levels;
    const eb = bar(this, 200, 352, 560, 30, 0xb05cff, { value: maxed ? 1 : into / S2.expPerLv });
    head.add([eb.frame, eb.fill, qText(this, 480, 367, maxed ? 'MAX' : `${into}/${S2.expPerLv}`, { size: 24, font: FONT_NUM })]);
    if (E.passAnyClaimable()) {
      head.add(button(this, 900, 345, 260, 100, S.claimAll, { color: 'green', size: 38, onClick: () => { const got = E.claimPassAll(); showRewards(this, got, () => this.restartKeep()); } }));
    }
    if (!s.hasPremium) {
      const P = E.PASS_BUY.premium;
      const b = button(this, 540, 470, 560, 120, '', {
        color: 'yellow',
        onClick: () => confirmDialog(this, {
          title: P.name, lines: [P.desc], price: { icon: 'ic_gem', n: P.gems },
          onOk: () => { const r = E.buyPass(); if (r.why === 'gems') { toast(this, S.notEnoughGems, 540, 700, 'red', 48); return; } toast(this, P.name, 540, 700, 'gold', 60); this.restartKeep(); },
        }),
      });
      b.add(qText(this, -60, -4, S.passUnlock, { size: 40 }));
      b.add(this.add.image(150, -2, 'ic_gem').setScale(0.6));
      b.add(qText(this, 178, -4, String(P.gems), { size: 36, font: FONT_NUM, origin: [0, 0.5] }));
      head.add(b);
    } else head.add(qText(this, 540, 470, S.premiumOwned, { size: 44, style: 'gold' }));
    head.add(qText(this, 270, 560, S.freeTrack, { size: 36 }));
    head.add(qText(this, 810, 560, S.premiumTrack, { size: 36, style: 'gold' }));
    fixUI(head);
    backButton(this, () => this.scene.start('Home'));
    resourceBar(this);

    // ───── 捲動 ─────
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, Math.max(H, worldH));
    const target = this.keepScroll ?? Phaser.Math.Clamp(TOP + (lv - 3) * ROW - 600, 0, worldH - H);
    cam.scrollY = Phaser.Math.Clamp(target, 0, Math.max(0, worldH - H));
    this.input.on('pointerdown', p => { this.drag = { y: p.y, scroll: cam.scrollY, moved: 0 }; });
    this.input.on('pointermove', p => {
      if (!this.drag || !p.isDown) return;
      const dy = p.y - this.drag.y;
      this.drag.moved = Math.max(this.drag.moved, Math.abs(dy));
      cam.scrollY = Phaser.Math.Clamp(this.drag.scroll - dy, 0, Math.max(0, worldH - H));
    });
    this.input.on('pointerup', () => { this.drag = null; });
    this.input.on('wheel', (p, o, dx, dy) => { cam.scrollY = Phaser.Math.Clamp(cam.scrollY + dy, 0, Math.max(0, worldH - H)); });
  }

  restartKeep() { this.scene.restart({ scroll: this.cameras.main.scrollY }); }

  row(p, lv, premium) {
    const y = TOP + (p.lv - 1) * ROW + ROW / 2, reached = p.lv <= lv;
    // 中間等級圈
    const g = this.add.graphics();
    g.fillStyle(OUT).fillCircle(540, y, 40);
    g.fillStyle(reached ? 0xffc13b : 0x6a6e78).fillCircle(540, y, 34);
    qText(this, 540, y - 2, String(p.lv), { size: 34, font: FONT_NUM });
    for (const [track, x] of [['free', 270], ['premium', 810]]) {
      const claimed = save.season()[track].includes(p.lv);
      const can = E.passClaimable(p.lv, track);
      const lockedPrem = track === 'premium' && !premium;
      const cg = this.add.graphics();
      cg.fillStyle(OUT).fillRoundedRect(x - 190, y - 62, 380, 128, 20);
      cg.fillStyle(can ? 0x4cc93a : track === 'premium' ? 0xb07a20 : 0x8a5a2a).fillRoundedRect(x - 186, y - 58, 372, 120, 17);
      cg.fillStyle(can ? 0x1a3a14 : 0x2a1a10).fillRoundedRect(x - 180, y - 52, 360, 108, 14);
      const gi = giveIcon(p[track]);
      rewardIcon(this, x - 80, y, gi, 76);
      qText(this, x + 10, y, '×' + gi.n, { size: 36, font: FONT_NUM, origin: [0, 0.5] });
      if (claimed) { this.add.rectangle(x, y + 2, 360, 108, 0x000000, 0.5); this.add.image(x + 130, y, 'ic_star').setScale(0.8).setTint(0x7aff5a); }
      else if (lockedPrem) this.add.image(x + 140, y, 'ic_lock').setScale(0.8);
      else if (!reached) this.add.rectangle(x, y + 2, 360, 108, 0x000000, 0.35);
      if (can) {
        const z = this.add.zone(x, y, 380, 128).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => {
          if (this.drag && this.drag.moved > 14) return;
          const got = E.claimPass(p.lv, track);
          if (got) showRewards(this, got, () => this.restartKeep());
        });
      }
    }
  }
}
