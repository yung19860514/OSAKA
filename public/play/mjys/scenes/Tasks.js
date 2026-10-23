// 任務頁：每日任務（6 項＋全部完成大獎）／七日簽到
import { W, H } from '../cfg.js';
import { S } from '../strings.js';
import { save } from '../store.js';
import * as E from '../economy.js';
import { qText, FONT_BODY, FONT_NUM } from '../ui/qtext.js';
import { button, panel, bar, OUT, GOLD, shade } from '../ui/widgets.js';
import { resourceBar, backButton, showRewards, rewardIcon, DEPTH } from '../ui/common.js';

// 任務的「前往」去哪裡
const GO = { mainBattles: 'StageMap', merges: 'StageMap', kills: 'StageMap', staminaUsed: 'StageMap', eventBattles: 'Event' };

// give → 顯示用的第一個圖示
function giveIcon(give) {
  if (give.gems) return { icon: 'ic_gem', n: give.gems };
  if (give.coins) return { icon: 'ic_coin', n: give.coins };
  if (give.stamina) return { icon: 'ic_energy', n: give.stamina };
  if (give.randomParts) return { icon: 'part_bolt', n: give.randomParts };
  if (give.parts) { const [k, n] = Object.entries(give.parts)[0]; return { icon: 'part_' + k, n }; }
  if (give.chests) { const [k, n] = Object.entries(give.chests)[0]; return { icon: { normal: 'chest1', rare: 'chest2', legend: 'chest3' }[k], n }; }
  return { icon: 'ic_gift', n: 1 };
}
export { giveIcon };

export class TasksScene extends Phaser.Scene {
  constructor() { super('Tasks'); }

  init(data) { this.tab = data.tab || 'tasks'; }

  create() {
    const bgKey = this.textures.exists('bg_home') ? 'bg_home' : 'bg_menu_gen';
    this.add.image(0, 0, bgKey).setOrigin(0).setDisplaySize(W, H);
    this.add.rectangle(0, 0, W, H, 0x12061c, 0.6).setOrigin(0);
    backButton(this, () => this.scene.start('Home'));
    this.res = resourceBar(this);
    ['tasks', 'signin'].forEach((t, i) => {
      const on = t === this.tab;
      button(this, 330 + i * 420, 220, 380, on ? 104 : 90, S.taskTabs[i], { color: on ? 'yellow' : 'red', size: on ? 44 : 38, onClick: () => { if (!on) this.scene.restart({ tab: t }); } });
    });
    if (this.tab === 'tasks') this.tasks(); else this.signin();
  }

  tasks() {
    const list = E.taskState();
    list.forEach((k, i) => {
      const y = 400 + i * 190;
      panel(this, 540, y, 1000, 170, { fill: k.claimed ? 0x2a2a30 : 0x3a2a14, rim: k.claimed ? 0x8a8a90 : GOLD, radius: 22 });
      const gi = giveIcon(k.give);
      rewardIcon(this, 120, y - 6, gi, 80);
      qText(this, 120, y + 50, '×' + gi.n, { size: 26, font: FONT_NUM });
      qText(this, 200, y - 34, k.name, { size: 38, origin: [0, 0.5] });
      const b = bar(this, 200, y + 10, 420, 30, k.done ? 0x4cc93a : 0x3f8cff, { value: k.have / k.need });
      qText(this, 410, y + 25, `${k.have}/${k.need}`, { size: 26, font: FONT_NUM });
      qText(this, 650, y + 25, S.expN(k.exp), { size: 26, font: FONT_BODY, style: 'purple', origin: [0, 0.5] });
      if (k.claimed) qText(this, 900, y, S.claimed, { size: 40, style: 'white' }).setAlpha(0.6);
      else if (k.done) button(this, 900, y, 200, 100, S.claim, { color: 'green', size: 40, onClick: () => { const got = E.claimTask(k.id); if (got) showRewards(this, got, () => this.scene.restart({ tab: 'tasks' })); } });
      else button(this, 900, y, 200, 100, S.goDo, { color: 'blue', size: 40, onClick: () => this.scene.start(GO[k.key] || 'Home') });
    });
    // 全部完成大獎
    const y = 400 + list.length * 190 + 60, all = E.allTasksClaimed(), got = save.today().allClaimed;
    panel(this, 540, y, 1000, 190, { fill: 0x5a1f1a, rim: 0xffc13b });
    rewardIcon(this, 130, y, { icon: 'chest2' }, 110);
    qText(this, 220, y - 30, S.allTaskBonus, { size: 42, style: 'gold', origin: [0, 0.5] });
    qText(this, 220, y + 30, `${list.filter(k => k.claimed).length}/${list.length}`, { size: 34, font: FONT_NUM, origin: [0, 0.5] });
    if (got) qText(this, 900, y, S.claimed, { size: 40 }).setAlpha(0.6);
    else button(this, 900, y, 200, 110, S.claim, { color: all ? 'yellow' : 'grey', size: 40, onClick: () => { const g = E.claimTaskBonus(); if (g) showRewards(this, g, () => this.scene.restart({ tab: 'tasks' })); } });
  }

  signin() {
    const idx = E.signinIndex(), ready = E.signinReady();
    qText(this, 540, 340, S.signinTip, { size: 32, font: FONT_BODY });
    E.SIGNIN.forEach((s, i) => {
      const big = s.big, x = big ? 540 : 200 + (i % 3) * 340, y = big ? 1430 : 560 + Math.floor(i / 3) * 400;
      const w = big ? 980 : 310, h = big ? 300 : 360;
      const past = i < idx || (i === idx && !ready), today = i === idx && ready;
      const g = this.add.graphics();
      g.fillStyle(OUT).fillRoundedRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 14, 24);
      g.fillStyle(today ? 0xffc13b : past ? 0x6a6e78 : 0xc87a3a).fillRoundedRect(x - w / 2, y - h / 2, w, h, 20);
      g.fillStyle(today ? 0x7a3a10 : past ? 0x2a2a30 : 0x4a2a1a).fillRoundedRect(x - w / 2 + 7, y - h / 2 + 7, w - 14, h - 14, 15);
      qText(this, x, y - h / 2 + 40, S.dayN(i + 1), { size: 40, style: today ? 'gold' : 'white' });
      const gi = giveIcon(s.give);
      const im = rewardIcon(this, x, y, gi, big ? 150 : 120);
      qText(this, x, y + h / 2 - 50, '×' + gi.n, { size: 36, font: FONT_NUM });
      if (past) {
        this.add.rectangle(x, y, w - 14, h - 14, 0x000000, 0.45);
        this.add.image(x, y, 'ic_star').setScale(1.6).setTint(0x7aff5a);
      }
      if (today) {
        this.tweens.add({ targets: im, scale: im.scale * 1.12, duration: 500, yoyo: true, repeat: -1 });
        const z = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => { const got = E.claimSignin(); if (got) showRewards(this, got, () => this.scene.restart({ tab: 'signin' })); });
      }
    });
  }
}
