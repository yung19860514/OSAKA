import { beforeEach, describe, expect, it } from "vitest";

// 測試環境沒有瀏覽器：自己準備 localStorage 與 window 事件
const store = new Map<string, string>();
Object.assign(globalThis, {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  },
  window: Object.assign(new EventTarget(), { matchMedia: () => ({ matches: false }) }),
});

const { auth, ensureGameAccount, gameAccounts } = await import("./auth");
const { loadPlayer, savePlayer } = await import("@/game/storage");

beforeEach(async () => {
  store.clear();
  await auth.signOut();
});

describe("模擬會員系統", () => {
  it("註冊只要 Email＋密碼，註冊完自動登入，暱稱取 Email @ 前面", async () => {
    const r = await auth.signUp({ email: "  Player.One@Example.com ", password: "abc12345" });
    expect(r.ok).toBe(true);
    const u = auth.currentUser();
    expect(u.kind).toBe("member");
    if (u.kind !== "member") return;
    expect(u.email).toBe("player.one@example.com");
    expect(u.name).toBe("player.one");
  });

  it("密碼不存明碼", async () => {
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    expect([...store.values()].join()).not.toContain("abc12345");
  });

  it("擋掉：Email 格式錯、密碼太弱、Email 重複註冊", async () => {
    expect(await auth.signUp({ email: "not-an-email", password: "abc12345" })).toEqual({ ok: false, error: "bad_email" });
    expect(await auth.signUp({ email: "a@b.co", password: "12345678" })).toEqual({ ok: false, error: "weak_password" });
    expect(await auth.signUp({ email: "a@b.co", password: "short1" })).toEqual({ ok: false, error: "weak_password" });
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    await auth.signOut();
    expect(await auth.signUp({ email: "A@B.CO", password: "abc12345" })).toEqual({ ok: false, error: "email_taken" });
  });

  it("登入／登出；密碼錯誤或帳號不存在都只說「Email 或密碼不正確」", async () => {
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    await auth.signOut();
    expect(auth.currentUser().kind).toBe("guest");
    expect(await auth.signIn({ email: "a@b.co", password: "wrong999" })).toEqual({ ok: false, error: "bad_credentials" });
    expect(await auth.signIn({ email: "nobody@b.co", password: "abc12345" })).toEqual({ ok: false, error: "bad_credentials" });
    expect((await auth.signIn({ email: "A@b.co", password: "abc12345" })).ok).toBe(true);
    expect(auth.currentUser().kind).toBe("member");
  });

  it("訪客玩到一半才註冊：進度帶到新帳號", async () => {
    const guest = loadPlayer();
    savePlayer({ ...guest, highScore: 9999 });
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    expect(loadPlayer().highScore).toBe(9999);
  });

  it("不同帳號的遊戲資料與遊戲帳號各自分開", async () => {
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    savePlayer({ ...loadPlayer(), highScore: 111 });
    ensureGameAccount("blockblitz");
    await auth.signOut();
    await auth.signUp({ email: "c@d.co", password: "abc12345" });
    expect(loadPlayer().highScore).toBe(0);
    expect(gameAccounts()).toEqual({});
    await auth.signOut();
    await auth.signIn({ email: "a@b.co", password: "abc12345" });
    expect(loadPlayer().highScore).toBe(111);
    expect(Object.keys(gameAccounts())).toEqual(["blockblitz"]);
  });

  it("合作遊戲（存檔位置寫死）：切換帳號時平台自動換存檔，登出後看不到會員的資料", async () => {
    localStorage.setItem("mjys_save", "guest-progress");
    await auth.signUp({ email: "a@b.co", password: "abc12345" }); // 訪客註冊 → 沿用訪客進度
    expect(localStorage.getItem("mjys_save")).toBe("guest-progress");
    localStorage.setItem("mjys_save", "member-A"); // 會員 A 繼續玩
    await auth.signOut();
    expect(localStorage.getItem("mjys_save")).toBe("guest-progress"); // 登出 → 回到訪客的存檔
    await auth.signUp({ email: "c@d.co", password: "abc12345" });
    localStorage.setItem("mjys_save", "member-C");
    await auth.signOut();
    await auth.signIn({ email: "a@b.co", password: "abc12345" });
    expect(localStorage.getItem("mjys_save")).toBe("member-A"); // 登回 A → A 的存檔
    await auth.signOut();
    await auth.signIn({ email: "c@d.co", password: "abc12345" });
    expect(localStorage.getItem("mjys_save")).toBe("member-C");
  });

  it("合作遊戲（存檔拆成多個同開頭的 key）：切換帳號時整組一起換", async () => {
    localStorage.setItem("xtwd_player", "guest-p");
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    localStorage.setItem("xtwd_player", "A-p");
    localStorage.setItem("xtwd_bag", "A-bag");
    await auth.signOut();
    expect(localStorage.getItem("xtwd_player")).toBe("guest-p");
    expect(localStorage.getItem("xtwd_bag")).toBeNull();
    await auth.signIn({ email: "a@b.co", password: "abc12345" });
    expect(localStorage.getItem("xtwd_player")).toBe("A-p");
    expect(localStorage.getItem("xtwd_bag")).toBe("A-bag");
  });

  it("改暱稱、改密碼（要舊密碼）", async () => {
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    expect((await auth.updateProfile({ name: "阿明" })).ok).toBe(true);
    expect(auth.currentUser().name).toBe("阿明");
    expect(await auth.updateProfile({ name: "   " })).toEqual({ ok: false, error: "bad_name" });
    expect(await auth.changePassword("wrong999", "new12345")).toEqual({ ok: false, error: "bad_credentials" });
    expect((await auth.changePassword("abc12345", "new12345")).ok).toBe(true);
    await auth.signOut();
    expect((await auth.signIn({ email: "a@b.co", password: "new12345" })).ok).toBe(true);
  });

  it("刪除帳號：要輸入密碼，刪除後該帳號的遊戲資料一起清掉、不能再登入", async () => {
    await auth.signUp({ email: "a@b.co", password: "abc12345" });
    savePlayer({ ...loadPlayer(), highScore: 500 });
    expect(await auth.deleteAccount("wrong999")).toEqual({ ok: false, error: "bad_credentials" });
    expect((await auth.deleteAccount("abc12345")).ok).toBe(true);
    expect(auth.currentUser().kind).toBe("guest");
    expect([...store.keys()].some((k) => k.startsWith("blockblitz.player.v1:"))).toBe(false);
    expect((await auth.signIn({ email: "a@b.co", password: "abc12345" })).ok).toBe(false);
  });
});
