// 地區設定檔：遊戲全球共用一套，各地區只是「誰收錢、怎麼收、用什麼規則」不同。
// 營運架構：國外總公司擁有平台；各國當地公司簽約當代理，負責當地法規、金流、發票。
// 新增國家 = 在 REGIONS 加一筆，不需改遊戲程式。
//
// 規則：
// - 玩家帳號註冊時綁定一個地區，該區買的遊戲幣只能在該區使用（各代理帳目分開）
// - 每一筆儲值記錄 regionId → 總公司可依地區出營收報表給各代理分潤
// - 遊戲幣不可兌換回現金（所有地區一致）

import type { Locale } from "@/i18n";
import { PRICES_TWD } from "./prices";

export type PaymentProvider = "tw-third-party" | "stripe";

export interface Region {
  id: string;
  /** 是否已開放（尚未簽約的地區先設 false） */
  active: boolean;
  /** 負責此地區的代理公司（正式上線前填入公司全名與統編/登記號） */
  operator: string;
  /** 適用國家（ISO 3166-1 alpha-2）；"*" 代表其他未指定國家 */
  countries: string[];
  defaultLocale: Locale;
  currency: string;
  payment: PaymentProvider;
  /**
   * 付款方式：超商代碼繳費（老闆 2026-10-07：只做超商繳款，金流商確定用黑貓 PAY）。
   * 黑貓 PAY 的繳費期限是「到期日」（YYYY-MM-DD，當天結束前都能繳），不是小時數。
   */
  cvs: {
    /** 金流商：ccat = 黑貓 PAY（統一客樂得多元支付平台） */
    provider: "ccat" | "none";
    stores: string[];
    /** 繳費期限：建立訂單後第幾天的當天結束 */
    expireDays: number;
    /** 單筆金額上下限（黑貓 PAY 安源 ibon 上限 20,000；下限須大於簽約手續費） */
    min: number;
    max: number;
  };
  /** 這個地區不上架的遊戲（例如授權角色不含該地區）；沒列的遊戲＝平台合約自動涵蓋 */
  excludedGames?: string[];
  /** 售價表：商品編號 → 價格（第一階段：台幣直接買道具；沒列在表上的商品在該地區不販售） */
  prices: Record<string, number>;
  /** 第二階段（平台金幣）才用：儲值方案，付多少錢 → 拿多少金幣（價格待老闆定案） */
  coinPacks: { price: number; coins: number }[];
  /** 當地法規要求的文件連結（上線前補齊） */
  legal: {
    terms?: string;
    privacy?: string;
    /** 台灣：線上遊戲定型化契約 */
    gameContract?: string;
    /** 遊戲分級標示，例如台灣「普遍級」 */
    rating?: string;
  };
  /** 是否需開立當地電子發票 */
  eInvoice: boolean;
  /** 玩家資料存放機房；預設全部集中東京，少數國家要求本地存放時另設 */
  dataRegion: "tokyo";
}

export const REGIONS: Region[] = [
  {
    id: "tw",
    active: true,
    operator: "（待填）台灣地區總代理公司",
    countries: ["TW"],
    defaultLocale: "zh-TW",
    currency: "TWD",
    payment: "tw-third-party",
    prices: PRICES_TWD,
    // 黑貓 PAY 收單行「安源」＝7-ELEVEN ibon 代碼
    // 黑貓 PAY 實測（2026-10-21）：代繳金額必須「大於」契客手續費 NT$30 → 最低 NT$31
    cvs: { provider: "ccat", stores: ["7-ELEVEN"], expireDays: 3, min: 31, max: 20000 },
    // ⏳ 暫定價格，待老闆拍板（大包多送）
    coinPacks: [
      { price: 30, coins: 30 },
      { price: 150, coins: 160 },
      { price: 300, coins: 330 },
      { price: 990, coins: 1150 },
      { price: 3290, coins: 4000 },
    ],
    legal: {},
    eInvoice: true,
    dataRegion: "tokyo",
  },
  {
    id: "global",
    active: false,
    operator: "（待填）國外總公司",
    countries: ["*"],
    defaultLocale: "en",
    currency: "USD",
    payment: "stripe",
    prices: {},
    cvs: { provider: "none", stores: [], expireDays: 3, min: 0, max: 0 },
    // ⏳ 暫定價格，待老闆拍板
    coinPacks: [
      { price: 0.99, coins: 30 },
      { price: 4.99, coins: 160 },
      { price: 9.99, coins: 330 },
      { price: 29.99, coins: 1150 },
      { price: 99.99, coins: 4000 },
    ],
    legal: {},
    eInvoice: false,
    dataRegion: "tokyo",
  },
];

/** 依國家代碼找負責的地區（找不到就用 "*" 的地區） */
export function regionForCountry(country: string): Region | undefined {
  const c = country.toUpperCase();
  return REGIONS.find((r) => r.active && r.countries.includes(c)) ?? REGIONS.find((r) => r.active && r.countries.includes("*"));
}
