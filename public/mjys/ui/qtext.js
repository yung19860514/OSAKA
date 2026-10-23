// Q 版文字（docs/04）：粗圓體 ＋ 厚深色描邊 ＋ 往下的硬陰影 ＋ 上淺下深漸層
// 數字、英文用 Lilita One，中文自動退到站酷快樂體／黃油體（canvas 會逐字套用字型清單）
export const FONT_TITLE = '"Lilita One", "ZCOOL KuaiLe", sans-serif';          // 標題、按鈕、章名
export const FONT_BODY = '"Lilita One", "ZCOOL KuaiLe", "ZCOOL QingKe HuangYou", sans-serif'; // 面板字、內文（黃油體缺很多常用字，改快樂體優先）
export const FONT_NUM = '"Lilita One", sans-serif';

export const QSTYLE = {
  gold:  { top: '#fff6d8', bottom: '#ffd34a', stroke: '#3a1d12', shadow: '#2b1208' },
  white: { top: '#ffffff', bottom: '#dfe6ee', stroke: '#3a1d12', shadow: '#2b1208' },
  blue:  { top: '#eaf7ff', bottom: '#8fd3ff', stroke: '#0f2a55', shadow: '#0a1838' },
  red:   { top: '#ffe4e0', bottom: '#ff5a4a', stroke: '#4a0d0d', shadow: '#2a0505' },
  green: { top: '#efffdc', bottom: '#6fdc4a', stroke: '#163d0d', shadow: '#0c2507' },
  purple:{ top: '#f6e8ff', bottom: '#c88cff', stroke: '#2a0f45', shadow: '#170828' },
  dark:  { top: '#5a2a0e', bottom: '#3a1806', stroke: '#ffe9b0', shadow: '#00000000' }, // 淺色底上用
};

// qText(scene, x, y, 文字, { size, style, font, origin, strokeW, shadowY, align, wrap })
export function qText(scene, x, y, str, opt = {}) {
  const st = QSTYLE[opt.style || 'white'];
  const size = opt.size || 48;
  const strokeW = opt.strokeW ?? Math.max(3, Math.round(size * (size < 30 ? 0.13 : 0.16)));
  const shadowY = opt.shadowY ?? Math.max(2, Math.round(size * 0.09));
  const pad = Math.ceil(strokeW / 2) + 2;
  const t = scene.add.text(x, y, '', {
    fontFamily: opt.font || FONT_TITLE,
    fontSize: size + 'px',
    stroke: st.stroke,
    strokeThickness: strokeW,
    align: opt.align || 'center',
    padding: { left: pad, right: pad, top: pad, bottom: pad + shadowY },
    wordWrap: opt.wrap ? { width: opt.wrap, useAdvancedWrap: true } : undefined,
    lineSpacing: opt.lineSpacing || 0,
  });
  const o = opt.origin ?? [0.5, 0.5];
  t.setOrigin(o[0], o[1]);
  if (shadowY > 0) t.setShadow(0, shadowY, st.shadow, 0, true, true);
  t._q = { st, pad, shadowY, val: null };
  const rawSet = t.setText.bind(t);
  t.setText = v => {
    v = String(v);
    if (t._q.val === v) return t;
    t._q.val = v;
    rawSet(v);
    applyGradient(t);
    return t;
  };
  t.setQStyle = name => {
    const s2 = QSTYLE[name];
    if (!s2 || t._q.st === s2) return t;
    t._q.st = s2;
    t.setStroke(s2.stroke, t.style.strokeThickness);
    if (t._q.shadowY > 0) t.setShadow(0, t._q.shadowY, s2.shadow, 0, true, true);
    applyGradient(t);
    return t;
  };
  t.setText(str);
  return t;
}

function applyGradient(t) {
  const { st, pad, shadowY } = t._q;
  const h = Math.max(1, t.height);
  const g = t.context.createLinearGradient(0, pad, 0, h - pad - shadowY);
  g.addColorStop(0, st.top);
  g.addColorStop(0.45, st.top);
  g.addColorStop(1, st.bottom);
  t.setFill(g);
}

// 把 0-9 + - ! x 畫成一張字型圖（RetroFont），戰鬥浮動數字用（比一般文字快很多）
export function makeDigitFont(scene, key, style = 'white', size = 44) {
  if (scene.cache.bitmapFont.exists(key)) return;
  const st = QSTYLE[style];
  const chars = '0123456789+-!x';
  const cw = Math.ceil(size * 0.8), chH = Math.ceil(size * 1.3);
  const tex = scene.textures.createCanvas(key, cw * chars.length, chH);
  const ctx = tex.context;
  ctx.font = `${size}px "Lilita One", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const sw = Math.max(3, size * 0.16);
  const grad = ctx.createLinearGradient(0, chH * 0.25, 0, chH * 0.75);
  grad.addColorStop(0, st.top); grad.addColorStop(0.45, st.top); grad.addColorStop(1, st.bottom);
  for (let i = 0; i < chars.length; i++) {
    const x = cw * i + cw / 2, y = chH / 2 - 2;
    ctx.lineWidth = sw * 2;
    ctx.strokeStyle = st.shadow;
    ctx.strokeText(chars[i], x, y + size * 0.08);
    ctx.strokeStyle = st.stroke;
    ctx.strokeText(chars[i], x, y);
    ctx.fillStyle = grad;
    ctx.fillText(chars[i], x, y);
  }
  tex.refresh();
  const data = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: key, width: cw, height: chH, chars, charsPerRow: chars.length,
    spacing: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, lineSpacing: 0,
  });
  scene.cache.bitmapFont.add(key, data);
}
