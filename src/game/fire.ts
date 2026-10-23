// 像素火焰（經典 DOOM 片頭火焰演算法）：
// 底部放熱源，每一格的熱度往上傳、隨機衰減並左右飄 → 自然長出會搖晃的火舌。
// 用在連擊特效：熱源只放在盤面左右外側（盤面本身會蓋在火的上面），火從框外往上竄。

const PALETTE = [
  [0, 0, 0, 0],
  [31, 7, 7, 120],
  [47, 15, 7, 160],
  [71, 15, 7, 190],
  [87, 23, 7, 210],
  [103, 31, 7, 225],
  [119, 31, 7, 235],
  [143, 39, 7, 245],
  [159, 47, 7, 255],
  [175, 63, 7, 255],
  [191, 71, 7, 255],
  [199, 71, 7, 255],
  [223, 79, 7, 255],
  [223, 87, 7, 255],
  [223, 87, 7, 255],
  [215, 95, 7, 255],
  [215, 103, 15, 255],
  [207, 111, 15, 255],
  [207, 119, 15, 255],
  [207, 127, 15, 255],
  [207, 135, 23, 255],
  [199, 135, 23, 255],
  [199, 143, 23, 255],
  [199, 151, 31, 255],
  [191, 159, 31, 255],
  [191, 159, 31, 255],
  [191, 167, 39, 255],
  [191, 167, 39, 255],
  [191, 175, 47, 255],
  [183, 175, 47, 255],
  [183, 183, 47, 255],
  [183, 183, 55, 255],
  [207, 207, 111, 255],
  [223, 223, 159, 255],
  [239, 239, 199, 255],
  [255, 255, 255, 255],
];
const MAX_HEAT = PALETTE.length - 1;
/** 每秒更新幾次（固定速度，跟螢幕幀率無關） */
const STEPS_PER_SEC = 40;

export class PixelFire {
  private w = 0;
  private h = 0;
  private heat = new Uint8Array(0);
  private img: ImageData | null = null;
  private buf: HTMLCanvasElement | null = null;
  private acc = 0;
  /** 0 = 熄滅（熱源關掉，火自然往下熄）；1 = 最大火勢（燒滿整個盤面高度） */
  intensity = 0;
  /** 熱源範圍（以格為單位）：左外側 [0, leftEnd)、右外側 [rightStart, w) */
  private leftEnd = 0;
  private rightStart = 0;
  private px = 4;

  /** 依畫布大小重建格子；boardLeft/boardWidth 為盤面在畫布中的位置（CSS px） */
  resize(widthPx: number, heightPx: number, boardLeft: number, boardWidth: number, px = 4) {
    this.px = px;
    this.w = Math.max(1, Math.ceil(widthPx / px));
    this.h = Math.max(1, Math.ceil(heightPx / px));
    this.heat = new Uint8Array(this.w * this.h);
    this.leftEnd = Math.floor((boardLeft + 6) / px);
    this.rightStart = Math.ceil((boardLeft + boardWidth - 6) / px);
    if (typeof document !== "undefined") {
      this.buf = document.createElement("canvas");
      this.buf.width = this.w;
      this.buf.height = this.h;
      this.img = this.buf.getContext("2d")!.createImageData(this.w, this.h);
    }
  }

  /** 立刻熄滅（換局、結束時用） */
  reset() {
    this.heat.fill(0);
    this.intensity = 0;
  }

  get active() {
    return this.intensity > 0 || this.heat.some((v) => v > 0);
  }

  private step() {
    const { w, h, heat } = this;
    // 底部熱源：只在盤面左右外側（越靠近盤面越旺）
    const base = (h - 1) * w;
    for (let x = 0; x < w; x++) {
      const inside = x >= this.leftEnd && x < this.rightStart;
      if (inside || this.intensity <= 0) {
        heat[base + x] = 0;
        continue;
      }
      const distToBoard = x < this.leftEnd ? this.leftEnd - x : x - this.rightStart + 1;
      const falloff = Math.max(0, 1 - distToBoard / (w * 0.22));
      heat[base + x] = Math.random() < 0.85 * falloff + 0.1 ? MAX_HEAT : Math.floor(MAX_HEAT * falloff);
    }
    // 衰減機率：火勢越大衰減越慢 → 燒得越高；熄火時加快衰減，讓火乾淨地收掉（不留漂浮的火帶）
    const out = this.intensity <= 0;
    const decayP = out ? 1 : Math.min(1, 1.15 - 0.92 * this.intensity);
    for (let y = 1; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const src = y * w + x;
        const v = heat[src];
        if (v === 0) {
          heat[src - w] = 0;
          continue;
        }
        const r = Math.floor(Math.random() * 3);
        const dst = src - w - r + 1; // 往上、隨機左右飄
        if (dst < 0) continue;
        const dec = (Math.random() < decayP ? 1 : 0) + (out ? 2 : 0);
        heat[dst] = Math.max(0, v - dec - (r === 0 && Math.random() < 0.3 ? 1 : 0));
      }
    }
  }

  update(dtMs: number) {
    if (!this.w) return;
    this.acc += dtMs;
    const stepMs = 1000 / STEPS_PER_SEC;
    let n = 0;
    while (this.acc >= stepMs && n < 4) {
      this.acc -= stepMs;
      this.step();
      n++;
    }
    if (n === 4) this.acc = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.img || !this.buf) return;
    const d = this.img.data;
    for (let i = 0; i < this.heat.length; i++) {
      const c = PALETTE[this.heat[i]];
      const o = i * 4;
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = c[3];
    }
    this.buf.getContext("2d")!.putImageData(this.img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.buf, 0, 0, this.w * this.px, this.h * this.px);
  }
}
