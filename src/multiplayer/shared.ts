// 多人對戰：伺服器與遊戲端共用的規則與訊息格式（兩邊 import 同一份，避免不一致）

import type { Placement } from "../game/engine";

export type MatchMode = "classic" | "items";
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
/** 道具賽：每場最多帶入的付費出戰道具數（老闆拍板 2026-10-03） */
export const MAX_LOADOUT = 2;
/** 對戰中最多同時持有的道具數 */
export const MAX_HELD_ITEMS = 3;
/** 道具賽：每累計消 N 行，伺服器隨機給一個道具 */
export const LINES_PER_ITEM = 2;
export const COUNTDOWN_MS = 3000;

// ---------- 攻擊表（送給對手的垃圾行數） ----------
const LINE_ATTACK = [0, 0, 1, 2, 4];
const TSPIN_ATTACK = [0, 2, 4, 6];
const COMBO_ATTACK = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4, 5];

export interface ClearInfo {
  lines: number;
  tspin: boolean;
  b2b: boolean;
  combo: number;
  perfect: boolean;
}

export function attackFor(c: ClearInfo): number {
  if (c.lines <= 0) return 0;
  let a = c.tspin ? TSPIN_ATTACK[Math.min(3, c.lines)] : LINE_ATTACK[Math.min(4, c.lines)];
  if (c.b2b) a += 1;
  a += COMBO_ATTACK[Math.min(COMBO_ATTACK.length - 1, Math.max(0, c.combo))];
  if (c.perfect) a += 10;
  return a;
}

// ---------- 道具 ----------
export type ItemId =
  | "bomb"
  | "shield"
  | "cleanse"
  | "longbar"
  | "rain"
  | "ink"
  | "speed"
  | "mirror"
  | "freeze"
  | "steal";

export type ItemKind = "self" | "attack";

export interface ItemDef {
  id: ItemId;
  kind: ItemKind;
  /** 干擾類的持續時間 */
  durationMs?: number;
  /** 未來商店售價（遊戲幣） */
  price: number;
  /** 對戰中撿到的機率權重 */
  weight: number;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  bomb: { id: "bomb", kind: "self", price: 30, weight: 12 },
  shield: { id: "shield", kind: "self", price: 40, weight: 10 },
  cleanse: { id: "cleanse", kind: "self", price: 50, weight: 6 },
  longbar: { id: "longbar", kind: "self", price: 20, weight: 12 },
  rain: { id: "rain", kind: "attack", price: 40, weight: 12 },
  ink: { id: "ink", kind: "attack", durationMs: 3000, price: 30, weight: 10 },
  speed: { id: "speed", kind: "attack", durationMs: 5000, price: 30, weight: 10 },
  mirror: { id: "mirror", kind: "attack", durationMs: 5000, price: 30, weight: 8 },
  freeze: { id: "freeze", kind: "attack", durationMs: 8000, price: 20, weight: 8 },
  steal: { id: "steal", kind: "attack", price: 50, weight: 5 },
};
export const ITEM_IDS = Object.keys(ITEMS) as ItemId[];
export const RAIN_LINES = 3;

/** 依權重隨機抽一個道具 */
export function rollItem(rand: () => number): ItemId {
  const total = ITEM_IDS.reduce((s, id) => s + ITEMS[id].weight, 0);
  let r = rand() * total;
  for (const id of ITEM_IDS) {
    r -= ITEMS[id].weight;
    if (r < 0) return id;
  }
  return "bomb";
}

// ---------- 盤面壓縮（給對手看的小盤面） ----------
/** 可視 20 列 × 10 欄 → 200 字元字串；"." 空格 */
export type BoardCode = string;

// ---------- 訊息格式 ----------
export interface PublicPlayer {
  id: string;
  name: string;
  petId: string;
  skinId: string;
  host: boolean;
  alive: boolean;
  /** 名次（被淘汰時決定；1 = 冠軍） */
  place: number | null;
  /** 已選的出戰道具數（道具賽） */
  loadout: number;
}

export type RoomState = "lobby" | "countdown" | "playing" | "ended";

export type ClientMsg =
  | { t: "hello"; name: string; petId: string; skinId: string }
  | { t: "create"; mode: MatchMode }
  | { t: "join"; code: string }
  | { t: "leave" }
  | { t: "loadout"; items: ItemId[] }
  | { t: "start" }
  /** 放下一顆方塊：只回報落點，消行與攻擊由伺服器用同一套引擎重算 */
  | { t: "lock"; p: Placement }
  | { t: "useItem"; item: ItemId }
  | { t: "dead" };

export type ServerMsg =
  | { t: "welcome"; id: string }
  | {
      t: "error";
      /** disconnected 由遊戲端自己產生（連線中斷），伺服器不會送 */
      code: "room_not_found" | "room_full" | "in_progress" | "not_host" | "need_players" | "bad_request" | "disconnected";
    }
  | { t: "room"; code: string; mode: MatchMode; state: RoomState; players: PublicPlayer[] }
  | { t: "countdown"; seed: number; ms: number }
  | { t: "go" }
  /** 送進你盤面的垃圾（已扣掉抵銷與護盾；hole＝缺口欄位；seq＝盤面變動序號，套用後記下、回報落點時附上） */
  | { t: "garbage"; lines: number; from: string; hole: number; seq: number }
  /** 你目前排隊中、下一次沒消行時會進來的垃圾量（顯示警示條） */
  | { t: "pending"; lines: number }
  | { t: "opponent"; id: string; board: BoardCode }
  | { t: "items"; held: ItemId[] }
  /** 對你生效的干擾；或你自己的增益（shield） */
  | { t: "effect"; item: ItemId; from: string; ms?: number; seq?: number }
  /** 戰報：誰對誰用了什麼（全房廣播，用來顯示提示） */
  | { t: "itemUsed"; item: ItemId; from: string; to: string | null }
  | { t: "playerOut"; id: string; place: number }
  /** 結束：排名附上名字與吉祥物，玩家離開房間後結果畫面仍看得到 */
  | { t: "end"; ranking: RankEntry[] };

export interface RankEntry {
  id: string;
  place: number;
  name: string;
  petId: string;
}
