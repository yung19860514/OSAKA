// 活動頁：零件工坊（每日 3 次、4 個難度）、無盡深淵（每日 2 次）、Boss 突袭／哥布林宝藏（之後開放）
import { W, H, CFG } from '../cfg.js';
import { S } from '../strings.js';
import { save } from '../store.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, panel, OUT, GOLD, shade } from '../ui/widgets.js';
import { resourceBar, backButton, toast, startEvent, DEPTH } from '../ui/common.js';

export class EventScene extends Phaser.Scene {
  constructor() { super('Event'); }

  create() {
    const bgKey = this.textures.exists('bg_event') ? 'bg_event' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x12061c, 0.45).setOrigin(0);
    backButton(this, () => this.scene.start('Home'));
    resourceBar(this);
    qText(this, 540, 215, S.eventTitle, { size: 80, style: 'gold', strokeW: 12 });
    this.workshop();
    this.endless();
    this.locked(300, 1560, S.bossRaid, S.weekendOnly);
    this.locked(780, 1560, S.treasure, S.comingSoon);
    if (false) { // 【平台】關閉 ?debug
      button(this, 540, 1800, 260, 80, S.dbgTries, { color: 'grey', size: 30, onClick: () => { save.today().workshop = 0; save.today().endless = 0; save.write(); this.scene.restart(); } });
    }
  }

  workshop() {
    const WS = CFG.events.workshop, part = save.todayPart(), left = save.triesLeft('workshop');
    panel(this, 540, 610, 1000, 520, { fill: 0x3a2a14 });
    qText(this, 90, 410, S.workshop, { size: 58, style: 'gold', origin: [0, 0.5] });
    qText(this, 90, 470, S.workshopDesc, { size: 30, font: FONT_BODY, origin: [0, 0.5] });
    qText(this, 990, 410, S.triesLeft(left, save.triesMax('workshop')), { size: 32, font: FONT_BODY, origin: [1, 0.5], style: left ? 'green' : 'red' });
    this.add.image(640, 470, 'part_' + part).setScale(0.8);
    qText(this, 680, 470, S.todayPart(S.partName[part]), { size: 32, font: FONT_BODY, origin: [0, 0.5], style: 'gold' });
    WS.levels.forEach((L, i) => {
      const x = 170 + i * 247, y = 660, open = save.d.cleared >= L.need;
      const c = this.add.container(x, y);
      const g = this.add.graphics();
      const col = open ? [0x4cc93a, 0x3f8cff, 0xb05cff, 0xe8453a][i] : 0x6a6e78;
      g.fillStyle(OUT).fillRoundedRect(-112, -122, 224, 250, 22);
      g.fillStyle(shade(col, -0.35)).fillRoundedRect(-106, -116, 212, 238, 18);
      g.fillStyle(col).fillRoundedRect(-106, -116, 212, 70, { tl: 18, tr: 18, bl: 4, br: 4 });
      c.add(g);
      c.add(qText(this, 0, -80, S.levelNames[i], { size: 42 }));
      if (open) {
        c.add(this.add.image(0, 10, 'part_' + part).setScale(1.3));
        c.add(qText(this, 0, 80, '×' + L.reward, { size: 40, font: FONT_NUM }));
      } else {
        c.add(this.add.image(0, 10, 'ic_lock').setScale(1.2));
        c.add(qText(this, 0, 80, S.unlockAt(L.need), { size: 22, font: FONT_BODY, wrap: 190 }));
      }
      c.setSize(224, 250).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => c.setScale(0.95));
      c.on('pointerout', () => c.setScale(1));
      c.on('pointerup', () => {
        c.setScale(1);
        if (!open) { toast(this, S.unlockAt(L.need), x, y - 150, 'white', 32); return; }
        startEvent(this, 'workshop', i);
      });
    });
  }

  endless() {
    const E = CFG.events.endless, left = save.triesLeft('endless');
    panel(this, 540, 1135, 1000, 380, { fill: 0x2a1a3a });
    qText(this, 90, 1010, S.endless, { size: 58, style: 'purple', origin: [0, 0.5] });
    qText(this, 90, 1070, S.endlessDesc, { size: 30, font: FONT_BODY, origin: [0, 0.5] });
    qText(this, 990, 1010, S.triesLeft(left, save.triesMax('endless')), { size: 32, font: FONT_BODY, origin: [1, 0.5], style: left ? 'green' : 'red' });
    qText(this, 90, 1150, S.bestWave(save.d.endlessBest), { size: 40, style: 'gold', origin: [0, 0.5] });
    // 獎勵預覽：金币、四種零件、万能零件
    const icons = ['ic_coin', 'part_bolt', 'part_barrel', 'part_crystal', 'part_rune', 'part_universal'];
    icons.forEach((k, i) => this.add.image(110 + i * 70, 1230, k).setScale(0.75));
    const b = button(this, 830, 1200, 280, 120, S.challenge, { color: left ? 'purple' : 'grey', size: 50, onClick: () => startEvent(this, 'endless') });
    b.setDepth(DEPTH.ui);
  }

  locked(x, y, title, sub) {
    panel(this, x, y, 460, 200, { fill: 0x2a2a30, rim: 0x8a8a90 });
    qText(this, x, y - 30, title, { size: 46 });
    qText(this, x, y + 40, sub, { size: 30, font: FONT_BODY }).setAlpha(0.8);
  }
}
