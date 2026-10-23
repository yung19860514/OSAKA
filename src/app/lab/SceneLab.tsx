"use client";

import { useEffect, useRef } from "react";
import { Px, SCENES } from "@/game/scenes";

// 開發用：以 320×180 低解析度畫場景，再 2 倍放大檢視
function SceneBox({ idx }: { idx: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const W = 320;
    const H = 180;
    const scene = SCENES[idx];
    const state = scene.init(W, H);
    const g = new Px(ctx, W, H);
    let raf = 0;
    let last = performance.now();
    const f = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      scene.draw(g, now, dt, state as never);
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [idx]);
  return (
    <figure style={{ margin: 0 }}>
      <canvas ref={ref} width={320} height={180} style={{ width: 640, height: 360, imageRendering: "pixelated" }} />
      <figcaption style={{ fontSize: 13 }}>{SCENES[idx].name}</figcaption>
    </figure>
  );
}

export default function SceneLab() {
  return (
    <section>
      <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>關卡場景</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {SCENES.map((s, i) => (
          <SceneBox key={s.id} idx={i} />
        ))}
      </div>
    </section>
  );
}
