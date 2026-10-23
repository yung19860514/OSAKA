import { Press_Start_2P } from "next/font/google";
import localFont from "next/font/local";

// 方塊消消專用字體：英數用 Press Start 2P；中文用 Cubic 11 點陣體（免費可商用）
export const pixelLatin = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel-latin",
});

export const pixelCJK = localFont({
  src: "../../../public/fonts/Cubic_11.woff2",
  variable: "--font-pixel-cjk",
  display: "swap",
});

/** 方塊消消的外框：套上字體與畫風（樣式只在這裡面生效） */
export const bbClass = `bb ${pixelLatin.variable} ${pixelCJK.variable}`;
