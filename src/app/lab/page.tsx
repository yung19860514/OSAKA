import { notFound } from "next/navigation";
import PetLab from "./PetLab";
import SceneLab from "./SceneLab";
import "../play/blockblitz/game.css";
import { bbClass } from "@/games/blockblitz/fonts";

// 開發用：檢視吉祥物各表情（正式環境不開放）
export default function LabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div className={bbClass} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 32 }}>
      <SceneLab />
      <PetLab />
    </div>
  );
}
