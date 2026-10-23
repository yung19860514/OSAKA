// 圖鑑：塔（12 座，4 座之後上線）／怪物（18 種，沒遇過的顯示剪影）；點一下看說明
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { save } from '../store.js';
import { TOWERS, RARITY } from '../data/towers.js';
import { CODEX_TOWERS, CODEX_ENEMIES } from '../data/codex.js';
import { qText, FONT_BODY } from '../ui/qtext.js';
import { button, panel, OUT, shade } from '../ui/widgets.js';
import { resourceBar, navBar, toast, overlay, fixUI } from '../ui/common.js';
import { addTower, ALIAS } from '../ui/towerArt.js';

export class CodexScene extends Phaser.Scene {
  constructor() { super('Codex'); }

  init(data) { this.tab = data.tab || 'towers'; }

  preload() {
    // 其他章節的怪、還沒上線的塔：圖鑑要用時才載
    const m = this.cache.json.get('manifest') || {};
    for (const [key, s] of Object.entries(m.sheets || {})) {
      if ((key.startsWith('sheet_') || key.startsWith('tower_')) && !this.textures.exists(key)) this.load.spritesheet(key, 'assets/' + s.file, { frameWidth: s.w, frameHeight: s.h });
    }
  }

  create() {
    const bgKey = this.textures.exists('bg_tower') ? 'bg_tower' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x12061c, 0.6).setOrigin(0);
    this.res = resourceBar(this);
    ['towers', 'enemies'].forEach((t, i) => {
      const on = t === this.tab;
      button(this, 330 + i * 420, 220, 380, on ? 104 : 90, S.codexTabs[i], { color: on ? 'yellow' : 'red', size: on ? 44 : 38, onClick: () => { if (!on) this.scene.restart({ tab: t }); } });
    });
    if (this.tab === 'towers') this.towers(); else this.enemies();
    navBar(this, 'codex');
  }

  cell(x, y, w, h, color, draw, title, onTap) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(OUT).fillRoundedRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 10, 18);
    g.fillStyle(color).fillRoundedRect(-w / 2, -h / 2, w, h, 15);
    g.fillStyle(shade(color, -0.6)).fillRoundedRect(-w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 11);
    c.add(g);
    draw(c);
    c.add(qText(this, 0, h / 2 - 30, title, { size: 26, wrap: w - 10 }));
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerup', onTap);
  }

  towers() {
    CODEX_TOWERS.forEach((t, i) => {
      const id = typeof t === 'string' ? t : t.id, live = typeof t === 'string';
      const def = live ? TOWERS[id] : t, owned = live && save.d.towers[id].owned;
      const x = 160 + (i % 4) * 253, y = 470 + Math.floor(i / 4) * 330;
      this.cell(x, y, 230, 300, live ? RARITY[def.rarity].color : 0x555a64, c => {
        if (this.textures.exists('tower_' + id)) {
          const im = addTower(this, 0, -30, id, 0, 190);
          if (!owned) im.setTint(live ? 0x777777 : 0x222233);
          c.add(im);
        } else if (live) c.add(addTower(this, 0, -30, id, 0, 150));
        if (!live) c.add(qText(this, 0, -30, S.comingSoon, { size: 28 }));
      }, live || this.textures.exists('tower_' + id) ? def.name : S.unknown, () => this.info(def.name, def.desc, live ? RARITY[def.rarity].name : S.comingSoon));
    });
  }

  enemies() {
    CODEX_ENEMIES.forEach((e, i) => {
      const x = 145 + (i % 4) * 263, y = 430 + Math.floor(i / 4) * 290, seen = !!save.d.seen[e.id];
      this.cell(x, y, 240, 270, e.boss ? 0xa8231c : 0x6a4a2a, c => {
        const key = 'sheet_' + (e.art || e.id);
        if (this.textures.exists(key)) {
          const im = this.add.image(0, -25, key, 0);
          im.setScale(Math.min(190 / im.height, 200 / im.width));
          if (!seen) im.setTintFill(0x14081c);
          else if (ALIAS[e.id] && !this.textures.exists('sheet_' + e.id)) im.setTint(ALIAS[e.id].tint); // 精英：借一般怪的圖染色（跟戰鬥一樣）
          c.add(im);
        }
        c.add(qText(this, -90, -112, S.chapterOf(e.ch), { size: 22, font: FONT_BODY, origin: [0, 0.5] }));
      }, seen ? e.name : S.unknown, () => (seen ? this.info(e.name, e.desc, S.chapterOf(e.ch)) : toast(this, S.notMet, x, y - 160, 'white', 34)));
    });
  }

  info(name, desc, sub) {
    const c = overlay(this, 0.6);
    c.add(panel(this, 540, 960, 800, 420, { fill: 0x3a1a2a }));
    c.add(qText(this, 540, 850, name, { size: 64, style: 'gold' }));
    c.add(qText(this, 540, 930, sub, { size: 30, font: FONT_BODY }));
    c.add(qText(this, 540, 1020, desc, { size: 36, font: FONT_BODY, wrap: 700 }));
    fixUI(c);
    c.dim.on('pointerup', () => c.destroy());
  }
}
