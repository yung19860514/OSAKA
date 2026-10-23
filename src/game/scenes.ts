// 像素風關卡背景。
// 做法：在低解析度畫布（寬 320 格）上畫，再整數放大顯示 → 每個像素都是清楚的方塊。
// 天空用分色帶 + 棋盤網點過渡（不用平滑漸層），前中後景分層、不同速度捲動。

export interface Scene {
  id: string;
  name: string;
  /** 0 = 免費預設；>0 = 未來用遊戲幣購買 */
  price: number;
  init: (W: number, H: number) => unknown;
  draw: (g: Px, t: number, dt: number, state: never) => void;
}

/** 低解析度畫筆：所有座標都是整數格 */
export class Px {
  constructor(
    public ctx: CanvasRenderingContext2D,
    public W: number,
    public H: number,
  ) {}
  rect(x: number, y: number, w: number, h: number, c: string) {
    this.ctx.fillStyle = c;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  dot(x: number, y: number, c: string) {
    this.rect(x, y, 1, 1, c);
  }
  /** 分色帶天空：colors 由上到下，交界處 2 列棋盤網點 */
  bands(colors: string[], y0: number, y1: number) {
    const n = colors.length;
    const bh = (y1 - y0) / n;
    for (let i = 0; i < n; i++) {
      const top = Math.round(y0 + i * bh);
      const bot = Math.round(y0 + (i + 1) * bh);
      this.rect(0, top, this.W, bot - top, colors[i]);
      if (i < n - 1) {
        // 下一色以網點滲進這一帶的最後 2 列
        this.ctx.fillStyle = colors[i + 1];
        for (let y = bot - 2; y < bot; y++) {
          for (let x = (y + (y === bot - 1 ? 0 : 1)) % 2; x < this.W; x += y === bot - 1 ? 2 : 4) {
            this.ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  }
  /** 實心像素圓 */
  disc(cx: number, cy: number, r: number, c: string) {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      this.rect(cx - half, cy + y, half * 2 + 1, 1, c);
    }
  }
}

// ---------- 工具 ----------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 山稜線：隨機中點位移，回傳每一欄的高度 */
function ridge(width: number, base: number, rough: number, r: () => number): number[] {
  let size = 1;
  while (size < width) size *= 2;
  const h = new Array(size + 1).fill(base);
  h[0] = base + (r() - 0.5) * rough;
  h[size] = base + (r() - 0.5) * rough;
  let step = size;
  let amp = rough;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < size; i += step) h[i] = (h[i - half] + h[i + half]) / 2 + (r() - 0.5) * amp;
    step = half;
    amp *= 0.55;
  }
  return h.slice(0, width);
}

const wrap = (v: number, m: number) => ((v % m) + m) % m;

// ========== 1. 霓虹夜城 ==========
type Building = { x: number; w: number; h: number; lit: boolean[]; sign?: { c: string; y: number; w: number }; antenna: boolean };
type CityS = { stars: [number, number, number][]; far: Building[]; near: Building[]; farW: number; nearW: number };

function makeBuildings(r: () => number, H: number, minH: number, maxH: number, signs: boolean): { list: Building[]; total: number } {
  const list: Building[] = [];
  let x = 0;
  while (x < 640) {
    const w = 14 + Math.floor(r() * 26);
    const h = Math.floor(minH + r() * (maxH - minH));
    const signColors = ["#ff4fd8", "#33f0ff", "#ffe14a", "#7dff6a"];
    list.push({
      x,
      w,
      h,
      lit: Array.from({ length: 200 }, () => r() < 0.38),
      antenna: r() < 0.35,
      sign: signs && r() < 0.35 ? { c: signColors[Math.floor(r() * 4)], y: 4 + Math.floor(r() * 10), w: Math.min(w - 4, 8 + Math.floor(r() * 10)) } : undefined,
    });
    x += w + 1 + Math.floor(r() * 3);
  }
  void H;
  return { list, total: x };
}

const city: Scene = {
  id: "city",
  name: "霓虹夜城",
  price: 300,
  init: (W, H): CityS => {
    const r = rng(7);
    const far = makeBuildings(r, H, H * 0.25, H * 0.55, false);
    const near = makeBuildings(r, H, H * 0.18, H * 0.42, true);
    return {
      stars: Array.from({ length: 70 }, () => [Math.floor(r() * W), Math.floor(r() * H * 0.5), r() * 6]),
      far: far.list,
      farW: far.total,
      near: near.list,
      nearW: near.total,
    };
  },
  draw: (g, t, _dt, s: CityS) => {
    const { W, H } = g;
    g.bands(["#0a0820", "#120c30", "#1c1043", "#2a1556", "#3d1a66", "#58206f", "#7a2a74"], 0, H);
    for (const [x, y, p] of s.stars) {
      const on = Math.sin(t / 700 + p) > -0.3;
      if (on) g.dot(x, y, Math.sin(t / 400 + p) > 0.6 ? "#ffffff" : "#9f9bd8");
    }
    // 月亮（帶隕石坑）
    const mx = Math.round(W * 0.8);
    const my = Math.round(H * 0.18);
    g.disc(mx, my, 12, "#fff0b8");
    g.disc(mx + 3, my - 2, 11, "#ffe48a");
    g.rect(mx - 5, my - 3, 3, 2, "#e8c66a");
    g.rect(mx + 2, my + 4, 4, 2, "#e8c66a");
    g.rect(mx - 2, my + 7, 2, 1, "#e8c66a");

    const drawLayer = (list: Building[], total: number, speed: number, body: string, edge: string, win: string[], neon: boolean) => {
      const off = (t / 1000) * speed;
      for (const b of list) {
        const x = Math.round(wrap(b.x - off, total) - 40);
        if (x > W || x + b.w < 0) continue;
        const top = H - b.h;
        g.rect(x, top, b.w, b.h, body);
        g.rect(x, top, 1, b.h, edge);
        if (b.antenna) {
          g.rect(x + Math.floor(b.w / 2), top - 6, 1, 6, body);
          if (Math.floor(t / 600 + b.x) % 2 === 0) g.dot(x + Math.floor(b.w / 2), top - 7, "#ff3355");
        }
        let i = 0;
        for (let wy = top + 3; wy < H - 4; wy += 4) {
          for (let wx = x + 2; wx < x + b.w - 2; wx += 3) {
            if (b.lit[i++ % b.lit.length]) g.rect(wx, wy, 2, 2, win[i % win.length]);
          }
        }
        if (neon && b.sign) {
          const sx = x + Math.floor((b.w - b.sign.w) / 2);
          const sy = top + b.sign.y;
          const flick = Math.sin(t / 90 + b.x) > -0.95;
          if (flick) {
            g.rect(sx, sy, b.sign.w, 1, b.sign.c);
            g.rect(sx, sy + 4, b.sign.w, 1, b.sign.c);
            g.rect(sx, sy, 1, 5, b.sign.c);
            g.rect(sx + b.sign.w - 1, sy, 1, 5, b.sign.c);
            for (let k = sx + 2; k < sx + b.sign.w - 2; k += 2) g.dot(k, sy + 2, b.sign.c);
          }
        }
      }
    };
    drawLayer(s.far, s.farW, 4, "#24124a", "#2f185c", ["#5a3c8a", "#463070"], false);
    drawLayer(s.near, s.nearW, 10, "#0e0820", "#1a1036", ["#ffd86a", "#ffe9a8", "#6ff0ff"], true);
    // 地面霓虹線
    g.rect(0, H - 2, W, 1, "#33f0ff");
    g.rect(0, H - 1, W, 1, "#0e0820");
  },
};

// ========== 2. 夕陽山谷 ==========
type SunsetS = { r1: number[]; r2: number[]; r3: number[]; trees: [number, number][]; birds: [number, number, number][] };
const sunset: Scene = {
  id: "sunset",
  name: "夕陽山谷",
  price: 300,
  init: (W, H): SunsetS => {
    const r = rng(21);
    return {
      r1: ridge(W * 2, H * 0.7, H * 0.22, r),
      r2: ridge(W * 2, H * 0.8, H * 0.18, r),
      r3: ridge(W * 2, H * 0.9, H * 0.1, r),
      trees: Array.from({ length: 30 }, () => [Math.floor(r() * W * 2), 14 + Math.floor(r() * 22)]),
      birds: Array.from({ length: 5 }, () => [r() * W, H * 0.15 + r() * H * 0.2, r() * 6]),
    };
  },
  draw: (g, t, dt, s: SunsetS) => {
    const { W, H } = g;
    g.bands(["#241a4a", "#3d2160", "#6a2a6e", "#a33d6b", "#d8585e", "#f2805a", "#ffad62", "#ffd27a"], 0, H * 0.75);
    g.rect(0, Math.round(H * 0.75), W, H, "#ffd27a");
    // 夕陽：橫條切口（復古夕陽）
    const sx = Math.round(W * 0.5);
    const sy = Math.round(H * 0.6);
    g.disc(sx, sy, 30, "#ffe66d");
    g.disc(sx, sy + 4, 26, "#ffb84a");
    // 只在太陽圓內切出橫條，越往下越粗
    for (let i = 0; i < 6; i++) {
      const y0 = 6 + i * 5;
      for (let k = 0; k < 1 + Math.floor(i / 2); k++) {
        const dy = y0 + k;
        if (dy > 30) continue;
        const half = Math.floor(Math.sqrt(30 * 30 - dy * dy));
        g.rect(sx - half, sy + dy, half * 2 + 1, 1, "#f2805a");
      }
    }
    const layer = (hts: number[], speed: number, c: string, top: string) => {
      const off = Math.floor((t / 1000) * speed);
      for (let x = 0; x < W; x++) {
        const y = Math.round(hts[wrap(x + off, hts.length)]);
        g.rect(x, y, 1, H - y, c);
        g.dot(x, y, top);
      }
    };
    layer(s.r1, 3, "#7a2f62", "#a8456e");
    layer(s.r2, 7, "#4e1e52", "#6d2a5e");
    layer(s.r3, 14, "#2a1238", "#3e1a4a");
    // 前景松樹
    const off = (t / 1000) * 24;
    for (const [tx, th] of s.trees) {
      const x = Math.round(wrap(tx - off, W * 2) - 20);
      if (x < -10 || x > W + 10) continue;
      const base = H;
      g.rect(x, base - 3, 1, 3, "#120818");
      for (let i = 0; i < th; i++) {
        const half = Math.floor((i / th) * 5) + 1;
        g.rect(x - half + 1, base - 3 - (th - i), half * 2 - 1, 1, "#120818");
      }
    }
    // 飛鳥
    for (const b of s.birds) {
      b[0] -= dt * 14;
      if (b[0] < -6) b[0] = W + 6;
      const flap = Math.floor(t / 220 + b[2]) % 2;
      const x = Math.round(b[0]);
      const y = Math.round(b[1] + Math.sin(t / 600 + b[2]) * 2);
      g.dot(x, y, "#2a1238");
      g.dot(x - 1, y - flap, "#2a1238");
      g.dot(x + 1, y - flap, "#2a1238");
      g.dot(x - 2, y - 1 + flap, "#2a1238");
      g.dot(x + 2, y - 1 + flap, "#2a1238");
    }
  },
};

// ========== 3. 深海 ==========
type Fish = { x: number; y: number; v: number; c: string; dir: number };
type SeaS = { fish: Fish[]; bubbles: [number, number, number][]; weeds: [number, number, number][]; corals: [number, string, number][]; sand: number[] };
// 8×5 小魚（朝右）：x 身體、s 條紋、o 眼睛
const FISH = ["...xxx..", "x.xxsxx.", "xxxxsxox", "x.xxsxx.", "...xxx.."];
const sea: Scene = {
  id: "sea",
  name: "深海",
  price: 300,
  init: (W, H): SeaS => {
    const r = rng(33);
    const fishColors = ["#ffb02e", "#ff6a8a", "#5ff0ff", "#ffe14a"];
    return {
      fish: Array.from({ length: 9 }, () => {
        const dir = r() < 0.5 ? 1 : -1;
        return { x: r() * W, y: H * 0.2 + r() * H * 0.55, v: 8 + r() * 14, c: fishColors[Math.floor(r() * 4)], dir };
      }),
      bubbles: Array.from({ length: 22 }, () => [r() * W, r() * H, 6 + r() * 12]),
      weeds: Array.from({ length: 16 }, () => [Math.floor(r() * W), 10 + Math.floor(r() * 26), r() * 6]),
      corals: Array.from({ length: 8 }, () => [Math.floor(r() * W), ["#ff6a8a", "#ff8f3a", "#c86aff", "#ffd23f"][Math.floor(r() * 4)], 12 + Math.floor(r() * 12)]),
      sand: ridge(W, H - 10, 6, r),
    };
  },
  draw: (g, t, dt, s: SeaS) => {
    const { W, H } = g;
    g.bands(["#1a6aa0", "#155b8f", "#114c7c", "#0d3d69", "#0a3058", "#072447", "#051a36"], 0, H);
    // 光束：斜向網點條紋，左右擺動
    for (let i = 0; i < 4; i++) {
      const bx = Math.round(i * (W / 4) + 20 + Math.sin(t / 2500 + i) * 12);
      for (let y = 0; y < H * 0.85; y++) {
        const x0 = bx + Math.floor(y * 0.45);
        for (let x = x0; x < x0 + 10; x++) if ((x + y) % 3 === 0) g.dot(x, y, "rgba(170,230,255,0.18)");
      }
    }
    // 沙地
    for (let x = 0; x < W; x++) {
      const y = Math.round(s.sand[x]);
      g.rect(x, y, 1, H - y, "#c9a86a");
      g.dot(x, y, "#e8cf92");
      if ((x * 7) % 11 === 0) g.dot(x, y + 3, "#a8884e");
    }
    // 岩石
    for (let i = 0; i < 5; i++) {
      const rx = Math.round((i * W) / 5 + 30);
      const base = Math.round(s.sand[Math.min(W - 1, rx)]);
      g.rect(rx - 6, base - 5, 12, 6, "#3a4a6a");
      g.rect(rx - 4, base - 7, 8, 2, "#3a4a6a");
      g.rect(rx - 4, base - 7, 4, 1, "#5a6a8e");
      g.rect(rx - 6, base - 5, 3, 1, "#5a6a8e");
    }
    // 珊瑚：主幹 + 左右各兩層分枝，枝端亮色
    for (const [cx, c, h] of s.corals) {
      const base = Math.round(s.sand[cx]);
      g.rect(cx, base - h, 2, h, c);
      const arm = (y: number, dir: number, len: number, up: number) => {
        const x0 = dir < 0 ? cx - len : cx + 2;
        g.rect(x0, base - y, len, 1, c);
        const tipX = dir < 0 ? cx - len : cx + 1 + len;
        g.rect(tipX, base - y - up, 1, up, c);
        g.dot(tipX, base - y - up, "#ffffff");
      };
      arm(Math.floor(h * 0.35), -1, 4, 5);
      arm(Math.floor(h * 0.55), 1, 4, 6);
      arm(Math.floor(h * 0.75), -1, 3, 4);
      arm(Math.floor(h * 0.85), 1, 2, 3);
      g.dot(cx, base - h, "#ffffff");
    }
    // 海草
    for (const [wx, wh, ph] of s.weeds) {
      const base = Math.round(s.sand[wx]);
      for (let i = 0; i < wh; i++) {
        const sway = Math.round(Math.sin(t / 800 + ph + i / 6) * (i / 8));
        g.dot(wx + sway, base - i, i % 3 === 0 ? "#3fae6a" : "#2a8a52");
      }
    }
    // 魚
    for (const f of s.fish) {
      f.x += f.dir * f.v * dt;
      if (f.x > W + 8) f.x = -8;
      if (f.x < -8) f.x = W + 8;
      const y = Math.round(f.y + Math.sin(t / 500 + f.x / 20) * 2);
      FISH.forEach((row, ry) =>
        [...row].forEach((ch, rx) => {
          if (ch === ".") return;
          const x = f.dir > 0 ? Math.round(f.x) + rx : Math.round(f.x) + (row.length - 1 - rx);
          g.dot(x, y + ry, ch === "o" ? "#101828" : ch === "s" ? "#ffffff" : f.c);
        }),
      );
    }
    // 氣泡
    for (const b of s.bubbles) {
      b[1] -= b[2] * dt;
      if (b[1] < -3) {
        b[1] = H + 2;
        b[0] = Math.random() * W;
      }
      const x = Math.round(b[0] + Math.sin(t / 400 + b[2]) * 1.5);
      const y = Math.round(b[1]);
      if (b[2] > 12) {
        g.rect(x, y, 2, 2, "rgba(220,250,255,0.6)");
        g.dot(x, y, "#ffffff");
      } else g.dot(x, y, "rgba(220,250,255,0.7)");
    }
  },
};

// ========== 4. 太空 ==========
type SpaceS = {
  stars: [number, number, number, number][];
  neb: Uint8Array;
  nebW: number;
  nebH: number;
  shoot: { x: number; y: number; life: number } | null;
  /** 靜態層（底色、星雲、行星、衛星）只畫一次 */
  layer: HTMLCanvasElement | null;
};
function paintSpaceStatic(g: Px, s: SpaceS) {
  const { W, H } = g;
    g.rect(0, 0, W, H, "#06051a");
    const nebC = ["", "#1a1240", "#2e1660", "#4a1e7a"];
    for (let y = 0; y < Math.min(H, s.nebH); y++)
      for (let x = 0; x < Math.min(W, s.nebW); x++) {
        const v = s.neb[y * s.nebW + x];
        // 網點：第 1 階只畫一半的格子，讓邊緣有顆粒感
        if (v === 0 || (v === 1 && (x + y) % 2 === 0)) continue;
        g.dot(x, y, nebC[v]);
      }
    // 行星（右上受光，分色帶）
    const px = Math.round(W * 0.22);
    const py = Math.round(H * 0.72);
    const R = 34;
    // 星環後半
    for (let a = Math.PI; a < Math.PI * 2; a += 0.01) g.dot(px + Math.cos(a) * 56, py + Math.sin(a) * 9, "#c79a5a");
    const shades = ["#3a2a6a", "#5a3a8a", "#8a4fa0", "#c46a9a", "#f29a8a"];
    for (let y = -R; y <= R; y++) {
      const half = Math.floor(Math.sqrt(R * R - y * y));
      for (let x = -half; x <= half; x++) {
        // 光從右上來：越靠右上越亮
        const l = (x * 0.7 - y * 0.7) / R;
        const idx = Math.max(0, Math.min(4, Math.floor((l + 1) * 2.5)));
        // 色帶交界做網點
        const frac = (l + 1) * 2.5 - Math.floor((l + 1) * 2.5);
        const i2 = frac > 0.8 && (x + y) % 2 === 0 ? Math.min(4, idx + 1) : idx;
        g.dot(px + x, py + y, shades[i2]);
      }
    }
    // 行星條紋
    for (let y = -R + 8; y < R; y += 11) {
      const half = Math.floor(Math.sqrt(R * R - y * y));
      for (let x = -half; x <= half; x += 1) if ((x + y) % 3 !== 0) g.dot(px + x, py + y, "rgba(40,20,80,0.35)");
    }
    // 星環前半
    for (let a = 0; a < Math.PI; a += 0.01) {
      g.dot(px + Math.cos(a) * 56, py + Math.sin(a) * 9, "#ffd28a");
      g.dot(px + Math.cos(a) * 52, py + Math.sin(a) * 8, "#c79a5a");
    }
    // 小衛星
    g.disc(Math.round(W * 0.82), Math.round(H * 0.25), 6, "#7a86b8");
    g.disc(Math.round(W * 0.82) + 2, Math.round(H * 0.25) - 1, 4, "#a8b4e0");
}

const space: Scene = {
  id: "space",
  name: "星海",
  price: 0,
  init: (W, H): SpaceS => {
    const r = rng(5);
    // 星雲：低頻雜訊，量化成 4 階
    const neb = new Uint8Array(W * H);
    const grid = 24;
    const gw = Math.ceil(W / grid) + 2;
    const gh = Math.ceil(H / grid) + 2;
    const pts = Array.from({ length: gw * gh }, () => r());
    const val = (x: number, y: number) => {
      const gx = Math.floor(x / grid);
      const gy = Math.floor(y / grid);
      const fx = (x % grid) / grid;
      const fy = (y % grid) / grid;
      const sm = (v: number) => v * v * (3 - 2 * v);
      const a = pts[gy * gw + gx];
      const b = pts[gy * gw + gx + 1];
      const c = pts[(gy + 1) * gw + gx];
      const d = pts[(gy + 1) * gw + gx + 1];
      const top = a + (b - a) * sm(fx);
      const bot = c + (d - c) * sm(fx);
      return top + (bot - top) * sm(fy);
    };
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        // 讓星雲集中在一條斜帶
        const band = 1 - Math.min(1, Math.abs(y - (H * 0.9 - x * 0.45)) / (H * 0.35));
        const v = val(x, y) * band;
        neb[y * W + x] = v > 0.55 ? 3 : v > 0.42 ? 2 : v > 0.3 ? 1 : 0;
      }
    return {
      stars: Array.from({ length: 140 }, () => [Math.floor(r() * W), Math.floor(r() * H), r() * 6, r() < 0.12 ? 2 : 1]),
      neb,
      nebW: W,
      nebH: H,
      shoot: null,
      layer: null,
    };
  },
  draw: (g, t, dt, s: SpaceS) => {
    const { W, H } = g;
    if (!s.layer) {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const sg = new Px(c.getContext("2d")!, W, H);
      paintSpaceStatic(sg, s);
      s.layer = c;
    }
    g.ctx.drawImage(s.layer, 0, 0);
    for (const [x, y, p, sz] of s.stars) {
      const tw = Math.sin(t / 500 + p * 3);
      const c = tw > 0.7 ? "#ffffff" : tw > -0.2 ? "#b8c4ff" : "#5a5fa0";
      g.dot(x, y, c);
      if (sz === 2 && tw > 0.5) {
        g.dot(x - 1, y, "#8a90d8");
        g.dot(x + 1, y, "#8a90d8");
        g.dot(x, y - 1, "#8a90d8");
        g.dot(x, y + 1, "#8a90d8");
      }
    }
    // 流星
    if (!s.shoot && Math.random() < dt * 0.25) s.shoot = { x: W * (0.4 + Math.random() * 0.6), y: Math.random() * H * 0.3, life: 0 };
    if (s.shoot) {
      s.shoot.life += dt;
      const k = s.shoot.life;
      const x = Math.round(s.shoot.x - k * 160);
      const y = Math.round(s.shoot.y + k * 80);
      for (let i = 0; i < 10; i++) g.dot(x + i * 2, y - i, i < 2 ? "#ffffff" : i < 5 ? "#b8c4ff" : "#5a5fa0");
      if (k > 0.8) s.shoot = null;
    }
  },
};

export const SCENES: Scene[] = [space, city, sea, sunset];

export function getScene(id: string | null | undefined): Scene {
  return SCENES.find((s) => s.id === id) ?? space;
}

/** 依視窗大小決定低解析度畫布：整數倍放大（像素才會一樣大），寬約 320 格 */
export function lowRes(w: number, h: number) {
  const scale = Math.max(1, Math.round(w / 320));
  return { W: Math.ceil(w / scale), H: Math.ceil(h / scale), scale };
}
