"use client";

// 方塊消消的宣傳主視覺（平台大廳的橫幅與遊戲卡片用）：
// 低解析度畫好再整數放大，用遊戲自己的場景、方塊、吉祥物，會慢慢動。

import { useEffect, useRef } from "react";
import { drawBlock } from "@/game/render";
import { getSkin } from "@/game/skins";
import { Px, getScene } from "@/game/scenes";
import { drawPet, getPet } from "@/game/pets";

const STACK = ["Z......I..", "ZZ.T...I..", ".ZTTOO.I.L", "JJJ.OOSSIL", "..JLLSS.LL", "GGGLGGGGG."];
const FALLING: [number, number][] = [
  [0, 0],
  [1, 0],
  [2, 0],
  [1, 1],
];

/** variant：banner = 寬橫幅（右側放方塊與吉祥物）；card = 遊戲卡片 */
export default function BlockBlitzKeyArt({ variant, className }: { variant: "banner" | "card"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    // 橫幅比例約 2.9:1（跟大廳輪播框一致，放大時不會被裁掉上下）
    const W = variant === "banner" ? 480 : 240;
    const H = variant === "banner" ? 166 : 150;
    c.width = W;
    c.height = H;
    const scene = getScene("city");
    const g = new Px(ctx, W, H);
    const state = scene.init(W, H);
    const skin = getSkin("arcade");
    const pet = getPet(variant === "banner" ? "dog" : "cat");
    const cell = 11;
    const cols = 10;
    const boardX = variant === "banner" ? W - cols * cell - 40 : Math.round((W - cols * cell) / 2);
    const boardH = H - 14;
    let raf = 0;
    let last = performance.now();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const frame = (now: number) => {
      const dt = Math.min(100, now - last);
      last = now;
      ctx.imageSmoothingEnabled = false;
      scene.draw(g, now, dt, state as never);
      // 盤面
      ctx.fillStyle = "rgba(5,6,12,0.82)";
      ctx.fillRect(boardX - 2, H - boardH - 2, cols * cell + 4, boardH + 2);
      ctx.fillStyle = skin.boardBg;
      ctx.fillRect(boardX, H - boardH, cols * cell, boardH);
      STACK.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === ".") return;
          drawBlock(ctx, boardX + x * cell, H - (STACK.length - y) * cell, cell, skin.colors[ch as keyof typeof skin.colors], skin);
        }),
      );
      // 正在落下的 T
      const span = boardH - STACK.length * cell - cell * 2;
      const fy = reduce ? span * 0.4 : ((now / 28) % (span + cell * 3)) - cell * 2;
      for (const [dx, dy] of FALLING) drawBlock(ctx, boardX + (4 + dx) * cell, H - boardH + fy + dy * cell, cell, skin.colors.T, skin);
      // 吉祥物坐在盤面旁邊
      const px = variant === "banner" ? 3 : 2;
      ctx.save();
      ctx.translate(variant === "banner" ? boardX - 24 * px + 6 : boardX + cols * cell - 6, H - 24 * px);
      drawPet(ctx, pet, px, "happy", now, now % 4000);
      ctx.restore();
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [variant]);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
