// 塔／怪物的圖：有老闆的素材（tower_*、sheet_*）就用素材，沒有就用程式畫的色塊（twg_*、eng_*）
// h＝想要的顯示高度（以色塊塔 170 高的畫面比例為準，換成素材時自動換算）

// 素材塔的 300 高框是照最大一型（Lv7）裁的，第 1 型實際比較矮，所以放大一點看起來才跟色塊差不多大
const ART_K = 1.12;

export const hasTowerArt = (scene, id) => scene.textures.exists('tower_' + id);

export function towerFrame(scene, id, tier = 0) {
  return hasTowerArt(scene, id) ? { key: 'tower_' + id, frame: tier, h: 300, art: true } : { key: `twg_${id}_${tier}`, frame: undefined, h: 170, art: false };
}

// 加一張塔的圖（中心點在 x,y），高度約 h
export function addTower(scene, x, y, id, tier = 0, h = 170) {
  const f = towerFrame(scene, id, tier);
  const img = scene.add.image(x, y, f.key, f.frame);
  img.setScale(h / f.h * (f.art ? ART_K : 1));
  return img;
}

// 有隊長立繪（captain_*）就從第 1 格裁出臉做成圓形頭像，蓋掉程式畫的 avatar_*
// face：臉中心與半徑（佔整格寬高的比例），照立繪量的
const FACES = {
  lia: { src: 'captain_lia', x: 0.5, y: 0.45, r: 0.2 },
  borg: { src: 'captain_borg', x: 0.5, y: 0.36, r: 0.2 },
  karl: { src: 'captain_karl', x: 0.5, y: 0.3, r: 0.18 },
  elsa: { src: 'captain_elsa', x: 0.5, y: 0.3, r: 0.17 },
  goblinking: { src: 'sheet_boss_goblinking', x: 0.5, y: 0.22, r: 0.2 },
  witch: { src: 'sheet_boss_witch', x: 0.5, y: 0.25, r: 0.2 },
};
const AVATAR_BG = { elsa: '#3a8ad8', lia: '#3a6fd8', borg: '#6a8a3a', karl: '#a8231c', goblinking: '#5a1a1a', witch: '#3a1a4a' };
export function applyArtOverrides(scene) {
  for (const [who, f] of Object.entries(FACES)) {
    if (!scene.textures.exists(f.src)) continue;
    const key = 'avatar_' + who;
    if (scene.textures.exists(key) && scene.textures.get(key).customData?.art) continue; // 已經換成 portraits 素材（ui/skin.js）就不用裁
    const fr = scene.textures.getFrame(f.src, 0);
    const src = fr.source.image, S = 128;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const tex = scene.textures.createCanvas(key, S, S);
    const ctx = tex.context;
    ctx.fillStyle = '#2b1208'; ctx.beginPath(); ctx.arc(64, 64, 63, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = AVATAR_BG[who]; ctx.beginPath(); ctx.arc(64, 64, 57, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(64, 64, 57, 0, Math.PI * 2); ctx.clip();
    const r = f.r * fr.height, cx = fr.cutX + f.x * fr.width, cy = fr.cutY + f.y * fr.height;
    ctx.drawImage(src, cx - r, cy - r, r * 2, r * 2, 64 - 57, 64 - 57, 114, 114);
    ctx.restore();
    tex.refresh();
    tex.customData = { art: true };
  }
}

// 劇情立繪：有圖就回傳 { key, frame }
const STANDS = { lia: 'captain_lia', borg: 'captain_borg', karl: 'captain_karl', elsa: 'captain_elsa', goblinking: 'sheet_boss_goblinking', witch: 'sheet_boss_witch',
  pirate: 'sheet_boss_pirate', frostgiant: 'sheet_boss_frostgiant', lavademon: 'sheet_boss_lavademon', shadowking: 'sheet_boss_shadowking' };
export function standArt(scene, who) {
  const k = STANDS[who];
  return k && scene.textures.exists(k) ? { key: k, frame: 0 } : null;
}

// 隊長大圖：有待機影片（anim_captain_<id>）就播循環動畫，沒有用走路圖第 1 格的靜態圖
// 回傳 sprite（origin 腳底中間），h＝顯示高度
export function captainSprite(scene, id, x, y, h, kind = 'idle') {
  const vid = 'anim_captain_' + id + (kind === 'skill' ? '_skill' : '');
  const idle = 'anim_captain_' + id;
  const key = scene.textures.exists(vid) ? vid : scene.textures.exists(idle) ? idle : null;
  let spr;
  if (key) {
    const m = scene.cache.json.get('manifest')?.sheets?.[key] || {};
    const anim = 'a_' + key;
    if (!scene.anims.exists(anim)) {
      const total = scene.textures.get(key).frameTotal - 1;
      scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: Math.min(total, m.frames || total) - 1 }), frameRate: m.fps || 12, repeat: m.loop === false ? 0 : -1, yoyo: !!m.yoyo });
    }
    spr = scene.add.sprite(x, y, key, 0).setOrigin(0.5, 1).play(anim);
  } else if (scene.textures.exists('captain_' + id + '_stand')) { // 沒影片：站姿圖
    spr = scene.add.sprite(x, y, 'captain_' + id + '_stand', 0).setOrigin(0.5, 1);
  } else if (scene.textures.exists('captain_' + id)) {
    spr = scene.add.sprite(x, y, 'captain_' + id, 0).setOrigin(0.5, 1);
  } else {
    spr = scene.add.sprite(x, y, scene.textures.exists('avatar_' + id) ? 'avatar_' + id : 'avatar_lia').setOrigin(0.5, 1);
  }
  spr.setScale(h / spr.height);
  return spr;
}

// 還沒有專屬圖的怪先借別人的動畫＋染色（例如精英哥布林＝一般哥布林放大、偏紅）
export const ALIAS = {
  goblin_elite: { from: 'goblin', tint: 0xff9a8a },
  mummy_elite: { from: 'mummy', tint: 0xffe07a },
  yeti_elite: { from: 'yeti', tint: 0x9fc8ff },
  treant_elite: { from: 'treant', tint: 0x9fd07a },
};

// 怪物靜態圖示（選關面板、圖鑑）：跟戰鬥同一套規則，精英沒有自己的圖就借一般怪的圖染色；都沒有才用程式畫的
export function enemyIcon(scene, x, y, type, h = 110) {
  let key = 'sheet_' + type, tint = null;
  if (!scene.textures.exists(key) && ALIAS[type] && scene.textures.exists('sheet_' + ALIAS[type].from)) { key = 'sheet_' + ALIAS[type].from; tint = ALIAS[type].tint; }
  if (!scene.textures.exists(key)) { const img = scene.add.image(x, y, `eng_${type}`); return img.setScale(Math.min(1, h / img.width)); }
  const img = scene.add.image(x, y, key, 0).setScale(h / scene.textures.getFrame(key, 0).height);
  if (tint) { img.setTint(tint); img.baseTint = tint; }
  return img;
}

// 怪物走路動畫：有 sheet_<type> 就建動畫並回傳 sprite，沒有回傳 null
export function enemySprite(scene, type) {
  let key = 'sheet_' + type, tint = null;
  if (!scene.textures.exists(key) && ALIAS[type] && scene.textures.exists('sheet_' + ALIAS[type].from)) {
    key = 'sheet_' + ALIAS[type].from; tint = ALIAS[type].tint; type = ALIAS[type].from;
  }
  if (!scene.textures.exists(key)) return null;
  const anim = 'walk_' + type;
  if (!scene.anims.exists(anim)) {
    const n = scene.textures.get(key).frameTotal - 1; // 扣掉 __BASE
    scene.anims.create({ key: anim, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: Math.min(7, n - 1) }), frameRate: 10, repeat: -1 });
  }
  const s = scene.add.sprite(0, 0, key, 0);
  s.play({ key: anim, startFrame: Math.floor(Math.random() * 8) });
  s.baseTint = tint;
  if (tint) s.setTint(tint);
  return s;
}
