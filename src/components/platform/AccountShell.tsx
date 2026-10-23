"use client";

import dynamic from "next/dynamic";

// 會員資料存在瀏覽器（模擬會員系統），只在瀏覽器端載入
const AccountPage = dynamic(() => import("./AccountPage"), {
  ssr: false,
  loading: () => <div className="pf-loading">Loading…</div>,
});

export default function AccountShell() {
  return <AccountPage />;
}
