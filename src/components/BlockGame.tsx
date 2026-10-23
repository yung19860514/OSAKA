"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ACTIONS, buildKeyMap, keyLabel, normKey, DEFAULT_KEYS, type Action } from "@/game/controls";
import { Effects } from "@/game/effects";
import { PixelFire } from "@/game/fire";
import { COLS, Game, NEXT_COUNT, VISIBLE_ROWS, type ClearEvent } from "@/game/engine";
import { Sound } from "@/game/sound";
import type { PieceType } from "@/game/pieces";
import PixelIcon from "./PixelIcon";
import Starfield from "./Starfield";
import Mascot from "./Mascot";
import { getPet } from "@/game/pets";
import type { Mood } from "@/game/mascot";
import { I18nContext, LOCALES, makeT, useT, type Locale, type TFunc } from "@/i18n";
import { drawBoard, drawMini } from "@/game/render";
import { getSkin } from "@/game/skins";
import { claimDailyGift, loadPlayer, savePlayer, type PlayerData } from "@/game/storage";
import Inventory from "./Inventory";
import Shop from "./Shop";
import { PetPicker, ScenePicker, SkinPicker } from "./Pickers";
import { deliver, type Cart, type CheckoutResult } from "@/game/shop";
import { setPlatformLocale } from "@/platform/prefs";
import { auth } from "@/platform/auth";
import { useUser } from "@/platform/useUser";
import { useMatch } from "@/multiplayer/useMatch";
import { GarbageMeter, ItemSlots, LobbyOverlay, OpponentBoards, ResultOverlay, RoomOverlay } from "@/multiplayer/MatchUI";
import type { ItemId, ServerMsg } from "@/multiplayer/shared";

/** countdown/spectate/result 只用於多人對戰 */
type Phase = "title" | "playing" | "paused" | "over" | "countdown" | "spectate" | "result";

// 按住左右的自動重複：DAS 延遲多久開始連移、ARR 連移間隔
const DAS_MS = 160;
const ARR_MS = 45;
const MAX_START_LEVEL = 15;

interface Hud {
  score: number;
  lines: number;
  level: number;
  hold: PieceType | null;
  canHold: boolean;
  queue: PieceType[];
}

const EMPTY_HUD: Hud = { score: 0, lines: 0, level: 1, hold: null, canHold: true, queue: [] };

function clearLabel(e: ClearEvent, t: TFunc): string[] {
  const out: string[] = [];
  const name = e.lines ? t(`clear.${e.lines}` as "clear.1") : "";
  if (e.tspin) out.push(e.lines ? t("clear.tspinLines", { name }) : t("clear.tspin"));
  else if (e.lines) out.push(name);
  if (e.b2b) out.push(t("clear.b2b"));
  if (e.combo > 0) out.push(t("clear.combo", { n: e.combo }));
  if (e.perfect) out.push(t("clear.perfect"));
  return out;
}

export default function BlockGame() {
  // 此元件只在瀏覽器端渲染（見 GameShell），可直接讀 localStorage
  const [player, setPlayer] = useState<PlayerData>(loadPlayer);
  const [phase, setPhase] = useState<Phase>("title");
  const t = useMemo(() => makeT(player.locale), [player.locale]);
  const tRef = useRef(t);
  const kl = (k: string) => keyLabel(k, t("key.space"));
  const [hud, setHud] = useState<Hud>(EMPTY_HUD);
  const [toast, setToast] = useState<{ id: number; text: string[]; points: number; big: boolean } | null>(null);
  const [newRecord, setNewRecord] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [binding, setBinding] = useState<Action | null>(null);
  /** 設定裡正在預覽的場景（關掉設定就恢復成自己的場景） */
  const [previewScene, setPreviewScene] = useState<string | null>(null);
  const [mood, setMood] = useState<{ m: Mood; kick: number }>({ m: "idle", kick: 0 });
  const [danger, setDanger] = useState(false);
  const [banner, setBanner] = useState<{ id: number; title: string; sub?: string } | null>(null);
  /** 升級橫幅要等消行大字播完才出現（不同時擠在畫面上） */
  const pendingBannerRef = useRef<{ id: number; title: string; sub?: string } | null>(null);
  // 多人對戰
  const [showInventory, setShowInventory] = useState(false);
  // 從平台大廳的商城連結進來（?shop=items）→ 直接打開商店的道具頁
  const user = useUser();
  const [showShop, setShowShop] = useState(() => new URLSearchParams(location.search).has("shop"));
  /** 購物車（關掉商店也保留，直到結帳或重新整理） */
  const [cart, setCart] = useState<Cart>([]);
  const [mpScreen, setMpScreen] = useState<"lobby" | null>(() =>
    /^[A-Z2-9]{5}$/i.test(new URLSearchParams(location.search).get("room") ?? "") ? "lobby" : null,
  );
  const [loadout, setLoadoutState] = useState<ItemId[]>([]);
  const [countdownEnd, setCountdownEnd] = useState(0);
  const [countdownNow, setCountdownNow] = useState(0);
  // 邀請連結 ?room=XXXXX：帶入房號並直接打開多人大廳（此元件只在瀏覽器端渲染）
  const [inviteCode] = useState(() => {
    const code = new URLSearchParams(location.search).get("room") ?? "";
    return /^[A-Z2-9]{5}$/i.test(code) ? code.toUpperCase() : "";
  });
  /** 對戰中的干擾效果到期時間（毫秒時間戳） */
  const mpRef = useRef({ active: false, inkUntil: 0, speedUntil: 0, mirrorUntil: 0, freezeUntil: 0, sentDead: false });

  const gameRef = useRef<Game | null>(null);
  const phaseRef = useRef<Phase>("title");
  const playerRef = useRef<PlayerData>(player);
  const boardWrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLCanvasElement>(null);
  /** 盤面外側的連擊火焰畫布 */
  const fireRef = useRef<HTMLCanvasElement>(null);
  const fireSimRef = useRef(new PixelFire());
  const holdRef = useRef<HTMLCanvasElement>(null);
  const nextRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const inputRef = useRef({ dir: 0 as -1 | 0 | 1, left: false, right: false, das: 0, arr: 0 });
  const soundRef = useRef<Sound | null>(null);
  const effectsRef = useRef(new Effects());
  const dangerRef = useRef(false);
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 換表情；暫時性表情（開心/興奮）過一陣子自動回到平常或擔心 */
  const react = useCallback((m: Mood, holdMs = 0) => {
    if (moodTimer.current) clearTimeout(moodTimer.current);
    setMood((prev) => ({ m, kick: prev.kick + 1 }));
    if (holdMs > 0) {
      moodTimer.current = setTimeout(() => {
        setMood((prev) => ({ m: dangerRef.current ? "worried" : "idle", kick: prev.kick + 1 }));
      }, holdMs);
    }
  }, []);

  // 算出「真正看得到」的高度：瀏覽器視窗下緣若超出螢幕可用範圍（被工作列蓋住），
  // 網頁的 innerHeight 會比實際看得到的大 → 扣掉超出的那段
  useEffect(() => {
    const update = () => {
      let h = Math.min(window.innerHeight, window.visualViewport?.height ?? Infinity);
      const sc = window.screen as Screen & { availTop?: number };
      // 模擬器/無頭瀏覽器的 screen 會等於頁面大小，這種情況不套用
      if (sc.height > window.innerHeight) {
        const hidden = window.screenY + window.outerHeight - ((sc.availTop ?? 0) + sc.availHeight);
        if (hidden > 0 && hidden < 300) h -= hidden;
      }
      document.documentElement.style.setProperty("--app-h", `${Math.floor(h)}px`);
    };
    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  // 語言切換時同步網頁語言與標題
  useEffect(() => {
    document.documentElement.lang = player.locale;
    document.title = t("app.name");
  }, [player.locale, t]);

  // 特效用的點陣字型（next/font 產生的實際字型名稱）
  useEffect(() => {
    const f = getComputedStyle(document.documentElement).getPropertyValue("--font-pixel-latin").trim();
    if (f) effectsRef.current.font = f;
  }, []);

  const playersRef = useRef<{ id: string; name: string }[]>([]);
  /** 對局結束/取消/斷線：關掉對戰模式並清掉所有干擾效果（墨汁、加速、鏡像、冰凍） */
  const endMatchLocal = () => {
    const mp = mpRef.current;
    mp.active = false;
    mp.inkUntil = mp.speedUntil = mp.mirrorUntil = mp.freezeUntil = 0;
    fireSimRef.current.reset();
    const g = gameRef.current;
    if (g) {
      g.speedMul = 1;
      g.holdLocked = false;
    }
    inputRef.current = { dir: 0, left: false, right: false, das: 0, arr: 0 };
  };

  // 伺服器訊息處理：放在 ref 裡（每次 render 更新），連線層只呼叫 ref，避免閉包拿到舊狀態
  const gameMsgRef = useRef<(m: ServerMsg) => void>(() => {});
  const onGameMsg = (m: ServerMsg) => {
    const mp = mpRef.current;
    const g = gameRef.current;
    const now = performance.now();
    const nameOf = (id: string) => playersRef.current.find((p) => p.id === id)?.name ?? "?";
    switch (m.t) {
      case "countdown": {
        // 新一局：所有人用同一個種子 → 同一串方塊
        mp.active = true;
        mp.sentDead = false;
        mp.inkUntil = mp.speedUntil = mp.mirrorUntil = mp.freezeUntil = 0;
        const ng = new Game(m.seed, 1);
        gameRef.current = ng;
        if (process.env.NODE_ENV === "development") (window as unknown as { __game?: Game }).__game = ng;
        effectsRef.current.reset();
        inputRef.current = { dir: 0, left: false, right: false, das: 0, arr: 0 };
        dangerRef.current = false;
        setDanger(false);
        setToast(null);
        setHud(snapshot(ng));
        setCountdownEnd(Date.now() + m.ms);
        setCountdownNow(Date.now());
        setPhase("countdown");
        break;
      }
      case "go":
        // 真的開打才從背包扣掉帶入的出戰道具（倒數被取消不扣；之後改由伺服器記帳）
        if (loadoutRef.current.length) {
          const used = loadoutRef.current;
          setPlayer((p) => {
            const battleItems = { ...p.battleItems };
            for (const id of used) battleItems[id] = Math.max(0, (battleItems[id] ?? 0) - 1);
            const next = { ...p, battleItems };
            savePlayer(next);
            return next;
          });
        }
        setPhase("playing");
        break;
      case "room":
        // 倒數中有人離開、伺服器取消開局 → 回房間畫面
        if (m.state === "lobby" && phaseRef.current === "countdown") {
          endMatchLocal();
          setPhase("title");
          setBanner({ id: now, title: "", sub: tRef.current("mp.cancelled") });
        }
        break;
      case "error":
        // 對局中斷線 → 退出對局，不能卡在倒數/觀戰畫面
        if (m.code === "disconnected" && (mp.active || ["countdown", "playing", "spectate", "result"].includes(phaseRef.current))) {
          endMatchLocal();
          setPhase("title");
          setBanner({ id: now, title: "", sub: tRef.current("mp.err.disconnected") });
        }
        break;
      case "garbage":
        if (g && !g.over) {
          // 缺口位置由伺服器決定，伺服器盤面才能跟我們一模一樣
          g.addGarbage(m.lines, m.hole);
          effectsRef.current.handle({ type: "lock", hard: true }, skinRef.current);
        }
        if (g) g.mutSeq = m.seq;
        break;
      case "effect": {
        if (!g) break;
        const ms = m.ms ?? 0;
        // 炸彈/清垃圾/長條會改盤面：記下序號，回報落點時伺服器照同樣順序重播
        if (m.seq !== undefined) g.mutSeq = m.seq;
        switch (m.item) {
          case "bomb":
            g.bomb(2);
            break;
          case "cleanse":
            g.clearGarbage();
            break;
          case "longbar":
            g.forceActive("I");
            break;
          case "ink":
            mp.inkUntil = now + ms;
            break;
          case "speed":
            mp.speedUntil = now + ms;
            g.speedMul = 4;
            break;
          case "mirror":
            mp.mirrorUntil = now + ms;
            inputRef.current = { dir: 0, left: false, right: false, das: 0, arr: 0 };
            break;
          case "freeze":
            mp.freezeUntil = now + ms;
            g.holdLocked = true;
            break;
        }
        if (m.from && m.from !== matchIdRef.current) {
          const tt = tRef.current;
          setBanner({
            id: now,
            title: tt(`item.name.${m.item}` as "item.name.bomb"),
            sub: tt("mp.hitBy", { name: nameOf(m.from), item: tt(`item.name.${m.item}` as "item.name.bomb") }),
          });
          react("worried", 1200);
        }
        break;
      }
      case "itemUsed":
        if (m.item === "shield" && m.from === matchIdRef.current && m.to) {
          setBanner({ id: now, title: tRef.current("item.name.shield"), sub: tRef.current("mp.blocked") });
        }
        break;
      case "end": {
        endMatchLocal();
        setPhase("result");
        // 下一場的出戰道具：已經用完的自動取消勾選，並同步給伺服器
        const owned = playerRef.current.battleItems;
        const keep = loadoutRef.current.filter((id) => (owned[id] ?? 0) > 0);
        if (keep.length !== loadoutRef.current.length) {
          setLoadoutState(keep);
          matchRef.current?.setLoadout(keep);
        }
        break;
      }
    }
  };
  const relayMsg = useCallback((m: ServerMsg) => gameMsgRef.current(m), []);
  const match = useMatch(relayMsg);
  const matchRef = useRef<typeof match | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const mv = match.view;
  const inMatch = !!mv.room && (phase === "countdown" || phase === "playing" || phase === "spectate" || phase === "result");

  const keyMap = useMemo(() => buildKeyMap(player.keys), [player.keys]);
  const keyMapRef = useRef(keyMap);
  const bindingRef = useRef<Action | null>(null);
  const mpScreenRef = useRef<"lobby" | null>(null);
  const showSettingsRef = useRef(false);

  const skin = getSkin(player.skinId);
  const skinRef = useRef(skin);
  useLayoutEffect(() => {
    skinRef.current = skin;
    phaseRef.current = phase;
    playerRef.current = player;
    keyMapRef.current = keyMap;
    tRef.current = t;
    bindingRef.current = binding;
    // 任何設定/道具/商店面板開著時，Enter 不會直接開始遊戲
    showSettingsRef.current = showSettings || showInventory || showShop;
    matchIdRef.current = mv.myId;
    mpScreenRef.current = mv.room ? "lobby" : mpScreen;
    matchHeldRef.current = mv.held;
    loadoutRef.current = loadout;
    playersRef.current = mv.room?.players ?? [];
    gameMsgRef.current = onGameMsg;
    matchRef.current = match;
  });

  const sound = useCallback(() => {
    if (!soundRef.current) soundRef.current = new Sound();
    const snd = soundRef.current;
    snd.unlock();
    snd.setVolume(playerRef.current.sound.volume, playerRef.current.sound.muted);
    return snd;
  }, []);

  const matchHeldRef = useRef<ItemId[]>([]);
  const loadoutRef = useRef<ItemId[]>([]);
  const updatePlayer = useCallback((fn: (p: PlayerData) => PlayerData) => {
    setPlayer((prev) => {
      const next = fn(prev);
      savePlayer(next);
      return next;
    });
  }, []);

  // ---------- 繪圖 ----------

  const draw = useCallback(() => {
    const game = gameRef.current;
    const canvas = boardRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w, dpr } = sizeRef.current;
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = w / COLS;
    const fx = effectsRef.current;
    ctx.fillStyle = skinRef.current.boardBg;
    ctx.fillRect(0, 0, w, cell * VISIBLE_ROWS);
    if (!game) return;
    ctx.save();
    ctx.translate(0, fx.offset());
    drawBoard(ctx, game, skinRef.current, cell);
    fx.draw(ctx, cell, skinRef.current);
    // 墨汁道具：盤面被一團團墨汁遮住
    if (mpRef.current.active && mpRef.current.inkUntil > performance.now()) {
      ctx.fillStyle = "#0b0716";
      const blobs = [
        [2, 5, 3.2],
        [7, 8, 3.6],
        [4, 12, 3.4],
        [8, 15, 2.8],
        [1, 17, 2.6],
        [5, 2, 2.4],
      ];
      for (const [bx, by, r] of blobs) {
        for (let y = -r; y <= r; y += 0.5) {
          const half = Math.sqrt(r * r - y * y);
          ctx.fillRect(Math.round((bx - half) * cell), Math.round((by + y) * cell), Math.round(half * 2 * cell), Math.ceil(cell / 2));
        }
      }
    }
    ctx.restore();

    // 連擊火焰：在盤面後方、從框外往上竄（盤面與側欄都蓋在火的上面）
    const fc = fireRef.current;
    const fctx = fc?.getContext("2d");
    const fire = fireSimRef.current;
    if (fc && fctx) {
      fctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fctx.clearRect(0, 0, fc.width / dpr, fc.height / dpr);
      if (fire.active) fire.draw(fctx);
    }
  }, []);

  const drawSide = useCallback((h: Hud) => {
    const s = skinRef.current;
    const paint = (c: HTMLCanvasElement | null, t: PieceType | null, dim = false) => {
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = c.getBoundingClientRect();
      if (c.width !== Math.round(rect.width * dpr)) {
        c.width = Math.round(rect.width * dpr);
        c.height = Math.round(rect.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMini(ctx, t, s, rect.width, rect.height, dim);
    };
    paint(holdRef.current, h.hold, !h.canHold);
    nextRefs.current.forEach((c, i) => paint(c, h.queue[i] ?? null));
  }, []);

  // 盤面跟著容器大小縮放（手機 / 電腦都填滿可用空間）
  useEffect(() => {
    const wrap = boardWrapRef.current;
    const canvas = boardRef.current;
    if (!wrap || !canvas) return;
    const ro = new ResizeObserver(() => {
      const rect = wrap.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { w: rect.width, h: rect.height, dpr };
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const fc = fireRef.current;
      if (fc) {
        const fr = fc.getBoundingClientRect();
        fc.width = Math.round(fr.width * dpr);
        fc.height = Math.round(fr.height * dpr);
        // 盤面在火焰畫布中的位置（火焰畫布比盤面框左右各寬一截）
        fireSimRef.current.resize(fr.width, fr.height, rect.left - fr.left, rect.width);
      }
      draw();
      const g = gameRef.current;
      if (g) drawSide(snapshot(g));
    });
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [draw, drawSide]);

  // 換造型時立即重畫
  useEffect(() => {
    draw();
    drawSide(hud);
  }, [skin.id, draw, drawSide, hud]);

  // ---------- 遊戲流程 ----------

  const finish = useCallback(
    (game: Game) => {
      fireSimRef.current.reset();
      setPhase("over");
      const best = playerRef.current.highScore ?? 0;
      setNewRecord(game.score > best);
      react(game.score > best && game.score > 0 ? "cheer" : "sad");
      if (game.score > best) updatePlayer((p) => ({ ...p, highScore: game.score }));
    },
    [updatePlayer, react],
  );

  const start = useCallback(() => {
    sound();
    effectsRef.current.reset();
    fireSimRef.current.reset();
    dangerRef.current = false;
    setDanger(false);
    setBanner(null);
    react("idle");
    const g = new Game(Date.now(), playerRef.current.startLevel);
    gameRef.current = g;
    // 開發用：只在 next dev 存在，方便自動化測試直接擺盤面（正式 build 會被移除）
    if (process.env.NODE_ENV === "development") (window as unknown as { __game?: Game }).__game = g;
    inputRef.current = { dir: 0, left: false, right: false, das: 0, arr: 0 };
    setToast(null);
    setNewRecord(false);
    setHud(snapshot(g));
    setPhase("playing");
  }, [sound, react]);

  const press = useCallback(
    (a: Action) => {
      const g = gameRef.current;
      const ph = phaseRef.current;
      // 對戰中：不能暫停；鏡像道具生效時左右顛倒
      const mp = mpRef.current;
      if (mp.active && a === "pause") return;
      if (mp.active && mp.mirrorUntil > performance.now()) {
        if (a === "left") a = "right";
        else if (a === "right") a = "left";
      }
      if (a === "item") {
        const held = matchHeldRef.current;
        if (mp.active && ph === "playing" && held.length) matchRef.current?.useItem(held[0]);
        return;
      }
      if (a === "pause") {
        if (ph === "playing") setPhase("paused");
        else if (ph === "paused") setPhase("playing");
        return;
      }
      if (!g || ph !== "playing") return;
      const inp = inputRef.current;
      switch (a) {
        case "left":
        case "right": {
          const d = a === "left" ? -1 : 1;
          inp[a] = true;
          inp.dir = d;
          inp.das = 0;
          inp.arr = 0;
          g.move(d);
          break;
        }
        case "soft":
          g.softDropping = true;
          g.softDrop();
          break;
        case "hard":
          g.hardDrop();
          break;
        case "cw":
          g.rotate(1);
          break;
        case "ccw":
          g.rotate(-1);
          break;
        case "r180":
          g.rotate(2);
          break;
        case "hold":
          g.holdPiece();
          break;
        case "bomb":
          if (mp.active) break; // 對戰中用道具欄，不用單人炸彈
          if ((playerRef.current.items.bomb ?? 0) > 0 && g.bomb(2)) {
            updatePlayer((p) => ({ ...p, items: { ...p.items, bomb: p.items.bomb - 1 } }));
          }
          break;
      }
    },
    [updatePlayer],
  );

  const release = useCallback((a: Action) => {
    const g = gameRef.current;
    const inp = inputRef.current;
    const mp = mpRef.current;
    if (mp.active && mp.mirrorUntil > performance.now()) {
      if (a === "left") a = "right";
      else if (a === "right") a = "left";
    }
    if (a === "left" || a === "right") {
      inp[a] = false;
      // 放開一邊時若另一邊還按著，改回另一邊方向
      inp.dir = inp.left ? -1 : inp.right ? 1 : 0;
      inp.das = 0;
      inp.arr = 0;
    } else if (a === "soft" && g) {
      g.softDropping = false;
    }
  }, []);

  const revive = useCallback(() => {
    const g = gameRef.current;
    if (!g || (playerRef.current.items.revive ?? 0) <= 0) return;
    if (g.revive()) {
      updatePlayer((p) => ({ ...p, items: { ...p.items, revive: p.items.revive - 1 } }));
      setHud(snapshot(g));
      setPhase("playing");
    }
  }, [updatePlayer]);

  // 主迴圈
  useEffect(() => {
    if (phase !== "playing") {
      draw();
      return;
    }
    let raf = 0;
    let last = performance.now();
    let lastVersion = -1;
    let lastClearId = gameRef.current?.lastClear?.id ?? 0;

    const loop = (now: number) => {
      const g = gameRef.current;
      if (!g) return;
      const dt = Math.min(100, now - last); // 切回分頁時避免一次掉一大段
      last = now;

      const inp = inputRef.current;
      if (inp.dir !== 0) {
        inp.das += dt;
        if (inp.das >= DAS_MS) {
          inp.arr += dt;
          while (inp.arr >= ARR_MS) {
            inp.arr -= ARR_MS;
            if (!g.move(inp.dir)) break;
          }
        }
      }

      const mp = mpRef.current;
      if (mp.active) {
        // 干擾效果到期
        if (mp.speedUntil && now > mp.speedUntil) {
          mp.speedUntil = 0;
          g.speedMul = 1;
        }
        if (mp.freezeUntil && now > mp.freezeUntil) {
          mp.freezeUntil = 0;
          g.holdLocked = false;
        }
        if (mp.mirrorUntil && now > mp.mirrorUntil) {
          mp.mirrorUntil = 0;
          inputRef.current = { dir: 0, left: false, right: false, das: 0, arr: 0 };
        }
      }
      if (!g.over) g.tick(dt);
      const fx = effectsRef.current;
      const snd = soundRef.current;
      let levelBanner: { id: number; title: string; sub?: string } | null = null;
      for (const ev of g.drainEvents()) {
        if (ev.type === "lock") {
          // 對戰：回報每顆方塊的落點（消行與攻擊由伺服器自己重算）
          if (mp.active && ev.place) matchRef.current?.sendLock(ev.place);
        }
        snd?.play(ev);
        fx.handle(ev, skinRef.current);
        if (ev.type === "clear") {
          const big = ev.info.lines >= 4 || ev.info.tspin || ev.info.perfect;
          react(big ? "excited" : "happy", big ? 1600 : 900);
        } else if (ev.type === "levelup") {
          levelBanner = { id: now, title: "LEVEL UP", sub: tRef.current("hud.levelUpSub", { level: ev.level }) };
          react("excited", 1600);
        } else if (ev.type === "gameover") {
          react("sad");
        } else if (ev.type === "revive") {
          react("happy", 900);
        }
      }
      if (mp.active && g.over && !mp.sentDead) {
        mp.sentDead = true;
        matchRef.current?.sendDead();
      }
      fx.setCombo(g.over ? 0 : g.combo);
      fx.update(dt);
      fireSimRef.current.intensity = fx.fireIntensity;
      fireSimRef.current.update(dt);

      // 危險偵測：堆到可視高度 3/4 以上
      if (!g.over) {
        const top = g.board.findIndex((row) => row.some((c) => c !== null));
        const height = top < 0 ? 0 : g.board.length - top;
        const d = height >= 15;
        if (d !== dangerRef.current) {
          dangerRef.current = d;
          setDanger(d);
          setMood((prev) =>
            prev.m === "idle" || prev.m === "worried" ? { m: d ? "worried" : "idle", kick: prev.kick + 1 } : prev,
          );
        }
      }
      draw();

      if (g.version !== lastVersion) {
        lastVersion = g.version;
        setHud(snapshot(g));
      }
      if (g.lastClear && g.lastClear.id !== lastClearId) {
        lastClearId = g.lastClear.id;
        const text = clearLabel(g.lastClear, tRef.current);
        const lc = g.lastClear;
        if (text.length) {
          setToast({ id: lc.id, text, points: lc.points, big: lc.lines >= 4 || lc.tspin || lc.perfect });
          // 這一刻同時升級 → 橫幅排在大字後面
          if (levelBanner) {
            pendingBannerRef.current = levelBanner;
            levelBanner = null;
          }
        }
      }
      if (levelBanner) setBanner(levelBanner);
      // 結束動畫播完才跳出結算畫面
      if (g.over && !fx.busy) {
        setHud(snapshot(g));
        if (mp.active) {
          // 對戰：被淘汰後觀戰，等全場結束
          setPhase((ph) => (ph === "playing" ? "spectate" : ph));
          return;
        }
        finish(g);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // 注意：這裡的依賴必須都是穩定的（不能放每次 render 都重建的物件），
    // 否則每次畫面更新都會重啟迴圈、吃掉經過的時間，遊戲會變慢、方塊遲遲不固定
  }, [phase, draw, finish, react]);

  // 升級橫幅 1.6 秒後消失
  useEffect(() => {
    if (!banner) return;
    const t = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(t);
  }, [banner]);

  // 連擊提示 1.2 秒後消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => {
      setToast(null);
      const next = pendingBannerRef.current;
      if (next) {
        pendingBannerRef.current = null;
        setBanner(next);
      }
    }, 1200);
    return () => clearTimeout(t);
  }, [toast]);

  // 鍵盤
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // 設定畫面正在等玩家按新鍵
      const target = bindingRef.current;
      if (target) {
        e.preventDefault();
        if (e.key !== "Escape") {
          const k = normKey(e.key);
          updatePlayer((p) => {
            const keys = { ...p.keys };
            for (const a of ACTIONS) keys[a.id] = keys[a.id].filter((x) => normKey(x) !== k);
            keys[target] = [k];
            return { ...p, keys };
          });
        }
        setBinding(null);
        return;
      }
      soundRef.current?.unlock();
      const a = keyMapRef.current[normKey(e.key)];
      if (phaseRef.current === "title" || phaseRef.current === "over" || phaseRef.current === "result" || phaseRef.current === "spectate" || phaseRef.current === "countdown") {
        if (e.key === "Enter" && !showSettingsRef.current && !mpScreenRef.current && !mpRef.current.active && phaseRef.current !== "result") {
          e.preventDefault();
          start();
        }
        return;
      }
      if (!a) return;
      e.preventDefault();
      if (e.repeat) return; // 自動重複由遊戲迴圈自己處理
      press(a);
    };
    const up = (e: KeyboardEvent) => {
      const a = keyMapRef.current[normKey(e.key)];
      if (a) release(a);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [press, release, start, updatePlayer]);

  // 切到別的分頁 / 視窗時自動暫停
  useEffect(() => {
    const onHide = () => {
      if (phaseRef.current === "playing" && !mpRef.current.active) setPhase("paused");
      const g = gameRef.current;
      if (g) g.softDropping = false;
      inputRef.current = { dir: 0, left: false, right: false, das: 0, arr: 0 };
    };
    const onVis = () => document.hidden && onHide();
    window.addEventListener("blur", onHide);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("blur", onHide);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // ---------- 多人對戰操作 ----------
  const ensureNick = () => {
    let nick = playerRef.current.nickname.trim();
    if (!nick) {
      nick = `P${Math.floor(1000 + Math.random() * 9000)}`;
      updatePlayer((p) => ({ ...p, nickname: nick }));
    }
    return nick;
  };
  const hello = () => ({ name: ensureNick(), petId: playerRef.current.petId, skinId: playerRef.current.skinId });
  const openLobby = () => {
    ensureNick();
    setMpScreen("lobby");
  };
  const mpCreate = (mode: "classic" | "items") =>
    match.connect(hello()).then(
      () => match.create(mode),
      () => undefined,
    );
  const mpJoin = (code: string) =>
    match.connect(hello()).then(
      () => match.join(code),
      () => undefined,
    );
  const mpLeave = () => {
    match.leave();
    endMatchLocal();
    setLoadoutState([]);
    setPhase("title");
    setMpScreen("lobby");
  };
  const chooseLoadout = (items: ItemId[]) => {
    // 只能帶背包裡有的道具
    const next = items.filter((id) => (player.battleItems[id] ?? 0) > 0);
    setLoadoutState(next);
    match.setLoadout(next);
  };
  /** 付款成功 → 整車一起發貨（之後改成伺服器收到支付商通知後發貨，這裡只重新讀取結果） */
  const onPaid = (c: Cart): CheckoutResult => {
    const r = deliver(playerRef.current, c);
    if (r.ok) updatePlayer((prev) => {
      const again = deliver(prev, c);
      return again.ok ? again.next : prev;
    });
    return r;
  };
  const claimGift = () => {
    const r = claimDailyGift(playerRef.current);
    if (!r) return null;
    updatePlayer(() => r.next);
    return r.gifts;
  };
  const mpStart = () => {
    // 帶了出戰道具 → 扣一次今日免費次數（之後改由伺服器記帳/扣遊戲幣）
    match.start();
  };
  const useSlot = (i: number) => {
    const id = mv.held[i];
    if (id && phase === "playing") match.useItem(id);
  };

  // 倒數畫面每 100ms 更新一次數字
  useEffect(() => {
    if (phase !== "countdown") return;
    const id = setInterval(() => setCountdownNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [phase]);

  const items = player.items;
  const setSound = (patch: Partial<PlayerData["sound"]>) =>
    updatePlayer((p) => {
      const next = { ...p, sound: { ...p.sound, ...patch } };
      soundRef.current?.setVolume(next.sound.volume, next.sound.muted);
      return next;
    });

  return (
    <I18nContext.Provider value={t}>
    <div className={player.locale === "zh-TW" ? "game-root" : "game-root lang-latin"}>
      <Starfield sceneId={(showSettings || showShop) && previewScene ? previewScene : player.sceneId} />

      <header className="game-header">
        <h1 className="logo" aria-label={t("app.name")}>
          <span className="logo-main">{t("app.name")}</span>
          <span className="logo-sub">BLOCK BLITZ</span>
        </h1>
        <div className="header-right">
          <div className="best">
            <span className="best-label">HI-SCORE</span>
            <b>{String(player.highScore).padStart(7, "0")}</b>
          </div>
          <button
            className="icon-btn"
            onClick={() => setSound({ muted: !player.sound.muted })}
            aria-label={player.sound.muted ? t("sound.on") : t("sound.off")}
          >
            <PixelIcon name={player.sound.muted ? "mute" : "sound"} size={20} />
          </button>
        </div>
      </header>

      <div className="stage">
        <aside className="side side-left">
          <Panel label="HOLD" sub={t("panel.hold")}>
            <canvas ref={holdRef} className="mini" aria-label={t("board.holdLabel")} />
          </Panel>
          <Panel label="SCORE" sub={t("panel.score")}>
            <div className="stat-value stat-big">{String(hud.score).padStart(7, "0")}</div>
          </Panel>
          {inMatch && mv.room?.mode === "items" && (
            <ItemSlots held={mv.held} onUse={useSlot} keyName={player.keys.item.map(kl).join("/")} shield={mv.shield} />
          )}
          {!inMatch && (
          <Panel label="LEVEL" sub={t("panel.level")}>
            <div className="stat-value">{String(hud.level).padStart(2, "0")}</div>
          </Panel>
          )}
          <Panel label="LINES" sub={t("panel.lines")}>
            <div className="stat-value">{String(hud.lines).padStart(3, "0")}</div>
          </Panel>
          <Panel label="BUDDY" sub={t(`pet.${player.petId}` as "pet.cat")}>
            <Mascot pet={getPet(player.petId)} mood={mood.m} kick={mood.kick} />
          </Panel>
        </aside>

        <div className={danger && phase === "playing" ? "board-frame board-danger" : "board-frame"}>
          {inMatch && <GarbageMeter pending={mv.pending} />}
          <canvas ref={fireRef} className="combo-fire" aria-hidden="true" />
          <div
            ref={boardWrapRef}
            className="board-wrap"
            onPointerDown={(e) => {
              // 手機上點盤面 = 順時針旋轉
              if (e.pointerType !== "mouse") press("cw");
            }}
          >
            <canvas ref={boardRef} className="board" aria-label={t("board.label")} />

            {banner && (
              <div key={banner.id} className="banner">
                <div className="banner-title">{banner.title}</div>
                {banner.sub && <div className="banner-sub">{banner.sub}</div>}
              </div>
            )}

            {toast && (
              <div key={toast.id} className={toast.big ? "toast toast-big" : "toast"}>
                {/* 最重要的一句大字，其餘（連續大招、連擊、全清）一排小字 */}
                <div>{toast.text[0]}</div>
                {toast.text.length > 1 && <div className="toast-sub">{toast.text.slice(1).join("・")}</div>}
              </div>
            )}

            {phase === "title" && !showSettings && !showInventory && !showShop && !mpScreen && !mv.room && (
              <Overlay>
                <div className={player.locale === "zh-TW" ? "title-logo" : "title-logo title-logo-latin"}>
                  {player.locale === "zh-TW" ? (
                    <>
                      方塊
                      <br />
                      消消
                    </>
                  ) : (
                    <>
                      BLOCK
                      <br />
                      BLITZ
                    </>
                  )}
                </div>
                <button className="px-btn px-btn-primary" onClick={start}>
                  {t("menu.start")}
                </button>
                <p className="blink">PRESS ENTER</p>
                <div className="level-pick">
                  <span>{t("menu.startLevel")}</span>
                  <button
                    className="px-btn px-btn-sm"
                    onClick={() => updatePlayer((p) => ({ ...p, startLevel: Math.max(1, p.startLevel - 1) }))}
                    aria-label={t("menu.levelDown")}
                  >
                    ◀
                  </button>
                  <b>{String(player.startLevel).padStart(2, "0")}</b>
                  <button
                    className="px-btn px-btn-sm"
                    onClick={() =>
                      updatePlayer((p) => ({ ...p, startLevel: Math.min(MAX_START_LEVEL, p.startLevel + 1) }))
                    }
                    aria-label={t("menu.levelUp")}
                  >
                    ▶
                  </button>
                </div>
                <button className="px-btn" onClick={openLobby}>
                  {t("mp.button")}
                </button>
                <button className="px-btn px-btn-shop" onClick={() => setShowShop(true)}>
                  <PixelIcon name="cart" size={14} color="#ffd84a" light="#fff" /> {t("shop.button")}
                  {cart.length > 0 && <span className="cart-badge">{cart.reduce((n, l) => n + l.qty, 0)}</span>}
                </button>
                <button className="px-btn px-btn-ghost" onClick={() => setShowInventory(true)}>
                  <PixelIcon name="bomb" size={14} color="#8a8fff" light="#ffd84a" /> {t("inv.button")}
                </button>
                <button className="px-btn px-btn-ghost" onClick={() => setShowSettings(true)}>
                  <PixelIcon name="gear" size={14} /> {t("menu.settings")}
                </button>
                <p className="bb-account">
                  {user.kind === "member" ? (
                    <Link href="/account">{t("game.account", { name: user.name })}</Link>
                  ) : (
                    <>
                      {t("game.guest")}
                      {auth.enabled && (
                        <>
                          {"・"}
                          <a href={`/?login=1&next=${encodeURIComponent("/play/blockblitz")}`}>{t("platform.login")}</a>
                        </>
                      )}
                    </>
                  )}
                </p>
                <Link className="px-btn px-btn-ghost px-btn-sm plat-back" href="/">
                  ◀ {t("platform.back")}
                </Link>
              </Overlay>
            )}

            {phase === "title" && showSettings && (
              <Overlay scroll>
                <p className="ov-title">{t("settings.title")}</p>
                <div className="setting-row">
                  <span>{t("settings.language")}</span>
                  <div className="lang-row">
                    {LOCALES.map((l) => (
                      <button
                        key={l.id}
                        className={`px-btn px-btn-sm ${player.locale === l.id ? "px-btn-primary" : ""}`}
                        onClick={() => {
                          setPlatformLocale(l.id as Locale);
                          updatePlayer((p) => ({ ...p, locale: l.id as Locale }));
                        }}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <ScenePicker
                  player={player}
                  previewId={previewScene ?? player.sceneId}
                  onPreview={setPreviewScene}
                  onPick={(id) => updatePlayer((p) => ({ ...p, sceneId: id }))}
                />
                <PetPicker player={player} onPick={(id) => updatePlayer((p) => ({ ...p, petId: id }))} />
                <SkinPicker player={player} onPick={(id) => updatePlayer((p) => ({ ...p, skinId: id }))} />
                <div className="setting-row">
                  <span>{t("settings.volume")}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={player.sound.volume}
                    onChange={(e) => setSound({ volume: Number(e.target.value), muted: false })}
                    aria-label={t("settings.volume")}
                  />
                </div>
                <div className="keys">
                  <div className="keys-head">
                    <span>{t("settings.keys")}</span>
                    <button className="px-btn px-btn-sm" onClick={() => updatePlayer((p) => ({ ...p, keys: DEFAULT_KEYS }))}>
                      {t("settings.keysReset")}
                    </button>
                  </div>
                  {ACTIONS.map((a) => (
                    <button
                      key={a.id}
                      className={`key-row ${binding === a.id ? "key-row-wait" : ""}`}
                      onClick={() => setBinding(a.id)}
                    >
                      <span>{t(`action.${a.id}`)}</span>
                      <kbd>
                        {binding === a.id ? t("settings.pressKey") : player.keys[a.id].map(kl).join(" / ") || t("settings.unbound")}
                      </kbd>
                    </button>
                  ))}
                </div>
                <button
                  className="px-btn px-btn-primary"
                  onClick={() => {
                    setBinding(null);
                    setPreviewScene(null);
                    setShowSettings(false);
                  }}
                >
                  {t("menu.done")}
                </button>
              </Overlay>
            )}

            {phase === "title" && mpScreen === "lobby" && !mv.room && (
              <LobbyOverlay
                nickname={player.nickname}
                onNickname={(n) => updatePlayer((p) => ({ ...p, nickname: n.slice(0, 12) }))}
                onCreate={mpCreate}
                onJoin={mpJoin}
                onBack={() => {
                  setMpScreen(null);
                  match.disconnect();
                }}
                busy={mv.status === "connecting"}
                error={mv.error}
                initialCode={inviteCode}
              />
            )}

            {mv.room && (mv.room.state === "lobby" || (mv.room.state === "ended" && phase !== "result")) && phase !== "countdown" && (
              <RoomOverlay
                view={mv}
                loadout={loadout}
                onLoadout={chooseLoadout}
                owned={player.battleItems}
                onOpenInventory={() => setShowInventory(true)}
                onStart={mpStart}
                onLeave={mpLeave}
              />
            )}

            {phase === "countdown" && (
              <div className="mp-countdown">
                {Math.max(1, Math.ceil((countdownEnd - countdownNow) / 1000))}
              </div>
            )}

            {phase === "spectate" && (
              <div className="mp-spectate">
                {t("mp.spectating", { n: mv.room?.players.find((p) => p.id === mv.myId)?.place ?? "?" })}
              </div>
            )}

            {phase === "result" && mv.room && <ResultOverlay view={mv} onAgain={mpStart} onLeave={mpLeave} />}

            {showInventory && (phase === "title" || phase === "result") && (
              <Inventory
                player={player}
                onClaimGift={claimGift}
                onOpenShop={() => {
                  setShowInventory(false);
                  setShowShop(true);
                }}
                onClose={() => setShowInventory(false)}
              />
            )}

            {showShop && (phase === "title" || phase === "result") && (
              <Shop
                player={player}
                previewScene={previewScene ?? player.sceneId}
                onPreviewScene={setPreviewScene}
                onPick={(kind, id) =>
                  updatePlayer((p) => (kind === "scene" ? { ...p, sceneId: id } : kind === "pet" ? { ...p, petId: id } : { ...p, skinId: id }))
                }
                cart={cart}
                onCart={setCart}
                onPaid={onPaid}
                initialTab={(() => {
                  const q = new URLSearchParams(location.search).get("shop");
                  return q === "items" || q === "cart" || q === "orders" ? q : "look";
                })()}
                onClose={() => {
                  setPreviewScene(null);
                  setShowShop(false);
                }}
              />
            )}

            {phase === "paused" && (
              <Overlay>
                <p className="ov-title">PAUSE</p>
                <button className="px-btn px-btn-primary" onClick={() => setPhase("playing")}>
                  {t("menu.resume")}
                </button>
                <button className="px-btn px-btn-ghost" onClick={() => setPhase("title")}>
                  {t("menu.home")}
                </button>
              </Overlay>
            )}

            {phase === "over" && (
              <Overlay>
                <p className="ov-gameover">GAME OVER</p>
                <p className="ov-score">{String(hud.score).padStart(7, "0")}</p>
                {newRecord && <p className="ov-record blink">NEW RECORD!</p>}
                {items.revive > 0 && (
                  <button className="px-btn px-btn-danger" onClick={revive}>
                    <PixelIcon name="heart" size={14} color="#fff" light="#ffd0d8" /> {t("menu.revive", { n: items.revive })}
                  </button>
                )}
                <button className="px-btn px-btn-primary" onClick={start}>
                  {t("menu.retry")}
                </button>
                <button className="px-btn px-btn-ghost" onClick={() => setPhase("title")}>
                  {t("menu.home")}
                </button>
              </Overlay>
            )}
          </div>
        </div>

        <aside className="side side-right">
          <Panel label="NEXT" sub={t("panel.next")}>
            <div className="next-list">
              {Array.from({ length: NEXT_COUNT }, (_, i) => (
                <canvas
                  key={i}
                  ref={(el) => {
                    nextRefs.current[i] = el;
                  }}
                  className={i === 0 ? "mini" : "mini mini-sm"}
                />
              ))}
            </div>
          </Panel>
          {inMatch && <OpponentBoards view={mv} />}
          {!inMatch && (
          <Panel label="ITEMS" sub={t("panel.items")}>
            <div className="items">
              <button
                className="item-btn"
                disabled={phase !== "playing" || items.bomb <= 0}
                onClick={() => press("bomb")}
                title={t("item.bombHint", { key: player.keys.bomb.map(kl).join("/") })}
              >
                <PixelIcon name="bomb" size={18} color="#8a8fff" light="#ffd84a" />
                <span>{t("item.bomb")}</span>
                <b>×{items.bomb}</b>
              </button>
              <div className="item-btn item-static" title={t("item.reviveHint")}>
                <PixelIcon name="heart" size={18} color="#ff4d6d" light="#ffd0d8" />
                <span>{t("item.revive")}</span>
                <b>×{items.revive}</b>
              </div>
            </div>
          </Panel>
          )}
          {!inMatch && <KeyHelp keys={player.keys} />}
        </aside>
      </div>

      <TouchControls press={press} release={release} />
    </div>
    </I18nContext.Provider>
  );
}

function snapshot(g: Game): Hud {
  return {
    score: g.score,
    lines: g.lines,
    level: g.level,
    hold: g.hold,
    canHold: g.canHold,
    queue: g.queue.slice(0, NEXT_COUNT),
  };
}

function Panel({ label, sub, children }: { label: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <div className="panel-label">
        {label} <small>{sub}</small>
      </div>
      {children}
    </div>
  );
}

function Overlay({ children, scroll }: { children: React.ReactNode; scroll?: boolean }) {
  return (
    <div className={scroll ? "overlay overlay-scroll" : "overlay"} onPointerDown={(e) => e.stopPropagation()}>
      {children}
    </div>
  );
}

function KeyHelp({ keys }: { keys: PlayerData["keys"] }) {
  const t = useT();
  const kl = (k: string) => keyLabel(k, t("key.space"));
  const show: Action[] = ["left", "right", "cw", "ccw", "soft", "hard", "hold", "pause"];
  return (
    <dl className="keyhelp">
      {show.map((a) => (
        <div key={a}>
          <dt>{keys[a].map(kl).join("/") || "—"}</dt>
          <dd>{t(`action.${a}`)}</dd>
        </div>
      ))}
    </dl>
  );
}

function TouchControls({ press, release }: { press: (a: Action) => void; release: (a: Action) => void }) {
  const t = useT();
  const bind = (a: Action) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      press(a);
    },
    onPointerUp: () => release(a),
    onPointerCancel: () => release(a),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return (
    <div className="touch">
      <div className="touch-row">
        <button className="tbtn" {...bind("hold")} aria-label={t("action.hold")}>HOLD</button>
        <button className="tbtn" {...bind("ccw")} aria-label={t("action.ccw")}>↺</button>
        <button className="tbtn" {...bind("cw")} aria-label={t("action.cw")}>↻</button>
        <button className="tbtn" {...bind("pause")} aria-label={t("action.pause")}>II</button>
      </div>
      <div className="touch-row">
        <button className="tbtn tbtn-lg" {...bind("left")} aria-label={t("action.left")}>◀</button>
        <button className="tbtn tbtn-lg" {...bind("soft")} aria-label={t("action.soft")}>▼</button>
        <button className="tbtn tbtn-lg" {...bind("right")} aria-label={t("action.right")}>▶</button>
        <button className="tbtn tbtn-lg tbtn-accent" {...bind("hard")} aria-label={t("action.hard")}>DROP</button>
      </div>
    </div>
  );
}
