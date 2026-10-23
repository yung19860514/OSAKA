// 建立訂單：價格一律由伺服器依地區售價表計算，不採用前端送來的價格。
// 付款方式：超商代碼繳費，金流商＝黑貓 PAY（老闆 2026-10-07 確認）。
// 黑貓 PAY 接口：src/server/payments（建單在這裡、查到帳 /api/orders/[id]、繳費通知 /api/payments/ccat/notify）。
// ⏳ 會員與資料庫接上後：從登入 session 取得玩家與綁定地區（不信任前端送的 Email）、訂單存進資料庫。
//    串接經驗與測試工具：_接案專案/黑貓PAY超商繳款/

import { randomUUID } from "node:crypto";
import { REGIONS } from "@/config/regions";
import { MAX_QTY, isCosmetic, parseSku } from "@/game/shop";
import { CcatError, createCvsOrder, newCcatOrderNo } from "@/server/payments/ccat";
import { orderDetail, paymentMode } from "@/server/payments";
import { rateLimiter, sameOrigin } from "@/server/guard";

const MAX_LINES = 50;
/** 台灣手機：09 開頭 10 碼 */
const TW_MOBILE = /^09\d{8}$/;
/** 真的向黑貓 PAY 建單（會寄繳費通知 Email）：每個 IP 10 分鐘最多 5 筆 */
const ccatLimit = rateLimiter(5, 10 * 60_000);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_json" }, { status: 400 });
  }
  const lines = (body as { lines?: unknown })?.lines;
  // 買方 Email：寄繳費通知與電子發票（⏳ 會員上雲端後改從登入 session 取得，不信任前端）
  const email = (body as { buyer?: { email?: unknown } })?.buyer?.email;
  if (email !== undefined && (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 254)) {
    return Response.json({ error: "bad_buyer" }, { status: 400 });
  }
  // 繳款人手機（黑貓 PAY 必填；老闆 2026-10-21：結帳時請玩家填，註冊不收）
  const mobile = (body as { buyer?: { mobile?: unknown } })?.buyer?.mobile;
  if (mobile !== undefined && (typeof mobile !== "string" || !TW_MOBILE.test(mobile))) {
    return Response.json({ error: "bad_mobile" }, { status: 400 });
  }
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > MAX_LINES) {
    return Response.json({ error: "bad_lines" }, { status: 400 });
  }
  // 目前只開台灣；之後依帳號綁定地區
  const region = REGIONS.find((r) => r.id === "tw" && r.active);
  if (!region) return Response.json({ error: "region_closed" }, { status: 403 });

  const seen = new Set<string>();
  const out: { sku: string; qty: number; unitPrice: number }[] = [];
  for (const raw of lines) {
    const sku = (raw as { sku?: unknown })?.sku;
    const qty = (raw as { qty?: unknown })?.qty;
    const p = parseSku(sku);
    const unitPrice = typeof sku === "string" ? region.prices[sku] : undefined;
    if (!p || typeof sku !== "string" || !(typeof unitPrice === "number" && unitPrice > 0)) {
      return Response.json({ error: "unknown_sku", sku }, { status: 400 });
    }
    if (!Number.isInteger(qty) || (qty as number) < 1 || (qty as number) > (isCosmetic(p) ? 1 : MAX_QTY) || seen.has(sku)) {
      return Response.json({ error: "bad_qty", sku }, { status: 400 });
    }
    seen.add(sku);
    out.push({ sku, qty: qty as number, unitPrice });
  }
  const total = Math.round(out.reduce((s, l) => s + l.unitPrice * l.qty, 0) * 100) / 100;
  // 超商代收有單筆金額上下限
  if (total < region.cvs.min || total > region.cvs.max) {
    return Response.json({ error: "amount_out_of_range", min: region.cvs.min, max: region.cvs.max }, { status: 400 });
  }
  const mode = paymentMode();
  // 結帳總開關沒開：不給任何代碼（正式環境絕不發假代碼）
  if (mode.kind === "closed") return Response.json({ error: "payment_not_configured" }, { status: 503 });

  const expiresAt = dueDateEnd(region.cvs.expireDays);
  const base = { regionId: region.id, currency: region.currency, lines: out, total, status: "pending" as const };
  const store = region.cvs.stores[0] ?? "";

  if (mode.kind === "ccat") {
    // 防止別人用程式大量建單、拿我們的帳號寄信給任意 Email（⏳ 會員上伺服器後改成只認登入帳號的 Email）
    if (!sameOrigin(request)) return Response.json({ error: "forbidden" }, { status: 403 });
    if (!ccatLimit(request)) return Response.json({ error: "too_many_orders" }, { status: 429 });
    // 黑貓 PAY 要繳款人 Email（寄繳費通知）；金額必須是整數元
    if (typeof email !== "string") return Response.json({ error: "bad_buyer" }, { status: 400 });
    if (typeof mobile !== "string") return Response.json({ error: "bad_mobile" }, { status: 400 });
    if (!Number.isInteger(total)) return Response.json({ error: "bad_amount" }, { status: 400 });
    const orderId = newCcatOrderNo();
    try {
      const r = await createCvsOrder(mode.cfg, {
        orderNo: orderId,
        amount: total,
        expireDate: twDate(expiresAt),
        email,
        mobile,
        detail: orderDetail(out),
      });
      return Response.json({ orderId, ...base, payment: { method: "cvs", provider: "ccat", store, code: r.code, barcodeUrl: r.shortUrl, expiresAt, mock: false } });
    } catch (e) {
      // 不把黑貓 PAY 的原始回覆給玩家看；記在伺服器 log 供查帳
      console.error("[ccat] 建單失敗", orderId, e instanceof CcatError ? `${e.message} ${JSON.stringify(e.detail)}` : e);
      return Response.json({ error: "payment_failed" }, { status: 502 });
    }
  }

  // 本機開發：模擬代碼走流程
  const code = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join("");
  return Response.json({ orderId: randomUUID(), ...base, payment: { method: "cvs", provider: "mock", store, code, expiresAt, mock: true } });
}

/** 到期時間換成台灣日期 YYYY-MM-DD（黑貓 PAY 的到期日欄位） */
function twDate(iso: string): string {
  return new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(0, 10);
}

/** 繳費到期時間：第 N 天的台灣時間 23:59:59（黑貓 PAY 以日期計算到期） */
function dueDateEnd(days: number): string {
  const tw = new Date(Date.now() + 8 * 3600_000); // 換成台灣日期
  tw.setUTCDate(tw.getUTCDate() + days);
  tw.setUTCHours(23, 59, 59, 0);
  return new Date(tw.getTime() - 8 * 3600_000).toISOString();
}
