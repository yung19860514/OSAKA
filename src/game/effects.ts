// 畫面特效：消行閃光 + 碎片、硬降震動、結束時由下往上變灰。
// 特效只負責好看，不影響遊戲邏輯（消行在引擎裡已經完成，這裡只是在原位置補演出）。

import { COLS, HIDDEN_ROWS, VISIBLE_ROWS, type Cell, type GameEvent } from "./engine";
import type { Skin } from "./skins";

interface Flash {
  y: number; // 可視列
  t: number;
  dur: number;
}

interface Particle {
  x: number; // 以格為單位
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  color: string;
  life: number;
  max: number;
}

interface Popup {
  x: number; // 格
  y: number;
  text: string;
  color: string;
  size: number; // 相對格子大小
  t: number;
  dur: number;
}

const FLASH_MS = 260;
const OVER_MS = 900;

export class Effects {
  private flashes: Flash[] = [];
  private particles: Particle[] = [];
  private shake = 0;
  private popups: Popup[] = [];
  private bigFlash = { t: 0, dur: 0, color: "#fff" };
  private combo = 0;
  /** 畫面上的點陣字型（由畫面元件設定） */
  font = "monospace";
  /** 結束動畫進度 0~1；null 表示沒在播 */
  overProgress: number | null = null;

  reset() {
    this.flashes = [];
    this.particles = [];
    this.shake = 0;
    this.overProgress = null;
    this.popups = [];
    this.bigFlash = { t: 0, dur: 0, color: "#fff" };
    this.combo = 0;
  }

  /** 每幀告訴特效目前連擊數（連擊火焰依此決定火勢） */
  setCombo(n: number) {
    this.combo = n;
  }

  /** 連擊火焰火勢 0~1：2 連擊點燃，之後每多一連擊更旺 */
  get fireIntensity() {
    return this.combo >= 2 ? Math.min(1, 0.18 + (this.combo - 2) * 0.14) : 0;
  }

  get busy() {
    return this.overProgress !== null && this.overProgress < 1;
  }

  handle(e: GameEvent, skin: Skin) {
    switch (e.type) {
      case "clear":
      case "bomb":
        this.burst(e.rows, e.colors, skin, e.type === "bomb" ? 1.6 : 1 + e.rows.length * 0.15);
        if (e.type === "bomb") this.shake = 8;
        else if (e.rows.length >= 4) this.shake = 6;
        if (e.type === "clear") {
          const info = e.info;
          const visRows = e.rows.map((r) => r - HIDDEN_ROWS).filter((r) => r >= 0);
          const midY = visRows.length ? visRows.reduce((a, b) => a + b, 0) / visRows.length : 10;
          const big = info.lines >= 4 || info.tspin || info.perfect;
          // 分數排隊往上疊：跟還在畫面上的分數太近就往上挪，不重疊
          let y = midY + 0.5;
          for (let guard = 0; guard < 8; guard++) {
            const hit = this.popups.find((p) => Math.abs(p.y - (p.t / p.dur) * 1.5 - y) < 1.3);
            if (!hit) break;
            y = hit.y - (hit.t / hit.dur) * 1.5 - 1.4;
          }
          this.popups.push({
            x: COLS / 2,
            y: Math.max(1, y),
            text: `+${info.points}`,
            color: big ? "#ffd23f" : "#ffffff",
            size: big ? 0.9 : 0.6,
            t: 0,
            dur: 1000,
          });
          if (big) {
            this.bigFlash = { t: 0, dur: 420, color: info.perfect ? "#ff7ad9" : info.tspin ? "#b04dff" : "#2fd8e8" };
            this.shake = Math.max(this.shake, 7);
          }
        }
        break;
      case "lock":
        if (e.hard) this.shake = Math.max(this.shake, 3);
        break;
      case "gameover":
        this.overProgress = 0;
        break;
      case "revive":
        this.overProgress = null;
        break;
    }
  }

  private burst(rows: number[], colors: Cell[][], skin: Skin, power: number) {
    rows.forEach((row, i) => {
      const y = row - HIDDEN_ROWS;
      if (y < 0) return;
      this.flashes.push({ y, t: 0, dur: FLASH_MS });
      for (let x = 0; x < COLS; x++) {
        const c = colors[i]?.[x];
        const color = c ? skin.colors[c] : "#ffffff";
        // 每格碎成 3 片
        for (let k = 0; k < 3; k++) {
          const max = 500 + Math.random() * 400;
          this.particles.push({
            x: x + Math.random(),
            y: y + Math.random(),
            vx: (Math.random() - 0.5) * 9 * power,
            vy: (-Math.random() * 9 - 3) * power,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 12,
            size: 0.22 + Math.random() * 0.25,
            color,
            life: max,
            max,
          });
        }
      }
    });
  }

  update(dt: number) {
    const s = dt / 1000;
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.dur);
    for (const p of this.particles) {
      p.vy += 32 * s; // 重力（格/秒²）
      p.x += p.vx * s;
      p.y += p.vy * s;
      p.rot += p.vr * s;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0 && p.y < VISIBLE_ROWS + 2);
    this.shake = Math.max(0, this.shake - dt * 0.03);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.dur);
    if (this.bigFlash.t < this.bigFlash.dur) this.bigFlash.t += dt;

    if (this.overProgress !== null && this.overProgress < 1) {
      this.overProgress = Math.min(1, this.overProgress + dt / OVER_MS);
    }
  }

  /** 震動位移（像素），畫盤面前套用 */
  offset(): number {
    if (this.shake <= 0) return 0;
    return Math.sin(performance.now() / 18) * this.shake * 0.6 + this.shake * 0.4;
  }

  /** 畫在盤面之上 */
  draw(ctx: CanvasRenderingContext2D, cell: number, skin: Skin) {
    const w = COLS * cell;

    // 大招全盤閃光
    if (this.bigFlash.t < this.bigFlash.dur) {
      ctx.save();
      ctx.globalAlpha = (1 - this.bigFlash.t / this.bigFlash.dur) * 0.45;
      ctx.fillStyle = this.bigFlash.color;
      ctx.fillRect(0, 0, w, VISIBLE_ROWS * cell);
      ctx.restore();
    }

    for (const f of this.flashes) {
      const k = f.t / f.dur;
      ctx.save();
      ctx.globalAlpha = (1 - k) * 0.9;
      ctx.fillStyle = "#fff";
      // 閃光從中間往兩側收窄
      const half = (w / 2) * (1 - k * 0.6);
      ctx.fillRect(w / 2 - half, f.y * cell + cell * k * 0.35, half * 2, cell * (1 - k * 0.7));
      ctx.restore();
    }

    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
      ctx.translate(p.x * cell, p.y * cell);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      const s = p.size * cell;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
    }

    // 分數從消行位置跳出來
    for (const p of this.popups) {
      const k = p.t / p.dur;
      const scale = k < 0.15 ? 0.6 + (k / 0.15) * 0.6 : 1.2 - Math.min(0.2, (k - 0.15) * 0.5);
      ctx.save();
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `${Math.round(p.size * cell * scale)}px ${this.font}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const y = (p.y - k * 1.5) * cell;
      ctx.fillStyle = "#000";
      ctx.fillText(p.text, p.x * cell + 3, y + 3);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x * cell, y);
      ctx.restore();
    }

    // 結束動畫：由下往上一列一列蓋上暗色
    if (this.overProgress !== null) {
      const rows = Math.ceil(this.overProgress * VISIBLE_ROWS);
      ctx.save();
      ctx.fillStyle = skin.boardBg;
      ctx.globalAlpha = 0.65;
      ctx.fillRect(0, (VISIBLE_ROWS - rows) * cell, w, rows * cell);
      ctx.restore();
    }
  }
}
