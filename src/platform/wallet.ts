// 玩家錢包（瀏覽器端）：會員的道具以伺服器為準，這裡負責讀取與送出「使用道具」「領每日禮物」。
// 訪客（沒登入）不走這裡，道具只存在瀏覽器。

import { normalizeWallet, type UseRequest, type Wallet } from "@/game/wallet";
import type { ItemId as BattleItemId } from "@/multiplayer/shared";
import { authHeaders } from "./supabaseClient";

const url = (gameId: string) => `/api/games/${encodeURIComponent(gameId)}/wallet`;

export async function fetchWallet(gameId: string): Promise<Wallet> {
  const res = await fetch(url(gameId), { cache: "no-store", headers: await authHeaders() });
  if (!res.ok) throw new Error(`wallet_${res.status}`);
  return normalizeWallet(((await res.json()) as { wallet?: unknown }).wallet);
}

async function post(gameId: string, body: unknown): Promise<{ status: number; wallet?: Wallet; gifts?: BattleItemId[] }> {
  const res = await fetch(url(gameId), { method: "POST", headers: { "content-type": "application/json", ...(await authHeaders()) }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as { wallet?: unknown; gifts?: BattleItemId[] };
  return { status: res.status, wallet: data.wallet ? normalizeWallet(data.wallet) : undefined, gifts: data.gifts };
}

/** 使用道具：回傳伺服器上最新的錢包（數量不夠時伺服器拒絕，也會回傳目前的錢包讓畫面對齊） */
export async function spendItems(gameId: string, uses: UseRequest[]): Promise<{ ok: boolean; wallet?: Wallet }> {
  const r = await post(gameId, { action: "use", uses });
  return { ok: r.status === 200, wallet: r.wallet };
}

/** 領每日禮物：今天領過＝gifts 為 null */
export async function claimDailyRemote(gameId: string): Promise<{ gifts: BattleItemId[] | null; wallet?: Wallet }> {
  const r = await post(gameId, { action: "daily" });
  if (r.status !== 200 && r.status !== 409) throw new Error(`daily_${r.status}`);
  return { gifts: r.status === 200 ? (r.gifts ?? []) : null, wallet: r.wallet };
}
