import { describe, expect, it } from "vitest";
import { rateLimiter, sameOrigin } from "./guard";

const req = (h: Record<string, string>) => new Request("https://play.example.com/api/orders", { method: "POST", headers: h });

describe("防濫用", () => {
  it("只接受自己網站來的請求", () => {
    expect(sameOrigin(req({ origin: "https://play.example.com", host: "play.example.com" }))).toBe(true);
    expect(sameOrigin(req({ origin: "https://evil.example", host: "play.example.com" }))).toBe(false);
    expect(sameOrigin(req({ host: "play.example.com" }))).toBe(false);
  });
  it("同一個 IP 超過次數就擋，時間過了再放行", () => {
    const limit = rateLimiter(2, 1000);
    const r = req({ "x-forwarded-for": "1.2.3.4" });
    expect(limit(r, 0)).toBe(true);
    expect(limit(r, 10)).toBe(true);
    expect(limit(r, 20)).toBe(false);
    expect(limit(req({ "x-forwarded-for": "5.6.7.8" }), 20)).toBe(true);
    expect(limit(r, 1500)).toBe(true);
  });
});
