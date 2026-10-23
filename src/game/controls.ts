// 操作與預設按鍵。玩家可自訂（一個操作可綁多個鍵），設定存在 PlayerData.keys。

export type Action = "left" | "right" | "soft" | "hard" | "cw" | "ccw" | "r180" | "hold" | "bomb" | "item" | "pause";

/** 設定畫面列出的操作（顯示文字在 i18n 的 action.* ） */
export const ACTIONS: { id: Action }[] = [
  { id: "left" },
  { id: "right" },
  { id: "soft" },
  { id: "hard" },
  { id: "cw" },
  { id: "ccw" },
  { id: "r180" },
  { id: "hold" },
  { id: "bomb" },
  { id: "item" },
  { id: "pause" },
];

export type KeyBindings = Record<Action, string[]>;

export const DEFAULT_KEYS: KeyBindings = {
  left: ["ArrowLeft"],
  right: ["ArrowRight"],
  soft: ["ArrowDown"],
  hard: [" "],
  cw: ["ArrowUp", "x"],
  ccw: ["z", "Control"],
  r180: ["a"],
  hold: ["c", "Shift"],
  bomb: ["b"],
  item: ["v"],
  pause: ["p", "Escape"],
};

/** 字母不分大小寫 */
export function normKey(key: string): string {
  return key.length === 1 ? key.toLowerCase() : key;
}

export function buildKeyMap(keys: KeyBindings): Record<string, Action> {
  const map: Record<string, Action> = {};
  for (const a of Object.keys(keys) as Action[]) for (const k of keys[a]) map[normKey(k)] = a;
  return map;
}

const NAMES: Record<string, string> = {
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Control: "Ctrl",
  Shift: "Shift",
  Escape: "Esc",
  Enter: "Enter",
  Tab: "Tab",
  Alt: "Alt",
};

/** spaceLabel：空白鍵的在地化名稱 */
export function keyLabel(key: string, spaceLabel = "Space"): string {
  if (key === " ") return spaceLabel;
  return NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);
}
