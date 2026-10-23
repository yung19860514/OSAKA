// 程式畫的占位美術（docs/05「色塊規則」）：開場一次畫成貼圖，之後有正式素材就換掉
// 風格對齊參考圖：深咖啡粗外框、飽和色、亮面
import { W, H } from '../cfg.js';
import { TOWERS } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { OUT, GOLD, shade } from './widgets.js';

const PI = Math.PI;

// 簡單的固定亂數，背景每次都長一樣
function seeded(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }

export function makeArt(scene) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const done = (key, w, h) => { if (!scene.textures.exists(key)) g.generateTexture(key, w, h); g.clear(); };

  // 光點、光環、粒子
  for (let r = 32; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.08); g.fillCircle(32, 32, r); }
  done('glow', 64, 64);
  g.lineStyle(10, 0xffffff, 1).strokeCircle(64, 64, 56);
  done('ring', 128, 128);
  g.fillStyle(0xffffff, 1).fillCircle(8, 8, 8);
  done('dot', 16, 16);
  star(g, 32, 32, 30, 13, 0xffffff);
  done('spark', 64, 64);
  g.fillStyle(0xffffff, 0.9).fillCircle(32, 32, 30);
  done('puff', 64, 64);

  // 子彈
  g.fillStyle(OUT).fillRoundedRect(4, 13, 52, 10, 5);
  g.fillStyle(0xd9b07a).fillRoundedRect(8, 15, 40, 6, 3);
  g.fillStyle(OUT).fillTriangle(46, 6, 64, 18, 46, 30);
  g.fillStyle(0x9cff6a).fillTriangle(49, 11, 59, 18, 49, 25);
  g.fillStyle(0x6cd04a).fillTriangle(4, 10, 14, 18, 4, 26);
  done('shot_crossbow', 66, 36);
  g.fillStyle(OUT).fillCircle(22, 22, 20);
  g.fillStyle(0x30303a).fillCircle(22, 22, 16);
  g.fillStyle(0x8a8a98).fillCircle(16, 16, 6);
  g.fillStyle(0xffd34a).fillCircle(33, 9, 6);
  done('shot_cannon', 44, 44);
  g.fillStyle(OUT).fillPoints(diamond(24, 24, 22, 14), true);
  g.fillStyle(0x8fe0ff).fillPoints(diamond(24, 24, 18, 10), true);
  g.fillStyle(0xffffff, 0.8).fillPoints(diamond(20, 20, 7, 4), true);
  done('shot_ice', 48, 48);
  g.fillStyle(OUT).fillCircle(20, 22, 17);
  g.fillStyle(0x6fdc4a).fillCircle(20, 22, 13);
  g.fillStyle(0xd8ffb0).fillCircle(15, 17, 5);
  done('shot_poison', 40, 44);
  // 暗影飛刀
  g.fillStyle(OUT).fillTriangle(10, 6, 62, 18, 10, 30);
  g.fillStyle(0xb48aff).fillTriangle(16, 11, 54, 18, 16, 25);
  g.fillStyle(0xf0e0ff).fillTriangle(20, 15, 46, 18, 20, 21);
  g.fillStyle(OUT).fillRoundedRect(0, 12, 14, 12, 4);
  g.fillStyle(0x4a2a6a).fillRoundedRect(2, 14, 10, 8, 3);
  done('shot_shadow', 64, 36);
  // 小龍
  g.fillStyle(OUT).fillTriangle(10, 30, 40, 18, 40, 46);
  g.fillStyle(OUT).fillTriangle(90, 30, 60, 18, 60, 46);
  g.fillStyle(0xff8a3a).fillTriangle(16, 30, 40, 22, 40, 42);
  g.fillStyle(0xff8a3a).fillTriangle(84, 30, 60, 22, 60, 42);
  g.fillStyle(OUT).fillCircle(50, 34, 20);
  g.fillStyle(0xe2483a).fillCircle(50, 34, 16);
  g.fillStyle(0xffd34a).fillTriangle(40, 18, 44, 6, 48, 18);
  g.fillStyle(0xffd34a).fillTriangle(52, 18, 56, 6, 60, 18);
  g.fillStyle(0xffffff).fillCircle(44, 30, 5).fillCircle(56, 30, 5);
  g.fillStyle(0x000000).fillCircle(45, 31, 2.5).fillCircle(57, 31, 2.5);
  done('shot_dragon', 100, 60);

  // 魔力水晶、心（城門血）、首領頭像
  g.fillStyle(OUT).fillPoints(diamond(32, 34, 26, 32), true);
  g.fillStyle(0x3fa0ff).fillPoints(diamond(32, 34, 21, 27), true);
  g.fillStyle(0x9fe0ff).fillPoints([{ x: 32, y: 8 }, { x: 46, y: 30 }, { x: 32, y: 34 }, { x: 18, y: 30 }], true);
  g.fillStyle(0xffffff, 0.8).fillCircle(26, 22, 4);
  done('ic_mana', 64, 68);
  heart(g, 32, 32, 26, OUT); heart(g, 32, 31, 21, 0xff4a4a);
  g.fillStyle(0xffffff, 0.7).fillCircle(22, 22, 5);
  done('ic_heart', 64, 64);
  g.fillStyle(OUT).fillCircle(40, 42, 34);
  g.fillStyle(0x2f7a24).fillCircle(40, 42, 29);
  crown(g, 40, 14, 26);
  g.fillStyle(0xffffff).fillCircle(31, 42, 7).fillCircle(49, 42, 7);
  g.fillStyle(0xff2a2a).fillCircle(31, 43, 3.5).fillCircle(49, 43, 3.5);
  done('ic_boss', 80, 80);

  // 塔：每種 3 型（Lv1–4 / Lv5–6 / Lv7）
  for (const id in TOWERS) for (let tier = 0; tier < 3; tier++) { drawTower(g, id, tier); done(`twg_${id}_${tier}`, 170, 170); }
  // 怪物
  for (const id in ENEMIES) { const s = drawEnemy(g, id); done(`eng_${id}`, s, s); }
  // 城門
  drawGate(g); done('gate_gen', 180, 170);
  // 資源圖示：体力、钻石、金币、鎖、星
  g.fillStyle(OUT).fillPoints([{ x: 38, y: 2 }, { x: 10, y: 38 }, { x: 30, y: 38 }, { x: 22, y: 62 }, { x: 54, y: 22 }, { x: 34, y: 22 }, { x: 46, y: 2 }], true);
  g.fillStyle(0xffd23a).fillPoints([{ x: 38, y: 7 }, { x: 17, y: 34 }, { x: 34, y: 34 }, { x: 27, y: 54 }, { x: 48, y: 26 }, { x: 30, y: 26 }, { x: 41, y: 7 }], true);
  done('ic_energy', 64, 64);
  g.fillStyle(OUT).fillPoints([{ x: 14, y: 8 }, { x: 50, y: 8 }, { x: 62, y: 24 }, { x: 32, y: 60 }, { x: 2, y: 24 }], true);
  g.fillStyle(0xff4fa8).fillPoints([{ x: 17, y: 12 }, { x: 47, y: 12 }, { x: 56, y: 24 }, { x: 32, y: 54 }, { x: 8, y: 24 }], true);
  g.fillStyle(0xffa8d8).fillPoints([{ x: 17, y: 12 }, { x: 47, y: 12 }, { x: 56, y: 24 }, { x: 8, y: 24 }], true);
  g.fillStyle(0xffffff, 0.8).fillTriangle(20, 15, 30, 15, 22, 22);
  done('ic_gem', 64, 64);
  g.fillStyle(OUT).fillCircle(32, 33, 29);
  g.fillStyle(0xd9900f).fillCircle(32, 32, 25);
  g.fillStyle(0xffd23a).fillCircle(32, 30, 22);
  star(g, 32, 31, 13, 6, 0xffeb9a);
  g.fillStyle(0xffffff, 0.6).fillEllipse(24, 18, 14, 7);
  done('ic_coin', 64, 66);
  g.fillStyle(OUT).fillRoundedRect(10, 26, 44, 34, 8);
  g.fillStyle(0x9aa0aa).fillRoundedRect(14, 30, 36, 26, 6);
  g.lineStyle(9, OUT).beginPath().arc(32, 26, 13, Math.PI, 0).strokePath();
  g.lineStyle(5, 0xc4c8d0).beginPath().arc(32, 26, 13, Math.PI, 0).strokePath();
  g.fillStyle(OUT).fillCircle(32, 42, 5);
  done('ic_lock', 64, 64);
  star(g, 32, 33, 30, 13, OUT); star(g, 32, 31, 25, 11, 0xffd23a); star(g, 30, 27, 10, 4, 0xfff4b0);
  done('ic_star', 64, 64);
  star(g, 32, 33, 30, 13, OUT); star(g, 32, 31, 25, 11, 0x4a3a30);
  done('ic_star_empty', 64, 64);
  // 隊長頭像（莉亞：橘色馬尾）
  g.fillStyle(OUT).fillCircle(64, 64, 62);
  g.fillStyle(0x3a6fd8).fillCircle(64, 64, 57);
  g.fillStyle(OUT).fillCircle(98, 40, 22); g.fillStyle(0xff8a2a).fillCircle(98, 40, 18);
  g.fillStyle(OUT).fillCircle(64, 70, 38); g.fillStyle(0xffd9b0).fillCircle(64, 70, 34);
  g.fillStyle(0xff8a2a).fillEllipse(64, 44, 76, 34); g.fillStyle(0xff8a2a).fillTriangle(30, 44, 40, 70, 46, 44);
  g.fillStyle(0x2a1408).fillEllipse(52, 74, 9, 13).fillEllipse(76, 74, 9, 13);
  g.fillStyle(0xffffff).fillCircle(54, 70, 2.5).fillCircle(78, 70, 2.5);
  g.fillStyle(0xff8a8a, 0.6).fillCircle(44, 86, 6).fillCircle(84, 86, 6);
  g.lineStyle(3, 0x8a3a1a).beginPath().arc(64, 88, 7, 0.2, Math.PI - 0.2).strokePath();
  done('avatar_lia', 128, 128);
  // 博格：矮人工匠，紅鬍子、護目鏡
  g.fillStyle(OUT).fillCircle(64, 64, 62);
  g.fillStyle(0x6a8a3a).fillCircle(64, 64, 57);
  g.fillStyle(OUT).fillCircle(64, 62, 36); g.fillStyle(0xf0c090).fillCircle(64, 62, 32);
  g.fillStyle(OUT).fillEllipse(64, 92, 78, 62); g.fillStyle(0xd0502a).fillEllipse(64, 92, 72, 56);
  g.fillStyle(0xe8703a).fillEllipse(56, 86, 20, 30);
  g.fillStyle(0x8a5a2a).fillEllipse(64, 36, 70, 26);
  g.fillStyle(OUT).fillRect(28, 50, 72, 8);
  g.fillStyle(OUT).fillCircle(48, 54, 13).fillCircle(80, 54, 13);
  g.fillStyle(0x8fe0ff).fillCircle(48, 54, 9).fillCircle(80, 54, 9);
  g.fillStyle(0xffffff, 0.8).fillCircle(45, 51, 3).fillCircle(77, 51, 3);
  g.fillStyle(0xe8a070).fillEllipse(64, 70, 14, 10);
  done('avatar_borg', 128, 128);
  // 國王：白鬍子、金冠
  g.fillStyle(OUT).fillCircle(64, 64, 62);
  g.fillStyle(0x8a2a4a).fillCircle(64, 64, 57);
  g.fillStyle(OUT).fillCircle(64, 66, 36); g.fillStyle(0xf4d0b0).fillCircle(64, 66, 32);
  g.fillStyle(OUT).fillEllipse(64, 96, 70, 54); g.fillStyle(0xf4f4f8).fillEllipse(64, 96, 64, 48);
  g.fillStyle(0xf4f4f8).fillEllipse(50, 80, 26, 12).fillEllipse(78, 80, 26, 12);
  g.fillStyle(0x2a1408).fillEllipse(52, 64, 8, 10).fillEllipse(76, 64, 8, 10);
  g.fillStyle(0xf4f4f8).fillEllipse(52, 54, 16, 6).fillEllipse(76, 54, 16, 6);
  crown(g, 64, 18, 30);
  done('avatar_king', 128, 128);
  // 哥布林王：綠臉、紅眼、金冠、獠牙
  g.fillStyle(OUT).fillCircle(64, 64, 62);
  g.fillStyle(0x5a1a1a).fillCircle(64, 64, 57);
  g.fillStyle(OUT).fillTriangle(14, 52, 40, 60, 34, 78).fillTriangle(114, 52, 88, 60, 94, 78);
  g.fillStyle(0x4f9a2a).fillTriangle(20, 54, 40, 62, 35, 74).fillTriangle(108, 54, 88, 62, 93, 74);
  g.fillStyle(OUT).fillCircle(64, 72, 38); g.fillStyle(0x4f9a2a).fillCircle(64, 72, 34);
  g.fillStyle(0x7ac04a).fillEllipse(64, 88, 40, 20);
  g.fillStyle(0xffffff).fillCircle(50, 66, 9).fillCircle(78, 66, 9);
  g.fillStyle(0xff2a2a).fillCircle(51, 67, 5).fillCircle(77, 67, 5);
  g.lineStyle(4, OUT).lineBetween(40, 54, 58, 60).lineBetween(88, 54, 70, 60);
  g.fillStyle(OUT).fillEllipse(64, 90, 34, 14);
  g.fillStyle(0xffffff).fillTriangle(52, 86, 58, 86, 55, 98).fillTriangle(70, 86, 76, 86, 73, 98);
  crown(g, 64, 22, 28);
  done('avatar_goblinking', 128, 128);
  // 底部導航圖示
  g.fillStyle(OUT).fillRoundedRect(22, 30, 76, 70, 18); g.fillStyle(0xd9d9e0).fillRoundedRect(28, 36, 64, 58, 14);
  g.fillStyle(0x9aa0aa).fillRect(28, 60, 64, 12); g.fillStyle(OUT).fillRoundedRect(40, 52, 40, 10, 4);
  g.fillStyle(0xe8453a).fillTriangle(60, 4, 52, 32, 68, 32);
  done('nav_captain', 120, 110);
  crown(g, 60, 34, 46);
  done('nav_chapter', 120, 110);
  g.fillStyle(OUT).fillRect(16, 30, 26, 74).fillRect(78, 30, 26, 74).fillRect(30, 50, 60, 54);
  g.fillStyle(0xb4a894).fillRect(20, 34, 18, 66).fillRect(82, 34, 18, 66).fillRect(34, 54, 52, 46);
  for (const x of [16, 30, 78, 92]) { g.fillStyle(OUT).fillRect(x, 20, 12, 14); g.fillStyle(0xb4a894).fillRect(x + 2, 22, 8, 10); }
  g.fillStyle(OUT).fillRoundedRect(46, 68, 28, 36, { tl: 14, tr: 14, bl: 0, br: 0 }); g.fillStyle(0x8b5a2b).fillRoundedRect(49, 71, 22, 33, { tl: 11, tr: 11, bl: 0, br: 0 });
  g.fillStyle(0xe8453a).fillTriangle(29, 4, 29, 20, 44, 12); g.fillStyle(OUT).fillRect(27, 4, 3, 26);
  done('nav_fort', 120, 110);
  g.fillStyle(OUT).fillRoundedRect(14, 20, 92, 76, 10);
  g.fillStyle(0x8a3a2a).fillRoundedRect(18, 24, 84, 68, 8);
  g.fillStyle(0xf4e6c8).fillRect(24, 28, 34, 58).fillRect(62, 28, 34, 58);
  g.fillStyle(OUT).fillRect(58, 24, 4, 68);
  for (const y of [40, 52, 64, 76]) { g.fillStyle(0xb8a888).fillRect(28, y, 26, 4).fillRect(66, y, 26, 4); }
  star(g, 60, 18, 14, 6, GOLD);
  done('nav_codex', 120, 110);
  // 零件圖示（64×64）
  // 弩机：木頭弓臂＋齒輪
  g.lineStyle(10, OUT).beginPath().arc(32, 40, 26, PI * 1.1, PI * 1.9).strokePath();
  g.lineStyle(6, 0x9a6a3a).beginPath().arc(32, 40, 26, PI * 1.1, PI * 1.9).strokePath();
  gear(g, 32, 40, 13, 0xc4c8d0);
  g.fillStyle(OUT).fillRect(29, 6, 6, 30); g.fillStyle(0x9cff6a).fillTriangle(26, 10, 38, 10, 32, 2);
  done('part_bolt', 64, 64);
  // 炮管：銅色短炮管
  g.fillStyle(OUT).fillRoundedRect(10, 18, 44, 30, 10);
  g.fillStyle(0xc87a3a).fillRoundedRect(14, 22, 36, 22, 8);
  g.fillStyle(0xf0b070).fillRect(16, 24, 32, 5);
  g.fillStyle(OUT).fillEllipse(52, 33, 14, 30); g.fillStyle(0x2a1a10).fillEllipse(52, 33, 8, 22);
  g.fillStyle(GOLD).fillRect(22, 22, 5, 22).fillRect(36, 22, 5, 22);
  done('part_barrel', 64, 64);
  // 魔晶：藍色水晶
  g.fillStyle(OUT).fillPoints([{ x: 32, y: 2 }, { x: 54, y: 24 }, { x: 32, y: 62 }, { x: 10, y: 24 }], true);
  g.fillStyle(0x3f8cff).fillPoints([{ x: 32, y: 8 }, { x: 49, y: 25 }, { x: 32, y: 56 }, { x: 15, y: 25 }], true);
  g.fillStyle(0x9fe0ff).fillPoints([{ x: 32, y: 8 }, { x: 49, y: 25 }, { x: 32, y: 30 }, { x: 15, y: 25 }], true);
  g.fillStyle(0xffffff, 0.9).fillCircle(26, 20, 3);
  done('part_crystal', 64, 64);
  // 符文：金色石板＋紫色符號
  g.fillStyle(OUT).fillRoundedRect(8, 6, 48, 54, 10);
  g.fillStyle(0xd9a83a).fillRoundedRect(12, 10, 40, 46, 8);
  g.fillStyle(0xffe27a).fillRoundedRect(12, 10, 40, 14, { tl: 8, tr: 8, bl: 2, br: 2 });
  g.lineStyle(5, 0x8a3ad0).beginPath().moveTo(22, 46).lineTo(32, 18).lineTo(42, 46).moveTo(24, 36).lineTo(40, 36).strokePath();
  done('part_rune', 64, 64);
  // 万能零件：彩虹齒輪＋星星
  for (let i = 0; i < 6; i++) { const a = i / 6 * PI * 2; g.fillStyle([0xff5a5a, 0xffc13b, 0x7aff5a, 0x3fd0ff, 0x7a6aff, 0xff6ad0][i]).slice(32, 32, 28, a, a + PI / 3).fillPath(); }
  gear(g, 32, 32, 0, 0);
  g.lineStyle(5, OUT).strokeCircle(32, 32, 28);
  star(g, 32, 33, 15, 7, OUT); star(g, 32, 32, 12, 5, 0xffffff);
  done('part_universal', 64, 64);
  // 主頁側邊圖示（96×96 方形亮面鈕）
  sideIcon(g, 0x9a2420, gg => { // 活動：旗子
    gg.fillStyle(OUT).fillRect(22, 14, 7, 68);
    gg.fillStyle(OUT).fillPoints([{ x: 27, y: 14 }, { x: 78, y: 22 }, { x: 64, y: 38 }, { x: 78, y: 54 }, { x: 27, y: 50 }], true);
    gg.fillStyle(0xffc13b).fillPoints([{ x: 30, y: 19 }, { x: 70, y: 25 }, { x: 58, y: 38 }, { x: 70, y: 50 }, { x: 30, y: 46 }], true);
    star(gg, 46, 34, 9, 4, 0xe8453a);
  });
  done('side_event', 96, 96);
  sideIcon(g, 0x9a2420, gg => { // 商店：帳篷
    gg.fillStyle(OUT).fillTriangle(10, 44, 86, 44, 48, 12);
    for (let i = 0; i < 5; i++) gg.fillStyle(i % 2 ? 0xffffff : 0xe8453a).fillTriangle(16 + i * 13, 42, 29 + i * 13, 42, 48, 16);
    gg.fillStyle(OUT).fillRect(18, 44, 60, 36); gg.fillStyle(0xc87a3a).fillRect(22, 48, 52, 28);
    gg.fillStyle(0xffd34a).fillCircle(48, 62, 9);
  });
  done('side_shop', 96, 96);
  sideIcon(g, 0x2a6ad8, gg => { // 簽到：日曆
    gg.fillStyle(OUT).fillRoundedRect(16, 20, 64, 62, 10);
    gg.fillStyle(0xffffff).fillRoundedRect(20, 24, 56, 54, 8);
    gg.fillStyle(0xe8453a).fillRoundedRect(20, 24, 56, 16, { tl: 8, tr: 8, bl: 0, br: 0 });
    gg.fillStyle(OUT).fillRect(30, 14, 7, 16).fillRect(59, 14, 7, 16);
    gg.lineStyle(7, 0x4cc93a).beginPath().moveTo(32, 58).lineTo(44, 70).lineTo(66, 46).strokePath();
  });
  done('side_signin', 96, 96);
  sideIcon(g, 0x2a6ad8, gg => { // 任務：卷軸
    gg.fillStyle(OUT).fillRoundedRect(20, 16, 56, 66, 8);
    gg.fillStyle(0xf4e6c8).fillRoundedRect(24, 20, 48, 58, 6);
    gg.fillStyle(OUT).fillRoundedRect(14, 12, 68, 14, 7).fillRoundedRect(14, 72, 68, 14, 7);
    gg.fillStyle(0xc8935a).fillRoundedRect(17, 14, 62, 9, 4).fillRoundedRect(17, 74, 62, 9, 4);
    for (const y of [36, 48, 60]) { gg.fillStyle(0x4cc93a).fillCircle(32, y, 4); gg.fillStyle(0x9a8a6a).fillRect(40, y - 2, 26, 5); }
  });
  done('side_tasks', 96, 96);
  sideIcon(g, 0x7a2ad0, gg => { // 賽季：盾牌
    gg.fillStyle(OUT).fillPoints([{ x: 48, y: 10 }, { x: 80, y: 22 }, { x: 76, y: 56 }, { x: 48, y: 86 }, { x: 20, y: 56 }, { x: 16, y: 22 }], true);
    gg.fillStyle(0xffc13b).fillPoints([{ x: 48, y: 16 }, { x: 74, y: 26 }, { x: 70, y: 54 }, { x: 48, y: 79 }, { x: 26, y: 54 }, { x: 22, y: 26 }], true);
    gg.fillStyle(0xe8453a).fillPoints([{ x: 48, y: 24 }, { x: 66, y: 31 }, { x: 63, y: 52 }, { x: 48, y: 70 }, { x: 33, y: 52 }, { x: 30, y: 31 }], true);
    star(gg, 48, 47, 13, 6, 0xfff4b0);
  });
  done('side_season', 96, 96);
  // 商店圖示（96×96）：禮物、三種寶箱、金銀卡、存錢筒
  const box = (col, rib) => {
    g.fillStyle(OUT).fillRoundedRect(12, 36, 72, 54, 10);
    g.fillStyle(col).fillRoundedRect(16, 40, 64, 46, 8);
    g.fillStyle(OUT).fillRoundedRect(8, 26, 80, 22, 8);
    g.fillStyle(shade(col, 0.25)).fillRoundedRect(12, 29, 72, 16, 6);
    g.fillStyle(rib).fillRect(42, 26, 12, 64);
  };
  box(0xe8453a, 0xffd34a);
  g.fillStyle(OUT).fillEllipse(36, 20, 30, 20).fillEllipse(60, 20, 30, 20);
  g.fillStyle(0xffd34a).fillEllipse(36, 20, 22, 13).fillEllipse(60, 20, 22, 13);
  done('ic_gift', 96, 96);
  const chest = (body, trim, gem) => {
    g.fillStyle(OUT).fillRoundedRect(8, 40, 80, 50, 10);
    g.fillStyle(body).fillRoundedRect(12, 44, 72, 42, 8);
    g.fillStyle(OUT).fillRoundedRect(8, 16, 80, 34, { tl: 30, tr: 30, bl: 6, br: 6 });
    g.fillStyle(shade(body, 0.2)).fillRoundedRect(12, 20, 72, 26, { tl: 26, tr: 26, bl: 4, br: 4 });
    g.fillStyle(trim).fillRect(12, 44, 72, 7).fillRect(20, 20, 8, 66).fillRect(68, 20, 8, 66);
    g.fillStyle(OUT).fillRoundedRect(40, 40, 16, 20, 4); g.fillStyle(gem).fillRoundedRect(43, 43, 10, 14, 3);
  };
  chest(0x9a6a3a, 0x6a6a72, 0xffd34a); done('chest1', 96, 96);
  chest(0x5a6a8a, 0xd0d8e8, 0x3fa0ff); done('chest2', 96, 96);
  chest(0xd9a020, 0xfff0a0, 0xb05cff); done('chest3', 96, 96);
  const card = (col, hi) => {
    g.fillStyle(OUT).fillRoundedRect(8, 18, 80, 60, 10);
    g.fillStyle(col).fillRoundedRect(12, 22, 72, 52, 8);
    g.fillStyle(hi).fillRoundedRect(12, 22, 72, 16, { tl: 8, tr: 8, bl: 2, br: 2 });
    star(g, 48, 52, 14, 6, OUT); star(g, 48, 51, 11, 5, 0xffffff);
  };
  card(0xd9a020, 0xfff0a0); done('card_gold', 96, 96);
  card(0x8a94a8, 0xe0e6f0); done('card_silver', 96, 96);
  g.fillStyle(OUT).fillEllipse(48, 54, 76, 58);
  g.fillStyle(0xff8ab0).fillEllipse(48, 54, 68, 50);
  g.fillStyle(0xffb8d0).fillEllipse(40, 44, 30, 16);
  g.fillStyle(OUT).fillRect(36, 26, 24, 7);
  g.fillStyle(0xd05a80).fillEllipse(82, 56, 14, 18);
  g.fillStyle(OUT).fillCircle(64, 48, 4);
  g.fillStyle(OUT).fillRect(24, 76, 10, 12).fillRect(60, 76, 10, 12);
  done('piggy', 96, 96);
  // 主選單的備用背景（還沒有 bg_home / bg_login 時用）
  drawMenuBg(g); done('bg_menu_gen', W, H);
  g.destroy();
}

// 戰場背景：照章節版面（路線、格子）畫一張，沒有正式背景圖時用
export function makeBattleBg(scene, key, layout) {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  drawBattleBg(g, layout);
  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

// 選關地圖背景（1080 × h），nodes＝關卡節點座標
export function makeMapBg(scene, key, h, nodes) {
  if (scene.textures.exists(key)) return key;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const rnd = seeded(77);
  for (let i = 0; i < 60; i++) g.fillStyle(lerpColor(0x2f5a26, 0x6aa23f, i / 59), 1).fillRect(0, Math.floor(i * h / 60), W, Math.ceil(h / 60) + 1);
  for (let i = 0; i < 120; i++) g.fillStyle(rnd() < 0.5 ? 0x8cc85a : 0x24461c, 0.12).fillEllipse(rnd() * W, rnd() * h, 90 + rnd() * 200, 40 + rnd() * 80);
  // 河流
  const river = [];
  for (let y = -40; y <= h + 40; y += 60) river.push({ x: 960 + Math.sin(y / 260) * 70, y });
  g.lineStyle(120, 0x2a6a9a, 1).strokePoints(river, false);
  g.lineStyle(90, 0x4aa0d8, 1).strokePoints(river, false);
  g.lineStyle(20, 0xa8e0ff, 0.5).strokePoints(river.map(p => ({ x: p.x - 18, y: p.y })), false);
  // 節點之間的路
  g.lineStyle(70, 0x5a3a20, 1).strokePoints(nodes, false);
  for (const p of nodes) g.fillStyle(0x5a3a20).fillCircle(p.x, p.y, 35);
  g.lineStyle(54, 0xc8935a, 1).strokePoints(nodes, false);
  for (const p of nodes) g.fillStyle(0xc8935a).fillCircle(p.x, p.y, 27);
  g.lineStyle(10, 0xe8c08a, 0.7).strokePoints(nodes, false);
  // 裝飾
  const free = (x, y, m) => {
    for (let i = 0; i < nodes.length - 1; i++) if (distSeg(x, y, nodes[i], nodes[i + 1]) < 70 + m) return false;
    for (const p of river) if (Math.hypot(x - p.x, y - p.y) < 80 + m) return false;
    return true;
  };
  for (let i = 0; i < 700; i++) {
    const x = rnd() * W, y = rnd() * h, k = rnd();
    if (k < 0.25) { if (free(x, y, 40)) bush(g, x, y, 24 + rnd() * 22); }
    else if (k < 0.35) { if (free(x, y, 30)) pine(g, x, y, 30 + rnd() * 20); }
    else if (k < 0.45) { if (free(x, y, 16)) rock(g, x, y, 12 + rnd() * 12); }
    else if (k < 0.7) { if (free(x, y, 4)) g.fillStyle([0xff8ac8, 0xfff07a, 0xffffff][Math.floor(rnd() * 3)], 0.9).fillCircle(x, y, 4 + rnd() * 2); }
    else if (free(x, y, 2)) tuft(g, x, y);
  }
  g.generateTexture(key, W, h);
  g.destroy();
  return key;
}

function diamond(cx, cy, rx, ry) { return [{ x: cx, y: cy - ry }, { x: cx + rx, y: cy }, { x: cx, y: cy + ry }, { x: cx - rx, y: cy }]; }
function star(g, cx, cy, ro, ri, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) { const a = -PI / 2 + i * PI / 5, r = i % 2 ? ri : ro; pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); }
  g.fillStyle(c, 1).fillPoints(pts, true);
}
function gear(g, cx, cy, r, c) {
  if (!r) return;
  for (let i = 0; i < 8; i++) { const a = i / 8 * PI * 2; g.fillStyle(OUT).fillCircle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.38); }
  g.fillStyle(OUT).fillCircle(cx, cy, r + 2);
  g.fillStyle(c).fillCircle(cx, cy, r - 1);
  g.fillStyle(OUT).fillCircle(cx, cy, r * 0.35);
}
function sideIcon(g, col, draw) {
  g.fillStyle(OUT).fillRoundedRect(2, 4, 92, 90, 20);
  g.fillStyle(shade(col, -0.3)).fillRoundedRect(6, 8, 84, 82, 16);
  g.fillStyle(col).fillRoundedRect(6, 6, 84, 74, 16);
  g.fillStyle(shade(col, 0.3)).fillRoundedRect(10, 10, 76, 26, { tl: 13, tr: 13, bl: 4, br: 4 });
  draw(g);
}
function heart(g, cx, cy, r, c) {
  g.fillStyle(c, 1);
  g.fillCircle(cx - r * 0.5, cy - r * 0.2, r * 0.55).fillCircle(cx + r * 0.5, cy - r * 0.2, r * 0.55);
  g.fillTriangle(cx - r * 1.02, cy - r * 0.05, cx + r * 1.02, cy - r * 0.05, cx, cy + r);
}
function crown(g, cx, by, w) {
  const h = w * 0.7;
  const pts = [{ x: cx - w, y: by + h }, { x: cx - w, y: by }, { x: cx - w * 0.5, y: by + h * 0.45 }, { x: cx, y: by - h * 0.2 }, { x: cx + w * 0.5, y: by + h * 0.45 }, { x: cx + w, y: by }, { x: cx + w, y: by + h }];
  g.fillStyle(OUT, 1).fillPoints(pts.map(p => ({ x: p.x + (p.x > cx ? 4 : p.x < cx ? -4 : 0), y: p.y + 4 })), true);
  g.fillStyle(0xffc93b, 1).fillPoints(pts, true);
  g.fillStyle(0xff4a6a, 1).fillCircle(cx, by + h * 0.55, w * 0.16);
}

// ───── 塔 ─────
function drawTower(g, id, tier) {
  const def = TOWERS[id], col = def.color, cx = 85;
  const bw = [96, 106, 114][tier], bh = [70, 78, 84][tier], bottom = 132, x0 = cx - bw / 2, y0 = bottom - bh;
  if (tier === 2) { for (let r = 80; r > 30; r -= 6) { g.fillStyle(shade(col, 0.4), 0.06); g.fillCircle(cx, 95, r); } }
  g.fillStyle(0x000000, 0.28).fillEllipse(cx, 152, 140, 30);
  // 石座
  g.fillStyle(OUT).fillEllipse(cx, 140, 136, 46);
  g.fillStyle(0x7d6d5e).fillEllipse(cx, 137, 126, 38);
  g.fillStyle(0xa39380).fillEllipse(cx, 132, 116, 26);
  // 塔身
  g.fillStyle(OUT).fillRoundedRect(x0 - 6, y0 - 6, bw + 12, bh + 12, 24);
  g.fillStyle(shade(col, -0.3)).fillRoundedRect(x0, y0, bw, bh, 20);
  g.fillStyle(col).fillRoundedRect(x0, y0, bw, bh * 0.74, { tl: 20, tr: 20, bl: 12, br: 12 });
  g.fillStyle(shade(col, 0.35)).fillRoundedRect(x0 + 5, y0 + 4, bw - 10, bh * 0.24, { tl: 16, tr: 16, bl: 6, br: 6 });
  g.fillStyle(0xffffff, 0.4).fillRoundedRect(x0 + 12, y0 + 7, bw * 0.3, 7, 3);
  if (tier >= 1) { // 金邊＋鉚釘
    g.fillStyle(OUT).fillRect(x0, bottom - 22, bw, 14);
    g.fillStyle(GOLD).fillRect(x0, bottom - 20, bw, 10);
    g.fillStyle(0xfff0a0).fillRect(x0, bottom - 20, bw, 3);
    for (const sx of [x0 + 14, cx, x0 + bw - 14]) { g.fillStyle(OUT).fillCircle(sx, bottom - 15, 5); g.fillStyle(0xfff0a0).fillCircle(sx, bottom - 15, 3); }
  }
  topper(g, id, cx, y0, tier, col);
  if (tier === 2) { // 頂端寶石
    g.fillStyle(OUT).fillPoints(diamond(cx, 14, 14, 14), true);
    g.fillStyle(0xff5ad0).fillPoints(diamond(cx, 14, 10, 10), true);
    g.fillStyle(0xffffff, 0.8).fillCircle(cx - 3, 10, 3);
  }
}

function topper(g, id, cx, ty, tier, col) {
  const k = 1 + tier * 0.12;
  switch (id) {
    case 'crossbow': {
      g.lineStyle(14 * k, OUT).beginPath().arc(cx, ty + 30, 52 * k, PI * 1.12, PI * 1.88).strokePath();
      g.lineStyle(8 * k, 0x8b5a2b).beginPath().arc(cx, ty + 30, 52 * k, PI * 1.12, PI * 1.88).strokePath();
      g.lineStyle(3, 0xf4e6c8).lineBetween(cx - 46 * k, ty + 10, cx + 46 * k, ty + 10);
      g.fillStyle(OUT).fillRoundedRect(cx - 6, ty - 34 * k, 12, 50 * k, 5);
      g.fillStyle(0xd9b07a).fillRoundedRect(cx - 3, ty - 31 * k, 6, 44 * k, 3);
      g.fillStyle(OUT).fillTriangle(cx - 12, ty - 30 * k, cx + 12, ty - 30 * k, cx, ty - 52 * k);
      g.fillStyle(0x9cff6a).fillTriangle(cx - 7, ty - 32 * k, cx + 7, ty - 32 * k, cx, ty - 46 * k);
      break;
    }
    case 'cannon': {
      const bw = 40 * k;
      g.fillStyle(OUT).fillRoundedRect(cx - bw / 2 - 6, ty - 46 * k, bw + 12, 62 * k, 12);
      g.fillStyle(0x34343e).fillRoundedRect(cx - bw / 2, ty - 40 * k, bw, 54 * k, 9);
      g.fillStyle(0x6a6a7a).fillRoundedRect(cx - bw / 2 + 5, ty - 38 * k, 9, 48 * k, 4);
      g.fillStyle(OUT).fillEllipse(cx, ty - 42 * k, bw + 10, 22);
      g.fillStyle(0x16161c).fillEllipse(cx, ty - 42 * k, bw - 4, 13);
      g.fillStyle(GOLD).fillRect(cx - bw / 2, ty - 14 * k, bw, 8);
      g.fillStyle(0xffa23a).fillCircle(cx + bw / 2 + 4, ty - 46 * k, 7);
      break;
    }
    case 'ice': {
      const c1 = 0x8fe0ff, c2 = 0x4fb8f0;
      for (const [dx, h, w] of [[-26, 46, 18], [26, 50, 18], [0, 70, 24]]) {
        const bx = cx + dx * k, by = ty + 10;
        g.fillStyle(OUT).fillPoints([{ x: bx - w - 5, y: by + 4 }, { x: bx, y: by - h * k - 8 }, { x: bx + w + 5, y: by + 4 }], true);
        g.fillStyle(c2).fillPoints([{ x: bx - w, y: by }, { x: bx, y: by - h * k }, { x: bx + w, y: by }], true);
        g.fillStyle(c1).fillPoints([{ x: bx - w * 0.5, y: by }, { x: bx, y: by - h * k }, { x: bx + w * 0.2, y: by }], true);
      }
      break;
    }
    case 'poison': {
      const r = 30 * k;
      g.fillStyle(OUT).fillRoundedRect(cx - 13, ty - r * 2 - 16, 26, 34, 6);
      g.fillStyle(0xd8e8f0).fillRoundedRect(cx - 8, ty - r * 2 - 11, 16, 26, 4);
      g.fillStyle(OUT).fillCircle(cx, ty - r + 4, r + 6);
      g.fillStyle(0xd8e8f0).fillCircle(cx, ty - r + 4, r);
      g.fillStyle(0x5cc23c).fillCircle(cx, ty - r + 10, r - 6);
      g.fillStyle(0xb6ff7a).fillCircle(cx - 8, ty - r + 2, 7).fillCircle(cx + 9, ty - r + 14, 5);
      g.fillStyle(0xffffff, 0.6).fillEllipse(cx - 12, ty - r - 8, 10, 16);
      break;
    }
    case 'alchemy': {
      const r = 28 * k;
      g.lineStyle(10, OUT).beginPath().arc(cx, ty - 4, r + 10, PI * 0.15, PI * 0.85, true).strokePath();
      g.lineStyle(6, GOLD).beginPath().arc(cx, ty - 4, r + 10, PI * 0.15, PI * 0.85, true).strokePath();
      g.fillStyle(OUT).fillCircle(cx, ty - r - 4, r + 6);
      g.fillStyle(0x7a2ad0).fillCircle(cx, ty - r - 4, r);
      g.fillStyle(0xc88cff).fillCircle(cx - 6, ty - r - 10, r * 0.6);
      g.fillStyle(0xffffff, 0.85).fillCircle(cx - 12, ty - r - 16, 6);
      break;
    }
    case 'lightning': {
      g.fillStyle(OUT).fillRoundedRect(cx - 10, ty - 56 * k, 20, 64 * k, 6);
      g.fillStyle(0xc87a3a).fillRoundedRect(cx - 6, ty - 52 * k, 12, 58 * k, 4);
      for (let i = 0; i < 3; i++) {
        const y = ty - 8 - i * 16 * k, w = (44 - i * 8) * k;
        g.fillStyle(OUT).fillEllipse(cx, y, w + 8, 16);
        g.fillStyle(0xe0a050).fillEllipse(cx, y - 1, w, 9);
      }
      g.fillStyle(OUT).fillCircle(cx, ty - 62 * k, 17);
      g.fillStyle(0x8fd0ff).fillCircle(cx, ty - 62 * k, 13);
      g.fillStyle(0xffffff).fillCircle(cx - 4, ty - 66 * k, 4);
      break;
    }
    case 'holy': {
      g.lineStyle(14, OUT).strokeEllipse(cx, ty - 36 * k, 76 * k, 26 * k);
      g.lineStyle(8, 0xffe27a).strokeEllipse(cx, ty - 36 * k, 76 * k, 26 * k);
      star(g, cx, ty - 4, 30 * k + 4, 13 * k + 3, OUT);
      star(g, cx, ty - 4, 26 * k, 11 * k, 0xfff4c0);
      break;
    }
    case 'dragon': {
      g.fillStyle(OUT).fillTriangle(cx - 66 * k, ty - 14, cx - 14, ty - 40 * k, cx - 18, ty + 6);
      g.fillStyle(OUT).fillTriangle(cx + 66 * k, ty - 14, cx + 14, ty - 40 * k, cx + 18, ty + 6);
      g.fillStyle(0xff8a3a).fillTriangle(cx - 56 * k, ty - 14, cx - 16, ty - 32 * k, cx - 18, ty);
      g.fillStyle(0xff8a3a).fillTriangle(cx + 56 * k, ty - 14, cx + 16, ty - 32 * k, cx + 18, ty);
      g.fillStyle(OUT).fillCircle(cx, ty - 22 * k, 30 * k);
      g.fillStyle(col).fillCircle(cx, ty - 22 * k, 25 * k);
      g.fillStyle(0xffd34a).fillTriangle(cx - 18, ty - 40 * k, cx - 12, ty - 60 * k, cx - 6, ty - 42 * k);
      g.fillStyle(0xffd34a).fillTriangle(cx + 18, ty - 40 * k, cx + 12, ty - 60 * k, cx + 6, ty - 42 * k);
      g.fillStyle(0xffffff).fillCircle(cx - 10, ty - 26 * k, 7).fillCircle(cx + 10, ty - 26 * k, 7);
      g.fillStyle(0x000000).fillCircle(cx - 9, ty - 25 * k, 3.5).fillCircle(cx + 11, ty - 25 * k, 3.5);
      g.fillStyle(shade(col, 0.4)).fillEllipse(cx, ty - 10 * k, 22, 12);
      break;
    }
  }
}

// ───── 怪物 ─────
function drawEnemy(g, id) {
  const def = ENEMIES[id], r = def.r, s = Math.ceil(r * 2 + 50), cx = s / 2, cy = s / 2 + 6, col = def.color;
  g.fillStyle(0x000000, 0.25).fillEllipse(cx, cy + r * 0.92, r * 1.7, r * 0.5);
  if (def.boss) { // 紅披風
    g.fillStyle(OUT).fillEllipse(cx, cy + r * 0.25, r * 2.3, r * 1.7);
    g.fillStyle(0xc0282a).fillEllipse(cx, cy + r * 0.25, r * 2.1, r * 1.5);
  }
  // 尖耳朵
  for (const sgn of [-1, 1]) {
    g.fillStyle(OUT).fillTriangle(cx + sgn * r * 0.55, cy - r * 0.45, cx + sgn * r * 1.45, cy - r * 0.7, cx + sgn * r * 0.75, cy + r * 0.05);
    g.fillStyle(shade(col, 0.15)).fillTriangle(cx + sgn * r * 0.62, cy - r * 0.38, cx + sgn * r * 1.28, cy - r * 0.62, cx + sgn * r * 0.75, cy - r * 0.05);
  }
  g.fillStyle(OUT).fillCircle(cx, cy, r + 5);
  g.fillStyle(shade(col, -0.25)).fillCircle(cx, cy, r);
  g.fillStyle(col).fillCircle(cx, cy - r * 0.08, r * 0.92);
  g.fillStyle(shade(col, 0.35)).fillEllipse(cx, cy + r * 0.38, r * 1.0, r * 0.6);
  g.fillStyle(0xffffff, 0.35).fillEllipse(cx - r * 0.38, cy - r * 0.5, r * 0.45, r * 0.25);
  // 眼睛＋怒眉
  const ey = cy - r * 0.12, ex = r * 0.34, er = r * 0.24;
  g.fillStyle(0xffffff).fillCircle(cx - ex, ey, er).fillCircle(cx + ex, ey, er);
  g.fillStyle(def.boss || def.elite ? 0xff2a2a : 0x1a1a1a).fillCircle(cx - ex, ey + er * 0.25, er * 0.5).fillCircle(cx + ex, ey + er * 0.25, er * 0.5);
  g.lineStyle(Math.max(3, r * 0.1), OUT).lineBetween(cx - ex - er, ey - er * 1.2, cx - ex + er, ey - er * 0.6).lineBetween(cx + ex + er, ey - er * 1.2, cx + ex - er, ey - er * 0.6);
  // 嘴＋牙
  g.fillStyle(OUT).fillEllipse(cx, cy + r * 0.32, r * 0.7, r * 0.26);
  g.fillStyle(0xffffff).fillTriangle(cx - r * 0.2, cy + r * 0.22, cx - r * 0.08, cy + r * 0.22, cx - r * 0.14, cy + r * 0.36);
  if (def.archer) { // 紅頭巾＋小弓
    g.fillStyle(OUT).fillRoundedRect(cx - r * 0.95, cy - r * 0.78, r * 1.9, r * 0.36, 6);
    g.fillStyle(0xe8453a).fillRoundedRect(cx - r * 0.9, cy - r * 0.74, r * 1.8, r * 0.26, 5);
    g.lineStyle(5, OUT).beginPath().arc(cx + r * 1.05, cy + r * 0.1, r * 0.75, -PI * 0.45, PI * 0.45).strokePath();
    g.lineStyle(3, 0xc08040).beginPath().arc(cx + r * 1.05, cy + r * 0.1, r * 0.75, -PI * 0.45, PI * 0.45).strokePath();
  }
  if (def.elite) { // 角盔
    g.fillStyle(OUT).fillEllipse(cx, cy - r * 0.62, r * 1.5, r * 0.8);
    g.fillStyle(0x8a8f9a).fillEllipse(cx, cy - r * 0.66, r * 1.36, r * 0.64);
    g.fillStyle(0xc4c8d0).fillEllipse(cx - r * 0.2, cy - r * 0.78, r * 0.5, r * 0.2);
    for (const sgn of [-1, 1]) {
      g.fillStyle(OUT).fillTriangle(cx + sgn * r * 0.45, cy - r * 0.8, cx + sgn * r * 0.95, cy - r * 1.45, cx + sgn * r * 0.75, cy - r * 0.62);
      g.fillStyle(0xf4e6c8).fillTriangle(cx + sgn * r * 0.52, cy - r * 0.8, cx + sgn * r * 0.9, cy - r * 1.3, cx + sgn * r * 0.72, cy - r * 0.68);
    }
  }
  if (def.boss) crown(g, cx, cy - r * 1.18, r * 0.62);
  return s;
}

// ───── 城門 ─────
function drawGate(g) {
  const cx = 90;
  g.fillStyle(0x000000, 0.3).fillEllipse(cx, 155, 170, 26);
  for (const px of [20, 160]) {
    g.fillStyle(OUT).fillRoundedRect(px - 22, 34, 44, 124, 8);
    g.fillStyle(0x8a7a6a).fillRoundedRect(px - 17, 38, 34, 116, 6);
    g.fillStyle(0xb0a08c).fillRect(px - 17, 38, 34, 14);
    g.fillStyle(OUT).fillRoundedRect(px - 26, 22, 52, 22, 6);
    g.fillStyle(0xa39380).fillRoundedRect(px - 22, 25, 44, 15, 4);
  }
  g.fillStyle(OUT).fillRoundedRect(cx - 62, 50, 124, 108, { tl: 60, tr: 60, bl: 0, br: 0 });
  g.fillStyle(0x8b5a2b).fillRoundedRect(cx - 56, 56, 112, 102, { tl: 54, tr: 54, bl: 0, br: 0 });
  for (let i = -2; i <= 2; i++) g.lineStyle(3, 0x5a3a1a).lineBetween(cx + i * 22, 62, cx + i * 22, 158);
  for (const y of [86, 128]) { g.fillStyle(OUT).fillRect(cx - 56, y, 112, 12); g.fillStyle(0x7a7f8a).fillRect(cx - 56, y + 2, 112, 7); }
  g.fillStyle(GOLD).fillCircle(cx + 22, 112, 6);
}

// ───── 戰場背景 ─────
function drawBattleBg(g, layout) {
  const GRID = layout.grid;
  const rnd = seeded(20261007);
  // 草地（上暗下亮的色帶，假裝漸層）
  const bands = 48;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const c = lerpColor(0x3d6a2c, 0x6aa23f, Math.min(1, t * 1.3));
    g.fillStyle(c, 1).fillRect(0, Math.floor(i * H / bands), W, Math.ceil(H / bands) + 1);
  }
  // 草地斑塊
  for (let i = 0; i < 70; i++) {
    g.fillStyle(rnd() < 0.5 ? 0x8cc85a : 0x2f5a22, 0.12).fillEllipse(rnd() * W, 160 + rnd() * 1400, 80 + rnd() * 160, 30 + rnd() * 60);
  }
  // 路（外緣深色 → 泥土 → 中間亮帶）
  const pts = layout.path.map(([x, y]) => ({ x, y }));
  g.lineStyle(104, 0x5a3a20, 1).strokePoints(pts, false);
  for (const p of pts) g.fillStyle(0x5a3a20).fillCircle(p.x, p.y, 52);
  g.lineStyle(88, 0xc8935a, 1).strokePoints(pts, false);
  for (const p of pts) g.fillStyle(0xc8935a).fillCircle(p.x, p.y, 44);
  g.lineStyle(36, 0xdcae74, 0.6).strokePoints(pts, false);
  // 路上的小石子
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1], len = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = 20; d < len; d += 46) {
      const k = d / len, ox = (rnd() - 0.5) * 70, oy = (rnd() - 0.5) * 70;
      const px = a.x + (b.x - a.x) * k + (a.x === b.x ? ox : 0), py = a.y + (b.y - a.y) * k + (a.y === b.y ? oy : 0);
      g.fillStyle(0x9a6a3a, 0.8).fillEllipse(px, py, 10 + rnd() * 10, 6 + rnd() * 6);
    }
  }
  // 放塔區石台
  const px0 = GRID.x - 14, py0 = GRID.y - 12, pw = GRID.cols * GRID.cw + 28, ph = GRID.rows * GRID.ch + 26;
  g.fillStyle(0x000000, 0.25).fillRoundedRect(px0 + 6, py0 + 14, pw, ph, 26);
  g.fillStyle(OUT).fillRoundedRect(px0 - 6, py0 - 6, pw + 12, ph + 12, 30);
  g.fillStyle(0x5c4d40).fillRoundedRect(px0, py0, pw, ph, 26);
  for (let i = 0; i < GRID.cols * GRID.rows; i++) {
    const c = i % GRID.cols, r = Math.floor(i / GRID.cols);
    const x = GRID.x + c * GRID.cw + 7, y = GRID.y + r * GRID.ch + 7, w = GRID.cw - 14, h = GRID.ch - 14;
    g.fillStyle(0x3e3229).fillRoundedRect(x, y + 4, w, h, 16);
    g.fillStyle(0x968676).fillRoundedRect(x, y, w, h, 16);
    g.fillStyle(0xab9b89).fillRoundedRect(x + 5, y + 4, w - 10, h * 0.42, { tl: 12, tr: 12, bl: 4, br: 4 });
    g.lineStyle(3, 0xd9a83a, 0.55).strokeRoundedRect(x + 10, y + 10, w - 20, h - 22, 10);
    for (const [dx, dy] of [[14, 14], [w - 14, 14], [14, h - 16], [w - 14, h - 16]]) g.fillStyle(0xffd34a, 0.7).fillCircle(x + dx, y + dy, 4);
  }
  // 出生洞穴
  const cv = layout.path[0];
  g.fillStyle(OUT).fillEllipse(cv[0], 178, 300, 150);
  g.fillStyle(0x6a5a62).fillEllipse(cv[0], 172, 284, 132);
  g.fillStyle(0x857380).fillEllipse(cv[0] - 40, 140, 150, 50);
  g.fillStyle(OUT).fillEllipse(cv[0], 196, 160, 100);
  g.fillStyle(0x170c14).fillEllipse(cv[0], 200, 144, 86);
  g.fillStyle(0xff3a3a).fillCircle(cv[0] - 26, 196, 5).fillCircle(cv[0] - 8, 196, 5).fillCircle(cv[0] + 30, 206, 4).fillCircle(cv[0] + 46, 206, 4);
  // 裝飾：樹叢、石頭、花（避開路與石台）
  const free = (x, y, m) => {
    if (x > px0 - m && x < px0 + pw + m && y > py0 - m && y < py0 + ph + m) return false;
    if (y < 170 || y > 1590) return false;
    for (let i = 0; i < pts.length - 1; i++) if (distSeg(x, y, pts[i], pts[i + 1]) < 56 + m) return false;
    return true;
  };
  for (let i = 0; i < 400; i++) {
    const x = rnd() * W, y = 170 + rnd() * 1420, kind = rnd();
    if (kind < 0.18) { if (!free(x, y, 40)) continue; bush(g, x, y, 26 + rnd() * 18); }
    else if (kind < 0.3) { if (!free(x, y, 16)) continue; rock(g, x, y, 14 + rnd() * 12); }
    else if (kind < 0.55) { if (!free(x, y, 4)) continue; g.fillStyle([0xff8ac8, 0xfff07a, 0xffffff][Math.floor(rnd() * 3)], 0.9).fillCircle(x, y, 4 + rnd() * 2); }
    else { if (!free(x, y, 2)) continue; tuft(g, x, y); }
  }
}

function drawMenuBg(g) {
  const rnd = seeded(5);
  for (let i = 0; i < 60; i++) g.fillStyle(lerpColor(0x2a1240, 0xc0508a, Math.min(1, i / 40)), 1).fillRect(0, Math.floor(i * H / 60), W, Math.ceil(H / 60) + 1);
  g.fillStyle(0xffd0e0, 0.25).fillCircle(820, 420, 160);
  g.fillStyle(0x1a0a28, 0.9);
  for (const [x, w, h] of [[300, 90, 420], [420, 70, 520], [520, 120, 640], [660, 80, 480], [760, 60, 380]]) {
    g.fillRect(x, 1000 - h, w, h);
    g.fillTriangle(x - 10, 1000 - h, x + w + 10, 1000 - h, x + w / 2, 1000 - h - 120);
  }
  g.fillRect(200, 860, 700, 160);
  for (let i = 0; i < 40; i++) g.fillStyle(0xffffff, 0.5).fillCircle(rnd() * W, rnd() * 600, 1 + rnd() * 2);
  g.fillStyle(0x2a1a2a).fillRect(0, 1000, W, H - 1000);
  for (let i = 0; i < 14; i++) g.fillStyle(lerpColor(0x5a3a4a, 0x2a1a2a, i / 13), 1).fillEllipse(540, 1080 + i * 40, 1400 - i * 30, 200);
}

function pine(g, x, y, r) {
  g.fillStyle(0x000000, 0.2).fillEllipse(x, y + r * 0.9, r * 1.6, r * 0.5);
  g.fillStyle(OUT).fillTriangle(x - r * 0.9, y + r * 0.7, x + r * 0.9, y + r * 0.7, x, y - r * 1.5);
  g.fillStyle(0x2a5a2a).fillTriangle(x - r * 0.78, y + r * 0.6, x + r * 0.78, y + r * 0.6, x, y - r * 1.35);
  g.fillStyle(0x3f7a34).fillTriangle(x - r * 0.5, y - r * 0.1, x + r * 0.3, y - r * 0.1, x, y - r * 1.3);
}

function bush(g, x, y, r) {
  g.fillStyle(0x000000, 0.2).fillEllipse(x, y + r * 0.7, r * 2.4, r * 0.7);
  g.fillStyle(OUT).fillCircle(x - r * 0.6, y, r * 0.75 + 4).fillCircle(x + r * 0.6, y, r * 0.75 + 4).fillCircle(x, y - r * 0.45, r * 0.85 + 4);
  g.fillStyle(0x2f6e2a).fillCircle(x - r * 0.6, y, r * 0.75).fillCircle(x + r * 0.6, y, r * 0.75).fillCircle(x, y - r * 0.45, r * 0.85);
  g.fillStyle(0x4f9a3a).fillCircle(x - r * 0.25, y - r * 0.6, r * 0.45).fillCircle(x + r * 0.5, y - r * 0.15, r * 0.3);
}
function rock(g, x, y, r) {
  g.fillStyle(OUT).fillEllipse(x, y, r * 2.2 + 6, r * 1.4 + 6);
  g.fillStyle(0x8a8a92).fillEllipse(x, y, r * 2.2, r * 1.4);
  g.fillStyle(0xb4b4bc).fillEllipse(x - r * 0.3, y - r * 0.3, r * 1.1, r * 0.5);
}
function tuft(g, x, y) {
  g.fillStyle(0x2f5a22, 0.8);
  g.fillTriangle(x - 8, y, x - 4, y - 14, x, y).fillTriangle(x - 2, y, x + 3, y - 18, x + 6, y).fillTriangle(x + 4, y, x + 10, y - 12, x + 12, y);
}
function distSeg(x, y, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  let t = l2 ? ((x - a.x) * dx + (y - a.y) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
}
function lerpColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255, br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
