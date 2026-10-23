import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 合作遊戲用相對路徑載入素材，網址必須保留結尾的 /（Next 預設會把它拿掉）
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // 魔晶要塞（合作遊戲，靜態 HTML5）：本機開發時檔案放在 public/play/mjys/。
      // ⏳ 正式環境改成反向代理到遊戲方的伺服器（串接規格第 5 章）
      // 大廳一律連到結尾有 / 的網址（/play/mjys/）
      { source: "/play/mjys/", destination: "/play/mjys/index.html" },
      // 仙途問道（合作遊戲，靜態 HTML5）：本機放在 public/play/xiantu/
      { source: "/play/xiantu/", destination: "/play/xiantu/index.html" },
    ];
  },
};

export default nextConfig;
