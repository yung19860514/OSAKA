import "./game.css";
import { bbClass } from "@/games/blockblitz/fonts";

// 方塊消消的畫風（像素字體、街機配色）只在這個資料夾底下生效
export default function BlockBlitzLayout({ children }: LayoutProps<"/play/blockblitz">) {
  return <div className={bbClass}>{children}</div>;
}
