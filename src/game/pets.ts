// 像素動物吉祥物。每隻動物 = 一張 24×24 點陣圖（不含眼睛和嘴巴）+ 調色盤。
// 眼睛、嘴巴、汗滴、眼淚等表情由程式依心情疊上去，所以同一套表情系統可以套用到每一隻動物。
// 之後要賣新角色：照格式新增一隻動物即可。

import type { Mood } from "./mascot";

export interface Pet {
  id: string;
  name: string;
  /** 字元 → 顏色；"." 透明 */
  palette: Record<string, string>;
  rows: string[];
  /** 左眼左上角（右眼對稱）；眼睛 2×3 格 */
  eye: { x: number; y: number; gap: number };
  /** 嘴巴中心點 */
  mouth: { x: number; y: number };
  /** 腮紅位置（左邊那顆；右邊對稱） */
  blush: { x: number; y: number };
  price: number;
}

const SIZE = 24;

// 調色盤字母：k 外框、o 主色、d 陰影、l 亮面、w 白毛/肚子、p 粉紅，其餘為各動物特有色
// （點陣圖由共用身體底版 + 各動物的耳朵/花紋/尾巴疊加而成，確保整個系列風格一致）
export const PETS: Pet[] = [
  {
    id: "cat",
    name: "橘貓",
    price: 0,
    palette: { k: "#2b1a12", o: "#f2933a", d: "#c3611f", l: "#ffc77a", w: "#fff3e3", p: "#ff8fa3" },
    rows: [
    "........................",
    "........................",
    "...kk..............kk...",
    "...kok............kok...",
    "...kopk..........kpok...",
    "..koppokkkkkkkkkkoppok..",
    "..kllooooooooooooooodk..",
    "..kloooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooowppwoooooodk..",
    "..koooooowwwwwwooooodk..",
    "..koooooowwwwwwooooodk..",
    "..kddooowwwwwwwwoooddk..",
    "...kddddddddddddddddk...",
    "....kkkoowwwwwwookkk.kk.",
    "......koowwwwwwook..kok.",
    "......kowwwwwwwwok.kok..",
    "......kowwwwwwwwokkok...",
    "......kooookkooookkk....",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
    ],
    eye: { x: 6, y: 8, gap: 10 },
    mouth: { x: 11, y: 12 },
    blush: { x: 4, y: 11 },
  },
  {
    id: "dog",
    name: "小柴",
    price: 300,
    palette: { k: "#2b1a12", o: "#d9924a", d: "#a8642a", l: "#f2bd7a", w: "#fff3e3", p: "#ff8fa3", E: "#7a4a26" },
    rows: [
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    ".kkkkkkkkkkkkkkkkkkkkkk.",
    "kEEkloooooooooooooookEEk",
    "kEEkooooooooooooooookEEk",
    "kEEkooooooooooooooookEEk",
    "kEEkooooooooooooooookEEk",
    ".kEkooooooooooooooookEk.",
    "..kkoooooowkkwooooookk..",
    "..koooooowwwwwwooooodk..",
    "..koooooowwwwwwooooodk..",
    "..kddooowwwwwwwwoooddk..",
    "...kddddddddddddddddk...",
    "....kkkoowwwwwwookkkk...",
    "......koowwwwwwookkok...",
    "......kowwwwwwwwokkk....",
    "......kowwwwwwwwok......",
    "......kooookkooook......",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
    ],
    eye: { x: 6, y: 8, gap: 10 },
    mouth: { x: 11, y: 12 },
    blush: { x: 4, y: 12 },
  },
  {
    id: "bunny",
    name: "雪兔",
    price: 300,
    palette: { k: "#3a2a3a", o: "#f4eff6", d: "#cbbfd9", l: "#ffffff", w: "#ffe6ee", p: "#ff8fa3" },
    rows: [
    ".....kk..........kk.....",
    "....kook........kook....",
    "....kopk........kpok....",
    "....kopk........kpok....",
    "....kopk........kpok....",
    "...kkopkkkkkkkkkkpokk...",
    "..kllooooooooooooooodk..",
    "..kloooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooowppwoooooodk..",
    "..koooooowwwwwwooooodk..",
    "..koooooowwwwwwooooodk..",
    "..kddooowwwwwwwwoooddk..",
    "...kddddddddddddddddk...",
    "....kkkoowwwwwwookkk....",
    "......koowwwwwwookkkk...",
    "......kowwwwwwwwokwwwk..",
    "......kowwwwwwwwokkkk...",
    "......kooookkooook......",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
    ],
    eye: { x: 6, y: 8, gap: 10 },
    mouth: { x: 11, y: 12 },
    blush: { x: 4, y: 11 },
  },
  {
    id: "frog",
    name: "呱呱",
    price: 300,
    palette: { k: "#173d1c", o: "#5fcf5a", d: "#339a3a", l: "#a8ef8c", w: "#dff7b8", p: "#ff9db0" },
    rows: [
    "........................",
    "........................",
    "........................",
    "....kkkk........kkkk....",
    "...kooook......kooook...",
    "..kooooookkkkkkooooook..",
    "..kllooooooooooooooodk..",
    "..kloooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooowwwwoooooodk..",
    "..koooooowwwwwwooooodk..",
    "..koooooowwwwwwooooodk..",
    "..kddooowwwwwwwwoooddk..",
    "...kddddddddddddddddk...",
    "....kkkoowwwwwwookkk....",
    "......koowwwwwwook......",
    "......kowwwwwwwwok......",
    "......kowwwwwwwwok......",
    "......kooookkooook......",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
    ],
    eye: { x: 5, y: 4, gap: 12 },
    mouth: { x: 11, y: 11 },
    blush: { x: 4, y: 10 },
  },
  {
    id: "panda",
    name: "團團",
    price: 300,
    palette: { k: "#18181e", o: "#f6f6f0", d: "#d2d2c8", l: "#ffffff", w: "#ffffff", p: "#ff9db0", b: "#3c3c46" },
    rows: [
    "........................",
    "........................",
    "........................",
    "...kkk............kkk...",
    "..kbbbk..........kbbbk..",
    "..kbbbkkkkkkkkkkkkbbbk..",
    "..kllooooooooooooooodk..",
    "..klobbbboooooobbbbodk..",
    "..koobbbboooooobbbbodk..",
    "..koobbbboooooobbbbodk..",
    "..koobbbboooooobbbbodk..",
    "..kooobboowkkwoobboodk..",
    "..koooooowwwwwwooooodk..",
    "..koooooowwwwwwooooodk..",
    "..kddooowwwwwwwwoooddk..",
    "...kddddddddddddddddk...",
    "....kkkbbwwwwwwbbkkk....",
    "......kbbwwwwwwbbk......",
    "......kbwwwwwwwwbk......",
    "......kbwwwwwwwwbk......",
    "......kbbbbkkbbbbk......",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
    ],
    eye: { x: 6, y: 8, gap: 10 },
    mouth: { x: 11, y: 12 },
    blush: { x: 3, y: 12 },
  },
  {
    id: "penguin",
    name: "企企",
    price: 300,
    palette: { k: "#101830", o: "#2f4a7a", d: "#1f3256", l: "#4c6ca8", w: "#ffffff", p: "#ff9db0", y: "#ffb02e", Y: "#e07b12" },
    rows: [
    "........................",
    "........................",
    "........................",
    "........................",
    "........................",
    "...kkkkkkkkkkkkkkkkkk...",
    "..kllooooooooooooooodk..",
    "..kloowwwwwwwwwwwwoodk..",
    "..koowwwwwwwwwwwwwwodk..",
    "..koowwwwwwwwwwwwwwodk..",
    "..koowwwwwwwwwwwwwwodk..",
    "..koowwwwwwyywwwwwwodk..",
    "..koowwwwwwYYwwwwwwodk..",
    "..koowwwwwwwwwwwwwwodk..",
    "..kddowwwwwwwwwwwwoddk..",
    "...kddddddddddddddddk...",
    "....kkkoowwwwwwookkk....",
    ".....kdoowwwwwwoodk.....",
    ".....kdowwwwwwwwodk.....",
    "......kowwwwwwwwok......",
    "......kyyyykkyyyyk......",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
    ],
    eye: { x: 6, y: 8, gap: 10 },
    mouth: { x: 11, y: 12 },
    blush: { x: 5, y: 11 },
  },
  {
    id: "fox",
    name: "小狐",
    price: 300,
    palette: { k: "#2a140a", o: "#ff7f2a", d: "#cf5414", l: "#ffb067", w: "#fff6ea", p: "#ff9db0" },
    rows: [
    "........................",
    "..kk................kk..",
    "..kok..............kok..",
    "..kook............kook..",
    "..kopok..........kopok..",
    "..koppokkkkkkkkkkoppok..",
    "..kllooooooooooooooodk..",
    "..kloooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooooooooooooodk..",
    "..kooooooowkkwoooooodk..",
    "..kwwwwoowwwwwwoowwwwk..",
    "..kwwwwwowwwwwwowwwwwkkk",
    "..kdwwwwwwwwwwwwwwwwkwwk",
    "...kddddddddddddddddkowk",
    "....kkkoowwwwwwookkkoook",
    "......koowwwwwwookkoook.",
    "......kowwwwwwwwokkook..",
    "......kowwwwwwwwokkkk...",
    "......kooookkooook......",
    "......kkkkkkkkkkkk......",
    "........................",
    "........................",
    ],
    eye: { x: 6, y: 8, gap: 10 },
    mouth: { x: 11, y: 12 },
    blush: { x: 4, y: 10 },
  },
];

export const CAT = PETS[0];

export function getPet(id: string | null | undefined): Pet {
  return PETS.find((p) => p.id === id) ?? CAT;
}

/**
 * 畫一隻動物。px = 每格像素；t = 現在時間；moodT = 進入此心情後經過的毫秒
 */
export function drawPet(
  ctx: CanvasRenderingContext2D,
  pet: Pet,
  px: number,
  mood: Mood,
  t: number,
  moodT: number,
) {
  let ox = 0;
  let oy = 0;
  switch (mood) {
    case "idle":
      oy = Math.floor(t / 600) % 2;
      break;
    case "happy": {
      const k = (moodT % 520) / 520;
      oy = -Math.round(Math.sin(k * Math.PI) * 3);
      break;
    }
    case "excited":
    case "cheer": {
      const k = (moodT % 400) / 400;
      oy = -Math.round(Math.sin(k * Math.PI) * 4);
      ox = Math.round(Math.sin(moodT / 100));
      break;
    }
    case "worried":
      ox = Math.floor(t / 80) % 2 === 0 ? 0 : 1;
      break;
    case "sad":
      oy = 1;
      break;
  }

  const gray = mood === "sad";
  const color = (c: string) => {
    const hex = pet.palette[c];
    if (!gray || !hex) return hex;
    // 難過時整隻褪成灰階
    const n = parseInt(hex.slice(1), 16);
    const v = Math.round(((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) * 0.85);
    return `rgb(${v},${v},${Math.min(255, v + 12)})`;
  };
  const P = (x: number, y: number, c: string, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect((x + ox) * px, (y + oy) * px, w * px, h * px);
  };

  pet.rows.forEach((row, y) => {
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch && ch !== ".") P(x, y, color(ch));
    }
  });

  const ink = color("k");
  const { x: ex, y: ey, gap } = pet.eye;
  const eyes = (fn: (x: number) => void) => {
    fn(ex);
    fn(ex + gap);
  };
  const blinking = mood === "idle" && t % 3400 < 150;

  // 眼睛
  if (mood === "happy" || mood === "cheer") {
    eyes((x) => {
      P(x, ey + 1, ink);
      P(x + 1, ey, ink);
      P(x + 2, ey + 1, ink);
    });
  } else if (mood === "sad") {
    eyes((x) => {
      P(x, ey + 1, ink, 3, 1);
    });
  } else if (blinking) {
    eyes((x) => P(x, ey + 2, ink, 2, 1));
  } else if (mood === "excited") {
    // 閃亮大眼：3×3 黑眼珠 + 左上大反光 + 右下小反光
    eyes((x) => {
      P(x, ey - 1, ink, 3, 4);
      P(x, ey - 1, "#ffffff", 2, 1);
      P(x, ey, "#ffffff");
      P(x + 2, ey + 2, "#ffffff");
    });
  } else {
    eyes((x) => {
      P(x, ey, ink, 2, 3);
      P(x, ey, "#ffffff");
    });
    if (mood === "worried") {
      // 皺眉
      P(ex, ey - 2, ink, 2, 1);
      P(ex + 1, ey - 1, ink);
      P(ex + gap, ey - 2, ink, 2, 1);
      P(ex + gap, ey - 1, ink);
    }
  }

  // 腮紅
  if (mood !== "sad" && mood !== "worried") {
    P(pet.blush.x, pet.blush.y, color("p"), 2, 1);
    P(SIZE - pet.blush.x - 2, pet.blush.y, color("p"), 2, 1);
  }

  // 嘴巴
  const { x: mx, y: my } = pet.mouth;
  if (mood === "excited" || mood === "cheer" || mood === "happy") {
    P(mx - 1, my, ink, 4, 1);
    P(mx - 1, my + 1, ink);
    P(mx + 2, my + 1, ink);
    P(mx, my + 1, "#d8344f", 2, 1);
    P(mx, my + 2, ink, 2, 1);
  } else if (mood === "sad" || mood === "worried") {
    // ∩ 嘴角往下
    P(mx, my + 1, ink, 2, 1);
    P(mx - 1, my + 2, ink);
    P(mx + 2, my + 2, ink);
  } else {
    // 小小的 u 微笑
    P(mx - 1, my + 1, ink);
    P(mx + 2, my + 1, ink);
    P(mx, my + 2, ink, 2, 1);
  }

  // 附加效果（不跟身體一起晃）
  ox = 0;
  oy = 0;
  if (mood === "worried") {
    const d = Math.floor(t / 140) % 4;
    P(21, 4 + d, "#8fe3ff");
    P(21, 5 + d, "#d9f6ff");
    P(20, 5 + d, "#8fe3ff");
  }
  if (mood === "sad") {
    const d = Math.floor(moodT / 220) % 4;
    P(ex, ey + 2 + d, "#8fe3ff");
    P(ex + gap + 1, ey + 2 + ((d + 2) % 4), "#8fe3ff");
  }
  if (mood === "excited" || mood === "cheer") {
    const spots: [number, number][] = [
      [1, 2],
      [22, 3],
      [0, 14],
      [23, 13],
    ];
    spots.forEach(([x, y], i) => {
      if (Math.floor((moodT + i * 130) / 170) % 2 === 0) {
        const c = mood === "cheer" ? "#ff7ad9" : "#ffd23f";
        P(x, y, c);
        if (x > 0) P(x - 1, y, c);
        P(x, y - 1, c);
        P(x, y + 1, c);
      }
    });
  }
}
