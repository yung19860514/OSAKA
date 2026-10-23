// 登入頁：背景＋標題＋載入條（在這裡載入其餘正式素材）＋「开始游戏」
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { qText, FONT_BODY } from '../ui/qtext.js';
import { button, bar } from '../ui/widgets.js';
import { applyArtOverrides } from '../ui/towerArt.js';
import { TOWERS } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { applySkin } from '../ui/skin.js';
import { queueAssets } from '../ui/common.js';

export class LoginScene extends Phaser.Scene {
  constructor() { super('Login'); }

  create() {
    const bgKey = this.textures.exists('bg_login') ? 'bg_login' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    // 下方加深，標題與按鈕比較清楚
    const sh = this.add.graphics();
    for (let i = 0; i < 24; i++) sh.fillStyle(0x12061c, i / 24 * 0.75).fillRect(0, 1000 + i * 40, W, 40);

    // 標題：大字＋光暈＋輕微浮動
    const glow = this.add.image(540, 1180, 'glow').setScale(9, 4).setTint(0xffb84a).setAlpha(0.35).setBlendMode('ADD');
    this.tweens.add({ targets: glow, alpha: 0.6, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    let title;
    if (this.textures.exists('logo_0')) { // 素材 Logo（已經有「魔晶要塞」字，不用另外寫）
      title = this.add.image(540, 1180, 'logo_0');
      title.setScale(940 / title.width);
    } else {
      title = qText(this, 540, 1170, S.title, { size: 168, style: 'gold', strokeW: 22, shadowY: 14 });
      qText(this, 540, 1300, S.subtitle, { size: 54, style: 'blue' });
    }
    this.tweens.add({ targets: title, y: title.y - 15, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    qText(this, 540, 1880, S.version, { size: 26, font: FONT_BODY }).setAlpha(0.7);

    // 載入其餘素材
    const m = this.cache.json.get('manifest') || {};
    const loadBar = bar(this, 240, 1560, 600, 34, 0x8fd0ff, { value: 0 });
    const label = qText(this, 540, 1630, S.loading, { size: 34, font: FONT_BODY });
    const queued = queueAssets(this, m, 1);
    this.load.on('progress', v => { loadBar.set(v); label.setText(`${S.loading} ${Math.round(v * 100)}%`); });
    const ready = () => {
      applySkin(this);
      applyArtOverrides(this);
      loadBar.frame.destroy(); loadBar.fill.destroy(); label.destroy();
      const btn = button(this, 540, 1590, 460, 150, S.startGame, { color: 'yellow', size: 64, onClick: () => this.scene.start('Home') });
      btn.setScale(0.3);
      this.tweens.add({ targets: btn, scale: 1, duration: 300, ease: 'Back.Out' });
      this.tweens.add({ targets: btn, scale: 1.05, delay: 400, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    };
    if (queued) { this.load.once('complete', ready); this.load.start(); }
    else { loadBar.set(1); this.time.delayedCall(300, ready); }
  }
}
