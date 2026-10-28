import { describe, expect, it } from "vitest";
import { sign, verifySignature } from "./agents";
import { newRecordNo } from "./orders";

const env = { AGENT_SECRET_AGENT_HK: "s3cret-key" };
const headersFor = (id: string, ts: string, sig: string) => new Headers({ "x-agent-id": id, "x-agent-timestamp": ts, "x-agent-signature": sig });

describe("代理站簽章", () => {
  const now = 1_792_750_530_000;
  const ts = String(now / 1000);
  const body = '{"agentOrderId":"HK1"}';

  it("簽章正確＋時間在 5 分鐘內才通過", () => {
    expect(verifySignature(headersFor("agent_hk", ts, sign("s3cret-key", ts, body)), body, now, env)).toBe("agent_hk");
  });
  it("內容被改、金鑰不對、時間過期、沒設金鑰的代理站都拒絕", () => {
    const good = sign("s3cret-key", ts, body);
    expect(verifySignature(headersFor("agent_hk", ts, good), body.replace("HK1", "HK2"), now, env)).toBeNull();
    expect(verifySignature(headersFor("agent_hk", ts, sign("wrong", ts, body)), body, now, env)).toBeNull();
    expect(verifySignature(headersFor("agent_hk", ts, good), body, now + 301_000, env)).toBeNull();
    expect(verifySignature(headersFor("agent_tw", ts, good), body, now, env)).toBeNull();
    expect(verifySignature(headersFor("agent_hk", ts, "v1=xyz"), body, now, env)).toBeNull();
  });
  it("紀錄編號格式", () => {
    expect(newRecordNo(new Date("2026-10-23T02:15:30Z"))).toMatch(/^A261023101530[A-Z2-9]{12}$/);
  });
});
