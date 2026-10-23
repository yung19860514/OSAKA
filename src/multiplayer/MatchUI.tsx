"use client";

// 多人對戰的畫面元件：大廳、房間、對手小盤面、道具欄、垃圾警示條、結果。

import { useEffect, useRef, useState } from "react";
import PixelIcon from "@/components/PixelIcon";
import { PetCanvas } from "@/components/Mascot";
import { getPet } from "@/game/pets";
import { drawBlock } from "@/game/render";
import { getSkin } from "@/game/skins";
import { useT } from "@/i18n";
import { ITEM_COLORS } from "./itemStyle";
import { ITEM_IDS, MAX_LOADOUT, type ItemId, type MatchMode, type PublicPlayer } from "./shared";
import type { MatchView } from "./useMatch";

export function ItemIcon({ id, size = 18 }: { id: ItemId; size?: number }) {
  const colors = Object.hasOwn(ITEM_COLORS, id) ? ITEM_COLORS[id] : null;
  if (!colors) return null; // 不認得的道具（不該發生）→ 不畫，避免整個畫面當掉
  const [c, l] = colors;
  return <PixelIcon name={id} size={size} color={c} light={l} />;
}

// ---------- 大廳：取暱稱、開房或輸入房號 ----------
export function LobbyOverlay({
  nickname,
  onNickname,
  onCreate,
  onJoin,
  onBack,
  busy,
  error,
  initialCode,
}: {
  nickname: string;
  onNickname: (n: string) => void;
  onCreate: (mode: MatchMode) => void;
  onJoin: (code: string) => void;
  onBack: () => void;
  busy: boolean;
  error: string | null;
  initialCode: string;
}) {
  const t = useT();
  const [code, setCode] = useState(initialCode);
  return (
    <div className="overlay overlay-scroll mp-lobby" onPointerDown={(e) => e.stopPropagation()}>
      <p className="ov-title">{t("mp.title")}</p>
      <label className="mp-field">
        <span>{t("mp.nickname")}</span>
        <input value={nickname} maxLength={12} onChange={(e) => onNickname(e.target.value)} />
      </label>
      <div className="mp-modes">
        {(["classic", "items"] as MatchMode[]).map((m) => (
          <button key={m} className="mp-mode" disabled={busy || !nickname.trim()} onClick={() => onCreate(m)}>
            <b>{t(m === "classic" ? "mp.classic" : "mp.items")}</b>
            <small>{t(m === "classic" ? "mp.classicDesc" : "mp.itemsDesc")}</small>
            <span className="mp-mode-cta">{t("mp.create")} ▶</span>
          </button>
        ))}
      </div>
      <div className="mp-join">
        <input
          value={code}
          placeholder={t("mp.code")}
          maxLength={5}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && code.length === 5 && onJoin(code)}
        />
        <button className="px-btn px-btn-sm" disabled={busy || code.length !== 5 || !nickname.trim()} onClick={() => onJoin(code)}>
          {t("mp.join")}
        </button>
      </div>
      {busy && <p className="mp-note">{t("mp.connecting")}</p>}
      {error && <p className="mp-error">{t(`mp.err.${error}` as "mp.err.bad_request")}</p>}
      <button className="px-btn px-btn-ghost" onClick={onBack}>
        {t("mp.back")}
      </button>
    </div>
  );
}

// ---------- 房間：等人、選出戰道具、房主開始 ----------
export function RoomOverlay({
  view,
  loadout,
  onLoadout,
  owned,
  onOpenInventory,
  onStart,
  onLeave,
}: {
  view: MatchView;
  loadout: ItemId[];
  onLoadout: (items: ItemId[]) => void;
  /** 背包裡每種對戰道具的數量 */
  owned: Record<ItemId, number>;
  onOpenInventory: () => void;
  onStart: () => void;
  onLeave: () => void;
}) {
  const t = useT();
  const [copied, setCopied] = useState<"no" | "yes" | "failed">("no");
  const room = view.room!;
  const me = room.players.find((p) => p.id === view.myId);
  const link = typeof window !== "undefined" ? `${location.origin}${location.pathname}?room=${room.code}` : "";
  const toggle = (id: ItemId) => {
    if (loadout.includes(id)) onLoadout(loadout.filter((x) => x !== id));
    else if (loadout.length < MAX_LOADOUT) onLoadout([...loadout, id]);
  };
  return (
    <div className="overlay overlay-scroll" onPointerDown={(e) => e.stopPropagation()}>
      <p className="ov-title">{t(room.mode === "items" ? "mp.items" : "mp.classic")}</p>
      <div className="mp-code">
        <span>{t("mp.room")}</span>
        <b>{room.code}</b>
      </div>
      <button
        className="px-btn px-btn-sm"
        onClick={() => {
          if (!navigator.clipboard) return setCopied("failed");
          navigator.clipboard.writeText(link).then(
            () => setCopied("yes"),
            () => setCopied("failed"),
          );
        }}
      >
        {copied === "yes" ? t("mp.copied") : t("mp.copyLink")}
      </button>
      {copied === "failed" && (
        <>
          <p className="mp-note">{t("mp.copyFailed")}</p>
          <input className="mp-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}
      <ul className="mp-players">
        {room.players.map((p) => (
          <li key={p.id} className={p.id === view.myId ? "mp-me" : ""}>
            <PetCanvas pet={getPet(p.petId)} mood="idle" className="mp-pet" />
            <span className="mp-name">{p.name}</span>
            {p.id === view.myId && <small>{t("mp.you")}</small>}
            {p.host && <small className="mp-host">{t("mp.host")}</small>}
            {room.mode === "items" && p.loadout > 0 && <small>×{p.loadout}</small>}
          </li>
        ))}
      </ul>
      {room.players.length < 2 && <p className="mp-note">{t("mp.waiting", { n: room.players.length })}</p>}

      {room.mode === "items" && (
        <div className="mp-loadout">
          <div className="skins-label">{t("mp.loadout", { n: MAX_LOADOUT })}</div>
          <div className="mp-loadout-grid">
            {ITEM_IDS.map((id) => (
              <button
                key={id}
                className={`mp-item ${loadout.includes(id) ? "skin-active" : ""}`}
                disabled={(owned[id] ?? 0) <= 0 && !loadout.includes(id)}
                onClick={() => toggle(id)}
                title={t(`item.desc.${id}` as "item.desc.bomb")}
              >
                <ItemIcon id={id} size={20} />
                <span>{t(`item.name.${id}` as "item.name.bomb")}</span>
                <b className="mp-item-count">×{owned[id] ?? 0}</b>
              </button>
            ))}
          </div>
          <p className="mp-note">{t("mp.loadoutHint")}</p>
          <button className="px-btn px-btn-sm" onClick={onOpenInventory}>
            {t("inv.button")}
          </button>
        </div>
      )}

      {view.error && <p className="mp-error">{t(`mp.err.${view.error}` as "mp.err.bad_request")}</p>}
      {me?.host ? (
        <button className="px-btn px-btn-primary" disabled={room.players.length < 2} onClick={onStart}>
          {t("mp.start")}
        </button>
      ) : (
        <p className="blink mp-wait">{t("mp.waitHost")}</p>
      )}
      <button className="px-btn px-btn-ghost" onClick={onLeave}>
        {t("mp.leave")}
      </button>
    </div>
  );
}

// ---------- 對手小盤面 ----------
function MiniBoard({ board, skinId, dead }: { board: string; skinId: string; dead: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const rect = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const skin = getSkin(skinId);
    const cell = rect.width / 10;
    ctx.fillStyle = skin.boardBg;
    ctx.fillRect(0, 0, rect.width, rect.height);
    const flat = { ...skin, style: "flat" as const };
    for (let i = 0; i < Math.min(200, board.length); i++) {
      const ch = board[i];
      if (ch === ".") continue;
      const color = skin.colors[ch as keyof typeof skin.colors] ?? skin.colors.G;
      drawBlock(ctx, (i % 10) * cell, Math.floor(i / 10) * cell, cell, color, flat, dead ? 0.35 : 1);
    }
  }, [board, skinId, dead]);
  return <canvas ref={ref} className="mp-mini" aria-hidden="true" />;
}

export function OpponentBoards({ view }: { view: MatchView }) {
  const t = useT();
  const others = (view.room?.players ?? []).filter((p) => p.id !== view.myId);
  if (!others.length) return null;
  return (
    <div className="panel mp-opponents">
      <div className="panel-label">
        RIVALS <small>{t("mp.opponents")}</small>
      </div>
      <div className="mp-opp-list">
        {others.map((p: PublicPlayer) => (
          <div key={p.id} className="mp-opp">
            <div className="mp-opp-board">
              <MiniBoard board={view.boards[p.id] ?? ""} skinId={p.skinId} dead={!p.alive && view.room?.state === "playing"} />
              {p.place !== null && view.room?.state !== "lobby" && <div className="mp-ko">{p.place === 1 ? "WIN" : t("mp.place", { n: p.place })}</div>}
            </div>
            <div className="mp-opp-name">
              <PetCanvas pet={getPet(p.petId)} mood={p.alive ? "idle" : "sad"} className="mp-opp-pet" />
              <span>{p.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- 道具欄（道具賽） ----------
export function ItemSlots({ held, onUse, keyName, shield }: { held: ItemId[]; onUse: (i: number) => void; keyName: string; shield: boolean }) {
  const t = useT();
  return (
    <div className="panel">
      <div className="panel-label">
        ITEMS <small>{t("panel.items")}</small>
      </div>
      <div className="mp-slots">
        {[0, 1, 2].map((i) => {
          const id = held[i];
          return (
            <button
              key={i}
              className={`mp-slot ${i === 0 && id ? "mp-slot-next" : ""}`}
              disabled={!id}
              onClick={() => onUse(i)}
              title={id ? `${t(`item.name.${id}` as "item.name.bomb")}：${t(`item.desc.${id}` as "item.desc.bomb")}` : ""}
            >
              {id ? <ItemIcon id={id} size={22} /> : <span className="mp-slot-empty" />}
            </button>
          );
        })}
      </div>
      <p className="mp-slot-hint">{held.length ? t("mp.useItem", { key: keyName }) : t("mp.noItems")}</p>
      {shield && (
        <p className="mp-shield">
          <ItemIcon id="shield" size={12} /> {t("mp.shieldOn")}
        </p>
      )}
    </div>
  );
}

// ---------- 垃圾警示條（盤面左側，紅色越高代表越多垃圾要進來） ----------
export function GarbageMeter({ pending }: { pending: number }) {
  const h = Math.min(100, (pending / 20) * 100);
  return (
    <div className="mp-meter" aria-hidden="true">
      <div className={pending >= 8 ? "mp-meter-fill mp-meter-hot" : "mp-meter-fill"} style={{ height: `${h}%` }} />
    </div>
  );
}

// ---------- 結果 ----------
export function ResultOverlay({
  view,
  onAgain,
  onLeave,
}: {
  view: MatchView;
  onAgain: () => void;
  onLeave: () => void;
}) {
  const t = useT();
  const players = view.room?.players ?? [];
  const me = players.find((p) => p.id === view.myId);
  const ranking = view.ranking ?? [];
  return (
    <div className="overlay overlay-scroll" onPointerDown={(e) => e.stopPropagation()}>
      <p className="ov-gameover" style={{ color: ranking[0]?.id === view.myId ? "var(--gold)" : undefined }}>
        {ranking[0]?.id === view.myId ? t("mp.winner") : t("mp.result")}
      </p>
      <ol className="mp-rank">
        {ranking.map((r) => (
          <li key={r.id} className={r.id === view.myId ? "mp-me" : ""}>
            <b>{r.place}</b>
            <PetCanvas pet={getPet(r.petId)} mood={r.place === 1 ? "cheer" : "idle"} className="mp-pet" />
            <span>{r.name}</span>
            {!players.some((x) => x.id === r.id) && <small>（{t("mp.left")}）</small>}
          </li>
        ))}
      </ol>
      {me?.host ? (
        <button className="px-btn px-btn-primary" onClick={onAgain} disabled={players.length < 2}>
          {t("mp.again")}
        </button>
      ) : (
        <p className="blink mp-wait">{t("mp.waitHost")}</p>
      )}
      <button className="px-btn px-btn-ghost" onClick={onLeave}>
        {t("mp.leave")}
      </button>
    </div>
  );
}
