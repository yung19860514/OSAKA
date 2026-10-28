"use client";

import dynamic from "next/dynamic";

// 登入狀態在瀏覽器裡，只在瀏覽器端載入
const ResetPasswordPage = dynamic(() => import("./ResetPasswordPage"), {
  ssr: false,
  loading: () => <div className="pf-loading">Loading…</div>,
});

export default function ResetShell() {
  return <ResetPasswordPage />;
}
