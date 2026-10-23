// 開場：讀素材清單與登入背景、畫占位美術、做數字字型，然後進登入頁
// 網址帶 ?stage=N 直接進那關戰鬥（測試用，不扣体力）
import { makeArt } from '../ui/art.js';
import { makeDigitFont } from '../ui/qtext.js';
import { save } from '../store.js';
import { applyArtOverrides } from '../ui/towerArt.js';
import { queueAssets } from '../ui/common.js';
import { chapterOf } from '../data/stages.js';
import { applySkin } from '../ui/skin.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // 正式素材清單由 tools/process_art.py 產生；找不到檔案不會中斷
    this.load.json('manifest', 'assets/manifest.json?v=' + Date.now());
    this.load.on('loaderror', () => {});
  }

  create() {
    const m = this.cache.json.get('manifest');
    const q = new URLSearchParams(location.search);
    const direct = 0; // 【平台】關閉 ?stage= 直接跳關
    // 平常只先載登入背景，其餘在登入頁載（有進度條）
    // 網址 ?stage=N 跳過登入直接進戰鬥：登入頁要載的全部在這裡載（不然之後回主頁、地圖會沒有背景）
    let n = 0;
    if (direct && m) n = queueAssets(this, m, chapterOf(direct));
    else for (const key of ['bg_login', 'logo_0']) if (m?.images?.[key]) { this.load.image(key, 'assets/' + m.images[key]); n++; }
    const go = () => {
      makeArt(this);
      makeDigitFont(this, 'num_white', 'white', 40);
      makeDigitFont(this, 'num_gold', 'gold', 52);
      makeDigitFont(this, 'num_green', 'green', 40);
      makeDigitFont(this, 'num_blue', 'blue', 40);
      makeDigitFont(this, 'num_red', 'red', 48);
      save.load();
      applySkin(this);
      applyArtOverrides(this);
      if (direct) this.scene.start('Battle', { stage: direct });
      else this.scene.start('Login');
    };
    if (n) { this.load.once('complete', go); this.load.start(); } else go();
  }
}
