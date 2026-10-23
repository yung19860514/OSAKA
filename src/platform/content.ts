// 平台大廳的內容：主打橫幅、最新消息。
// ⏳ 目前寫在程式裡（範例內容，上線前由營運確認）；之後改成後台可編輯（存資料庫）。

export interface NewsItem {
  date: string;
  tag: "notice" | "event" | "update";
  title: string;
  titleEn: string;
  /** 點了要去的地方（沒有就不能點） */
  href?: string;
}

export const NEWS: NewsItem[] = [
  { date: "2026-10-07", tag: "notice", title: "新遊戲《仙途問道》加入平台（測試中）", titleEn: "New game: Xiantu joins the platform (testing)", href: "/play/xiantu/" },
  { date: "2026-10-07", tag: "event", title: "《天下三分》即將開放，敬請期待", titleEn: "Tianxia Sanfen is coming soon" },
  { date: "2026-10-07", tag: "notice", title: "新遊戲《魔晶要塞》加入平台（測試中）", titleEn: "New game: Crystal Fortress joins the platform (testing)", href: "/play/mjys/" },
  { date: "2026-10-07", tag: "update", title: "方塊消消：商店上線，新增組合包與購物車", titleEn: "Block Blitz: shop is open with bundles and cart", href: "/play/blockblitz" },
  { date: "2026-10-03", tag: "event", title: "方塊消消：多人對戰與道具賽開放測試", titleEn: "Block Blitz: multiplayer & item battles open for testing", href: "/play/blockblitz" },
  { date: "2026-10-01", tag: "notice", title: "平台開放試玩：免下載，打開瀏覽器就能玩", titleEn: "Platform preview: no download, play in your browser" },
];
