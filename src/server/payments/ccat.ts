// 黑貓 PAY（統一客樂得 多元支付平台）超商 ibon 代碼繳費。只能在伺服器端使用（金鑰不可進瀏覽器）。
// 規格：《多元支付平台-WEBAPI介面規格 V1.28.2》（_接案專案/黑貓PAY超商繳款/），用到的部分：
//   取 Token（一）→ 建單 CvsOrderAppend（二-1）→ 查單 CvsOrderQuery（二-2）→ 繳費主動通知 APN（二-6）
// 設定全部放環境變數（本機 web/.env.local、正式在 Vercel 專案設定），見 .env.example。

import { createHash, randomInt, timingSafeEqual } from "node:crypto";

export interface CcatConfig {
  base: string;
  custId: string;
  password: string;
  /** 繳費完成主動通知網址；沒設就用黑貓 PAY 後台設定的回傳網址 */
  apnUrl?: string;
  /** 規格把繳款人姓名、郵遞區號、地址列為必填；平台沒收這些 → 先帶公司預設值。手機由玩家結帳時填（老闆 2026-10-21） */
  payer: { name: string; postcode: string; address: string };
}

const BASE = { prod: "https://cocs.4128888card.com.tw", test: "https://test.4128888card.com.tw/app" } as const;

/** 讀環境變數；金流代號或 API 密碼沒設＝黑貓 PAY 未啟用（回 null） */
export function ccatConfig(env: Record<string, string | undefined> = process.env): CcatConfig | null {
  const custId = env.CCAT_CUST_ID?.trim();
  const password = env.CCAT_API_PASSWORD?.trim();
  if (!custId || !password) return null;
  const site = env.SITE_URL?.trim().replace(/\/+$/, "");
  return {
    base: env.CCAT_ENV === "prod" ? BASE.prod : BASE.test,
    custId,
    password,
    apnUrl: env.CCAT_APN_URL?.trim() || (site?.startsWith("https://") ? `${site}/api/payments/ccat/notify` : undefined),
    payer: {
      name: env.CCAT_PAYER_NAME?.trim() || "平台會員",
      postcode: env.CCAT_PAYER_POSTCODE?.trim() || "100",
      address: env.CCAT_PAYER_ADDRESS?.trim() || "台灣",
    },
  };
}

export class CcatError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
  }
}

// ---------- Token（有效 3 小時；同一個伺服器執行個體內共用，到期前 5 分鐘換新） ----------
let tokenCache: { key: string; token: string; exp: number } | null = null;

async function getToken(cfg: CcatConfig): Promise<string> {
  const key = `${cfg.base}|${cfg.custId}`;
  if (tokenCache && tokenCache.key === key && tokenCache.exp - 300_000 > Date.now()) return tokenCache.token;
  const res = await fetch(`${cfg.base}/Token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "password", username: cfg.custId, password: cfg.password }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number } | null;
  if (!res.ok || !data?.access_token) throw new CcatError("token_failed", { status: res.status });
  tokenCache = { key, token: data.access_token, exp: Date.now() + (data.expires_in ?? 3 * 3600) * 1000 };
  return data.access_token;
}

async function collect<T>(cfg: CcatConfig, payload: Record<string, unknown>): Promise<T> {
  const call = async (token: string) =>
    fetch(`${cfg.base}/api/Collect`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  let res = await call(await getToken(cfg));
  if (res.status === 401) {
    // Token 被提早作廢：重取一次
    tokenCache = null;
    res = await call(await getToken(cfg));
  }
  const data = (await res.json().catch(() => null)) as (T & { status?: string; msg?: string }) | null;
  if (!res.ok || !data || data.status !== "OK") throw new CcatError("collect_failed", { cmd: payload.cmd, status: res.status, msg: data?.msg });
  return data;
}

// ---------- 建單 ----------

/** 黑貓 PAY 訂單號：同一金流代號不可重複、最長 25 字 → P + 台灣時間 yyMMddHHmmss + 12 碼安全亂數（25 字，猜不到別人的單號） */
export function newCcatOrderNo(now = new Date(), rand: (n: number) => number = randomInt): string {
  const tw = new Date(now.getTime() + 8 * 3600_000).toISOString(); // 2026-10-21T15:04:05.000Z
  const stamp = tw.slice(2, 19).replace(/[-T:]/g, "");
  const tail = Array.from({ length: 12 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[rand(32)]).join("");
  return `P${stamp}${tail}`;
}

export interface CvsOrderInput {
  orderNo: string;
  amount: number;
  /** 繳費到期日 YYYY-MM-DD（台灣日期） */
  expireDate: string;
  email: string;
  /** 繳款人手機（黑貓 PAY 必填；玩家結帳時填） */
  mobile: string;
  /** 商品明細（必填，不可含 HTML，最長 150 字） */
  detail: string;
}

export interface CvsOrderResult {
  /** ibon 代碼 */
  code: string;
  /** 手機開啟顯示 ibon 條碼的網址 */
  shortUrl?: string;
}

export async function createCvsOrder(cfg: CcatConfig, o: CvsOrderInput): Promise<CvsOrderResult> {
  if (!Number.isInteger(o.amount) || o.amount <= 0) throw new CcatError("bad_amount");
  const r = await collect<{ ibon_code?: string; short_url?: string }>(cfg, {
    cmd: "CvsOrderAppend",
    cust_id: cfg.custId,
    cust_order_no: o.orderNo,
    order_amount: o.amount,
    expire_date: o.expireDate,
    payer_name: cfg.payer.name,
    payer_postcode: cfg.payer.postcode,
    payer_address: cfg.payer.address,
    payer_mobile: o.mobile,
    payer_email: o.email,
    payment_type: "0", // ibon 繳款
    payment_acquirerType: "2", // 收單行：安源（7-ELEVEN ibon）
    order_detail: o.detail.replace(/[<>]/g, "").slice(0, 150),
    ...(cfg.apnUrl ? { apn_url: cfg.apnUrl } : {}),
  });
  if (!r.ibon_code) throw new CcatError("no_code");
  // 條碼網址會變成玩家點的連結 → 只收 https
  const shortUrl = typeof r.short_url === "string" && /^https:\/\/[^\s"'<>]+$/.test(r.short_url) ? r.short_url : undefined;
  return { code: String(r.ibon_code), shortUrl };
}

// ---------- 查單 ----------

/** review＝黑貓 PAY 說已繳，但實繳金額比訂單少（或缺）→ 不發貨，要人工對帳 */
export type PayState = "pending" | "paid" | "review" | "expired" | "cancelled" | "unknown";

export interface CvsOrderStatus {
  state: PayState;
  processCode: number;
  orderAmount: number;
  payAmount: number;
  payDate?: string;
}

/**
 * 訂單程序狀態（規格五-1）：3 等待繳款、4 已繳納、5 已註銷、6 逾期、7 已預約撥款、8 已完成撥款。
 * 「已付款」還要實際繳款金額 pay_amount 不少於訂單金額（規格要求以實繳金額判斷後才出貨）；
 * 少繳或沒帶金額 → review（人工對帳，不自動發貨）。
 */
export function payStateOf(processCode: number, orderAmount: number, payAmount: number): PayState {
  if (processCode === 4 || processCode === 7 || processCode === 8) return orderAmount > 0 && payAmount >= orderAmount ? "paid" : "review";
  if (processCode === 0 || processCode === 1 || processCode === 3) return "pending";
  if (processCode === 6) return "expired";
  if (processCode === 5) return "cancelled";
  return "unknown";
}

export async function queryCvsOrder(cfg: CcatConfig, orderNo: string): Promise<CvsOrderStatus> {
  const r = await collect<{ process_code?: number | string; order_amount?: number | string; pay_amount?: number | string | null; pay_date?: string }>(cfg, {
    cmd: "CvsOrderQuery",
    cust_id: cfg.custId,
    cust_order_no: orderNo,
  });
  const processCode = Number(r.process_code);
  const orderAmount = Number(r.order_amount);
  const payAmount = Number(r.pay_amount ?? 0) || 0;
  return { state: payStateOf(processCode, orderAmount, payAmount), processCode, orderAmount, payAmount, payDate: r.pay_date || undefined };
}

// ---------- 繳費主動通知（APN） ----------

export interface ApnBody {
  api_id: string;
  trans_id: string;
  order_no: string;
  amount: number | string;
  status: string;
  nonce: string;
  checksum: string;
  pay_amount?: number | string;
}

/**
 * checksum = MD5(api_id:trans_id:amount:status:nonce)。
 * ⚠️ 算式裡沒有密鑰，任何人都算得出來 → 只能當格式檢查；是否真的付款一律再用 CvsOrderQuery 向黑貓 PAY 查證。
 */
export function apnChecksumOk(b: ApnBody): boolean {
  if (typeof b.checksum !== "string" || !/^[0-9a-f]{32}$/i.test(b.checksum)) return false;
  const expect = createHash("md5").update(`${b.api_id}:${b.trans_id}:${b.amount}:${b.status}:${b.nonce}`).digest("hex");
  return timingSafeEqual(Buffer.from(expect), Buffer.from(b.checksum.toLowerCase()));
}

export function isApnBody(x: unknown): x is ApnBody {
  const b = x as Partial<ApnBody> | null;
  return !!b && typeof b.api_id === "string" && typeof b.trans_id === "string" && typeof b.order_no === "string" && typeof b.status === "string" && typeof b.nonce === "string" && typeof b.checksum === "string" && (typeof b.amount === "number" || typeof b.amount === "string");
}
