"use client";

import { useEffect, useRef } from "react";
import type { Mood } from "@/game/mascot";
import { PETS, drawPet } from "@/game/pets";

const MOODS: Mood[] = ["idle", "happy", "excited", "worried", "sad", "cheer"];

function Cell({ petIdx, mood }: { petIdx: number; mood: Mood }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    const start = performance.now();
    let raf = 0;
    const f = (now: number) => {
      ctx.clearRect(0, 0, c.width, c.height);
      drawPet(ctx, PETS[petIdx], 6, mood, now, now - start);
      raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [petIdx, mood]);
  return (
    <figure style={{ margin: 0, textAlign: "center" }}>
      <canvas ref={ref} width={144} height={144} style={{ background: "#14172a", imageRendering: "pixelated" }} />
      <figcaption style={{ fontSize: 12 }}>{mood}</figcaption>
    </figure>
  );
}

export default function PetLab() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 24 }}>
      {PETS.map((p, i) => (
        <section key={p.id}>
          <h2 style={{ fontSize: 16, margin: "0 0 8px" }}>{p.name}</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {MOODS.map((m) => (
              <Cell key={m} petIdx={i} mood={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
