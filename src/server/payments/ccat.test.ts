import { describe, expect, it } from "vitest";
import { apnChecksumOk, ccatConfig, newCcatOrderNo, payStateOf } from "./ccat";
import { orderDetail, paymentMode } from "./index";

describe("黑貓 PAY", () => {
  it("沒設金鑰＝未啟用", () => {
    expect(ccatConfig({})).toBeNull();
    expect(ccatConfig({ CCAT_CUST_ID: "x" })).toBeNull();
    const c = ccatConfig({ CCAT_CUST_ID: "1", CCAT_API_PASSWORD: "p", CCAT_ENV: "prod", SITE_URL: "https://play.example.com/" });
    expect(c?.base).toBe("https://cocs.4128888card.com.tw");
    expect(c?.apnUrl).toBe("https://play.example.com/api/payments/ccat/notify");
    expect(ccatConfig({ CCAT_CUST_ID: "1", CCAT_API_PASSWORD: "p" })?.base).toContain("test.");
  });

  it("結帳總開關：要金鑰＋PAYMENTS_LIVE=1；部署環境沒開就關閉，不發模擬代碼", () => {
    const keys = { CCAT_CUST_ID: "1", CCAT_API_PASSWORD: "p" };
    expect(paymentMode({ ...keys, PAYMENTS_LIVE: "1" }).kind).toBe("ccat");
    expect(paymentMode({ ...keys, NODE_ENV: "development" }).kind).toBe("mock");
    expect(paymentMode({ ...keys, NODE_ENV: "production" }).kind).toBe("closed");
    expect(paymentMode({ VERCEL_ENV: "preview", NODE_ENV: "production", PAYMENTS_LIVE: "1" }).kind).toBe("closed");
    expect(paymentMode({ NODE_ENV: "development" }).kind).toBe("mock");
    // 正式網站沒指定黑貓 PAY 正式站 → 不開
    expect(paymentMode({ ...keys, PAYMENTS_LIVE: "1", VERCEL_ENV: "production" }).kind).toBe("closed");
    expect(paymentMode({ ...keys, PAYMENTS_LIVE: "1", VERCEL_ENV: "production", CCAT_ENV: "prod" }).kind).toBe("ccat");
  });

  it("訂單號：不重複、≤25 字、符合查單格式", () => {
    const a = newCcatOrderNo(new Date("2026-10-21T15:04:05Z"), () => 0);
    expect(a).toBe("P261021230405AAAAAAAAAAAA");
    expect(a.length).toBeLessThanOrEqual(25);
    const set = new Set(Array.from({ length: 500 }, () => newCcatOrderNo()));
    expect(set.size).toBe(500);
    for (const n of set) expect(n).toMatch(/^P\d{12}[A-Z2-9]{12}$/);
  });

  it("已付款＝已繳納而且實繳金額等於訂單金額", () => {
    expect(payStateOf(4, 300, 300)).toBe("paid");
    expect(payStateOf(8, 300, 300)).toBe("paid");
    expect(payStateOf(4, 300, 30)).toBe("review"); // 少繳：人工對帳
    expect(payStateOf(4, 300, 0)).toBe("review");
    expect(payStateOf(4, 300, 330)).toBe("paid"); // 多繳（例如含超商手續費）仍算已付
    expect(payStateOf(3, 300, 0)).toBe("pending");
    expect(payStateOf(6, 300, 0)).toBe("expired");
    expect(payStateOf(5, 300, 0)).toBe("cancelled");
  });

  it("APN 檢核碼：規格書範例算得出來，竄改就不符", () => {
    const sample = { api_id: "CV0000000000", trans_id: "550e8400e29b41d4a716446655440000", order_no: "PO5488277", amount: 1250, status: "D", nonce: "1234569999", checksum: "3579609ba3914a49441e98cb7e8a55de" };
    expect(apnChecksumOk(sample)).toBe(true);
    expect(apnChecksumOk({ ...sample, checksum: sample.checksum.toUpperCase() })).toBe(true);
    expect(apnChecksumOk({ ...sample, status: "B" })).toBe(false);
    expect(apnChecksumOk({ ...sample, checksum: "x" })).toBe(false);
  });

  it("繳費單商品明細用中文名稱、不超過 150 字", () => {
    const d = orderDetail([{ sku: "blockblitz:bundle:rookie", qty: 1 }, { sku: "blockblitz:single:bomb", qty: 3 }]);
    expect(d).toMatch(/^方塊消消：.+ x1、.+ x3$/);
    expect(d).not.toContain("blockblitz:");
    expect(orderDetail(Array.from({ length: 40 }, () => ({ sku: "blockblitz:bundle:rookie", qty: 9 }))).length).toBeLessThanOrEqual(150);
  });
});
