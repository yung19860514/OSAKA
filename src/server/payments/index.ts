// 平台結帳要用哪種付款方式（各遊戲共用）。
//   ccat：黑貓 PAY 真實 ibon 代碼。要設好 CCAT_* 金鑰「而且」PAYMENTS_LIVE=1 才會開（明確的總開關）
//   mock：本機開發用的模擬代碼（不能拿去超商繳）
//   closed：正式／預覽環境沒開總開關 → 結帳停用，不發任何代碼
// ⏳ 會員與資料庫上雲端前，到帳後的發貨還在玩家瀏覽器執行；正式對外收錢前要先把訂單與發貨搬到伺服器（見 CLAUDE.md）。

import { ccatConfig, type CcatConfig } from "./ccat";
import { zhTW } from "@/i18n/zh-TW";
import { parseSku, purchaseNameKey } from "@/game/shop";

export type PaymentMode = { kind: "ccat"; cfg: CcatConfig } | { kind: "mock" } | { kind: "closed" };

export function paymentMode(env: Record<string, string | undefined> = process.env): PaymentMode {
  const cfg = ccatConfig(env);
  if (cfg && env.PAYMENTS_LIVE === "1") {
    // 正式網站只准用黑貓 PAY 正式站（測試站的代碼不能真的繳，測試工具的「已繳」也不能拿來發貨）
    if (env.VERCEL_ENV === "production" && env.CCAT_ENV !== "prod") return { kind: "closed" };
    return { kind: "ccat", cfg };
  }
  // Vercel 的預覽環境 NODE_ENV 也是 production → 一併視為正式，不發模擬代碼
  const deployed = env.NODE_ENV === "production" || env.VERCEL_ENV === "production" || env.VERCEL_ENV === "preview";
  return deployed ? { kind: "closed" } : { kind: "mock" };
}

/** 繳費單上的商品明細（法規要求寫商品名稱；黑貓 PAY 限 150 字） */
export function orderDetail(lines: { sku: string; qty: number }[]): string {
  const dict = zhTW as Record<string, string>;
  const parts = lines.map((l) => {
    const p = parseSku(l.sku);
    const name = (p && dict[purchaseNameKey(p)]) || l.sku;
    return `${name} x${l.qty}`;
  });
  const text = `${dict["app.name"] ?? ""}：${parts.join("、")}`;
  return text.length > 150 ? `${text.slice(0, 147)}…` : text;
}
