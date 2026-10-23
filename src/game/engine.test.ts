import { describe, expect, it } from "vitest";
import { COLS, Game, ROWS, emptyBoard } from "./engine";
import { PIECE_TYPES } from "./pieces";

describe("Game", () => {
  it("7-bag：前 7 個方塊各出現一次", () => {
    const g = new Game(42);
    const first7 = [g.active!.type, ...g.queue.slice(0, 6)];
    expect(new Set(first7).size).toBe(7);
    expect([...first7].sort()).toEqual([...PIECE_TYPES].sort());
  });

  it("硬降會鎖定並生成下一顆，且加分", () => {
    const g = new Game(1);
    const next = g.queue[0];
    g.hardDrop();
    expect(g.active!.type).toBe(next);
    expect(g.score).toBeGreaterThan(0);
    expect(g.board.flat().filter(Boolean).length).toBe(4);
  });

  it("填滿一行會被消除並計分", () => {
    const g = new Game(7);
    g.board = emptyBoard();
    for (let x = 0; x < COLS; x++) if (x < 3 || x > 6) g.board[ROWS - 1][x] = "G";
    // 換成橫放 I 塞進中間 4 格空位
    g.active = { type: "I", rot: 0, x: 3, y: 0 };
    g.hardDrop();
    expect(g.lines).toBe(1);
    expect(g.board[ROWS - 1].every((c) => c === null)).toBe(true);
    expect(g.lastClear?.perfect).toBe(true);
  });

  it("不能移出牆外", () => {
    const g = new Game(3);
    for (let i = 0; i < 20; i++) g.move(-1);
    const xs = g.cellsOf(g.active!).map(([x]) => x);
    expect(Math.min(...xs)).toBe(0);
  });

  it("貼牆旋轉會踢牆而不是卡住", () => {
    const g = new Game(5);
    g.active = { type: "I", rot: 1, x: -2, y: 5 }; // 直立 I 貼左牆
    expect(g.collides(g.active)).toBe(false);
    expect(g.rotate(1)).toBe(true);
    const xs = g.cellsOf(g.active!).map(([x]) => x);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  });

  it("保留：每顆方塊只能保留一次", () => {
    const g = new Game(9);
    const first = g.active!.type;
    expect(g.holdPiece()).toBe(true);
    expect(g.hold).toBe(first);
    expect(g.holdPiece()).toBe(false);
  });

  it("堆到頂會結束，續命後可以繼續", () => {
    const g = new Game(11);
    let guard = 0;
    while (!g.over && guard++ < 500) g.hardDrop();
    expect(g.over).toBe(true);
    expect(g.revive()).toBe(true);
    expect(g.over).toBe(false);
    expect(g.active).not.toBeNull();
  });

  it("重力會讓方塊隨時間下降，著地後鎖定", () => {
    const g = new Game(13);
    const y0 = g.active!.y;
    g.tick(1001);
    expect(g.active!.y).toBe(y0 + 1);
    for (let i = 0; i < 300; i++) g.tick(100); // 等級 1 每格 1 秒，30 秒足夠落地鎖定
    expect(g.pieces).toBeGreaterThan(0);
  });

  it("落地後一直左右移動，0.5 秒內就會固定（移動不能延長時間）", () => {
    const g = new Game(17);
    // 先落到底但不鎖
    while (g.softDrop());
    const before = g.pieces;
    let elapsed = 0;
    let dir = 1;
    while (g.pieces === before && elapsed < 5000) {
      if (!g.move(dir)) dir = -dir;
      g.tick(50);
      elapsed += 50;
    }
    expect(g.pieces).toBe(before + 1);
    expect(elapsed).toBeLessThanOrEqual(550);
  });

  it("對戰：收到垃圾行不會打亂方塊順序（同房玩家方塊一致）", () => {
    const a = new Game(99);
    const b = new Game(99);
    const seqA: string[] = [];
    const seqB: string[] = [];
    for (let i = 0; i < 20; i++) {
      seqA.push(a.active!.type);
      seqB.push(b.active!.type);
      if (i % 3 === 0) b.addGarbage(1);
      a.hardDrop();
      b.hardDrop();
      if (a.over || b.over) break;
    }
    expect(seqB).toEqual(seqA.slice(0, seqB.length));
  });

  it("清垃圾道具：移除所有垃圾行", () => {
    const g = new Game(4);
    g.addGarbage(3);
    expect(g.board.filter((r) => r.includes("G")).length).toBe(3);
    expect(g.clearGarbage()).toBe(3);
    expect(g.board.some((r) => r.includes("G"))).toBe(false);
  });

  it("長條道具：目前方塊換成 I", () => {
    const g = new Game(6);
    g.forceActive("I");
    expect(g.active!.type).toBe("I");
  });

  it("冰凍道具：保留功能鎖住", () => {
    const g = new Game(8);
    g.holdLocked = true;
    expect(g.holdPiece()).toBe(false);
  });

  it("盤面壓縮成 200 字元", () => {
    const g = new Game(2);
    g.addGarbage(1, 0);
    const code = g.boardCode();
    expect(code.length).toBe(200);
    expect(code.slice(190)).toBe(".GGGGGGGGG");
  });

  it("對戰：垃圾行把頂端的方塊擠出盤面 → 判輸", () => {
    const g = new Game(12);
    g.board[0][0] = "T"; // 最上方（隱藏列）已經有方塊
    g.addGarbage(1);
    expect(g.over).toBe(true);
  });

  it("落地後一直旋轉（加左右移動），0.5 秒內也會固定（旋轉不能拖時間）", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7]) {
      const g = new Game(seed);
      while (g.softDrop());
      const before = g.pieces;
      let elapsed = 0;
      let i = 0;
      while (g.pieces === before && elapsed < 5000) {
        g.rotate(i % 2 ? 1 : -1);
        g.move(i % 4 < 2 ? 1 : -1);
        i++;
        g.tick(40);
        elapsed += 40;
      }
      expect(g.pieces).toBe(before + 1);
      expect(elapsed).toBeLessThanOrEqual(550);
    }
  });
});
