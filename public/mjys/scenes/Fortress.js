// 要塞：城门／魔晶炉／工坊／宝库，升級吃金币＋需要總星數；宝库累積金币可領
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { save } from '../store.js';
import { BUILDINGS, FORT_IDS, fortCost } from '../data/fortress.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, OUT, GOLD } from '../ui/widgets.js';
import { resourceBar, navBar, toast, showRewards } from '../ui/common.js';

export class FortressScene extends Phaser.Scene {
  constructor() { super('Fortress'); }

  create() {
    const bgKey = this.textures.exists('bg_fortress') ? 'bg_fortress' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x12061c, 0.4).setOrigin(0);
    this.res = resourceBar(this);
    qText(this, 540, 215, S.fortTitle, { size: 80, style: 'gold', strokeW: 12 });
    this.add.image(470, 290, 'ic_star').setScale(0.6);
    qText(this, 500, 290, String(save.totalStars()), { size: 36, font: FONT_NUM, origin: [0, 0.5] });
    FORT_IDS.forEach((k, i) => this.card(k, 285 + (i % 2) * 510, 620 + Math.floor(i / 2) * 640));
    // 宝库每 10 秒更新一次累積數字
    this.time.addEvent({ delay: 10000, loop: true, callback: () => this.vaultText?.setText(S.vaultClaim(save.vaultPending())) });
    navBar(this, 'fort');
  }

  card(k, x, y) {
    const B = BUILDINGS[k], lv = save.fortLv(k), max = lv >= B.max, w = 480, h = 600;
    const g = this.add.graphics();
    g.fillStyle(OUT).fillRoundedRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 14, 26);
    g.fillStyle(GOLD).fillRoundedRect(x - w / 2, y - h / 2, w, h, 22);
    g.fillStyle(0x3a2216, 0.96).fillRoundedRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 17);
    qText(this, x, y - 255, B.name, { size: 50, style: 'gold' });
    qText(this, x, y - 208, `Lv${lv}/${B.max}`, { size: 34, font: FONT_NUM });
    const icon = this.add.image(x, y - 85, this.textures.exists(B.art) ? B.art : B.icon);
    icon.setScale(Math.min(185 / icon.height, 330 / icon.width)); // 建築圖放大（原本 140 太小）
    if (lv) qText(this, x, y + 32, B.desc(lv), { size: 26, font: FONT_BODY, wrap: w - 50 });
    if (!max) qText(this, x, y + (lv ? 70 : 45), '→ ' + B.desc(lv + 1), { size: 26, font: FONT_BODY, style: 'green', wrap: w - 50 });
    if (max) { qText(this, x, y + 190, S.maxLevel, { size: 44, style: 'gold' }); }
    else {
      const c = fortCost(lv + 1), why = save.fortCheck(k);
      qText(this, x, y + 118, S.needStars(c.stars), { size: 26, font: FONT_BODY, style: save.totalStars() >= c.stars ? 'white' : 'red' });
      const b = button(this, x, y + 215, 380, 100, '', {
        color: why === 'ok' ? 'yellow' : 'grey', clickDisabled: true,
        onClick: () => {
          const r = save.fortUp(k);
          if (r === 'ok') { this.cameras.main.flash(200, 255, 230, 140); this.scene.restart(); return; }
          toast(this, r === 'stars' ? S.needStars(c.stars) : S.needCoins, x, y, 'red', 36);
        },
      });
      b.add(qText(this, -60, -4, S.upgrade, { size: 40 }));
      b.add(this.add.image(30, -2, 'ic_coin').setScale(0.55));
      b.add(qText(this, 54, -4, String(c.coins), { size: 30, font: FONT_NUM, origin: [0, 0.5], style: save.d.coins >= c.coins ? 'white' : 'red' }));
    }
    if (k === 'vault' && lv) { // 寶庫：領取累積金币
      const b = button(this, x, y - 95, 300, 90, '', {
        color: 'green', onClick: () => { const n = save.claimVault(); if (n > 0) showRewards(this, [{ icon: 'ic_coin', n }], () => this.scene.restart()); },
      });
      b.setAlpha(0.95);
      this.vaultText = qText(this, 0, -4, S.vaultClaim(save.vaultPending()), { size: 32 });
      b.add(this.vaultText);
      icon.setAlpha(0.35);
    }
  }
}
