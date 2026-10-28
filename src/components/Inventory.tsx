"use client";

// 「我的道具」：看自己每種道具有幾個、領每日禮物；補貨到商店（購物車）。

import { useState } from "react";
import PixelIcon from "./PixelIcon";
import { ItemIcon } from "@/multiplayer/MatchUI";
import { ITEM_IDS, type ItemId } from "@/multiplayer/shared";
import { today, type PlayerData } from "@/game/storage";
import { useT } from "@/i18n";
import { AddButton, type CartApi } from "./Pickers";

type Tab = "battle" | "single";

/** 道具清單（我的道具、商店共用）：每種擁有幾個；在商店裡多一顆「加入購物車」 */
export function ItemList({ player, cart }: { player: PlayerData; cart?: CartApi }) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("battle");
  const itemName = (id: ItemId) => t(`item.name.${id}` as "item.name.bomb");
  return (
    <>
      <div className="inv-tabs" role="tablist">
        {(["battle", "single"] as Tab[]).map((k) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "inv-tab inv-tab-on" : "inv-tab"} onClick={() => setTab(k)}>
            {t(k === "battle" ? "inv.battle" : "inv.single")}
          </button>
        ))}
      </div>

      <ul className="inv-list">
        {tab === "battle"
          ? ITEM_IDS.map((id) => (
              <li key={id} className={(player.battleItems[id] ?? 0) > 0 ? "" : "inv-empty"}>
                <span className="inv-icon">
                  <ItemIcon id={id} size={28} />
                </span>
                <span className="inv-text">
                  <b>{itemName(id)}</b>
                  <small>{t(`item.desc.${id}` as "item.desc.bomb")}</small>
                </span>
                <span className="inv-count">{t("inv.owned", { n: player.battleItems[id] ?? 0 })}</span>
                {cart && <AddButton p={{ kind: "battle", id }} cart={cart} />}
              </li>
            ))
          : (
              [
                { key: "revive", icon: "heart", color: "#ff4d6d", light: "#ffd0d8", name: t("item.revive"), desc: t("inv.descRevive"), n: player.items.revive },
                { key: "bomb", icon: "bomb", color: "#8a8fff", light: "#ffd84a", name: t("item.bomb"), desc: t("inv.descBomb"), n: player.items.bomb },
              ] as const
            ).map((it) => (
              <li key={it.key} className={it.n > 0 ? "" : "inv-empty"}>
                <span className="inv-icon">
                  <PixelIcon name={it.icon} size={28} color={it.color} light={it.light} />
                </span>
                <span className="inv-text">
                  <b>{it.name}</b>
                  <small>{it.desc}</small>
                </span>
                <span className="inv-count">{t("inv.owned", { n: it.n })}</span>
                {cart && <AddButton p={{ kind: "single", id: it.key }} cart={cart} />}
              </li>
            ))}
      </ul>
    </>
  );
}

export default function Inventory({
  player,
  onClaimGift,
  onOpenShop,
  onClose,
}: {
  player: PlayerData;
  onOpenShop: () => void;
  /** 領每日禮物；回傳拿到的道具（今天領過回傳 null） */
  onClaimGift: () => ItemId[] | null | Promise<ItemId[] | null>;
  onClose: () => void;
}) {
  const t = useT();
  const [got, setGot] = useState<ItemId[] | null>(null);
  const claimed = player.dailyGift === today();
  const itemName = (id: ItemId) => t(`item.name.${id}` as "item.name.bomb");

  return (
    <div className="overlay overlay-scroll inv" onPointerDown={(e) => e.stopPropagation()}>
      <p className="ov-title">{t("inv.title")}</p>

      <div className="inv-gift">
        <button
          className="px-btn px-btn-primary"
          disabled={claimed}
          onClick={async () => {
            try {
              const gifts = await onClaimGift();
              if (gifts) setGot(gifts);
            } catch (e) {
              console.error("[inventory] 領每日禮物失敗", e);
            }
          }}
        >
          {t("inv.gift")}
        </button>
        {got ? (
          <p className="inv-got">{t("inv.giftGot", { items: got.map(itemName).join("、") })}</p>
        ) : (
          claimed && <p className="mp-note">{t("inv.giftDone")}</p>
        )}
      </div>

      <ItemList player={player} />

      <button className="px-btn px-btn-shop" onClick={onOpenShop}>
        <PixelIcon name="cart" size={14} color="#ffd84a" light="#fff" /> {t("inv.toShop")}
      </button>

      <button className="px-btn px-btn-ghost" onClick={onClose}>
        {t("inv.close")}
      </button>
    </div>
  );
}
