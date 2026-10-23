import { describe, expect, it } from "vitest";
import { addToCart, cartTotal, deliver, parseSku, priceOf, setQty, skuOf, type Cart } from "./shop";
import { loadPlayer } from "./storage";
import { POST } from "@/app/api/orders/route";

const fresh = () => loadPlayer();

describe("購物車", () => {
  it("外觀最多放 1 份；道具可以一直加", () => {
    const p = fresh();
    let cart: Cart = [];
    cart = addToCart(cart, p, { kind: "skin", id: "neon" });
    cart = addToCart(cart, p, { kind: "skin", id: "neon" });
    cart = addToCart(cart, p, { kind: "battle", id: "shield" }, 3);
    cart = addToCart(cart, p, { kind: "battle", id: "shield" });
    expect(cart).toEqual([
      { p: { kind: "skin", id: "neon" }, qty: 1 },
      { p: { kind: "battle", id: "shield" }, qty: 4 },
    ]);
    expect(cartTotal(cart)).toBe(priceOf({ kind: "skin", id: "neon" })! + 4 * priceOf({ kind: "battle", id: "shield" })!);
  });

  it("已擁有、免費、不存在的東西放不進購物車", () => {
    const p = fresh();
    expect(addToCart([], p, { kind: "skin", id: "arcade" })).toEqual([]);
    expect(addToCart([], p, { kind: "scene", id: "space" })).toEqual([]);
    expect(addToCart([], p, { kind: "skin", id: "hacked" })).toEqual([]);
  });

  it("改數量 / 數量 0 = 移除", () => {
    let cart = addToCart([], fresh(), { kind: "battle", id: "bomb" });
    cart = setQty(cart, { kind: "battle", id: "bomb" }, 5);
    expect(cart[0].qty).toBe(5);
    expect(setQty(cart, { kind: "battle", id: "bomb" }, 0)).toEqual([]);
  });

  it("付款成功：整車一次發貨（含組合包）", () => {
    const p = fresh();
    let cart: Cart = [];
    cart = addToCart(cart, p, { kind: "pet", id: "dog" });
    cart = addToCart(cart, p, { kind: "battle", id: "rain" }, 10);
    cart = addToCart(cart, p, { kind: "bundle", id: "supply" }, 2);
    const r = deliver(p, cart);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.next.ownedPets).toContain("dog");
    expect(r.next.battleItems.rain).toBe(p.battleItems.rain + 10 + 3 * 2);
    expect(r.next.battleItems.shield).toBe(p.battleItems.shield + 3 * 2);
  });

  it("有一項不合法就整筆不發（不會只發一半）", () => {
    const p = fresh();
    const r = deliver(p, [
      { p: { kind: "battle", id: "bomb" }, qty: 3 },
      { p: { kind: "skin", id: "arcade" }, qty: 1 }, // 已擁有
    ]);
    expect(r.ok).toBe(false);
  });

  it("商品編號可以來回轉換，亂寫的不認", () => {
    expect(parseSku(skuOf({ kind: "bundle", id: "rookie" }))).toEqual({ kind: "bundle", id: "rookie" });
    expect(parseSku("blockblitz:battle:constructor")).toBeNull();
    expect(parseSku("othergame:skin:neon")).toBeNull();
    expect(parseSku("blockblitz:skin:neon:x")).toBeNull();
  });
});

describe("建立訂單 API（價格由伺服器算）", () => {
  const call = (body: unknown) =>
    POST(new Request("http://x/api/orders", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }));

  it("依售價表算總價，不採用前端送來的價格", async () => {
    const res = await call({ lines: [{ sku: "blockblitz:battle:shield", qty: 3, unitPrice: 1 }, { sku: "blockblitz:skin:neon", qty: 1 }] });
    expect(res.status).toBe(200);
    const o = await res.json();
    expect(o.currency).toBe("TWD");
    expect(o.total).toBe(3 * priceOf({ kind: "battle", id: "shield" })! + priceOf({ kind: "skin", id: "neon" })!);
  });

  it("繳款人手機要是 09 開頭 10 碼", async () => {
    const lines = [{ sku: "blockblitz:battle:freeze", qty: 2 }];
    expect((await call({ lines, buyer: { email: "a@b.co", mobile: "0912" } })).status).toBe(400);
    expect((await call({ lines, buyer: { email: "a@b.co", mobile: "0212345678" } })).status).toBe(400);
    expect((await call({ lines, buyer: { email: "a@b.co", mobile: "0912345678" } })).status).toBe(200);
  });

  it("超商繳費有金額上下限；建立成功會拿到繳費代碼與期限", async () => {
    expect((await call({ lines: [{ sku: "blockblitz:battle:freeze", qty: 1 }] })).status).toBe(400); // NT$20 < 最低 NT$31
    const o = await (await call({ lines: [{ sku: "blockblitz:battle:freeze", qty: 2 }] })).json();
    expect(o.status).toBe("pending");
    expect(o.payment.method).toBe("cvs");
    expect(o.payment.code).toMatch(/^\d{12}$/);
    expect(Date.parse(o.payment.expiresAt)).toBeGreaterThan(Date.now());
  });

  it("擋掉：亂碼、不存在的商品、外觀買 2 份、數量 0 或小數、重複品項", async () => {
    expect((await call("not json")).status).toBe(400);
    expect((await call({ lines: [] })).status).toBe(400);
    expect((await call({ lines: [{ sku: "blockblitz:skin:hacked", qty: 1 }] })).status).toBe(400);
    expect((await call({ lines: [{ sku: "blockblitz:skin:neon", qty: 2 }] })).status).toBe(400);
    expect((await call({ lines: [{ sku: "blockblitz:battle:bomb", qty: 0 }] })).status).toBe(400);
    expect((await call({ lines: [{ sku: "blockblitz:battle:bomb", qty: 1.5 }] })).status).toBe(400);
    expect(
      (await call({ lines: [{ sku: "blockblitz:battle:bomb", qty: 1 }, { sku: "blockblitz:battle:bomb", qty: 1 }] })).status,
    ).toBe(400);
  });
});
