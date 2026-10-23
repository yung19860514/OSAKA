import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 測試時也認得 "@/..." 路徑（跟 tsconfig 一樣指到 src/）
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
