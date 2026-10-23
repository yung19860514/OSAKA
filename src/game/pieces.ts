// 方塊定義 + SRS 旋轉踢牆表（座標系：x 向右、y 向下）

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_TYPES: PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** 旋轉狀態 0=生成 1=右 2=倒 3=左 */
export type Rotation = 0 | 1 | 2 | 3;

const BASE: Record<PieceType, string[]> = {
  I: ["....", "XXXX", "....", "...."],
  O: [".XX.", ".XX.", "....", "...."],
  T: [".X.", "XXX", "..."],
  S: [".XX", "XX.", "..."],
  Z: ["XX.", ".XX", "..."],
  J: ["X..", "XXX", "..."],
  L: ["..X", "XXX", "..."],
};

type Cells = [number, number][]; // [x, y]

function parse(rows: string[]): boolean[][] {
  return rows.map((r) => [...r].map((ch) => ch === "X"));
}

function rotateCW(m: boolean[][]): boolean[][] {
  const n = m.length;
  return m.map((_, r) => m.map((__, c) => m[n - 1 - c][r]));
}

function toCells(m: boolean[][]): Cells {
  const out: Cells = [];
  m.forEach((row, y) => row.forEach((v, x) => v && out.push([x, y])));
  return out;
}

/** SHAPES[type][rot] = 該旋轉狀態下的格子座標（相對於方塊左上角） */
export const SHAPES: Record<PieceType, Cells[]> = (() => {
  const res = {} as Record<PieceType, Cells[]>;
  for (const t of PIECE_TYPES) {
    const states: Cells[] = [];
    let m = parse(BASE[t]);
    for (let i = 0; i < 4; i++) {
      // O 不旋轉
      states.push(toCells(t === "O" ? parse(BASE.O) : m));
      m = rotateCW(m);
    }
    res[t] = states;
  }
  return res;
})();

// SRS 踢牆表（原始規格 y 向上，這裡已轉成 y 向下）
type Kick = [number, number][];
const flipY = (k: Kick): Kick => k.map(([x, y]) => [x, -y]);

const JLSTZ_KICKS: Record<string, Kick> = {
  "0>1": flipY([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  "1>0": flipY([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
  "1>2": flipY([[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]),
  "2>1": flipY([[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]]),
  "2>3": flipY([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
  "3>2": flipY([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  "3>0": flipY([[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]]),
  "0>3": flipY([[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]),
};

const I_KICKS: Record<string, Kick> = {
  "0>1": flipY([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
  "1>0": flipY([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
  "1>2": flipY([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
  "2>1": flipY([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
  "2>3": flipY([[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]]),
  "3>2": flipY([[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]]),
  "3>0": flipY([[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]]),
  "0>3": flipY([[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]),
};

export function getKicks(type: PieceType, from: Rotation, to: Rotation): Kick {
  if (type === "O") return [[0, 0]];
  const table = type === "I" ? I_KICKS : JLSTZ_KICKS;
  return table[`${from}>${to}`];
}
