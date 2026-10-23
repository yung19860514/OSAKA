"use client";

import dynamic from "next/dynamic";

// 大廳要讀本機設定（語言、訪客編號），只在瀏覽器端載入
const PlatformHome = dynamic(() => import("./PlatformHome"), {
  ssr: false,
  loading: () => <div className="pf-loading">Loading…</div>,
});

export default function PlatformShell() {
  return <PlatformHome />;
}
