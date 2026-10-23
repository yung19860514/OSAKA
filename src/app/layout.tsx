import type { Metadata, Viewport } from "next";
import "./globals.css";

// 平台名稱為暫名（待老闆定案）。平台本身用一般字體；各遊戲在自己的 layout 載入自己的字體與畫風。
export const metadata: Metadata = {
  title: "遊樂平台",
  description: "一個帳號，暢玩所有遊戲。免下載、打開瀏覽器就能玩。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0d13",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className="h-full">
      <body>{children}</body>
    </html>
  );
}
