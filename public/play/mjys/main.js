// 《魔晶要塞》原型入口：1080×1920 直式，等比縮放置中
import { W, H } from './cfg.js';
import { BootScene } from './scenes/Boot.js';
import { LoginScene } from './scenes/Login.js';
import { HomeScene } from './scenes/Home.js';
import { StageMapScene } from './scenes/StageMap.js';
import { BattleScene } from './scenes/Battle.js';
import { ResultScene } from './scenes/Result.js';
import { TowersScene } from './scenes/Towers.js';
import { StoryScene } from './scenes/Story.js';
import { EventScene } from './scenes/Event.js';
import { ShopScene } from './scenes/Shop.js';
import { TasksScene } from './scenes/Tasks.js';
import { SeasonScene } from './scenes/Season.js';
import { CaptainScene } from './scenes/Captain.js';
import { FortressScene } from './scenes/Fortress.js';
import { CodexScene } from './scenes/Codex.js';

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: W,
  height: H,
  backgroundColor: '#1a0f24',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, LoginScene, HomeScene, StageMapScene, BattleScene, ResultScene, TowersScene, StoryScene, EventScene, ShopScene, TasksScene, SeasonScene, CaptainScene, FortressScene, CodexScene],
});
