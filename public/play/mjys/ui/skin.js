// 換皮：老闆的介面素材（ui_*、icon_*、portraits_*、fx_*）有就用，沒有就維持程式畫的
// 1. 圖示類：直接蓋掉占位圖（同一個 key、同樣大小），其他程式碼不用改
// 2. 按鈕、面板、進度條、膠囊、彈窗：九宮格拉伸（nine）
// 3. 特效：fxPlay 播序列動畫（疊加發光）

// 占位圖 key → 素材 key（素材會縮放進占位圖原本的大小，保持比例置中）
const OVERRIDE = {
  ic_coin: 'icon_currency_2', ic_gem: 'icon_currency_1', ic_energy: 'icon_currency_0',
  part_bolt: 'icon_parts_0', part_barrel: 'icon_parts_1', part_crystal: 'icon_parts_2', part_rune: 'icon_parts_3', part_universal: 'icon_parts_4',
  chest1: 'icon_chests_0', chest2: 'icon_chests_1', chest3: 'icon_chests_2',
  ic_gift: 'icon_packs_0', card_gold: 'icon_packs_1', card_silver: 'icon_packs_2', piggy: 'icon_packs_3',
  ic_star: 'ui_misc_1', ic_star_empty: 'ui_misc_2', ic_lock: 'ui_misc_8',
  side_event: 'ui_side_icons_b_3', side_shop: 'ui_side_icons_a_3', side_signin: 'ui_side_icons_a_4', side_tasks: 'ui_side_icons_b_1', side_season: 'ui_side_icons_a_1',
  nav_captain: 'ui_nav_1', nav_chapter: 'ui_nav_2', nav_fort: 'ui_nav_3', nav_codex: 'ui_nav_4',
  avatar_lia: 'portraits_a_0', avatar_borg: 'portraits_a_1', avatar_king: 'portraits_a_2', avatar_goblinking: 'portraits_a_3',
  avatar_witch: 'portraits_b_0', avatar_pirate: 'portraits_b_1', avatar_frostgiant: 'portraits_b_2', avatar_lavademon: 'portraits_b_3',
  avatar_shadowking: 'portraits_c_0', avatar_karl: 'portraits_c_1',
  ic_boss: 'portraits_a_3', gate_gen: 'ui_gate_0',
};
// 新的 key（原本沒有占位圖）：key → [素材, 寬, 高]
const NEW_KEYS = { nav_tower: ['ui_nav_0', 120, 110] };
// 投射物：素材是斜 45° 往右上飛，轉成往右（遊戲依飛行方向旋轉）
const SHOTS = { shot_crossbow: 'fx_projectiles_0', shot_cannon: 'fx_projectiles_1', shot_ice: 'fx_projectiles_2', shot_poison: 'fx_projectiles_3', shot_dragon: 'fx_projectiles_5' };

export const has = (scene, k) => scene.textures.exists(k);

function rasterize(scene, key, art, w, h, rotate = 0) {
  const fr = scene.textures.getFrame(art);
  if (!fr) return;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const ctx = tex.context;
  ctx.imageSmoothingQuality = 'high';
  const span = rotate ? Math.hypot(fr.width, fr.height) * 0.72 : 0;
  const k = Math.min(w / (span || fr.width), h / (span || fr.height));
  ctx.save();
  ctx.translate(w / 2, h / 2);
  if (rotate) ctx.rotate(rotate);
  ctx.drawImage(fr.source.image, fr.cutX, fr.cutY, fr.width, fr.height, -fr.width * k / 2, -fr.height * k / 2, fr.width * k, fr.height * k);
  ctx.restore();
  tex.refresh();
  tex.customData = { art: true };
}

const DIGITS = '0123456789+-!';
function artFont(scene, key, first, h = 72) {
  if (!has(scene, 'num_damage_' + first) || scene.cache.bitmapFont.get(key)?.art) return;
  const frames = [...DIGITS].map((ch, i) => scene.textures.getFrame('num_damage_' + (first + i)));
  const ws = frames.map(f => Math.round(f.width * h / f.height));
  const W = ws.reduce((a, b) => a + b + 4, 0);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, W, h);
  const ctx = tex.context;
  const chars = {};
  let x = 0;
  frames.forEach((f, i) => {
    ctx.drawImage(f.source.image, f.cutX, f.cutY, f.width, f.height, x, 0, ws[i], h);
    const code = DIGITS.charCodeAt(i);
    chars[code] = { x, y: 0, width: ws[i], height: h, centerX: ws[i] / 2, centerY: h / 2, xOffset: 0, yOffset: 0, xAdvance: ws[i] * 0.86, data: {}, kerning: {} };
    x += ws[i] + 4;
  });
  tex.refresh();
  const data = { font: key, size: h, lineHeight: h, chars };
  scene.cache.bitmapFont.remove(key);
  scene.cache.bitmapFont.add(key, { data, texture: key, frame: null, art: true });
}

export function applySkin(scene) {
  artFont(scene, 'num_white', 0, 60);
  artFont(scene, 'num_red', 13, 66);
  for (const [key, art] of Object.entries(OVERRIDE)) {
    if (!has(scene, art)) continue;
    const old = scene.textures.exists(key) ? scene.textures.get(key) : null;
    if (old && old.customData?.art) continue;
    const src = old ? old.getSourceImage() : null;
    rasterize(scene, key, art, src ? src.width : 128, src ? src.height : 128);
  }
  for (const [key, [art, w, h]] of Object.entries(NEW_KEYS)) if (has(scene, art) && !scene.textures.get(key)?.customData?.art) rasterize(scene, key, art, w, h);
  for (const [key, art] of Object.entries(SHOTS)) {
    if (!has(scene, art) || scene.textures.get(key)?.customData?.art) continue;
    rasterize(scene, key, art, 84, 84, Math.PI / 4);
  }
}

// ───── 九宮格 ─────
// 每種素材的邊角（素材像素）與預設縮放
const NINE = {
  ui_buttons: { l: 110, r: 110, t: 100, b: 100 },
  ui_panels_0: { l: 95, r: 95, t: 95, b: 95, s: 0.5 },
  ui_panels_1: { l: 95, r: 95, t: 95, b: 95, s: 0.5 },
  ui_panels_2: { l: 80, r: 80, t: 80, b: 80, s: 0.5 },
  ui_panels_3: { l: 80, r: 80, t: 80, b: 80, s: 0.5 },
  ui_popup_0: { l: 150, r: 150, t: 270, b: 150, s: 0.62 },
  ui_rarity_frames: { l: 75, r: 75, t: 75, b: 75, s: 0.55 },
  ui_topbar_0: { l: 265, r: 235, t: 110, b: 110 },
  ui_bars_frame: { lk: 1.05, rk: 0.42, tk: 0.42, bk: 0.42 },
  ui_bars_fill: { l: 62, r: 62, t: 58, b: 58 },
};

// 建一個置中的九宮格；w/h 是畫面上要的大小；s 是素材縮放（決定邊角在畫面上多大）
export function nine(scene, x, y, key, w, h, p) {
  const fr = scene.textures.getFrame(key);
  const s = p.s ?? h / fr.height;
  let W = Math.max(p.l + p.r + 2, w / s), Hh = Math.max(p.t + p.b + 2, h / s);
  const ns = scene.add.nineslice(x, y, key, undefined, W, Hh, p.l, p.r, p.t, p.b);
  ns.setScale(s);
  return ns;
}

export const BTN_FRAME = { yellow: 0, blue: 1, green: 2, red: 3, grey: 4, purple: 5 };
export function buttonSkin(scene, w, h, color) {
  const key = 'ui_buttons_' + (BTN_FRAME[color] ?? 0);
  if (!has(scene, key)) return null;
  const fr = scene.textures.getFrame(key);
  const s = (h * 1.32) / fr.height; // 素材上下有留白，放大一點讓膠囊本體≈按鈕高
  return nine(scene, 0, 2, key, w * 1.08, h * 1.32, { ...NINE.ui_buttons, s });
}

// 面板：依填色挑紅／紫／羊皮紙／深藍
export function panelSkin(scene, x, y, w, h, fill, kind) {
  const pick = kind ?? (fill == null ? 0 : ((fill >> 16) & 255) > ((fill & 255) + 8) ? 0 : 1);
  const key = kind === 'popup' ? 'ui_popup_0' : 'ui_panels_' + pick;
  if (!has(scene, key)) return null;
  const p = NINE[key];
  const s = kind === 'popup' ? Math.min(p.s, w / 1000 * 1.05) : Math.min(p.s, Math.min(w, h) / 380);
  return nine(scene, x, y, key, w + 30, h + 30, { ...p, s });
}

export function rarityFrame(scene, x, y, w, h, rarity) {
  const key = 'ui_rarity_frames_' + rarity;
  if (!has(scene, key)) return null;
  return nine(scene, x, y, key, w + 16, h + 16, NINE.ui_rarity_frames);
}

// 進度條：外框（左邊有圖示）＋填色；回傳 { frame, fill(ratio) }
const BAR_KIND = { red: [0, 1], blue: [2, 3], gold: [4, 5], green: [6, 7] };
export function barKind(color) {
  const r = (color >> 16) & 255, g = (color >> 8) & 255, b = color & 255;
  if (r > 200 && g > 150 && b < 120) return 'gold';
  if (g > r && g > b) return 'green';
  if (b > r && b > g) return 'blue';
  if (r > g + 60 && b > g) return 'blue'; // 紫色沒有素材，用藍
  return r > g ? 'red' : 'blue';
}
export function barSkin(scene, x, y, w, h, color) {
  const [fi, ci] = BAR_KIND[barKind(color)];
  const fk = 'ui_bars_' + fi, ck = 'ui_bars_' + ci;
  if (!has(scene, fk) || !has(scene, ck)) return null;
  const ff = scene.textures.getFrame(fk), cf = scene.textures.getFrame(ck);
  const H = h * 1.9, s = H / ff.height, P = NINE.ui_bars_frame;
  const cap = ff.height * P.lk * s; // 左邊圖示在畫面上的寬
  const frame = nine(scene, x + w / 2 - cap * 0.25, y + h / 2, fk, w + cap * 0.6, H, { l: ff.height * P.lk, r: ff.height * P.rk, t: ff.height * P.tk, b: ff.height * P.bk, s });
  const innerX = x - cap * 0.25 + cap * 0.92, innerW = x + w + cap * 0.05 - innerX - h * 0.35;
  const fs = (h * 0.95) / cf.height;
  let fill = null;
  const set = (r) => {
    r = Math.max(0, Math.min(1, r));
    const ww = Math.max(cf.height * 1.3 * fs, innerW * r);
    if (!fill) { fill = nine(scene, 0, 0, ck, ww, h * 0.95, { ...NINE.ui_bars_fill, s: fs }); fill.setOrigin(0, 0.5); }
    else fill.width = Math.max(NINE.ui_bars_fill.l + NINE.ui_bars_fill.r + 2, ww / fs);
    fill.setPosition(innerX, y + h / 2);
    fill.setVisible(r > 0.001);
  };
  return { frame, set, get fill() { return fill; } };
}

export function pillSkin(scene, w, h) {
  if (!has(scene, 'ui_topbar_0')) return null;
  const fr = scene.textures.getFrame('ui_topbar_0');
  return nine(scene, 0, 0, 'ui_topbar_0', w + 20, h * 1.25, { ...NINE.ui_topbar_0, s: (h * 1.25) / fr.height });
}

// ───── 特效 ─────
// 序列特效（fx_*_sheet）：播一次就消失；沒有素材回傳 false
// 有影片版（anim_fx_*）就優先用影片版
const FX_VIDEO = { fx_hit_sheet: 'anim_fx_hit', fx_merge_sheet: 'anim_fx_merge', fx_summon_sheet: 'anim_fx_summon', fx_skill_sheet: 'anim_fx_skill', fx_ice_sheet: 'anim_fx_ice', fx_levelup_sheet: 'anim_fx_levelup' };
export function fxPlay(scene, key, x, y, size, opt = {}) {
  if (FX_VIDEO[key] && has(scene, FX_VIDEO[key])) key = FX_VIDEO[key];
  if (!has(scene, key)) return false;
  const anim = 'a_' + key;
  if (!scene.anims.exists(anim)) {
    const m = scene.cache.json.get('manifest')?.sheets?.[key] || {};
    const n = m.frames || 8;
    scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: m.fx ? Math.max(18, Math.round(m.frames / 1.0)) : (opt.fps || 22), repeat: 0 }); // 影片特效：整段壓在約 1 秒內播完
  }
  const sp = scene.add.sprite(x, y, key, 0).setBlendMode('ADD').setDepth(opt.depth ?? 3000);
  if (key === 'anim_fx_summon') sp.setOrigin(0.5, 0.82); // 召喚：魔法陣在畫面下方，對齊塔的腳底
  sp.setScale(size / Math.max(sp.height, sp.width));
  if (opt.angle) sp.setAngle(opt.angle);
  sp.play(anim);
  sp.once('animationcomplete', () => sp.destroy());
  return true;
}
// 單張特效（fx_gate_hit、fx_poison_cloud…）：放大淡出
export function fxFlash(scene, key, x, y, size, opt = {}) {
  if (!has(scene, key)) return false;
  const im = scene.add.image(x, y, key).setBlendMode('ADD').setDepth(opt.depth ?? 3000).setAlpha(opt.alpha ?? 1);
  im.setScale(size / im.height * 0.7);
  scene.tweens.add({ targets: im, scale: size / im.height, alpha: 0, duration: opt.dur || 450, ease: 'Quad.Out', onComplete: () => im.destroy() });
  return true;
}
