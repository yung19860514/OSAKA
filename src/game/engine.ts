// 遊戲核心邏輯：純 TypeScript、不碰畫面，方便測試、未來搬到伺服器端驗分數

import { PIECE_TYPES, SHAPES, getKicks, type PieceType, type Rotation } from "./pieces";

export const COLS = 10;
export const VISIBLE_ROWS = 20;
export const HIDDEN_ROWS = 2; // 方塊在畫面上方的緩衝區生成
export const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
export const NEXT_COUNT = 5;

// 落地緩衝：碰到底或其他方塊後 0.5 秒固定（老闆 2026-10-03 指定）。
// 移動/旋轉不延長時間（MAX_LOCK_RESETS = 0），
// 只有方塊真的掉到更低的位置才重新計時（那是正常的繼續下落）。
const LOCK_DELAY_MS = 500;
const MAX_LOCK_RESETS = 0;
const MAX_GROUND_MS = 500;
const SOFT_DROP_MS = 33;

/** 格子內容：null 空格、方塊種類、"G" 垃圾行（給未來對戰用） */
export type Cell = PieceType | "G" | null;
export type Board = Cell[][];

export interface ActivePiece {
  type: PieceType;
  rot: Rotation;
  x: number;
  y: number;
}

export interface ClearEvent {
  lines: number;
  points: number;
  combo: number;
  b2b: boolean;
  tspin: boolean;
  perfect: boolean;
  /** 遞增序號，讓畫面知道有新事件 */
  id: number;
}

/**
 * 一顆方塊最後落在哪裡（對戰時回報給伺服器，伺服器用同一套引擎重播、自己算消行）。
 * m = 落下當時已套用的伺服器盤面變動數（垃圾行、炸彈等），讓伺服器按同樣順序重播。
 */
export interface Placement {
  type: PieceType;
  rot: Rotation;
  x: number;
  y: number;
  /** 最後一個動作是旋轉（T 轉判定用） */
  spin: boolean;
  /** 這顆方塊按保留的當下已套用的變動數；沒按保留為 -1（保留與道具的先後順序會影響結果） */
  heldAt: number;
  m: number;
}

/** 給畫面/音效用的事件，每幀由畫面取走 */
export type GameEvent =
  | { type: "move" }
  | { type: "rotate" }
  | { type: "hold" }
  | { type: "lock"; hard: boolean; place?: Placement }
  | { type: "clear"; rows: number[]; colors: Cell[][]; info: ClearEvent }
  | { type: "levelup"; level: number }
  | { type: "gameover" }
  | { type: "bomb"; rows: number[]; colors: Cell[][] }
  | { type: "revive" };

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(null));
}

/** 依等級回傳每下降一格的毫秒數（參考業界常用曲線） */
export function gravityMs(level: number): number {
  const l = Math.min(level, 20);
  return Math.max(1, Math.pow(0.8 - (l - 1) * 0.007, l - 1) * 1000);
}

const LINE_POINTS = [0, 100, 300, 500, 800];
const TSPIN_POINTS = [400, 800, 1200, 1600];

export class Game {
  board: Board = emptyBoard();
  active: ActivePiece | null = null;
  hold: PieceType | null = null;
  canHold = true;
  queue: PieceType[] = [];
  score = 0;
  lines = 0;
  level = 1;
  combo = -1;
  b2b = false;
  over = false;
  pieces = 0;
  lastClear: ClearEvent | null = null;
  /** 每次狀態變化 +1，畫面用來判斷要不要重畫 HUD */
  version = 0;
  events: GameEvent[] = [];
  readonly startLevel: number;

  private rng: () => number;
  private gravityAcc = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private groundTime = 0;
  /** 這顆方塊在目前最低位置是否已經碰過地（旋轉把它頂起來也算，計時不中斷） */
  private touched = false;
  /** 這顆方塊目前到過的最低位置（以實際最底下那一格計算，不是方塊原點——旋轉會讓原點上下跳） */
  private lowestY = 0;
  private lastActionRotate = false;
  private clearSeq = 0;
  softDropping = false;
  /** 對戰干擾：下落速度倍率（加速道具） */
  speedMul = 1;
  /** 對戰干擾：保留功能被冰凍 */
  holdLocked = false;
  /** 對戰：已套用的伺服器盤面變動數（垃圾行、炸彈、清垃圾、長條） */
  mutSeq = 0;
  /** 伺服器重播用：被長條道具換掉之前的方塊種類 */
  private forcedFrom: PieceType | null = null;
  /** 這顆方塊按保留時的 mutSeq（沒按為 -1） */
  private heldAt = -1;

  constructor(seed = Date.now(), startLevel = 1) {
    this.rng = mulberry32(seed);
    this.startLevel = startLevel;
    this.level = startLevel;
    this.fillQueue();
    this.spawn();
  }

  // ---------- 生成 ----------

  /** 7-bag：每 7 個方塊必定各出現一次，避免連續缺長條 */
  private fillQueue() {
    while (this.queue.length < NEXT_COUNT + 1) {
      const bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.queue.push(...bag);
    }
  }

  private spawnPiece(type: PieceType) {
    const piece: ActivePiece = { type, rot: 0, x: 3, y: 0 };
    this.active = piece;
    this.gravityAcc = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.groundTime = 0;
    this.lowestY = this.bottomOf(piece);
    this.touched = false;
    this.lastActionRotate = false;
    this.forcedFrom = null;
    if (this.collides(piece)) {
      this.over = true; // 生成位置被擋住 → 遊戲結束
      this.events.push({ type: "gameover" });
    } else {
      // 生成後若下方有空間，先往下一格，讓方塊一出來就看得到
      const down = { ...piece, y: piece.y + 1 };
      if (!this.collides(down)) this.active = down;
    }
    this.version++;
  }

  private spawn() {
    const next = this.queue.shift()!;
    this.fillQueue();
    this.spawnPiece(next);
  }

  // ---------- 碰撞 ----------

  cellsOf(p: ActivePiece): [number, number][] {
    return SHAPES[p.type][p.rot].map(([cx, cy]) => [p.x + cx, p.y + cy]);
  }

  /** 方塊最底下那一格的列號 */
  private bottomOf(p: ActivePiece): number {
    return Math.max(...SHAPES[p.type][p.rot].map(([, cy]) => p.y + cy));
  }

  collides(p: ActivePiece): boolean {
    for (const [x, y] of this.cellsOf(p)) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && this.board[y][x]) return true;
    }
    return false;
  }

  private onGround(): boolean {
    return !!this.active && this.collides({ ...this.active, y: this.active.y + 1 });
  }

  /** 方塊在地上時移動/旋轉會重置鎖定計時，但有次數上限避免無限拖延 */
  private afterMove() {
    if (!this.active) return;
    const bottom = this.bottomOf(this.active);
    if (bottom > this.lowestY) {
      this.lowestY = bottom;
      this.lockResets = 0;
      this.groundTime = 0;
      this.lockTimer = 0; // 掉到更低的位置 = 重新落地，計時從頭算
      this.touched = false;
    }
    if (this.onGround() && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
    this.version++;
  }

  // ---------- 玩家操作 ----------

  move(dx: number): boolean {
    if (this.over || !this.active) return false;
    const next = { ...this.active, x: this.active.x + dx };
    if (this.collides(next)) return false;
    this.active = next;
    this.lastActionRotate = false;
    this.afterMove();
    this.events.push({ type: "move" });
    return true;
  }

  rotate(dir: 1 | -1 | 2): boolean {
    if (this.over || !this.active) return false;
    const from = this.active.rot;
    const to = (((from + dir) % 4) + 4) % 4 as Rotation;
    // 180 度旋轉只試原地與上推一格
    const kicks: [number, number][] =
      dir === 2 ? [[0, 0], [0, -1]] : getKicks(this.active.type, from, to);
    for (const [kx, ky] of kicks) {
      const next = { ...this.active, rot: to, x: this.active.x + kx, y: this.active.y + ky };
      if (!this.collides(next)) {
        this.active = next;
        this.lastActionRotate = true;
        this.afterMove();
        this.events.push({ type: "rotate" });
        return true;
      }
    }
    return false;
  }

  /** 軟降一格（+1 分） */
  softDrop(): boolean {
    if (this.over || !this.active) return false;
    const next = { ...this.active, y: this.active.y + 1 };
    if (this.collides(next)) return false;
    this.active = next;
    this.score += 1;
    this.gravityAcc = 0;
    this.lastActionRotate = false;
    this.afterMove();
    return true;
  }

  /** 硬降：直接落到底並鎖定（每格 +2 分） */
  hardDrop() {
    if (this.over || !this.active) return;
    const dist = this.ghostY() - this.active.y;
    if (dist > 0) this.lastActionRotate = false;
    this.active = { ...this.active, y: this.active.y + dist };
    this.score += dist * 2;
    this.lock(true);
  }

  holdPiece(): boolean {
    if (this.over || !this.active || !this.canHold || this.holdLocked) return false;
    const cur = this.active.type;
    if (this.hold) {
      const h = this.hold;
      this.hold = cur;
      this.spawnPiece(h);
    } else {
      this.hold = cur;
      this.spawn();
    }
    this.canHold = false;
    this.heldAt = this.mutSeq;
    this.events.push({ type: "hold" });
    return true;
  }

  ghostY(): number {
    if (!this.active) return 0;
    let y = this.active.y;
    while (!this.collides({ ...this.active, y: y + 1 })) y++;
    return y;
  }

  // ---------- 時間推進 ----------

  /** 取走累積的事件 */
  drainEvents(): GameEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  /** 每幀呼叫，dt 為經過毫秒 */
  tick(dt: number) {
    if (this.over || !this.active) return;
    const base = gravityMs(this.level) / this.speedMul;
    const interval = this.softDropping ? Math.min(SOFT_DROP_MS, base) : base;

    if (this.onGround()) {
      this.touched = true;
      this.gravityAcc = 0;
      this.lockTimer += dt;
      this.groundTime += dt;
      if (this.lockTimer >= LOCK_DELAY_MS || this.groundTime >= MAX_GROUND_MS) this.lock();
      return;
    }

    // 已經碰過地、只是被旋轉頂起來：計時照算，時間到就直接落下固定
    if (this.touched) {
      this.groundTime += dt;
      if (this.groundTime >= MAX_GROUND_MS) {
        this.active = { ...this.active, y: this.ghostY() };
        this.lock();
        return;
      }
    }

    this.gravityAcc += dt;
    while (this.gravityAcc >= interval && this.active && !this.onGround()) {
      this.gravityAcc -= interval;
      this.active = { ...this.active, y: this.active.y + 1 };
      if (this.softDropping) this.score += 1;
      this.lastActionRotate = false;
      this.afterMove();
    }
  }

  // ---------- 鎖定與消行 ----------

  /** T-Spin 判定：最後動作是旋轉，且 T 中心四個角至少三格被擋 */
  private isTSpin(p: ActivePiece): boolean {
    if (p.type !== "T" || !this.lastActionRotate) return false;
    const corners = [[0, 0], [2, 0], [0, 2], [2, 2]];
    let filled = 0;
    for (const [cx, cy] of corners) {
      const x = p.x + cx;
      const y = p.y + cy;
      if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && this.board[y][x])) filled++;
    }
    return filled >= 3;
  }

  private lock(hard = false) {
    const p = this.active;
    if (!p) return;
    this.events.push({
      type: "lock",
      hard,
      place: { type: p.type, rot: p.rot, x: p.x, y: p.y, spin: this.lastActionRotate, heldAt: this.heldAt, m: this.mutSeq },
    });
    const tspin = this.isTSpin(p);
    let allHidden = true;
    for (const [x, y] of this.cellsOf(p)) {
      if (y >= 0) this.board[y][x] = p.type;
      if (y >= HIDDEN_ROWS) allHidden = false;
    }
    this.active = null;
    this.heldAt = -1;
    this.pieces++;

    const cleared = this.clearLines();
    this.applyScore(cleared, tspin);

    // 整顆方塊鎖在可視範圍以上 → 遊戲結束
    if (allHidden) {
      this.over = true;
      this.events.push({ type: "gameover" });
      this.version++;
      return;
    }
    this.canHold = true;
    this.spawn();
  }

  private pendingClear: { rows: number[]; colors: Cell[][] } | null = null;

  private clearLines(): number {
    const rows: number[] = [];
    const colors: Cell[][] = [];
    this.board.forEach((row, y) => {
      if (row.every((c) => c !== null)) {
        rows.push(y);
        colors.push([...row]);
      }
    });
    const kept = this.board.filter((row) => row.some((c) => c === null));
    while (kept.length < ROWS) kept.unshift(Array<Cell>(COLS).fill(null));
    this.board = kept;
    this.pendingClear = rows.length ? { rows, colors } : null;
    return rows.length;
  }

  private applyScore(cleared: number, tspin: boolean) {
    if (cleared === 0 && !tspin) {
      this.combo = -1;
      return;
    }
    let points = tspin ? TSPIN_POINTS[cleared] : LINE_POINTS[cleared];
    const difficult = cleared > 0 && (cleared === 4 || tspin);
    let b2b = false;
    if (cleared > 0) {
      if (difficult && this.b2b) {
        points = Math.floor(points * 1.5);
        b2b = true;
      }
      this.b2b = difficult;
      this.combo++;
    }
    points *= this.level;
    if (this.combo > 0) points += 50 * this.combo * this.level;
    const perfect = cleared > 0 && this.board.every((row) => row.every((c) => c === null));
    if (perfect) points += 3000 * this.level;

    this.score += points;
    this.lines += cleared;
    const prevLevel = this.level;
    this.level = Math.max(this.startLevel, Math.floor(this.lines / 10) + 1);
    this.lastClear = { lines: cleared, points, combo: this.combo, b2b, tspin, perfect, id: ++this.clearSeq };
    this.events.push({
      type: "clear",
      rows: this.pendingClear?.rows ?? [],
      colors: this.pendingClear?.colors ?? [],
      info: this.lastClear,
    });
    if (this.level > prevLevel) this.events.push({ type: "levelup", level: this.level });
  }

  // ---------- 道具（未來由儲值取得） ----------

  /** 續命：遊戲結束後清掉上方堆疊，只留最底下幾行，繼續遊戲 */
  revive(keepRows = 6) {
    if (!this.over) return false;
    const fresh = emptyBoard();
    for (let i = 0; i < keepRows; i++) fresh[ROWS - 1 - i] = this.board[ROWS - 1 - i];
    this.board = fresh;
    this.over = false;
    this.canHold = true;
    this.combo = -1;
    this.events.push({ type: "revive" });
    this.spawn();
    return true;
  }

  /** 炸彈：清除最底下 n 行（不計分） */
  bomb(rows = 2) {
    if (this.over) return false;
    const removed = this.board.splice(ROWS - rows, rows);
    this.events.push({
      type: "bomb",
      rows: removed.map((_, i) => ROWS - rows + i),
      colors: removed.map((r) => [...r]),
    });
    for (let i = 0; i < rows; i++) this.board.unshift(Array<Cell>(COLS).fill(null));
    this.version++;
    return true;
  }

  /** 清除盤面上所有垃圾行（清垃圾道具） */
  clearGarbage(): number {
    const kept = this.board.filter((row) => !row.includes("G"));
    const removed = ROWS - kept.length;
    while (kept.length < ROWS) kept.unshift(Array<Cell>(COLS).fill(null));
    this.board = kept;
    this.version++;
    return removed;
  }

  /** 把目前的方塊換成指定種類（長條道具） */
  forceActive(type: PieceType) {
    if (this.over || !this.active) return;
    const next: ActivePiece = { type, rot: 0, x: 3, y: this.active.y };
    for (const dy of [0, -1, -2, 1]) {
      const cand = { ...next, y: next.y + dy };
      if (!this.collides(cand)) {
        this.active = cand;
        this.lastActionRotate = false;
        this.version++;
        return;
      }
    }
  }

  // ---------- 伺服器重播（防作弊：消行由伺服器自己算） ----------

  /** 伺服器端的長條道具：直接把目前方塊換成指定種類（不找位置，落點由之後的回報決定） */
  forceType(type: PieceType) {
    if (this.over || !this.active) return;
    this.forcedFrom ??= this.active.type;
    this.active = { ...this.active, type, rot: 0 };
  }

  /**
   * 照客戶端回報的落點放下目前這顆方塊。
   * catchUp(n)：把伺服器送出的第 1~n 個盤面變動套進來（保留前後各補一次，順序才會跟玩家一樣）。
   * 檢查：種類對得上（含保留）、位置沒有重疊、確實落在地上。
   * 不合法回傳 null；合法回傳這次的消行結果（沒消行為 null）。
   */
  replay(pl: Placement, catchUp: (upTo: number) => boolean = () => true): { clear: ClearEvent | null } | null {
    if (!pl || typeof pl !== "object") return null;
    const heldAt = pl.heldAt;
    if (!Number.isInteger(heldAt) || heldAt > pl.m) return null;
    if (heldAt >= 0) {
      if (!catchUp(heldAt) || this.over || !this.active || !this.holdPiece()) return null;
    }
    if (!catchUp(pl.m) || this.over || !this.active) return null;
    const { type, rot, x, y } = pl;
    if (!PIECE_TYPES.includes(type) || ![0, 1, 2, 3].includes(rot) || !Number.isInteger(x) || !Number.isInteger(y)) return null;
    if (Math.abs(x) > 20 || y < -4 || y > ROWS) return null;
    if (this.active.type !== type) {
      // 客戶端的長條道具沒換成功（找不到位置）→ 仍是原本的方塊
      if (this.forcedFrom !== type) return null;
    }
    const piece: ActivePiece = { type, rot: rot as Rotation, x, y };
    if (this.collides(piece) || !this.collides({ ...piece, y: y + 1 })) return null;
    this.active = piece;
    this.lastActionRotate = pl.spin === true;
    const seq = this.clearSeq;
    this.lock(true);
    this.events = [];
    return { clear: this.clearSeq !== seq ? this.lastClear : null };
  }

  /** 盤面上的格子數（時間到時比盤面高低用） */
  filledCells(): number {
    let n = 0;
    for (const row of this.board) for (const c of row) if (c) n++;
    return n;
  }

  /** 盤面壓縮成 200 字元（可視 20 列；給對手看的小盤面） */
  boardCode(): string {
    let out = "";
    for (let y = HIDDEN_ROWS; y < ROWS; y++) for (const c of this.board[y]) out += c ?? ".";
    return out;
  }

  /**
   * 加入垃圾行（多人對戰）。缺口位置用 Math.random，
   * 不能用 this.rng——否則會打亂方塊順序，讓同房玩家拿到的方塊不同。
   */
  addGarbage(count: number, hole = Math.floor(Math.random() * COLS)) {
    for (let i = 0; i < count; i++) {
      // 被垃圾頂出最上方的那一列如果有方塊 → 爆頂，判輸
      const top = this.board.shift();
      if (top?.some((c) => c !== null) && !this.over) {
        this.over = true;
        this.events.push({ type: "gameover" });
      }
      const row = Array<Cell>(COLS).fill("G");
      row[hole] = null;
      this.board.push(row);
    }
    if (this.active && this.collides(this.active)) {
      this.active = { ...this.active, y: this.active.y - count };
      if (this.collides(this.active)) {
        this.over = true;
        this.events.push({ type: "gameover" });
      }
    }
    this.version++;
  }
}
