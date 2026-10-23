import type { ItemId } from "./shared";

/** 每個道具的圖示主色/亮色（像素小圖示用） */
export const ITEM_COLORS: Record<ItemId, [string, string]> = {
  bomb: ["#8a8fff", "#ffd84a"],
  shield: ["#2fd8e8", "#d9fbff"],
  cleanse: ["#c79a5a", "#ffe0a8"],
  longbar: ["#2fd8e8", "#ffffff"],
  rain: ["#9aa0c0", "#5ff0ff"],
  ink: ["#3a3550", "#9a8fff"],
  speed: ["#ffd23f", "#ffffff"],
  mirror: ["#b04dff", "#ffffff"],
  freeze: ["#7fd8ff", "#ffffff"],
  steal: ["#ff3355", "#d9d9e8"],
};
