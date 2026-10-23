"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { ensureGameAccount } from "@/platform/auth";

// 遊戲需要 canvas 與 localStorage，只在瀏覽器端載入
const BlockGame = dynamic(() => import("./BlockGame"), {
  ssr: false,
  loading: () => <div className="loading">LOADING…</div>,
});

export default function GameShell() {
  // 不管從大廳還是直接開網址進來，都確保這個平台帳號在方塊消消有遊戲帳號
  useEffect(() => {
    ensureGameAccount("blockblitz");
  }, []);
  return <BlockGame />;
}
