"use client";

import { useEffect, useRef } from "react";
import type { Mood } from "@/game/mascot";
import { drawPet, type Pet } from "@/game/pets";
import { useT } from "@/i18n";

const GRID = 24;

/** 畫一隻會動的像素動物；size = 顯示大小（CSS px） */
export function PetCanvas({
  pet,
  mood,
  kick = 0,
  className,
}: {
  pet: Pet;
  mood: Mood;
  kick?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const moodStart = useRef(0);

  useEffect(() => {
    moodStart.current = performance.now();
  }, [mood, kick]);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    let raf = 0;
    const frame = (now: number) => {
      const rect = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const size = Math.round(rect.width * dpr);
      if (size > 0 && c.width !== size) {
        c.width = size;
        c.height = size;
      }
      // 以整數倍放大，保持像素銳利
      const px = Math.max(1, Math.floor(size / GRID));
      const off = Math.floor((size - px * GRID) / 2);
      ctx.setTransform(1, 0, 0, 1, off, off);
      ctx.clearRect(-off, -off, size, size);
      drawPet(ctx, pet, px, mood, now, now - moodStart.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [pet, mood]);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}

/** 吉祥物：動物 + 對話泡泡；mood 或 kick 改變時重播表情動畫 */
export default function Mascot({ pet, mood, kick }: { pet: Pet; mood: Mood; kick: number }) {
  const t = useT();
  return (
    <div className="mascot">
      <PetCanvas pet={pet} mood={mood} kick={kick} className="mascot-canvas" />
      <div key={`${mood}-${kick}`} className={`mascot-bubble mascot-${mood}`}>
        {t(`mood.${mood}`)}
      </div>
    </div>
  );
}
