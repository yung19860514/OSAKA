// 共用 UI 元件：按鈕、面板、進度條、圓形按鈕
// 現在用程式畫（卡通粗框＋亮面）；之後 ui_buttons / ui_panels 素材到位再換成圖
import { qText } from './qtext.js';
import { buttonSkin, panelSkin, barSkin, has } from './skin.js';

export const OUT = 0x2b1208;   // 卡通深咖啡外框
export const GOLD = 0xf2b33d;

const BTN = {
  yellow: { base: 0xffb81c, top: 0xffe27a, bottom: 0xd9780f, text: 'white' },
  blue:   { base: 0x2f8cff, top: 0x8fd0ff, bottom: 0x1a55c4, text: 'white' },
  green:  { base: 0x4cc93a, top: 0xa8f07a, bottom: 0x2a8a22, text: 'white' },
  red:    { base: 0xe8453a, top: 0xff9c88, bottom: 0xa8231c, text: 'white' },
  purple: { base: 0x9a4cf0, top: 0xd7a8ff, bottom: 0x6326b0, text: 'white' },
  grey:   { base: 0x8b8f99, top: 0xc4c8d0, bottom: 0x5c6069, text: 'white' },
};

export function shade(c, k) {
  let r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  if (k >= 0) { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  else { r *= 1 + k; g *= 1 + k; b *= 1 + k; }
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// 亮面圓角塊：外框 → 底色 → 下半暗帶 → 上緣亮帶 → 高光
export function drawGlossy(g, x, y, w, h, c, r = Math.min(w, h) * 0.32, outline = 6) {
  g.fillStyle(OUT, 1).fillRoundedRect(x - outline, y - outline, w + outline * 2, h + outline * 2 + 4, r + outline);
  g.fillStyle(c.bottom, 1).fillRoundedRect(x, y, w, h, r);
  g.fillStyle(c.base, 1).fillRoundedRect(x, y, w, h * 0.78, { tl: r, tr: r, bl: r * 0.6, br: r * 0.6 });
  g.fillStyle(c.top, 1).fillRoundedRect(x + 4, y + 4, w - 8, h * 0.36, { tl: r - 3, tr: r - 3, bl: 6, br: 6 });
  g.fillStyle(0xffffff, 0.45).fillRoundedRect(x + w * 0.1, y + 7, w * 0.35, Math.max(5, h * 0.1), 5);
}

// 長方形按鈕：回傳 container，有 setEnabled / setLabel / setColor
export function button(scene, x, y, w, h, label, opt = {}) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  c.add(g);
  let color = opt.color || 'yellow', enabled = true, skin = null;
  const redraw = () => {
    g.clear();
    if (skin) { skin.destroy(); skin = null; }
    skin = buttonSkin(scene, w, h, enabled ? color : 'grey'); // 有素材用素材
    if (skin) c.addAt(skin, 0);
    else drawGlossy(g, -w / 2, -h / 2, w, h, BTN[enabled ? color : 'grey'], opt.radius);
  };
  redraw();
  const txt = qText(scene, 0, opt.labelY ?? -4, label, { size: opt.size || Math.round(h * 0.42), style: 'white' });
  c.add(txt);
  c.label = txt;
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => { if (!enabled && !opt.clickDisabled) return; c.setScale(0.94); });
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => {
    c.setScale(1);
    if (enabled || opt.clickDisabled) opt.onClick?.(enabled);
  });
  c.setEnabled = v => { if (v !== enabled) { enabled = v; redraw(); } return c; };
  c.setColor = v => { if (v !== color) { color = v; redraw(); } return c; };
  c.setLabel = v => { txt.setText(v); return c; };
  c.isEnabled = () => enabled;
  return c;
}

// 圓形按鈕（暫停、關閉）：icon 是一個畫圖示的函式 (g, r) => {}
const ROUND = { close: 0, back: 1, plus: 2, help: 3, gear: 4 };
export function roundButton(scene, x, y, r, opt = {}) {
  const c = scene.add.container(x, y);
  const art = opt.kind != null && has(scene, 'ui_buttons_round_' + ROUND[opt.kind]) ? 'ui_buttons_round_' + ROUND[opt.kind] : null;
  if (art) {
    const im = scene.add.image(0, 0, art);
    im.setScale((r * 2.5) / im.height);
    c.add(im);
  } else {
    const g = scene.add.graphics();
    const col = BTN[opt.color || 'blue'];
    g.fillStyle(OUT, 1).fillCircle(0, 3, r + 6);
    g.fillStyle(col.bottom, 1).fillCircle(0, 0, r);
    g.fillStyle(col.base, 1).fillCircle(0, -r * 0.08, r * 0.9);
    g.fillStyle(col.top, 1).fillEllipse(0, -r * 0.45, r * 1.3, r * 0.6);
    c.add(g);
    if (opt.icon) { const ig = scene.add.graphics(); opt.icon(ig, r); c.add(ig); }
  }
  if (opt.label) c.add(qText(scene, 0, -2, opt.label, { size: opt.size || Math.round(r * 0.8) }));
  c.setSize(r * 2, r * 2).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => c.setScale(0.92));
  c.on('pointerout', () => c.setScale(1));
  c.on('pointerup', () => { c.setScale(1); opt.onClick?.(); });
  return c;
}

// 深色面板（金框）
export function panel(scene, x, y, w, h, opt = {}) {
  // 有素材：紅色／紫色面板或彈窗（opt.kind = 'popup' | 0~3）；opt.flat＝強制程式畫
  if (!opt.flat) {
    const sk = panelSkin(scene, x, y, w, h, opt.fill, opt.kind);
    if (sk) return sk;
  }
  const g = scene.add.graphics();
  const fill = opt.fill ?? 0x5a1f1a, rim = opt.rim ?? GOLD, r = opt.radius ?? 28;
  g.fillStyle(OUT, 1).fillRoundedRect(x - w / 2 - 8, y - h / 2 - 8, w + 16, h + 20, r + 8);
  g.fillStyle(rim, 1).fillRoundedRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, r + 3);
  g.fillStyle(shade(rim, -0.35), 1).fillRoundedRect(x - w / 2 + 3, y - h / 2 + 6, w - 6, h - 4, r);
  g.fillStyle(fill, 1).fillRoundedRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, h - 16, r - 6);
  g.fillStyle(shade(fill, 0.12), 1).fillRoundedRect(x - w / 2 + 8, y - h / 2 + 8, w - 16, (h - 16) * 0.3, { tl: r - 6, tr: r - 6, bl: 0, br: 0 });
  return g;
}

// 進度條：回傳 { g, set(ratio) }
export function bar(scene, x, y, w, h, color, opt = {}) {
  const sk = opt.flat ? null : barSkin(scene, x, y, w, h, color);
  if (sk) {
    const api = {
      get frame() { return sk.frame; },
      get fill() { return sk.fill || sk.frame; },
      set(r) { sk.set(r); return api; },
      setDepth(d) { sk.frame.setDepth(d); sk.set(sk._r ?? 0); sk.fill?.setDepth(d + 0.01); return api; },
    };
    sk.set(opt.value ?? 1);
    if (opt.depth != null) { sk.frame.setDepth(opt.depth); sk.fill?.setDepth(opt.depth + 0.01); }
    return api;
  }
  const frame = scene.add.graphics();
  frame.fillStyle(OUT, 1).fillRoundedRect(x - 5, y - 5, w + 10, h + 12, (h + 10) / 2);
  frame.fillStyle(0x1a0c08, 1).fillRoundedRect(x, y, w, h, h / 2);
  const fill = scene.add.graphics();
  let last = -1;
  const api = {
    frame, fill,
    set(r) {
      r = Math.max(0, Math.min(1, r));
      if (Math.abs(r - last) < 0.002) return;
      last = r;
      fill.clear();
      if (r <= 0) return;
      const fw = Math.max(h, w * r);
      fill.fillStyle(shade(color, -0.25), 1).fillRoundedRect(x, y, fw, h, h / 2);
      fill.fillStyle(color, 1).fillRoundedRect(x, y, fw, h * 0.72, { tl: h / 2, tr: h / 2, bl: h / 3, br: h / 3 });
      fill.fillStyle(0xffffff, 0.35).fillRoundedRect(x + 6, y + 3, Math.max(0, fw - 12), h * 0.22, h * 0.11);
    },
    setDepth(d) { frame.setDepth(d); fill.setDepth(d + 0.01); return api; },
  };
  if (opt.depth != null) api.setDepth(opt.depth);
  api.set(opt.value ?? 1);
  return api;
}
