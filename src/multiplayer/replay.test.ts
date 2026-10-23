import { describe, expect, it } from "vitest";
import { COLS, Game, mulberry32, type Placement } from "../game/engine";

// 伺服器重播：客戶端只回報落點，伺服器用同一套引擎重算。
// 正常遊玩（含保留、旋轉、軟降、自然落地、垃圾行、炸彈、清垃圾、長條）必須每一步都對得上。

type Mut = { kind: "garbage"; lines: number; hole: number } | { kind: "bomb" | "cleanse" | "longbar" };

function applyClient(g: Game, m: Mut, seq: number) {
  if (m.kind === "garbage") g.addGarbage(m.lines, m.hole);
  else if (m.kind === "bomb") g.bomb(2);
  else if (m.kind === "cleanse") g.clearGarbage();
  else g.forceActive("I");
  g.mutSeq = seq;
}

function applyServer(g: Game, m: Mut) {
  if (m.kind === "garbage") g.addGarbage(m.lines, m.hole);
  else if (m.kind === "bomb") g.bomb(2);
  else if (m.kind === "cleanse") g.clearGarbage();
  else g.forceType("I");
}

function simulate(seed: number, steps: number) {
  const rnd = mulberry32(seed * 7919 + 1);
  const client = new Game(seed);
  const server = new Game(seed);
  const log: Mut[] = [];
  let applied = 0;
  let locks = 0;
  let clears = 0;
  for (let i = 0; i < steps && !client.over; i++) {
    const r = rnd();
    if (r < 0.2) client.move(rnd() < 0.5 ? -1 : 1);
    else if (r < 0.32) client.rotate(rnd() < 0.5 ? 1 : -1);
    else if (r < 0.35) client.rotate(2);
    else if (r < 0.4) client.softDrop();
    else if (r < 0.43) client.holdPiece();
    else if (r < 0.55) client.hardDrop();
    else if (r < 0.57) {
      // 伺服器送來的盤面變動（客戶端在兩次落地之間套用）
      const k = rnd();
      const m: Mut =
        k < 0.6
          ? { kind: "garbage", lines: 1 + Math.floor(rnd() * 3), hole: Math.floor(rnd() * COLS) }
          : k < 0.75
            ? { kind: "bomb" }
            : k < 0.9
              ? { kind: "cleanse" }
              : { kind: "longbar" };
      log.push(m);
      applyClient(client, m, log.length);
    } else client.tick(16 + rnd() * 120);

    for (const ev of client.drainEvents()) {
      if (ev.type !== "lock" || !ev.place) continue;
      const pl: Placement = ev.place;
      const res = server.replay(pl, (upTo) => {
        while (applied < upTo) applyServer(server, log[applied++]);
        return true;
      });
      expect(res, `seed ${seed} step ${i}: 伺服器拒絕了合法落點 ${JSON.stringify(pl)}`).not.toBeNull();
      locks++;
      if (res?.clear?.lines) clears++;
    }
    // 落地後雙方盤面必須一模一樣（只在剛落地時比，客戶端可能已先套用之後的變動）
    if (applied === log.length && client.pieces === server.pieces) {
      expect(server.boardCode()).toBe(client.boardCode());
      expect(server.lines).toBe(client.lines);
    }
  }
  return { locks, clears };
}

describe("伺服器重播", () => {
  it("隨機遊玩 300 局：每顆方塊伺服器都接受，盤面與消行數一致", () => {
    let locks = 0;
    let clears = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = simulate(seed, 3000);
      locks += r.locks;
      clears += r.clears;
    }
    expect(locks).toBeGreaterThan(3000);
    expect(clears).toBeGreaterThan(0);
  });

  it("懸空的落點會被拒絕", () => {
    const g = new Game(5);
    const a = g.active!;
    expect(g.replay({ type: a.type, rot: 0, x: 3, y: 2, spin: false, heldAt: -1, m: 0 })).toBeNull();
  });

  it("跟牆或方塊重疊的落點會被拒絕", () => {
    const g = new Game(5);
    const a = g.active!;
    expect(g.replay({ type: a.type, rot: 0, x: -3, y: 20, spin: false, heldAt: -1, m: 0 })).toBeNull();
  });

  it("方塊種類對不上會被拒絕（不能自己挑方塊）", () => {
    const g = new Game(5);
    const wrong = (["I", "O", "T", "S", "Z", "J", "L"] as const).find((t) => t !== g.active!.type && t !== g.queue[0])!;
    expect(g.replay({ type: wrong, rot: 0, x: 3, y: 19, spin: false, heldAt: -1, m: 0 })).toBeNull();
  });

  it("謊報四消沒用：伺服器盤面沒有滿行就不會消", () => {
    const client = new Game(9);
    const server = new Game(9);
    client.hardDrop();
    const ev = client.drainEvents().find((e) => e.type === "lock");
    const res = server.replay(ev!.type === "lock" ? ev!.place! : (null as never));
    expect(res?.clear ?? null).toBeNull();
  });
});
