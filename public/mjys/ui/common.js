// 各頁共用：資源列、底部導航、提示、遮罩
import { W, H, CFG } from '../cfg.js';
import { S } from '../strings.js';
import { save } from '../store.js';
import { storyBefore } from '../data/story.js';
import { qText, FONT_NUM, FONT_BODY } from './qtext.js';
import { OUT, GOLD, button, panel } from './widgets.js';
import { staminaBuysLeft, staminaPrice, buyStamina, STAMINA_BUY } from '../economy.js';
import { addTower } from './towerArt.js';
import { pillSkin } from './skin.js';
import { chapterOf, chapterData } from '../data/stages.js';

export const DEPTH = { ui: 1000, overlay: 5000, toast: 6000 };

// 固定在畫面上（不跟地圖捲動）：容器裡的子物件也要逐一設定，不然畫面與點擊位置會跟著捲動跑掉
export function fixUI(obj) {
  obj.setScrollFactor?.(0);
  if (obj.list) obj.list.forEach(fixUI);
  return obj;
}

// 全螢幕遮罩＋內容容器（遮罩放容器外較低圖層，否則會吃掉按鈕的點擊）
export function overlay(scene, alpha = 0.6, depth = DEPTH.overlay) {
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, alpha).setOrigin(0).setDepth(depth).setInteractive().setScrollFactor(0);
  const c = scene.add.container(0, 0).setDepth(depth + 1).setScrollFactor(0);
  c.once('destroy', () => dim.destroy());
  c.dim = dim;
  return c;
}

export function toast(scene, text, x = 540, y = 960, style = 'white', size = 40) {
  const t = qText(scene, x, y, text, { size, style }).setDepth(DEPTH.toast).setScrollFactor(0);
  scene.tweens.add({ targets: t, y: y - 60, alpha: 0, delay: 700, duration: 450, onComplete: () => t.destroy() });
  return t;
}

// 深色膠囊：左邊圖示、中間數字、右邊綠色 +
export function pill(scene, x, y, icon, w = 250, plus = true) {
  const c = scene.add.container(x, y).setDepth(DEPTH.ui).setScrollFactor(0);
  const sk = plus ? pillSkin(scene, w, 64) : null; // 素材膠囊：左邊圓槽放圖示、右邊自帶綠色 +
  if (sk) c.add(sk);
  else {
    const g = scene.add.graphics();
    g.fillStyle(OUT, 1).fillRoundedRect(-w / 2 - 4, -32, w + 8, 68, 34);
    g.fillStyle(0x1e0f0a, 0.92).fillRoundedRect(-w / 2, -28, w, 58, 29);
    g.fillStyle(0xffffff, 0.08).fillRoundedRect(-w / 2 + 6, -24, w - 12, 18, 9);
    c.add(g);
  }
  c.add(scene.add.image(-w / 2 + (sk ? 18 : 8), 0, icon).setScale(sk ? 0.85 : 0.95));
  const t = qText(scene, plus ? -2 : 10, 0, '0', { size: 36, font: FONT_NUM });
  c.add(t);
  if (plus && !sk) {
    const pg = scene.add.graphics();
    pg.fillStyle(OUT).fillRoundedRect(w / 2 - 44, -22, 44, 44, 10);
    pg.fillStyle(0x4cc93a).fillRoundedRect(w / 2 - 41, -19, 38, 38, 8);
    pg.fillStyle(0xffffff).fillRect(w / 2 - 30, -3, 16, 6).fillRect(w / 2 - 25, -8, 6, 16);
    c.add(pg);
  }
  c.text = t;
  return fixUI(c);
}

// 頂部資源列：体力（含回復倒數）、钻石、金币；回傳 refresh()
export function resourceBar(scene, opt = {}) {
  const y = opt.y ?? 78, x0 = opt.x0 ?? 330;
  const st = pill(scene, x0, y, 'ic_energy', 240);
  const gem = pill(scene, x0 + 262, y, 'ic_gem', 240, false); // 钻石不能用錢買（平台規格），不放「+」
  const coin = pill(scene, x0 + 524, y, 'ic_coin', 250);
  const timer = qText(scene, x0, y + 52, '', { size: 24, font: FONT_NUM }).setDepth(DEPTH.ui).setScrollFactor(0);
  // 「+」：体力→用钻石買体力；金币→钻石商店；钻石→提示怎麼拿
  const go = (tab) => { if (scene.scene.key === 'Shop') scene.scene.restart({ tab }); else scene.scene.start('Shop', { tab, from: scene.scene.key }); };
  st.setSize(240, 64).setInteractive().on('pointerup', () => staminaDialog(scene, () => refresh()));
  gem.setSize(240, 64).setInteractive().on('pointerup', () => toast(scene, S.gemsHow, 540, 200, 'white', 34));
  coin.setSize(250, 64).setInteractive().on('pointerup', () => go('gems'));
  const fmt = n => (n >= 100000 ? (n / 1000).toFixed(0) + 'K' : String(n));
  let last = '';
  const refresh = () => {
    save.regen();
    const d = save.d;
    const key = d.stamina + '|' + d.diamonds + '|' + d.coins + '|' + save.staminaNext();
    if (key === last) return;
    last = key;
    st.text.setText(`${d.stamina}/${CFG.stamina.max}`);
    gem.text.setText(fmt(d.diamonds));
    coin.text.setText(fmt(d.coins));
    const s = save.staminaNext();
    timer.setText(s ? `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : '');
  };
  refresh();
  scene.time.addEvent({ delay: 500, loop: true, callback: refresh });
  return { refresh };
}

// 底部導航：塔／队长／章节（主頁）／要塞／图鉴
const TABS = [
  { key: 'tower', icon: 'twg_crossbow_0', label: 'navTower', scene: 'Towers' },
  { key: 'captain', icon: 'nav_captain', label: 'navCaptain', scene: 'Captain' },
  { key: 'chapter', icon: 'nav_chapter', label: 'navChapter', scene: 'Home' },
  { key: 'fort', icon: 'nav_fort', label: 'navFort', scene: 'Fortress' },
  { key: 'codex', icon: 'nav_codex', label: 'navCodex', scene: 'Codex' },
];
export function navBar(scene, active) {
  const y = 1840, h = 160;
  const g = scene.add.graphics().setDepth(DEPTH.ui);
  g.fillStyle(OUT).fillRect(0, y - h / 2 - 8, W, h + 20);
  g.fillStyle(GOLD).fillRect(0, y - h / 2 - 4, W, 4);
  TABS.forEach((t, i) => {
    const on = t.key === active, big = t.key === 'chapter';
    const w = big ? 236 : 206, x = big ? 540 : [111, 325, 0, 755, 969][i];
    const top = y - h / 2 + (on ? -22 : 2), hh = h - (on ? -16 : 8);
    g.fillStyle(OUT).fillRoundedRect(x - w / 2, top, w, hh, 22);
    g.fillStyle(on ? 0xff8a2a : 0x9a2420).fillRoundedRect(x - w / 2 + 5, top + 5, w - 10, hh - 10, 18);
    g.fillStyle(on ? 0xffc06a : 0xc8382e).fillRoundedRect(x - w / 2 + 5, top + 5, w - 10, (hh - 10) * 0.42, { tl: 18, tr: 18, bl: 6, br: 6 });
    // 有導航素材（ui_nav_0~4）直接用原圖放大，比較清楚；圖示放大、往上凸出底條一點
    const art = 'ui_nav_' + i, ih = on ? 150 : 118, iy = top + hh * 0.36 - (on ? 18 : 6);
    let icon;
    if (scene.textures.exists(art)) { icon = scene.add.image(x, iy, art).setDepth(DEPTH.ui + 1); icon.setScale(ih / icon.height); }
    else if (t.key === 'tower') icon = addTower(scene, x, iy, 'crossbow', 0, ih).setDepth(DEPTH.ui + 1);
    else icon = scene.add.image(x, iy, t.icon).setDepth(DEPTH.ui + 1).setScale(on ? 1.2 : 1);
    const label = qText(scene, x, top + hh - 28, S[t.label], { size: on ? 40 : 34 }).setDepth(DEPTH.ui + 2);
    const zone = scene.add.zone(x, y, w, h).setInteractive({ useHandCursor: true }).setDepth(DEPTH.ui + 3);
    zone.on('pointerup', () => {
      if (on) return;
      if (t.scene && scene.scene.manager.keys[t.scene]) scene.scene.start(t.scene);
      else toast(scene, S.comingSoon, x, y - 140, 'white', 34);
    });
    if (!on) { icon.setAlpha(0.9); label.setAlpha(0.9); }
  });
}

// 返回鍵（左上）
export function backButton(scene, onClick) {
  const c = scene.add.container(70, 80).setDepth(DEPTH.ui + 5).setScrollFactor(0);
  if (scene.textures.exists('ui_buttons_round_1')) { // 素材：藍色返回鍵
    const im = scene.add.image(0, 0, 'ui_buttons_round_1');
    im.setScale(112 / im.height);
    c.add(im);
    c.setSize(96, 96).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.92));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => { c.setScale(1); onClick(); });
    return fixUI(c);
  }
  const g = scene.add.graphics();
  g.fillStyle(OUT).fillCircle(0, 4, 48);
  g.fillStyle(0x1a55c4).fillCircle(0, 0, 44);
  g.fillStyle(0x2f8cff).fillCircle(0, -4, 40);
  g.fillStyle(0x8fd0ff).fillEllipse(0, -20, 54, 22);
  g.fillStyle(0xffffff).fillTriangle(-20, 0, 6, -20, 6, 20).fillRect(4, -7, 18, 14);
  c.add(g);
  c.setSize(96, 96).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.92));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => { c.setScale(1); onClick(); });
  return fixUI(c);
}

// 開始活動戰鬥：扣當日次數（不扣体力）
export function startEvent(scene, mode, level = 0) {
  if (!save.useTry(mode)) { toast(scene, S.noTries, 540, 1500, 'red', 44); return false; }
  scene.scene.start('Battle', { mode, level });
  return true;
}

// 開場要載的素材：各頁背景＋介面＋目前那章的戰場與地圖＋遊戲裡有的塔與怪（其他章用到再載 ensureChapter）
// 回傳排了幾個檔
export function queueAssets(scene, m, chapter = 1) {
  let n = 0;
  const ch = chapterData(chapter);
  const chMobs = new Set(ch ? [...ch.mobs.map(x => x.type), ch.elite, ch.boss] : []);
  const otherCh = k => /_ch\d+$/.test(k) && !k.endsWith('_ch' + chapter) && !k.endsWith('_ch1');
  for (const [key, file] of Object.entries(m.images || {})) {
    if (otherCh(key) || scene.textures.exists(key)) continue;
    scene.load.image(key, 'assets/' + file); n++;
  }
  for (const [key, s] of Object.entries(m.sheets || {})) {
    if (scene.textures.exists(key)) continue;
    // 怪物只載第 1 章＋目前那章的（圖鑑頁會自己補載）
    if (key.startsWith('sheet_') && !ENEMIES_CH1.has(key.slice(6)) && !chMobs.has(key.slice(6))) continue;
    scene.load.spritesheet(key, 'assets/' + s.file, { frameWidth: s.w, frameHeight: s.h }); n++;
  }
  return n;
}
const ENEMIES_CH1 = new Set(['goblin', 'goblin_archer', 'goblin_elite', 'boss_goblinking']);

// 某章要用的圖（戰場、地圖、小怪、首領）還沒載就先載，載完再 cb（第 2 章起才會用到）
export function ensureChapter(scene, c, cb) {
  const m = scene.cache.json.get('manifest') || {};
  const ch = chapterData(c);
  if (!ch) { cb(); return; }
  const keys = ['bg_battle_ch' + c, 'bg_map_ch' + c];
  let n = 0;
  for (const k of keys) if (m.images?.[k] && !scene.textures.exists(k)) { scene.load.image(k, 'assets/' + m.images[k]); n++; }
  // 要載的怪：小兵、精英、首領、首領會召喚的（extra）；別名怪（精英借小兵的圖）換成原圖
  const ALIAS_SRC = { goblin_elite: 'goblin', mummy_elite: 'mummy', yeti_elite: 'yeti', treant_elite: 'treant' };
  for (const t0 of [...ch.mobs.map(x => x.type), ch.elite, ch.boss, ...(ch.extra || [])]) {
    const t = ALIAS_SRC[t0] || t0;
    const k = 'sheet_' + t, s = m.sheets?.[k];
    if (s && !scene.textures.exists(k)) { scene.load.spritesheet(k, 'assets/' + s.file, { frameWidth: s.w, frameHeight: s.h }); n++; }
  }
  if (!n) { cb(); return; }
  const t = toast(scene, S.loading, 540, 960, 'white', 44);
  scene.load.once('complete', () => { t.destroy(); cb(); });
  scene.load.start();
}

// 戰鬥開始：扣体力，成功就進戰鬥（第一次進某關前有劇情就先播）
export function startStage(scene, n) {
  if (!save.useStamina(CFG.stamina.cost)) { toast(scene, S.noStamina, 540, 1500, 'red', 48); return false; }
  const sid = storyBefore(n);
  ensureChapter(scene, chapterOf(n), () => {
    if (sid && !save.d.story[sid]) scene.scene.start('Story', { id: sid, next: { scene: 'Battle', data: { stage: n } } });
    else scene.scene.start('Battle', { stage: n });
  });
  return true;
}

// ───── 對話框 ─────
// 獎勵的小圖：entry＝{ icon, n } 或 { tower, n }
export function rewardIcon(scene, x, y, e, h = 90) {
  if (e.tower) return addTower(scene, x, y, e.tower, 0, h * 1.2);
  const img = scene.add.image(x, y, e.icon);
  return img.setScale(h / Math.max(img.width, img.height));
}

// 「獲得」彈窗：點任意處關閉
export function showRewards(scene, got, onClose, title = S.got) {
  const c = overlay(scene, 0.7, DEPTH.overlay + 20);
  const n = got.length, cols = Math.min(4, Math.max(1, n)), rows = Math.ceil(n / 4);
  const h = 300 + rows * 190;
  c.add(scene.add.image(540, 960 - h / 2 + 40, 'glow').setScale(10, 4).setTint(0xffd34a).setAlpha(0.6).setBlendMode('ADD'));
  c.add(qText(scene, 540, 960 - h / 2 + 40, title, { size: 90, style: 'gold', strokeW: 14 }));
  got.forEach((e, i) => {
    const r = Math.floor(i / 4), k = i % 4, inRow = Math.min(4, n - r * 4);
    const x = 540 + (k - (inRow - 1) / 2) * 220, y = 960 - h / 2 + 200 + r * 190;
    const g = scene.add.graphics();
    g.fillStyle(OUT).fillRoundedRect(x - 95, y - 80, 190, 170, 22);
    g.fillStyle(0x3a1a2a).fillRoundedRect(x - 90, y - 75, 180, 160, 18);
    const im = rewardIcon(scene, x, y - 12, e, 92);
    const t = qText(scene, x, y + 55, e.label || '×' + e.n, { size: 36, font: FONT_NUM });
    c.add([g, im, t]);
    for (const o of [g, im, t]) { o.setAlpha(0); scene.tweens.add({ targets: o, alpha: 1, delay: 120 + i * 90, duration: 160 }); }
  });
  c.add(qText(scene, 540, 960 + h / 2 - 20, S.tapClose, { size: 30, font: FONT_NUM }).setAlpha(0.8));
  fixUI(c);
  scene.time.delayedCall(350, () => c.dim.once('pointerup', () => { c.destroy(); onClose?.(); }));
  return c;
}

// 確認對話框（真錢商品會加「測試版」提示）
export function confirmDialog(scene, { title, lines = [], price, test, onOk }) {
  const c = overlay(scene, 0.65, DEPTH.overlay + 10);
  c.add(panel(scene, 540, 960, 760, 640 + lines.length * 50, { fill: 0x3a1a2a, kind: 'popup' }));
  let y = 960 - (640 + lines.length * 50) / 2 + 90;
  c.add(qText(scene, 540, y, title, { size: 60, style: 'gold' }));
  y += 100;
  for (const l of lines) { c.add(qText(scene, 540, y, l, { size: 34, font: FONT_BODY, wrap: 660 })); y += 50; }
  if (price) { // price：文字，或 { icon, n }（钻石、金币圖示＋數字）
    y += 20;
    if (typeof price === 'object') {
      c.add(scene.add.image(490, y, price.icon).setScale(0.9));
      c.add(qText(scene, 530, y, String(price.n), { size: 56, font: FONT_NUM, origin: [0, 0.5] }));
    } else c.add(qText(scene, 540, y, price, { size: 56, style: 'white', font: FONT_NUM }));
    y += 70;
  }
  if (test) { c.add(qText(scene, 540, y, S.testMode, { size: 28, style: 'red', font: FONT_BODY })); y += 50; }
  c.add(button(scene, 380, y + 80, 260, 110, S.cancel, { color: 'grey', onClick: () => c.destroy() }));
  c.add(button(scene, 700, y + 80, 280, 110, S.confirmBuy, { color: 'yellow', size: 40, onClick: () => { c.destroy(); onOk(); } }));
  fixUI(c);
  return c;
}

// 買体力（用钻石，每天次數有限）
export function staminaDialog(scene, onDone) {
  const left = staminaBuysLeft(), price = staminaPrice();
  if (left <= 0) { toast(scene, S.limitReached, 540, 300, 'red', 40); return; }
  confirmDialog(scene, {
    title: S.buyStamina, lines: [S.staminaBuyInfo(STAMINA_BUY.amount, left)], price: { icon: 'ic_gem', n: price },
    onOk: () => {
      const r = buyStamina();
      if (r.why === 'gems') { toast(scene, S.notEnoughGems, 540, 300, 'red', 40); return; }
      if (r.why !== 'ok') { toast(scene, S.limitReached, 540, 300, 'red', 40); return; }
      showRewards(scene, r.got, onDone);
      onDone?.();
    },
  });
}
