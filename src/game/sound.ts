// 音效：用 Web Audio 即時合成，不需要音檔。
// 優先序：重要的聲音（結束 > 消行 > 升級 > 落地）播放中時，小聲音（移動、旋轉）先讓路，避免蓋掉。

import type { GameEvent } from "./engine";

type Wave = OscillatorType;

const PRIORITY: Record<string, number> = {
  move: 1,
  rotate: 1,
  hold: 2,
  lock: 2,
  bomb: 3,
  clear: 4,
  levelup: 4,
  revive: 4,
  gameover: 5,
};

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private busyUntil = 0;
  private busyPriority = 0;
  volume = 0.6;
  muted = false;

  /** 瀏覽器規定要在使用者操作後才能出聲，第一次按鍵/點擊時呼叫 */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.applyVolume();
    } catch {
      this.ctx = null; // 不支援 Web Audio 就安靜地玩
    }
  }

  setVolume(v: number, muted: boolean) {
    this.volume = v;
    this.muted = muted;
    this.applyVolume();
  }

  private applyVolume() {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume * 0.5;
  }

  private tone(freq: number, start: number, dur: number, type: Wave = "square", gain = 0.25, slideTo?: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain, start + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  private noise(start: number, dur: number, gain = 0.2, lowpass = 900) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master!);
    src.start(start);
  }

  play(e: GameEvent) {
    if (!this.ctx || !this.master || this.muted) return;
    const now = this.ctx.currentTime;
    const pr = PRIORITY[e.type] ?? 1;
    if (now < this.busyUntil && pr < this.busyPriority) return;

    let dur = 0.06;
    switch (e.type) {
      case "move":
        this.tone(180, now, 0.03, "square", 0.06);
        break;
      case "rotate":
        this.tone(520, now, 0.05, "triangle", 0.12, 760);
        break;
      case "hold":
        this.tone(440, now, 0.05, "triangle", 0.12);
        this.tone(330, now + 0.05, 0.06, "triangle", 0.12);
        dur = 0.12;
        break;
      case "lock":
        if (e.hard) {
          this.tone(140, now, 0.12, "sine", 0.45, 50);
          this.noise(now, 0.08, 0.25, 600);
          dur = 0.12;
        } else {
          this.tone(110, now, 0.07, "sine", 0.25, 70);
        }
        break;
      case "clear": {
        const n = Math.max(1, e.rows.length);
        // 消越多行，琶音越長越高
        const base = [523, 659, 784, 1047, 1319];
        for (let i = 0; i <= n; i++) this.tone(base[i], now + i * 0.055, 0.12, "square", 0.14);
        if (n >= 4 || e.info.tspin) {
          this.tone(1568, now + 0.3, 0.35, "triangle", 0.18);
          this.noise(now, 0.25, 0.12, 4000);
        }
        dur = 0.06 * n + 0.2;
        break;
      }
      case "levelup":
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, now + 0.25 + i * 0.07, 0.14, "triangle", 0.16));
        dur = 0.6;
        break;
      case "bomb":
        this.tone(90, now, 0.4, "sawtooth", 0.3, 30);
        this.noise(now, 0.45, 0.4, 1200);
        dur = 0.4;
        break;
      case "revive":
        [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, now + i * 0.06, 0.15, "triangle", 0.18));
        dur = 0.4;
        break;
      case "gameover":
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, now + i * 0.16, 0.22, "square", 0.16));
        dur = 0.8;
        break;
    }
    if (pr >= this.busyPriority || now >= this.busyUntil) {
      this.busyPriority = pr;
      this.busyUntil = now + dur;
    }
  }
}
