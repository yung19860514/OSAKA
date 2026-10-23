// 劇情對話：頭像＋名字＋對話框，字一個一個跑出來；點一下下一句，右上「跳过」
// 播完（或跳過）記進存檔，然後切到 next（例如 { scene: 'Battle', data: { stage: 1 } }）
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { STORY, CHARS } from '../data/story.js';
import { save } from '../store.js';
import { qText, FONT_BODY } from '../ui/qtext.js';
import { button, OUT, GOLD } from '../ui/widgets.js';
import { standArt, captainSprite } from '../ui/towerArt.js';
import { panelSkin } from '../ui/skin.js';

export class StoryScene extends Phaser.Scene {
  constructor() { super('Story'); }

  init(data) { this.id = data.id; this.next = data.next || { scene: 'Home' }; }

  create() {
    const st = STORY[this.id];
    if (!st) { this.done(); return; }
    this.lines = st.lines;
    this.i = -1;
    const c = st.chapter || 1;
    const bgKey = this.textures.exists('bg_battle_ch' + c) ? 'bg_battle_ch' + c : this.textures.exists('bg_battle_ch1') ? 'bg_battle_ch1' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x0a0410, 0.55).setOrigin(0);

    // 兩邊各一個頭像位置（說話的亮、沒說話的暗）
    this.portraits = {};
    for (const [key, c] of Object.entries(CHARS)) {
      const x = c.side === 'left' ? 270 : 810;
      const art = standArt(this, key);
      let img;
      if (['lia', 'borg', 'karl', 'elsa'].includes(key)) { // 隊長：有待機影片就會動
        img = captainSprite(this, key, x, 1420, 760);
        img.standY = 1420;
      } else if (art) { // 立繪：腳站在對話框上緣
        img = this.add.image(x, 1420, art.key, art.frame).setOrigin(0.5, 1);
        img.setScale(Math.min(780 / img.height, 560 / img.width));
        img.standY = 1420;
      } else {
        img = this.add.image(x, 1150, c.tex).setScale(2.6);
        img.standY = 1150;
      }
      img.setAlpha(0);
      this.portraits[key] = img;
    }

    // 對話框
    if (!panelSkin(this, 540, 1594, 1000, 410, null, 2)) { // 素材：羊皮紙面板
      const g = this.add.graphics();
      g.fillStyle(OUT).fillRoundedRect(36, 1384, 1008, 420, 34);
      g.fillStyle(GOLD).fillRoundedRect(42, 1390, 996, 408, 30);
      g.fillStyle(0xfff4dc).fillRoundedRect(52, 1400, 976, 388, 26);
      g.fillStyle(0xf0dcb4).fillRoundedRect(52, 1690, 976, 98, { tl: 0, tr: 0, bl: 26, br: 26 });
    }
    this.nameBox = this.add.container(0, 1390).setDepth(5);
    this.nameG = this.add.graphics();
    this.nameT = qText(this, 0, 0, '', { size: 48, style: 'gold' });
    this.nameBox.add([this.nameG, this.nameT]);
    this.text = qText(this, 96, 1450, ' ', { size: 50, style: 'dark', font: FONT_BODY, origin: [0, 0], align: 'left', wrap: 890, strokeW: 0, shadowY: 0, lineSpacing: 14 });
    this.hint = qText(this, 540, 1745, S.tapNext, { size: 30, font: FONT_BODY, style: 'dark' });
    this.tweens.add({ targets: this.hint, alpha: 0.3, duration: 600, yoyo: true, repeat: -1 });

    button(this, 960, 90, 180, 76, S.skip, { color: 'grey', size: 34, onClick: () => this.done() });
    this.input.on('pointerup', (p, objs) => { if (!objs.length) this.advance(); });
    this.advance();
  }

  advance() {
    if (this.typing) { // 還在跑字：直接顯示整句
      this.typing.remove();
      this.typing = null;
      this.text.setText(this.full);
      return;
    }
    this.i++;
    if (this.i >= this.lines.length) { this.done(); return; }
    const [who, line] = this.lines[this.i];
    const c = CHARS[who];
    for (const [key, img] of Object.entries(this.portraits)) {
      const on = key === who, side = CHARS[key].side;
      // 同一邊只顯示正在說話的那位（或該邊最後說話的）
      if (on) {
        this.tweens.killTweensOf(img);
        img.setAlpha(1).clearTint().setDepth(2);
        img.y = img.standY + 20;
        this.tweens.add({ targets: img, y: img.standY, duration: 200, ease: 'Back.Out' });
      } else if (side === c.side) img.setAlpha(0);
      else if (img.alpha > 0) img.setTint(0x666677).setDepth(1);
    }
    // 名字牌
    const nx = c.side === 'left' ? 230 : 850;
    this.nameT.setText(c.name);
    const w = this.nameT.width + 60;
    this.nameG.clear();
    this.nameG.fillStyle(OUT).fillRoundedRect(nx - w / 2 - 5, -42, w + 10, 84, 22);
    this.nameG.fillStyle(0x9a2420).fillRoundedRect(nx - w / 2, -37, w, 74, 18);
    this.nameT.setX(nx);
    // 逐字
    this.full = line;
    this.text.setText('');
    let k = 0;
    this.typing = this.time.addEvent({
      delay: 38, repeat: line.length - 1,
      callback: () => {
        k++;
        this.text.setText(line.slice(0, k));
        if (k >= line.length) this.typing = null;
      },
    });
  }

  done() {
    if (this.finished) return;
    this.finished = true;
    if (this.id) save.markStory(this.id);
    this.scene.start(this.next.scene, this.next.data || {});
  }
}
