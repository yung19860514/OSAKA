// 玩家錢包（擁有的外觀、道具數量）。以伺服器為準，玩家只能透過這裡「使用道具」「領每日禮物」，
// 增加道具只會發生在付款到帳（伺服器自動發貨）。
// GET：讀取（第一次會建立新帳號錢包）
// POST { action: "use", uses: [{ kind: "item"|"battle", id, qty }] }：使用道具（不夠就 409，回傳目前錢包）
// POST { action: "daily" }：領每日禮物（今天領過就 409）

import { claimDaily, consumeItems, type UseRequest } from "@/game/wallet";
import { db, userFromRequest } from "@/server/supabase";
import { getWallet, mutateWallet, WALLET_GAMES } from "@/server/wallet";
import { rateLimiter } from "@/server/guard";

const noStore = { "cache-control": "no-store" };
/** 每個會員每分鐘最多 60 次修改（正常玩不會碰到） */
const limit = rateLimiter(60, 60_000);

async function context(request: Request, params: Promise<{ gameId: string }>) {
  const { gameId } = await params;
  if (!WALLET_GAMES.has(gameId)) return { error: Response.json({ error: "unknown_game" }, { status: 404 }) };
  const sb = db();
  if (!sb) return { error: Response.json({ error: "not_configured" }, { status: 503 }) };
  const user = await userFromRequest(request);
  if (!user) return { error: Response.json({ error: "login_required" }, { status: 401 }) };
  return { sb, user, gameId };
}

export async function GET(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const c = await context(request, params);
  if ("error" in c) return c.error;
  try {
    return Response.json({ wallet: await getWallet(c.sb, c.user.id, c.gameId) }, { headers: noStore });
  } catch (e) {
    console.error("[wallet] 讀取失敗", c.user.id, e, (e as { cause?: unknown }).cause);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ gameId: string }> }) {
  const c = await context(request, params);
  if ("error" in c) return c.error;
  if (!limit(request, Date.now(), c.user.id)) return Response.json({ error: "too_many_requests" }, { status: 429 });
  const body = (await request.json().catch(() => ({}))) as { action?: string; uses?: unknown };
  try {
    if (body.action === "use") {
      if (!Array.isArray(body.uses) || body.uses.length < 1 || body.uses.length > 10) return Response.json({ error: "bad_uses" }, { status: 400 });
      const uses = body.uses as UseRequest[];
      const r = await mutateWallet(c.sb, c.user.id, c.gameId, (w) => consumeItems(w, uses));
      return Response.json({ wallet: r.wallet }, { status: r.changed ? 200 : 409, headers: noStore });
    }
    if (body.action === "daily") {
      let gifts: string[] = [];
      const r = await mutateWallet(c.sb, c.user.id, c.gameId, (w) => {
        const d = claimDaily(w);
        gifts = d?.gifts ?? [];
        return d?.next ?? null;
      });
      return Response.json({ wallet: r.wallet, gifts: r.changed ? gifts : [] }, { status: r.changed ? 200 : 409, headers: noStore });
    }
    return Response.json({ error: "bad_action" }, { status: 400 });
  } catch (e) {
    console.error("[wallet] 修改失敗", c.user.id, body.action, e, (e as { cause?: unknown }).cause);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
