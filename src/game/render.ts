// Canvas 繪圖：盤面、影子、方塊、預覽小格

import { COLS, HIDDEN_ROWS, VISIBLE_ROWS, type Game } from "./engine";
import { SHAPES, type PieceType } from "./pieces";
import type { Skin } from "./skins";

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 0xff) + amt);
  const b = clamp((n & 0xff) + amt);
  return `rgb(${r},${g},${b})`;
}

export function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  skin: Skin,
  alpha = 1,
) {
  const pad = Math.max(1, size * 0.04);
  const s = size - pad * 2;
  const px = x + pad;
  const py = y + pad;
  ctx.save();
  ctx.globalAlpha = alpha;

  if (skin.style === "bevel") {
    // 街機磚塊：中間主色，四邊斜面（上左亮、下右暗）做出凸起感
    const b = Math.max(2, Math.round(size * 0.16));
    const x0 = x, y0 = y, x1 = x + size, y1 = y + size;
    const quad = (pts: number[], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
      ctx.closePath();
      ctx.fill();
    };
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, size, size);
    quad([x0, y0, x1, y0, x1 - b, y0 + b, x0 + b, y0 + b], shade(color, 70));
    quad([x0, y0, x0 + b, y0 + b, x0 + b, y1 - b, x0, y1], shade(color, 35));
    quad([x1, y0, x1, y1, x1 - b, y1 - b, x1 - b, y0 + b], shade(color, -50));
    quad([x0, y1, x0 + b, y1 - b, x1 - b, y1 - b, x1, y1], shade(color, -80));
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x0 + b, y0 + b, Math.max(1, b * 0.6), Math.max(1, b * 0.6));
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, size - 1, size - 1);
  } else if (skin.style === "flat") {
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);
  } else if (skin.style === "neon") {
    ctx.shadowColor = color;
    ctx.shadowBlur = size * 0.45;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, size * 0.09);
    const inset = ctx.lineWidth / 2 + pad;
    ctx.strokeRect(x + inset, y + inset, size - inset * 2, size - inset * 2);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = alpha * 0.18;
    ctx.fillStyle = color;
    ctx.fillRect(px, py, s, s);
  } else {
    // gem：圓角 + 上亮下暗的立體感
    const r = s * 0.18;
    const grad = ctx.createLinearGradient(px, py, px, py + s);
    grad.addColorStop(0, shade(color, 40));
    grad.addColorStop(1, shade(color, -45));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(px, py, s, s, r);
    ctx.fill();
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.roundRect(px + s * 0.14, py + s * 0.1, s * 0.72, s * 0.22, r * 0.8);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBoard(ctx: CanvasRenderingContext2D, game: Game, skin: Skin, cell: number) {
  const w = COLS * cell;
  const h = VISIBLE_ROWS * cell;
  ctx.fillStyle = skin.boardBg;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = skin.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, h);
  }
  for (let y = 1; y < VISIBLE_ROWS; y++) {
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(w, y * cell + 0.5);
  }
  ctx.stroke();

  // 已固定的方塊
  for (let y = HIDDEN_ROWS; y < game.board.length; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = game.board[y][x];
      if (c) drawBlock(ctx, x * cell, (y - HIDDEN_ROWS) * cell, cell, skin.colors[c], skin);
    }
  }

  const p = game.active;
  if (!p || game.over) return;
  const color = skin.colors[p.type];

  // 影子（落點預覽）
  const gy = game.ghostY();
  for (const [cx, cy] of SHAPES[p.type][p.rot]) {
    const y = gy + cy - HIDDEN_ROWS;
    if (y < 0) continue;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = Math.max(1, cell * 0.06);
    const inset = cell * 0.12;
    ctx.strokeRect((p.x + cx) * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
    ctx.restore();
  }

  for (const [cx, cy] of SHAPES[p.type][p.rot]) {
    const y = p.y + cy - HIDDEN_ROWS;
    if (y < 0) continue;
    drawBlock(ctx, (p.x + cx) * cell, y * cell, cell, color, skin);
  }
}

/** 在小 canvas 置中畫一顆方塊（Hold / Next 用） */
export function drawMini(
  ctx: CanvasRenderingContext2D,
  type: PieceType | null,
  skin: Skin,
  w: number,
  h: number,
  dim = false,
) {
  ctx.clearRect(0, 0, w, h);
  if (!type) return;
  const cells = SHAPES[type][0];
  const xs = cells.map(([x]) => x);
  const ys = cells.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const bw = Math.max(...xs) - minX + 1;
  const bh = Math.max(...ys) - minY + 1;
  const cell = Math.min(w / 4.4, h / 2.6);
  const ox = (w - bw * cell) / 2;
  const oy = (h - bh * cell) / 2;
  for (const [x, y] of cells) {
    drawBlock(ctx, ox + (x - minX) * cell, oy + (y - minY) * cell, cell, skin.colors[type], skin, dim ? 0.35 : 1);
  }
}
