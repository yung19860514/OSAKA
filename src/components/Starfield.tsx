"use client";

import { useEffect, useRef } from "react";
import { Px, getScene, lowRes } from "@/game/scenes";

// 背景場景：在低解析度畫布上畫，再以整數倍放大鋪滿視窗（像素清楚、大小一致）

export default function Starfield({ sceneId }: { sceneId: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = getScene(sceneId);

    let g: Px;
    let state: unknown;
    const resize = () => {
      const { W, H, scale } = lowRes(window.innerWidth, window.innerHeight);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = `${W * scale}px`;
      canvas.style.height = `${H * scale}px`;
      g = new Px(ctx, W, H);
      state = scene.init(W, H);
    };
    resize();

    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = reduce ? 0 : Math.min(0.1, (now - last) / 1000);
      last = now;
      scene.draw(g, reduce ? 0 : now, dt, state as never);
      raf = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [sceneId]);

  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}
