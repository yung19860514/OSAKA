"use client";

// 外觀挑選區（背景場景 / 吉祥物 / 方塊造型）＋購買按鈕。
// 設定畫面與商店共用：點已擁有的 = 換上；點上鎖的 = 預覽；在商店裡按價格鈕加入購物車。

import { useEffect, useRef, useState } from "react";
import PixelIcon from "./PixelIcon";
import { PetCanvas } from "./Mascot";
import { COLS } from "@/game/engine";
import { PETS, getPet } from "@/game/pets";
import { Px, SCENES, getScene } from "@/game/scenes";
import { drawBlock } from "@/game/render";
import { SKINS, getSkin } from "@/game/skins";
import { formatMoney, isCosmetic, priceOf, type Purchase } from "@/game/shop";
import type { PlayerData } from "@/game/storage";
import { useT } from "@/i18n";

/** 購物車操作（商店才有；設定畫面不給就只顯示價格） */
export interface CartApi {
  qty: (p: Purchase) => number;
  add: (p: Purchase) => void;
}

/** 價格鈕＝加入購物車。外觀放一份就顯示「已在購物車」；道具可以一直加 */
export function AddButton({ p, cart }: { p: Purchase; cart: CartApi }) {
  const t = useT();
  const price = priceOf(p);
  if (price === null) return null;
  const n = cart.qty(p);
  const cosmetic = isCosmetic(p);
  return (
    <button
      className={`buy-btn ${n ? "buy-in-cart" : ""}`}
      disabled={cosmetic && n > 0}
      title={t("shop.add")}
      onClick={(e) => {
        e.stopPropagation();
        cart.add(p);
      }}
    >
      {cosmetic && n ? (
        t("shop.inCart")
      ) : (
        <>
          <PixelIcon name="cart" size={12} color="#ffd84a" light="#fff" /> {formatMoney(price)}
          {n > 0 && <b className="buy-n">×{n}</b>}
        </>
      )}
    </button>
  );
}

/** 預覽中的品項說明列：已擁有/使用中，或價格＋加入購物車 */
function Caption({ owned, inUse, name, p, cart }: { owned: boolean; inUse: boolean; name: string; p: Purchase; cart?: CartApi }) {
  const t = useT();
  if (owned) return <p className="skin-caption">{inUse ? t("shop.inUse", { name }) : t("shop.owned", { name })}</p>;
  const price = priceOf(p);
  if (!cart || price === null)
    return <p className="skin-caption">{price === null ? name : t("shop.locked", { name, price: formatMoney(price) })}</p>;
  return (
    <div className="skin-caption buy-row">
      <span>{name}</span>
      <AddButton p={p} cart={cart} />
    </div>
  );
}

/** 縮圖上的小價格 */
function PriceTag({ p }: { p: Purchase }) {
  const price = priceOf(p);
  return price === null ? null : <span className="skin-price">{formatMoney(price)}</span>;
}

// 背景場景區：點了整個遊戲背景就換成那個場景預覽；已擁有的直接換上
export function ScenePicker({
  player,
  previewId,
  onPreview,
  onPick,
  cart,
}: {
  player: PlayerData;
  previewId: string;
  onPreview: (id: string) => void;
  onPick: (id: string) => void;
  cart?: CartApi;
}) {
  const t = useT();
  const preview = getScene(previewId);
  const owned = player.ownedScenes.includes(preview.id);
  const nm = (id: string) => t(`scene.${id}` as "scene.space");
  return (
    <div className="skins">
      <div className="skins-label">{t("shop.scenes")}</div>
      <Caption owned={owned} inUse={player.sceneId === preview.id} name={nm(preview.id)} p={{ kind: "scene", id: preview.id }} cart={cart} />
      <div className="scenes-row">
        {SCENES.map((sc) => {
          const has = player.ownedScenes.includes(sc.id);
          return (
            <button
              key={sc.id}
              className={`skin ${player.sceneId === sc.id ? "skin-active" : ""} ${previewId === sc.id ? "skin-previewing" : ""}`}
              onClick={() => {
                onPreview(sc.id);
                if (has) onPick(sc.id);
              }}
              title={has ? nm(sc.id) : t("shop.lockedHint", { name: nm(sc.id) })}
            >
              <SceneThumb id={sc.id} />
              <span className="skin-name">
                {!has && <PixelIcon name="lock" size={10} color="#9aa0c0" light="#ffd84a" />} {nm(sc.id)}
              </span>
              {!has && <PriceTag p={{ kind: "scene", id: sc.id }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** 場景縮圖：畫一張 320×180 的靜態畫面 */
function SceneThumb({ id }: { id: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const scene = getScene(id);
    const g = new Px(ctx, 320, 180);
    scene.draw(g, 1000, 0, scene.init(320, 180) as never);
  }, [id]);
  return <canvas ref={ref} width={320} height={180} className="scene-thumb" aria-hidden="true" />;
}

// 吉祥物區：點已擁有的 = 換上；點上鎖的 = 預覽
export function PetPicker({ player, onPick, cart }: { player: PlayerData; onPick: (id: string) => void; cart?: CartApi }) {
  const t = useT();
  const [previewId, setPreviewId] = useState(player.petId);
  const preview = getPet(previewId);
  const owned = player.ownedPets.includes(preview.id);
  const nm = (id: string) => t(`pet.${id}` as "pet.cat");
  return (
    <div className="skins">
      <div className="skins-label">{t("shop.pets")}</div>
      <div className="pet-preview">
        <PetCanvas pet={preview} mood="happy" className="pet-preview-canvas" />
      </div>
      <Caption owned={owned} inUse={player.petId === preview.id} name={nm(preview.id)} p={{ kind: "pet", id: preview.id }} cart={cart} />
      <div className="pets-row">
        {PETS.map((pt) => {
          const has = player.ownedPets.includes(pt.id);
          return (
            <button
              key={pt.id}
              className={`pet-btn ${player.petId === pt.id ? "skin-active" : ""} ${previewId === pt.id ? "skin-previewing" : ""}`}
              onClick={() => {
                setPreviewId(pt.id);
                if (has) onPick(pt.id);
              }}
              title={has ? nm(pt.id) : t("shop.lockedHint", { name: nm(pt.id) })}
            >
              <PetCanvas pet={pt} mood="idle" className="pet-thumb" />
              <span className="skin-name">
                {!has && <PixelIcon name="lock" size={10} color="#9aa0c0" light="#ffd84a" />} {nm(pt.id)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 造型區：點已擁有的 = 換上；點上鎖的 = 預覽
export function SkinPicker({ player, onPick, cart }: { player: PlayerData; onPick: (id: string) => void; cart?: CartApi }) {
  const t = useT();
  const nm = (id: string) => t(`skin.${id}` as "skin.arcade");
  const [previewId, setPreviewId] = useState(player.skinId);
  const preview = getSkin(previewId);
  const previewOwned = player.ownedSkins.includes(preview.id);
  return (
    <div className="skins">
      <div className="skins-label">{t("shop.skins")}</div>
      <SkinPreview skin={preview} />
      <Caption owned={previewOwned} inUse={player.skinId === preview.id} name={nm(preview.id)} p={{ kind: "skin", id: preview.id }} cart={cart} />
      <div className="skins-row">
        {SKINS.map((s) => {
          const owned = player.ownedSkins.includes(s.id);
          const active = player.skinId === s.id;
          return (
            <button
              key={s.id}
              className={`skin ${active ? "skin-active" : ""} ${!owned ? "skin-locked" : ""} ${previewId === s.id ? "skin-previewing" : ""}`}
              onClick={() => {
                setPreviewId(s.id);
                if (owned) onPick(s.id);
              }}
              title={owned ? nm(s.id) : t("shop.lockedHint", { name: nm(s.id) })}
            >
              <span className="skin-swatch" style={{ background: s.boardBg }}>
                {(["T", "I", "Z", "L"] as const).map((t) => (
                  <i key={t} style={{ background: s.colors[t] }} />
                ))}
              </span>
              <span className="skin-name">
                {!owned && <PixelIcon name="lock" size={10} color="#9aa0c0" light="#ffd84a" />} {nm(s.id)}
              </span>
              {!owned && <PriceTag p={{ kind: "skin", id: s.id }} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 示範盤面：用指定造型畫一小塊堆疊，讓玩家買之前看得到效果
const PREVIEW_ROWS = [
  "..........",
  "....T.....",
  "...TTT....",
  "I.....OO.L",
  "I.ZZ..OOLL",
  "I..ZZSS.JL",
  "IJJJSSGGJJ",
];
function SkinPreview({ skin }: { skin: ReturnType<typeof getSkin> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = rect.width / COLS;
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, rect.width, rect.height);
    PREVIEW_ROWS.forEach((row, y) =>
      [...row].forEach((ch, x) => {
        if (ch === ".") return;
        drawBlock(ctx, x * cell, y * cell, cell, skin.colors[ch as keyof typeof skin.colors], skin);
      }),
    );
  }, [skin]);
  const t = useT();
  return (
    <canvas
      ref={ref}
      className="skin-preview"
      aria-label={t("shop.skinPreview", { name: t(`skin.${skin.id}` as "skin.arcade") })}
    />
  );
}
