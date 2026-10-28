import { describe, expect, it } from "vitest";
import { claimDaily, consumeItems, grantCart, normalizeWallet, twToday, WALLET_DEFAULTS } from "./wallet";

const w0 = () => normalizeWallet(structuredClone(WALLET_DEFAULTS));

describe("道具錢包", () => {
  it("整理資料：缺的補預設、免費外觀永遠擁有、負數與亂填的值歸零", () => {
    const w = normalizeWallet({ ownedSkins: ["neon"], items: { bomb: -5, revive: "x" }, battleItems: { bomb: 3.7 } });
    expect(w.ownedSkins).toEqual(expect.arrayContaining(["arcade", "neon"]));
    expect(w.items).toEqual({ bomb: 0, revive: 0 });
    expect(w.battleItems.bomb).toBe(3);
  });

  it("使用道具：夠就扣，不夠就整批不扣", () => {
    const w = w0();
    const a = consumeItems(w, [{ kind: "item", id: "bomb", qty: 2 }]);
    expect(a?.items.bomb).toBe(0);
    expect(consumeItems(w, [{ kind: "item", id: "bomb", qty: 3 }])).toBeNull();
    expect(consumeItems(w, [{ kind: "item", id: "bomb", qty: 1 }, { kind: "battle", id: "bomb", qty: 5 }])).toBeNull();
    expect(consumeItems(w, [{ kind: "item", id: "bomb", qty: 0 }])).toBeNull();
    expect(w.items.bomb).toBe(2); // 原本的不會被改到
  });

  it("每日禮物：台灣日期一天一次", () => {
    const now = Date.parse("2026-10-28T15:59:00Z"); // 台灣 23:59
    const r = claimDaily(w0(), () => 0, now);
    expect(r?.gifts).toHaveLength(3);
    expect(r?.next.dailyGift).toBe("2026-10-28");
    expect(claimDaily(r!.next, () => 0, now)).toBeNull();
    expect(claimDaily(r!.next, () => 0, now + 2 * 60_000)).not.toBeNull(); // 過了台灣午夜
    expect(twToday(Date.parse("2026-10-28T16:00:00Z"))).toBe("2026-10-29");
  });

  it("付款到帳：整車發；已經擁有的外觀＝整筆不發（轉客服）", () => {
    const w = w0();
    const g = grantCart(w, [{ p: { kind: "single", id: "bomb" }, qty: 3 }, { p: { kind: "skin", id: "neon" }, qty: 1 }]);
    expect(g?.items.bomb).toBe(5);
    expect(g?.ownedSkins).toContain("neon");
    expect(grantCart(g!, [{ p: { kind: "skin", id: "neon" }, qty: 1 }])).toBeNull();
    const b = grantCart(w, [{ p: { kind: "bundle", id: "rookie" }, qty: 1 }]);
    expect(b?.items.revive).toBe(3);
  });
});
