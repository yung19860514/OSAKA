"use client";

// 遊戲端的對戰連線：連到對戰伺服器、保存房間狀態，把「影響盤面」的訊息即時轉給遊戲。

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Placement } from "../game/engine";
import type { ClientMsg, ItemId, MatchMode, PublicPlayer, RankEntry, RoomState, ServerMsg } from "./shared";

export interface MatchView {
  status: "offline" | "connecting" | "online" | "error";
  myId: string | null;
  room: { code: string; mode: MatchMode; state: RoomState; players: PublicPlayer[] } | null;
  /** 對手的小盤面 */
  boards: Record<string, string>;
  /** 排隊中的垃圾行（警示條） */
  pending: number;
  held: ItemId[];
  shield: boolean;
  ranking: RankEntry[] | null;
  error: string | null;
}

const INITIAL: MatchView = {
  status: "offline",
  myId: null,
  room: null,
  boards: {},
  pending: 0,
  held: [],
  shield: false,
  ranking: null,
  error: null,
};

/** 對戰伺服器網址：正式環境用環境變數（wss://…東京），開發時連本機 3211 */
function serverUrl() {
  if (process.env.NEXT_PUBLIC_MP_URL) return process.env.NEXT_PUBLIC_MP_URL;
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.hostname}:3211`;
}

export function useMatch(onGameMsg: (m: ServerMsg) => void) {
  const [view, setView] = useState<MatchView>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);
  const onMsgRef = useRef(onGameMsg);
  const helloRef = useRef<ClientMsg | null>(null);
  useEffect(() => {
    onMsgRef.current = onGameMsg;
  });

  const send = useCallback((m: ClientMsg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
  }, []);

  /** 連線並自我介紹；已連線就只更新名字/外觀 */
  const connect = useCallback(
    (hello: { name: string; petId: string; skinId: string }) =>
      new Promise<void>((resolve, reject) => {
        const msg: ClientMsg = { t: "hello", ...hello };
        helloRef.current = msg;
        const cur = wsRef.current;
        if (cur && cur.readyState === WebSocket.OPEN) {
          send(msg);
          return resolve();
        }
        setView((v) => ({ ...v, status: "connecting", error: null }));
        let ws: WebSocket;
        try {
          ws = new WebSocket(serverUrl());
        } catch {
          setView((v) => ({ ...v, status: "error", error: "connect_failed" }));
          return reject();
        }
        wsRef.current = ws;
        ws.onopen = () => {
          ws.send(JSON.stringify(msg));
          setView((v) => ({ ...v, status: "online" }));
          resolve();
        };
        ws.onerror = () => {
          setView((v) => ({ ...v, status: "error", error: "connect_failed" }));
          reject();
        };
        ws.onclose = () => {
          if (wsRef.current !== ws) return; // 已被新的連線取代（例如主動斷線重連）
          wsRef.current = null;
          // 通知遊戲：連線中斷（對局中要退出，不能卡在倒數/觀戰）
          onMsgRef.current({ t: "error", code: "disconnected" });
          setView((v) => ({ ...INITIAL, status: v.status === "error" ? "error" : "offline", error: v.room ? "disconnected" : v.error }));
        };
        ws.onmessage = (ev) => {
          let m: ServerMsg;
          try {
            m = JSON.parse(String(ev.data));
          } catch {
            return;
          }
          switch (m.t) {
            case "welcome":
              setView((v) => ({ ...v, myId: m.id }));
              break;
            case "error":
              setView((v) => ({ ...v, error: m.code }));
              break;
            case "room":
              setView((v) => ({
                ...v,
                room: { code: m.code, mode: m.mode, state: m.state, players: m.players },
                error: null,
                // 新一局開始時清掉上一局的結果
                ranking: m.state === "countdown" ? null : v.ranking,
                boards: m.state === "countdown" ? {} : v.boards,
              }));
              break;
            case "opponent":
              setView((v) => ({ ...v, boards: { ...v.boards, [m.id]: m.board } }));
              break;
            case "pending":
              setView((v) => ({ ...v, pending: m.lines }));
              break;
            case "items":
              setView((v) => ({ ...v, held: m.held }));
              break;
            case "effect":
              if (m.item === "shield") setView((v) => ({ ...v, shield: true }));
              break;
            case "itemUsed":
              // 我的護盾擋下攻擊 → 護盾消失
              // （to 為 null 代表剛開啟護盾的戰報，不是擋下攻擊）
              if (m.item === "shield" && m.to !== null) setView((v) => (v.myId === m.from ? { ...v, shield: false } : v));
              break;
            case "countdown":
              setView((v) => ({ ...v, pending: 0, shield: false, ranking: null }));
              break;
            case "end":
              setView((v) => ({ ...v, ranking: m.ranking }));
              break;
          }
          onMsgRef.current(m);
        };
      }),
    [send],
  );

  const disconnect = useCallback(() => {
    const ws = wsRef.current;
    wsRef.current = null; // 先清掉，onclose 就不會當成「意外斷線」
    ws?.close();
    setView(INITIAL);
  }, []);

  useEffect(() => () => wsRef.current?.close(), []);

  // 動作函式固定不變（只有 view 會變），避免使用端的 effect 每次 render 都重跑
  const actions = useMemo(
    () => ({
      connect,
      disconnect,
      create: (mode: MatchMode) => send({ t: "create", mode }),
      join: (code: string) => send({ t: "join", code: code.trim().toUpperCase() }),
      leave: () => {
        send({ t: "leave" });
        setView((v) => ({ ...v, room: null, boards: {}, pending: 0, held: [], ranking: null, shield: false }));
      },
      setLoadout: (items: ItemId[]) => send({ t: "loadout", items }),
      start: () => send({ t: "start" }),
      sendLock: (p: Placement) => send({ t: "lock", p }),
      useItem: (item: ItemId) => send({ t: "useItem", item }),
      sendDead: () => send({ t: "dead" }),
    }),
    [connect, disconnect, send],
  );
  return useMemo(() => ({ view, ...actions }), [view, actions]);
}

export type Match = ReturnType<typeof useMatch>;
