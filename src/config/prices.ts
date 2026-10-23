// 各地區售價表（商品編號 → 價格，幣別依地區）。
// ⏳ 台灣價格為暫定（外觀 NT$300、對戰道具 NT$20~50、單人道具 NT$30~60、組合包），待老闆拍板。
// 平台新增遊戲時，在這裡加上該遊戲的商品即可（編號前綴＝遊戲代號）。

import { ITEMS, ITEM_IDS } from "@/multiplayer/shared";
import { PETS } from "@/game/pets";
import { SCENES } from "@/game/scenes";
import { SKINS } from "@/game/skins";
import mjys from "./catalogs/mjys.json";
import sanguo from "./catalogs/sanguo.json";
import xiantu from "./catalogs/xiantu.json";

/** 合作遊戲提供的商品清單（串接規格第 7 章）→ 台灣售價先用建議價（⏳ 平台與遊戲方議定後改） */
const fromCatalog = (c: { products: { sku: string; suggestedPrice?: { TWD?: number } }[] }) =>
  Object.fromEntries(c.products.filter((p) => p.suggestedPrice?.TWD).map((p) => [p.sku, p.suggestedPrice!.TWD!]));

const paid = <T extends { id: string; price: number }>(list: T[], kind: string) =>
  Object.fromEntries(list.filter((x) => x.price > 0).map((x) => [`blockblitz:${kind}:${x.id}`, x.price]));

export const PRICES_TWD: Record<string, number> = {
  ...paid(SKINS, "skin"),
  ...paid(SCENES, "scene"),
  ...paid(PETS, "pet"),
  ...Object.fromEntries(ITEM_IDS.map((id) => [`blockblitz:battle:${id}`, ITEMS[id].price])),
  "blockblitz:single:revive": 60,
  "blockblitz:single:bomb": 30,
  // 組合包：比分開買便宜約 2~3 成
  "blockblitz:bundle:supply": 349,
  "blockblitz:bundle:rookie": 599,
  ...fromCatalog(mjys),
  ...fromCatalog(xiantu),
  ...fromCatalog(sanguo),
};
