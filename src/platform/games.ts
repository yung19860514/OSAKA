// 平台遊戲登錄表：平台旗下所有遊戲都在這裡登記。
// 新增一款遊戲 = 在 GAMES 加一筆 + 建立 app/play/<id>/ 頁面 + 在 config/prices.ts 加上它的商品。
// 各國代理簽的是「平台合約」→ 新遊戲上架後，自動在所有已開放的地區開賣（除非該地區把它排除）。

import type { Region } from "@/config/regions";

/** 台灣遊戲軟體分級（遊戲軟體分級管理辦法） */
export type Rating = "general" | "protected" | "guidance12" | "guidance15" | "restricted";

export interface GameInfo {
  /** 遊戲代號：網址、商品編號前綴、遊戲帳號都用它 */
  id: string;
  /** 遊戲頁面網址 */
  path: string;
  status: "live" | "soon";
  /** 遊玩人數，例："1–4" */
  players: string;
  rating: Rating;
  /** 是否含付費購買內容（分級標示要註明） */
  paid: boolean;
  /** 卡片主色 */
  accent: string;
}

export const GAMES: GameInfo[] = [
  { id: "blockblitz", path: "/play/blockblitz", status: "live", players: "1–4", rating: "general", paid: true, accent: "#ffd23f" },
  // 魔晶要塞：合作遊戲（遊戲方交付的 HTML5 原型，2026-10-07）。本機放在 public/play/mjys/；網址結尾要有 /
  // ⏳ 分級待遊戲方提供（暫標保護級：卡通戰鬥）
  { id: "mjys", path: "/play/mjys/", status: "live", players: "1", rating: "protected", paid: true, accent: "#b05cff" },
  // 仙途問道：合作遊戲（遊戲方交付的 HTML5 原型 v0.9，2026-10-07）。本機放在 public/play/xiantu/
  // ⏳ 分級待遊戲方提供（暫標保護級：仙俠戰鬥）
  { id: "xiantu", path: "/play/xiantu/", status: "live", players: "1", rating: "protected", paid: true, accent: "#c9a46b" },
  // 天下三分：總公司的三國放置卡牌（網頁＋PWA）。遊戲在遊戲方伺服器，平台反向代理 /play/sanguo/；
  // 伺服器網址還沒給 → 先在大廳以「即將開放」展示。分級依遊戲方建議：輔 12
  { id: "sanguo", path: "/play/sanguo/", status: "soon", players: "1", rating: "guidance12", paid: true, accent: "#d4a24c" },
];

export function getGame(id: string): GameInfo | undefined {
  return GAMES.find((g) => g.id === id);
}

/** 這款遊戲在這個地區能不能玩（地區設定可以排除個別遊戲，例如授權角色不含該地區） */
export function isAvailable(game: GameInfo, region: Region): boolean {
  return game.status === "live" && region.active && !region.excludedGames?.includes(game.id);
}
