// 方塊造型（未來儲值商品）。「街機」為預設免費款，其餘為不同畫風。

import type { PieceType } from "./pieces";

export type SkinStyle = "bevel" | "gem" | "flat" | "neon";

export interface Skin {
  id: string;
  name: string;
  style: SkinStyle;
  /** 0 = 免費；>0 = 未來用遊戲幣購買 */
  price: number;
  colors: Record<PieceType | "G", string>;
  boardBg: string;
  gridLine: string;
}

export const SKINS: Skin[] = [
  {
    id: "arcade",
    name: "街機",
    style: "bevel",
    price: 0,
    colors: {
      I: "#2fd8e8",
      O: "#ffd23f",
      T: "#b04dff",
      S: "#3ee05a",
      Z: "#ff3355",
      J: "#2f6bff",
      L: "#ff8a1f",
      G: "#6b6f80",
    },
    boardBg: "#05060c",
    gridLine: "rgba(255,255,255,0.07)",
  },
  {
    id: "aurora",
    name: "極光",
    style: "gem",
    price: 0,
    colors: {
      I: "#3dd6d0",
      O: "#f7c948",
      T: "#b47cff",
      S: "#5fd068",
      Z: "#ff5d73",
      J: "#4b8bff",
      L: "#ff9f43",
      G: "#5b6478",
    },
    boardBg: "#0d1220",
    gridLine: "rgba(255,255,255,0.05)",
  },
  {
    id: "mono",
    name: "墨石",
    style: "bevel",
    price: 0,
    colors: {
      I: "#e8e6df",
      O: "#c9c5ba",
      T: "#a9a49a",
      S: "#d6d2c8",
      Z: "#8f8a80",
      J: "#bdb8ad",
      L: "#77726a",
      G: "#4a4741",
    },
    boardBg: "#161513",
    gridLine: "rgba(255,255,255,0.04)",
  },
  {
    id: "neon",
    name: "霓虹夜",
    style: "neon",
    price: 300,
    colors: {
      I: "#00f0ff",
      O: "#fff200",
      T: "#ff00e5",
      S: "#39ff14",
      Z: "#ff2e4d",
      J: "#2e6bff",
      L: "#ff8a00",
      G: "#3a3f55",
    },
    boardBg: "#05040d",
    gridLine: "rgba(120,80,255,0.10)",
  },
  {
    id: "candy",
    name: "糖果屋",
    style: "gem",
    price: 300,
    colors: {
      I: "#7fd8ff",
      O: "#ffe17a",
      T: "#d7a6ff",
      S: "#9ef0b0",
      Z: "#ff9eb5",
      J: "#a3b8ff",
      L: "#ffc49e",
      G: "#c8b8c8",
    },
    boardBg: "#2a1d33",
    gridLine: "rgba(255,255,255,0.06)",
  },
];

export const DEFAULT_SKIN = SKINS[0];

export function getSkin(id: string | null | undefined): Skin {
  return SKINS.find((s) => s.id === id) ?? DEFAULT_SKIN;
}
