// 對外 API 的基本防濫用（⏳ 會員上伺服器後改成「依登入帳號」限制，並從登入 session 取得 Email）。

/** 只接受從自己網站發出的請求（瀏覽器會帶 Origin；不同網域或沒帶的一律拒絕） */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** 每個來源 IP 在時間窗內最多幾次（存在記憶體：同一個伺服器執行個體內有效，盡力而為） */
export function rateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (request: Request, now = Date.now()): boolean => {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const recent = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(ip, recent);
      return false;
    }
    recent.push(now);
    hits.set(ip, recent);
    if (hits.size > 10_000) hits.clear(); // 避免記憶體無限長大
    return true;
  };
}
