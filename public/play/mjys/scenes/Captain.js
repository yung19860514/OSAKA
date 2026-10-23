// 隊長頁：大圖（走路動畫）、被動／技能、升級、出戰、解鎖；下方四位切換
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { save } from '../store.js';
import { CAPTAINS, CAPTAIN_LV, CAPTAIN_IDS } from '../data/captains.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, panel, OUT, GOLD } from '../ui/widgets.js';
import { resourceBar, navBar, toast, confirmDialog, DEPTH } from '../ui/common.js';
import { captainSprite } from '../ui/towerArt.js';

export class CaptainScene extends Phaser.Scene {
  constructor() { super('Captain'); }

  init(data) { this.view = data.view || save.captainId(); }

  create() {
    const id = this.view, C = CAPTAINS[id], st = save.d.capts[id];
    const bgKey = this.textures.exists('bg_tower') ? 'bg_tower' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x12061c, 0.45).setOrigin(0);
    this.res = resourceBar(this);

    // 大圖：有待機影片就播動畫，沒有用靜態立繪；沒解鎖的變灰（看得到長相，但知道還沒有）
    const spr = captainSprite(this, id, 540, 880, 600);
    if (!st.owned) { spr.setTint(0x777788); spr.anims?.pause(); }
    else this.tweens.add({ targets: spr, scaleY: spr.scaleY * 1.015, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    qText(this, 540, 215, `${C.title} · ${C.name}`, { size: 64, style: 'gold' });
    if (st.owned) qText(this, 540, 285, `${S.lv(st.lv)}  ·  ${S.captainBonus(Math.round(CAPTAIN_LV.atkPerLv * 100 * (st.lv - 1)))}`, { size: 34, font: FONT_BODY });

    // 說明
    panel(this, 540, 1060, 1000, 330, { fill: 0x2a1a3a });
    qText(this, 90, 935, S.passive, { size: 34, style: 'gold', origin: [0, 0.5] });
    qText(this, 220, 935, C.passive, { size: 34, font: FONT_BODY, origin: [0, 0.5] });
    qText(this, 90, 1010, S.activeSkill, { size: 34, style: 'gold', origin: [0, 0.5] });
    qText(this, 220, 1010, C.skill, { size: 36, style: 'blue', origin: [0, 0.5] });
    qText(this, 220, 1065, C.skillDesc, { size: 30, font: FONT_BODY, origin: [0, 0.5], wrap: 780 });
    qText(this, 220, 1140, S.energyNeed(C.energy), { size: 28, font: FONT_BODY, origin: [0, 0.5] }).setAlpha(0.8);

    // 按鈕
    const y = 1310, inBattle = save.captainId() === id;
    if (st.owned) {
      const max = st.lv >= CAPTAIN_LV.max, cost = CAPTAIN_LV.coins(st.lv);
      const up = button(this, 330, y, 380, 130, '', {
        color: max ? 'grey' : 'yellow', clickDisabled: true,
        onClick: () => { const r = save.captainUp(id); if (r === 'ok') { this.cameras.main.flash(200, 255, 230, 140); this.scene.restart({ view: id }); } else toast(this, r === 'max' ? S.maxLevel : S.needCoins, 540, 1180, 'red', 40); },
      });
      up.add(qText(this, 0, -22, max ? S.maxLevel : S.upgrade, { size: 46 }));
      if (!max) { up.add(this.add.image(-50, 32, 'ic_coin').setScale(0.55)); up.add(qText(this, -24, 32, String(cost), { size: 32, font: FONT_NUM, origin: [0, 0.5] })); }
      button(this, 750, y, 380, 130, inBattle ? S.inBattle : S.setBattle, { color: inBattle ? 'grey' : 'green', size: 46, onClick: () => { if (!inBattle && save.selectCaptain(id)) this.scene.restart({ view: id }); } });
    } else {
      const u = C.unlock;
      if (u.type === 'gems') {
        const b = button(this, 540, y, 460, 130, '', {
          color: 'purple', onClick: () => confirmDialog(this, {
            title: C.name, lines: [S.unlockGems], price: { icon: 'ic_gem', n: u.price },
            onOk: () => { const r = save.buyCaptain(id); if (r === 'ok') this.scene.restart({ view: id }); else toast(this, S.notEnoughGems, 540, 1180, 'red', 40); },
          }),
        });
        b.add(qText(this, -40, -4, S.unlockGems, { size: 42 })); b.add(this.add.image(110, -2, 'ic_gem').setScale(0.6)); b.add(qText(this, 136, -4, String(u.price), { size: 34, font: FONT_NUM, origin: [0, 0.5] }));
      } else qText(this, 540, y, u.type === 'stage' ? S.unlockStage(u.n) : S.comingSoon, { size: 44, style: 'white' });
    }

    // 下方四位
    CAPTAIN_IDS.forEach((cid, i) => {
      const x = 180 + i * 240, yy = 1560, owned = save.d.capts[cid].owned, on = cid === id;
      const c = this.add.container(x, yy);
      const g = this.add.graphics();
      g.fillStyle(OUT).fillRoundedRect(-100, -100, 200, 210, 24);
      g.fillStyle(on ? GOLD : 0x6a3a2a).fillRoundedRect(-95, -95, 190, 200, 20);
      c.add(g);
      const av = this.add.image(0, -18, this.textures.exists('avatar_' + cid) ? 'avatar_' + cid : 'avatar_lia').setScale(1.15);
      if (!owned) av.setTint(0x777788);
      c.add([av, qText(this, 0, 72, CAPTAINS[cid].name, { size: 32 })]);
      if (save.captainId() === cid) { const tg = this.add.graphics(); tg.fillStyle(OUT).fillRoundedRect(-80, -122, 160, 44, 12); tg.fillStyle(0x4cc93a).fillRoundedRect(-76, -119, 152, 38, 10); c.add([tg, qText(this, 0, -100, S.inBattle, { size: 26 })]); }
      if (!owned) c.add(this.add.image(60, 40, 'ic_lock').setScale(0.8));
      c.setSize(200, 210).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => { if (!on) this.scene.restart({ view: cid }); });
    });
    navBar(this, 'captain');
  }
}
