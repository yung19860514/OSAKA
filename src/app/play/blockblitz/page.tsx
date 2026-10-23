import type { Metadata } from "next";
import GameShell from "@/components/GameShell";

export const metadata: Metadata = {
  title: "方塊消消",
  description: "免下載、打開瀏覽器就能玩的街機方塊消除遊戲",
};

export default function BlockBlitzPage() {
  return <GameShell />;
}
