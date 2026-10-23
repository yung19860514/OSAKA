// 結算頁：勝負、星星、統計、獎勵、解鎖新塔、下一關／重試／返回
import { W, H, CFG } from '../cfg.js';
import { S } from '../strings.js';
import { TOWERS } from '../data/towers.js';
import { STAGE_COUNT } from '../data/stages.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, panel } from '../ui/widgets.js';
import { storyAfter } from '../data/story.js';
import { save } from '../store.js';
import { addTower } from '../ui/towerArt.js';
import { startStage, startEvent } from '../ui/common.js';
import { CAPTAINS } from '../data/captains.js';
import { chapterOf } from '../data/stages.js';
import { ensureChapter } from '../ui/common.js';

export class ResultScene extends Phaser.Scene {
  constructor() { super('Result'); }

  init(data) { this.r = data.result; this.rw = data.rewards; this.bg = data.bg; }

  create() {
    if (this.r.mode && this.r.mode !== 'main') { this.eventResult(); return; }
    const r = this.r, rw = this.rw, win = r.win;
    const bg = win && this.textures.exists('bg_victory') ? 'bg_victory' : !win && this.textures.exists('bg_defeat') ? 'bg_defeat' : this.bg;
    if (bg && this.textures.exists(bg)) this.add.image(0, 0, bg).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, win ? 0x1a0a04 : 0x0a0a1a, 0.72).setOrigin(0);
    if (win) {
      const glow = this.add.image(540, 430, 'glow').setScale(16, 10).setTint(0xffb84a).setAlpha(0.5).setBlendMode('ADD');
      this.tweens.add({ targets: glow, alpha: 0.75, duration: 1200, yoyo: true, repeat: -1 });
      for (let i = 0; i < 40; i++) this.confetti(i);
    }
    panel(this, 540, 1080, 860, 1150, { fill: win ? 0x5a1f1a : 0x2a2440 });
    qText(this, 540, 535, S.stageTitle(r.stage), { size: 44, font: FONT_BODY });
    const title = this.titleArt(win ? 1 : 2, 300) || qText(this, 540, 300, win ? S.win : S.lose, { size: 170, style: win ? 'gold' : 'red', strokeW: 22, shadowY: 14 });
    const ts = title.scale;
    title.setScale(ts * 0.2);
    this.tweens.add({ targets: title, scale: ts, duration: 450, ease: 'Back.Out' });

    let y = 660;
    if (win) {
      for (let i = 0; i < 3; i++) {
        const x = 540 + (i - 1) * 180, sy = i === 1 ? y - 20 : y;
        const big = this.textures.exists('ui_misc_1'), ks = big ? 140 / this.textures.getFrame('ui_misc_1').height : 2.2;
        this.add.image(x, sy, big ? 'ui_misc_2' : 'ic_star_empty').setScale(ks);
        if (i < r.stars) {
          const s = this.add.image(x, sy, big ? 'ui_misc_1' : 'ic_star').setScale(ks * 2.3).setAlpha(0);
          this.tweens.add({ targets: s, scale: ks, alpha: 1, delay: 500 + i * 300, duration: 260, ease: 'Back.Out', onStart: () => this.cameras.main.shake(90, 0.005) });
        }
      }
      y += 130;
    }
    const mm = Math.floor(r.time / 60), ss = String(Math.floor(r.time % 60)).padStart(2, '0');
    [S.kills(r.kills), S.gateLeft(r.gate), S.timeUsed(`${mm}:${ss}`)].forEach((t, i) => qText(this, 540, y + i * 58, t, { size: 40, font: FONT_BODY }));
    y += 210;

    if (win) {
      qText(this, 540, y, rw.first ? S.rewards + ' · ' + S.firstClear : S.rewards, { size: 40, style: 'gold', font: FONT_BODY });
      const items = [['ic_coin', rw.coins]];
      if (rw.diamonds) items.push(['ic_gem', rw.diamonds]);
      for (const f of rw.frags) items.push([{ tower: f.id }, f.n]);
      items.forEach(([icon, n], i) => {
        const x = 540 + (i - (items.length - 1) / 2) * 190, iy = y + 100;
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.35).fillRoundedRect(x - 80, iy - 70, 160, 150, 20);
        const im = icon.tower ? addTower(this, x, iy - 12, icon.tower, 0, 104) : this.add.image(x, iy - 12, icon).setScale(1.3);
        const t = qText(this, x, iy + 52, '×' + n, { size: 36, font: FONT_NUM });
        for (const o of [g, im, t]) { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, delay: 1300 + i * 150, duration: 200 }); }
        im.setScale(im.scale * 1.6);
        this.tweens.add({ targets: im, scale: im.scale / 1.6, delay: 1300 + i * 150, duration: 260, ease: 'Back.Out' });
      });
      y += 220;
      if (rw.newCaptain) {
        const t = qText(this, 540, y + 110, S.newCaptain(CAPTAINS[rw.newCaptain].name), { size: 40, style: 'gold' }).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, delay: 2300, duration: 300 });
      }
      if (rw.unlocked.length) {
        const id = rw.unlocked[0];
        const tw = addTower(this, 400, y + 30, id, 0, 136);
        const ts = tw.scale;
        tw.setScale(0.1);
        this.tweens.add({ targets: tw, scale: ts, delay: 2000, duration: 380, ease: 'Back.Out' });
        const t = qText(this, 470, y + 30, S.newTower(TOWERS[id].name), { size: 40, style: 'green', origin: [0, 0.5] }).setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, delay: 2100, duration: 300 });
      }
    }

    // 打完章節最後一關（第一次）先播結尾劇情再回地圖
    const sid = win && rw.first ? storyAfter(r.stage) : null;
    const back = () => {
      const ch = chapterOf(Math.min(STAGE_COUNT, r.stage + (win && rw.first ? 1 : 0)));
      if (sid && !save.d.story[sid]) ensureChapter(this, ch, () => this.scene.start('Story', { id: sid, next: { scene: 'StageMap', data: { ch } } }));
      else ensureChapter(this, ch, () => this.scene.start('StageMap', { ch }));
    };
    if (win && r.stage < STAGE_COUNT && !(sid && !save.d.story[sid])) { // 有結尾劇情要先看，不給「下一关」
      this.goBtn(1440, S.next, () => startStage(this, r.stage + 1));
      button(this, 540, 1570, 340, 100, S.back, { color: 'blue', onClick: back });
    } else if (win) {
      button(this, 540, 1500, 400, 130, S.back, { color: 'yellow', onClick: back });
    } else {
      this.goBtn(1440, S.retry, () => startStage(this, r.stage));
      button(this, 540, 1570, 340, 100, S.back, { color: 'blue', onClick: back });
    }
  }

  // 活動結算：零件工坊＝勝負＋零件；無盡＝撐過幾波＋最佳紀錄＋金币零件
  eventResult() {
    const r = this.r, rw = this.rw, endless = r.mode === 'endless', win = r.win || endless;
    if (this.textures.exists(this.bg)) this.add.image(0, 0, this.bg).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x0a0410, 0.72).setOrigin(0);
    if (win) for (let i = 0; i < 30; i++) this.confetti(i);
    panel(this, 540, 1000, 860, 1000, { fill: endless ? 0x2a1a3a : 0x3a2a14 });
    const title = (!endless && this.titleArt(r.win ? 1 : 2, 330)) || qText(this, 540, 330, endless ? S.endlessOver : r.win ? S.win : S.lose, { size: endless ? 130 : 170, style: endless ? 'purple' : r.win ? 'gold' : 'red', strokeW: 20, shadowY: 12 });
    const ts = title.scale;
    title.setScale(ts * 0.2);
    this.tweens.add({ targets: title, scale: ts, duration: 450, ease: 'Back.Out' });
    qText(this, 540, 560, endless ? S.endless : `${S.workshop} · ${S.levelNames[r.level]}`, { size: 44, font: FONT_BODY });
    let y = 660;
    if (endless) {
      qText(this, 540, y, S.survived(r.waves), { size: 70, style: 'gold' });
      qText(this, 540, y + 80, S.bestWave(save.d.endlessBest), { size: 38, font: FONT_BODY });
      if (rw.record) {
        const t = qText(this, 800, y - 40, S.newRecord, { size: 40, style: 'red' }).setAngle(12);
        this.tweens.add({ targets: t, scale: 1.15, duration: 400, yoyo: true, repeat: -1 });
      }
      y += 170;
    } else {
      const mm = Math.floor(r.time / 60), ss = String(Math.floor(r.time % 60)).padStart(2, '0');
      [S.kills(r.kills), S.timeUsed(`${mm}:${ss}`)].forEach((t, i) => qText(this, 540, y + i * 58, t, { size: 40, font: FONT_BODY }));
      y += 150;
    }
    qText(this, 540, y, S.rewards, { size: 40, style: 'gold', font: FONT_BODY });
    const items = [];
    if (rw.coins) items.push(['ic_coin', rw.coins]);
    for (const p of rw.parts) items.push(['part_' + p.id, p.n]);
    items.forEach(([icon, n], i) => {
      const per = Math.min(190, 760 / Math.max(1, items.length));
      const x = 540 + (i - (items.length - 1) / 2) * per, iy = y + 110;
      const g = this.add.graphics();
      g.fillStyle(0x000000, 0.35).fillRoundedRect(x - per / 2 + 8, iy - 70, per - 16, 150, 20);
      const im = this.add.image(x, iy - 12, icon).setScale(1.2);
      const t = qText(this, x, iy + 52, '×' + n, { size: 34, font: FONT_NUM });
      for (const o of [g, im, t]) { o.setAlpha(0); this.tweens.add({ targets: o, alpha: 1, delay: 700 + i * 120, duration: 200 }); }
    });
    if (!items.length) qText(this, 540, y + 110, '-', { size: 40 });
    const left = save.triesLeft(r.mode);
    const back = () => this.scene.start('Event');
    if (left > 0) {
      button(this, 540, 1380, 460, 130, S.again2(left), { color: 'yellow', size: 46, onClick: () => startEvent(this, r.mode, r.level || 0) });
      button(this, 540, 1530, 340, 100, S.back, { color: 'blue', onClick: back });
    } else button(this, 540, 1420, 400, 130, S.back, { color: 'yellow', onClick: back });
  }

  // 「胜利」「失败」字圖（txt_battle_1／2）
  titleArt(i, y) {
    if (!this.textures.exists('txt_battle_' + i)) return null;
    const im = this.add.image(540, y, 'txt_battle_' + i).setDepth(5);
    im.setScale(560 / im.width);
    return im;
  }

  goBtn(y, label, cb) {
    const b = button(this, 540, y, 460, 140, '', { color: 'yellow', onClick: cb });
    b.add(qText(this, -40, -4, label, { size: 58 }));
    b.add(this.add.image(90, -2, 'ic_energy').setScale(0.6));
    b.add(qText(this, 116, -2, '×' + CFG.stamina.cost, { size: 34, font: '"Lilita One", sans-serif', origin: [0, 0.5] }));
    return b;
  }

  confetti(i) {
    const colors = [0xffd34a, 0xff5a7a, 0x5ac8ff, 0x7aff7a, 0xffffff];
    const p = this.add.rectangle(Phaser.Math.Between(0, W), -40 - Math.random() * 600, 14, 22, colors[i % colors.length]).setAngle(Math.random() * 360);
    this.tweens.add({
      targets: p, y: H + 60, angle: p.angle + 720, x: p.x + Phaser.Math.Between(-150, 150),
      duration: 2600 + Math.random() * 2000, delay: Math.random() * 1500, repeat: -1,
    });
  }
}
