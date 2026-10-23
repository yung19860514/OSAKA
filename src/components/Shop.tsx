"use client";

// 商店：外觀 / 道具（含組合包）/ 購物車三個分頁。
// 收費＝台幣直接買：購物車一次結帳 → 伺服器算價建立訂單、給超商繳費代碼 → 玩家到超商繳費 → 繳完全部發貨。
// 金流開通前，本機開發環境用「模擬繳費」走完整流程；正式環境結帳鈕停用。

import { useEffect, useState } from "react";
import PixelIcon from "./PixelIcon";
import { ItemList } from "./Inventory";
import { ItemIcon } from "@/multiplayer/MatchUI";
import { AddButton, PetPicker, ScenePicker, SkinPicker, type CartApi } from "./Pickers";
import {
  BUNDLES,
  BUNDLE_IDS,
  MAX_QTY,
  addToCart,
  canMockPay,
  purchaseNameKey,
  cartTotal,
  GAME_ID,
  currentRegion,
  formatMoney,
  isCosmetic,
  priceOf,
  qtyInCart,
  setQty,
  type Cart,
  type CheckoutResult,
  type Purchase,
} from "@/game/shop";
import { checkPaid, createOrder, isTwMobile, listOrders, markPaidOnce, normalizeMobile, orderCart, ordersToCheck, paymentLive, setOrderStatus, type Order, type PayCheck } from "@/platform/orders";
import { scopedKey } from "@/platform/scope";
import { auth } from "@/platform/auth";
import { useUser } from "@/platform/useUser";
import type { PlayerData } from "@/game/storage";
import type { ItemId } from "@/multiplayer/shared";
import { useT, type TFunc } from "@/i18n";

export type ShopTab = "look" | "items" | "cart" | "orders";

/** 商品顯示名稱 */
export function productName(t: TFunc, p: Purchase): string {
  return t(purchaseNameKey(p) as "skin.arcade");
}

export default function Shop({
  player,
  cart,
  onCart,
  onPaid,
  previewScene,
  onPreviewScene,
  onPick,
  onClose,
  initialTab = "look",
}: {
  player: PlayerData;
  cart: Cart;
  onCart: (next: Cart) => void;
  /** 付款成功：發貨（整車一起發） */
  onPaid: (cart: Cart) => CheckoutResult;
  previewScene: string;
  onPreviewScene: (id: string) => void;
  onPick: (kind: "scene" | "pet" | "skin", id: string) => void;
  onClose: () => void;
  initialTab?: ShopTab;
}) {
  const t = useT();
  const user = useUser();
  const needLogin = auth.enabled && user.kind !== "member";
  const [tab, setTab] = useState<ShopTab>(initialTab);
  const [notice, setNotice] = useState<{ id: number; ok: boolean; text: string } | null>(null);
  const [agree, setAgree] = useState(false);
  /** 正在看繳費資訊的訂單 */
  const [order, setOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => listOrders(GAME_ID));
  const refreshOrders = () => setOrders(listOrders(GAME_ID));
  const [busy, setBusy] = useState(false);
  // 繳款人手機（黑貓 PAY 必填）：記住這個帳號上次填的，下次自動帶入
  const mobileKey = scopedKey("platform.payerMobile");
  const [mobile, setMobile] = useState(() => {
    try {
      return localStorage.getItem(mobileKey) ?? "";
    } catch {
      return "";
    }
  });
  const mobileOk = isTwMobile(mobile);
  // 每則提示一個序號（同樣文字連續出現也會重新播動畫）
  const say = (ok: boolean, text: string) => setNotice((prev) => ({ id: (prev?.id ?? 0) + 1, ok, text }));

  const api: CartApi = {
    qty: (p) => qtyInCart(cart, p),
    add: (p) => {
      // 外觀已經在「待繳費」的訂單裡 → 不要再買一次
      if (isCosmetic(p) && orders.some((o) => o.status === "pending" && o.lines.some((l) => l.purchase.kind === p.kind && l.purchase.id === p.id))) {
        return say(false, t("shop.pendingDup", { name: productName(t, p) }));
      }
      const next = addToCart(cart, player, p);
      if (next !== cart) {
        onCart(next);
        say(true, t("shop.added", { name: productName(t, p) }));
      }
    },
  };
  const count = cart.reduce((n, l) => n + l.qty, 0);
  const total = cartTotal(cart);
  const canPay = paymentLive || canMockPay;
  const cvs = currentRegion().cvs;
  const outOfRange = total < cvs.min || total > cvs.max;
  const pendingCount = orders.filter((o) => o.status === "pending").length;

  const checkout = async () => {
    setBusy(true);
    try {
      // 價格以伺服器算的為準（前端顯示的只是參考）；成功就拿到超商繳費代碼
      const o = await createOrder(GAME_ID, cart, { mobile });
      try {
        localStorage.setItem(mobileKey, normalizeMobile(mobile));
      } catch {
        // 記不住就下次再填
      }
      onCart([]);
      setAgree(false);
      refreshOrders();
      setOrder(o);
    } catch (e) {
      const code = (e as Error).message;
      const key =
        code === "amount_out_of_range"
          ? "shop.outOfRange"
          : code === "payment_not_configured"
            ? "shop.payClosed"
            : code === "payment_failed"
              ? "shop.payFailed"
            : code === "login_required"
              ? "shop.needLogin"
              : code === "bad_mobile"
                ? "shop.badMobile"
              : "shop.orderFailed";
      say(false, t(key, { min: formatMoney(cvs.min), max: formatMoney(cvs.max) }));
    } finally {
      setBusy(false);
    }
  };
  /** 確認已繳費 → 發貨（同一筆訂單只會發一次） */
  const confirmPaid = (o: Order) => {
    setOrder(null);
    const first = markPaidOnce(o.orderId);
    refreshOrders();
    if (!first) return;
    const r = onPaid(orderCart(o));
    // 發貨失敗：改回待處理，下次打開商店會再查、再發（不讓「已付款卻沒拿到」卡住）
    if (!r.ok) {
      setOrderStatus(o.orderId, "pending");
      refreshOrders();
    }
    say(r.ok, t(r.ok ? "shop.paid" : "shop.deliverFailed"));
  };
  /** 開發用：模擬「已在超商繳費」 */
  const mockPaid = confirmPaid;
  const payCheckText = (s: PayCheck, o: Order) =>
    s === "review" || s === "closed"
      ? t("shop.payReview", { id: o.orderId })
      : s === "pending"
        ? t("shop.notPaidYet")
        : s === "expired" || s === "cancelled"
          ? t("shop.expired")
          : t("shop.checkFailed");
  /** 黑貓 PAY 訂單：向伺服器查有沒有繳費 */
  const checkLive = async (o: Order) => {
    setBusy(true);
    const s = await checkPaid(o.orderId);
    setBusy(false);
    if (s === "paid") return confirmPaid(o);
    say(false, payCheckText(s, o));
  };
  // 打開商店時：還沒到帳的黑貓 PAY 訂單自動查一次（繳費後回來就會到帳）
  useEffect(() => {
    let alive = true;
    (async () => {
      for (const o of ordersToCheck(listOrders(GAME_ID))) {
        const s = await checkPaid(o.orderId);
        if (!alive) return;
        if (s === "paid") confirmPaid(o);
        // 已繳但要人工對帳、或查不到 → 要讓玩家知道，不能默默略過
        else if (s === "review" || s === "closed" || s === "error" || s === "unknown") say(false, payCheckText(s, o));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 只在打開商店時查一次
  }, []);
  const mockExpire = (o: Order) => {
    setOrder(null);
    setOrderStatus(o.orderId, "expired");
    refreshOrders();
    say(false, t("shop.expired"));
  };

  return (
    <div className="overlay overlay-scroll shop" onPointerDown={(e) => e.stopPropagation()}>
      <p className="ov-title">
        <PixelIcon name="cart" size={16} color="#ffd84a" light="#fff" /> {t("shop.title")}
      </p>

      <div className="inv-tabs shop-tabs" role="tablist">
        {(["look", "items", "cart", "orders"] as ShopTab[]).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            className={tab === k ? "inv-tab inv-tab-on" : "inv-tab"}
            onClick={() => {
              if (k === "orders") refreshOrders();
              setTab(k);
            }}
          >
            {k === "look"
              ? t("shop.tabLook")
              : k === "items"
                ? t("shop.tabItems")
                : k === "cart"
                  ? t("shop.tabCart", { n: count })
                  : t("shop.tabOrders", { n: pendingCount })}
          </button>
        ))}
      </div>

      {notice && (
        <p key={notice.id} className={notice.ok ? "shop-notice" : "shop-notice shop-notice-bad"} role="status">
          {notice.text}
        </p>
      )}

      {tab === "look" && (
        <>
          <ScenePicker player={player} previewId={previewScene} onPreview={onPreviewScene} onPick={(id) => onPick("scene", id)} cart={api} />
          <PetPicker player={player} onPick={(id) => onPick("pet", id)} cart={api} />
          <SkinPicker player={player} onPick={(id) => onPick("skin", id)} cart={api} />
        </>
      )}

      {tab === "items" && (
        <>
          <div className="skins-label">{t("shop.bundles")}</div>
          <ul className="inv-list">
            {BUNDLE_IDS.filter((id) => priceOf({ kind: "bundle", id }) !== null).map((id) => {
              const b: { battle?: Partial<Record<ItemId, number>>; single?: Partial<Record<"revive" | "bomb", number>> } = BUNDLES[id];
              const parts = [
                ...Object.entries(b.battle ?? {}).map(([k, n]) => `${t(`item.name.${k}` as "item.name.bomb")}×${n}`),
                ...Object.entries(b.single ?? {}).map(([k, n]) => `${t(k === "revive" ? "item.revive" : "item.bomb")}×${n}`),
              ];
              const first = Object.keys(b.battle ?? {})[0] as ItemId;
              return (
                <li key={id} className="bundle">
                  <span className="inv-icon">
                    <ItemIcon id={first} size={28} />
                  </span>
                  <span className="inv-text">
                    <b>{t(`shop.bundle.${id}` as "shop.bundle.supply")}</b>
                    <small>{parts.join("、")}</small>
                  </span>
                  <span />
                  <AddButton p={{ kind: "bundle", id }} cart={api} />
                </li>
              );
            })}
          </ul>
          <div className="skins-label">{t("shop.singleItems")}</div>
          <ItemList player={player} cart={api} />
        </>
      )}

      {tab === "cart" && (
        <div className="cart">
          {!cart.length ? (
            <p className="mp-note">{t("shop.cartEmpty")}</p>
          ) : (
            <>
              <ul className="cart-list">
                {cart.map((l) => {
                  const unit = priceOf(l.p) ?? 0;
                  return (
                    <li key={`${l.p.kind}:${l.p.id}`}>
                      <span className="cart-name">{productName(t, l.p)}</span>
                      <span className="cart-qty">
                        {isCosmetic(l.p) ? (
                          "×1"
                        ) : (
                          <>
                            <button className="px-btn px-btn-sm" aria-label={t("shop.less")} onClick={() => onCart(setQty(cart, l.p, l.qty - 1))}>
                              −
                            </button>
                            <b>{l.qty}</b>
                            <button
                              className="px-btn px-btn-sm"
                              aria-label={t("shop.more")}
                              disabled={l.qty >= MAX_QTY}
                              onClick={() => onCart(setQty(cart, l.p, l.qty + 1))}
                            >
                              +
                            </button>
                          </>
                        )}
                      </span>
                      <span className="cart-sub">{formatMoney(unit * l.qty)}</span>
                      <button className="cart-remove" aria-label={t("shop.remove")} onClick={() => onCart(setQty(cart, l.p, 0))}>
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
              <p className="cart-total">
                {t("shop.total")} <b>{formatMoney(total)}</b>
              </p>
              <label className="cart-agree">
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span>{t("shop.agree")}</span>
              </label>
              {outOfRange && <p className="shop-warn">{t("shop.outOfRange", { min: formatMoney(cvs.min), max: formatMoney(cvs.max) })}</p>}
              {needLogin ? (
                <>
                  <p className="shop-warn">{t("shop.needLogin")}</p>
                  {/* 登入後回到商店的購物車 */}
                  <a className="px-btn px-btn-primary" href={`/?login=1&next=${encodeURIComponent("/play/blockblitz?shop=cart")}`}>
                    {t("shop.loginToPay")}
                  </a>
                </>
              ) : (
                <>
                  {user.kind === "member" && <p className="shop-buyer">{t("shop.buyerEmail", { email: user.email })}</p>}
                  <label className="mp-field shop-mobile">
                    <span>{t("shop.mobile")}</span>
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="0912345678"
                      maxLength={12}
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                    />
                  </label>
                  <p className="shop-buyer">{mobile && !mobileOk ? t("shop.badMobile") : t("shop.mobileHint")}</p>
                  <button className="px-btn px-btn-primary" disabled={!agree || !canPay || busy || outOfRange || !mobileOk} onClick={checkout}>
                    {t("shop.checkout", { total: formatMoney(total) })}
                  </button>
                </>
              )}
              {!paymentLive && <p className="mp-note">{t(canMockPay ? "shop.mockNote" : "shop.payClosed")}</p>}
            </>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="cart">
          {!orders.length ? (
            <p className="mp-note">{t("shop.ordersEmpty")}</p>
          ) : (
            <ul className="cart-list order-list">
              {orders.map((o) => (
                <li key={o.orderId}>
                  <span className="cart-name">
                    {o.lines.map((l) => `${productName(t, l.purchase)}×${l.qty}`).join("、")}
                    <small>
                      {t("shop.orderNo", { id: shortId(o.orderId) })}・{new Date(o.createdAt).toLocaleDateString()}
                    </small>
                  </span>
                  <span className={`order-status order-${o.status}`}>{t(`shop.status.${o.status}`)}</span>
                  <span className="cart-sub">{formatMoney(o.total)}</span>
                  {o.status === "pending" ? (
                    <button className="px-btn px-btn-sm" onClick={() => setOrder(o)}>
                      {t("shop.showCode")}
                    </button>
                  ) : (
                    <span />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button className="px-btn px-btn-ghost" onClick={onClose}>
        {t("inv.close")}
      </button>

      {order && (
        <div className="pay-modal" role="dialog" aria-modal="true" aria-label={t("shop.payTitle")}>
          <div className="pay-box">
            <p className="ov-title">{t("shop.payTitle")}</p>
            <p className="pay-order">{t("shop.orderNo", { id: shortId(order.orderId) })}</p>
            <div className="pay-code">
              <small>{t("shop.payCodeAt", { store: order.payment.store })}</small>
              <b>{formatCode(order.payment.code)}</b>
              {order.payment.mock && <em>{t("shop.mockCode")}</em>}
            </div>
            {order.payment.barcodeUrl && (
              <a className="px-btn px-btn-sm" href={order.payment.barcodeUrl} target="_blank" rel="noopener noreferrer">
                {t("shop.openBarcode")}
              </a>
            )}
            <p className="cart-total">
              {t("shop.payAmount")} <b>{formatMoney(order.total)}</b>
            </p>
            <p className="pay-deadline">{t("shop.payDeadline", { time: new Date(order.payment.expiresAt).toLocaleString() })}</p>
            <ol className="pay-steps">
              <li>{t("shop.payHow1", { store: order.payment.store })}</li>
              <li>{t("shop.payHow2")}</li>
              <li>{t("shop.payHow3")}</li>
            </ol>
            <button className="px-btn px-btn-primary" onClick={() => setOrder(null)}>
              {t("shop.payGotIt")}
            </button>
            {order.payment.provider === "ccat" && (
              <button className="px-btn px-btn-sm" disabled={busy} onClick={() => checkLive(order)}>
                {t("shop.checkPaid")}
              </button>
            )}
            {canMockPay && order.payment.mock && (
              <div className="pay-mock">
                <button className="px-btn px-btn-sm" onClick={() => mockPaid(order)}>
                  {t("shop.mockPaid")}
                </button>
                <button className="px-btn px-btn-sm px-btn-ghost" onClick={() => mockExpire(order)}>
                  {t("shop.mockExpire")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const shortId = (id: string) => id.replace(/-/g, "").slice(0, 10).toUpperCase();
/** 繳費代碼每 4 碼空一格，比較好抄 */
const formatCode = (code: string) => code.match(/.{1,4}/g)?.join(" ") ?? code;
