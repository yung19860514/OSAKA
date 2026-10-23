// 仙途问道 — 战斗原型 v0.2（Phaser 3，不需打包；正式美术＋透视）
'use strict';

const W = 720, H = 1280;
const RELEASE = true; // 正式版（tools/build_release.py 打包时自动改成 true）：关掉测试网址、作弊键、模拟已缴费
const ROAD_L = 70, ROAD_R = 650, ROAD_MID = (ROAD_L + ROAD_R) / 2;
const PLAYER_Y = 1030, LINE_Y = 1000;
const FONT = '"Noto Serif SC","Songti SC","SimSun",serif';             // 內文、小數字
const FONT_L = '"ZCOOL XiaoWei","Noto Serif SC",serif';                  // 无框标签：关卡名
const FONT_T = '"Ma Shan Zheng","STXingkai","KaiTi","Noto Serif SC",serif'; // 書法：標題、按鈕、框上的字（24px 以上自動用）

// ───── 透视：逻辑坐标是「平的」，画面才投影成远窄近宽 ─────
const HORIZON = 64;    // 地平线高度（画面 y）
const D0 = 720;        // 越小透视越强
const KD = 2.0;        // 逻辑距离放大倍率（越大，远处看得越远）
function proj(x, y) {
  const dist = Math.max((PLAYER_Y - y) * KD, -0.6 * D0);
  const s = D0 / (dist + D0);
  return [W / 2 + (x - ROAD_MID) * s, HORIZON + (PLAYER_Y - HORIZON) * s, s];
}

// ───── 平衡参数（调手感改这里） ─────
const CFG = {
  scroll: 90,             // 地面与框的推进速度 px/s（妖兽要比这个快，才会冲在框前面）
  keySpeed: 760,
  dragGain: 1.25,
  playerHp: 1000,
  atk: { interval: 0.34, dmg: 30, speed: 1150, gap: 22, crit: 0.1, critMul: 2 },
  energyMax: 100,
  stageLen: 75,
  parTime: 110,
  bossPar: 30,            // 三星：妖王每轮平均几秒内打倒（前面的妖潮时间是固定的，比打王速度才有意义）
  gateEvery: 9,
  chestAfterGate: [1, 4, 6],
  comboWindow: 1.6,
  gatePass: 0.5,          // 子弹穿过框后剩下的伤害比例
  hpGrowth: 1.13,
  dmgGrowth: 1.03,       // 每关小幅成长；主要战力来自修炼
  bossHp: 16000,
  dmgVar: 0.08,           // 伤害浮动 ±8%
  superCrit: 0.015,       // 天罡暴击机率（每一下独立判定）
  superMul: 4,            // 天罡暴击倍率
  enemyScale: 1.7,        // 怪物显示放大倍率（碰撞范围也跟着放大一点）
  enemyPersp: 0.6,        // 怪物远近缩放的幅度（1＝完全照透视，越小远处越不会缩太小）
};

// h = 站在主角那一排时的显示高度
const ENEMY_TYPES = {
  grunt:  { hp: 60,  speed: 120, r: 22, dmg: 25, tex: 'enemy_grunt',  h: 96,  score: 10, energy: 1, track: 45, step: 9 },
  runner: { hp: 35,  speed: 185, r: 17, dmg: 15, tex: 'enemy_runner', h: 70,  score: 12, energy: 1, track: 70, step: 15 },
  brute:  { hp: 320, speed: 98,  r: 36, dmg: 70, tex: 'enemy_brute',  h: 136, score: 40, energy: 4, track: 25, step: 6 },
  rogue:  { hp: 150, speed: 112, r: 24, dmg: 40, tex: 'enemy_rogue',  h: 104, score: 20, energy: 2, track: 55, step: 10 },
  // 新怪物：有 sheet_*.png 才会出现（docs/10），from＝从第几关开始
  skeleton: { hp: 55,  speed: 125, r: 21, dmg: 22, tex: 'sheet_skeleton', h: 100, score: 10, energy: 1, track: 50, step: 9,  from: 2 },
  bat:      { hp: 30,  speed: 200, r: 18, dmg: 15, tex: 'sheet_bat',      h: 80,  score: 12, energy: 1, track: 80, step: 14, from: 4 },
  snake:    { hp: 130, speed: 110, r: 24, dmg: 35, tex: 'sheet_snake',    h: 110, score: 18, energy: 2, track: 60, step: 8,  from: 6, wiggle: 60 },
  treant:   { hp: 520, speed: 70,  r: 40, dmg: 80, tex: 'sheet_treant',   h: 150, score: 45, energy: 5, track: 20, step: 5,  from: 8 },
  foxmage:  { hp: 180, speed: 95,  r: 24, dmg: 45, tex: 'sheet_foxmage',  h: 112, score: 25, energy: 3, track: 40, step: 8,  from: 10 },
  golem:    { hp: 1100, speed: 60, r: 48, dmg: 120, tex: 'sheet_golem',   h: 180, score: 80, energy: 8, track: 15, step: 4,  from: 12 },
};
// 精英词缀：反制单一打法（坚甲克剑气多而弱、反震克暴击…）
const AFFIXES = [
  { id: 'armor',   name: '坚甲', color: '#d8dee8' }, // 每一下固定减伤
  { id: 'swift',   name: '疾风', color: '#7fe0ff' }, // 跑很快
  { id: 'regen',   name: '再生', color: '#8dff9f' }, // 一直回血
  { id: 'split',   name: '分裂', color: '#ffb070' }, // 死后分成三只
  { id: 'reflect', name: '反震', color: '#ff8fd8' }, // 被暴击会回弹妖弹
];
// 妖王多轮：每轮血量、体型、小怪强度
const BOSS_ROUND = { hp: [1, 1.6, 2.5, 3.6, 5], size: [1, 1.15, 1.3, 1.4, 1.5], mob: [1, 1.3, 1.6, 1.9, 2.2], interlude: 30 };
const ROUND_CN = ['一', '二', '三', '四', '五'];
const bossParText = n => (bossRoundsOf(n) > 1 ? `妖王每轮 ${CFG.bossPar} 秒内击败` : `妖王 ${CFG.bossPar} 秒内击败`);
const bossRoundsOf = n => (n % 10 === 0 ? 5 : n % 5 === 0 ? 3 : n % 10 === 3 || n % 10 === 7 ? 2 : 1); // 尾数 0 打五轮、5 三轮、3/7 两轮
// 师尊法相：集满「师尊感应」出场 10 秒，每 1.5 秒劈一剑；吃局外攻击（不吃局内加成），对妖王只打 30%
const MASTER = { dur: 10, every: 1.5, mul: 25, radius: 170, bossMul: 0.3, perKill: 0.8, perElite: 10, perSec: 0.8, gate: 30, from: 11 };
const MASTER_TIER = ['一剑', '三剑齐落', '五剑定身', '万剑雨', '法相天地'];
const NEW_ENEMIES = ['skeleton', 'bat', 'snake', 'treant', 'foxmage', 'golem'];

const GATE_STATS = {
  multi: { name: '剑气', init: [-2, 1],   max: 3,  step: 1,  cost: 420, unit: '', icon: 'stat_multi' },
  rate:  { name: '攻速', init: [-30, 10], max: 40, step: 10, cost: 170, unit: '%', icon: 'stat_rate' },
  dmg:   { name: '攻击', init: [-30, 10], max: 50, step: 10, cost: 170, unit: '%', icon: 'stat_dmg' },
  clone: { name: '分身', init: [-1, 1],   max: 1,  step: 1,  cost: 520, unit: '', icon: 'stat_clone' },
};

// 心魔框：直接通过会被扣能力，打破才安全；第 5 关开始出现
const CURSES = [
  { stat: 'rate', v: -15, name: '攻速', unit: '%', icon: 'stat_rate' },
  { stat: 'dmg', v: -15, name: '攻击', unit: '%', icon: 'stat_dmg' },
  { stat: 'move', v: -30, name: '身法', unit: '%', icon: 'icon_ice' },
  { stat: 'multi', v: -1, name: '剑气', unit: '', icon: 'stat_multi' },
  { stat: 'crit', v: -10, name: '暴击', unit: '%', icon: 'icon_split' },
];
const SKILLS = {
  water:   { name: '水龙波',   color: 0x3fa9ff, icon: 'icon_water',   desc: '定时放出水龙，贯穿整列' },
  thunder: { name: '天雷引',   color: 0xa98bff, icon: 'icon_thunder', desc: '天雷随机劈落妖兽' },
  fire:    { name: '焚天火术', color: 0xff7a2a, icon: 'icon_fire',    desc: '火球轰击，范围爆炸' },
  shield:  { name: '玄武护体', color: 0x38d39f, icon: 'icon_shield',  desc: '护盾吸收伤害，定时恢复（永久等级加强护盾量）' },
  sword:   { name: '万剑诀',   color: 0xffd04a, icon: 'icon_sword',   desc: '飞剑从天而降' },
  heal:    { name: '回春术',   color: 0x5fe08a, icon: 'icon_heal',    desc: '每 5 秒回复气血（Lv1 2% → Lv5 6%）' }, // 最高 Lv5，不会觉醒
};
const SKILL_MAX = 9;
const skillMax = id => (id === 'heal' ? 5 : SKILL_MAX);
// 功法觉醒（Lv3 起）：普通招式换成全场大招；Lv3 每 5 秒、Lv4 起每 3 秒；对妖王只打 30%
const AWAKEN = {
  water:   { name: '苍龙出海', fx: 'fx_aw_water' },
  thunder: { name: '九天雷劫', fx: 'fx_aw_thunder' },
  fire:    { name: '朱雀焚天', fx: 'fx_aw_fire' },
  shield:  { name: '玄武真身', fx: 'fx_aw_shield' },
  sword:   { name: '诛仙剑阵', fx: 'fx_aw_sword' }, // 大招按钮已经叫万剑归宗
};
// 觉醒动画是满版的：一局只能有一个攻击功法觉醒（先到 Lv3 的那个），其他攻击功法最高 Lv2；玄武是防御，另外算
// 觉醒后的成长：Lv3 三个小的 → Lv4 五个小的 → Lv5 合成一个巨大的 → Lv6 加快 → Lv7 两个巨大 → Lv8 再加快 → Lv9 三个巨大
const AWAKEN_LV = 3;
const awakenCount = lv => (lv >= 9 ? 3 : lv >= 7 ? 2 : lv >= 5 ? 1 : lv >= 4 ? 5 : 3);
const AWAKEN_CD = lv => (lv >= 8 ? 1.8 : lv >= 6 ? 2.3 : lv >= 4 ? 3 : 5);
const AWAKEN_MUL = lv => 8 * (1 + 0.15 * (lv - AWAKEN_LV)) * (lv >= 5 ? 1.3 : 1);
// 有綠幕影片切出来的序列帧就播，没有就用程式步伐
const ENEMY_ANIM = { grunt: 'anim_grunt_walk', runner: 'anim_runner_run', brute: 'anim_brute_walk', rogue: 'anim_rogue_walk' };

const STAT_PICKS = [
  { id: 'dmg',   name: '攻击提升', desc: '攻击 +25%',    rarity: 1, icon: 'stat_dmg',   apply: s => { addBuff(s.st, 'dmgMul', 25); } },
  { id: 'rate',  name: '疾风剑意', desc: '攻速 +20%',    rarity: 1, icon: 'stat_rate',  apply: s => { addBuff(s.st, 'rateMul', 20); } },
  { id: 'multi', name: '剑气分裂', desc: '剑气 +1',      rarity: 2, icon: 'stat_multi', apply: s => { addMulti(s.st, 1); } },
  { id: 'clone', name: '分身术',   desc: '分身 +1',      rarity: 3, icon: 'stat_clone', apply: s => { if (s.st.clones < CLONE_MAX) s.st.clones++; else addBuff(s.st, 'dmgMul', 20); } },
  { id: 'heal',  name: '气血回复', desc: '回复 40% 气血', rarity: 0, icon: 'icon_heal',  apply: s => { s.st.hp = Math.min(s.st.maxHp, s.st.hp + s.st.maxHp * 0.4); } },
  { id: 'crit',  name: '会心一击', desc: '暴击率 +10%',  rarity: 1, icon: 'icon_split', apply: s => { s.st.crit = Math.min(0.8, s.st.crit + 0.1); } },
];
// 攻速、攻击的局内加成：加法叠加；超过 200% 后每次只给一半；上限 攻速 250%、攻击 300%（docs/16：一局约 5～8 倍）
const BUFF_CAP = { rateMul: 2.5, dmgMul: 3 };
// 剑气越多越分散：总伤害 1／1.8／2.4／2.9／3.3，满 5 道；超过的剑气换成攻击 +15%
const MULTI_MAX = 5, MULTI_EFF = [0, 1, 1.8, 2.4, 2.9, 3.3];
const CLONE_MAX = 2, CLONE_DMG = 0.5;
// 门分四阶（看这局第几组门，不看关卡）：上限、灌满大约要专心打几秒
const GATE_TIER_MAX = { multi: [1, 1, 2, 2], rate: [20, 30, 40, 50], dmg: [20, 30, 40, 50], clone: [1, 1, 1, 1] };
const GATE_FILL_T = [1.5, 2, 2.5, 3];
function addBuff(st, key, pct) {
  const d = pct / 100;
  if (d < 0) { st[key] = Math.max(0.4, st[key] + d); return d; }
  const eff = d * (st[key] >= 2 ? 0.5 : 1);
  const before = st[key];
  st[key] = Math.min(BUFF_CAP[key], st[key] + eff);
  return st[key] - before;
}
// 剑气 +n：满 5 道后多的换成攻击
function addMulti(st, n) {
  const add = Math.max(0, Math.min(MULTI_MAX - st.multi, n));
  st.multi += add;
  if (n > add) addBuff(st, 'dmgMul', 15 * (n - add));
  return add;
}
const RARITY_COLOR = [0xb8c0cc, 0x46c46a, 0x3f8cff, 0xb05cff, 0xffc13b];

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const shuffle = arr => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

const store = {
  get(k, d) { try { const v = localStorage.getItem('xtwd_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('xtwd_' + k, JSON.stringify(v)); } catch (e) { /* 无痕模式 */ } },
};

function txt(scene, x, y, s, size = 28, color = '#ffffff', ox = 0.5, oy = 0.5) {
  const big = size >= 24;
  const useCal = v => big && !/[0-9]/.test(String(v)); // 书法字只用在纯中文；有数字就换宋体粗体
  const t = scene.add.text(x, y, '', {
    fontFamily: useCal(s) ? FONT_T : FONT, fontSize: Math.round(useCal(s) ? size * 1.12 : size) + 'px', color, fontStyle: useCal(s) ? '' : '900',
    stroke: '#0a0d14', strokeThickness: Math.max(3, Math.round(size / 6)), align: 'center', padding: { x: 4, y: 6 },
  }).setOrigin(ox, oy).setShadow(2, 3, '#000000', 4, true, true);
  const orig = t.setText.bind(t);
  t.setText = v => {
    const cal = useCal(v);
    if (t._cal !== cal) { t._cal = cal; t.setFontFamily(cal ? FONT_T : FONT); t.setFontStyle(cal ? '' : '900'); }
    return orig(v);
  };
  return t.setText(s);
}

function button(scene, x, y, w, h, label, color, cb, size = 32) {
  const c = scene.add.container(x, y);
  const key = { 0xc98a1a: 'btn_gold', 0x2a5bb8: 'btn_blue', 0xa8263a: 'btn_red' }[color];
  if (key && scene.textures.exists(key)) {
    c.add(scene.add.image(0, 0, key).setDisplaySize(w * 1.12, h * 1.25));
  } else {
    const g = scene.add.graphics();
    g.fillStyle(color, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2.5);
    g.fillStyle(0xffffff, 0.15).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h / 2 - 4, h / 3);
    g.lineStyle(3, 0xffe7a3, 0.95).strokeRoundedRect(-w / 2, -h / 2, w, h, h / 2.5);
    c.add(g);
  }
  c.add(txt(scene, 0, -2, label, size));
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => { sfx(scene, 'click', 0.35); cb(); });
  c.on('pointerover', () => c.setScale(1.05));
  c.on('pointerout', () => c.setScale(1));
  return c;
}

// 依高度缩放一张图
const fitH = (img, h) => img.setScale(h / img.height);
// ───── 音乐／音效（素材在 audio/，tools/process_audio.py 产生；测试用素材有版权，上线前要换） ─────
const AUD = { cur: null, curKey: null, cd: {}, list: { bgm: [], sfx: [] } };
const audioOn = k => store.get('audio_' + k, true);
const audioVol = k => store.get('vol_' + k, 0.8); // 设置里的音量滑杆 0～1
const BGM_VOL = 0.5;
function playBgm(scene, key, loop = true) {
  if (AUD.curKey === key && AUD.cur && AUD.cur.isPlaying) return;
  AUD.wantKey = key; AUD.wantLoop = loop;
  if (!audioOn('music') || !AUD.list.bgm.includes(key)) { stopBgm(); return; }
  const snd = scene.sound;
  if (snd.locked) { snd.once('unlocked', () => { if (AUD.wantKey === key) playBgm(scene.game.scene.getScenes(true)[0] || scene, key, loop); }); return; }
  const k = 'bgm_' + key;
  const start = () => {
    if (AUD.wantKey !== key) return; // 载入期间又换场景了
    stopBgm();
    AUD.cur = snd.add(k, { loop, volume: 0 }); AUD.curKey = key;
    AUD.cur.play();
    fadeSound(AUD.cur, BGM_VOL * audioVol('music'), 600);
  };
  if (scene.cache.audio.exists(k)) start();
  else { // 背景音乐用到才载（全部先载太大）
    scene.load.audio(k, 'audio/bgm/' + key + '.mp3');
    scene.load.once('filecomplete-audio-' + k, start);
    scene.load.start();
  }
}
function stopBgm() {
  if (!AUD.cur) return;
  const old = AUD.cur; AUD.cur = null; AUD.curKey = null;
  fadeSound(old, 0, 300, () => { old.stop(); old.destroy(); });
}
// 淡入淡出用浏览器计时，不跟场景绑（换场景时场景的动画会被清掉，音乐会停不下来）
function fadeSound(snd, to, ms, done) {
  clearInterval(snd._fade);
  const from = snd.volume, t0 = performance.now();
  snd._fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    if (snd.manager) snd.volume = from + (to - from) * k; // 已经被销毁就别再动
    if (k >= 1) { clearInterval(snd._fade); if (done) done(); }
  }, 30);
}
// 音效：同一个声音太密集会吵，所以每种声音有最短间隔（秒）
function sfx(scene, key, vol = 0.5, gap = 0.04) {
  if (!audioOn('sfx')) return;
  const k = 'sfx_' + key, now = performance.now();
  if (!scene.cache.audio.exists(k) || now - (AUD.cd[key] || 0) < gap * 1000) return;
  AUD.cd[key] = now;
  scene.sound.play(k, { volume: vol * audioVol('sfx') * 1.25, detune: rand(-80, 80) });
}
function toggleAudio(scene, kind) {
  store.set('audio_' + kind, !audioOn(kind));
  if (kind === 'music') { if (audioOn('music')) { AUD.curKey = null; playBgm(scene, AUD.wantKey || 'home', AUD.wantLoop !== false); } else stopBgm(); }
}

// 按钮上的书法字：有字图就用图（docs/14），没有就用文字
function btnText(scene, x, y, key, label, h, size) {
  if (scene.textures.exists(key)) return fitH(scene.add.image(x, y, key), h);
  return txt(scene, x, y, label, size, '#5a2a08').setStroke('#ffe9b0', Math.max(3, size / 14)).setShadow(0, 0, '#000', 0);
}
// 「第 N 关」：有 font_stage 就拼字
function stageText(scene, x, y, n, h, size) {
  if (scene.cache.bitmapFont.exists('font_stage')) {
    const str = `第${n}关`, c = scene.add.container(x, y);
    const sh = scene.add.bitmapText(2, 3, 'font_stage', str, 96).setOrigin(0.5).setLetterSpacing(10).setTintFill(0x2a1004).setAlpha(0.7);
    c.add([sh, scene.add.bitmapText(0, 0, 'font_stage', str, 96).setOrigin(0.5).setLetterSpacing(10)]);
    return c.setScale(h / 96);
  }
  return txt(scene, x, y, `第 ${n} 关`, size, '#5a2a08').setStroke('#ffe9b0', 3);
}

// 程式画的小东西（光点、妖弹、水波）
function makeTextures(scene) {
  if (scene.textures.exists('glow')) return;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const done = (key, w, h) => { g.generateTexture(key, w, h); g.clear(); };
  for (let r = 32; r > 0; r -= 2) { g.fillStyle(0xffffff, 0.07); g.fillCircle(32, 32, r); }
  done('glow', 64, 64);
  for (let r = 22; r > 0; r -= 2) { g.fillStyle(0xff2a3a, 0.12); g.fillCircle(24, 24, r); }
  g.fillStyle(0x2a0006).fillCircle(24, 24, 7);
  done('orb', 48, 48);
  for (let i = 0; i < 6; i++) { g.fillStyle(0x58b8ff, 0.12 + i * 0.05); g.fillEllipse(80, 40, 160 - i * 22, 80 - i * 11); }
  g.fillStyle(0xffffff, 0.5).fillEllipse(80, 34, 40, 14);
  done('wave', 160, 80);
  for (let i = 0; i < 18; i++) { // 放射光芒
    const a = i / 18 * Math.PI * 2, w = 0.07;
    g.fillStyle(0xffffff, 0.09).fillTriangle(256, 256, 256 + Math.cos(a - w) * 256, 256 + Math.sin(a - w) * 256, 256 + Math.cos(a + w) * 256, 256 + Math.sin(a + w) * 256);
  }
  done('rays', 512, 512);
  for (let i = 0; i < 26; i++) { g.fillStyle(0xffffff, 0.05); g.fillEllipse(128 + Math.sin(i * 1.7) * 70, 64 + Math.cos(i * 2.3) * 22, 120 - i * 2, 60 - i); }
  done('cloud', 256, 128);
  for (let i = 0; i < 16; i++) { g.fillStyle(0xfff0c0, 0.06); g.fillRect(32 - i * 2, 0, i * 4, 512); }
  done('beam', 64, 512);
  g.destroy();
}

// 桥面 shader：把俯视的桥面贴图投影成远窄近宽，栏杆沿两侧贴在地上
const ROAD_FRAG = `
precision mediump float;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform sampler2D iChannel1;
uniform float uScroll;
uniform float uTexH;
uniform float uRailH;
uniform vec3 uFog;
varying vec2 fragCoord;
const float HORIZON = ${HORIZON.toFixed(1)};
const float PY = ${PLAYER_Y.toFixed(1)};
const float D0 = ${D0.toFixed(1)};
const float KD = ${KD.toFixed(1)};
const float RL = ${ROAD_L.toFixed(1)};
const float RR = ${ROAD_R.toFixed(1)};
const float RM = ${ROAD_MID.toFixed(1)};
const float UL = 0.05;
const float UR = 0.95;
void main() {
  float py = resolution.y - fragCoord.y;
  float px = fragCoord.x;
  float s = (py - HORIZON) / (PY - HORIZON);
  if (s <= 0.015) { gl_FragColor = vec4(0.0); return; }
  float G = (D0 / s - D0) / KD + uScroll;
  float xl = RM + (px - ${(W / 2).toFixed(1)}) / s;
  float u = (xl - RL) / (RR - RL) * (UR - UL) + UL;
  vec4 col = vec4(0.0);
  if (u >= 0.0 && u <= 1.0) col = vec4(texture2D(iChannel0, vec2(u, fract(-G / uTexH))).rgb, 1.0);
  float rv = fract(-G / uRailH);
  float lx = (xl - (RL - 34.0)) / 44.0;
  float rx = ((RR + 34.0) - xl) / 44.0;
  if (lx >= 0.0 && lx <= 1.0) { vec4 r = texture2D(iChannel1, vec2(lx, rv)); col = vec4(col.rgb * (1.0 - r.a) + r.rgb, r.a + col.a * (1.0 - r.a)); }
  if (rx >= 0.0 && rx <= 1.0) { vec4 r = texture2D(iChannel1, vec2(rx, rv)); col = vec4(col.rgb * (1.0 - r.a) + r.rgb, r.a + col.a * (1.0 - r.a)); }
  float fog = clamp((0.42 - s) / 0.36, 0.0, 1.0) * 0.85;
  col.rgb = mix(col.rgb, uFog * col.a, fog);
  float fade = smoothstep(0.015, 0.07, s);
  gl_FragColor = col * fade;
}`;

// ───── 玩家资料（原型：存在浏览器） ─────
const STAMINA_MAX = 120, STAMINA_REGEN = 360; // 每 6 分钟回 1 点
const REALMS = ['练气', '筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫']; // 九境 × 九层 = 81 级
const CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
const REALM_MAX = REALMS.length * 9 - 1;
const realmName = r => `${REALMS[Math.floor(r / 9)]}期 ${CN_NUM[r % 9 + 1]}层`;
// 用书法字图拼出「筑基期 三层」；字图不在就退回文字
const REALM_KEYS = [['r_lian', 'r_qi'], ['r_zhu', 'r_ji'], ['r_jin', 'r_dan'], ['r_yuan', 'r_ying'], ['r_hua', 'r_shen']];
function realmImg(scene, x, y, r, h, depth) {
  const keys = [...(REALM_KEYS[Math.floor(r / 9)] || ['r_none']), 'r_qi2', null, 'l_' + (r % 9 + 1), 'l_ceng']; // 新境界还没有字图就用文字
  if (!keys.every(k => !k || scene.textures.exists(k))) return txt(scene, x, y, realmName(r), Math.round(h * 0.7), '#ffe7a3');
  const c = scene.add.container(x, y);
  let cx = 0;
  const parts = keys.map(k => {
    if (!k) { cx += h * 0.35; return null; }
    const im = scene.add.image(0, 0, k).setOrigin(0, 0.5);
    im.setScale(h / im.height); im.x = cx; cx += im.displayWidth * 0.92;
    return im;
  }).filter(Boolean);
  parts.forEach(im => { im.x -= cx / 2; });
  // 黑色描边（四个方向各一份）＋往右下的投影，放在亮背景上也看得清楚
  const o = Math.max(1.5, h * 0.05), d = Math.max(3, h * 0.1);
  const shadows = [];
  parts.forEach(im => {
    [[d, d, 0.7], [-o, 0, 0.9], [o, 0, 0.9], [0, -o, 0.9], [0, o, 0.9]].forEach(([dx, dy, a]) =>
      shadows.push(scene.add.image(im.x + dx, dy, im.texture.key).setOrigin(0, 0.5).setScale(im.scale).setTintFill(0x0a0604).setAlpha(a)));
  });
  c.add([...shadows, ...parts]);
  if (depth != null) c.setDepth(depth);
  return c;
}
const xpNeed = r => Math.round(100 * Math.pow(1.22, r));
const isMajor = r => r % 9 === 8;                    // 九层圆满 → 下一步是渡劫（换大境界）
const majorCost = r => 300 * (Math.floor(r / 9) + 1); // 渡劫要灵晶
const ATTRS = [
  { id: 'atk',  name: '攻击', icon: 'attr_atk',  alt: 'stat_dmg',    fmt: v => fmtNum(v) },
  { id: 'def',  name: '防御', icon: 'attr_def',  alt: 'icon_shield', fmt: v => fmtNum(v) },
  { id: 'hp',   name: '气血', icon: 'attr_hp',   alt: 'icon_heal',   fmt: v => fmtNum(v) },
  { id: 'crit', name: '暴击', icon: 'attr_crit', alt: 'icon_split',  fmt: v => Math.round(v * 100) + '%' },
];
// 法宝：四个栏位，每件有一种加成；强化每级效果 +15%
const ART_SLOTS = [
  { id: 'weapon', name: '武器', x: 110, y: 310 }, { id: 'charm', name: '护符', x: 610, y: 310 },
  { id: 'gourd', name: '葫芦', x: 110, y: 530 }, { id: 'robe', name: '法衣', x: 610, y: 530 },
];
const ARTIFACTS = {
  art_sword:    { name: '青锋剑',   slot: 'weapon', rarity: 2, stat: 'atk',  val: 0.10, desc: '攻击' },
  art_flysword: { name: '流光飞剑', slot: 'weapon', rarity: 3, stat: 'atk',  val: 0.18, desc: '攻击' },
  art_talisman: { name: '镇魂符',   slot: 'charm',  rarity: 2, stat: 'crit', val: 0.03, desc: '暴击' },
  art_pendant:  { name: '玄玉佩',   slot: 'charm',  rarity: 3, stat: 'crit', val: 0.05, desc: '暴击' },
  art_gourd:    { name: '紫金葫芦', slot: 'gourd',  rarity: 2, stat: 'hp',   val: 0.12, desc: '气血' },
  art_cauldron: { name: '炼丹鼎',   slot: 'gourd',  rarity: 3, stat: 'hp',   val: 0.20, desc: '气血' },
  art_robe:     { name: '云纹法衣', slot: 'robe',   rarity: 2, stat: 'def',  val: 20,   desc: '防御' },
  art_mirror:   { name: '护体宝镜', slot: 'robe',   rarity: 3, stat: 'def',  val: 35,   desc: '防御' },
};
const ART_LV_MAX = 10;
const artValue = (id, lv) => ARTIFACTS[id].val * (1 + 0.15 * lv);
const artCost = lv => Math.round(800 * Math.pow(1.25, lv));
const artText = (id, lv) => { const a = ARTIFACTS[id], v = artValue(id, lv); return a.stat === 'def' ? `${a.desc} +${Math.round(v)}` : `${a.desc} +${Math.round(v * 100)}%`; };
const attrMax = pd => 5 + pd.realm * 2;                        // 境界越高，属性上限越高
// 属性升级费用：前 25 级照原本 ×1.16（前期便宜好升），之后改成多项式成长（不然上限 165 级时会变天文数字）
const attrCost = (id, lv) => Math.round((id === 'crit' ? 560 : 400) * (lv <= 25 ? Math.pow(1.16, lv) : Math.pow(1.16, 25) * Math.pow(lv / 25, 2.5)));
const skillCost = lv => 40 * (lv + 1);
const SKILL_PERM_MAX = 10;
// 角色数值：境界倍率 × 属性等级
function calcStats(pd) {
  const rm = 1 + 0.06 * pd.realm, L = pd.lv;
  const eq = { atk: 0, hp: 0, def: 0, crit: 0 }; // 法宝加成
  for (const slot in (pd.equip || {})) { const id = pd.equip[slot]; if (id && pd.arts && pd.arts[id] != null) eq[ARTIFACTS[id].stat] += artValue(id, pd.arts[id]); }
  const sb = pd.sect ? sectBonus(pd) : 0; // 宗门加成
  const atk = CFG.atk.dmg * (1 + 0.1 * L.atk) * rm * (1 + eq.atk) * (1 + sb);
  const hp = CFG.playerHp * (1 + 0.1 * L.hp) * rm * (1 + eq.hp) * (1 + sb);
  const def = (6 * L.def + eq.def) * rm;
  const crit = Math.min(0.6, CFG.atk.crit + 0.01 * L.crit + eq.crit);
  return { atk, hp, def, crit, power: Math.round(atk * 25 + hp * 1.2 + def * 12 + crit * 3000) };
}
const player = {
  get() {
    const p = store.get('player', null) || { stamina: STAMINA_MAX, staminaAt: Date.now(), crystal: 3250, coin: 128600 };
    p.realm = p.realm || 0; p.xp = p.xp || 0;
    if (!p.idleAt) p.idleAt = Date.now(); // 挂机收益从这个时间开始算
    p.lv = Object.assign({ atk: 0, def: 0, hp: 0, crit: 0 }, p.lv);
    p.sk = Object.assign({ water: 0, thunder: 0, fire: 0, shield: 0, sword: 0 }, p.sk);
    const td = today();
    if (!p.daily || p.daily.date !== td) p.daily = { date: td, wins: 0, kills: 0, ups: 0, signed: false, claimed: {}, endless: ENDLESS_TRIES, trial: TRIAL_TRIES, secret: SECRET_TRIES, donated: 0 };
    if (p.daily.trial == null) { p.daily.trial = TRIAL_TRIES; p.daily.secret = SECRET_TRIES; p.daily.donated = 0; }
    p.name = p.name || '清风逐月';
    p.uid = p.uid || 100000 + Math.floor(Math.random() * 900000);
    p.sect = Object.assign({ exp: 0, contrib: 0, bestTrial: 0, bought: {} }, p.sect);
    p.bestSecret = p.bestSecret || 0;
    p.stats = Object.assign({ kills: 0, wins: 0, stars3: 0, supers: 0, chests: 0, bosses: 0 }, p.stats);
    p.ach = p.ach || {};
    p.sign = p.sign || { n: 0, last: '' };
    p.mails = p.mails || defaultMails();
    p.bestEndless = p.bestEndless || 0;
    p.arts = p.arts || { art_sword: 0 };            // 拥有的法宝 → 强化等级（开局送青锋剑）
    p.equip = Object.assign({ weapon: 'art_sword', charm: null, gourd: null, robe: null }, p.equip);
    const gain = Math.floor((Date.now() - p.staminaAt) / 1000 / STAMINA_REGEN);
    if (gain > 0) { p.stamina = Math.min(STAMINA_MAX, p.stamina + gain); p.staminaAt += gain * STAMINA_REGEN * 1000; }
    if (p.stamina >= STAMINA_MAX) p.staminaAt = Date.now();
    return p;
  },
  save(p) { store.set('player', p); },
  // 测试用：网址加 ?refill 就补满今天的活动次数（妖兽来袭、宗门试炼、秘境）
  refill() { const p = this.get(); p.daily.endless = ENDLESS_TRIES; p.daily.trial = TRIAL_TRIES; p.daily.secret = SECRET_TRIES; this.save(p); },
  power() { return calcStats(this.get()).power; },
};
const fmtNum = n => Math.round(n).toLocaleString();
// 战力：底框＋剑徽＋书法数字
function powerTag(scene, x, y, v) {
  const key = scene.textures.exists('ui_power') ? 'ui_power' : 'ui_topbar';
  const bg = scene.add.image(x, y, key);
  bg.setScale(230 / bg.width);
  if (key === 'ui_topbar') { const ic = scene.add.image(x - 92, y, 'attr_atk'); ic.setScale(46 / ic.height); }
  const nx = key === 'ui_power' ? x + 26 : x + 14; // 新框左边是双剑徽，数字往右放
  if (scene.cache.bitmapFont.exists('font_gold')) {
    const str = String(Math.round(v));
    [[3, 4, 0.75], [-1.5, 0, 0.9], [1.5, 0, 0.9], [0, -1.5, 0.9], [0, 1.5, 0.9]].forEach(([dx, dy, a]) =>
      scene.add.bitmapText(nx + dx, y + 2 + dy, 'font_gold', str, 96).setOrigin(0.5).setLetterSpacing(-22).setScale(0.36).setTintFill(0x0a0604).setAlpha(a));
    scene.add.bitmapText(nx, y + 2, 'font_gold', str, 96).setOrigin(0.5).setLetterSpacing(-22).setScale(0.36);
  } else txt(scene, nx, y, fmtNum(v), 22, '#ffd36b');
}
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const ENDLESS_TRIES = 3, TRIAL_TRIES = 2, SECRET_TRIES = 2;
// 宗门等级：捐献累积经验；每级全队攻击、气血 +2%
const sectLevel = exp => { let lv = 1, need = 1000; while (exp >= need && lv < 20) { exp -= need; lv++; need = Math.round(need * 1.35); } return { lv, cur: exp, need }; };
const sectBonus = pd => (sectLevel(pd.sect.exp).lv - 1) * 0.02;
// 奖励：{ crystal, coin, stamina, xp, art: true(随机法宝) }
function grant(pd, rw) {
  pd.crystal += rw.crystal || 0; pd.coin += rw.coin || 0; pd.xp += rw.xp || 0;
  if (rw.stamina) pd.stamina = Math.min(STAMINA_MAX * 2, pd.stamina + rw.stamina);
  if (rw.art) { const left = Object.keys(ARTIFACTS).filter(k => pd.arts[k] == null); if (left.length) { const a = pick(left); pd.arts[a] = 0; return a; } pd.coin += 5000; }
  return null;
}
const RW_ICON = { crystal: 'res_crystal', coin: 'res_coin', stamina: 'res_gourd', xp: 'res_stone', art: 'res_scroll' };
const RW_NAME = { crystal: '灵晶', coin: '金币', stamina: '体力', xp: '修为', art: '随机法宝' };
const rwText = rw => Object.keys(rw).map(k => k === 'art' ? '随机法宝' : `${RW_NAME[k]}×${fmtNum(rw[k])}`).join('  ');
const defaultMails = () => [
  { id: 1, title: '欢迎来到仙途问道', body: '道友初入仙途，宗门特赠修行资源，望早日问鼎大道。', rw: { crystal: 500, coin: 20000 }, got: false },
  { id: 2, title: '原型测试补偿', body: '感谢参与测试，奉上体力补给。', rw: { stamina: 60 }, got: false },
  { id: 3, title: '活动预告', body: '「秘境寻宝」将于每周六开放，敬请期待。', rw: null, got: false },
];
// ───── 难度跟着境界走 ─────
// 每一关对应一个境界：简易 1～100 关 → 练气一层～元婴四层；普通～梦魇（101～500）→ 元婴四层～渡劫九层
const stageRealm = G => (G <= STAGE_MAX ? (G - 1) * 30 / (STAGE_MAX - 1) : 30 + (G - STAGE_MAX) * 50 / (STAGE_MAX * 4));
// 「一般玩家」在境界 r 的数值：属性点到上限约六成、法宝和宗门加成慢慢补上（境界 20 以后约 +43%）
function typStats(r) {
  const c = 2 * r * 0.6, rm = 1 + 0.06 * r, gear = 1 + 0.43 * Math.min(1, r / 20);
  const atk = CFG.atk.dmg * (1 + 0.1 * c) * rm * gear, hp = CFG.playerHp * (1 + 0.1 * c) * rm * gear;
  const def = (6 * c + 30 * Math.min(1, r / 20)) * rm, crit = Math.min(0.6, CFG.atk.crit + 0.01 * c);
  return { atk, hp, power: atk * 25 + hp * 1.2 + def * 12 + crit * 3000 };
}
const stageSlope = G => 1 + 0.003 * (G - 1); // 越后面越难一点点（同战力下）
const stageMul = G => typStats(stageRealm(G)).atk / CFG.atk.dmg * (1 + 0.0015 * (G - 1)); // 妖兽血量倍率 ∝ 推荐攻击（后面关卡怪也多，血量斜率放缓）
const stageDmgMul = G => typStats(stageRealm(G)).hp / CFG.playerHp * stageSlope(G);    // 妖兽伤害倍率 ∝ 推荐气血 // 第 100 关约 167 倍；修炼满约 40 倍攻击＋局内强化
// 战力对应的关卡：推荐战力 ≤ 你战力的最高那关（妖兽来袭从这关的难度起跳）
const powerStage = pw => { let n = 1; while (n < STAGE_TOTAL && recommendPower(n + 1) <= pw) n++; return n; };
const recommendPower = G => Math.round(typStats(stageRealm(G)).power);

// 共用：顶部资源列
// vertical：主页把资源直排在右上角
function resourceBar(scene, y, depth = 50, vertical = false) {
  const p = player.get();
  const items = [['res_gourd', `${p.stamina}/${STAMINA_MAX}`], ['res_crystal', fmtNum(p.crystal)], ['res_coin', fmtNum(p.coin)]];
  const c = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  items.forEach(([icon, val], i) => {
    const x = vertical ? 600 : 130 + i * 230;
    if (vertical) y = 44 + i * 54;
    const bar = scene.add.image(x, y, 'ui_topbar');
    bar.setScale(210 / bar.width);
    const ic = scene.add.image(x - 88, y, icon);
    ic.setScale(54 / ic.height);
    c.add([bar, ic, txt(scene, x - 8, y, val, 22, '#ffffff')]);
    // 「+」：体力＝用灵晶补体力、灵晶＝去礼包商城（不能直接买灵晶）、金币＝用灵晶换金币（点击区不放进 container，理由同关卡面板）
    const hit = scene.add.zone(x + 85, y, 52, 52).setInteractive({ useHandCursor: true }).setScrollFactor(0).setDepth(depth + 1);
    hit.on('pointerdown', () => [showBuyStamina, goTopup, showBuyCoin][i](scene));
  });
  c.setScrollFactor(0, 0, true);
  return c;
}

// 提示：同时只显示一则，新的直接取代旧的（快速连点不会叠在一起）
function toast(scene, msg) {
  if (scene._toast) { scene.tweens.killTweensOf(scene._toast); scene._toast.destroy(); }
  const c = scene.add.container(W / 2, H * 0.42).setDepth(500);
  const t = txt(scene, 0, 0, msg, 30, '#ffe7a3');
  const g = scene.add.graphics();
  const w = t.width + 80;
  g.fillStyle(0x0d1220, 0.92).fillRoundedRect(-w / 2, -38, w, 76, 16).lineStyle(2, 0xd9b45a, 0.9).strokeRoundedRect(-w / 2, -38, w, 76, 16);
  c.add([g, t]).setScrollFactor(0, 0, true);
  scene._toast = c;
  c.setAlpha(0).setScale(0.9);
  scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 140, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: c, alpha: 0, y: c.y - 30, delay: 1100, duration: 350, onComplete: () => { if (scene._toast === c) scene._toast = null; c.destroy(); } });
}

function imgButton(scene, x, y, key, width, cb) {
  const b = scene.add.image(x, y, key);
  b.setScale(width / b.width).setInteractive({ useHandCursor: true });
  const base = b.scale;
  b.on('pointerdown', () => { sfx(scene, 'click', 0.35); scene.tweens.add({ targets: b, scale: base * 0.94, duration: 60, yoyo: true }); cb(); });
  b.on('pointerover', () => b.setScale(base * 1.04)).on('pointerout', () => b.setScale(base));
  return b;
}

function redDot(scene, x, y) {
  const g = scene.add.graphics();
  g.fillStyle(0xd81e1e).fillCircle(x, y, 11).lineStyle(2, 0xffd0d0).strokeCircle(x, y, 11);
  return g;
}

// 载入完成后的共用设定（动画、shader）
function setupAfterLoad(scene) {
  makeTextures(scene);
  const m = scene.registry.get('manifest');
  const once = (key, rate) => { if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: m[key + '.jpg'].frames - 1 }), frameRate: rate, hideOnComplete: true }); };
  once('fx_hit', 30); once('fx_death', 22); once('fx_explosion', 20); once('fx_thunder', 24);
  if (m['fx_gate_break.jpg']) once('fx_gate_break', 20);
  if (m['fx_pickup.jpg']) once('fx_pickup', 16);
  for (const file in m) {
    const meta = m[file];
    const key = file.replace(/\.\w+$/, '');
    if (meta.anim && !scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(key, { start: 0, end: meta.frames - 1 }), frameRate: meta.fps, repeat: meta.loop ? -1 : 0 }); // 最后一排没填满的空格不能播
  }
  for (const [key, chars] of [['font_gold', '0123456789+%'], ['font_crit', '0123456789+!'], ['font_super', '0123456789+!'], ['font_stage', '第0123456789关']]) {
    const meta = m[key + '.png'];
    if (meta && meta.font && !scene.cache.bitmapFont.exists(key)) {
      scene.cache.bitmapFont.add(key, Phaser.GameObjects.RetroFont.Parse(scene, { image: key, width: meta.cw, height: meta.ch, chars: chars.slice(0, meta.n), charsPerRow: meta.n, 'offset.x': 0, 'offset.y': 0, 'spacing.x': 0, 'spacing.y': 0, lineSpacing: 0 }));
    }
  }
  if (!scene.cache.shader.exists('road')) {
    scene.cache.shader.add('road', new Phaser.Display.BaseShader('road', ROAD_FRAG, undefined, {
      uScroll: { type: '1f', value: 0 }, uTexH: { type: '1f', value: 580 / 0.9 }, uRailH: { type: '1f', value: 44 / 64 * 512 }, uFog: { type: '3f', value: { x: 0.86, y: 0.9, z: 0.97 } },
    }));
  }
}

function queueAssets(scene, filter) {
  const m = scene.registry.get('manifest');
  const v = '?v=' + scene.registry.get('ver');
  for (const file in m) {
    const meta = m[file];
    if (!filter(meta)) continue;
    const key = file.replace(/\.\w+$/, '');
    if (scene.textures.exists(key)) continue;
    if (meta.frames) scene.load.spritesheet(key, 'assets/' + file + v, { frameWidth: meta.frameWidth, frameHeight: meta.frameHeight });
    else scene.load.image(key, 'assets/' + file + v);
  }
}

// ───── 载入（只载登入页要的图） ─────
class LoadScene extends Phaser.Scene {
  constructor() { super('load'); }
  preload() {
    this.registry.set('ver', Date.now());
    this.load.json('manifest', 'assets/manifest.json?v=' + Date.now());
    this.load.json('audiolist', 'audio/audio.json?v=' + Date.now());
    txt(this, W / 2, H / 2, '载入中…', 36);
  }
  create() {
    this.registry.set('manifest', this.cache.json.get('manifest'));
    AUD.list = this.cache.json.get('audiolist') || { bgm: [], sfx: [] };
    makeTextures(this);
    queueAssets(this, meta => meta.boot);
    this.load.once('complete', () => this.scene.start('login'));
    this.load.start();
  }
}

// ───── 登入页：背景载入其余素材 ─────
class LoginScene extends Phaser.Scene {
  constructor() { super('login'); }
  create() {
    playBgm(this, 'title');
    const bg = this.add.image(W / 2, H / 2, 'bg_login');
    this.tweens.add({ targets: bg, scale: 1.06, duration: 12000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // 遮罩：上下压暗，Logo 和按钮才清楚
    const mask = this.add.graphics().setDepth(1);
    mask.fillStyle(0x060a14, 0.18).fillRect(0, 0, W, H);
    mask.fillGradientStyle(0x060a14, 0x060a14, 0x060a14, 0x060a14, 0.6, 0.6, 0, 0).fillRect(0, 0, W, 520);
    mask.fillGradientStyle(0x060a14, 0x060a14, 0x060a14, 0x060a14, 0, 0, 0.85, 0.85).fillRect(0, 780, W, 500);
    // 飘动的云雾
    for (let i = 0; i < 7; i++) {
      const c = this.add.image(rand(-100, W + 100), rand(560, 1000), 'cloud').setDepth(1).setAlpha(rand(0.35, 0.6)).setScale(rand(2.5, 4.5));
      this.tweens.add({ targets: c, x: c.x + (i % 2 ? 260 : -260), duration: rand(14000, 22000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    // Logo 背后的剑光与放射光芒
    const beam = this.add.image(W / 2, 260, 'beam').setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setScale(1.6, 1.1).setAlpha(0.22);
    this.tweens.add({ targets: beam, alpha: 0.4, scaleX: 2.1, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const rays = this.add.image(W / 2, 290, 'rays').setDepth(1).setBlendMode(Phaser.BlendModes.ADD).setScale(1.5).setAlpha(0.45).setTint(0xffd890);
    this.tweens.add({ targets: rays, angle: 360, duration: 60000, repeat: -1 });
    const logo = this.add.image(W / 2, 300, 'logo').setDepth(2);
    const ls = 660 / logo.width;
    if (logo.preFX) { logo.preFX.addGlow(0xffd27a, 3, 0, false, 0.1, 12); logo.preFX.addShine(0.4, 0.3, 4); }
    logo.setAlpha(0).setScale(ls * 1.3);
    this.tweens.add({ targets: logo, alpha: 1, scale: ls, duration: 900, ease: 'Back.easeOut' });
    this.tweens.add({ targets: logo, y: 292, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 900 });
    const glow = this.add.particles(0, 0, 'glow', { x: { min: 0, max: W }, y: H + 20, speedY: { min: -60, max: -140 }, speedX: { min: -20, max: 20 }, lifespan: 9000, scale: { min: 0.15, max: 0.35 }, alpha: { start: 0.8, end: 0 }, tint: 0xffd890, frequency: 160, blendMode: 'ADD' });
    glow.setDepth(1);
    // 公告／账号
    [['公告', 90], ['账号', 200]].forEach(([s, y]) => {
      const g = this.add.graphics().setDepth(2);
      g.fillStyle(0x1a2238, 0.9).fillCircle(650, y, 42).lineStyle(3, 0xd9b45a).strokeCircle(650, y, 42);
      txt(this, 650, y, s, 24, '#ffe7a3').setDepth(2);
      this.add.zone(650, y, 84, 84).setInteractive({ useHandCursor: true }).on('pointerdown', () => (s === '公告' ? showNotice : showAccount)(this));
    });
    txt(this, 24, H - 30, 'v0.3.0', 20, '#cfd8e8', 0).setDepth(2);

    this.btn = imgButton(this, W / 2, 1060, 'btn_challenge', 470, () => this.enter()).setDepth(3).setAlpha(0.6);
    if (this.btn.preFX) this.btn.preFX.addShine(0.6, 0.25, 3);
    this.btnText = btnText(this, W / 2, 1054, 'txt_start', '开始游戏', 70, 52).setDepth(4);
    const bw = 520;
    this.barBg = this.add.graphics().setDepth(3);
    this.barBg.fillStyle(0x0d1220, 0.85).fillRoundedRect(W / 2 - bw / 2 - 4, 1186, bw + 8, 22, 11);
    this.bar = this.add.graphics().setDepth(4);
    this.barText = txt(this, W / 2, 1232, '加载中 0%', 24, '#ffffff').setDepth(4);
    this.ready = false;
    queueAssets(this, () => true);
    AUD.list.sfx.forEach(k => { if (!this.cache.audio.exists('sfx_' + k)) this.load.audio('sfx_' + k, 'audio/sfx/' + k + '.mp3'); });
    this.load.on('progress', p => {
      this.bar.clear().fillStyle(0x4aa8ff).fillRoundedRect(W / 2 - bw / 2, 1190, Math.max(14, bw * p), 14, 7);
      this.barText.setText('加载中 ' + Math.round(p * 100) + '%');
    });
    let tries = 0;
    const loaded = () => { // 手机网路不稳时有些图会载失败（变成绿框）：漏掉的再补抓，最多两次
      queueAssets(this, () => true);
      if (this.load.list.size > 0 && tries++ < 2) { this.load.once('complete', loaded); this.load.start(); return; }
      setupAfterLoad(this);
      this.ready = true;
      this.bar.clear().fillStyle(0x4aa8ff).fillRoundedRect(W / 2 - bw / 2, 1190, bw, 14, 7);
      this.barText.setText('点击「开始游戏」');
      this.btn.setAlpha(1);
    };
    this.load.once('complete', loaded);
    this.load.start();
    if (!this.load.isLoading() && this.load.list.size === 0) this.load.emit('complete');
  }
  enter() {
    if (!this.ready) { toast(this, '资源加载中…'); return; }
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('home'));
  }
}

// ───── 主页（洞府） ─────
class HomeScene extends Phaser.Scene {
  constructor() { super('home'); }
  create() {
    playBgm(this, 'menu'); // 主页跟修炼等页同一首（灵山），切页时音乐不中断
    this.cameras.main.fadeIn(300);
    this.add.image(W / 2, H / 2, 'bg_home');
    const veil = this.add.graphics();
    veil.fillStyle(0x060a14, 0.15).fillRect(0, 0, W, H);
    veil.fillGradientStyle(0x060a14, 0x060a14, 0x060a14, 0x060a14, 0.7, 0.7, 0, 0).fillRect(0, 0, W, 300);
    veil.fillGradientStyle(0x060a14, 0x060a14, 0x060a14, 0x060a14, 0, 0, 0.8, 0.8).fillRect(0, 820, W, 460);
    veil.fillGradientStyle(0x060a14, 0x060a14, 0x060a14, 0x060a14, 0.5, 0, 0.5, 0).fillRect(0, 250, 170, 640);
    veil.fillGradientStyle(0x060a14, 0x060a14, 0x060a14, 0x060a14, 0, 0.5, 0, 0.5).fillRect(550, 180, 170, 460);
    this.add.image(W / 2, 1080, 'glow').setTint(0x000000).setAlpha(0.8).setScale(6, 1.1); // 脚下影子
    const hero = fitH(this.add.image(W / 2, 1090, 'hero_sword_full').setOrigin(0.5, 1), 800);
    if (hero.preFX) { hero.preFX.addShadow(-0.4, -0.6, 0.06, 0.8, 0x000000, 8, 0.6); hero.preFX.addGlow(0xbfe0ff, 1.5, 0, false, 0.1, 8); }
    const hs = hero.scaleY;
    this.tweens.add({ targets: hero, scaleY: hs * 1.012, y: 1088, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.add.particles(0, 0, 'glow', { x: { min: 180, max: 540 }, y: { min: 500, max: 1000 }, speedY: { min: -20, max: -50 }, lifespan: 3000, scale: { start: 0.25, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: 0x9fd8ff, frequency: 220, blendMode: 'ADD' });

    // 头像＋名牌
    const plaque = this.add.image(300, 78, 'ui_plaque_bar');
    plaque.setScale(380 / plaque.width);
    const pd = player.get();
    txt(this, 310, 56, pd.name, 30, '#ffffff');
    realmImg(this, 310, 101, pd.realm, 30);
    powerTag(this, 250, 160, player.power());
    const fr = this.add.image(78, 82, 'frame_avatar');
    fr.setScale(142 / fr.height);
    const av = this.add.image(78, 82, 'avatar_hero');
    av.setScale(98 / av.height);
    // 点头像或齿轮 → 设置
    this.add.zone(78, 82, 130, 130).setInteractive({ useHandCursor: true }).on('pointerdown', () => { sfx(this, 'click', 0.35); showSettings(this); });
    const gear = this.add.graphics();
    gear.fillStyle(0x1a2238).fillCircle(118, 128, 18).lineStyle(2, 0xd9b45a).strokeCircle(118, 128, 18);
    gear.fillStyle(0xffe7a3);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; gear.fillCircle(118 + Math.cos(a) * 9, 128 + Math.sin(a) * 9, 3.2); }
    gear.fillCircle(118, 128, 8).fillStyle(0x1a2238).fillCircle(118, 128, 3.5);
    const g = this.add.graphics();
    g.fillStyle(0x1a2238).fillCircle(40, 128, 18).lineStyle(2, 0xd9b45a).strokeCircle(40, 128, 18);
    txt(this, 40, 128, String(pd.realm + 1), 18, '#ffffff');
    resourceBar(this, 0, 50, true);

    // 左右入口
    const shadow = (x, y, size) => this.add.image(x + 3, y + 6, 'glow').setTint(0x000000).setAlpha(0.75).setScale(size / 40);
    const dots = homeDots(pd);
    const entry = (x, y, icon, label, fn, dot) => {
      shadow(x, y, 104);
      imgButton(this, x, y, icon, 92, fn);
      txt(this, x, y + 54, label, 24, '#ffffff');
      if (dot) { const d = redDot(this, x + 34, y - 34); this.tweens.add({ targets: d, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 }); }
    };
    entry(70, 270, 'ent_event', '活动', () => this.go('events'), dots.event);
    entry(70, 400, 'ent_task', '任务', () => showTasks(this), dots.task);
    entry(70, 530, 'ent_signin', '签到', () => showSignin(this), dots.sign);
    entry(70, 660, 'ent_mail', '邮件', () => showMail(this), dots.mail);
    // 挂机收益：有专属图示 ent_idle 就用（docs/21），没有先用宝箱图
    entry(70, 790, this.textures.exists('ent_idle') ? 'ent_idle' : 'gate_chest', '挂机', () => showIdle(this), dots.idle);
    const idleT = txt(this, 70, 870, '', 16, '#ffe7a3');
    const tick = () => { const m = idleMinutes(player.get()); idleT.setText(m >= IDLE.min ? fmtIdle(m) : `${IDLE.min - Math.floor(m)} 分钟后可领`); };
    tick(); this.time.addEvent({ delay: 1000, loop: true, callback: tick });
    entry(650, 660, this.textures.exists('m_gold') ? 'm_gold' : 'ent_rank', '成就', () => showAchievements(this), dots.ach);
    entry(650, 270, 'ent_shop', '商店', () => this.go('shop'), false);
    entry(650, 400, 'ent_gift', '礼包', () => this.scene.start('shop', { tab: 'mall' }), PLATFORM.pending().length > 0 || !(player.get().bought || {})['xiantu:bundle:first_buy']);
    entry(650, 530, 'ent_rank', '排行', () => showRank(this), false);

    // 活动卡＋闯关
    const hd = curDiff(), unlocked = unlockedOf(hd);
    const card = (x, key, name, time) => {
      shadow(x, 962, 190);
      imgButton(this, x, 960, key, 168, () => this.go('events')); // 两张卡都进活动页
      txt(this, x, 1064, name, 26, '#ffffff');
      txt(this, x, 1096, time, 18, '#ffe7a3');
      redDot(this, x + 72, 886);
    };
    card(112, 'card_secret', '秘境寻宝', '剩余 1天10小时');
    card(608, 'card_beast', '妖兽来袭', '剩余 2天6小时');
    shadow(W / 2, 1004, 300);
    const btn = imgButton(this, W / 2, 1000, 'btn_challenge', 330, () => this.go('stagemap'));
    if (btn.preFX) btn.preFX.addShine(0.5, 0.25, 3);
    this.tweens.add({ targets: btn, alpha: 0.85, duration: 900, yoyo: true, repeat: -1 });
    btnText(this, W / 2, 982, 'txt_challenge', '闯关', 78, 60);
    stageText(this, W / 2, 1034, Math.min(unlocked, STAGE_MAX), 34, 24);
    if (hd) txt(this, W / 2, 1068, DIFFS[hd].name, 22, DIFFS[hd].color);

    navBar(this, 'home');
    showDeliveries(this); // 平台发货完成：跳「已到帐」
  }
  go(key) {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
  }
}

// ───── 关卡地图 ─────
// 主线 100 关：4 章 × 25 关，每章一张背景（bg_stagemap / 2 / 3 / 4，没有就沿用第一张换色）
const STAGE_MAX = 100, PER_CH = 25, SEG = 3000;
// 五个难度：同一套 100 关重打，难度接续（普通第 1 关 ≈ 简易第 100 关再强一点）；关卡在公式里用「总关数」G = 关 + 100 × 难度
const DIFFS = [
  { name: '简易', color: '#9fe0a0', tint: 0x000000, tintA: 0,    reward: 1 },
  { name: '普通', color: '#8fc4ff', tint: 0x1a3a8a, tintA: 0.16, reward: 2 },
  { name: '困难', color: '#ff9a7a', tint: 0x8a1a10, tintA: 0.2,  reward: 3 },
  { name: '地狱', color: '#ff6060', tint: 0x2a0000, tintA: 0.32, reward: 5 },
  { name: '梦魇', color: '#d0a0ff', tint: 0x3a0a5a, tintA: 0.3,  reward: 8 },
];
const STAGE_TOTAL = STAGE_MAX * DIFFS.length;
const unlockKey = d => (d ? 'unlocked_d' + d : 'unlocked'), starKey = d => (d ? 'stars_d' + d : 'stars');
const unlockedOf = d => store.get(unlockKey(d), 1);
const diffOpen = d => d === 0 || unlockedOf(d - 1) > STAGE_MAX;          // 上一个难度打完第 100 关才开放
const maxDiff = () => { let d = 0; while (d + 1 < DIFFS.length && diffOpen(d + 1)) d++; return d; };
const curDiff = () => clamp(store.get('diff', 0), 0, maxDiff());
const diffLabel = d => (d ? ` · ${DIFFS[d].name}` : '');
const CHAPTERS = [
  { name: '青云山', regions: ['落云谷', '凌云峰'], tint: 0xffffff, boss: '玄狼妖王' },
  { name: '万妖林', regions: ['蛇骨沼', '千藤岭'], tint: 0xb8e0a8, boss: '赤焰蛟王' },
  { name: '幽冥谷', regions: ['白骨坡', '冥河渡'], tint: 0x9fb4e8, boss: '骨魔将军' },
  { name: '魔渊',   regions: ['血月台', '天魔殿'], tint: 0xe8a0a0, boss: '天魔宗主' },
];
const chapterOf = n => Math.min(CHAPTERS.length - 1, Math.floor((n - 1) / PER_CH));
class StageMapScene extends Phaser.Scene {
  constructor() { super('stagemap'); }
  create() {
    playBgm(this, 'map');
    this.cameras.main.fadeIn(250);
    const MH = SEG * CHAPTERS.length; // 第一章在最下面，往上爬
    CHAPTERS.forEach((ch, c) => {
      const key = c === 0 ? 'bg_stagemap' : `bg_stagemap${c + 1}`;
      const own = this.textures.exists(key);
      const bg = this.add.image(0, MH - (c + 1) * SEG, own ? key : 'bg_stagemap').setOrigin(0).setDisplaySize(W, SEG);
      if (!own) { bg.setTint(ch.tint); if (c % 2) bg.setFlipX(true); } // 还没有专属背景：换色、翻面，至少看得出换章
    });
    const veil = this.add.graphics(); // 黑色遮罩：关卡图示和字才跳得出来
    veil.fillStyle(0x05080f, 0.42).fillRect(0, 0, W, MH);
    veil.fillGradientStyle(0x05080f, 0, 0x05080f, 0, 0.45, 0, 0.45, 0).fillRect(0, 0, 200, MH);
    veil.fillGradientStyle(0, 0x05080f, 0, 0x05080f, 0, 0.45, 0, 0.45).fillRect(W - 200, 0, 200, MH);
    // 章与章之间：一条暗雾带盖住背景接缝
    for (let c = 1; c < CHAPTERS.length; c++) {
      const y = MH - c * SEG;
      veil.fillGradientStyle(0x05080f, 0x05080f, 0x05080f, 0x05080f, 0, 0, 0.9, 0.9).fillRect(0, y - 160, W, 160);
      veil.fillGradientStyle(0x05080f, 0x05080f, 0x05080f, 0x05080f, 0.9, 0.9, 0, 0).fillRect(0, y, W, 160);
    }
    const TOP = 260; // 顶部按钮的高度：地图可以多往下卷这么多，第 100 关才不会被盖住
    this.cameras.main.setBounds(0, -TOP, W, MH + TOP);
    veil.fillStyle(0x05080f, 1).fillRect(0, -TOP, W, TOP + 2);
    const D = this.diff = curDiff();
    if (DIFFS[D].tintA) this.add.rectangle(0, 0, W, MH, DIFFS[D].tint, DIFFS[D].tintA).setOrigin(0); // 每个难度的地图色调
    const unlocked = Math.min(unlockedOf(D), STAGE_MAX + 1);
    const stars = store.get(starKey(D), {});
    const first = 1;
    // 第 n 关的位置：每章 25 关在自己那张背景里蜿蜒往上，避开右下的资讯面板
    const pos = i => { const c = Math.floor(i / PER_CH), j = i % PER_CH; return [235 + Math.sin(i * 0.75) * 140, MH - c * SEG - 430 - j * (SEG - 700) / (PER_CH - 1)]; };

    // 路径光点
    const path = this.add.graphics();
    for (let i = 0; i < STAGE_MAX - 1; i++) {
      const [x0, y0] = pos(i), [x1, y1] = pos(i + 1);
      const steps = Math.max(3, Math.round(Math.hypot(x1 - x0, y1 - y0) / 26));
      for (let k = 1; k < steps; k++) {
        const done = first + i < unlocked;
        path.fillStyle(done ? 0xffd36b : 0xb8c0cc, done ? 0.95 : 0.6).fillCircle(x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps, 5);
      }
    }
    // 每章：章名横幅（章底）＋两块区域牌匾
    CHAPTERS.forEach((ch, c) => {
      const base = MH - c * SEG;
      const locked = c * PER_CH + 1 > unlocked;
      this.add.text(W / 2, base - 230, `第${CN_NUM[c + 1]}章 · ${ch.name}`, { fontFamily: FONT_T, fontSize: '54px', color: locked ? '#8a93a6' : '#ffe3a0', padding: { x: 8, y: 8 } })
        .setOrigin(0.5).setShadow(0, 4, '#000000', 10, false, true);
      ch.regions.forEach((name, k) => {
        const x = k ? 60 : 560, y = base - SEG * (k ? 0.62 : 0.3); // 右边留给难度徽章
        const pl = this.add.image(x, y, 'ui_region_plaque');
        pl.setScale(170 / pl.height);
        txt(this, x, y - 4, name.split('').join('\n'), 26, '#ffe7a3').setLineSpacing(-4);
      });
    });
    this.nodes = [];
    for (let i = 0; i < STAGE_MAX; i++) {
      const n = first + i, [x, y] = pos(i);
      const isBoss = n % PER_CH === 0; // 每章最后一关是妖王
      const state = n < unlocked ? 'cleared' : n === unlocked ? 'current' : 'locked';
      const key = isBoss ? 'node_boss' : state === 'cleared' ? 'node_cleared' : state === 'current' ? 'node_current' : 'node_locked';
      const size = isBoss ? 150 : state === 'current' ? 120 : 90;
      const side = x < 235 ? 1 : -1;
      const lx = x + side * (size / 2 + (isBoss ? 80 : 66)), ly = y; // 关卡名放旁边（妖王名字长，分两行）
      const img = this.add.image(x, y, key);
      img.setScale(size / img.height);
      if (isBoss && state === 'locked') img.setTint(0x888888);
      if (state === 'current') this.tweens.add({ targets: img, scale: img.scale * 1.08, duration: 700, yoyo: true, repeat: -1 });
      // 关卡名：不加框，用柔和投影；目前关卡金色、已过米白、未开放灰
      const col = state === 'current' ? '#ffd877' : state === 'cleared' ? '#f3e6c8' : '#9aa3b2';
      this.add.text(lx, ly, isBoss ? `${CHAPTERS[chapterOf(n)].boss}
第${n}关` : `第${n}关`, { fontFamily: FONT_L, fontSize: (state === 'current' || isBoss ? 34 : 28) + 'px', color: col, padding: { x: 6, y: 6 } })
        .setOrigin(0.5).setShadow(0, 3, '#000000', 8, false, true);
      if (state === 'cleared') {
        const sc = stars[n] || 0;
        for (let k = 0; k < 3; k++) {
          const st = this.add.image(lx - 26 + k * 26, ly + (isBoss ? 60 : 34), 'node_star');
          st.setScale(30 / st.height).setAlpha(k < sc ? 1 : 0.25);
        }
      }
      if (state !== 'locked') {
        img.setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!this.dragged) this.select(n); });
      }
      this.nodes.push({ n, x, y, img });
    }
    // 拖曳卷动
    const cam = this.cameras.main;
    cam.scrollY = clamp(pos(Math.min(unlocked, STAGE_MAX) - first)[1] - H * 0.5, -TOP, MH - H);
    this.input.on('pointerdown', p => { this.dragY = p.y; this.dragStart = cam.scrollY; this.dragged = false; });
    this.input.on('pointermove', p => {
      if (!p.isDown || this.dragY == null) return;
      if (Math.abs(p.y - this.dragY) > 8) this.dragged = true;
      cam.scrollY = clamp(this.dragStart - (p.y - this.dragY), -TOP, MH - H);
    });
    this.input.on('pointerup', () => { this.dragY = null; });
    this.input.on('wheel', (p, objs, dx, dy) => { cam.scrollY = clamp(cam.scrollY + dy, -TOP, MH - H); });

    // 固定介面
    const top = this.add.graphics().setScrollFactor(0).setDepth(40);
    top.fillGradientStyle(0x0b0f18, 0x0b0f18, 0x0b0f18, 0x0b0f18, 0.92, 0.92, 0, 0).fillRect(0, 0, W, 300);
    // 难度：右侧一排直立的徽章（有 diff_badge_* 图就用图，docs/19）；只显示已开放的＋下一个「？」，更后面的看不到
    const shown = Math.min(DIFFS.length, maxDiff() + 2), CH = ['易', '普', '难', '狱', '魇'];
    for (let d = 0; d < shown; d++) {
      const open = diffOpen(d), on = d === D, x = W - 50, y = 330 + d * 88;
      const key = open ? 'diff_badge_' + d : 'diff_badge_lock', R = on ? 32 : 27;
      if (on) { const gl = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36b).setScale(2.3).setAlpha(0.7).setScrollFactor(0).setDepth(49); this.tweens.add({ targets: gl, alpha: 0.35, duration: 900, yoyo: true, repeat: -1 }); }
      if (this.textures.exists(key)) {
        const im = this.add.image(x, y, key).setScrollFactor(0).setDepth(50);
        im.setScale(R * 2.2 / im.height);
        if (open && !on) im.setTint(0xb8bcc8);
      } else { // 还没有图：程式画的圆形徽章
        const g = this.add.graphics().setScrollFactor(0).setDepth(50);
        const col = Phaser.Display.Color.HexStringToColor(DIFFS[d].color).color;
        g.fillStyle(0x000000, 0.45).fillCircle(x + 3, y + 5, R);
        g.fillStyle(open ? 0x141c2e : 0x1a1d26, 0.95).fillCircle(x, y, R);
        g.lineStyle(on ? 5 : 3, open ? (on ? 0xffd36b : col) : 0x4a5060, 1).strokeCircle(x, y, R);
        g.lineStyle(1.5, open ? 0xd9b45a : 0x3a404c, 0.8).strokeCircle(x, y, R - 7);
        txt(this, x, y - 2, open ? CH[d] : '？', on ? 34 : 28, open ? DIFFS[d].color : '#5a6276').setScrollFactor(0).setDepth(51);
      }
      txt(this, x, y + R + 11, open ? DIFFS[d].name : '未解锁', 15, on ? '#ffe7a3' : open ? '#cfd8e8' : '#6a7286').setScrollFactor(0).setDepth(51);
      this.add.zone(x, y, R * 2.2, R * 2.2).setScrollFactor(0).setDepth(52).setInteractive({ useHandCursor: true }).on('pointerup', () => {
        if (!open) { toast(this, `通关${DIFFS[d - 1].name}第 ${STAGE_MAX} 关解锁`); return; }
        if (d !== D) { sfx(this, 'click', 0.35); store.set('diff', d); this.scene.restart(); }
      });
    }
    imgButton(this, 60, 60, 'ui_back', 86, () => this.go('home')).setScrollFactor(0).setDepth(50);
    txt(this, 120, 60, '关卡挑战', 40, '#ffe7a3', 0).setScrollFactor(0).setDepth(50);
    resourceBar(this, 136);
    const tabOn = this.add.image(195, 220, 'tab_on').setScrollFactor(0).setDepth(50);
    tabOn.setScale(300 / tabOn.width);
    txt(this, 195, 218, '主线关卡', 30, '#5a2a08').setStroke('#ffe9b0', 3).setScrollFactor(0).setDepth(51);
    const tabOff = imgButton(this, 525, 220, 'tab_off', 300, () => this.go('events')).setScrollFactor(0).setDepth(50);
    txt(this, 525, 218, '活动关卡', 30, '#cfd8e8').setScrollFactor(0).setDepth(51);
    redDot(this, 662, 196).setScrollFactor(0).setDepth(52);
    void tabOff;

    // 面板不用 container：Phaser 判断 container 里物件的点击时不看 scrollFactor，地图一卷动按钮就点不到
    this.panelObjs = [];
    this.panel = { add: o => { [].concat(o).forEach(x => { x.setScrollFactor(0).setDepth(60 + this.panelObjs.length * 0.001); this.panelObjs.push(x); }); } };
    this.select(Math.min(unlocked, STAGE_MAX));
  }
  select(n) {
    this.sel = n;
    const c = this.panel;
    this.panelObjs.forEach(o => o.destroy());
    this.panelObjs = [];
    const px = 500, py = 1015;
    const bg = this.add.image(px, py, 'ui_info_panel');
    bg.setScale(420 / bg.width);
    const top = py - bg.displayHeight / 2;
    const D = this.diff, G = n + STAGE_MAX * D, st = store.get(starKey(D), {})[n] || 0;
    const rounds = Math.min(5, bossRoundsOf(n) + (D >= 3 ? 1 : 0));
    c.add([bg, txt(this, px, top + 55, `第 ${n} 关`, 38, '#ffe7a3'), txt(this, px, top + 100, '推荐战力：' + fmtNum(recommendPower(G)), 22, player.power() >= recommendPower(G) ? '#7fe08a' : '#ff8a7a')]);
    if (D) c.add(txt(this, px + 150, top + 55, DIFFS[D].name, 22, DIFFS[D].color));
    c.add(txt(this, px - 165, top + 140, '◈ 通关条件', 21, '#cfe2ff', 0));
    [rounds > 1 ? `击败妖王（共 ${rounds} 轮）` : '击败妖王', '气血高于 50%', bossParText(n)].forEach((s, k) => {
      const y = top + 176 + k * 34;
      const star = this.add.image(px - 155, y, 'node_star');
      star.setScale(26 / star.height).setAlpha(k < st ? 1 : 0.35);
      c.add([star, txt(this, px - 132, y, s, 21, '#ffffff', 0), txt(this, px + 160, y, k < st ? '✔' : '', 24, '#7fe08a')]);
    });
    c.add(txt(this, px - 165, top + 288, '◈ 首次通关奖励', 21, '#cfe2ff', 0));
    [['res_crystal', 20 * DIFFS[D].reward], ['res_coin', 3000 * DIFFS[D].reward], ['res_scroll', 1]].forEach(([k, v], i) => {
      const x = px - 110 + i * 110, y = top + 342;
      const fr = this.add.graphics();
      fr.fillStyle(0x0d1220, 0.9).fillRoundedRect(x - 36, y - 36, 72, 72, 10).lineStyle(2, 0x3f8cff).strokeRoundedRect(x - 36, y - 36, 72, 72, 10);
      const ic = this.add.image(x, y - 4, k);
      ic.setScale(54 / ic.height);
      c.add([fr, ic, txt(this, x + 30, y + 26, fmtNum(v), 16, '#ffffff', 1)]);
    });
    const btnY = top + bg.displayHeight - 66;
    c.add(imgButton(this, px, btnY, 'btn_challenge', 270, () => this.start(n)));
    c.add(btnText(this, px, btnY - 10, 'txt_begin', '开始挑战', 46, 34));
    c.add(txt(this, px, btnY + 22, '消耗 6 体力', 16, '#5a2a08'));
    this.nodes.forEach(o => o.img.setAlpha(o.n === n || o.n > unlockedOf(D) ? 1 : 0.85));
  }
  start(n) {
    const p = player.get();
    if (p.stamina < 6) { toast(this, '体力不足（点体力旁的 + 补满）'); return; }
    p.stamina -= 6; player.save(p);
    store.set('lastStage', n);
    this.go('battle', { stage: n, diff: this.diff });
  }
  go(key, data) {
    this.cameras.main.fadeOut(250, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key, data));
  }
}

// ───── 战斗 ─────
class BattleScene extends Phaser.Scene {
  constructor() { super('battle'); }
  init(data) {
    const G = (data.stage || 1) + 100 * (data.diff || 0); // 无尽直接传总关数
    this.G = G; this.diff = Math.floor((G - 1) / STAGE_MAX); this.stage = (G - 1) % STAGE_MAX + 1;
    this.mode = data.mode || 'story';
    this.endless = this.mode === 'endless'; this.trial = this.mode === 'trial'; this.secret = this.mode === 'secret';
    this.event = this.endless || this.trial || this.secret; // 不是主线
  }

  create() {
    const S = this.stage, G = this.G;
    if (this.textures.exists('icon_skill_heal')) SKILLS.heal.icon = 'icon_skill_heal'; // 有专属图示就换（docs/20）
    this.hpMul = stageMul(G);
    this.chapter = chapterOf(S);
    const pd = player.get(), stats = calcStats(pd);
    this.baseDmg = stats.atk; // 不再随关卡白送成长：打得动打不动看真实战力
    this.def = stats.def;
    this.enemyDmgMul = stageDmgMul(G); // 跟推荐战力（≈主角血量）一起长，漏几只会死不会随关卡暴增
    this.skillMul = {};
    for (const k in pd.sk) this.skillMul[k] = 1 + 0.12 * pd.sk[k];
    this.t = 0; this.paused = false; this.over = false; this.overlay = null; this.choiceCbs = null;
    this.st = { hp: Math.round(stats.hp), maxHp: Math.round(stats.hp), multi: 1, rateMul: 1, dmgMul: 1, clones: 0, crit: stats.crit, shield: 0, shieldMax: 0, moveMul: 1 };
    this.skills = { water: 0, thunder: 0, fire: 0, shield: 0, sword: 0, heal: 0 }; this.shieldAwFx = false; this.awSeen = {}; // 每场重新算「第一次觉醒」
    this.skillT = { water: 2, thunder: 1, fire: 1, shield: 0, sword: 2, heal: 5 };
    this.kills = 0; this.combo = 0; this.maxCombo = 0; this.comboT = 0; this.energy = 0;
    this.fireT = 0; this.spawnAcc = 0; this.nextGate = 1; this.gateCount = 0; this.chestAt = [];
    this.enemies = []; this.bullets = []; this.gates = []; this.waves = []; this.orbs = [];
    this.boss = null; this.bossSpawned = false; this.scrollTotal = 0;
    this.stat = { supers: 0, chests: 0, bosses: 0 }; // 成就用的本局统计
    this.loot = { coin: 0, crystal: 0 };             // 灵石雨捡到的
    this.rain = []; this.fogT = 0; this.allyT = 0;
    this.newDiff = 0; // 只有这一场打完第 100 关才会设，场景重开要清掉（不然每关都跳「解锁新难度」）
    this.fog = this.fogEdge = this.ally = this.allyHalo = null; // 场景重开时旧的已经被销毁，不清掉会拿到坏掉的物件（妖雾第二场就当掉）
    this.eventAt = this.event ? (this.endless ? 35 : 1e9) : (this.G >= 4 ? rand(22, 42) : 1e9);
    this.trait = this.event ? -1 : this.chapter;     // 章节特性（第 2 章起）
    this.bestKills = player.get().bestEndless;

    // 场景：远景 → 雾 → 透视桥面（各章一套，docs/14；妖兽来袭会随时间换章）
    this.side = this.add.tileSprite(W / 2, H / 2, W, H, 'bg_side').setDepth(-3);
    this.sceneFog = this.add.graphics().setDepth(-2);
    this.road = this.add.shader('road', W / 2, H / 2, W, H, ['bg_bridge', 'rail']).setDepth(-1);
    this.sceneCh = -1;
    this.applyScene(chapterOf(this.stage));
    this.bossRounds = this.event ? 1 : Math.min(5, bossRoundsOf(S) + (this.diff >= 3 ? 1 : 0)); this.bossRound = 1; this.reviveAt = 0; this.bossTime = 0;
    this.masterOn = !this.trial && (this.event || this.G >= MASTER.from) && this.textures.exists('ally_master');
    this.mGauge = 0; this.masterUp = false; this.mTier = 1;
    if (this.masterOn) this.initMaster();
    if (!store.get('opt_shake', true)) this.cameras.main.shake = function () { return this; }; // 设置：关掉画面震动
    playBgm(this, this.endless ? 'endless' : this.trial ? 'trial' : this.secret ? 'secret' : 'battle' + (chapterOf(this.stage) + 1));

    // 主角
    const flyAnim = this.anims.exists('anim_hero_fly');
    this.heroAnim = flyAnim || this.anims.exists('anim_hero_attack');
    const heroKey = flyAnim ? 'anim_hero_fly' : this.heroAnim ? 'anim_hero_attack' : 'hero_sword';
    // 御剑：脚下一把发光飞剑＋往后拖的光、两侧风线（有御剑影片就不用画剑）
    this.flyFx = [];
    if (!flyAnim) {
      const trail = this.add.image(ROAD_MID, PLAYER_Y + 40, 'beam').setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fd8ff).setDepth(28).setScale(1.2, 0.5).setAlpha(0.7);
      const sword = this.add.image(ROAD_MID, PLAYER_Y + 22, 'fx_flying_sword').setBlendMode(Phaser.BlendModes.ADD).setDepth(29).setAngle(180);
      sword.setScale(0.62, 0.36);
      const halo = this.add.image(ROAD_MID, PLAYER_Y + 26, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x7fc8ff).setDepth(28).setScale(3.2, 1.1).setAlpha(0.7);
      this.flyFx = [trail, sword, halo];
    }
    this.windFx = this.add.particles(0, 0, 'glow', {
      x: { min: ROAD_L, max: ROAD_R }, y: { min: PLAYER_Y - 260, max: PLAYER_Y - 60 }, speedY: { min: 900, max: 1300 },
      lifespan: 260, scaleX: 0.06, scaleY: { start: 1.6, end: 0.4 }, alpha: { start: 0.55, end: 0 }, tint: 0xdff2ff, frequency: 45, blendMode: 'ADD',
    }).setDepth(27);
    this.player = fitH(this.add.sprite(ROAD_MID, PLAYER_Y + 20, heroKey).setOrigin(0.5, 0.95), flyAnim ? 250 : this.heroAnim ? 210 : 170).setDepth(30);
    if (this.heroAnim) this.player.play(heroKey);
    this.heroBase = this.player.scaleX;
    if (this.player.preFX) this.player.preFX.addGlow(0xcfe8ff, 1.2, 0, false, 0.1, 6); // 轮廓光，跟背景分开
    this.targetX = ROAD_MID;
    // 影子：人在桥面上方飞，影子在桥面上（飞高时变小变淡）
    this.shadow = this.add.image(ROAD_MID, PLAYER_Y + 48, 'glow').setTint(0x000000).setDepth(26).setAlpha(0.7).setScale(2.4, 0.7);
    this.clones = [];
    this.trail = []; // 主角走过的位置，分身照这个延迟跟随
    for (let i = 0; i < 4; i++) {
      const c = fitH(this.add.sprite(ROAD_MID, PLAYER_Y, heroKey).setOrigin(0.5, 0.95), flyAnim ? 205 : this.heroAnim ? 175 : 140).setDepth(29).setTint(0xdcecff).setAlpha(0.92).setVisible(false);
      if (this.heroAnim) c.play({ key: heroKey, startFrame: (i * 7) % 20 });
      if (c.preFX) c.preFX.addGlow(0x8fd0ff, 1, 0, false, 0.1, 4);
      c.shadow = this.add.image(0, 0, 'glow').setTint(0x000000).setDepth(26).setAlpha(0.5).setScale(1.9, 0.55).setVisible(false);
      c.ghostT = rand(0, 0.12);
      this.clones.push(c);
    }
    this.clonesShown = 0;
    this.ring = this.add.image(ROAD_MID, PLAYER_Y, 'fx_xuanwu').setDepth(31).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDisplaySize(230, 150);

    const burst = (tint, speed, life, scale) => this.add.particles(0, 0, 'glow', {
      speed, lifespan: life, scale: { start: scale, end: 0 }, alpha: { start: 1, end: 0 },
      blendMode: 'ADD', tint, emitting: false,
    }).setDepth(40);
    this.fxHit = burst(0xffd36b, { min: 60, max: 200 }, 260, 0.3);
    this.fxDeath = burst(0xff5a3a, { min: 80, max: 260 }, 420, 0.45);
    this.fxWater = burst(0x58b8ff, { min: 40, max: 180 }, 500, 0.6);
    this.fxGold = burst(0xffe08a, { min: 100, max: 360 }, 600, 0.7);

    // 序列帧特效池
    this.animPool = {};
    this.fxG = this.add.graphics().setDepth(41);
    this.hudG = this.add.graphics().setDepth(100);
    this.nums = [];
    this.bmpNum = this.cache.bitmapFont.exists('font_gold');
    for (let i = 0; i < 40; i++) {
      this.nums.push(this.bmpNum
        ? this.add.bitmapText(0, 0, 'font_gold', '', 96).setOrigin(0.5).setLetterSpacing(-26).setDepth(45).setVisible(false)
        : txt(this, 0, 0, '', 26, '#ffffff').setDepth(45).setVisible(false));
    }
    this.numIdx = 0;

    this.buildHud();
    this.bindInput();
    const TRAITS = [null, '本章特性：妖兽死后可能分裂', '本章特性：妖兽可能死而复生', '本章特性：妖兽半血会狂暴加速'];
    if (this.trait > 0) this.time.delayedCall(600, () => this.eventBanner(CHAPTERS[this.trait].name, TRAITS[this.trait], 0x1a2a40));
    this.events.once('shutdown', () => this.tweens.killAll());
  }

  playFx(key, x, y, scale, depth = 42, blend = true) {
    const pool = this.animPool[key] || (this.animPool[key] = []);
    let s = pool.find(o => !o.visible);
    if (!s) {
      if (pool.length > 40) return null;
      s = this.add.sprite(0, 0, key).setVisible(false);
      if (blend) s.setBlendMode(Phaser.BlendModes.ADD);
      pool.push(s);
    }
    s.setOrigin(0.5).setPosition(x, y).setScale(scale).setDepth(depth).setVisible(true).setAlpha(1).setRotation(rand(0, 6.28));
    s.play(key);
    return s;
  }

  applyScene(ch) {
    if (ch === this.sceneCh) return;
    this.sceneCh = ch;
    const cn = ch + 1, pickTex = k => (cn > 1 && this.textures.exists(k + cn) ? k + cn : k);
    const sideKey = pickTex('bg_side');
    this.side.setTexture(sideKey).setTileScale(W / this.textures.get(sideKey).getSourceImage().width);
    this.road.setSampler2D('iChannel0', pickTex('bg_bridge'), 0);
    this.road.setSampler2D('iChannel1', pickTex('rail'), 1);
    const FOG = [0xdbe5f5, 0x2c4a30, 0x3a3a6a, 0x4a1410][ch]; // 云海白、林雾绿、冥雾紫、魔渊红
    this.sceneFog.clear().fillGradientStyle(FOG, FOG, FOG, FOG, 1, 1, 0, 0).fillRect(0, 0, W, 520);
    this.road.setUniform('uFog.value.x', ((FOG >> 16) & 255) / 255);
    this.road.setUniform('uFog.value.y', ((FOG >> 8) & 255) / 255);
    this.road.setUniform('uFog.value.z', (FOG & 255) / 255);
  }
  // 妖兽来袭：目前难度相当于第几关（起跳关卡的血量 × 时间倍率，换算回关卡）
  eqStage() {
    const target = stageMul(this.G) * this.endlessMul();
    let n = this.G;
    while (n < STAGE_TOTAL && stageMul(n + 1) <= target) n++;
    return n;
  }

  // 打完第 100 关：开放下一个难度的庆祝画面
  showNewDiff(d) {
    const box = this.add.container(0, 0).setDepth(400);
    box.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.8).setInteractive());
    const g = this.add.graphics();
    g.fillStyle(0x121a2c, 0.97).fillRoundedRect(60, H / 2 - 260, W - 120, 520, 24).lineStyle(4, 0xd9b45a).strokeRoundedRect(60, H / 2 - 260, W - 120, 520, 24);
    box.add([g, txt(this, W / 2, H / 2 - 190, '解锁新难度', 34, '#ffe7a3'),
      txt(this, W / 2, H / 2 - 90, DIFFS[d].name, 110, DIFFS[d].color),
      txt(this, W / 2, H / 2 + 20, `妖兽更强，首通奖励 ×${DIFFS[d].reward}`, 24, '#ffffff'),
      txt(this, W / 2, H / 2 + 60, '已通关的难度可以随时在关卡地图切换', 18, '#aab4c8')]);
    box.add(button(this, W / 2 - 140, H / 2 + 170, 240, 84, '稍后再说', 0x2a5bb8, () => box.destroy(), 30));
    box.add(button(this, W / 2 + 140, H / 2 + 170, 240, 84, `前往${DIFFS[d].name}`, 0xc98a1a, () => { store.set('diff', d); this.scene.start('stagemap'); }, 30));
    box.setAlpha(0); this.tweens.add({ targets: box, alpha: 1, duration: 300 });
    this.cameras.main.flash(500, 255, 230, 160);
    sfx(this, 'breakthrough', 0.7, 0);
  }

  // ───── 师尊法相 ─────
  // 脸摆在左上「桥斜边外的三角空地」：鼻尖约 (250, 380)；画在桥面之上、妖兽和框之下，胡子才不会被桥盖掉（docs/15）
  initMaster() {
    const sc = 620 / this.textures.get('ally_master').getSourceImage().height;
    this.mFace = this.add.image(-500, 182, 'ally_master').setOrigin(0, 0).setScale(sc).setDepth(5).setVisible(false);
    const castKey = this.textures.exists('ally_master_cast') ? 'ally_master_cast' : 'ally_master';
    this.mCast = this.add.image(-500, 182, castKey).setOrigin(0, 0).setScale(sc).setDepth(5.1).setAlpha(0).setVisible(false);
    this.mBar = this.add.graphics().setDepth(60);
    this.mIcon = this.add.image(23, 268, 'fx_master_seal').setBlendMode(Phaser.BlendModes.ADD).setDepth(61);
    this.mIcon.setScale(46 / this.mIcon.height);
    this.mLv = txt(this, 6, 234, '', 20, '#ffe7a3', 0).setDepth(61); // 量表上方：师尊目前几阶
  }
  drawMasterGauge() {
    const g = this.mBar, x = 16, y0 = 296, h = 330, v = this.mGauge / 100;
    g.clear();
    if (this.masterUp || this.mFace.visible) { this.mIcon.setVisible(false); this.mLv.setVisible(false); return; } // 法相还在画面上就不画，免得压在脸上
    this.mLv.setText(`师尊 ${this.mTier}阶`).setVisible(true);
    g.fillStyle(0x0a0f18, 0.75).fillRoundedRect(x, y0, 14, h, 7);
    g.fillStyle(v >= 1 ? 0xfff0b0 : 0xffc84a, 0.95).fillRoundedRect(x, y0 + h * (1 - v), 14, Math.max(14, h * v), 7);
    g.lineStyle(2, 0xd9b45a, 0.9).strokeRoundedRect(x, y0, 14, h, 7);
    this.mIcon.setVisible(true).setRotation(this.t * 0.8).setAlpha(0.6 + 0.4 * v);
  }
  updateMaster(dt) {
    if (!this.masterOn) return;
    if (!this.masterUp) {
      this.mGauge = Math.min(100, this.mGauge + MASTER.perSec * dt);
      this.drawMasterGauge();
      if (this.mGauge >= 100) this.summonMaster();
      return;
    }
    const y = 182 + Math.sin(this.t * 1.1) * 8; // 法相轻轻浮动
    this.mFace.y = y; this.mCast.y = y;
    this.mT -= dt; this.mCastT -= dt;
    if (this.mCastT <= 0 && this.mT > 0.8) { this.mCastT = MASTER.every; this.masterCast(); }
    if (this.mT <= 0) this.dismissMaster();
  }
  summonMaster() {
    this.masterUp = true; this.mGauge = 0; this.mT = MASTER.dur; this.mCastT = 1.2;
    if (this.mTier >= 5) this.time.delayedCall((MASTER.dur - 1.6) * 1000, () => { if (this.masterUp) { this.mCastT = 99; this.masterPalm(); } }); // 五阶：最后一招法相天地（场上没怪也照样压）
    this.drawMasterGauge();
    this.eventBanner('师尊显圣', `玄清真人法相助阵 ${MASTER.dur} 秒`, 0x6a4a10);
    this.cameras.main.flash(400, 255, 240, 200);
    sfx(this, 'breakthrough', 0.5, 0);
    [this.mFace, this.mCast].forEach(im => { this.tweens.killTweensOf(im); im.setVisible(true).x = -500; });
    this.mFace.setAlpha(0); this.mCast.setAlpha(0);
    this.tweens.add({ targets: [this.mFace, this.mCast], x: -93, duration: 800, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: this.mFace, alpha: 0.95, duration: 800 });
  }
  dismissMaster() {
    this.masterUp = false;
    this.tweens.add({ targets: [this.mFace, this.mCast], x: -500, alpha: 0, duration: 800, ease: 'Cubic.easeIn', onComplete: () => { this.mFace.setVisible(false); this.mCast.setVisible(false); } });
  }
  // 找妖兽最密的地方（精英多算一点）
  masterTarget(n = 1) {
    const list = this.targets();
    if (!list.length) return [];
    const scored = list.map(a => {
      let k = a === this.boss ? 1 : a.elite ? 2 : 0;
      for (const b of list) if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < MASTER.radius ** 2) k++;
      return { x: a.x, y: a.y, k };
    }).sort((a, b) => b.k - a.k);
    const out = []; // 挑 n 个互相离远一点的怪群
    for (const c of scored) { if (out.every(o => (o.x - c.x) ** 2 + (o.y - c.y) ** 2 > (MASTER.radius * 1.2) ** 2)) out.push(c); if (out.length >= n) break; }
    while (out.length < n) out.push(scored[out.length % scored.length]);
    return out;
  }
  masterCast() {
    const tgs = this.masterTarget([1, 3, 5, 5, 5][this.mTier - 1]);
    if (!tgs.length) return;
    // 睁眼念咒（跟闭眼那张交叉淡入淡出）
    this.tweens.killTweensOf(this.mCast);
    this.tweens.add({ targets: this.mCast, alpha: 0.95, duration: 120, hold: 650, yoyo: true });
    // 嘴前亮起法阵
    const seal = this.add.image(300, this.mFace.y + 235, 'fx_master_seal').setBlendMode(Phaser.BlendModes.ADD).setDepth(36).setScale(0.05);
    this.tweens.add({ targets: seal, scale: 170 / seal.height, rotation: 1.2, duration: 380, ease: 'Back.easeOut' });
    this.tweens.add({ targets: seal, alpha: 0, delay: 450, duration: 400, onComplete: () => seal.destroy() });
    sfx(this, 'skill_sword', 0.45, 0.3);
    tgs.forEach((tg, i) => this.time.delayedCall(300 + i * 90, () => this.masterStrike(tg.x, tg.y)));
    if (this.mTier >= 4) this.time.delayedCall(800, () => this.masterRain()); // 四阶：再灑一阵万剑雨
  }
  // 万剑雨：十几把小金剑随机落在场上
  masterRain() {
    if (this.over) return;
    const key = this.textures.exists('fx_master_sword_s') ? 'fx_master_sword_s' : 'fx_master_sword';
    const list = shuffle(this.targets()).slice(0, 14), v = this.baseDmg * MASTER.mul * 0.35;
    list.forEach((o, i) => {
      const x = o.x, y = o.y, [sx, sy, s] = proj(x, y);
      const sw = this.add.image(sx, sy - 500, key).setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(37).setAlpha(0.9);
      sw.setScale((90 + 90 * s) / sw.height);
      this.tweens.add({
        targets: sw, y: sy, duration: 180, delay: i * 45, ease: 'Quad.easeIn', onComplete: () => {
          if (!this.over) {
            if (o === this.boss) { if (o.alive) this.hurtBoss(this.rollCrit(v * MASTER.bossMul), x, y); }
            else if (o.alive) this.hurtEnemy(o, this.rollCrit(v), 0.3);
            this.playFx('fx_hit', sx, sy - 10, 0.8 * s + 0.2);
          }
          this.tweens.add({ targets: sw, alpha: 0, duration: 200, onComplete: () => sw.destroy() });
        },
      });
    });
  }
  // 五阶：法相天地 —— 巨掌从左上压下来，全场重击（有 fx_master_palm 图就用，没有就用大法阵代替）
  masterPalm() {
    if (this.over) return;
    const v = this.baseDmg * MASTER.mul * 2.5;
    const hit = () => {
      if (this.over) return;
      for (const e of this.enemies) if (e.alive && e.y > 0) { this.hurtEnemy(e, this.rollCrit(v), 0.5); if (e.alive) e.stunT = 1.5; }
      const b = this.boss;
      if (b && b.alive) this.hurtBoss(this.rollCrit(v * MASTER.bossMul), b.x, b.y);
      this.cameras.main.shake(500, 0.016); this.cameras.main.flash(250, 255, 230, 160);
      this.fxGold.explode(80, W / 2, 640);
      sfx(this, 'ult', 0.7, 0);
    };
    if (this.anims.exists('fx_master_palm_anim')) { // 巨掌影片（docs/17）：满版播，最亮那一刻全场重击
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(37.5).setAlpha(0);
      this.tweens.add({ targets: dim, alpha: 0.5, duration: 250, hold: 1600, yoyo: true, onComplete: () => dim.destroy() });
      this.eventBanner('法相天地', '师尊一掌镇压全场', 0x6a4a10);
      const f = this.playFx('fx_master_palm_anim', W / 2, 600, 2.0, 38); if (f) f.setRotation(0);
      this.time.delayedCall(1000, hit);
    } else if (this.textures.exists('fx_master_palm')) {
      const pm = this.add.image(W / 2 + 40, -300, 'fx_master_palm').setDepth(38).setBlendMode(Phaser.BlendModes.ADD); // 黑底图，用发光叠加
      pm.setScale(820 / pm.width);
      this.tweens.add({ targets: pm, y: 560, duration: 420, ease: 'Quad.easeIn', onComplete: () => { hit(); this.tweens.add({ targets: pm, alpha: 0, scale: pm.scale * 1.08, duration: 600, onComplete: () => pm.destroy() }); } });
    } else {
      // 还没有巨掌图：画面暗下＋巨大金色法印从天压下
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(37.5).setAlpha(0);
      this.tweens.add({ targets: dim, alpha: 0.5, duration: 250, hold: 700, yoyo: true, onComplete: () => dim.destroy() });
      this.eventBanner('法相天地', '师尊一掌镇压全场', 0x6a4a10);
      const seal = this.add.image(W / 2, 200, 'fx_master_seal').setBlendMode(Phaser.BlendModes.ADD).setDepth(38).setScale(2.4).setAlpha(0);
      this.tweens.add({ targets: seal, alpha: 1, duration: 200 });
      this.tweens.add({ targets: seal, y: 620, scale: 1.3, rotation: 1.5, duration: 600, ease: 'Quad.easeIn', onComplete: () => { hit(); this.tweens.add({ targets: seal, alpha: 0, scale: 1.8, duration: 600, onComplete: () => seal.destroy() }); } });
    }
  }
  masterStrike(x, y) {
    if (this.over) return;
    const [sx, sy, s] = proj(x, y);
    const sw = this.add.image(sx, sy - 900, 'fx_master_sword').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(37);
    sw.setScale((300 + 300 * s) / sw.height);
    this.tweens.add({
      targets: sw, y: sy, duration: 200, ease: 'Quad.easeIn', onComplete: () => {
        const v = this.baseDmg * MASTER.mul;
        for (const e of this.enemies) if (e.alive && (e.x - x) ** 2 + (e.y - y) ** 2 < (MASTER.radius + e.r) ** 2) { this.hurtEnemy(e, this.rollCrit(v), 0.6); if (e.alive && this.mTier >= 3) e.stunT = 1; }
        const b = this.boss;
        if (b && b.alive && Math.abs(b.x - x) < MASTER.radius + 110 && Math.abs(b.y - y) < MASTER.radius + 70) this.hurtBoss(this.rollCrit(v * MASTER.bossMul), b.x, b.y);
        this.playFx('fx_explosion', sx, sy - 30 * s, 2 * s + 0.6, 43);
        this.fxGold.explode(30, sx, sy - 20 * s);
        this.cameras.main.shake(160, 0.008);
        sfx(this, 'explode', 0.5, 0);
        this.tweens.add({ targets: sw, alpha: 0, duration: 400, onComplete: () => sw.destroy() });
      },
    });
  }

  // ───── 输入 ─────
  bindInput() {
    this.drag = null;
    this.input.on('pointerdown', p => {
      if (this.paused || this.over) return;
      if (Phaser.Math.Distance.Between(p.x, p.y, 50, 50) < 46) { this.showPause(); return; }
      if (Phaser.Math.Distance.Between(p.x, p.y, 640, 1190) < 70) { this.castUlt(); return; }
      this.drag = { px: p.x, startX: this.targetX };
    });
    this.input.on('pointermove', p => {
      if (!this.drag || !p.isDown) return;
      this.targetX = clamp(this.drag.startX + (p.x - this.drag.px) * CFG.dragGain * this.st.moveMul, ROAD_L + 24, ROAD_R - 24);
    });
    this.input.on('pointerup', () => { this.drag = null; });
    this.keys = this.input.keyboard.addKeys('A,D,LEFT,RIGHT');
    const kb = this.input.keyboard;
    kb.on('keydown-SPACE', () => this.castUlt());
    kb.on('keydown-P', () => this.togglePause());
    kb.on('keydown-ESC', () => this.togglePause());
    if (!RELEASE) { // 测试用快捷键
      kb.on('keydown-G', () => { if (!this.paused && !this.over) this.spawnGatePair(); });
      kb.on('keydown-B', () => { if (!this.bossSpawned) this.t = CFG.stageLen; });
      kb.on('keydown-U', () => { this.energy = CFG.energyMax; });
      kb.on('keydown-K', () => { if (!this.over) this.addSkill(pick(Object.keys(SKILLS))); });
    }
    ['ONE', 'TWO', 'THREE'].forEach((k, i) => kb.on('keydown-' + k, () => { if (this.choiceCbs && this.choiceCbs[i]) this.choiceCbs[i](); }));
  }
  togglePause() {
    if (this.over || this.choiceCbs) return;
    if (this.paused) this.closeOverlay(); else this.showPause();
  }

  // ───── 主循环 ─────
  update(time, delta) {
    const dt = Math.min(delta / 1000, 0.05);
    this.frameDt = dt;
    if (this.paused || this.over) { this.drawHud(); return; }
    this.t += dt;
    this.scrollTotal += CFG.scroll * dt;
    this.road.setUniform('uScroll.value', this.scrollTotal);
    this.side.tilePositionY -= CFG.scroll * 0.18 * dt;

    this.updatePlayer(dt);
    this.updateSpawns(dt);
    this.updateFire(dt);
    this.updateBullets(dt);
    this.updateSkills(dt);
    this.updateEnemies(dt);
    this.updateGates(dt);
    this.updateBoss(dt);
    if (this.boss && this.boss.alive && this.boss.y >= 680) this.bossTime += dt; // 妖王站定后才开始算
    this.updateStageEvents(dt);
    this.updateMaster(dt);
    if (this.endless && (this.eqT = (this.eqT || 0) - dt) <= 0) { // 每秒检查：难度到了下一章就换地图
      this.eqT = 1;
      this.eq = this.eqStage();
      const ch = chapterOf((this.eq - 1) % STAGE_MAX + 1);
      if (ch !== this.sceneCh) {
        this.cameras.main.flash(500, 255, 255, 255);
        this.applyScene(ch);
        this.trait = ch; // 也套用那一章的妖兽特性
        const TR = ['', '妖兽死后可能分裂', '妖兽可能死而复生', '妖兽半血会狂暴'];
        this.eventBanner(`妖潮蔓延 · ${CHAPTERS[ch].name}`, `难度相当于${DIFFS[Math.floor((this.eq - 1) / STAGE_MAX)].name}第 ${(this.eq - 1) % STAGE_MAX + 1} 关${TR[ch] ? '　' + TR[ch] : ''}`, 0x1a2a40);
      }
    }

    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    this.drawFx();
    this.drawHud();
  }

  updatePlayer(dt) {
    const k = this.keys;
    const mv = this.st.moveMul;
    if (k.A.isDown || k.LEFT.isDown) this.targetX -= CFG.keySpeed * mv * dt;
    if (k.D.isDown || k.RIGHT.isDown) this.targetX += CFG.keySpeed * mv * dt;
    this.targetX = clamp(this.targetX, ROAD_L + 24, ROAD_R - 24);
    const p = this.player;
    p.x += (this.targetX - p.x) * Math.min(1, dt * 18 * mv); // 中了「移速」心魔会变迟钝
    this.kick = Math.max(0, (this.kick || 0) - dt * 8) * (this.heroAnim ? 0.9 : 1);
    if (this.heroAnim) { p.anims.timeScale = Math.min(2.5, this.st.rateMul); this.clones.forEach(c => { c.anims.timeScale = p.anims.timeScale; }); }
    p.y = PLAYER_Y + 14 + Math.sin(this.t * 2.6) * 7 + this.kick * 4; // 御剑上下浮动
    if (this.flyFx.length) {
      const [trail, sword, halo] = this.flyFx, bob = p.y - (PLAYER_Y + 14);
      sword.setPosition(p.x, PLAYER_Y + 24 + bob).setRotation(Math.PI + (this.targetX - p.x) * 0.002);
      halo.setPosition(p.x, PLAYER_Y + 28 + bob).setAlpha(0.55 + 0.2 * Math.sin(this.t * 9));
      trail.setPosition(p.x, PLAYER_Y + 34 + bob).setScale(1.1 + 0.15 * Math.sin(this.t * 13), 0.45);
    }
    p.setRotation(Math.sin(this.t * 2.2) * 0.02 - this.kick * 0.05 + (this.targetX - p.x) * 0.0015);
    p.setScale(this.heroBase * (1 + this.kick * 0.03), this.heroBase * (1 - this.kick * 0.04));
    const bob = p.y - (PLAYER_Y + 14);
    this.shadow.setPosition(p.x, PLAYER_Y + 50).setScale(2.4 - bob * 0.02, 0.7 - bob * 0.006).setAlpha(0.6 - bob * 0.015);
    // 分身：延迟跟随主角的轨迹，左右排开、稍微后面一点；会留残影
    this.trail.unshift(p.x); if (this.trail.length > 40) this.trail.pop();
    const offs = [-92, 92, -170, 170];
    if (this.st.clones > this.clonesShown) { // 新分身出现：一团光
      for (let i = this.clonesShown; i < this.st.clones; i++) {
        const c = this.clones[i];
        c.x = p.x; c.setAlpha(0);
        this.tweens.add({ targets: c, alpha: 0.88, duration: 300 });
        this.fxWater.explode(20, clamp(p.x + offs[i], ROAD_L + 20, ROAD_R - 20), PLAYER_Y - 40);
      }
    }
    this.clonesShown = this.st.clones;
    this.clones.forEach((c, i) => {
      const on = i < this.st.clones;
      c.setVisible(on); c.shadow.setVisible(on);
      if (!on) return;
      const lagX = this.trail[Math.min(this.trail.length - 1, 6 + i * 4)];
      const tx = clamp(lagX + offs[i], ROAD_L + 20, ROAD_R - 20);
      c.x += (tx - c.x) * Math.min(1, dt * 12);
      c.y = PLAYER_Y + 30 + Math.sin(this.t * 2.6 + 1.3 + i) * 7;
      c.setRotation((tx - c.x) * 0.002);
      c.shadow.setPosition(c.x, PLAYER_Y + 58);
      c.ghostT -= dt;
      if (c.ghostT <= 0) { // 残影
        c.ghostT = 0.16;
        const gh = this.add.image(c.x, c.y, c.texture.key, c.frame.name).setOrigin(0.5, 0.95).setScale(c.scaleX).setDepth(28).setTint(0x5fb0ff).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD);
        this.tweens.add({ targets: gh, alpha: 0, y: c.y + 30, duration: 260, onComplete: () => gh.destroy() });
      }
    });
    this.ring.setPosition(p.x, PLAYER_Y - 10);
    this.ring.setAlpha(this.st.shield > 0 ? (0.3 + 0.4 * this.st.shield / this.st.shieldMax) * (0.85 + 0.15 * Math.sin(this.t * 4)) : 0);
  }

  // ───── 生成 ─────
  updateSpawns(dt) {
    const bossOn = this.bossSpawned;
    let rate = this.secret ? 1.1 + this.t * 0.035 : this.endless ? Math.min(6, 0.8 + this.t * 0.045) : (0.35 + this.t * 0.025) * (1 + (this.stage - 1) * 0.02) * (1 + 0.1 * this.diff) * (this.diff >= 4 ? 1.15 : 1); // 开局只有一道剑气，刷怪要跟着局内成长慢慢加
    rate *= Math.min(1, 0.4 + this.t / 25); // 开场前 25 秒比较稀，让玩家先吃门
    if (bossOn) rate *= 0.4;
    if (this.reviveAt) rate *= 1 + 0.15 * (this.bossRound - 1); // 妖王重生之间的妖潮
    this.spawnAcc += rate * dt;
    while (this.spawnAcc >= 1) { this.spawnAcc -= 1; this.spawnEnemy(); }
    if (this.t >= this.eventAt && !this.bossSpawned) { // 关卡事件：主线每关一次、无尽每 75 秒
      this.eventAt = this.endless ? this.eventAt + 75 : 1e9;
      this.startStageEvent(pick(this.masterOn ? ['rain', 'fog', 'beasts'] : ['rain', 'fog', 'ally', 'beasts'])); // 有师尊就不派仙子
    }
    if (this.trial) { // 宗门试炼：长老傀儡打不死，60 秒内比伤害
      if (!this.bossSpawned) this.spawnBoss();
      if (this.t >= this.nextGate) { this.spawnGatePair(); this.nextGate += CFG.gateEvery; }
      if (this.t >= EVENT_TIME) this.finish(true);
      return;
    }
    if (this.secret) { // 秘境：宝箱很多，60 秒
      if (this.t >= this.nextGate) { this.spawnGatePair(); this.nextGate += 7; this.chestAt.push(this.t + 3.5); }
      if (this.chestAt.length && this.t >= this.chestAt[0]) { this.chestAt.shift(); this.spawnChest(); }
      if (this.t >= EVENT_TIME) this.finish(true);
      return;
    }
    if (!this.event && (this.stage >= 5 || this.diff) && !this.eliteDone && this.t >= 40 && !this.bossSpawned) { this.eliteDone = true; this.spawnStageElites(); }
    if (this.endless && this.t >= (this.nextWave || 60)) { // 每 50 秒一波精英（第一波 60 秒）
      this.nextWave = (this.nextWave || 60) + 50;
      this.wave = (this.wave || 0) + 1;
      this.spawnEliteWave(this.wave);
    }
    if (this.endless) { // 无尽：门一直来、没有妖王
      this.maybeRush(Math.max(8, this.G) + Math.floor(this.t / 30), true);
      if (this.t >= this.nextGate) { this.spawnGatePair(); this.nextGate += CFG.gateEvery; if (this.gateCount % 3 === 2) this.chestAt.push(this.t + 4.5); }
      if (this.chestAt.length && this.t >= this.chestAt[0]) { this.chestAt.shift(); this.spawnChest(); }
      return;
    }
    if (!bossOn && this.t >= this.nextGate && this.t < (this.reviveAt ? this.reviveAt - 8 : CFG.stageLen - 6)) {
      this.spawnGatePair();
      this.nextGate += CFG.gateEvery;
    }
    this.maybeRush(this.G, !bossOn && this.t < CFG.stageLen - 6);
    if (this.chestAt.length && this.t >= this.chestAt[0]) { this.chestAt.shift(); this.spawnChest(); }
    if (!bossOn && this.t >= (this.reviveAt || CFG.stageLen)) this.spawnBoss();
  }

  spawnEnemy() {
    const t = this.t;
    const wRunner = t > 10 ? 0.22 : 0, wBrute = t > 20 ? Math.min(0.13, 0.05 + t * 0.001) : 0, wRogue = t > 30 ? 0.1 : 0;
    const r = Math.random();
    let key = r < wBrute ? 'brute' : r < wBrute + wRogue ? 'rogue' : r < wBrute + wRogue + wRunner ? 'runner' : 'grunt';
    // 新怪物（有图才出现）：关卡到了就有 40% 机率换成其中一种，越强的越少
    const S = this.event ? Math.max(6, this.G) + Math.floor(t / 20) : this.G;
    const pool = NEW_ENEMIES.filter(k => ENEMY_TYPES[k].from <= S && this.textures.exists(ENEMY_TYPES[k].tex));
    if (pool.length && Math.random() < 0.4) {
      const k = pick(pool);
      if (ENEMY_TYPES[k].hp < 500 || Math.random() < 0.3) key = k;
    }
    const T = ENEMY_TYPES[key];
    let e = this.enemies.find(o => !o.alive);
    if (!e) { e = { sprite: this.add.sprite(0, 0, T.tex).setOrigin(0.5, 0.92) }; this.enemies.push(e); }
    e.alive = true; e.type = T; e.key = key;
    e.x = rand(ROAD_L + T.r + 6, ROAD_R - T.r - 6); e.y = -40 - rand(0, 60);
    e.hp = e.maxHp = T.hp * this.hpMul * (this.endless ? this.endlessMul() : this.event ? 1 : (1 + 0.6 * Math.min(1, t / CFG.stageLen)) * BOSS_ROUND.mob[this.bossRound - 1]); // 无尽：每分钟约 ×1.9；主线：关内慢慢变硬
    e.elite = false; e.child = false; e.revived = false; e.enraged = false;
    e.affix = null; e.armor = 0; e.shots = 0; e.stunT = 0; e.windup = false; if (e.tagT) e.tagT.setVisible(false);
    e.ranged = (key === 'foxmage' || (key === 'rogue' && S >= 6) || (this.diff >= 3 && (key === 'grunt' || key === 'skeleton') && Math.random() < 0.25)) && !this.trial;
    if (this.diff >= 4) e.speed *= 1.15;
    e.stopY = rand(380, 620); e.castT = rand(0.6, 1.2);
    e.speed = T.speed * rand(0.85, 1.15); e.r = T.r * Math.min(1.4, 1 + (CFG.enemyScale - 1) * 0.5); e.phase = rand(0, 6); e.flash = 0; e.spread = rand(-150, 150); // 各自瞄准主角身边不同位置，不会排成一直线
    const sheet = 'sheet_' + key; // 有动作图就优先用动作图
    const ak = this.anims.exists(sheet) ? sheet : ENEMY_ANIM[key];
    e.anim = this.anims.exists(ak);
    if (e.anim) e.sprite.play({ key: ak, startFrame: randi(0, this.anims.get(ak).frames.length - 1) });
    else e.sprite.stop().setTexture(T.tex);
    e.base = T.h * CFG.enemyScale / e.sprite.height;
    e.sprite.setVisible(true).clearTint().setFlipX(Math.random() < 0.5);
    this.placeEnemy(e);
    return e;
  }
  enemyTint(e) { return e.elite ? 0xff9a9a : e.revived ? 0x9fb8ff : e.enraged ? 0xff7a5a : null; }
  placeEnemy(e) {
    const [sx, sy, s] = proj(e.x, e.y);
    // 程式步伐：上下踏步、左右擺、落地微壓扁（之后换成序列帧动画）
    const ph = this.t * e.type.step + e.phase, b = Math.abs(Math.sin(ph)) * (e.anim ? 0.25 : 1);
    const zs = Math.pow(s, CFG.enemyPersp); // 远处不要缩那么小
    e.sprite.setPosition(sx, sy - b * e.type.h * 0.06 * zs).setDepth(10 + e.y / 2000).setAlpha(clamp((s - 0.22) / 0.07, 0, 1))
      .setScale(e.base * zs * (1 + 0.03 * b), e.base * zs * (1 - 0.04 * (1 - b) * (e.anim ? 0 : 1))).setRotation(Math.sin(ph) * (e.anim ? 0.015 : 0.07));
    if (e.tagT && e.tagT.visible) e.tagT.setPosition(sx, e.sprite.y - e.sprite.displayHeight - 6).setScale(0.6 + 0.4 * s).setAlpha(e.sprite.alpha);
  }

  // 横幅：同时有好几个就排队，一个播完才播下一个
  eventBanner(title, sub, color) {
    const now = this.time.now, delay = Math.max(0, (this.bannerBusy || 0) - now);
    this.bannerBusy = now + delay + 2000;
    if (delay > 0) { this.time.delayedCall(delay, () => { if (!this.over) this.showBanner(title, sub, color); }); return; }
    this.showBanner(title, sub, color);
  }
  showBanner(title, sub, color) {
    sfx(this, 'warn', 0.45, 0.5);
    const b = this.add.container(W / 2, 430).setDepth(150);
    b.add([this.add.rectangle(0, 0, W + 40, 120, color, 0.82).setAngle(-3), txt(this, 0, -12, title, 46, '#ffe7a3'), txt(this, 0, 34, sub, 18, '#ffffff')]);
    b.x = -W;
    this.tweens.add({ targets: b, x: W / 2, duration: 280, ease: 'Back.easeOut', hold: 1300, yoyo: true, onComplete: () => b.destroy() });
  }
  startStageEvent(kind) {
    if (kind === 'rain') {
      this.eventBanner('天降灵石雨', '移动去接住落下的灵石与金币！', 0x0a4a5a);
      for (let i = 0; i < 16; i++) this.time.delayedCall(i * 380, () => {
        if (this.over) return;
        const crystal = Math.random() < 0.3;
        const im = this.add.image(0, 0, crystal ? 'res_crystal' : 'res_coin').setDepth(34);
        const gl = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(crystal ? 0x7fc8ff : 0xffd36b).setDepth(33);
        this.rain.push({ im, gl, crystal, x: rand(ROAD_L + 40, ROAD_R - 40), y: -60 });
      });
    } else if (kind === 'fog') {
      this.eventBanner('妖雾弥漫', '视野变窄 12 秒，小心看不见的妖兽', 0x2a1a40);
      this.fogT = 12;
    } else if (kind === 'ally') {
      this.eventBanner('仙子援军', '云汐仙子前来助阵 12 秒', 0x2a3a7a);
      this.allyT = 12;
      if (!this.ally) {
        const key = this.textures.exists('hero_mage') ? 'hero_mage' : 'hero_sword';
        this.ally = fitH(this.add.image(this.player.x + 110, PLAYER_Y + 20, key).setOrigin(0.5, 0.95), 190).setDepth(29);
        this.allyHalo = this.add.image(0, 0, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xc8a0ff).setDepth(28).setScale(2.6, 1).setAlpha(0.6); // 脚下紫光（不用 preFX，会糊）
      }
      this.ally.setVisible(true).setAlpha(0);
      this.tweens.add({ targets: this.ally, alpha: 1, duration: 300 });
    } else {
      this.eventBanner('妖兽援军', '一大群妖兽杀过来了！', 0x5a0010);
      this.cameras.main.flash(200, 140, 0, 0);
      for (let i = 0; i < 14; i++) this.time.delayedCall(i * 160, () => { if (!this.over) this.spawnEnemy(); });
      this.time.delayedCall(900, () => { if (!this.over && this.spawnEliteWave) this.spawnOneElite(); });
    }
  }
  spawnOneElite() {
    const big = ['brute', 'golem', 'treant'].filter(k => k === 'brute' || this.textures.exists(ENEMY_TYPES[k].tex));
    const e = this.spawnEnemy(), k = pick(big), T = ENEMY_TYPES[k];
    e.type = T; e.key = k; e.elite = true;
    const ak = this.anims.exists('sheet_' + k) ? 'sheet_' + k : ENEMY_ANIM[k];
    if (this.anims.exists(ak)) e.sprite.play(ak); else e.sprite.stop().setTexture(T.tex);
    e.hp = e.maxHp = T.hp * this.hpMul * (this.endless ? this.endlessMul() : 1) * 3;
    e.r = T.r * 1.3; e.base = T.h * CFG.enemyScale * 1.35 / e.sprite.height;
    e.sprite.setTint(0xff9a9a);
    return e;
  }
  updateStageEvents(dt) {
    const p = this.player;
    for (const r of this.rain) { // 灵石雨
      r.y += 300 * dt;
      const [sx, sy, sc] = proj(r.x, r.y);
      r.im.setPosition(sx, sy - 30 * sc).setScale(70 / r.im.height * Math.pow(sc, 0.6)).setRotation(this.t * 3);
      r.gl.setPosition(sx, sy - 30 * sc).setScale(1.6 * Math.pow(sc, 0.6));
      if (!r.done && r.y >= PLAYER_Y - 30) {
        r.done = true;
        if (Math.abs(r.x - p.x) < 75) {
          const v = r.crystal ? 3 : Math.round(120 * (1 + this.G * 0.08));
          this.loot[r.crystal ? 'crystal' : 'coin'] += v;
          this.floatText(p.x, PLAYER_Y - 150, (r.crystal ? '灵晶 +' : '金币 +') + v, r.crystal ? '#9fd8ff' : '#ffd36b', 30);
          this.pickupFx();
          sfx(this, 'coin', 0.3, 0.25); // 星光声 1.5 秒，太密会叠成一团
        }
      }
      if (r.done) { r.im.destroy(); r.gl.destroy(); }
    }
    this.rain = this.rain.filter(r => !r.done);
    if (this.fogT > 0) { // 妖雾：只剩主角附近看得到
      this.fogT -= dt;
      if (!this.fog) {
        if (!this.textures.exists('fogmask')) {
          const c = this.textures.createCanvas('fogmask', 512, 512), x = c.getContext();
          const gr = x.createRadialGradient(256, 256, 30, 256, 256, 256);
          gr.addColorStop(0, 'rgba(10,6,20,0)'); gr.addColorStop(0.3, 'rgba(10,6,20,0.55)'); gr.addColorStop(0.5, 'rgba(10,6,20,0.93)'); gr.addColorStop(1, 'rgba(10,6,20,0.98)');
          x.fillStyle = gr; x.fillRect(0, 0, 512, 512); c.refresh();
        }
        this.fog = this.add.image(0, 0, 'fogmask').setDepth(60).setScale(2.4, 3); // 视野半径约 200
        this.fogEdge = this.add.rectangle(W / 2, 0, W, 10, 0x0a0614, 0.98).setOrigin(0.5, 0).setDepth(60); // 遮罩上缘以上补黑
      }
      const a = Math.min(1, this.fogT, (12 - this.fogT) * 2);
      this.fog.setPosition(p.x, PLAYER_Y - 160).setAlpha(a).setVisible(true);
      const topY = this.fog.y - this.fog.displayHeight / 2 + 2;
      this.fogEdge.setSize(W, Math.max(0, topY)).setAlpha(a).setVisible(topY > 0);
      // 左右也可能露出来：遮罩宽 1228，主角在路边时补满
      if (this.fogT <= 0) { this.fog.setVisible(false); this.fogEdge.setVisible(false); }
    }
    if (this.ally && this.ally.visible) { // 援军跟在旁边
      this.allyT -= dt;
      const tx = clamp(p.x + (p.x < ROAD_MID ? 120 : -120), ROAD_L + 30, ROAD_R - 30);
      this.ally.x += (tx - this.ally.x) * Math.min(1, dt * 6);
      this.ally.y = PLAYER_Y + 20 + Math.sin(this.t * 2.4 + 1) * 6;
      if (this.allyHalo) this.allyHalo.setPosition(this.ally.x, PLAYER_Y + 40).setVisible(true).setAlpha(this.ally.alpha * 0.6);
      if (this.allyT <= 0) this.tweens.add({ targets: this.ally, alpha: 0, duration: 300, onComplete: () => { this.ally.setVisible(false); if (this.allyHalo) this.allyHalo.setVisible(false); } });
    }
  }

  endlessMul() { const m = this.t / 60; return (1 + 0.6 * m) * Math.pow(1.7, m); }
  makeElite(e, nAff) {
    e.affix = shuffle(AFFIXES.slice()).slice(0, nAff);
    const has = id => e.affix.some(a => a.id === id);
    if (has('swift')) e.speed *= 1.6;
    if (has('armor')) e.armor = this.baseDmg * 0.8; // 大约一道没加成的剑气：剑气多但每道弱的打法会很痛苦
    if (!e.tagT) e.tagT = txt(this, 0, 0, '', 22, '#ffffff').setDepth(46);
    e.tagT.setText(e.affix.map(a => a.name).join('·')).setColor(e.affix[0].color).setVisible(true);
  }
  hasAffix(e, id) { return !!(e.affix && e.affix.some(a => a.id === id)); }
  // 主线第 5 关起，40 秒来一小波精英（数量随关卡、第 50 关起两个词缀）
  spawnStageElites() {
    const n = 2 + Math.floor(this.stage / 25) + (this.diff ? 1 : 0);
    this.spawnEliteWave(0, n, this.stage >= 50 || this.diff >= 2 ? 2 : 1);
  }
  spawnEliteWave(n, count, nAff) {
    if (n) this.eventBanner(`第 ${n} 波 · 妖王先锋`, '精英妖兽来袭，漏掉一只伤害 ×2', 0x5a0010);
    else this.eventBanner('精英来袭', '精英妖兽带有词缀，注意头上的提示', 0x5a0010);
    this.cameras.main.flash(200, 140, 0, 0);
    const big = ['brute', 'golem', 'treant'].filter(k => k === 'brute' || this.textures.exists(ENEMY_TYPES[k].tex));
    for (let i = 0; i < (count || Math.min(7, 1 + n)); i++) {
      this.time.delayedCall(i * 350, () => {
        if (this.over) return;
        this.spawnEnemy();
        const e = this.enemies.filter(o => o.alive).slice(-1)[0];
        const k = pick(big), T = ENEMY_TYPES[k];
        e.type = T; e.key = k; e.elite = true;
        const ak = this.anims.exists('sheet_' + k) ? 'sheet_' + k : ENEMY_ANIM[k];
        if (this.anims.exists(ak)) e.sprite.play(ak); else e.sprite.stop().setTexture(T.tex);
        e.hp = e.maxHp = T.hp * this.hpMul * (this.endless ? this.endlessMul() * 3 : 1.5); // 主线的精英小波不要太硬（局内这时才 2～3 倍）
        e.r = T.r * 1.3; e.speed = T.speed * 0.9; e.ranged = false;
        e.base = T.h * CFG.enemyScale * 1.35 / e.sprite.height;
        e.sprite.setTint(0xff9a9a);
        this.makeElite(e, nAff || (n >= 4 ? 2 : 1));
      });
    }
  }

  gateStage() { return this.event ? Math.max(6, this.G) + Math.floor(this.t / 30) : this.G; }
  // 当下火力（每秒、专心打一个目标）：门和封印要打多久都用这个算，战力再高也要花时间打
  curDps() {
    const s = this.st, combo = 1 + Math.min(0.3, this.combo * 0.003);
    return this.baseDmg * s.dmgMul * MULTI_EFF[Math.min(MULTI_MAX, s.multi)] * s.rateMul * combo / CFG.atk.interval
      * (1 + CLONE_DMG * s.clones) * (1 + s.crit * (CFG.atk.critMul - 1));
  }
  // 这组门是第几阶：主线第 1～2 组初阶、3～4 中阶、5～6 高阶、7 以后极阶；无尽打完一轮后在 中→极 之间循环
  gateTier(i) { return i < 8 ? Math.min(3, i >> 1) : 1 + ((i - 8) >> 1) % 3; }
  // 打破封印／心魔／宝箱要专心打几秒（关卡越后面越久一点）
  gateSecs(sec) { return this.curDps() * sec * (1 + 0.005 * (Math.min(150, this.gateStage()) - 1)); }
  rollStatGate(g, stat) {
    const d = GATE_STATS[stat], tier = g.tier || 0;
    const shift = Math.min(2, Math.floor((this.gateStage() - 1) / 15)); // 每 15 关，数值框起始再负一格（最多两格）
    g.stat = stat; g.max = GATE_TIER_MAX[stat][tier];
    g.value = g.max - randi(1, 3) * d.step - shift * d.step;
    if (g.value === 0) g.value = d.step;
    if (this.gateCount <= 2) g.value = Math.max(g.value, d.step); // 开场前两组门一定是增益
    // 从起始值打到上限要几格（跳过 0），总共大约要专心打 GATE_FILL_T 秒
    const n = Math.max(1, Math.round((g.max - g.value) / d.step) - (g.value < 0 && g.max > 0 ? 1 : 0));
    g.progress = 0; g.cost = this.gateSecs(GATE_FILL_T[tier]) / n;
  }

  // 疾冲心魔：第 8 关起每 9~14 秒有机会冲出一个（关卡越后面越常出现）
  maybeRush(S, ok) {
    if (this.nextRush == null) this.nextRush = 13;
    if (!ok || S < 8 || this.t < this.nextRush) return;
    this.nextRush = this.t + rand(9, 14);
    if (Math.random() > Math.min(0.75, 0.35 + 0.01 * (S - 8))) return;
    const side = this.player.x < ROAD_MID ? 0 : 1; // 冲着玩家那一侧来
    this.makeGate('curse', side, { curse: pick(CURSES), rush: true });
  }

  makeGate(kind, side, opt = {}) {
    const x0 = side === 0 ? ROAD_L + 8 : ROAD_MID + 8;
    const x1 = side === 0 ? ROAD_MID - 8 : ROAD_R - 8;
    const w = x1 - x0, h = 118;
    const c = this.add.container(0, 0);
    const g = { kind, side, x0, x1, w, h, c, y: -110, done: false, ...opt };
    const key = kind === 'chest' ? 'gate_chest' : kind === 'skill' || kind === 'master' ? 'gate_gold' : kind === 'curse' ? 'gate_red' : 'gate_blue';
    g.img = this.add.image(0, 0, key).setOrigin(0.5, 1);
    g.img.setScale(w * (kind === 'chest' ? 0.78 : 1) / g.img.width);
    g.gh = g.img.displayHeight;
    g.fill = this.add.graphics();
    g.icon = this.add.image(0, 0, 'glow').setVisible(false);
    g.sub = txt(this, 0, 0, '', 26, '#ffffff');
    g.label = txt(this, 0, 0, '', 56, '#ffffff');
    g.bar = this.add.graphics();
    g.tag = txt(this, 0, 0, '', 28, '#ffb070').setVisible(false);
    if (kind === 'chest') c.add([g.img, g.fill, g.icon, g.sub, g.label, g.bar, g.tag]);
    else c.add([g.fill, g.img, g.icon, g.sub, g.label, g.bar, g.tag]);
    if (kind === 'stat') {
      this.rollStatGate(g, g.stat);
      // 变幻框：第 15 关起 18% 的数值框会每 3 秒换一次内容（换了就从头灌）
      if (this.gateStage() >= 15 && Math.random() < 0.18) { g.shifting = true; g.shiftT = 3; }
    } else {
      g.hp = g.maxHp = this.gateSecs(kind === 'skill' ? 1.8 : kind === 'curse' ? 1.4 : kind === 'master' ? 1.6 : 2.2);
      g.broken = false;
      g.solid = kind !== 'curse' || g.rush || (this.gateStage() >= 10 && Math.random() < 0.5); // 坚壁：子弹穿不过去，要先打破
    }
    this.redrawGate(g);
    this.placeGate(g);
    this.gates.push(g);
    return g;
  }

  redrawGate(g) {
    const { w, gh } = g;
    const f = g.fill;
    f.clear();
    if (g.kind !== 'chest') {
      // 框中间的能量场（盖住原图透出的格子，数字也比较清楚）
      let col;
      if (g.kind === 'stat') {
        col = g.value >= 0 ? 0x2f8bff : 0xff3b4e;
        g.img.setTexture(g.value >= 0 ? 'gate_blue' : 'gate_red');
      } else if (g.kind === 'curse') {
        col = g.broken ? 0x555a66 : 0x6a1aa8;
        g.img.setTint(g.broken ? 0x777777 : 0xb070ff);
      } else col = g.broken ? 0xffe27a : 0xffb21e;
      const ox = w * 0.3, top = -gh * 0.8, bot = -gh * 0.1;
      f.fillStyle(col, g.kind === 'skill' && !g.broken ? 0.55 : 0.72);
      f.fillRoundedRect(-ox, top, ox * 2, bot - top, { tl: ox * 0.95, tr: ox * 0.95, bl: 6, br: 6 });
      f.fillStyle(0xffffff, 0.18).fillRoundedRect(-ox * 0.8, top + 10, ox * 1.6, (bot - top) * 0.35, { tl: ox * 0.8, tr: ox * 0.8, bl: 0, br: 0 });
    }
    if (g.kind === 'stat') {
      const d = GATE_STATS[g.stat];
      g.icon.setTexture(d.icon).setVisible(true).setPosition(0, -gh * 0.64);
      g.icon.setScale(58 / g.icon.height);
      g.label.setText((g.value > 0 ? '+' : '') + g.value + d.unit).setPosition(0, -gh * 0.42).setFontSize(String(g.value).length >= 3 ? 50 : 58);
      g.sub.setText(g.shifting ? `变幻 · ${d.name}` : d.name).setPosition(0, -gh * 0.2);
      if (g.shifting) g.img.setTint(0xd8b0ff); else g.img.clearTint();
    } else if (g.kind === 'curse') {
      const cu = g.curse;
      g.icon.setTexture(cu.icon).setVisible(!g.broken).setPosition(0, -gh * 0.64).setTint(0xd0a0ff);
      g.icon.setScale(56 / g.icon.height);
      g.label.setText(g.broken ? '已破除' : `${cu.v}${cu.unit}`).setPosition(0, -gh * 0.42).setFontSize(g.broken ? 40 : 54).setColor(g.broken ? '#c0c6d2' : '#ffb0c8');
      g.sub.setText(g.broken ? '心魔已散' : `心魔·${cu.name}`).setPosition(0, -gh * 0.9).setColor('#e0c0ff');
    } else if (g.kind === 'master') {
      g.icon.setTexture('fx_master_seal').setVisible(true).setPosition(0, -gh * 0.58).setBlendMode(Phaser.BlendModes.ADD);
      g.icon.setScale(100 / g.icon.height).setAlpha(g.broken ? 1 : 0.7).setRotation(this.t);
      g.label.setText('师尊令').setPosition(0, -gh * 0.27).setFontSize(36);
      g.label.setText(this.mTier < 5 ? '师尊 +1阶' : `感应 +${MASTER.gate}%`).setFontSize(30);
      g.sub.setText(g.broken ? '师尊令 · 可领取' : '师尊令 · 击破领取').setPosition(0, -gh * 0.9).setColor(g.broken ? '#fff3b0' : '#ffffff');
    } else if (g.kind === 'skill') {
      g.icon.setTexture(SKILLS[g.skill].icon).setVisible(true).setPosition(0, -gh * 0.56);
      g.icon.setScale(96 / g.icon.height).setAlpha(g.broken ? 1 : 0.75);
      g.label.setText(SKILLS[g.skill].name).setPosition(0, -gh * 0.27).setFontSize(34);
      g.sub.setText(g.broken ? '已破开 · 可领取' : '击破封印').setPosition(0, -gh * 0.9).setColor(g.broken ? '#fff3b0' : '#ffffff');
    } else {
      g.label.setText(g.broken ? '机缘' : '').setPosition(0, -gh * 0.55).setFontSize(44);
      g.sub.setText(g.broken ? '已破开 · 可领取' : '宝箱').setPosition(0, -gh - 22).setColor(g.broken ? '#fff3b0' : '#ffffff');
    }
    // 坚壁／疾冲的提示：框底下一行字＋外框加粗
    if (g.rush && !g.broken) g.tag.setText('疾冲！击破或闪开').setColor('#ff6060').setPosition(0, 22).setVisible(true);
    else if (g.solid && !g.broken) g.tag.setText('坚壁 · 需击破').setColor('#ffb070').setPosition(0, 22).setVisible(true);
    else g.tag.setVisible(false);
    if (g.solid && !g.broken && g.kind !== 'chest') { f.lineStyle(6, g.rush ? 0xff3030 : 0xc87a2a, 1).strokeRoundedRect(-w / 2 + 6, -gh + 10, w - 12, gh - 14, 14); }
    this.drawGateBar(g);
  }

  // 框上的条：数值框＝再打多少会 +1（满了变金色）；功法框／宝箱＝剩余血量
  drawGateBar(g) {
    const { w, gh } = g;
    g.bar.clear();
    if (g.kind === 'stat') {
      const d = GATE_STATS[g.stat], full = g.value >= g.max;
      const bw = w * 0.5, by = -gh * 0.135;
      g.bar.fillStyle(0x000000, 0.6).fillRoundedRect(-bw / 2, by, bw, 11, 5);
      g.bar.fillStyle(full ? 0xffd04a : 0xe8f4ff, 1).fillRoundedRect(-bw / 2, by, Math.max(4, bw * (full ? 1 : g.progress / g.cost)), 11, 5);
      g.bar.lineStyle(2, 0xffffff, 0.6).strokeRoundedRect(-bw / 2, by, bw, 11, 5);
      if (full !== g.wasFull) { g.wasFull = full; g.sub.setText((g.shifting ? '变幻 · ' : '') + d.name + (full ? ' · 已满' : '')); }
    } else if (!g.broken) {
      const bw = w * 0.6, by = g.kind === 'chest' ? -gh - 50 : -gh * 0.1 - 18;
      g.bar.fillStyle(0x000000, 0.65).fillRoundedRect(-bw / 2, by, bw, 12, 5);
      g.bar.fillStyle(0xffe14a, 1).fillRoundedRect(-bw / 2, by, Math.max(1, bw * g.hp / g.maxHp), 12, 5);
    }
  }

  placeGate(g) {
    const [sx, sy, s] = proj((g.x0 + g.x1) / 2, g.y + g.h / 2);
    if (g.rush && !g.broken) { g.img.setTint(Math.sin(this.t * 18) > 0 ? 0xff5050 : 0xffb0b0); if (Math.random() < 0.4) this.fxDeath.explode(1, sx + rand(-60, 60) * s, sy - rand(20, 100) * s); }
    g.c.setPosition(sx, sy).setScale(s).setDepth(10 + (g.y + g.h / 2) / 2000 + 0.0001);
    if (!g.done) g.c.setAlpha(clamp((s - 0.2) / 0.08, 0, 1));
  }

  // 功法框机率：1~4 关 12%、5~14 关 20%、15~29 关 28%、30 关起 35%
  skillGateChance(S) { return S <= 4 ? 0.12 : S <= 14 ? 0.2 : S <= 29 ? 0.28 : 0.35; }
  // 抽一个框的内容：剑气 40%、功法框（随关卡）、其余按 攻速 45%／攻击 40%／分身 15% 分
  rollGateContent(S, avoid, tier = 0) {
    for (let k = 0; k < 6; k++) {
      const r = Math.random(), ps = this.skillGateChance(S);
      let o;
      if (this.masterOn && (!avoid || avoid.kind !== 'master') && this.gateCount > 1 && Math.random() < 0.12) o = { kind: 'master' }; // 师尊令：+1 阶＋感应 30%
      else if (r < 0.4 && !(this.st.multi >= MULTI_MAX && Math.random() < 0.7)) o = { kind: 'stat', stat: 'multi' };
      else if (r < 0.4 + ps) { const sk = this.pickSkillGate(); o = sk ? { kind: 'skill', skill: sk } : { kind: 'stat', stat: 'dmg' }; }
      else { const q = Math.random(); o = { kind: 'stat', stat: q < 0.45 ? 'rate' : q < 0.85 || tier < 2 || this.st.clones >= CLONE_MAX ? 'dmg' : 'clone' }; }
      if (!avoid || o.kind !== avoid.kind || (o.stat || o.skill) !== (avoid.stat || avoid.skill)) return o; // 左右不要一样
    }
    return { kind: 'stat', stat: 'dmg' };
  }
  // 功法框抽哪个：已经有的功法权重比较高（才凑得到 Lv3 觉醒），满级的不再出现
  pickSkillGate() {
    const ids = Object.keys(SKILLS).filter(id => this.skills[id] < skillMax(id));
    if (!ids.length) return null;
    const w = ids.map(id => 1 + 1.5 * this.skills[id]);
    let r = Math.random() * w.reduce((a, b) => a + b, 0);
    for (let i = 0; i < ids.length; i++) { r -= w[i]; if (r <= 0) return ids[i]; }
    return ids[ids.length - 1];
  }
  spawnGatePair() {
    const i = this.gateCount++, tier = this.gateTier(i);
    const S = this.event ? Math.max(6, this.G) + Math.floor(this.t / 20) : this.G;
    const curse = () => ({ kind: 'curse', curse: pick(CURSES) });
    let left, right;
    if (i === 0) {
      left = { kind: 'stat', stat: 'multi' }; right = { kind: 'stat', stat: 'rate' };
    } else {
      left = this.rollGateContent(S, null, tier);
      right = this.rollGateContent(S, left, tier);
      // 难度越高，花样越多：单边框、一边心魔、两边都是心魔（只能打破一个）
      const r = Math.random();
      // 心魔：第 5 关起 8%，每关 +0.5%，最多 20%；两边都心魔要第 30 关后才有、5%
      const pCurse = S >= 5 || this.diff ? Math.min(0.3, 0.08 + 0.005 * (S - 5) + (this.diff >= 2 ? 0.08 : 0)) : 0, pDouble = S >= 30 || this.diff >= 2 ? 0.05 : 0; // 困难起心魔变多
      if (r < pDouble) { left = curse(); right = curse(); }
      else if (r < pDouble + pCurse) right = curse();
      else if (S >= 3 && r < pDouble + pCurse + 0.18) right = null;
      if (Math.random() < 0.5) [left, right] = [right, left];
    }
    const y0 = i === 0 ? 380 : -110; // 第一组门直接出现在半路，开场几秒就吃得到
    if (left) this.makeGate(left.kind, 0, { ...left, tier, y: y0 });
    if (right) this.makeGate(right.kind, 1, { ...right, tier, y: y0 });
    if (CFG.chestAfterGate.includes(i)) this.chestAt.push(this.t + 4.5);
  }
  spawnChest() { this.makeGate('chest', Math.random() < 0.5 ? 0 : 1); }

  hitGate(g, dmg) {
    if (g.kind === 'stat') {
      const d = GATE_STATS[g.stat];
      if (g.value >= g.max) return;
      g.progress += dmg;
      let changed = false;
      while (g.progress >= g.cost && g.value < g.max) {
        g.progress -= g.cost; g.value = Math.min(g.max, g.value + d.step);
        if (g.value === 0) g.value = d.step;
        changed = true;
      }
      if (changed) {
        g.wasFull = undefined;
        this.redrawGate(g);
        sfx(this, 'gate_up', 0.3, 0.08);
        this.tweens.add({ targets: g.label, scale: { from: 1.45, to: 1 }, duration: 180 });
        this.fxWater.explode(8, g.c.x, g.c.y - g.gh * 0.4 * g.c.scale);
      } else this.drawGateBar(g);
    } else if (!g.broken) {
      g.hp -= dmg;
      if (g.hp <= 0) {
        g.broken = true;
        sfx(this, 'gate_break', 0.55, 0);
        if (this.anims.exists('fx_gate_break')) { const f = this.playFx('fx_gate_break', g.c.x, g.c.y - g.gh * 0.45 * g.c.scale, 1.3 * g.c.scale, 44); if (f) f.setRotation(0); }
        if (g.kind === 'curse') { this.energy = Math.min(CFG.energyMax, this.energy + 8); this.fxDeath.explode(20, g.c.x, g.c.y - 60 * g.c.scale); }
        this.fxGold.explode(30, g.c.x, g.c.y - 60 * g.c.scale);
        this.cameras.main.shake(80, 0.004);
      }
      this.redrawGate(g);
    }
  }

  updateGates(dt) {
    const px = this.player.x;
    for (const g of this.gates) {
      g.y += CFG.scroll * dt * (g.rush && !g.broken ? 2.4 : 1);
      this.placeGate(g);
      if (g.shifting && !g.done) { // 变幻框：倒数到了就换内容
        g.shiftT -= dt;
        if (g.shiftT <= 0) {
          g.shiftT = 3;
          this.rollStatGate(g, pick(Object.keys(GATE_STATS)));
          g.wasFull = undefined;
          this.redrawGate(g);
          this.tweens.add({ targets: g.label, scale: { from: 0.4, to: 1 }, duration: 220, ease: 'Back.easeOut' });
          this.fxGold.explode(10, g.c.x, g.c.y - g.gh * 0.4 * g.c.scale);
        }
      }
      if (!g.done && g.y >= PLAYER_Y - 20) {
        g.done = true;
        if (px >= g.x0 - 6 && px <= g.x1 + 6) this.applyGate(g);
        this.tweens.add({ targets: g.c, alpha: 0, duration: 260 });
      }
    }
    this.gates = this.gates.filter(g => { if (g.y > H + 200) { g.c.destroy(); return false; } return true; });
  }

  applyGate(g) {
    const s = this.st, p = this.player;
    if (g.kind === 'stat') {
      const v = g.value, d = GATE_STATS[g.stat];
      if (g.stat === 'multi') { if (v > 0) addMulti(s, v); else s.multi = Math.max(1, s.multi + v); }
      if (g.stat === 'rate') addBuff(s, 'rateMul', v);
      if (g.stat === 'dmg') addBuff(s, 'dmgMul', v);
      if (g.stat === 'clone') s.clones = clamp(s.clones + v, 0, CLONE_MAX);
      if (v >= 0) this.stat.gatesTaken = (this.stat.gatesTaken || 0) + 1;
      const capped = (g.stat === 'rate' && s.rateMul >= BUFF_CAP.rateMul) || (g.stat === 'dmg' && s.dmgMul >= BUFF_CAP.dmgMul);
      this.floatText(p.x, PLAYER_Y - 170, d.name + ' ' + (v > 0 ? '+' : '') + v + d.unit + (capped && v > 0 ? '（已达上限）' : ''), v >= 0 ? '#7fc4ff' : '#ff6b7a', 42);
      if (v >= 0) { this.fxWater.explode(24, p.x, PLAYER_Y - 60); this.pickupFx(); sfx(this, 'buff', 0.3, 0); }
      else { sfx(this, 'curse', 0.35, 0); this.cameras.main.shake(120, 0.006); }
    } else if (g.kind === 'curse') {
      if (g.broken) { this.floatText(p.x, PLAYER_Y - 170, '心魔已破', '#c0c6d2', 34); return; }
      const cu = g.curse;
      if (cu.stat === 'rate') addBuff(s, 'rateMul', cu.v);
      if (cu.stat === 'dmg') addBuff(s, 'dmgMul', cu.v);
      if (cu.stat === 'move') s.moveMul = Math.max(0.4, s.moveMul * (1 + cu.v / 100));
      if (cu.stat === 'multi') s.multi = Math.max(1, s.multi + cu.v);
      if (cu.stat === 'crit') s.crit = Math.max(0, s.crit + cu.v / 100);
      sfx(this, 'curse', 0.4, 0);
      this.floatText(p.x, PLAYER_Y - 170, `心魔侵体 ${cu.name}${cu.v}${cu.unit}`, '#d08aff', 38);
      this.cameras.main.shake(180, 0.008); this.cameras.main.flash(200, 120, 30, 160);
    } else if (g.kind === 'master') {
      if (!g.broken) { this.floatText(p.x, PLAYER_Y - 170, '师尊令未破', '#9aa3b2', 34); return; }
      this.mGauge = Math.min(100, this.mGauge + MASTER.gate);
      if (this.mTier < 5) { this.mTier++; if (this.mLv) this.tweens.add({ targets: this.mLv, scale: { from: 1.6, to: 1 }, duration: 300, ease: 'Back.easeOut' }); this.floatText(p.x, PLAYER_Y - 170, `师尊 ${this.mTier} 阶 · ${MASTER_TIER[this.mTier - 1]}　感应 +${MASTER.gate}%`, '#ffe7a3', 34); }
      else this.floatText(p.x, PLAYER_Y - 170, `师尊感应 +${MASTER.gate}%`, '#ffe7a3', 40);
      this.pickupFx(); sfx(this, 'buff', 0.3, 0);
    } else if (g.kind === 'skill') {
      if (g.broken) { this.addSkill(g.skill); this.pickupFx(); }
      else this.floatText(p.x, PLAYER_Y - 170, '封印未破', '#9aa3b2', 34);
    } else {
      if (g.broken) { this.pickupFx(); this.stat.chests++; this.chestsGot = (this.chestsGot || 0) + 1; if (this.secret && this.chestsGot % 2 === 0) this.floatText(this.player.x, PLAYER_Y - 170, '宝物 +1', '#ffd36b', 40); else this.showChoice(); }
      else this.floatText(p.x, PLAYER_Y - 170, '宝箱未破开', '#9aa3b2', 34);
    }
  }

  // ───── 普攻 ─────
  updateFire(dt) {
    this.fireT -= dt;
    if (this.fireT > 0) return;
    const comboBonus = 1 + Math.min(0.3, this.combo * 0.003); // 剑修本命：连斩越高攻速越快
    this.fireT = CFG.atk.interval / (this.st.rateMul * comboBonus);
    const dmg = this.baseDmg * this.st.dmgMul;
    this.kick = 1;
    this.fireFrom(this.player.x, PLAYER_Y - 50, dmg);
    this.clones.forEach((c, i) => { if (i < this.st.clones) this.fireFrom(c.x, PLAYER_Y - 30, dmg * CLONE_DMG); });
    if (this.ally && this.ally.visible && this.allyT > 0) this.fireFrom(this.ally.x, PLAYER_Y - 40, dmg * 0.9); // 援军一起放剑气
  }
  fireFrom(x, y, dmg) {
    sfx(this, 'shoot', 0.12, 0.11);
    const n = this.st.multi;
    dmg *= MULTI_EFF[Math.min(MULTI_MAX, n)] / n; // 剑气越多每道越弱
    for (let i = 0; i < n; i++) {
      const k = i - (n - 1) / 2;
      const ang = n > 3 ? k * 0.035 : 0;
      const b = this.getBullet();
      b.x = x + k * CFG.atk.gap; b.y = y;
      b.vx = Math.sin(ang) * CFG.atk.speed; b.vy = -Math.cos(ang) * CFG.atk.speed;
      b.dmg = dmg; b.alive = true; b.gate = null;
      b.s.setVisible(true);
      this.placeBullet(b);
    }
  }
  getBullet() {
    let b = this.bullets.find(o => !o.alive);
    if (!b) {
      const s = this.add.image(0, 0, 'fx_sword_bolt').setDepth(20).setBlendMode(Phaser.BlendModes.ADD).setOrigin(0.5, 0.3);
      b = { s, base: 135 / s.height };
      this.bullets.push(b);
    }
    return b;
  }
  placeBullet(b) {
    const [sx, sy, s] = proj(b.x, b.y);
    b.s.setPosition(sx, sy).setScale(b.base * s).setRotation(Math.atan2(b.vx, -b.vy) * s);
  }
  updateBullets(dt) {
    for (const b of this.bullets) {
      if (!b.alive) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -160 || b.x < 0 || b.x > W) { this.killBullet(b); continue; }
      this.placeBullet(b);
      // 穿过框：框吃全额伤害，子弹伤害减半继续飞；坚壁框（没打破前）会把子弹挡下来
      let blocked = false;
      for (const g of this.gates) {
        if (g.done || b.gate === g) continue;
        if (b.x > g.x0 && b.x < g.x1 && Math.abs(b.y - g.y) < g.h / 2) {
          const wall = g.solid && !g.broken;
          this.hitGate(g, b.dmg);
          const [sx, sy, s] = proj(b.x, b.y);
          if (wall || Math.random() < 0.5) this.playFx('fx_hit', sx, sy, (wall ? 0.7 : 0.5) * s + 0.15);
          if (wall) { blocked = true; break; }
          b.gate = g; b.dmg *= CFG.gatePass;
          break;
        }
      }
      if (blocked) { this.killBullet(b); continue; }
      const boss = this.boss;
      if (boss && boss.alive && Math.abs(b.x - boss.x) < 115 && Math.abs(b.y - boss.y) < 70) {
        this.hurtBoss(this.rollCrit(b.dmg), b.x, b.y); this.killBullet(b); continue;
      }
      for (const e of this.enemies) {
        if (!e.alive) continue;
        const dx = b.x - e.x, dy = b.y - e.y, rr = e.r + 8;
        if (dx * dx + dy * dy < rr * rr) { this.hurtEnemy(e, this.rollCrit(b.dmg)); this.killBullet(b); break; }
      }
    }
  }
  killBullet(b) { b.alive = false; b.s.setVisible(false); }
  rollCrit(dmg) {
    const v = dmg * rand(1 - CFG.dmgVar, 1 + CFG.dmgVar); // 每一下伤害都有浮动，数字才不会一直一样
    if (Math.random() < CFG.superCrit) { if (this.stat) this.stat.supers++; return { v: v * CFG.superMul, crit: 2 }; } // 天罡暴击：极低机率
    if (Math.random() < this.st.crit) return { v: v * CFG.atk.critMul * rand(0.95, 1.1), crit: 1 };
    return { v, crit: 0 };
  }

  // ───── 敌人 ─────
  hurtEnemy(e, hit, showChance = 0.3) {
    if (!e.alive) return;
    if (e.armor) hit = { ...hit, v: Math.max(hit.v * 0.2, hit.v - e.armor) };
    if (hit.crit && this.hasAffix(e, 'reflect') && this.t >= (e.reflT || 0)) { e.reflT = this.t + 0.8; this.enemyShot(e, 0xff8fd8); }
    e.hp -= hit.v;
    e.flash = 0.06; e.sprite.setTintFill(0xffffff);
    const [sx, sy, s] = proj(e.x, e.y);
    if (hit.crit === 2 || hit.crit || Math.random() < showChance) this.showNum(sx, sy - e.type.h * CFG.enemyScale * Math.pow(s, CFG.enemyPersp), hit.v, hit.crit, s);
    if (Math.random() < 0.4) this.playFx('fx_hit', sx, sy - e.type.h * 0.5 * s, 0.6 * s + 0.15);
    if (hit.crit === 1) sfx(this, 'crit', 0.32, 0.09); else if (!hit.crit) sfx(this, Math.random() < 0.5 ? 'hit1' : 'hit2', 0.18, 0.06);
    if (this.trait === 3 && !e.enraged && e.hp > 0 && e.hp < e.maxHp * 0.5) { e.enraged = true; e.speed *= 1.7; } // 魔渊：半血狂暴
    if (e.hp <= 0 && this.trait === 2 && !e.revived && !e.child && Math.random() < 0.25) { // 幽冥谷：25% 复活一次
      e.revived = true; e.hp = e.maxHp * 0.5;
      this.fxWater.explode(10, sx, sy - 40 * s);
      return;
    }
    if (e.hp <= 0) this.killEnemy(e, true);
  }
  killEnemy(e, reward) {
    e.alive = false; e.sprite.setVisible(false);
    if (e.tagT) e.tagT.setVisible(false);
    if (!reward) return;
    if (this.hasAffix(e, 'split')) this.splitEnemy(e, 3, 0.25);
    sfx(this, 'kill', e.elite ? 0.5 : 0.22, e.elite ? 0 : 0.07);
    const [sx, sy, s] = proj(e.x, e.y);
    this.playFx('fx_death', sx, sy - e.type.h * 0.4 * s, (e.key === 'brute' ? 1.3 : 0.85) * s, 41);
    if (this.trait === 1 && !e.child && !e.elite && Math.random() < 0.3) { // 万妖林：30% 死后分裂成两只小的
      const ex = e.x, ey = e.y, T = e.type, key = e.key, mhp = e.maxHp;
      [-34, 34].forEach(off => this.time.delayedCall(0, () => {
        if (this.over) return;
        const c = this.spawnEnemy();
        c.type = T; c.key = key; c.child = true;
        const ak = this.anims.exists('sheet_' + key) ? 'sheet_' + key : ENEMY_ANIM[key];
        if (this.anims.exists(ak)) c.sprite.play(ak); else c.sprite.stop().setTexture(T.tex);
        c.x = clamp(ex + off, ROAD_L + 20, ROAD_R - 20); c.y = ey; c.hp = c.maxHp = mhp * 0.3; c.r = T.r * 0.8;
        c.base = T.h * CFG.enemyScale * 0.62 / c.sprite.height;
        this.placeEnemy(c);
      }));
    }
    this.kills++; this.combo++; this.comboT = CFG.comboWindow;
    if (this.masterOn && !this.masterUp) this.mGauge = Math.min(100, this.mGauge + (e.elite ? MASTER.perElite : MASTER.perKill));
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.energy = Math.min(CFG.energyMax, this.energy + e.type.energy);
  }
  // 分裂：在原地生出 n 只小的
  splitEnemy(e, n, hpFrac) {
    const ex = e.x, ey = e.y, T = e.type, key = e.key, mhp = e.maxHp;
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 40;
      this.time.delayedCall(0, () => {
        if (this.over) return;
        const c = this.spawnEnemy();
        c.type = T; c.key = key; c.child = true; c.ranged = false;
        const ak = this.anims.exists('sheet_' + key) ? 'sheet_' + key : ENEMY_ANIM[key];
        if (this.anims.exists(ak)) c.sprite.play(ak); else c.sprite.stop().setTexture(T.tex);
        c.x = clamp(ex + off, ROAD_L + 20, ROAD_R - 20); c.y = ey; c.hp = c.maxHp = mhp * hpFrac; c.r = T.r * 0.8;
        c.base = T.h * CFG.enemyScale * 0.62 / c.sprite.height;
        this.placeEnemy(c);
      });
    }
  }
  // 妖兽丢妖弹：瞄准主角现在的位置，飞得不快，左右移动就闪得掉
  enemyShot(e, tint = 0xc080ff) {
    if (this.over) return;
    sfx(this, 'boss_attack', 0.22, 0.25);
    const dx = this.player.x - e.x, dy = PLAYER_Y - e.y, len = Math.hypot(dx, dy) || 1;
    const os = this.add.image(0, 0, 'orb').setDepth(35).setBlendMode(Phaser.BlendModes.ADD).setTint(tint);
    const dmg = e.type.dmg * this.enemyDmgMul * (this.endless ? Math.pow(1.35, this.t / 60) : 1) * 1.2;
    this.orbs.push({ s: os, x: e.x, y: e.y, vx: dx / len * 380, vy: dy / len * 380, dmg, small: true });
  }
  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.stunT > 0) { e.stunT -= dt; this.placeEnemy(e); continue; } // 被定身／冰冻
      if (e.ranged && e.shots < 3 && e.y >= e.stopY) { // 远程：停在中段施法，丢三发再继续往前
        e.castT -= dt;
        if (e.castT <= 0.45 && !e.windup) { e.windup = true; e.sprite.setTint(0xd090ff); }
        if (e.castT <= 0) {
          e.castT = 2.4; e.windup = false; e.shots++;
          const tc = this.enemyTint(e); if (tc) e.sprite.setTint(tc); else e.sprite.clearTint();
          this.enemyShot(e);
        }
      } else e.y += e.speed * dt;
      if (this.hasAffix(e, 'regen')) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.04 * dt);
      // 妖兽会慢慢往主角聚拢，越靠近越明显
      const dx = clamp(this.player.x + e.spread, ROAD_L + e.r, ROAD_R - e.r) - e.x, track = e.type.track * (0.4 + 0.6 * Math.max(0, e.y) / LINE_Y);
      e.x += Math.sign(dx) * Math.min(Math.abs(dx), track * dt) + Math.sin(this.t * (e.type.wiggle ? 4 : 2) + e.phase) * (e.type.wiggle || 14) * dt; // 蛇妖左右扭得比较大
      e.x = clamp(e.x, ROAD_L + e.r, ROAD_R - e.r);
      this.placeEnemy(e);
      if (e.flash > 0) { e.flash -= dt; if (e.flash <= 0) { const tc = this.enemyTint(e); if (tc) e.sprite.setTint(tc); else e.sprite.clearTint(); } }
      if (e.y >= LINE_Y) {
        this.damagePlayer(e.type.dmg * this.enemyDmgMul * (this.endless ? Math.pow(1.35, this.t / 60) : 1) * (e.elite ? (this.endless ? 2 : 1.5) : 1));
        const [sx, sy] = proj(e.x, LINE_Y);
        this.playFx('fx_death', sx, sy - 40, 0.8, 41);
        this.killEnemy(e, false);
      }
    }
  }
  damagePlayer(d) {
    const s = this.st;
    if (s.shield > 0) { const a = Math.min(s.shield, d); s.shield -= a; d -= a; }
    if (d <= 0) return;
    sfx(this, 'hurt', 0.4, 0.18);
    d *= 100 / (100 + this.def); // 防御减伤
    s.hp -= d;
    this.cameras.main.shake(70, 0.003);
    this.player.setTintFill(0xff5a5a);
    this.time.delayedCall(80, () => this.player.clearTint());
    if (s.hp <= 0) { s.hp = 0; this.finish(false); }
  }

  // ───── Boss ─────
  spawnBoss() {
    sfx(this, 'boss_appear', 0.7, 0);
    if (!this.trial) playBgm(this, 'boss');
    this.bossSpawned = true;
    // 每章妖王：有专属图（boss_ch2..4，可以是动作图 sheet_boss_ch2）就用，没有就用玄狼妖王换色
    const c = this.event ? 0 : this.chapter, own = c > 0 && (this.textures.exists(`sheet_boss_ch${c + 1}`) || this.textures.exists(`boss_ch${c + 1}`));
    const key = own ? (this.textures.exists(`sheet_boss_ch${c + 1}`) ? `sheet_boss_ch${c + 1}` : `boss_ch${c + 1}`) : null;
    const anim = key ? this.anims.exists(key) : this.anims.exists('anim_boss_idle');
    const s = this.add.sprite(0, 0, key || (anim ? 'anim_boss_idle' : 'boss_wolf')).setOrigin(0.5, anim ? 0.97 : 0.92);
    if (anim) s.play(key || 'anim_boss_idle');
    if (!own && c > 0) s.setTint(CHAPTERS[c].tint);
    s.baseTint = !own && c > 0 ? CHAPTERS[c].tint : null; // 受击闪白后要恢复章节换色
    this.bossName = this.trial ? '宗门长老 · 试炼傀儡' : CHAPTERS[c].boss;
    if (this.trial) s.setTint(0xc8d8ff);
    const R = this.bossRound - 1;
    const bhp = CFG.bossHp * this.hpMul * (this.trial ? 40 : BOSS_ROUND.hp[R]);
    this.bossSize = BOSS_ROUND.size[R] * (this.stage >= 51 && !this.event ? 1.25 : 1); // 第 51 关起的妖王图比较小，放大一点
    this.boss = { alive: true, anim, x: ROAD_MID, y: this.trial ? 200 : -260, sprite: s, base: 480 / s.height * this.bossSize, hp: bhp, maxHp: bhp, atkT: 3, flash: 0, rage: R >= 1, round: R + 1 };
    if (R >= 1) { s.baseTint = 0xff8a8a; s.setTint(0xff8a8a); }
    if (this.bossRounds > 1) this.bossName += ` · 第${ROUND_CN[R]}轮`;
    if (R >= 1 && this.anims.exists('fx_boss_revive')) { const [rx, ry] = proj(ROAD_MID, 680); const f = this.playFx('fx_boss_revive', rx, ry - 260, 1.9, 44); if (f) f.setRotation(0); } // 妖王重生：在妖王会站的位置爆开（docs/17）
    this.trialDmg = 0;
    const banner = this.add.container(W / 2, 520).setDepth(150);
    const bg = this.add.rectangle(0, 0, W + 40, 190, 0x5a0010, 0.85).setAngle(-4);
    const title = this.add.image(0, -20, 'title_warning');
    title.setScale(130 / title.height);
    banner.add([bg, title, txt(this, 0, 66, `${this.bossName} 来袭`, 34, '#ffd36b')]);
    banner.x = -W;
    this.tweens.add({ targets: banner, x: W / 2, duration: 300, ease: 'Back.easeOut', hold: 1300, yoyo: true, onComplete: () => banner.destroy() });
    this.cameras.main.flash(300, 160, 0, 0);
  }
  hurtBoss(hit, x, y) {
    const b = this.boss;
    if (!b || !b.alive) return;
    b.hp -= hit.v; b.flash = 0.05; b.sprite.setTintFill(0xffffff);
    if (this.trial) { this.trialDmg += hit.v; b.hp = Math.max(b.maxHp * 0.02, b.hp); } // 试炼傀儡不会倒
    const [sx, sy, s] = proj(x, y);
    if (hit.crit === 2 || (hit.crit && Math.random() < 0.4) || Math.random() < 0.06) this.showNum(sx + rand(-80, 80) * s, sy - rand(150, 330) * s, hit.v, hit.crit, s);
    if (Math.random() < 0.3) this.playFx('fx_hit', sx + rand(-70, 70) * s, sy - rand(100, 330) * s, 0.7 * s + 0.2);
    if (b.hp <= 0) {
      b.alive = false; b.hp = 0; this.stat.bosses++;
      const [bx, by] = proj(b.x, b.y);
      this.fxGold.explode(60, bx, by - 150); this.fxDeath.explode(40, bx, by - 150);
      this.playFx('fx_explosion', bx, by - 150, 3, 43);
      this.cameras.main.shake(400, 0.012); this.cameras.main.flash(300, 255, 240, 200);
      this.tweens.add({ targets: b.sprite, alpha: 0, scale: b.sprite.scale * 1.3, duration: 600 });
      this.enemies.forEach(e => { if (e.alive && e.y > 0) this.killEnemy(e, true); });
      if (this.bossRound < this.bossRounds) { this.time.delayedCall(900, () => this.bossInterlude()); return; }
      this.time.delayedCall(1000, () => this.finish(true));
    }
  }
  updateBoss(dt) {
    const b = this.boss;
    if (b && b.alive) {
      if (b.y < 680) b.y += 140 * dt;
      else b.x = ROAD_MID + Math.sin(this.t * 0.7) * 150;
      const [sx, sy, s] = proj(b.x, b.y);
      b.lunge = Math.max(0, (b.lunge || 0) - dt * 2.5) * (b.anim ? 0.5 : 1);
      if (b.anim) b.base = 480 / b.sprite.frame.height * this.bossSize; // 待机、攻击两组帧高不同
      if (b.anim && b.sprite.texture.key.startsWith('sheet_')) b.base = 420 / b.sprite.frame.height * this.bossSize;
      const br = Math.sin(this.t * 2.4);
      b.sprite.setPosition(sx, sy + b.lunge * 30 * s).setDepth(10 + b.y / 2000).setRotation(Math.sin(this.t * 1.3) * 0.03)
        .setScale(b.base * s * (1 + 0.015 * br + b.lunge * 0.12), b.base * s * (1 + 0.03 * br + b.lunge * 0.08));
      if (b.flash > 0) { b.flash -= dt; if (b.flash <= 0) { if (b.sprite.baseTint) b.sprite.setTint(b.sprite.baseTint); else b.sprite.clearTint(); } }
      if (b.y >= 680) {
        const ratio = b.hp / b.maxHp;
        if (!this.trial && ratio < 0.6) {
          b.sumT = (b.sumT == null ? 1 : b.sumT) - dt;
          if (b.sumT <= 0) { b.sumT = b.round >= 3 ? 4 : 6; this.bossSummon(b); }
        }
        if (!this.trial && ratio < 0.3 && !b.rage && b.round === 1) {
          b.rage = true;
          this.eventBanner('妖王狂暴', '妖弹变多、出手更快！', 0x8a0010);
          b.sprite.baseTint = 0xff8a8a; b.sprite.setTint(0xff8a8a);
          this.cameras.main.shake(300, 0.01);
        }
        b.atkT -= dt;
        if (b.atkT <= 0) {
          b.atkT = b.rage ? 1.7 : 2.6; b.lunge = 1;
          if (b.anim && this.anims.exists('anim_boss_attack') && b.sprite.anims.currentAnim && b.sprite.anims.currentAnim.key === 'anim_boss_idle') {
            b.sprite.play('anim_boss_attack');
            b.sprite.once('animationcomplete', () => { if (b.alive) b.sprite.play('anim_boss_idle'); });
          }
          this.time.delayedCall(b.anim ? 420 : 0, () => this.bossVolley());
        }
      }
    }
    this.updateOrbs(dt);
  }
  bossVolley() {
    const b = this.boss;
    if (!b || !b.alive || this.over) return;
    sfx(this, 'boss_attack', 0.5, 0.5);
    this.cameras.main.shake(120, 0.004);
    const tx = this.player.x;
    (b.round >= 3 ? [-210, -140, -70, 0, 70, 140, 210] : b.rage ? [-150, -75, 0, 75, 150] : [-70, 0, 70]).forEach(o => {
      const dx = tx + o - b.x, dy = PLAYER_Y - b.y, len = Math.hypot(dx, dy);
      const os = this.add.image(0, 0, 'orb').setDepth(35).setBlendMode(Phaser.BlendModes.ADD);
      this.orbs.push({ s: os, x: b.x, y: b.y, vx: dx / len * 420, vy: dy / len * 420 });
    });
  }
  // 妖王倒下但还会重生：30 秒妖潮（门照样来、加成保留），之后妖王更大更强地回来
  bossInterlude() {
    if (this.over) return;
    if (this.boss) { this.tweens.killTweensOf(this.boss.sprite); this.boss.sprite.destroy(); this.boss = null; }
    this.bossRound++;
    this.bossSpawned = false;
    this.reviveAt = this.t + BOSS_ROUND.interlude;
    this.nextGate = this.t + 2;
    this.chestAt.push(this.t + 6); // 每多打一轮送一个宝箱
    if (this.bossRound >= 3) this.time.delayedCall(10000, () => { if (!this.over && !this.bossSpawned) this.spawnEliteWave(0, 2 + Math.floor(this.stage / 25), 2); });
    this.cameras.main.flash(400, 60, 0, 30);
    this.eventBanner('妖王未灭', `妖气重聚，${BOSS_ROUND.interlude} 秒后第${ROUND_CN[this.bossRound - 1]}轮重生！`, 0x4a0030);
    if (!this.trial) playBgm(this, 'battle' + (this.chapter + 1));
  }
  bossSummon(b) {
    if (this.over) return;
    this.fxDeath.explode(20, ...proj(b.x, b.y).slice(0, 2));
    [-120, 0, 120].forEach(off => {
      const e = this.spawnEnemy();
      e.x = clamp(b.x + off, ROAD_L + 30, ROAD_R - 30); e.y = b.y + 40; e.ranged = false;
      this.placeEnemy(e);
    });
  }
  updateOrbs(dt) {
    const p = this.player;
    for (const o of this.orbs) {
      o.x += o.vx * dt; o.y += o.vy * dt;
      const [sx, sy, s] = proj(o.x, o.y);
      o.s.setPosition(sx, sy - 40 * s).setScale((o.small ? 1.1 : 1.6) * s).setRotation(this.t * 6);
      if (!o.dead && Math.abs(o.x - p.x) < (o.small ? 32 : 38) && Math.abs(o.y - PLAYER_Y) < 40) {
        o.dead = true; this.damagePlayer(o.dmg || 140 * this.enemyDmgMul); this.playFx('fx_explosion', sx, sy - 40, o.small ? 0.7 : 1, 43);
      }
      if (o.y > H + 40) o.dead = true;
    }
    this.orbs = this.orbs.filter(o => { if (o.dead) { o.s.destroy(); return false; } return true; });
  }

  // ───── 功法 ─────
  addSkill(id) {
    const lv = this.skills[id];
    const p = this.player;
    if (lv >= skillMax(id)) {
      addBuff(this.st, 'dmgMul', 10);
      this.floatText(p.x, PLAYER_Y - 170, SKILLS[id].name + ' 已满级 · 攻击+10%', '#ffd36b', 32);
      return;
    }
    this.skills[id] = lv + 1;
    if ((lv + 1 === 5 || lv + 1 === SKILL_MAX) && AWAKEN[id] && id !== 'shield' && this.awSeen) { // Lv5 合而为一、Lv9 圆满：再播一次满版影片
      this.awSeen[id] = false; this.skillT[id] = 0.8;
      this.eventBanner(`${AWAKEN[id].name} · ${lv + 1 === SKILL_MAX ? '圆满' : '极境'}`, lv + 1 === SKILL_MAX ? '三道巨大的终极招式齐发' : '化为一道巨大的终极招式', 0x6a3a00);
      this.cameras.main.flash(300, 255, 220, 120);
    }
    if (lv + 1 === AWAKEN_LV && AWAKEN[id]) { // 觉醒！
      this.skillT[id] = 0.8;
      this.eventBanner(`${SKILLS[id].name} · 觉醒`, `化为「${AWAKEN[id].name}」，每 ${AWAKEN_CD(AWAKEN_LV)} 秒一次全场大招`, 0x6a3a00);
      this.cameras.main.flash(300, 255, 220, 120);
    }
    if (id === 'shield') { this.st.shieldMax = 150 * (lv + 1) * (this.skillMul.shield || 1); this.st.shield = this.st.shieldMax; }
    this.floatText(p.x, PLAYER_Y - 170, `${SKILLS[id].name} Lv.${lv + 1}`, '#ffd36b', 42);
    this.fxGold.explode(30, p.x, PLAYER_Y - 60);
    this.refreshSkillIcons();
  }
  targets() {
    const list = this.enemies.filter(e => e.alive && e.y > 120 && e.y < LINE_Y);
    if (this.boss && this.boss.alive && this.boss.y > 300) list.push(this.boss);
    return list;
  }
  hurtAny(o, v) {
    const hit = this.rollCrit(v);
    if (o === this.boss) this.hurtBoss(hit, o.x, o.y);
    else this.hurtEnemy(o, hit, 0.5);
  }
  aoe(x, y, r, v) {
    for (const e of this.enemies) if (e.alive && (e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.r) ** 2) this.hurtAny(e, v);
    const b = this.boss;
    if (b && b.alive && Math.abs(b.x - x) < r + 110 && Math.abs(b.y - y) < r + 70) this.hurtAny(b, v);
  }
  updateSkills(dt) {
    const sk = this.skills, T = this.skillT, baseAll = this.baseDmg * this.st.dmgMul, p = this.player;
    for (const id in sk) {
      const lv = sk[id];
      if (!lv) continue;
      const base = baseAll * (this.skillMul[id] || 1); // 功法页的永久等级
      T[id] -= dt;
      if (T[id] > 0) continue;
      if (id === 'heal') { T[id] = 5; this.castHeal(lv); continue; }
      if (lv >= AWAKEN_LV) { T[id] = AWAKEN_CD(lv); this.castAwaken(id, base * AWAKEN_MUL(lv), lv); continue; }
      if (id === 'water') {
        sfx(this, 'skill_water', 0.4, 0.3);
        T[id] = 6.5 - lv * 0.6;
        const w = 110 + lv * 30;
        const s = this.add.image(0, 0, 'wave').setDepth(25).setBlendMode(Phaser.BlendModes.ADD);
        this.waves.push({ s, x: p.x, y: PLAYER_Y - 60, w, dmg: base * 3 * lv, hit: new Set() });
      } else if (id === 'thunder') {
        sfx(this, 'skill_thunder', 0.35, 0.3);
        T[id] = 3.2 - lv * 0.3;
        shuffle(this.targets()).slice(0, lv + 1).forEach(o => {
          const [sx, sy, s] = proj(o.x, o.y);
          const bolt = this.playFx('fx_thunder', sx, sy, 1, 43);
          if (bolt) bolt.setOrigin(0.5, 0.95).setRotation(0).setDisplaySize(150 * Math.max(0.5, s), sy + 20);
          this.hurtAny(o, base * 2.5 * (0.6 + lv * 0.4));
        });
      } else if (id === 'fire') {
        sfx(this, 'skill_fire', 0.35, 0.3);
        T[id] = 2.8 - lv * 0.2;
        const list = this.targets();
        if (!list.length) { T[id] = 0.5; continue; }
        const o = list.reduce((a, c) => (c.y > a.y ? c : a), list[0]);
        const tx = o.x, ty = o.y, r = 80 + lv * 14, v = base * 2.2 * (0.6 + lv * 0.45);
        const [ex, ey, es] = proj(tx, ty);
        const ball = this.add.image(p.x, PLAYER_Y - 80, 'fx_fireball').setDepth(36).setBlendMode(Phaser.BlendModes.ADD).setScale(0.28);
        this.tweens.add({ targets: ball, angle: 720, duration: 900 });
        this.tweens.add({
          targets: ball, x: ex, y: ey - 30 * es, scale: 0.28 * Math.max(0.4, es), duration: 260 + (PLAYER_Y - ty) * 0.25, onComplete: () => {
            ball.destroy();
            if (this.over) return;
            this.aoe(tx, ty, r, v);
            this.playFx('fx_explosion', ex, ey - 30 * es, (r / 55) * es, 43);
            sfx(this, 'explode', 0.3, 0.15);
          },
        });
      } else if (id === 'shield') {
        sfx(this, 'skill_shield', 0.4, 0.5);
        T[id] = 9;
        this.st.shieldMax = 150 * lv * (this.skillMul.shield || 1); this.st.shield = this.st.shieldMax;
      } else if (id === 'sword') {
        sfx(this, 'skill_sword', 0.35, 0.3);
        T[id] = 4.5 - lv * 0.4;
        const v = base * 2 * (0.6 + lv * 0.4);
        shuffle(this.targets()).slice(0, 2 + lv * 2).forEach((o, i) => this.dropSword(o.x, o.y, 55, v, i * 50));
      }
    }
    for (const w of this.waves) {
      w.y -= 520 * dt;
      const [sx, sy, s] = proj(w.x, w.y);
      w.s.setPosition(sx, sy - 30 * s).setDisplaySize(w.w * s * 1.2, 110 * s);
      if (w.dragon) w.dragon.setPosition(sx, sy - 60 * s).setScale((w.w * s * 0.95) / w.dragon.width);
      for (const e of this.enemies) {
        if (e.alive && !w.hit.has(e) && Math.abs(e.x - w.x) < w.w / 2 && Math.abs(e.y - w.y) < 45) { w.hit.add(e); if (w.freeze) { this.ultHit(e, w.dmg); if (e.alive) e.stunT = w.freeze; } else this.hurtAny(e, w.dmg); }
      }
      const b = this.boss;
      if (b && b.alive && !w.hit.has(b) && Math.abs(b.y - w.y) < 60 && Math.abs(b.x - w.x) < w.w / 2 + 80) { w.hit.add(b); if (w.freeze) this.ultHit(b, w.dmg); else this.hurtAny(b, w.dmg * 2); }
      if (Math.random() < 0.5) this.fxWater.explode(2, sx + rand(-w.w / 2, w.w / 2) * s, sy - 30 * s);
    }
    this.waves = this.waves.filter(w => { if (w.y < -200) { w.s.destroy(); if (w.dragon) w.dragon.destroy(); return false; } return true; });
  }
  // 回春术：每 5 秒回复 (1 + Lv)% 气血（Lv1 2% … Lv5 6%）
  castHeal(lv) {
    const s = this.st, p = this.player;
    if (s.hp >= s.maxHp) return;
    const v = Math.min(s.maxHp - s.hp, s.maxHp * (0.01 + 0.01 * lv));
    s.hp += v;
    sfx(this, 'buff', 0.25, 0.5);
    if (this.anims.exists('fx_heal')) { const f = this.playFx('fx_heal', p.x, PLAYER_Y + 45, 0.75, 32); if (f) f.setRotation(0).setOrigin(0.5, 0.9); } // docs/20：光圈对准脚下
    else {
      const ring = this.add.image(p.x, PLAYER_Y - 60, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0x5fe08a).setDepth(32).setScale(1).setAlpha(0.9);
      this.tweens.add({ targets: ring, scale: 4, alpha: 0, duration: 600, onComplete: () => ring.destroy() });
    }
    this.floatText(p.x + 60, PLAYER_Y - 140, '+' + fmtNum(Math.round(v)), '#7fff9a', 30);
  }
  // 觉醒大招打到的伤害：妖王只吃 30%
  ultHit(o, v) { if (o === this.boss) { if (o.alive) this.hurtBoss(this.rollCrit(v * 0.3), o.x, o.y); } else if (o.alive) this.hurtEnemy(o, this.rollCrit(v), 0.4); }
  // 觉醒动画：有 fx_aw_* 序列帧（docs/17）就播全屏版，没有就用原本的特效放大代替
  awakenFx(id, x, y, scale) {
    const k = AWAKEN[id].fx;
    if (this.anims.exists(k)) {
      // 画面先暗下来：发光特效在第一章的白云背景上会被吃掉，暗底才凸显得出来
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 1).setDepth(43.5).setAlpha(0);
      this.tweens.add({ targets: dim, alpha: 0.5, duration: 250, hold: 1700, yoyo: true, onComplete: () => dim.destroy() });
      const f = this.playFx(k, x, y, scale, 44); if (f) f.setRotation(0);
      return true;
    }
    return false;
  }
  // 觉醒招式：满版影片只在「刚觉醒」那一次播；之后每次用贴着桥面的攻击动画（fx_atk_*，docs/18），没有就用原本的特效
  atkSprite(key, x, y, depth = 43) {
    const sp = this.add.sprite(x, y, key).setBlendMode(Phaser.BlendModes.ADD).setDepth(depth);
    sp.play(key);
    if (!this.anims.get(key).repeat) sp.once('animationcomplete', () => sp.destroy());
    return sp;
  }
  castAwaken(id, v, lv) {
    const p = this.player, list = this.targets();
    const n = awakenCount(lv), giant = lv >= 5;
    this.awSeen = this.awSeen || {};
    const first = !this.awSeen[id]; this.awSeen[id] = true;
    const big = first && this.awakenFx(id, id === 'shield' ? p.x : W / 2, id === 'shield' ? PLAYER_Y - 400 : 640, id === 'shield' ? 1.5 : 2.0);
    const lead = big ? [0, 600, 1300, 0, 1600][['water', 'thunder', 'fire', 'shield', 'sword'].indexOf(id)] : 0; // 第一次：对准影片最猛的那一刻
    this.cameras.main.shake(big ? 220 : 90, big ? 0.006 : 0.003);
    if (id === 'water') { // 苍龙出海：冰龙沿着桥往上冲，整条路宽、沿路冰冻
      sfx(this, 'skill_water', 0.5, 0);
      const lw = giant ? ROAD_R - ROAD_L : (ROAD_R - ROAD_L) / n; // 小的并排盖满路；巨大的每只都是整条路宽，一只接一只
      for (let i = 0; i < n; i++) this.time.delayedCall((big ? 500 : 0) + i * (giant ? 380 : 70), () => {
        if (this.over) return;
        const s = this.add.image(0, 0, 'wave').setDepth(25).setBlendMode(Phaser.BlendModes.ADD).setTint(0x9fe8ff);
        const w = { s, x: giant ? ROAD_MID : ROAD_L + lw * (i + 0.5), y: PLAYER_Y - 40, w: lw, dmg: v * (giant ? 1.5 : 1), hit: new Set(), freeze: giant ? 2 : 1.2 };
        if (this.anims.exists('fx_atk_water')) { w.dragon = this.atkSprite('fx_atk_water', 0, 0, 26); s.setAlpha(0.45); }
        this.waves.push(w);
      });
    } else if (id === 'thunder') { // 九天雷劫：6 道雷依序劈在妖兽身上
      sfx(this, 'skill_thunder', 0.5, 0);
      const nb = n;
      const spots = giant ? this.masterTarget(n) : shuffle(list.slice()); // 巨雷劈在最密的几处
      while (spots.length < nb) spots.push({ x: rand(ROAD_L + 30, ROAD_R - 30), y: rand(200, LINE_Y - 100), empty: true });
      spots.slice(0, nb).forEach((o, i) => this.time.delayedCall(lead + i * (giant ? 260 : 110), () => {
        if (this.over) return;
        const [sx, sy, s] = proj(o.x, o.y);
        const gk = giant ? 2.4 : 1; // Lv5 巨雷
        if (this.anims.exists('fx_atk_thunder')) {
          const sp = this.atkSprite('fx_atk_thunder', sx, sy).setOrigin(0.5, 0.92);
          sp.setScale(Math.max(0.45, s) * 520 * gk / sp.height);
        } else {
          const bolt = this.playFx('fx_thunder', sx, sy, 1, 43);
          if (bolt) bolt.setOrigin(0.5, 0.95).setRotation(0).setDisplaySize(260 * gk * Math.max(0.5, s), sy + 20);
        }
        if (!o.empty) this.ultHit(o, v * gk);
        this.aoe(o.x, o.y, giant ? 280 : 90, v * (giant ? 1.2 : 0.5));
        if (giant) this.cameras.main.shake(260, 0.01);
      }));
    } else if (id === 'fire') { // 朱雀焚天：三只火凤从主角飞出，俯冲到最密的三处炸开
      sfx(this, 'skill_fire', 0.5, 0);
      this.masterTarget(n).forEach((o, i) => this.time.delayedCall(lead + i * 140, () => {
        if (this.over) return;
        const [ex, ey, es] = proj(o.x, o.y);
        const boom = () => {
          if (this.over) return;
          this.aoe(o.x, o.y, giant ? 300 : 170, v * (giant ? 1.5 : 1));
          const bk = giant ? 2.2 : 1;
          if (this.anims.exists('fx_atk_fire_boom')) { const b = this.atkSprite('fx_atk_fire_boom', ex, ey - 20 * es).setOrigin(0.5, 0.75); b.setScale(Math.max(0.4, es) * 460 * bk / b.height); }
          else this.playFx('fx_explosion', ex, ey - 30 * es, (3.2 * es + 0.4) * bk, 43);
          if (giant) this.cameras.main.shake(300, 0.012);
          sfx(this, 'explode', 0.4, 0);
        };
        if (big || !this.anims.exists('fx_atk_fire')) { boom(); return; }
        const bird = this.atkSprite('fx_atk_fire', p.x, PLAYER_Y - 80, 36);
        const k0 = (giant ? 560 : 260) / bird.height;
        bird.setScale(k0);
        this.tweens.add({ targets: bird, x: ex, y: ey - 40 * es, scale: k0 * Math.max(0.35, es), duration: 380 + (PLAYER_Y - o.y) * 0.25, ease: 'Quad.easeIn', onComplete: () => { bird.destroy(); boom(); } });
      }));
    } else if (id === 'shield') { // 玄武真身：大护盾＋把身边的妖兽震开
      sfx(this, 'skill_shield', 0.5, 0);
      if (!big) this.fxGold.explode(30, p.x, PLAYER_Y - 60);
      this.st.shieldMax = Math.max(this.st.shieldMax, this.st.maxHp * (0.25 + 0.05 * (lv - AWAKEN_LV))); this.st.shield = this.st.shieldMax; // Lv3 25% → Lv9 55%
      const reach = 420 + 40 * (lv - AWAKEN_LV);
      for (const e of this.enemies) if (e.alive && e.y > LINE_Y - reach) { this.ultHit(e, v * 0.6); if (e.alive) { e.y -= 160; e.stunT = 0.6 + 0.1 * (lv - AWAKEN_LV); } }
    } else if (id === 'sword') { // 诛仙剑阵：三处地上亮起剑阵，各落 8 把剑
      sfx(this, 'skill_sword', 0.5, 0);
      const spots = giant ? [[[ROAD_MID, 560]], [[ROAD_MID, 400], [ROAD_MID, 760]], [[ROAD_MID, 320], [ROAD_MID, 560], [ROAD_MID, 800]]][n - 1] : this.masterTarget(n).map(o => [o.x, o.y]);
      while (spots.length < n) spots.push([rand(ROAD_L + 60, ROAD_R - 60), rand(250, LINE_Y - 150)]);
      const per = giant ? 24 : n >= 4 ? 6 : 8; // 剑阵多的时候每个少落几把；巨阵每个落 24 把
      spots.forEach(([cx, cy], k) => this.time.delayedCall(lead + k * (giant ? 300 : 150), () => {
        if (this.over) return;
        const [sx, sy, s] = proj(cx, cy);
        if (this.anims.exists('fx_atk_sword')) { // 地上的剑阵：压扁成椭圆贴在桥面
          const r = this.atkSprite('fx_atk_sword', sx, sy, 24).setRotation(0);
          const k1 = (giant ? 1000 : 300) * Math.max(0.4, s) / r.width;
          r.setScale(k1, k1 * 0.45);
        }
        for (let i = 0; i < per; i++) {
          const a = i / per * Math.PI * 2;
          if (giant) this.dropSword(rand(ROAD_L + 30, ROAD_R - 30), clamp(cy + rand(-200, 200), 150, LINE_Y - 80), 90, v * 0.7, 250 + i * 30);
          else this.dropSword(cx + Math.cos(a) * 70, cy + Math.sin(a) * 40, 80, v * 0.6, 250 + i * 40);
        }
      }));
    }
  }
  dropSword(x, y, r, v, delay) {
    const [sx, sy, s] = proj(x, y);
    const sw = this.add.image(sx, sy - 320 * s, 'fx_flying_sword').setOrigin(0.5, 0.95).setDepth(37).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);
    sw.setScale(150 / sw.height * Math.max(0.45, s));
    this.tweens.add({
      targets: sw, y: sy, alpha: 1, duration: 220, delay, ease: 'Cubic.easeIn', onComplete: () => {
        if (!this.over) { this.aoe(x, y, r, v); this.playFx('fx_hit', sx, sy - 10, 0.9 * s + 0.2); }
        this.tweens.add({ targets: sw, alpha: 0, duration: 220, onComplete: () => sw.destroy() });
      },
    });
  }

  // ───── 大招：万剑归宗 ─────
  pickupFx() {
    if (!this.anims.exists('fx_pickup')) return;
    const f = this.playFx('fx_pickup', this.player.x, PLAYER_Y + 10, 1.2, 32);
    if (f) f.setOrigin(0.5, 0.9).setRotation(0);
  }

  castUlt() {
    if (this.paused || this.over || this.energy < CFG.energyMax) return;
    sfx(this, 'ult_shout', 0.7, 0);
    this.time.delayedCall(500, () => sfx(this, 'ult', 0.7, 0));
    this.energy = 0;
    const base = this.baseDmg * this.st.dmgMul;
    // 特写：画面压暗、主角从右边切入、字幕，之后才降剑雨
    const lead = this.textures.exists('hero_ult_cutin') ? 650 : 0;
    if (lead) {
      const dim = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(140);
      const band = this.add.rectangle(W / 2, 520, W + 40, 430, 0x1a0e02, 0).setDepth(141).setAngle(-6);
      const cut = this.add.image(W + 400, 520, 'hero_ult_cutin').setDepth(142);
      cut.setScale(560 / cut.height);
      this.tweens.add({ targets: dim, fillAlpha: 0.55, duration: 150, yoyo: true, hold: lead, onComplete: () => dim.destroy() });
      this.tweens.add({ targets: band, fillAlpha: 0.8, duration: 150, yoyo: true, hold: lead, onComplete: () => band.destroy() });
      this.tweens.add({ targets: cut, x: W / 2 + 40, duration: 220, ease: 'Cubic.easeOut' });
      this.tweens.add({ targets: cut, x: W / 2 - 20, duration: lead, delay: 220 });
      this.tweens.add({ targets: cut, x: -500, alpha: 0, duration: 200, delay: 220 + lead, ease: 'Cubic.easeIn', onComplete: () => cut.destroy() });
    }
    const t = txt(this, W / 2, 760, '万剑归宗', 100, '#ffe08a').setDepth(150).setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 200, delay: lead ? 200 : 0, ease: 'Back.easeOut', hold: 500 + lead * 0.5, yoyo: true, onComplete: () => t.destroy() });
    this.time.delayedCall(lead, () => {
      if (this.over) return;
      this.cameras.main.flash(250, 255, 240, 200);
      for (let i = 0; i < 44; i++) this.dropSword(rand(ROAD_L + 20, ROAD_R - 20), rand(-200, LINE_Y - 60), 70, base * 6, i * 16);
    });
    this.time.delayedCall(520 + lead, () => {
      if (this.over) return;
      this.enemies.forEach(e => { if (e.alive && e.y > -100) this.hurtAny(e, base * 20); });
      if (this.boss && this.boss.alive && this.boss.y > 0) this.hurtAny(this.boss, base * 60);
      this.cameras.main.shake(250, 0.01);
    });
  }

  // ───── 特效与数字 ─────
  drawFx() {
    const g = this.fxG;
    g.clear();
    for (const e of this.enemies) {
      if (!e.alive || (!e.elite && e.key !== 'brute' && e.key !== 'rogue' && e.key !== 'golem' && e.key !== 'treant') || e.hp >= e.maxHp) continue;
      const [sx, sy, s] = proj(e.x, e.y);
      const zs = Math.pow(s, CFG.enemyPersp), bw = 80 * zs * (e.elite ? 1.4 : 1), by = sy - e.type.h * CFG.enemyScale * zs * (e.elite ? 1.35 : 1) - 8;
      g.fillStyle(0x000000, 0.6).fillRect(sx - bw / 2, by, bw, 6 * Math.max(0.6, s));
      g.fillStyle(0xff4040).fillRect(sx - bw / 2, by, bw * e.hp / e.maxHp, 6 * Math.max(0.6, s));
    }
  }
  showNum(x, y, v, crit, s = 1) {
    const mode = store.get('opt_num', 2); // 设置：2 全部、1 只显示暴击、0 关
    if (mode === 0 || (mode === 1 && !crit)) return;
    const t = this.nums[this.numIdx = (this.numIdx + 1) % this.nums.length];
    this.tweens.killTweensOf(t);
    const k = 0.6 + 0.4 * s;
    if (crit === 2) { this.showSuperNum(x, y, v, k); return; }
    if (this.bmpNum) { // 书法数字：一般金色、暴击火红并加「!」，先弹大再缩回
      const base = (crit ? 0.5 : 0.3) * k;
      t.setFont(crit && this.cache.bitmapFont.exists('font_crit') ? 'font_crit' : 'font_gold').setText(Math.round(v) + (crit ? '!' : '')).clearTint()
        .setPosition(x + rand(-12, 12), y).setVisible(true).setAlpha(1).setScale(base * 1.6);
      this.tweens.add({ targets: t, scale: base, duration: 120, ease: 'Back.easeOut' });
      this.tweens.add({ targets: t, y: y - 70 * k, alpha: 0, delay: crit ? 380 : 200, duration: crit ? 420 : 340, ease: 'Cubic.easeIn', onComplete: () => t.setVisible(false) });
      return;
    }
    t.setText((crit ? '暴击 ' : '') + Math.round(v)).setPosition(x + rand(-10, 10), y).setVisible(true).setAlpha(1)
      .setColor(crit ? '#ff9a2a' : '#ffe28a').setFontSize(crit ? 34 : 24).setScale((crit ? 1.3 : 1) * k);
    this.tweens.add({ targets: t, y: y - 60 * k, alpha: 0, scale: k, duration: crit ? 700 : 500, ease: 'Cubic.easeOut', onComplete: () => t.setVisible(false) });
  }
  // 天罡暴击：钻石数字（没有素材就用暴击数字染紫）、背后爆光、小震、停留较久
  showSuperNum(x, y, v, k) {
    sfx(this, 'super', 0.6, 0.1); sfx(this, 'super2', 0.3, 0.1);
    const has = this.cache.bitmapFont.exists('font_super'), font = has ? 'font_super' : (this.cache.bitmapFont.exists('font_gold') ? 'font_gold' : null);
    const yy = y - 20, base = 0.62 * k;
    const flare = this.add.image(x, yy, 'rays').setBlendMode(Phaser.BlendModes.ADD).setTint(0xbfe8ff).setDepth(46).setScale(0.1).setAlpha(0.9);
    this.tweens.add({ targets: flare, scale: 0.55, angle: 90, alpha: 0, duration: 650, onComplete: () => flare.destroy() });
    const tag = this.textures.exists('title_supercrit') // 有标题字图就用图
      ? this.add.image(x, yy - 56 * k, 'title_supercrit').setDepth(47).setScale(46 * k / 128)
      : txt(this, x, yy - 52 * k, '天罡暴击', Math.round(26 * k + 4), '#c8f0ff').setDepth(47);
    if (tag.type === 'Image') { tag.setScale(78 * k / tag.height); tag.y = yy - 70 * k; }
    let t;
    const str = Math.round(v) + (has ? '!' : '');
    if (font) {
      // 钻石是半透明的：后面垫一层深色描边＋蓝光，放在亮的桥面上才看得清楚
      const sp = has ? -4 : -24;
      const back = this.add.container(x, yy).setDepth(46.5);
      [[0, 6, 0.85], [-4, 0, 0.95], [4, 0, 0.95], [0, -4, 0.95], [0, 4, 0.95]].forEach(([dx, dy, a]) =>
        back.add(this.add.bitmapText(dx, dy, font, str, 96).setOrigin(0.5).setLetterSpacing(sp).setTintFill(0x061020).setAlpha(a)));
      t = this.add.bitmapText(x, yy, font, str, 96).setOrigin(0.5).setLetterSpacing(sp).setDepth(47);
      if (t.preFX) t.preFX.addGlow(0x9fe4ff, 4, 0, false, 0.1, 10);
      if (!has) t.setTint(0xeaf8ff, 0xeaf8ff, 0x9fd8ff, 0x9fd8ff); // 还没有钻石数字：金色数字染成冰蓝
      t.back = back;
    } else t = txt(this, x, yy, Math.round(v) + '!', 46, '#e0b0ff').setDepth(47);
    const sc = font ? base : 1;
    const parts = t.back ? [t, t.back] : [t];
    parts.forEach(o => o.setScale(sc * 2.2));
    this.tweens.add({ targets: parts, scale: sc, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [...parts, tag], y: '-=80', alpha: 0, delay: 650, duration: 450, ease: 'Cubic.easeIn', onComplete: () => { parts.forEach(o => o.destroy()); tag.destroy(); } });
    this.cameras.main.shake(90, 0.004);
  }

  floatText(x, y, s, color, size) {
    const t = txt(this, x, y, s, size, color).setDepth(140);
    this.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 1200, ease: 'Cubic.easeOut', onComplete: () => t.destroy() });
  }

  // ───── HUD ─────
  buildHud() {
    const D = 101;
    if (this.textures.exists('ui_pause')) {
      const pb = this.add.image(50, 50, 'ui_pause').setDepth(D);
      pb.setScale(84 / pb.height);
    } else {
      const pause = this.add.graphics().setDepth(D);
      pause.fillStyle(0x1a2238, 0.9).fillCircle(50, 50, 36).lineStyle(3, 0xd9b45a).strokeCircle(50, 50, 36);
      pause.fillStyle(0xffe7a3).fillRect(38, 34, 8, 32).fillRect(54, 34, 8, 32);
    }
    this.hpFrame = this.textures.exists('ui_hpbar');
    if (this.hpFrame) {
      const hf = this.add.image(215, 1183, 'ui_hpbar').setDepth(D + 0.5);
      hf.setScale(430 / hf.width);
      // 框里空槽实测：宽 28%~91.5%、高 27%~72%（右端收窄）→ 往内缩一点，血才不会超出框
      const L = 215 - hf.displayWidth / 2, T = 1183 - hf.displayHeight / 2;
      this.hpInner = { x: L + hf.displayWidth * 0.29, w: hf.displayWidth * 0.6, y: T + hf.displayHeight * 0.35, h: hf.displayHeight * 0.3 };
    }
    this.hpG = this.add.graphics().setDepth(D + 0.7); // 血要画在框的上层，不然会被框盖住
    this.hpShown = 1; this.hpTrail = 1;
    this.hTitle = txt(this, W / 2, 42, this.endless ? '妖兽来袭' : this.trial ? '宗门试炼' : this.secret ? '秘境寻宝' : `第 ${this.stage} 关${diffLabel(this.diff)}`, 38, '#ffe7a3').setDepth(D);
    this.hTimer = txt(this, W / 2, 128, '', 26, '#ffffff').setDepth(D);
    this.hKills = txt(this, W - 24, 42, '', 26, '#ffffff', 1).setDepth(D);
    this.hFps = txt(this, 20, 100, '', 16, '#55607a', 0).setDepth(D);
    this.hCombo = this.cache.bitmapFont.exists('font_gold')
      ? this.add.bitmapText(W - 24, 330, 'font_gold', '', 96).setOrigin(1, 0.5).setLetterSpacing(-24).setScale(0.9).setDepth(D)
      : txt(this, W - 30, 330, '', 68, '#ffd36b', 1).setDepth(D);
    this.hComboSub = this.textures.exists('w_combo')
      ? this.add.image(W - 24, 402, 'w_combo').setOrigin(1, 0.5).setScale(0.5).setDepth(D)
      : txt(this, W - 30, 388, '连斩', 34, '#ff9a4a', 1).setDepth(D);
    this.lastComboShown = 0;
    this.hStats = txt(this, 28, 1132, '', 20, '#ffffff', 0).setDepth(D);
    this.hHp = this.add.text(this.hpFrame ? this.hpInner.x + this.hpInner.w / 2 : 215, 1183, '', { fontFamily: FONT_L, fontSize: '18px', color: '#fff6e0', padding: { x: 2, y: 2 } })
      .setOrigin(0.5).setShadow(0, 1, '#000000', 3, false, true).setDepth(D + 1);
    this.hEnergy = txt(this, 28, 1218, '修为', 20, '#cfe2ff', 0).setDepth(D + 1);
    this.hUltIcon = this.add.image(640, 1190, 'icon_split').setDepth(D + 1);
    this.ultBase = 96 / this.hUltIcon.height;
    const frame = this.add.image(640, 1190, 'ui_skill_button').setDepth(D + 2);
    frame.setScale(150 / frame.height);
    this.hBoss = txt(this, W / 2, 168, '', 22, '#ffffff').setDepth(D + 1);
    this.skillIcons = this.add.container(0, 0).setDepth(D);
    this.refreshSkillIcons();
  }
  refreshSkillIcons() {
    const c = this.skillIcons;
    c.removeAll(true);
    let i = 0;
    for (const id in this.skills) {
      const lv = this.skills[id];
      if (!lv) continue;
      const x = 52 + i * 64, y = 1078;
      const ic = this.add.image(x, y, SKILLS[id].icon);
      ic.setScale(54 / ic.height);
      c.add([ic, txt(this, x, y + 32, 'Lv' + lv, 16, '#ffe7a3')]);
      i++;
    }
  }
  drawHud() {
    const g = this.hudG, s = this.st;
    g.clear();
    const pw = 380, px = W / 2 - pw / 2, py = 82;
    const prog = this.endless ? (this.kills % 100) / 100 : Math.min(1, this.t / (this.trial || this.secret ? EVENT_TIME : CFG.stageLen));
    g.fillStyle(0x0d1220, 0.85).fillRoundedRect(px - 4, py - 4, pw + 8, 20, 10);
    g.fillStyle(0x3fa0ff).fillRoundedRect(px, py, Math.max(12, pw * prog), 12, 6);
    g.fillStyle(0xb0182a).fillCircle(px + pw + 22, py + 6, 18).lineStyle(3, 0xffd36b).strokeCircle(px + pw + 22, py + 6, 18);
    if (this.boss) {
      const b = this.boss;
      g.fillStyle(0x0d1220, 0.9).fillRoundedRect(110, 152, W - 220, 30, 8);
      g.fillStyle(0xd0202e).fillRoundedRect(114, 156, Math.max(1, (W - 228) * b.hp / b.maxHp), 22, 6);
      this.hBoss.setText(this.trial ? `${this.bossName}　伤害 ${fmtNum(this.trialDmg)}` : `${this.bossName}  ` + Math.ceil(Math.max(0, b.hp)).toLocaleString());
      this.hTimer.setText(this.trial ? '剩余 ' + fmtTime(EVENT_TIME - this.t) : '');
    } else {
      this.hTimer.setText(this.secret ? `秘境 ${fmtTime(EVENT_TIME - this.t)}　宝箱 ${this.chestsGot || 0}` : this.endless ? `坚持 ${fmtTime(this.t)}　第 ${(this.wave || 0) + 1} 波　≈${DIFFS[Math.floor(((this.eq || this.G) - 1) / STAGE_MAX)].name}第 ${((this.eq || this.G) - 1) % STAGE_MAX + 1} 关　${this.kills > this.bestKills ? '新纪录！' : '最佳 ' + this.bestKills}` : this.reviveAt ? `妖王重生 ${fmtTime(this.reviveAt - this.t)}　第${ROUND_CN[this.bossRound - 1]}轮 / 共${this.bossRounds}轮` : '妖兽潮 ' + fmtTime(CFG.stageLen - this.t) + (this.bossRounds > 1 ? `　妖王 ×${this.bossRounds} 轮` : ''));
      this.hBoss.setText('');
    }
    this.hKills.setText('击杀 ' + this.kills);
    this.hFps.setText(Math.round(this.game.loop.actualFps) + ' fps · 怪 ' + this.enemies.filter(e => e.alive).length);
    const showCombo = this.combo >= 10;
    this.hCombo.setVisible(showCombo).setText(this.combo);
    this.hComboSub.setVisible(showCombo);
    if (showCombo && this.combo !== this.lastComboShown && this.combo % 10 === 0) { // 每 10 连斩跳一下
      const base = this.hCombo.type === 'BitmapText' ? 0.9 : 1;
      this.tweens.killTweensOf(this.hCombo);
      this.hCombo.setScale(base * 1.35);
      this.tweens.add({ targets: this.hCombo, scale: base, duration: 220, ease: 'Back.easeOut' });
    }
    this.lastComboShown = this.combo;
    this.hStats.setText(`剑气×${s.multi}   攻速 ${Math.round(s.rateMul * 100)}%   攻击 ${Math.round(s.dmgMul * 100)}%   分身 ${s.clones}   暴击 ${Math.round(s.crit * 100)}%` + (s.moveMul < 1 ? `   身法 ${Math.round(s.moveMul * 100)}%` : ''));
    // 气血条：红色＝目前血量，白色＝刚掉的血（慢慢缩回），绿色细条＝护盾；低于 30% 会闪
    const hg = this.hpG, pct = Math.max(0, s.hp / s.maxHp);
    const dt = this.frameDt || 0.016;
    this.hpShown += (pct - this.hpShown) * Math.min(1, dt * 18);
    if (this.hpTrail < this.hpShown) this.hpTrail = this.hpShown;
    else this.hpTrail = Math.max(this.hpShown, this.hpTrail - dt * 0.35);
    const r = this.hpFrame ? this.hpInner : { x: 28, y: 1170, w: 378, h: 26 };
    hg.clear();
    if (!this.hpFrame) hg.fillStyle(0x0d1220, 0.9).fillRoundedRect(24, 1166, 386, 34, 10);
    const rad = Math.min(4, r.h / 3);
    const bar = (frac, fn) => { if (frac > 0.003) fn(r.w * Math.min(1, frac)); };
    hg.fillStyle(0x12040a, 1).fillRoundedRect(r.x, r.y, r.w, r.h, rad);
    bar(this.hpTrail, w => hg.fillStyle(0xffe6b0, 0.75).fillRoundedRect(r.x, r.y, w, r.h, rad)); // 刚掉的血
    const low = pct < 0.3, blink = low ? 0.5 + 0.5 * Math.sin(this.time.now / 90) : 0;
    bar(this.hpShown, w => {
      hg.fillGradientStyle(0xff6a5a, 0xff6a5a, 0x9a0f1c, 0x9a0f1c, 1).fillRoundedRect(r.x, r.y, w, r.h, rad);
      hg.fillStyle(0xffffff, 0.28).fillRect(r.x + 1, r.y + 1, w - 2, Math.max(1, r.h * 0.28)); // 上缘光泽
      hg.fillStyle(0x000000, 0.25).fillRect(r.x + 1, r.y + r.h * 0.75, w - 2, r.h * 0.25 - 1);  // 下缘阴影
      hg.fillStyle(0xfff2c8, 0.9).fillRect(r.x + w - 2, r.y + 1, 2, r.h - 2);                  // 血头亮线
      if (low) hg.fillStyle(0xff2020, 0.35 * blink).fillRoundedRect(r.x, r.y, w, r.h, rad);
    });
    hg.fillStyle(0x000000, 0.35); // 刻度：每 10%
    for (let i = 1; i < 10; i++) hg.fillRect(r.x + r.w * i / 10, r.y + 2, 1, r.h - 4);
    hg.lineStyle(1, 0x000000, 0.6).strokeRoundedRect(r.x, r.y, r.w, r.h, rad);
    if (s.shield > 0) hg.fillStyle(0x7fffd0, 0.95).fillRect(r.x, r.y - 3, r.w * Math.min(1, s.shield / s.maxHp), 3);
    this.hHp.setText(`${Math.ceil(s.hp)} / ${s.maxHp}`);
    const full = this.energy >= CFG.energyMax;
    g.fillStyle(0x0d1220, 0.9).fillRoundedRect(80, 1210, 330, 18, 8);
    if (this.energy > 0) g.fillStyle(full ? 0xffd04a : 0x4aa8ff).fillRoundedRect(83, 1213, Math.max(8, 324 * this.energy / CFG.energyMax), 12, 6);
    // 大招钮：外圈能量
    g.fillStyle(0x0d1220, 0.95).fillCircle(640, 1190, 62);
    if (this.energy > 0) {
      g.fillStyle(full ? 0xffd04a : 0x4aa8ff, 0.9);
      g.beginPath(); g.slice(640, 1190, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * this.energy / CFG.energyMax, false); g.fillPath();
    }
    this.hUltIcon.setAlpha(full ? 1 : 0.45).setScale(this.ultBase * (full ? 1 + 0.05 * Math.sin(this.time.now / 120) : 1));
  }

  // ───── 弹窗 ─────
  openOverlay(h = 900, titleKey = null, titleY = 0) {
    this.paused = true; this.drag = null;
    const c = this.add.container(0, 0).setDepth(200);
    c.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive());
    if (this.textures.exists('ui_popup')) {
      c.add(this.add.image(W / 2, H / 2, 'ui_popup').setDisplaySize(W - 24, h + 110));
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x1a2238, 0.97).fillRoundedRect(40, H / 2 - h / 2, W - 80, h, 24);
      g.lineStyle(4, 0xd9b45a).strokeRoundedRect(40, H / 2 - h / 2, W - 80, h, 24);
      c.add(g);
    }
    if (titleKey) {
      const t = this.add.image(W / 2, titleY, titleKey);
      t.setScale(Math.min(150 / t.height, 560 / t.width));
      c.add(t);
    }
    this.overlay = c;
    return c;
  }
  closeOverlay() {
    if (this.overlay) this.overlay.destroy();
    this.overlay = null; this.choiceCbs = null; this.paused = false;
  }
  skillRow(c, y) {
    let i = 0;
    for (const id in this.skills) {
      const lv = this.skills[id];
      if (!lv) continue;
      const x = 130 + i * 115;
      const ic = this.add.image(x, y, SKILLS[id].icon);
      ic.setScale(88 / ic.height);
      c.add([ic, txt(this, x, y + 56, 'Lv.' + lv, 18, '#ffe7a3'), txt(this, x, y + 84, SKILLS[id].name, 20, '#dfe6f2')]);
      i++;
    }
    if (!i) c.add(txt(this, W / 2, y, '尚未习得功法', 26, '#8892a6'));
  }
  showPause() {
    if (this.over || this.paused) return;
    const top = H / 2 - 480;
    const c = this.openOverlay(960, 'title_pause', top + 50);
    c.add(txt(this, W / 2, top + 160, '— 本局功法 —', 28, '#cfe2ff'));
    this.skillRow(c, top + 250);
    c.add(txt(this, W / 2, top + 400, '— 本局数据 —', 28, '#cfe2ff'));
    c.add(txt(this, W / 2, top + 460, `击杀 ${this.kills}    时间 ${fmtTime(this.t)}    最高连斩 ${this.maxCombo}`, 26));
    audioRow(this, c, top + 530, 'music');
    audioRow(this, c, top + 600, 'sfx');
    c.add(button(this, W / 2, top + 700, 380, 90, '继续战斗', 0xc98a1a, () => this.closeOverlay(), 36));
    c.add(button(this, W / 2, top + 800, 380, 76, '重新开始', 0x2a5bb8, () => this.scene.restart({ stage: this.stage, diff: this.diff }), 30));
    c.add(button(this, W / 2, top + 895, 380, 76, this.event ? '返回' : '返回地图', 0xa8263a, () => this.scene.start(this.trial ? 'sect' : this.event ? 'events' : 'stagemap'), 30));
  }
  showChoice() {
    if (this.over) return;
    const opts = [];
    for (const id in SKILLS) {
      const lv = this.skills[id];
      if (lv < skillMax(id)) opts.push({ name: SKILLS[id].name, desc: SKILLS[id].desc, lv, rarity: lv === 0 ? 2 : 3, icon: SKILLS[id].icon, apply: () => this.addSkill(id) });
    }
    STAT_PICKS.forEach(sp => {
      if (sp.id === 'clone' && this.st.clones >= 4) return;
      opts.push({ name: sp.name, desc: sp.desc, rarity: sp.rarity, icon: sp.icon, apply: () => sp.apply(this) });
    });
    const three = shuffle(opts).slice(0, 3);
    const top = H / 2 - 410;
    const c = this.openOverlay(820, 'title_choice', top + 60);
    c.add(txt(this, W / 2, top + 140, '按 1 / 2 / 3 或点选', 22, '#8892a6'));
    this.choiceCbs = three.map((o, i) => {
      const x = W / 2 + (i - 1) * 184, y = top + 420, cw = 166, ch = 380;
      const card = this.add.container(x, y + 60).setAlpha(0).setScale(0.85);
      const col = RARITY_COLOR[o.rarity];
      const sh = this.add.graphics(); // 卡片投影
      sh.fillStyle(0x000000, 0.55).fillRoundedRect(-cw / 2 + 6, -ch / 2 + 12, cw, ch, 18);
      const g = this.add.graphics();
      g.fillGradientStyle(0x1e2a44, 0x1e2a44, 0x0a0f1a, 0x0a0f1a, 1).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 18);
      g.lineStyle(4, col).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 18).lineStyle(1, 0xffffff, 0.25).strokeRoundedRect(-cw / 2 + 6, -ch / 2 + 6, cw - 12, ch - 12, 14);
      g.fillStyle(col, 0.22).fillRoundedRect(-cw / 2 + 8, -ch / 2 + 8, cw - 16, 150, 12);
      g.fillStyle(col, 0.9).fillRect(-cw / 2 + 20, 24, cw - 40, 2);
      const glow = this.add.image(0, -110, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(col).setScale(2.6).setAlpha(0.5);
      const ic = this.add.image(0, -110, o.icon);
      ic.setScale(104 / ic.height);
      const desc = this.add.text(0, 76, o.desc, { fontFamily: FONT, fontSize: '19px', fontStyle: '700', color: '#e8edf5', align: 'center', lineSpacing: 6, wordWrap: { width: cw - 28, useAdvancedWrap: true } }).setOrigin(0.5, 0.5).setShadow(1, 2, '#000', 3, true, true);
      card.add([sh, g, glow, ic, txt(this, 0, -8, o.name, 30, '#ffe7a3'), desc]);
      if (o.lv !== undefined) card.add(txt(this, 0, 150, o.lv === 0 ? '新功法' : `Lv.${o.lv} → ${o.lv + 1}`, 22, o.lv === 0 ? '#7fe08a' : '#ffd36b'));
      this.tweens.add({ targets: card, y, alpha: 1, scale: 1, delay: 120 + i * 110, duration: 260, ease: 'Back.easeOut' });
      this.tweens.add({ targets: glow, alpha: 0.85, scale: 3, duration: 900, yoyo: true, repeat: -1 });
      const cb = () => { this.closeOverlay(); o.apply(); };
      card.setSize(cw, ch).setInteractive({ useHandCursor: true }).on('pointerdown', cb);
      card.on('pointerover', () => this.tweens.add({ targets: card, scale: 1.06, y: y - 10, duration: 120 }))
        .on('pointerout', () => this.tweens.add({ targets: card, scale: 1, y, duration: 120 }));
      c.add(card);
      return cb;
    });
    c.add(txt(this, W / 2, top + 670, '— 已习得功法 —', 22, '#cfe2ff'));
    const owned = Object.keys(this.skills).filter(k => this.skills[k]);
    if (!owned.length) c.add(txt(this, W / 2, top + 730, '尚未习得', 22, '#8892a6'));
    owned.forEach((k, i) => {
      const x = W / 2 + (i - (owned.length - 1) / 2) * 92, y = top + 728;
      const ic = this.add.image(x, y, SKILLS[k].icon);
      ic.setScale(60 / ic.height);
      c.add([ic, txt(this, x, y + 40, 'Lv' + this.skills[k], 16, '#ffe7a3')]);
    });
  }

  // 本局统计写进存档（成就用）＋灵石雨捡到的
  commitStats(pd, win, stars) {
    const S = pd.stats;
    S.kills += this.kills; S.supers += this.stat.supers; S.chests += this.stat.chests; S.bosses += this.stat.bosses;
    if (win) S.wins++;
    if (stars === 3) S.stars3++;
    pd.coin += this.loot.coin; pd.crystal += this.loot.crystal;
  }

  // ───── 宗门试炼／秘境结算 ─────
  finishEvent() {
    this.over = true; this.paused = false;
    const pd = player.get();
    let title, lines, rw, record;
    if (this.trial) {
      const d = Math.round(this.trialDmg || 0), unit = calcStats(pd).atk * 20;
      const score = Math.max(0, Math.round(d / unit)); // 贡献
      rw = { coin: Math.round(d / 15), contrib: score };
      record = d > pd.sect.bestTrial; if (record) pd.sect.bestTrial = d;
      pd.sect.contrib += score; pd.sect.exp += score * 5;
      title = '试炼结束'; lines = [`造成伤害 ${fmtNum(d)}`, record ? '★ 新纪录！' : `最佳 ${fmtNum(pd.sect.bestTrial)}`];
    } else {
      const ch = this.chestsGot || 0;
      rw = { coin: this.kills * 20 + ch * 800, crystal: ch * 12 };
      if (ch >= 6) rw.art = true;
      record = ch > pd.bestSecret; if (record) pd.bestSecret = ch;
      title = '秘境探索完成'; lines = [`开启宝箱 ${ch} 个　击杀 ${this.kills}`, ch >= 6 ? '宝箱 6 个以上：额外获得法宝！' : '开启 6 个宝箱可额外获得法宝'];
    }
    const contrib = rw.contrib; delete rw.contrib;
    const got = grant(pd, rw);
    pd.daily.kills += this.kills;
    this.commitStats(pd, false, 0);
    player.save(pd);
    this.time.delayedCall(400, () => {
      const top = H / 2 - 450;
      const c = this.openOverlay(900, null);
      this.paused = false;
      c.add(txt(this, W / 2, top + 80, title, 66, '#ffd36b'));
      lines.forEach((l, i) => c.add(txt(this, W / 2, top + 180 + i * 60, l, i ? 26 : 36, i ? (record ? '#ff9a4a' : '#aab4c8') : '#ffffff')));
      c.add(txt(this, W / 2, top + 360, '— 获得奖励 —', 24, '#cfe2ff'));
      const show = Object.keys(rw).filter(k => rw[k]);
      if (contrib) show.push('contrib');
      show.forEach((k, i) => {
        const x = W / 2 + (i - (show.length - 1) / 2) * 170, y = top + 450;
        const ic = this.add.image(x, y, k === 'contrib' ? (this.textures.exists('nav2_sect') ? 'nav2_sect' : 'res_scroll') : RW_ICON[k]);
        ic.setScale(64 / ic.height);
        const label = k === 'contrib' ? `贡献 ${contrib}` : k === 'art' ? (got ? ARTIFACTS[got].name : '金币×5000') : '×' + fmtNum(rw[k]);
        c.add([ic, txt(this, x, y + 52, label, 22, '#ffe7a3')]);
      });
      const left = this.trial ? pd.daily.trial : pd.daily.secret;
      c.add(txt(this, W / 2, top + 560, `今日剩余 ${left} 次`, 22, '#aab4c8'));
      c.add(button(this, W / 2 - 150, top + 800, 240, 84, '再来一次', 0x2a5bb8, () => startEvent(this, this.mode), 32));
      c.add(button(this, W / 2 + 150, top + 800, 240, 84, '返回', 0xa8263a, () => this.scene.start(this.trial ? 'sect' : 'events'), 32));
    });
  }

  // ───── 无尽模式结算 ─────
  finishEndless() {
    this.over = true; this.paused = false;
    const pd = player.get();
    const tiers = ENDLESS_TIERS.filter(t => this.kills >= t.kills);
    const rw = { coin: this.kills * 15, crystal: Math.floor(this.kills / 50) * 5 };
    tiers.forEach(t => { for (const k in t.rw) rw[k] = (rw[k] || 0) + t.rw[k]; });
    const got = grant(pd, rw);
    const record = this.kills > pd.bestEndless;
    if (record) pd.bestEndless = this.kills;
    pd.daily.kills += this.kills;
    this.commitStats(pd, false, 0);
    player.save(pd);
    this.time.delayedCall(400, () => {
      const top = H / 2 - 450;
      const c = this.openOverlay(900, null);
      this.paused = false;
      c.add(txt(this, W / 2, top + 80, '妖潮退散', 72, '#ffd36b'));
      c.add(txt(this, W / 2, top + 170, `击杀 ${this.kills}`, 60, '#ffffff'));
      c.add(txt(this, W / 2, top + 240, `坚持 ${fmtTime(this.t)}　最高连斩 ${this.maxCombo}`, 26, '#cfe2ff'));
      c.add(txt(this, W / 2, top + 290, record ? '★ 新纪录！' : `最佳纪录 ${pd.bestEndless} 杀`, 30, record ? '#ff9a4a' : '#aab4c8'));
      c.add(txt(this, W / 2, top + 370, '— 获得奖励 —', 24, '#cfe2ff'));
      Object.keys(rw).filter(k => rw[k]).forEach((k, i, arr) => {
        const x = W / 2 + (i - (arr.length - 1) / 2) * 170, y = top + 450;
        const ic = this.add.image(x, y, RW_ICON[k]);
        ic.setScale(64 / ic.height);
        c.add([ic, txt(this, x, y + 52, k === 'art' ? (got ? ARTIFACTS[got].name : '金币×5000') : '×' + fmtNum(rw[k]), 22, '#ffe7a3')]);
      });
      c.add(txt(this, W / 2, top + 560, `今日剩余挑战 ${pd.daily.endless} 次`, 22, '#aab4c8'));
      c.add(button(this, W / 2 - 150, top + 800, 240, 84, '再来一次', 0x2a5bb8, () => startEndless(this), 32));
      c.add(button(this, W / 2 + 150, top + 800, 240, 84, '返回活动', 0xa8263a, () => this.scene.start('events'), 32));
    });
  }

  // ───── 结算 ─────
  finish(win) {
    if (this.over) return;
    playBgm(this, win && !this.endless ? 'win' : 'lose', false);
    if (this.endless) { this.finishEndless(); return; }
    if (this.trial || this.secret) { this.finishEvent(win); return; }
    this.over = true; this.paused = false;
    const s = this.st;
    const hpPct = s.hp / s.maxHp;
    const fast = this.bossTime <= CFG.bossPar * this.bossRounds;
    const stars = win ? 1 + (hpPct >= 0.5 ? 1 : 0) + (fast ? 1 : 0) : 0;
    const score = Math.round(this.kills * 10 + this.maxCombo * 20 + (win ? hpPct * 3000 + Math.max(0, CFG.bossPar * this.bossRounds - this.bossTime) * 60 : 0));
    const D = this.diff, uk = unlockKey(D), sk = starKey(D);
    const firstClear = win && this.stage >= store.get(uk, 1);
    const big = (1 + 0.5 * (this.bossRounds - 1)) * DIFFS[D].reward; // 多轮 ×1.5／×2…，再乘难度倍率
    const pm = passOn(player.get()) ? 1.2 : 1; // 月卡特权：过关金币、修为 +20%（灵晶不加，避免变相卖游戏币）
    const gain = win ? { crystal: Math.round((10 + (firstClear ? 20 : 0)) * big), coin: Math.round((200 + this.stage * 50 + (firstClear ? 3000 : 0)) * big * pm), xp: Math.round((60 + this.stage * 25) * big * pm) } : { crystal: 0, coin: 50, xp: 20 };
    const pd = player.get(); pd.crystal += gain.crystal; pd.coin += gain.coin; pd.xp += gain.xp;
    pd.daily.kills += this.kills; if (win) pd.daily.wins++;
    let drop = null; // 法宝掉落：首次通关必掉，之后 30%；都有了就换成金币
    if (win && (firstClear || Math.random() < 0.3)) {
      const left = Object.keys(ARTIFACTS).filter(k => pd.arts[k] == null);
      if (left.length) { drop = pick(left); pd.arts[drop] = 0; } else pd.coin += 1000;
    }
    this.commitStats(pd, win, stars);
    player.save(pd);
    if (win) {
      store.set(uk, Math.max(store.get(uk, 1), this.stage + 1));
      const all = store.get(sk, {}); all[this.stage] = Math.max(all[this.stage] || 0, stars); store.set(sk, all);
      if (firstClear && this.stage === STAGE_MAX && D + 1 < DIFFS.length) this.newDiff = D + 1; // 打完第 100 关：开放下一个难度
    }
    const best = store.get('best', {}); const isRecord = score > (best[this.stage] || 0);
    if (isRecord) { best[this.stage] = score; store.set('best', best); }

    this.time.delayedCall(win ? 0 : 400, () => {
      const top = H / 2 - 490;
      const c = this.openOverlay(980, win ? 'title_win' : 'title_lose', top + 80);
      this.paused = false;
      c.add(txt(this, W / 2, top + 170, `第 ${this.stage} 关${diffLabel(D)}${DIFFS[D].reward > 1 ? `　奖励 ×${DIFFS[D].reward}` : ''}`, 30, '#cfe2ff'));
      for (let k = 0; k < 3; k++) { // 星星：一颗颗盖下来
        const st = this.add.image(W / 2 - 90 + k * 90, top + 240, 'node_star');
        const sc = 82 / st.height;
        if (k < stars) {
          st.setScale(sc * 2.2).setAlpha(0);
          this.tweens.add({ targets: st, scale: sc, alpha: 1, delay: 150 + k * 180, duration: 200, ease: 'Back.easeOut' });
        } else st.setScale(sc).setTint(0x333a48).setAlpha(0.7);
        c.add(st);
      }
      const gradeKeys = { 3: ['g_wan', 'g_mei'], 2: ['g_you'], 1: ['g_liang'] }[stars];
      if (gradeKeys && gradeKeys.every(k => this.textures.exists(k))) { // 评价字盖章
        gradeKeys.forEach((k, i) => {
          const im = this.add.image(W / 2 + 150 + i * 70, top + 236, k).setAngle(-12);
          const sc = 76 / im.height;
          im.setScale(sc * 2.5).setAlpha(0);
          this.tweens.add({ targets: im, scale: sc, alpha: 1, delay: 300 + i * 120, duration: 220, ease: 'Back.easeOut', onComplete: () => this.cameras.main.shake(80, 0.004) });
          c.add(im);
        });
      }
      const rows = [
        ['击杀数', this.kills], ['最高连斩', this.maxCombo], ['通关时间', fmtTime(this.t)],
        ['剩余气血', Math.round(hpPct * 100) + '%'], ['获得分数', score.toLocaleString() + (isRecord ? '  新纪录!' : '')],
      ];
      rows.forEach(([k, v], i) => {
        c.add(txt(this, 140, top + 340 + i * 56, k, 28, '#cfe2ff', 0));
        c.add(txt(this, W - 140, top + 340 + i * 56, String(v), 30, i === 4 ? '#ffd36b' : '#ffffff', 1));
      });
      const cond = [['通关', win], ['气血高于 50%', win && hpPct >= 0.5], [bossParText(this.stage), win && fast]];
      cond.forEach(([k, ok], i) => c.add(txt(this, W / 2, top + 628 + i * 30, (ok ? '✔ ' : '✘ ') + k, 24, ok ? '#7fe08a' : '#8892a6')));
      [['res_crystal', gain.crystal], ['res_coin', gain.coin], ['res_stone', gain.xp]].forEach(([k, v], i) => {
        const x = W / 2 - 150 + i * 150, y = top + 775;
        const ic = this.add.image(x - 30, y, k);
        ic.setScale(44 / ic.height);
        c.add([ic, txt(this, x - 2, y, '+' + fmtNum(v), 22, '#ffe7a3', 0)]);
      });
      c.add(txt(this, W / 2, top + 735, firstClear ? '— 首次通关奖励 —' : '— 获得 —', 20, '#cfe2ff'));
      if (drop) {
        const di = this.add.image(W / 2 - 120, top + 830, drop);
        di.setScale(52 / di.height);
        c.add([di, txt(this, W / 2 - 84, top + 830, `获得法宝「${ARTIFACTS[drop].name}」`, 26, '#e0b0ff', 0)]);
      }
      c.add(button(this, W / 2 - 150, top + 905, 240, 84, '再来一次', 0x2a5bb8, () => this.scene.restart({ stage: this.stage, diff: D }), 32));
      if (win && this.stage < STAGE_MAX) c.add(button(this, W / 2 + 150, top + 905, 240, 84, '下一关', 0xc98a1a, () => { store.set('lastStage', this.stage + 1); this.scene.restart({ stage: this.stage + 1, diff: D }); }, 32));
      else c.add(button(this, W / 2 + 150, top + 905, 240, 84, win ? '全部通关！' : '返回地图', 0xa8263a, () => this.scene.start('stagemap'), 32));
      if (this.newDiff) this.time.delayedCall(1200, () => this.showNewDiff(this.newDiff));
    });
  }
}

// ───── 共用：子页面骨架（背景、遮罩、返回、标题、资源列） ─────
function pageFrame(scene, title, bgKey, fallback) {
  scene.cameras.main.fadeIn(250);
  const key = scene.textures.exists(bgKey) ? bgKey : fallback;
  scene.add.image(W / 2, H / 2, key);
  const v = scene.add.graphics();
  v.fillStyle(0x060a14, scene.textures.exists(bgKey) ? 0.25 : 0.55).fillRect(0, 0, W, H);
  v.fillGradientStyle(0x060a14, 0x060a14, 0x060a14, 0x060a14, 0.85, 0.85, 0, 0).fillRect(0, 0, W, 260);
  imgButton(scene, 60, 60, 'ui_back', 86, () => {
    scene.cameras.main.fadeOut(200, 0, 0, 0);
    scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start('home'));
  });
  txt(scene, 120, 60, title, 44, '#ffe7a3', 0);
  resourceBar(scene, 136);
}

// 底部导航：目前所在页亮金色、放大、底下有光；其他页灰蓝色
const NAV_TABS = [['home', '洞府', 'nav_home'], ['cultivate', '修炼', 'nav_cultivate'], ['artifact', '法宝', 'nav_artifact'], ['skills', '功法', 'nav_skill'], ['sect', '宗门', 'nav_sect']];
// 主页的两张活动卡：秘境寻宝去秘境、妖兽来袭去活动页
const NAV_ART = { home: 'home', cultivate: 'cultivate', artifact: 'artifact', skills: 'skill', sect: 'sect' };
const NAV_LIFT = 90; // 有导航列的子页，内容往上移这么多
function navBar(scene, active) {
  const D = 70;
  const v2bar = scene.textures.exists('ui_navbar2');
  const shade = scene.add.graphics().setDepth(D - 0.1); // 底部压暗，导航才不会跟背景糊在一起
  shade.fillGradientStyle(0x05080f, 0x05080f, 0x05080f, 0x05080f, 0, 0, 0.92, 0.92).fillRect(0, 1120, W, 160);
  const nav = scene.add.image(W / 2, v2bar ? 1236 : 1222, v2bar ? 'ui_navbar2' : 'ui_navbar').setDepth(D);
  nav.setScale(W / nav.width, (v2bar ? 92 : 116) / nav.height);
  const v2 = scene.textures.exists('nav2_home');
  NAV_TABS.forEach(([key, label, oldIcon], i) => {
    const x = 72 + i * 144, on = key === active;
    if (on) {
      const gk = scene.textures.exists('ui_navbar2_glow') ? 'ui_navbar2_glow' : scene.textures.exists('ui_navbar_glow') ? 'ui_navbar_glow' : 'glow';
      const gl = scene.add.image(x, gk === 'ui_navbar2_glow' ? 1228 : 1196, gk).setBlendMode(Phaser.BlendModes.ADD).setDepth(D + 0.1);
      gl.setScale(170 / gl.width);
      scene.tweens.add({ targets: gl, alpha: 0.55, duration: 900, yoyo: true, repeat: -1 });
      const bar = scene.add.graphics().setDepth(D + 0.2);
      bar.fillStyle(0xffd36b, 1).fillRoundedRect(x - 30, 1272, 60, 5, 2);
    }
    const icon = v2 ? `nav2_${NAV_ART[key]}${on ? '' : '_off'}` : oldIcon;
    const b = imgButton(scene, x, on ? 1180 : 1188, icon, on ? 96 : 74, () => {
      if (on) return;
      scene.cameras.main.fadeOut(200, 0, 0, 0);
      scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key));
    }).setDepth(D + 0.3);
    if (on) b.setAlpha(1);
    txt(scene, x, 1250, label, on ? 26 : 22, on ? '#ffe7a3' : '#8f9ab0').setDepth(D + 0.4);
  });
}

// 小按钮（程式画，状态可切换）
function smallBtn(scene, x, y, w, h, label, cb) {
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  const t = txt(scene, 0, -2, label, 24, '#3a1a04').setShadow(0, 0, '#000', 0).setStroke('#ffe9b0', 2);
  const img = scene.textures.exists('btn_gold') ? scene.add.image(0, 0, 'btn_gold').setDisplaySize(w * 1.14, h * 1.3) : null;
  c.add(img ? [img, t] : [g, t]).setSize(w, h).setInteractive({ useHandCursor: true });
  c.setOn = on => {
    c.enabled = on;
    if (img) { if (on) img.clearTint(); else img.setTint(0x6a6f7c); t.setColor(on ? '#3a1a04' : '#d0d4dc').setStroke(on ? '#ffe9b0' : '#2a2e38', 2); return; }
    g.clear();
    g.fillStyle(on ? 0xd9a032 : 0x4a5163, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    g.fillStyle(0xffffff, on ? 0.25 : 0.08).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h / 2 - 3, 10);
    g.lineStyle(2, on ? 0xffe7a3 : 0x8892a6, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
    t.setColor(on ? '#3a1a04' : '#c0c6d2');
    c.enabled = on;
  };
  c.on('pointerdown', () => { sfx(scene, c.enabled ? 'reward' : 'click', 0.35); scene.tweens.add({ targets: c, scale: 0.92, duration: 60, yoyo: true }); cb(c.enabled); });
  c.setOn(true);
  return c;
}

// ───── 修炼：境界突破＋属性升级 ─────
class CultivateScene extends Phaser.Scene {
  constructor() { super('cultivate'); }
  create() {
    playBgm(this, 'menu');
    pageFrame(this, '修炼', 'bg_cultivate', 'bg_home');
    navBar(this, 'cultivate');
    // 主角打坐（有影片用影片，没有就用立绘）＋背后法阵光
    const rays = this.add.image(W / 2, 470 - NAV_LIFT, 'rays').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd890).setAlpha(0.5).setScale(1.3);
    this.tweens.add({ targets: rays, angle: 360, duration: 40000, repeat: -1 });
    this.add.particles(0, 0, 'glow', { x: { min: 220, max: 500 }, y: { min: 560 - NAV_LIFT, max: 700 - NAV_LIFT }, speedY: { min: -40, max: -90 }, lifespan: 2600, scale: { start: 0.35, end: 0 }, alpha: { start: 0.8, end: 0 }, tint: 0xffe08a, frequency: 120, blendMode: 'ADD' });
    if (this.anims.exists('anim_hero_meditate')) {
      fitH(this.add.sprite(W / 2, 700 - NAV_LIFT, 'anim_hero_meditate').setOrigin(0.5, 1), 420).play('anim_hero_meditate');
    } else {
      const h = fitH(this.add.image(W / 2, 700 - NAV_LIFT, 'hero_sword_full').setOrigin(0.5, 1), 450);
      this.tweens.add({ targets: h, y: 690 - NAV_LIFT, duration: 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.ui = [];
    this.render();
  }
  clearUi() { this.ui.forEach(o => o.destroy()); this.ui = []; }
  add2(o) { this.ui.push(o); return o; }
  render() {
    this.clearUi();
    const pd = player.get(), st = calcStats(pd);
    const panel = this.add2(this.add.graphics());
    panel.fillStyle(0x0d1220, 0.88).fillRoundedRect(30, 712, W - 60, 548, 22).lineStyle(3, 0xd9b45a, 0.9).strokeRoundedRect(30, 712, W - 60, 548, 22);
    // 境界
    this.add2(realmImg(this, W / 2, 754, pd.realm, 58));
    this.add2(txt(this, W / 2, 800, '战力 ' + fmtNum(st.power), 26, '#ffd36b'));
    const need = xpNeed(pd.realm), full = pd.xp >= need, maxed = pd.realm >= REALM_MAX;
    const bw = 440, bx = 60, by = 838;
    const bar = this.add2(this.add.graphics());
    bar.fillStyle(0x000000, 0.6).fillRoundedRect(bx, by, bw, 26, 12);
    bar.fillStyle(full ? 0xffd04a : 0x4aa8ff).fillRoundedRect(bx, by, Math.max(14, bw * Math.min(1, pd.xp / need)), 26, 12);
    this.add2(txt(this, bx + bw / 2, by + 13, `修为 ${fmtNum(pd.xp)} / ${fmtNum(need)}`, 18, '#ffffff'));
    const major = isMajor(pd.realm);
    const label = maxed ? '已圆满' : major ? '渡劫' : '突破';
    const b = this.add2(smallBtn(this, 590, by + 13, 170, 56, label, on => {
      if (!on) { toast(this, maxed ? '已达目前最高境界' : !full ? '修为不足，去闯关累积修为' : `渡劫需要灵晶 ${majorCost(pd.realm)}`); return; }
      this.breakthrough();
    }));
    b.setOn(!maxed && full && (!major || pd.crystal >= majorCost(pd.realm)));
    if (major && !maxed) this.add2(txt(this, 590, by + 52, `需灵晶 ${majorCost(pd.realm)}`, 16, '#cfe2ff'));
    // 属性
    const max = attrMax(pd);
    this.add2(txt(this, W / 2, 920, `— 属性（上限 Lv.${max}，境界越高上限越高）—`, 18, '#cfe2ff'));
    ATTRS.forEach((a, i) => {
      const y = 975 + i * 72, lv = pd.lv[a.id], cost = attrCost(a.id, lv);
      const next = calcStats({ ...pd, lv: { ...pd.lv, [a.id]: lv + 1 } })[a.id];
      const ic = this.add2(this.add.image(84, y, this.textures.exists(a.icon) ? a.icon : a.alt));
      ic.setScale(58 / ic.height);
      this.add2(txt(this, 128, y - 13, a.name, 28, '#ffffff', 0));
      this.add2(txt(this, 128, y + 18, `Lv.${lv}/${max}`, 16, '#aab4c8', 0));
      this.add2(txt(this, 300, y, `${a.fmt(st[a.id])}  →  ${a.fmt(next)}`, 20, '#7fe08a', 0));
      const capped = lv >= max;
      const ub = this.add2(smallBtn(this, 600, y, 170, 52, capped ? '已达上限' : `${fmtNum(cost)} 金币`, on => {
        if (!on) { toast(this, capped ? '先突破境界才能继续提升' : '金币不足'); return; }
        const q = player.get(); q.coin -= cost; q.lv[a.id]++; q.daily.ups++; player.save(q);
        this.fxPop(84, y);
        this.scene.restart();
      }));
      ub.setOn(!capped && pd.coin >= cost);
    });
    this.ui.forEach(o => { o.y -= NAV_LIFT; }); // 整块往上移，让出底部导航
  }
  fxPop(x, y) {
    const r = this.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffe08a).setScale(0.5);
    this.tweens.add({ targets: r, scale: 3, alpha: 0, duration: 400, onComplete: () => r.destroy() });
  }
  breakthrough() {
    sfx(this, 'breakthrough', 0.7, 0); this.time.delayedCall(300, () => sfx(this, 'levelup', 0.6, 0));
    const pd = player.get();
    if (isMajor(pd.realm)) { if (pd.crystal < majorCost(pd.realm)) { toast(this, '灵晶不足'); return; } pd.crystal -= majorCost(pd.realm); }
    pd.xp -= xpNeed(pd.realm);
    pd.realm++;
    player.save(pd);
    // 演出：有突破影片就播，没有就用程式光效
    const cam = this.cameras.main;
    cam.flash(400, 255, 240, 200);
    cam.shake(500, 0.01);
    if (this.anims.exists('fx_breakthrough')) {
      const f = this.add.sprite(W / 2, 640 - NAV_LIFT, 'fx_breakthrough').setOrigin(0.5, 0.69).setBlendMode(Phaser.BlendModes.ADD).setDepth(80); // 八卦阵对准主角脚下
      f.setScale(1400 / f.height).play('fx_breakthrough');
      f.once('animationcomplete', () => f.destroy());
    } else {
      const pillar = this.add.image(W / 2, 360, 'beam').setBlendMode(Phaser.BlendModes.ADD).setDepth(80).setScale(1, 2).setAlpha(0);
      this.tweens.add({ targets: pillar, alpha: 1, scaleX: 6, duration: 300, yoyo: true, hold: 500, onComplete: () => pillar.destroy() });
      const ring = this.add.image(W / 2, 640, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd890).setDepth(80).setScale(1);
      this.tweens.add({ targets: ring, scale: 16, alpha: 0, duration: 900, onComplete: () => ring.destroy() });
    }
    const t = this.textures.exists('title_breakthrough')
      ? this.add.image(W / 2, 370, 'title_breakthrough').setDepth(90).setAlpha(0)
      : txt(this, W / 2, 380, '突破成功', 90, '#ffe08a').setDepth(90).setAlpha(0);
    const tScale = t.type === 'Image' ? 600 / t.width : 1;
    t.setScale(tScale * 0.3);
    const sub = realmImg(this, W / 2, 480, pd.realm, 72, 90).setAlpha(0);
    this.tweens.add({ targets: t, scale: tScale, alpha: 1, duration: 300, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, delay: 250, duration: 300 });
    this.time.delayedCall(1600, () => this.scene.restart());
  }
}

// ───── 功法：永久提升（局内拿到该功法时伤害更高） ─────
class SkillScene extends Phaser.Scene {
  constructor() { super('skills'); }
  create() {
    playBgm(this, 'menu');
    pageFrame(this, '功法', 'bg_skill', 'bg_stagemap');
    navBar(this, 'skills');
    const pd = player.get();
    txt(this, W / 2, 210, '修炼功法可永久提升伤害，闯关时拿到该功法就会生效', 18, '#cfe2ff');
    Object.keys(SKILLS).filter(id => id !== 'heal').forEach((id, i) => { // 回春术只在局内
      const S = SKILLS[id], lv = pd.sk[id], y = 330 + i * 176, cost = skillCost(lv), maxed = lv >= SKILL_PERM_MAX;
      const g = this.add.graphics();
      g.fillStyle(0x0d1220, 0.88).fillRoundedRect(30, y - 76, W - 60, 152, 18).lineStyle(3, S.color, 0.9).strokeRoundedRect(30, y - 76, W - 60, 152, 18);
      const ic = this.add.image(110, y, S.icon);
      ic.setScale(112 / ic.height);
      txt(this, 186, y - 40, S.name, 36, '#ffe7a3', 0);
      txt(this, 186, y + 4, S.desc, 18, '#dfe6f2', 0);
      txt(this, 186, y + 40, `永久 Lv.${lv}/${SKILL_PERM_MAX}　伤害 +${lv * 12}%${maxed ? '' : ` → +${(lv + 1) * 12}%`}`, 18, '#7fe08a', 0);
      const b = smallBtn(this, 600, y, 160, 60, maxed ? '已满级' : `${cost} 灵晶`, on => {
        if (!on) { toast(this, maxed ? '已修炼至满级' : '灵晶不足'); return; }
        const q = player.get(); if (q.crystal < cost) { toast(this, '灵晶不足'); return; } q.crystal -= cost; q.sk[id]++; q.daily.ups++; player.save(q);
        this.scene.restart();
      });
      b.setOn(!maxed && pd.crystal >= cost);
    });
  }
}

// ───── 法宝：四个栏位、装备、强化 ─────
class ArtifactScene extends Phaser.Scene {
  constructor() { super('artifact'); }
  init(data) { this.slot = (data && data.slot) || 'weapon'; }
  create() {
    playBgm(this, 'menu');
    pageFrame(this, '法宝', 'bg_artifact', 'bg_home');
    navBar(this, 'artifact');
    const pd = player.get(), st = calcStats(pd);
    const hero = fitH(this.add.image(W / 2, 630, 'hero_sword_full').setOrigin(0.5, 1), 410);
    this.tweens.add({ targets: hero, y: 624, duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    txt(this, W / 2, 222, '战力 ' + fmtNum(st.power), 30, '#ffd36b');
    // 栏位
    ART_SLOTS.forEach(sl => {
      const id = pd.equip[sl.id], on = sl.id === this.slot;
      if (on) { const gl = this.add.image(sl.x, sl.y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36b).setScale(4.2); this.tweens.add({ targets: gl, alpha: 0.5, duration: 700, yoyo: true, repeat: -1 }); }
      const fr = this.add.image(sl.x, sl.y, this.textures.exists('ui_slot') ? 'ui_slot' : 'frame_avatar');
      fr.setScale(150 / fr.height).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.scene.restart({ slot: sl.id }));
      if (id) { const ic = this.add.image(sl.x, sl.y, id); ic.setScale(92 / ic.height); }
      else txt(this, sl.x, sl.y, '空', 34, '#8892a6');
      txt(this, sl.x, sl.y + 90, id ? `${ARTIFACTS[id].name} +${pd.arts[id]}` : sl.name, 22, on ? '#ffe7a3' : '#ffffff');
    });
    // 下方面板：目前装备＋同栏位的法宝列表
    const g = this.add.graphics();
    g.fillStyle(0x0d1220, 0.9).fillRoundedRect(30, 660, W - 60, 490, 22).lineStyle(3, 0xd9b45a, 0.9).strokeRoundedRect(30, 660, W - 60, 490, 22);
    const slotName = ART_SLOTS.find(x => x.id === this.slot).name;
    txt(this, W / 2, 698, `— ${slotName} —`, 30, '#ffe7a3');
    const list = Object.keys(ARTIFACTS).filter(k => ARTIFACTS[k].slot === this.slot);
    list.forEach((id, i) => {
      const A = ARTIFACTS[id], y = 810 + i * 175, owned = pd.arts[id] != null, lv = pd.arts[id] || 0, eqd = pd.equip[this.slot] === id;
      const box = this.add.graphics();
      box.fillStyle(0x060a14, 0.7).fillRoundedRect(50, y - 78, W - 100, 156, 16).lineStyle(3, RARITY_COLOR[A.rarity], owned ? 1 : 0.35).strokeRoundedRect(50, y - 78, W - 100, 156, 16);
      const ic = this.add.image(125, y, id);
      ic.setScale(110 / ic.height).setAlpha(owned ? 1 : 0.3);
      if (!owned) ic.setTint(0x555555);
      txt(this, 200, y - 44, A.name + (owned ? `  +${lv}` : ''), 32, owned ? '#ffffff' : '#8892a6', 0);
      txt(this, 200, y, owned ? `${artText(id, lv)}${lv < ART_LV_MAX ? `  →  ${artText(id, lv + 1)}` : '（已满级）'}` : '未获得（闯关有机会掉落）', 18, owned ? '#7fe08a' : '#8892a6', 0);
      if (!owned) return;
      const eb = smallBtn(this, 290, y + 44, 150, 46, eqd ? '已装备' : '装备', on => {
        if (!on) return;
        const q = player.get(); q.equip[this.slot] = id; player.save(q); this.scene.restart({ slot: this.slot });
      });
      eb.setOn(!eqd);
      const cost = artCost(lv), maxed = lv >= ART_LV_MAX;
      const ub = smallBtn(this, 520, y + 44, 200, 46, maxed ? '已满级' : `强化 ${fmtNum(cost)} 金币`, on => {
        if (!on) { toast(this, maxed ? '已强化至满级' : '金币不足'); return; }
        const q = player.get(); q.coin -= cost; q.arts[id]++; q.daily.ups++; player.save(q); this.scene.restart({ slot: this.slot });
      });
      ub.setOn(!maxed && pd.coin >= cost);
    });
  }
}

// ───── 外围功能：签到、任务、邮件、排行（弹窗）＋商城、活动（页面） ─────
const SIGN_REWARDS = [
  { coin: 5000 }, { crystal: 50 }, { stamina: 30 }, { coin: 12000 }, { crystal: 100 }, { xp: 300 }, { crystal: 200, art: true },
];
const TASKS = [
  { id: 'win3',  name: '闯关胜利 3 次',     cur: pd => pd.daily.wins,  need: 3,   rw: { crystal: 30 } },
  { id: 'kill',  name: '击杀妖兽 500 只',   cur: pd => pd.daily.kills, need: 500, rw: { coin: 3000 } },
  { id: 'up2',   name: '修炼／功法／法宝提升 2 次', cur: pd => pd.daily.ups, need: 2, rw: { crystal: 20 } },
  { id: 'sign',  name: '完成每日签到',       cur: pd => (pd.daily.signed ? 1 : 0), need: 1, rw: { stamina: 20 } },
  { id: 'all',   name: '完成以上全部任务',   cur: pd => ['win3', 'kill', 'up2', 'sign'].filter(k => pd.daily.claimed[k]).length, need: 4, rw: { crystal: 100 } },
];
const ENDLESS_TIERS = [
  { kills: 100, rw: { coin: 5000 } }, { kills: 300, rw: { crystal: 50 } }, { kills: 600, rw: { crystal: 120 } }, { kills: 1000, rw: { art: true } },
];
const RANK_NAMES = ['青云子', '紫霄真人', '剑无尘', '白衣卿相', '月下独酌', '云中君', '玄天道人', '慕容秋水', '洛水仙子', '墨染尘',
  '苏长歌', '夜无眠', '寒江雪', '南宫烈', '北冥游', '沈千山', '林听雨', '顾长风', '柳如烟', '江映月'];

// 成就：[id, 名称, 说明, 目前进度(pd), 目标, 奖励灵晶]
const ACHIEVEMENTS = [
  ['st1', '初入仙途', '通关第 1 关', () => store.get('unlocked', 1) - 1, 1, 30],
  ['st10', '小有所成', '通关第 10 关', () => store.get('unlocked', 1) - 1, 10, 80],
  ['st25', '青云登顶', '通关第 25 关（第一章）', () => store.get('unlocked', 1) - 1, 25, 200],
  ['st50', '万妖辟易', '通关第 50 关（第二章）', () => store.get('unlocked', 1) - 1, 50, 400],
  ['k1k', '斩妖除魔', '累计击杀 1,000 只妖兽', pd => pd.stats.kills, 1000, 60],
  ['k10k', '万妖克星', '累计击杀 10,000 只妖兽', pd => pd.stats.kills, 10000, 300],
  ['s3', '完美主义', '三星通关 10 次', pd => pd.stats.stars3, 10, 120],
  ['sup', '天罡降世', '打出 50 次天罡暴击', pd => pd.stats.supers, 50, 150],
  ['r9', '筑基有成', '境界达到筑基期', pd => pd.realm, 9, 100],
  ['r18', '金丹大道', '境界达到金丹期', pd => pd.realm, 18, 300],
  ['ch', '寻宝达人', '累计开启 100 个宝箱', pd => pd.stats.chests, 100, 150],
  ['bos', '妖王克星', '击败妖王 4 次', pd => pd.stats.bosses, 4, 200],
  ['art', '宝器满阁', '集齐 8 件法宝', pd => Object.keys(pd.arts).length, 8, 300],
  ['end', '妖潮不倒', '妖兽来袭单场 1,000 杀', pd => pd.bestEndless, 1000, 250],
];
function showAchievements(scene) {
  const c = popup(scene, '成就', 1040);
  const pd = player.get();
  const done = ACHIEVEMENTS.filter(a => pd.ach[a[0]]).length;
  c.add(txt(scene, 80, c.top + 116, `已达成 ${done} / ${ACHIEVEMENTS.length}`, 20, '#cfe2ff', 0));
  // 一键领取：把所有已达成、还没领的一次领完
  const ready = ACHIEVEMENTS.filter(a => !pd.ach[a[0]] && a[3](pd) >= a[4]);
  const all = smallBtn(scene, W - 150, c.top + 116, 190, 48, ready.length ? `一键领取（${ready.length}）` : '一键领取', on => {
    if (!on) { toast(scene, '没有可以领取的成就'); return; }
    const q = player.get(); let gem = 0;
    ready.forEach(a => { q.ach[a[0]] = true; gem += a[5]; });
    q.crystal += gem; player.save(q);
    toast(scene, `领取 ${ready.length} 项成就！灵晶 +${fmtNum(gem)}`);
    c.destroy(); showAchievements(scene);
  });
  all.setOn(ready.length > 0);
  c.add(all);
  ACHIEVEMENTS.forEach(([id, name, desc, cur, need, gem], i) => {
    const y = c.top + 170 + i * 62, v = Math.min(need, cur(pd)), ok = v >= need, got = pd.ach[id];
    const g = scene.add.graphics();
    g.fillStyle(got ? 0x0a0f18 : 0x0d1220, 0.92).fillRoundedRect(56, y - 27, W - 112, 54, 10).lineStyle(1.5, ok && !got ? 0xffd36b : 0x3a4560).strokeRoundedRect(56, y - 27, W - 112, 54, 10);
    const tk = scene.textures.exists('m_gold') ? 'm_gold' : 'ent_rank';
    const ic = scene.add.image(86, y, tk);
    ic.setScale(40 / ic.height).setAlpha(ok ? 1 : 0.35);
    c.add([g, ic, txt(scene, 114, y - 11, name, 22, got ? '#8892a6' : ok ? '#ffe7a3' : '#ffffff', 0),
      txt(scene, 114, y + 13, `${desc}　${fmtNum(v)}/${fmtNum(need)}`, 14, '#aab4c8', 0)]);
    if (got) c.add(txt(scene, W - 110, y, '已领', 20, '#d63a3a').setAngle(-10));
    else {
      const b = smallBtn(scene, W - 120, y, 120, 44, ok ? `${gem} 灵晶` : `${gem} 灵晶`, on => {
        if (!on) { toast(scene, '尚未达成'); return; }
        const q = player.get(); q.ach[id] = true; q.crystal += gem; player.save(q);
        toast(scene, `达成「${name}」！灵晶 +${gem}`);
        c.destroy(); showAchievements(scene);
      });
      b.setOn(ok);
      c.add(b);
    }
  });
}
const achReady = pd => ACHIEVEMENTS.some(a => !pd.ach[a[0]] && a[3](pd) >= a[4]);

function homeDots(pd) {
  return {
    ach: achReady(pd),
    sign: pd.sign.last !== pd.daily.date,
    task: TASKS.some(t => !pd.daily.claimed[t.id] && t.cur(pd) >= t.need),
    mail: pd.mails.some(m => !m.got),
    event: pd.daily.endless > 0,
    idle: idleMinutes(pd) >= 60,
  };
}

// ───── 挂机收益：离线也会累积金币和修为，至少 3 分钟才能领、最多累积 12 小时 ─────
const IDLE = { min: 3, maxH: 12, coin: 0.12, xp: 0.06 }; // 每分钟 ≈ 通关一次奖励的 12%（金币）、6%（修为）
const idleMinutes = pd => Math.min(IDLE.maxH * 60, (Date.now() - (pd.idleAt || Date.now())) / 60000);
const fmtIdle = m => (m >= 60 ? `${Math.floor(m / 60)} 小时 ${Math.floor(m % 60)} 分` : `${Math.floor(m)} 分钟`);
// 收益看「打到哪里」：已通关的最远一关（含难度）
function idleRates() {
  const d = maxDiff(), G = Math.max(1, unlockedOf(d) - 1 + STAGE_MAX * d), n = (G - 1) % STAGE_MAX + 1, rw = DIFFS[Math.floor((G - 1) / STAGE_MAX)].reward;
  const pm = passOn(player.get()) ? 1.3 : 1; // 月卡特权：挂机收益 +30%
  return { G, coin: Math.round((200 + 50 * n) * rw * IDLE.coin * pm), xp: Math.round((60 + 25 * n) * rw * IDLE.xp * pm) };
}
function showIdle(scene) {
  const c = popup(scene, '挂机收益', 760);
  const pd = player.get(), m = idleMinutes(pd), r = idleRates(), ok = m >= IDLE.min;
  const coin = Math.floor(r.coin * m), xp = Math.floor(r.xp * m);
  const G = r.G, where = `${DIFFS[Math.floor((G - 1) / STAGE_MAX)].name}第 ${(G - 1) % STAGE_MAX + 1} 关`;
  c.add([txt(scene, W / 2, c.top + 140, `已挂机 ${fmtIdle(m)}`, 30, '#ffe7a3'),
    txt(scene, W / 2, c.top + 185, `（最多累积 ${IDLE.maxH} 小时，依通关进度「${where}」计算）`, 16, '#aab4c8')]);
  [['res_coin', `金币 +${fmtNum(coin)}`, `每分钟 ${fmtNum(r.coin)}`], ['res_stone', `修为 +${fmtNum(xp)}`, `每分钟 ${fmtNum(r.xp)}`]].forEach(([ic, a, b], i) => {
    const y = c.top + 290 + i * 120;
    const g = scene.add.graphics();
    g.fillStyle(0x0d1220, 0.9).fillRoundedRect(90, y - 50, W - 180, 100, 14).lineStyle(2, 0xd9b45a, 0.7).strokeRoundedRect(90, y - 50, W - 180, 100, 14);
    const im = scene.add.image(160, y, scene.textures.exists(ic) ? ic : 'res_coin');
    im.setScale(64 / im.height);
    c.add([g, im, txt(scene, 220, y - 14, a, 30, '#ffffff', 0), txt(scene, 220, y + 24, b, 16, '#aab4c8', 0)]);
  });
  if (m >= IDLE.maxH * 60) c.add(txt(scene, W / 2, c.top + 470, '已达累积上限，快领取吧！', 20, '#ff9a7a'));
  const b = smallBtn(scene, W / 2, c.top + 560, 300, 74, ok ? '领取' : `还需 ${Math.ceil(IDLE.min - m)} 分钟`, on => {
    if (!on) { toast(scene, `至少挂机 ${IDLE.min} 分钟才能领取`); return; }
    const q = player.get(), mm = idleMinutes(q); // 按下当下重新算（视窗开着时时间还在跑）
    if (mm < IDLE.min) { toast(scene, `至少挂机 ${IDLE.min} 分钟才能领取`); return; }
    const gc = Math.floor(r.coin * mm), gx = Math.floor(r.xp * mm);
    q.coin += gc; q.xp += gx; q.idleAt = Date.now(); player.save(q);
    toast(scene, `领取 金币 +${fmtNum(gc)}　修为 +${fmtNum(gx)}`);
    c.destroy(); scene.scene.restart();
  });
  b.setOn(ok);
  c.add(b);
}

// 弹窗骨架：压暗背景、面板、标题、关闭键；关掉时重开主页刷新红点
function popup(scene, title, h = 940, onClose) {
  const c = scene.add.container(0, 0).setDepth(300);
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.65).setInteractive();
  c.add(dim);
  const top = H / 2 - h / 2;
  if (scene.textures.exists('ui_popup')) {
    const p = scene.add.image(W / 2, H / 2, 'ui_popup');
    p.setDisplaySize(W - 30, h + 80);
    c.add(p);
  } else {
    const g = scene.add.graphics();
    g.fillStyle(0x121a2c, 0.98).fillRoundedRect(30, top, W - 60, h, 24).lineStyle(4, 0xd9b45a).strokeRoundedRect(30, top, W - 60, h, 24);
    g.lineStyle(1, 0xd9b45a, 0.5).strokeRoundedRect(40, top + 10, W - 80, h - 20, 18);
    g.fillStyle(0xd9b45a, 0.12).fillRect(60, top + 88, W - 120, 2);
    c.add(g);
  }
  c.add(txt(scene, W / 2, top + 50, title, 46, '#ffe7a3'));
  const close = () => {
    scene.tweens.add({ targets: c, alpha: 0, duration: 150, onComplete: () => { c.destroy(); if (onClose) onClose(); else if (scene.scene.key === 'home') scene.scene.restart(); } });
  };
  let cb;
  if (scene.textures.exists('ui_close')) { cb = scene.add.image(W - 66, top + 40, 'ui_close'); cb.setScale(70 / cb.height); }
  else {
    cb = scene.add.container(W - 66, top + 40);
    const g = scene.add.graphics();
    g.fillStyle(0x1a2238).fillCircle(0, 0, 30).lineStyle(3, 0xd9b45a).strokeCircle(0, 0, 30).lineStyle(5, 0xffe7a3).lineBetween(-12, -12, 12, 12).lineBetween(12, -12, -12, 12);
    cb.add(g).setSize(60, 60);
  }
  cb.setInteractive({ useHandCursor: true }).on('pointerdown', close);
  c.add(cb);
  c.top = top; c.h = h; c.close = close;
  c.setAlpha(0);
  scene.tweens.add({ targets: c, alpha: 1, duration: 160 });
  return c;
}

function rewardIcons(scene, c, rw, cx, y, size = 56) {
  const keys = Object.keys(rw);
  keys.forEach((k, i) => {
    const x = cx + (i - (keys.length - 1) / 2) * (size + 34);
    const ic = scene.add.image(x, y, RW_ICON[k]);
    ic.setScale(size / ic.height);
    c.add([ic, txt(scene, x + size / 2, y + size / 2 - 6, k === 'art' ? '?' : fmtNum(rw[k]), 16, '#ffffff', 1)]);
  });
}

// ── 签到：七天一轮
function showSignin(scene) {
  const c = popup(scene, '七日签到', 820);
  const pd = player.get(), can = pd.sign.last !== pd.daily.date, idx = pd.sign.n % 7;
  SIGN_REWARDS.forEach((rw, i) => {
    const big = i === 6, col = i % 4, row = Math.floor(i / 4);
    const x = big ? W / 2 + 150 : 130 + col * 153, y = c.top + 210 + row * 230;
    const w = big ? 300 : 136, hh = 200;
    const claimedInCycle = can ? idx : ((pd.sign.n - 1) % 7) + 1; // 这一轮已领几天（今天领完也算）
    const done = i < claimedInCycle;
    const today_ = i === idx && can;
    const useImg = scene.textures.exists('sign_card');
    if (useImg) {
      c.add(scene.add.image(x, y, done && scene.textures.exists('sign_done') ? 'sign_done' : 'sign_card').setDisplaySize(w + 6, hh + 6).setAlpha(done ? 0.9 : 1));
    } else {
      const g = scene.add.graphics();
      g.fillStyle(today_ ? 0x3a2a0a : 0x0d1220, 0.95).fillRoundedRect(x - w / 2, y - hh / 2, w, hh, 14);
      g.lineStyle(today_ ? 4 : 2, today_ ? 0xffd36b : 0x5a6680, 1).strokeRoundedRect(x - w / 2, y - hh / 2, w, hh, 14);
      c.add(g);
    }
    c.add(txt(scene, x, y - 70, `第${CN_NUM[i + 1]}天`, 26, today_ ? '#ffe7a3' : '#cfd8e8'));
    if (!done || !useImg) rewardIcons(scene, c, rw, x, y + 4, big ? 70 : 60);
    if (done && !useImg) {
      const st = scene.add.graphics();
      st.fillStyle(0x000000, 0.55).fillRoundedRect(x - w / 2, y - hh / 2, w, hh, 14);
      c.add([st, txt(scene, x, y, '已领', 40, '#ff6b6b').setAngle(-15)]);
    }
    if (today_) {
      const glow = scene.add.image(x, y, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36b).setScale(w / 18, hh / 26).setAlpha(0.3);
      scene.tweens.add({ targets: glow, alpha: 0.6, duration: 700, yoyo: true, repeat: -1 });
      c.addAt(glow, 1);
    }
  });
  const b = smallBtn(scene, W / 2, c.top + 720, 280, 70, can ? '签到领取' : '明日再来', on => {
    if (!on) { toast(scene, '今天已经签到过了'); return; }
    const q = player.get();
    const got = grant(q, SIGN_REWARDS[q.sign.n % 7]);
    q.sign.n++; q.sign.last = q.daily.date; q.daily.signed = true;
    player.save(q);
    toast(scene, '签到成功！' + rwText(SIGN_REWARDS[idx]).replace('随机法宝', got ? ARTIFACTS[got].name : '金币×5000'));
    c.destroy(); showSignin(scene);
  });
  b.setOn(can);
  c.add(b);
}

// ── 每日任务
function showTasks(scene) {
  const c = popup(scene, '每日任务', 900);
  const pd = player.get();
  c.add(txt(scene, W / 2, c.top + 118, '每天 0 点重置', 18, '#aab4c8'));
  TASKS.forEach((t, i) => {
    const y = c.top + 205 + i * 128, cur = Math.min(t.need, t.cur(pd)), done = cur >= t.need, got = pd.daily.claimed[t.id];
    const ready = done && !got;
    // 列底：有素材用素材，没有就画「暗底＋金角＋左侧图示座」
    if (scene.textures.exists('ui_task_row')) c.add(scene.add.image(W / 2, y, 'ui_task_row').setDisplaySize(W - 100, 118).setAlpha(got ? 0.6 : 1));
    else {
      const g = scene.add.graphics();
      g.fillGradientStyle(0x1c2740, 0x1c2740, 0x0b111e, 0x0b111e, 0.95).fillRoundedRect(56, y - 54, W - 112, 108, 12);
      g.lineStyle(ready ? 3 : 1.5, ready ? 0xffd36b : 0x8a7240, ready ? 1 : 0.8).strokeRoundedRect(56, y - 54, W - 112, 108, 12);
      g.fillStyle(0xd9b45a, 0.9);
      [[60, y - 50], [W - 60, y - 50], [60, y + 50], [W - 60, y + 50]].forEach(([cx, cy]) => g.fillTriangle(cx, cy - 7, cx + 7, cy, cx, cy + 7).fillTriangle(cx, cy - 7, cx - 7, cy, cx, cy + 7));
      g.fillStyle(0x060a14, 0.9).fillCircle(112, y, 40).lineStyle(2, 0xd9b45a, 0.9).strokeCircle(112, y, 40);
      c.add(g);
      if (got) { const dim = scene.add.graphics(); dim.fillStyle(0x000000, 0.35).fillRoundedRect(56, y - 54, W - 112, 108, 12); c.add(dim); }
    }
    const rk = Object.keys(t.rw)[0];
    const ic = scene.add.image(112, y - 4, RW_ICON[rk]);
    ic.setScale(58 / ic.height);
    c.add([ic, txt(scene, 112, y + 30, rk === 'art' ? '?' : '×' + fmtNum(t.rw[rk]), 16, '#ffe7a3')]);
    c.add(txt(scene, 170, y - 22, t.name, 26, got ? '#9aa3b2' : '#ffffff', 0));
    const bw = 250, bar = scene.add.graphics();
    bar.fillStyle(0x000000, 0.7).fillRoundedRect(170, y + 14, bw, 12, 6).lineStyle(1, 0x8a7240).strokeRoundedRect(170, y + 14, bw, 12, 6);
    bar.fillGradientStyle(done ? 0xffe28a : 0x7fc4ff, done ? 0xffe28a : 0x7fc4ff, done ? 0xc98a1a : 0x2f6fd0, done ? 0xc98a1a : 0x2f6fd0, 1).fillRoundedRect(171, y + 15, Math.max(6, (bw - 2) * cur / t.need), 10, 5);
    c.add([bar, txt(scene, 170 + bw + 10, y + 20, `${fmtNum(cur)}/${fmtNum(t.need)}`, 16, '#cfd8e8', 0)]);
    if (got) { // 已领取：盖红印
      if (scene.textures.exists('stamp_claimed')) { const st = scene.add.image(W - 120, y, 'stamp_claimed'); st.setScale(100 / st.height).setAngle(-12); c.add(st); }
      else {
        const st = scene.add.graphics();
        st.lineStyle(4, 0xc8282e, 0.9).strokeCircle(W - 120, y, 40).lineStyle(1.5, 0xc8282e, 0.9).strokeCircle(W - 120, y, 33);
        c.add([st, txt(scene, W - 120, y, '已领', 26, '#d63a3a').setAngle(-14).setStroke('#2a0505', 2).setShadow(0, 0, '#000', 0)]);
      }
    } else if (ready) {
      const b = smallBtn(scene, W - 124, y, 130, 58, '领取', () => {
        const q = player.get(); grant(q, t.rw); q.daily.claimed[t.id] = true; player.save(q);
        toast(scene, '领取 ' + rwText(t.rw));
        c.destroy(); showTasks(scene);
      });
      scene.tweens.add({ targets: b, scale: 1.08, duration: 500, yoyo: true, repeat: -1 });
      c.add(b);
    } else c.add(txt(scene, W - 124, y, '进行中', 20, '#8892a6'));
  });
}

// ── 邮件
function showMail(scene) {
  const c = popup(scene, '邮件', 900);
  const pd = player.get();
  pd.mails.forEach((m, i) => {
    const y = c.top + 200 + i * 170;
    const g = scene.add.graphics();
    g.fillStyle(0x0d1220, 0.9).fillRoundedRect(60, y - 70, W - 120, 140, 14).lineStyle(2, m.got ? 0x3a4560 : 0xd9b45a, 1).strokeRoundedRect(60, y - 70, W - 120, 140, 14);
    const ic = scene.add.image(112, y - 10, 'ent_mail');
    ic.setScale(64 / ic.height).setAlpha(m.got ? 0.5 : 1);
    c.add([g, ic, txt(scene, 160, y - 40, m.title, 26, m.got ? '#8892a6' : '#ffffff', 0), txt(scene, 160, y, m.body, 16, '#aab4c8', 0).setWordWrapWidth(300)]);
    if (m.rw) rewardIcons(scene, c, m.rw, 360, y + 44, 34);
    const b = smallBtn(scene, 590, y, 120, 56, m.got ? (m.rw ? '已领取' : '已读') : (m.rw ? '领取' : '已读'), on => {
      if (!on) return;
      const q = player.get(); const mm = q.mails[i]; if (mm.rw) grant(q, mm.rw); mm.got = true; player.save(q);
      if (mm.rw) toast(scene, '领取 ' + rwText(mm.rw));
      c.destroy(); showMail(scene);
    });
    b.setOn(!m.got);
    c.add(b);
  });
  const any = pd.mails.some(m => !m.got);
  const all = smallBtn(scene, W / 2, c.top + c.h - 70, 260, 64, '一键领取', on => {
    if (!on) return;
    const q = player.get(); const sum = {};
    q.mails.forEach(m => { if (!m.got) { if (m.rw) { grant(q, m.rw); for (const k in m.rw) sum[k] = (sum[k] || 0) + m.rw[k]; } m.got = true; } });
    player.save(q);
    toast(scene, Object.keys(sum).length ? '领取 ' + rwText(sum) : '全部已读');
    c.destroy(); showMail(scene);
  });
  all.setOn(any);
  c.add(all);
}

// ── 排行（原型：AI 道友数值固定，玩家变强就会往上爬）
function showRank(scene, tab = 'power') {
  const c = popup(scene, '排行榜', 1000);
  const pd = player.get(), myPower = calcStats(pd).power, myStage = store.get('unlocked', 1) - 1;
  const rows = RANK_NAMES.map((name, i) => ({ name, v: tab === 'power' ? Math.round(2300 * Math.pow(1.11, 34 - i * 1.6)) : Math.max(1, 52 - i * 2 - (i % 3)) }));
  rows.push({ name: pd.name + '（你）', v: tab === 'power' ? myPower : myStage, me: true });
  rows.sort((a, b) => b.v - a.v);
  const myRank = rows.findIndex(r => r.me) + 1;
  ['power', 'stage'].forEach((k, i) => {
    const b = smallBtn(scene, W / 2 - 110 + i * 220, c.top + 130, 200, 56, k === 'power' ? '战力榜' : '关卡榜', () => { if (k !== tab) { c.destroy(); showRank(scene, k); } });
    b.setOn(k === tab); // 选中的亮金色
    c.add(b);
  });
  const show = rows.slice(0, 8);
  if (myRank > 8) show.push(rows[myRank - 1]);
  show.forEach((r, i) => {
    const y = c.top + 220 + i * 76, rank = rows.indexOf(r) + 1;
    const g = scene.add.graphics();
    g.fillStyle(r.me ? 0x3a2a0a : 0x0d1220, 0.9).fillRoundedRect(60, y - 32, W - 120, 64, 12);
    if (r.me) g.lineStyle(2, 0xffd36b).strokeRoundedRect(60, y - 32, W - 120, 64, 12);
    c.add(g);
    const medal = [0xffd04a, 0xd8dde8, 0xd28a4a][rank - 1], trophy = ['m_gold', 'm_silver', 'm_bronze'][rank - 1];
    if (trophy && scene.textures.exists(trophy)) { const m = scene.add.image(104, y, trophy); m.setScale(58 / m.height); c.add(m); }
    else {
      if (medal) { const m = scene.add.graphics(); m.fillStyle(medal).fillCircle(104, y, 22); c.add(m); }
      c.add(txt(scene, 104, y, String(rank), 24, medal ? '#3a1a04' : '#cfd8e8').setShadow(0, 0, '#000', 0));
    }
    if (r.me) { const av = scene.add.image(160, y, 'avatar_hero'); av.setScale(48 / av.height); c.add(av); }
    else { const ag = scene.add.graphics(); ag.fillStyle(0x2a3550).fillCircle(160, y, 24); c.add([ag, txt(scene, 160, y, r.name[0], 22, '#ffe7a3')]); }
    c.add(txt(scene, 196, y, r.name, 24, r.me ? '#ffe7a3' : '#ffffff', 0));
    c.add(txt(scene, W - 84, y, tab === 'power' ? fmtNum(r.v) : `第 ${r.v} 关`, 22, '#ffd36b', 1));
  });
  c.add(txt(scene, W / 2, c.top + c.h - 50, `你目前排名第 ${myRank} 名`, 24, '#cfe2ff'));
}

// ── 商城
const SHOP_ITEMS = [
  { name: '体力补给', desc: '体力 +60', icon: 'res_gourd', price: 50, rw: { stamina: 60 } },
  { name: '金币袋', desc: '金币 +20,000', icon: 'res_coin', price: 100, rw: { coin: 20000 } },
  { name: '修为丹', desc: '修为 +300', icon: 'res_stone', price: 120, rw: { xp: 300 } },
  { name: '法宝宝匣', desc: '随机一件未拥有的法宝', icon: 'res_scroll', price: 300, rw: { art: true } },
];
// ───── 平台商城（docs/22）─────
// 规格：玩家用台币「直接买道具」→ 平台结帐 → 7-ELEVEN ibon 代码缴费 → 道具直接到帐。不能卖灵晶（游戏币只能靠游玩取得）。
// 商品清单同步到 docs/products_xiantu.json（交给平台）；sku 上架后不可改，要改内容请开新编号。
const GAME_ID = 'xiantu'; // ⏳ 由平台分配
const PRODUCTS = [
  { sku: 'xiantu:bundle:first_buy', kind: 'bundle', name: '新手首购礼包', desc: '体力 120、金币 5 万、修为 3,000、随机法宝一件', icon: 'res_scroll', price: 30, limit: 1, rw: { stamina: 120, coin: 50000, xp: 3000, art: true }, tag: '超值' },
  { sku: 'xiantu:pass:monthly', kind: 'pass', name: '月卡特权（30 天）', desc: '立即生效：挂机收益 +30%、过关金币 +20%、过关修为 +20%', icon: 'res_crystal', price: 150, days: 30, maxPerOrder: 12 },
  { sku: 'xiantu:item:stamina_120', kind: 'item', name: '体力补给包', desc: '体力 +120', icon: 'res_gourd', price: 30, maxPerOrder: 10, rw: { stamina: 120 } },
  { sku: 'xiantu:item:coin_30w', kind: 'item', name: '金币宝箱', desc: '金币 +30 万', icon: 'res_coin', price: 60, rw: { coin: 300000 } },
  { sku: 'xiantu:item:xp_20k', kind: 'item', name: '修为大丹', desc: '修为 +2 万', icon: 'res_stone', price: 150, rw: { xp: 20000 } },
  { sku: 'xiantu:pack:artifact', kind: 'pack', name: '法宝宝匣', desc: '随机获得一件未拥有的法宝', icon: 'res_scroll', price: 300, maxPerOrder: 8, rw: { art: true }, odds: true },
  { sku: 'xiantu:bundle:growth', kind: 'bundle', name: '修仙成长礼包', desc: '金币 120 万、修为 8 万、体力 240', icon: 'res_coin', price: 990, rw: { coin: 1200000, xp: 80000, stamina: 240 }, tag: '组合价' },
  { sku: 'xiantu:bundle:supreme', kind: 'bundle', name: '仙途至尊礼包', desc: '金币 500 万、修为 40 万、体力 480、随机法宝', icon: 'res_crystal', price: 3290, rw: { coin: 5000000, xp: 400000, stamina: 480, art: true }, tag: '最划算' },
];
const productOf = sku => PRODUCTS.find(x => x.sku === sku);
// 模拟平台：正式上线改成呼叫平台 API（GET /prices、/checkout、/orders，发货由平台通知游戏伺服器）
const CHECKOUT_CLOSED = true;
const PLATFORM = {
  test: !RELEASE, // 测试环境：结帐后可以按「模拟已缴费」
  // 8.1 查询售价：正式版向平台查询（伺服器快取 10 分钟），这里先用建议价
  prices() { const prices = {}; PRODUCTS.forEach(x => { prices[x.sku] = x.price; }); return { region: 'tw', currency: 'TWD', minOrder: 30, maxOrder: 20000, prices }; },
  // 8.2 结帐：建立订单、产生 ibon 缴费代码；缴费期限＝建立后第 3 天的当天结束
  checkout(items) {
    if (CHECKOUT_CLOSED) return null;
    const pr = this.prices(), total = items.reduce((a, it) => a + pr.prices[it.sku] * it.qty, 0);
    const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(23, 59, 59, 0);
    const order = { orderId: 'ord_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), status: 'pending', items, total, currency: 'TWD', createdAt: Date.now(), expiresAt: d.getTime(),
      payment: { method: 'cvs', provider: 'ccat', store: '7-ELEVEN', code: String(Math.floor(1e11 + Math.random() * 9e11)) } };
    const all = store.get('orders', []); all.push(order); store.set('orders', all);
    return order;
  },
  orders() { // 顺便把逾期的标成已取消
    const all = store.get('orders', []), now = Date.now(); let ch = false;
    all.forEach(o => { if (o.status === 'pending' && now > o.expiresAt) { o.status = 'expired'; ch = true; } });
    if (ch) store.set('orders', all);
    return all;
  },
  pending() { return this.orders().filter(o => o.status === 'pending'); },
  // 测试环境：模拟已缴费 → 平台呼叫游戏伺服器发货（8.3）
  simulatePaid(orderId) { const all = store.get('orders', []), o = all.find(x => x.orderId === orderId); if (!o || o.status !== 'pending') return null; o.status = 'paid'; o.paidAt = Date.now(); store.set('orders', all); return fulfillOrder(o); },
};
// 8.3 发货：同一笔订单只发一次（以 orderId 判断）、整笔一起发；正式版在游戏伺服器执行
function fulfillOrder(order) {
  const done = store.get('delivered', {});
  if (done[order.orderId]) return done[order.orderId]; // 重送：回原本的结果，不再发一次
  const q = player.get(), got = [];
  q.bought = q.bought || {};
  order.items.forEach(({ sku, qty }) => {
    const pdt = productOf(sku);
    if (!pdt) return;
    for (let i = 0; i < qty; i++) {
      if (pdt.kind === 'pass') { q.passUntil = Math.max(Date.now(), q.passUntil || 0) + pdt.days * 86400000; } // 重复购买累加天数
      else { const a = grant(q, pdt.rw); if (a) got.push(ARTIFACTS[a].name); }
    }
    q.bought[sku] = (q.bought[sku] || 0) + qty;
    q.spent = (q.spent || 0) + productOf(sku).price * qty; // 累积购买金额（之后 VIP 用）
  });
  player.save(q);
  const res = { orderId: order.orderId, status: 'delivered', deliveredAt: Date.now(), arts: got };
  done[order.orderId] = res; store.set('delivered', done);
  const news = store.get('newDeliveries', []); news.push(order.orderId); store.set('newDeliveries', news); // 下次进游戏／回主页时跳「已到帐」
  return res;
}
const passDays = pd => Math.max(0, Math.ceil(((pd.passUntil || 0) - Date.now()) / 86400000));
const passOn = pd => (pd.passUntil || 0) > Date.now();
// 购物车（游戏方保存）：{ sku: 数量 }
const cartGet = () => store.get('cart', {});
const cartCount = () => Object.values(cartGet()).reduce((a, b) => a + b, 0);
// 每帐号限购：已买＋待缴费订单里的也算
function boughtCount(sku) {
  const pd = player.get(); let n = (pd.bought || {})[sku] || 0;
  PLATFORM.pending().forEach(o => o.items.forEach(it => { if (it.sku === sku) n += it.qty; }));
  return n;
}
// 这个商品还能再加几个进购物车（单笔上限、每帐号限购都算进去）
function cartRoom(sku) {
  const pdt = productOf(sku), cur = cartGet()[sku] || 0;
  let room = (pdt.maxPerOrder || 99) - cur;
  if (pdt.limit) room = Math.min(room, pdt.limit - boughtCount(sku) - cur);
  return Math.max(0, room);
}
function cartAdd(scene, sku, n = 1) {
  const pdt = productOf(sku), cart = cartGet(), room = cartRoom(sku);
  if (room <= 0) { toast(scene, pdt.limit ? `每帐号限购 ${pdt.limit} 次` : `单笔最多 ${pdt.maxPerOrder || 99} 个`); return false; }
  n = Math.min(n, room);
  cart[sku] = (cart[sku] || 0) + n; store.set('cart', cart);
  toast(scene, `已加入购物车：${pdt.name} ×${n}`);
  return true;
}
// 买 q 个总共会拿到什么（商品视窗显示用）
function productTotalText(it, q) {
  if (it.kind === 'pass') return [`月卡特权 ${it.days * q} 天`, '挂机收益 +30%、过关金币 +20%、过关修为 +20%'];
  return Object.keys(it.rw).map(k => (k === 'art' ? `随机法宝 ×${q}` : `${RW_NAME[k]} +${fmtNum(it.rw[k] * q)}`));
}
// 商品视窗：选数量、看总共拿到多少、小计，再加入购物车或直接结帐
function showProduct(scene, it) {
  const pr = PLATFORM.prices(), price = pr.prices[it.sku], room = cartRoom(it.sku);
  const c = popup(scene, it.name, 980, () => scene.scene.restart({ tab: 'mall' }));
  const gl = scene.add.image(W / 2, c.top + 210, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36b).setScale(3.4).setAlpha(0.4);
  const ic = scene.add.image(W / 2, c.top + 210, it.icon); ic.setScale(150 / ic.height);
  c.add([gl, ic, txt(scene, W / 2, c.top + 320, it.desc, 18, '#cfd8e8')]);
  const inCart = cartGet()[it.sku] || 0;
  if (inCart) c.add(txt(scene, W / 2, c.top + 352, `购物车里已有 ${inCart} 个`, 16, '#8fc4ff'));
  let q = Math.min(1, room);
  const qT = txt(scene, W / 2, c.top + 420, '', 44, '#ffffff');
  const totT = [txt(scene, W / 2, c.top + 520, '', 24, '#ffe7a3'), txt(scene, W / 2, c.top + 556, '', 24, '#ffe7a3'), txt(scene, W / 2, c.top + 592, '', 24, '#ffe7a3'), txt(scene, W / 2, c.top + 628, '', 24, '#ffe7a3')];
  const subT = txt(scene, W / 2, c.top + 690, '', 34, '#ffffff');
  c.add([qT, ...totT, subT, txt(scene, W / 2, c.top + 476, '— 总共获得 —', 18, '#aab4c8')]);
  const btns = [];
  const draw = () => {
    qT.setText(String(q));
    const lines = productTotalText(it, Math.max(1, q));
    totT.forEach((t, i) => t.setText(lines[i] || ''));
    subT.setText(`小计 NT$ ${fmtNum(price * q)}`);
    btns.forEach(b => b.refresh());
  };
  const step = (x, label, d) => { // －／＋ 和 ×5／×10 快速键
    const b = smallBtn(scene, x, c.top + 420, d === 1 || d === -1 ? 70 : 90, 56, label, on => { if (!on) return; q = clamp(q + d, 1, room); draw(); });
    b.refresh = () => b.setOn(d < 0 ? q + d >= 1 : q + d <= room);
    btns.push(b); c.add(b); return b;
  };
  step(W / 2 - 100, '－', -1); step(W / 2 + 100, '＋', 1);
  if (room > 1) { step(W / 2 - 205, '－5', -5); step(W / 2 + 205, '＋5', 5); }
  const add = smallBtn(scene, W / 2 - 150, c.top + 790, 260, 72, '加入购物车', on => {
    if (!on) { toast(scene, it.limit ? `每帐号限购 ${it.limit} 次` : `单笔最多 ${it.maxPerOrder || 99} 个`); return; }
    if (cartAdd(scene, it.sku, q)) { c.destroy(); scene.scene.restart({ tab: 'mall' }); }
  });
  const buy = smallBtn(scene, W / 2 + 150, c.top + 790, 260, 72, '加入并结帐', on => {
    if (!on) { toast(scene, it.limit ? `每帐号限购 ${it.limit} 次` : `单笔最多 ${it.maxPerOrder || 99} 个`); return; }
    if (cartAdd(scene, it.sku, q)) { c.destroy(); showCart(scene); }
  });
  add.setOn(room > 0); buy.setOn(room > 0);
  c.add([add, buy]);
  if (room <= 0) { q = 0; btns.forEach(b => b.setOn(false)); qT.setText('—'); subT.setText(it.limit ? '已达购买上限' : '购物车已达单笔上限'); totT.forEach(t => t.setText('')); }
  else draw();
  if (it.odds) { const t = txt(scene, W / 2, c.top + 880, '机率说明 ›', 18, '#8fc4ff'); t.setInteractive({ useHandCursor: true }).on('pointerup', () => showOdds(scene, it)); c.add(t); }
}
function goTopup(scene) { // 资源列「+」、主页礼包都进商城
  if (scene.scene.key === 'shop') scene.scene.restart({ tab: 'mall' }); else scene.scene.start('shop', { tab: 'mall' });
}
// 补体力：每天前几次便宜，越买越贵
const STAMINA_BUY = [50, 80, 120, 160, 200];
function showBuyStamina(scene) {
  const c = popup(scene, '补充体力', 620, () => scene.scene.restart());
  const pd = player.get(), n = pd.daily.staminaBuys || 0, max = STAMINA_BUY.length, cost = STAMINA_BUY[Math.min(n, max - 1)];
  const ic = scene.add.image(W / 2, c.top + 210, 'res_gourd');
  ic.setScale(130 / ic.height);
  c.add([ic, txt(scene, W / 2, c.top + 320, '体力 +60', 40, '#ffe7a3'),
    txt(scene, W / 2, c.top + 375, `目前体力 ${pd.stamina}/${STAMINA_MAX}　（每 6 分钟自动回复 1 点）`, 18, '#cfe2ff'),
    txt(scene, W / 2, c.top + 410, `今日已购买 ${n}/${max} 次`, 18, n >= max ? '#ff8a7a' : '#aab4c8')]);
  const b = smallBtn(scene, W / 2, c.top + 500, 280, 70, n >= max ? '今日已达上限' : `${cost} 灵晶 购买`, on => {
    if (!on) { toast(scene, n >= max ? '今天的购买次数已用完' : '灵晶不足（灵晶靠闯关、成就、任务取得）'); return; }
    const q = player.get(); if (q.crystal < cost) { toast(scene, '灵晶不足（灵晶靠闯关、成就、任务取得）'); return; } q.crystal -= cost; q.stamina = Math.min(STAMINA_MAX * 2, q.stamina + 60); q.daily.staminaBuys = n + 1; player.save(q);
    toast(scene, '体力 +60');
    c.destroy(); showBuyStamina(scene);
  });
  b.setOn(n < max && pd.crystal >= cost);
  c.add(b);
}
// 金币：用灵晶换，量越大越划算
const COIN_BUY = [[20, 10000], [100, 60000], [300, 200000]];
function showBuyCoin(scene) {
  const c = popup(scene, '兑换金币', 760, () => scene.scene.restart());
  const pd = player.get();
  c.add(txt(scene, W / 2, c.top + 130, `持有灵晶 ${fmtNum(pd.crystal)}`, 22, '#cfe2ff'));
  COIN_BUY.forEach(([gem, coin], i) => {
    const y = c.top + 240 + i * 150;
    const g = scene.add.graphics();
    g.fillStyle(0x0d1220, 0.9).fillRoundedRect(70, y - 60, W - 140, 120, 14).lineStyle(2, 0xd9b45a, 0.8).strokeRoundedRect(70, y - 60, W - 140, 120, 14);
    const ic = scene.add.image(140, y, 'res_coin');
    ic.setScale((60 + i * 10) / ic.height);
    c.add([g, ic, txt(scene, 200, y - 16, `金币 ×${fmtNum(coin)}`, 28, '#ffe7a3', 0)]);
    if (i) c.add(txt(scene, 200, y + 24, `比最小档多 ${Math.round((coin / gem) / (COIN_BUY[0][1] / COIN_BUY[0][0]) * 100 - 100)}%`, 16, '#7fe08a', 0));
    const b = smallBtn(scene, W - 170, y, 180, 60, `${gem} 灵晶`, on => {
      if (!on) { toast(scene, '灵晶不足（灵晶靠闯关、成就、任务取得）'); return; }
      const q = player.get(); if (q.crystal < gem) { toast(scene, '灵晶不足（灵晶靠闯关、成就、任务取得）'); return; } q.crystal -= gem; q.coin += coin; player.save(q);
      toast(scene, `金币 +${fmtNum(coin)}`);
      c.destroy(); showBuyCoin(scene);
    });
    b.setOn(pd.crystal >= gem);
    c.add(b);
  });
}
class ShopScene extends Phaser.Scene {
  constructor() { super('shop'); }
  init(d) { this.tab = (d && d.tab) || 'mall'; }
  create() {
    playBgm(this, 'shop');
    pageFrame(this, '商城', 'bg_shop', 'bg_home');
    [['mall', '礼包商城'], ['items', '灵晶兑换']].forEach(([k, label], i) => {
      const b = smallBtn(this, W / 2 - 110 + i * 220, 220, 200, 60, label, () => { if (k !== this.tab) this.scene.restart({ tab: k }); });
      b.setOn(k === this.tab);
    });
    const pd = player.get();
    if (this.tab === 'items') { this.drawCrystalShop(pd); return; }
    // 购物车、待缴费订单（顶部右侧）
    const n = cartCount(), pend = PLATFORM.pending();
    const cb = smallBtn(this, W - 110, 292, 180, 52, `购物车（${n}）`, () => showCart(this));
    cb.setOn(n > 0);
    if (pend.length) { const ob = smallBtn(this, 140, 292, 220, 52, `待缴费订单 ${pend.length}`, () => showOrders(this)); ob.list[1].setColor('#a01010'); }
    else txt(this, 50, 292, passOn(pd) ? `月卡特权 剩余 ${passDays(pd)} 天` : '台币直接购买，缴费后立即到帐', 17, passOn(pd) ? '#7fe08a' : '#aab4c8', 0);
    const pr = PLATFORM.prices();
    const list = PRODUCTS.filter(x => pr.prices[x.sku] != null); // 平台没给价格＝该地区不贩售
    list.forEach((it, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 190 + col * 340, y = 445 + row * 222;
      const g = this.add.graphics();
      g.fillStyle(0x0d1220, 0.92).fillRoundedRect(x - 160, y - 100, 320, 206, 16).lineStyle(3, it.kind === 'pass' ? 0x7fe08a : it.tag ? 0xffc13b : 0xd9b45a, 0.9).strokeRoundedRect(x - 160, y - 100, 320, 206, 16);
      this.add.image(x - 100, y - 30, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36b).setScale(1.8).setAlpha(0.35);
      const ic = this.add.image(x - 100, y - 30, it.icon);
      ic.setScale(76 / ic.height);
      txt(this, x - 50, y - 70, it.name, 22, '#ffe7a3', 0);
      this.add.text(x - 50, y - 50, it.desc, { fontFamily: FONT, fontSize: '14px', color: '#cfd8e8', wordWrap: { width: 200, useAdvancedWrap: true }, lineSpacing: 2 });
      const limited = it.limit && boughtCount(it.sku) >= it.limit;
      if (it.limit) txt(this, x - 145, y + 38, limited ? '已购买' : `每帐号限购 ${it.limit} 次`, 14, limited ? '#8892a6' : '#ff9a7a', 0);
      if (it.kind === 'pass') txt(this, x - 145, y + 38, passOn(pd) ? `剩余 ${passDays(pd)} 天（重复购买累加）` : '买了马上生效', 14, '#7fe08a', 0);
      if (it.odds) { const t = txt(this, x - 145, y + 38, '机率说明 ›', 14, '#8fc4ff', 0); t.setInteractive({ useHandCursor: true }).on('pointerup', () => showOdds(this, it)); }
      if (it.tag) { const tg = this.add.graphics(); tg.fillStyle(0xc0242e).fillRoundedRect(x + 86, y - 98, 72, 26, 8); txt(this, x + 122, y - 85, it.tag, 15, '#ffffff'); }
      txt(this, x - 145, y + 76, `NT$ ${fmtNum(pr.prices[it.sku])}`, 24, '#ffffff', 0);
      this.add.zone(x, y - 35, 320, 130).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (!limited) showProduct(this, it); });
      const b = smallBtn(this, x + 82, y + 74, 140, 46, limited ? '已购买' : '选择数量', on => {
        if (!on) { toast(this, `每帐号限购 ${it.limit} 次`); return; }
        showProduct(this, it);
      });
      b.setOn(!limited);
      const inCart = cartGet()[it.sku] || 0;
      if (inCart) { const bd = this.add.graphics(); bd.fillStyle(0x2f8bff).fillCircle(x + 146, y + 52, 15); txt(this, x + 146, y + 52, String(inCart), 15, '#ffffff'); }
    });
    txt(this, W / 2, 1238, '平台结帐 · 7-ELEVEN ibon 代码缴费 · 电子发票由平台开立', 15, '#8892a6');
    // 结帐回来（网址带 ?order=…&status=pending）：正式版由平台导回；这里检查有没有新到帐
    showDeliveries(this);
  }
  drawCrystalShop(pd) { // 灵晶只能靠游玩取得（关卡、成就、任务、活动），这里用灵晶换游戏内资源
    txt(this, W / 2, 292, '灵晶透过闯关、成就、任务、活动取得', 16, '#aab4c8');
    SHOP_ITEMS.forEach((it, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = 190 + col * 340, y = 490 + row * 380;
      const g = this.add.graphics();
      g.fillStyle(0x0d1220, 0.9).fillRoundedRect(x - 150, y - 160, 300, 330, 18).lineStyle(3, 0xd9b45a, 0.9).strokeRoundedRect(x - 150, y - 160, 300, 330, 18);
      const gl = this.add.image(x, y - 50, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36b).setScale(3).setAlpha(0.35);
      this.tweens.add({ targets: gl, alpha: 0.6, duration: 900, yoyo: true, repeat: -1 });
      const ic = this.add.image(x, y - 50, it.icon);
      ic.setScale(120 / ic.height);
      txt(this, x, y + 40, it.name, 32, '#ffe7a3');
      txt(this, x, y + 80, it.desc, 18, '#dfe6f2');
      const b = smallBtn(this, x, y + 128, 200, 56, `${it.price} 灵晶`, on => {
        if (!on) { toast(this, '灵晶不足'); return; }
        const q = player.get(); if (q.crystal < it.price) { toast(this, '灵晶不足'); return; } q.crystal -= it.price; const got = grant(q, it.rw); player.save(q);
        toast(this, '购买成功！' + (it.rw.art ? (got ? `获得「${ARTIFACTS[got].name}」` : '法宝已集齐，改得金币×5000') : rwText(it.rw)));
        this.time.delayedCall(500, () => this.scene.restart({ tab: this.tab }));
      });
      b.setOn(pd.crystal >= it.price);
    });
  }
}
// 购物车：数量增减、合计、上下限，按「结帐」前往平台结帐页
function showCart(scene) {
  const c = popup(scene, '购物车', 1000, () => scene.scene.restart({ tab: 'mall' }));
  const pr = PLATFORM.prices(), cart = cartGet(), skus = Object.keys(cart).filter(k => cart[k] > 0 && pr.prices[k] != null);
  let total = 0;
  if (!skus.length) c.add(txt(scene, W / 2, c.top + 300, '购物车是空的', 26, '#8892a6'));
  skus.forEach((sku, i) => {
    const it = productOf(sku), qty = cart[sku], sub = pr.prices[sku] * qty, y = c.top + 170 + i * 92;
    total += sub;
    const g = scene.add.graphics();
    g.fillStyle(0x0d1220, 0.9).fillRoundedRect(60, y - 40, W - 120, 80, 12);
    const ic = scene.add.image(105, y, it.icon); ic.setScale(54 / ic.height);
    c.add([g, ic, txt(scene, 145, y - 14, it.name, 20, '#ffe7a3', 0), txt(scene, 145, y + 16, `NT$ ${fmtNum(pr.prices[sku])}`, 15, '#aab4c8', 0),
      txt(scene, W - 85, y, `NT$ ${fmtNum(sub)}`, 18, '#ffffff', 1)]);
    const set = v => { const ct = cartGet(); if (v <= 0) delete ct[sku]; else ct[sku] = v; store.set('cart', ct); c.destroy(); showCart(scene); };
    const canAdd = !(it.limit && boughtCount(sku) + qty >= it.limit) && qty < (it.maxPerOrder || 99);
    const minus = smallBtn(scene, 395, y, 46, 44, '－', () => set(qty - 1));
    const plus = smallBtn(scene, 505, y, 46, 44, '＋', on => { if (on) set(qty + 1); else toast(scene, it.limit ? `每帐号限购 ${it.limit} 次` : `单笔最多 ${it.maxPerOrder || 99} 个`); });
    plus.setOn(canAdd);
    c.add([minus, plus, txt(scene, 450, y, String(qty), 22, '#ffffff')]);
  });
  const ok = total >= pr.minOrder && total <= pr.maxOrder;
  const by = c.top + 830;
  c.add(txt(scene, W / 2, by - 70, `合计 NT$ ${fmtNum(total)}`, 34, '#ffe7a3'));
  c.add(txt(scene, W / 2, by - 30, total && total < pr.minOrder ? `单笔最低 NT$${pr.minOrder}，再加点商品才能结帐` : total > pr.maxOrder ? `单笔上限 NT$${fmtNum(pr.maxOrder)}，请分开结帐` : '所有商品合成一笔订单、一组缴费代码、一张发票', 15, ok ? '#aab4c8' : '#ff9a7a'));
  const b = smallBtn(scene, W / 2, by + 40, 300, 72, '结帐', on => { if (on) showCheckout(scene, skus.map(sku => ({ sku, qty: cart[sku] })), total); else toast(scene, total ? '金额不符合结帐限制' : '购物车是空的'); });
  b.setOn(ok);
  c.add(b);
}
// 平台结帐页（模拟）：正式版是跳到 https://<平台网域>/checkout?game=…&items=sku*数量,…&return=/play/<gameId>/shop
function showCheckout(scene, items, total) {
  // 【平台】正式結帳（黑貓PAY）接上前，結帳一律關閉，不產生模擬的繳費代碼
  if (CHECKOUT_CLOSED) { toast(scene, '結帳功能即將開放'); return; }
  scene.children.list.filter(o => o.depth === 300).forEach(o => o.destroy());
  const c = popup(scene, '平台结帐', 1000, () => scene.scene.restart({ tab: 'mall' }));
  c.add([txt(scene, W / 2, c.top + 110, '（模拟平台结帐页：正式版由平台显示）', 15, '#8892a6'),
    txt(scene, W / 2, c.top + 170, `应付金额 NT$ ${fmtNum(total)}`, 38, '#ffe7a3'),
    txt(scene, W / 2, c.top + 215, items.map(it => `${productOf(it.sku).name}×${it.qty}`).join('、'), 16, '#cfd8e8')]);
  let agree = false;
  const box = scene.add.graphics(), tick = txt(scene, 104, c.top + 300, '', 26, '#7fe08a');
  const drawBox = () => { box.clear().lineStyle(3, 0xd9b45a).strokeRoundedRect(88, c.top + 284, 32, 32, 6); tick.setText(agree ? '✔' : ''); };
  drawBox();
  const terms = scene.add.text(136, c.top + 286, '我同意购买条款：数位商品于缴费后立即提供，不适用七天解除权。缴费通知与电子发票将寄到平台帐号的 Email。', { fontFamily: FONT, fontSize: '16px', color: '#dfe6f2', wordWrap: { width: 470, useAdvancedWrap: true }, lineSpacing: 4 });
  const zone = scene.add.zone(W / 2, c.top + 310, W - 140, 90).setInteractive({ useHandCursor: true }).on('pointerup', () => { agree = !agree; drawBox(); pay.setOn(agree); });
  c.add([box, tick, terms, zone]);
  const pay = smallBtn(scene, W / 2, c.top + 470, 360, 76, '取得 ibon 缴费代码', on => {
    if (!on) { toast(scene, '请先勾选同意购买条款'); return; }
    const order = PLATFORM.checkout(items);
    store.set('cart', {}); // 结帐后清空购物车，商品转成待缴费订单
    c.destroy(); showOrder(scene, order);
  });
  pay.setOn(false);
  c.add(pay);
  c.add(txt(scene, W / 2, c.top + 560, '缴费期限：订单建立后第 3 天的当天结束前', 16, '#aab4c8'));
}
// 一笔订单的缴费资讯：代码、条码、金额、期限
function showOrder(scene, o) {
  const c = popup(scene, '待缴费订单', 1000, () => scene.scene.restart({ tab: 'mall' }));
  const d = new Date(o.expiresAt), exp = `${d.getMonth() + 1}/${d.getDate()} 23:59`;
  c.add([txt(scene, W / 2, c.top + 130, '请于期限内到 7-ELEVEN 缴费', 22, '#cfe2ff'),
    txt(scene, W / 2, c.top + 190, `应缴金额 NT$ ${fmtNum(o.total)}`, 34, '#ffe7a3'),
    txt(scene, W / 2, c.top + 245, `ibon 缴费代码`, 18, '#aab4c8'),
    txt(scene, W / 2, c.top + 290, o.payment.code.replace(/(\d{4})(?=\d)/g, '$1 '), 40, '#ffffff')]);
  const bar = scene.add.graphics(); // 示意条码（正式版用平台的条码页 barcodeUrl）
  bar.fillStyle(0xffffff).fillRect(120, c.top + 340, W - 240, 120);
  let bx = 136; const seed = o.payment.code.split('').map(Number);
  for (let k = 0; bx < W - 136; k++) { const w = 2 + (seed[k % seed.length] % 4); if (k % 2 === 0) bar.fillStyle(0x000000).fillRect(bx, c.top + 352, w, 96); bx += w + 1 + (seed[(k + 3) % seed.length] % 3); }
  c.add([bar, txt(scene, W / 2, c.top + 490, `缴费期限 ${exp}　逾期订单自动取消`, 18, '#ff9a7a'),
    txt(scene, W / 2, c.top + 525, '可在 ibon 机台输入代码列印缴费单，或在柜台出示手机条码', 15, '#aab4c8'),
    txt(scene, W / 2, c.top + 560, o.items.map(it => `${productOf(it.sku).name}×${it.qty}`).join('、'), 15, '#cfd8e8')]);
  c.add(smallBtn(scene, W / 2 - 150, c.top + 670, 260, 70, '回到游戏', () => { c.destroy(); scene.scene.restart({ tab: 'mall' }); }));
  if (PLATFORM.test) {
    const sim = smallBtn(scene, W / 2 + 150, c.top + 670, 260, 70, '模拟已缴费', () => { PLATFORM.simulatePaid(o.orderId); c.destroy(); scene.scene.restart({ tab: 'mall' }); });
    c.add([sim, txt(scene, W / 2 + 150, c.top + 725, '（测试环境才有）', 14, '#8892a6')]);
  }
}
function showOrders(scene) {
  const pend = PLATFORM.pending();
  if (pend.length === 1) { showOrder(scene, pend[0]); return; }
  const c = popup(scene, '待缴费订单', 900, () => scene.scene.restart({ tab: 'mall' }));
  pend.forEach((o, i) => {
    const y = c.top + 170 + i * 110, d = new Date(o.expiresAt);
    const g = scene.add.graphics(); g.fillStyle(0x0d1220, 0.9).fillRoundedRect(70, y - 45, W - 140, 90, 12);
    c.add([g, txt(scene, 100, y - 14, `NT$ ${fmtNum(o.total)}　${o.items.length} 样商品`, 22, '#ffe7a3', 0), txt(scene, 100, y + 18, `期限 ${d.getMonth() + 1}/${d.getDate()} 23:59`, 15, '#aab4c8', 0),
      smallBtn(scene, W - 170, y, 170, 52, '看缴费代码', () => { c.destroy(); showOrder(scene, o); })]);
  });
}
// 机率公开（卡包类商品必备）
function showOdds(scene, it) {
  const c = popup(scene, '机率说明', 900, () => {});
  const pd = player.get(), left = Object.keys(ARTIFACTS).filter(k => pd.arts[k] == null), all = Object.keys(ARTIFACTS);
  c.add(txt(scene, W / 2, c.top + 120, `${it.name}：从「尚未拥有」的法宝中平均抽出一件`, 18, '#cfe2ff'));
  all.forEach((k, i) => {
    const y = c.top + 180 + i * 62, own = pd.arts[k] != null;
    c.add([txt(scene, 120, y, ARTIFACTS[k].name, 22, own ? '#8892a6' : '#ffffff', 0),
      txt(scene, W - 120, y, own ? '已拥有（不会抽到）' : `${(100 / left.length).toFixed(2)}%`, 20, own ? '#8892a6' : '#ffe7a3', 1)]);
  });
  c.add(txt(scene, W / 2, c.top + 180 + all.length * 62 + 20, '法宝全部拥有时改得金币 ×5,000', 16, '#aab4c8'));
}
// 到帐通知：发货完成后，回主页／进商城时跳出
function showDeliveries(scene) {
  const news = store.get('newDeliveries', []);
  if (!news.length) return;
  store.set('newDeliveries', []);
  const orders = store.get('orders', []), done = store.get('delivered', {});
  const lines = [], arts = [];
  news.forEach(id => { const o = orders.find(x => x.orderId === id); if (o) o.items.forEach(it => lines.push(`${productOf(it.sku).name} ×${it.qty}`)); (done[id] && done[id].arts || []).forEach(a => arts.push(a)); });
  const c = popup(scene, '购买的商品已到帐', 760, () => scene.scene.restart(scene.scene.key === 'shop' ? { tab: 'mall' } : undefined));
  lines.forEach((t, i) => c.add(txt(scene, W / 2, c.top + 170 + i * 44, t, 24, '#ffe7a3')));
  if (arts.length) c.add(txt(scene, W / 2, c.top + 190 + lines.length * 44, `获得法宝：${arts.join('、')}`, 20, '#e0b0ff'));
  scene.cameras.main.flash(300, 255, 230, 160);
  sfx(scene, 'reward', 0.6, 0);
}

// ── 活动：妖兽来袭（无尽）／秘境寻宝（周六）
const EVENT_TIME = 60;
function startEvent(scene, mode) {
  const q = player.get();
  if (mode === 'endless') { startEndless(scene); return; }
  if (q.daily[mode] <= 0) { toast(scene, '今日次数已用完'); return; }
  q.daily[mode]--; player.save(q);
  scene.scene.start('battle', { stage: Math.max(1, store.get('unlocked', 1)), mode });
}
function startEndless(scene) {
  const q = player.get();
  if (q.daily.endless <= 0) { toast(scene, '今日挑战次数已用完'); return; }
  q.daily.endless--; player.save(q);
  scene.scene.start('battle', { stage: Math.max(1, powerStage(player.power()) - 5), mode: 'endless' }); // 退 5 关起跳，前期好打一点
}
class EventScene extends Phaser.Scene {
  constructor() { super('events'); }
  create() {
    playBgm(this, 'map');
    pageFrame(this, '活动', 'bg_event', 'bg_login');
    const pd = player.get();
    // 妖兽来袭
    const g = this.add.graphics();
    g.fillStyle(0x0d1220, 0.88).fillRoundedRect(30, 200, W - 60, 700, 22).lineStyle(3, 0xd9b45a, 0.9).strokeRoundedRect(30, 200, W - 60, 700, 22);
    const card = this.add.image(170, 360, 'card_beast');
    card.setScale(240 / card.height);
    txt(this, 310, 260, '妖兽来袭', 48, '#ffe7a3', 0);
    txt(this, 310, 320, '无尽妖潮，坚持越久、击杀越多，奖励越丰厚', 18, '#dfe6f2', 0).setWordWrapWidth(360);
    txt(this, 310, 380, `今日剩余 ${pd.daily.endless}/${ENDLESS_TRIES} 次`, 22, pd.daily.endless ? '#7fe08a' : '#ff8a7a', 0);
    txt(this, 310, 420, `最佳纪录 ${pd.bestEndless} 杀`, 22, '#ffd36b', 0);
    txt(this, W / 2, 520, '— 击杀奖励（每场都会结算）—', 22, '#cfe2ff');
    ENDLESS_TIERS.forEach((t, i) => {
      const y = 580 + i * 62, ok = pd.bestEndless >= t.kills;
      const k = Object.keys(t.rw)[0];
      const ic = this.add.image(120, y, RW_ICON[k]);
      ic.setScale(44 / ic.height);
      txt(this, 160, y, `击杀 ${t.kills}`, 26, ok ? '#ffe7a3' : '#ffffff', 0);
      txt(this, 600, y, k === 'art' ? '随机法宝' : `${RW_NAME[k]}×${fmtNum(t.rw[k])}`, 20, '#7fe08a', 1);
    });
    txt(this, W / 2, 828, '另外每击杀 1 只得金币 15、每 50 只得灵晶 5', 16, '#aab4c8');
    const btn = imgButton(this, W / 2, 970, 'btn_challenge', 330, () => startEndless(this));
    if (btn.preFX) btn.preFX.addShine(0.5, 0.25, 3);
    txt(this, W / 2, 964, '挑战', 52, '#5a2a08').setStroke('#ffe9b0', 4).setShadow(0, 0, '#000', 0);
    // 秘境寻宝（正式版每周六开放；原型期间每天开放）
    const g2 = this.add.graphics();
    g2.fillStyle(0x0d1220, 0.88).fillRoundedRect(30, 1070, W - 60, 180, 22).lineStyle(3, 0x3fb8a8, 0.9).strokeRoundedRect(30, 1070, W - 60, 180, 22);
    const c2 = this.add.image(120, 1160, 'card_secret');
    c2.setScale(150 / c2.height);
    txt(this, 220, 1115, '秘境寻宝', 40, '#a8fff0', 0);
    txt(this, 220, 1162, '60 秒内破开越多宝箱越好，6 个以上送法宝', 16, '#dfe6f2', 0);
    txt(this, 220, 1200, `今日剩余 ${pd.daily.secret}/${SECRET_TRIES}　最佳 ${pd.bestSecret} 箱`, 18, pd.daily.secret ? '#7fe08a' : '#ff8a7a', 0);
    const sb = smallBtn(this, 610, 1160, 130, 64, '探索', on => { if (on) startEvent(this, 'secret'); else toast(this, '今日次数已用完'); });
    sb.setOn(pd.daily.secret > 0);
  }
}

// ───── 公告／账号 ─────
const NOTICES = [
  ['【版本 v0.9】百关主线开放', '主线扩充为 4 章 100 关：青云山、万妖林、幽冥谷、魔渊，每章末皆有妖王镇守。'],
  ['【新玩法】宗门试炼', '加入宗门挑战长老傀儡，60 秒内比拼伤害，赚取贡献兑换珍宝，宗门升级全员攻击气血提升。'],
  ['【活动】秘境寻宝', '秘境宝箱遍地，60 秒内开启 6 个以上即可额外获得法宝。'],
  ['【商城】新手首购礼包 NT$30', '台币直接购买道具，7-ELEVEN ibon 缴费后立即到帐；首购礼包每帐号限购一次。'],
];
function showNotice(scene) {
  const c = popup(scene, '公告', 900, () => {});
  NOTICES.forEach(([t, b], i) => {
    const y = c.top + 180 + i * 170;
    const g = scene.add.graphics();
    g.fillStyle(0x0d1220, 0.85).fillRoundedRect(60, y - 60, W - 120, 140, 12).lineStyle(1.5, 0x8a7240).strokeRoundedRect(60, y - 60, W - 120, 140, 12);
    c.add([g, txt(scene, 84, y - 30, t, 24, '#ffe7a3', 0),
      scene.add.text(84, y + 4, b, { fontFamily: FONT, fontSize: '17px', color: '#dfe6f2', wordWrap: { width: W - 170, useAdvancedWrap: true }, lineSpacing: 4 }).setOrigin(0, 0)]);
  });
}
// 音量一列：「音乐 [开] ━━━●━━ 80%」，滑杆拖或点轨道都可以（设置面板、战斗暂停共用）
function audioRow(scene, c, y, kind) {
  c.add(txt(scene, 84, y, kind === 'music' ? '音乐' : '音效', 22, '#ffffff', 0));
  const b = smallBtn(scene, 200, y, 110, 50, audioOn(kind) ? '开' : '关', () => {
    toggleAudio(scene, kind); b.list[1].setText(audioOn(kind) ? '开' : '关'); b.setOn(audioOn(kind));
  });
  b.setOn(audioOn(kind)); c.add(b);
  const x0 = 290, x1 = W - 120, g = scene.add.graphics(), knob = scene.add.circle(0, y, 17, 0xffe7a3).setStrokeStyle(3, 0x8a5a14);
  const pct = txt(scene, W - 74, y, '', 18, '#cfe2ff');
  const draw = v => {
    g.clear().fillStyle(0x0a0f18, 0.9).fillRoundedRect(x0, y - 7, x1 - x0, 14, 7).fillStyle(0xd9a032).fillRoundedRect(x0, y - 7, Math.max(14, (x1 - x0) * v), 14, 7);
    knob.x = x0 + (x1 - x0) * v; pct.setText(Math.round(v * 100) + '%');
  };
  draw(audioVol(kind));
  const zone = scene.add.zone((x0 + x1) / 2, y, x1 - x0 + 40, 56).setInteractive({ useHandCursor: true });
  let drag = false;
  const set = p => {
    const v = Math.round(Phaser.Math.Clamp((p.x - x0) / (x1 - x0), 0, 1) * 20) / 20; // 5% 一格
    store.set('vol_' + kind, v); draw(v);
    if (kind === 'music' && AUD.cur) { clearInterval(AUD.cur._fade); AUD.cur.volume = BGM_VOL * v; } // 音乐当场变大变小
  };
  zone.on('pointerdown', p => { drag = true; set(p); });
  const move = p => { if (drag && p.isDown) set(p); };
  const up = () => { if (drag && kind === 'sfx') { AUD.cd.buff = 0; sfx(scene, 'buff', 0.4, 0); } drag = false; }; // 放开试听
  scene.input.on('pointermove', move); scene.input.on('pointerup', up);
  c.once('destroy', () => { scene.input.off('pointermove', move); scene.input.off('pointerup', up); });
  c.add([g, knob, pct, zone]);
}

// ───── 设置（首页点头像／齿轮） ─────
function showSettings(scene) {
  const c = popup(scene, '设置', 1000); // 关掉时首页会重整（道号有换就会更新）
  const top = c.top, pd = player.get();
  const section = (y, label) => {
    const g = scene.add.graphics();
    g.fillStyle(0xd9b45a, 0.35).fillRect(80, y + 22, W - 160, 2);
    c.add([g, txt(scene, 84, y, label, 26, '#ffe7a3', 0)]);
  };
  // 开关按钮：文字跟着状态换
  const toggle = (x, y, w, getLabel, getOn, flip) => {
    const b = smallBtn(scene, x, y, w, 50, getLabel(), () => { flip(); b.list[1].setText(getLabel()); b.setOn(getOn()); });
    b.setOn(getOn()); c.add(b); return b;
  };
  section(top + 120, '声音');
  audioRow(scene, c, top + 190, 'music');
  audioRow(scene, c, top + 260, 'sfx');

  section(top + 330, '战斗画面');
  c.add(txt(scene, 84, top + 400, '画面震动', 22, '#ffffff', 0));
  toggle(W - 170, top + 400, 200, () => (store.get('opt_shake', true) ? '开' : '关'), () => store.get('opt_shake', true), () => store.set('opt_shake', !store.get('opt_shake', true)));
  c.add(txt(scene, 84, top + 470, '伤害数字', 22, '#ffffff', 0));
  const NUM = ['关闭', '只显示暴击', '全部显示'];
  toggle(W - 170, top + 470, 200, () => NUM[store.get('opt_num', 2)], () => store.get('opt_num', 2) > 0, () => store.set('opt_num', (store.get('opt_num', 2) + 2) % 3));

  section(top + 540, '账号');
  const av = scene.add.image(130, top + 640, 'avatar_hero');
  av.setScale(90 / av.height);
  c.add([av, txt(scene, 196, top + 618, pd.name, 30, '#ffe7a3', 0),
    txt(scene, 196, top + 660, `UID ${pd.uid}　${realmName(pd.realm)}`, 18, '#cfe2ff', 0)]);
  c.add(smallBtn(scene, W - 150, top + 640, 180, 50, '随机换道号', () => {
    const q = player.get(); q.name = pick(NAME_A) + pick(NAME_B); player.save(q);
    c.destroy(); showSettings(scene);
  }));
  c.add(smallBtn(scene, W / 2 - 150, top + 750, 240, 56, '公告', () => showNotice(scene)));
  // 平台串接 6.5：旧帐号绑定平台帐号（平台开通 OIDC 后接上）
  const bind = smallBtn(scene, W - 150, top + 700, 180, 44, pd.platformUserId ? '已绑定平台' : '绑定平台帐号', () => toast(scene, pd.platformUserId ? '已绑定平台帐号' : '平台开通后即可绑定（之后从平台进入会直接进到这个帐号）'));
  bind.setOn(!pd.platformUserId);
  c.add(bind);
  let armed = false;
  const rb = smallBtn(scene, W / 2 + 150, top + 750, 240, 56, '重置存档', () => {
    if (!armed) { armed = true; rb.list[1].setText('再按一次确认'); toast(scene, '会清除所有进度！再按一次确认'); return; }
    try { Object.keys(localStorage).filter(k => k.startsWith('xtwd_')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* 无痕 */ }
    location.reload();
  });
  c.add(rb);
  c.add(txt(scene, W / 2, top + 850, '仙途问道 v0.9 原型　进度存在这台装置的浏览器里', 16, '#8892a6'));
}

const NAME_A = ['清风', '明月', '流云', '寒江', '紫霄', '青冥', '素问', '长歌', '孤鸿', '沧海'];
const NAME_B = ['逐月', '问道', '听雨', '踏雪', '归墟', '无尘', '拂衣', '照影', '凌霄', '揽星'];
function showAccount(scene) {
  const c = popup(scene, '账号', 760, () => {});
  const pd = player.get();
  const av = scene.add.image(W / 2, c.top + 190, 'avatar_hero');
  av.setScale(130 / av.height);
  c.add([av, txt(scene, W / 2, c.top + 300, pd.name, 40, '#ffe7a3'),
    txt(scene, W / 2, c.top + 350, `UID ${pd.uid}　${realmName(pd.realm)}　战力 ${fmtNum(calcStats(pd).power)}`, 18, '#cfe2ff')]);
  const b1 = smallBtn(scene, W / 2, c.top + 440, 260, 62, '随机换道号', () => {
    const q = player.get(); q.name = pick(NAME_A) + pick(NAME_B); player.save(q);
    c.destroy(); showAccount(scene);
  });
  c.add(b1);
  let armed = false;
  const b2 = smallBtn(scene, W / 2, c.top + 540, 260, 62, '重置存档', () => {
    if (!armed) { armed = true; b2.list[1].setText('再按一次确认'); toast(scene, '会清除所有进度！再按一次确认'); return; }
    try { Object.keys(localStorage).filter(k => k.startsWith('xtwd_')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* 无痕 */ }
    location.reload();
  });
  c.add(b2);
  c.add(txt(scene, W / 2, c.top + 640, '原型：进度存在这台装置的浏览器里', 16, '#8892a6'));
}

// ───── 宗门：试炼、捐献、贡献商店 ─────
const SECT_SHOP = [
  { name: '修为丹', icon: 'res_stone', cost: 30, rw: { xp: 500 }, limit: 3 },
  { name: '灵晶袋', icon: 'res_crystal', cost: 50, rw: { crystal: 80 }, limit: 2 },
  { name: '体力丹', icon: 'res_gourd', cost: 40, rw: { stamina: 40 }, limit: 2 },
  { name: '宗门法宝匣', icon: 'res_scroll', cost: 300, rw: { art: true }, limit: 1 },
];
const DONATE = [[10000, 100, 20], [50000, 550, 110]]; // [金币, 宗门经验, 贡献]
class SectScene extends Phaser.Scene {
  constructor() { super('sect'); }
  create() {
    playBgm(this, 'menu');
    pageFrame(this, '宗门 · 玄天宗', 'bg_event', 'bg_home');
    navBar(this, 'sect');
    const pd = player.get(), L = sectLevel(pd.sect.exp);
    const panel = (y, h) => { const g = this.add.graphics(); g.fillStyle(0x0d1220, 0.9).fillRoundedRect(30, y, W - 60, h, 20).lineStyle(3, 0xd9b45a, 0.85).strokeRoundedRect(30, y, W - 60, h, 20); };
    // 宗门资讯
    panel(200, 150);
    const em = this.add.image(110, 275, this.textures.exists('nav2_sect') ? 'nav2_sect' : 'ent_rank');
    em.setScale(100 / em.height);
    txt(this, 180, 238, `宗门等级 Lv.${L.lv}`, 32, '#ffe7a3', 0);
    txt(this, 180, 278, `全员攻击、气血 +${Math.round(sectBonus(pd) * 100)}%`, 18, '#7fe08a', 0);
    const bw = 300, bar = this.add.graphics();
    bar.fillStyle(0x000000, 0.6).fillRoundedRect(180, 306, bw, 14, 7).fillStyle(0xffd04a).fillRoundedRect(180, 306, Math.max(8, bw * L.cur / L.need), 14, 7);
    txt(this, 180 + bw + 12, 313, `${fmtNum(L.cur)}/${fmtNum(L.need)}`, 15, '#cfd8e8', 0);
    txt(this, W - 60, 238, `贡献 ${fmtNum(pd.sect.contrib)}`, 22, '#ffd36b', 1);
    // 试炼
    panel(370, 230);
    txt(this, 60, 410, '宗门试炼', 36, '#ffe7a3', 0);
    txt(this, 60, 456, '60 秒内对长老傀儡造成伤害，伤害越高贡献越多', 16, '#dfe6f2', 0);
    txt(this, 60, 492, `最佳伤害 ${fmtNum(pd.sect.bestTrial)}`, 20, '#ffd36b', 0);
    txt(this, 60, 528, `今日剩余 ${pd.daily.trial}/${TRIAL_TRIES} 次`, 20, pd.daily.trial ? '#7fe08a' : '#ff8a7a', 0);
    const tb = smallBtn(this, 580, 500, 170, 76, '挑战', on => { if (on) startEvent(this, 'trial'); else toast(this, '今日次数已用完'); });
    tb.setOn(pd.daily.trial > 0);
    // 捐献
    panel(620, 160);
    txt(this, 60, 655, '宗门捐献', 30, '#ffe7a3', 0);
    txt(this, 260, 657, `今日已捐 ${pd.daily.donated}/3 次`, 16, '#aab4c8', 0);
    DONATE.forEach(([coin, exp, ct], i) => {
      const x = 190 + i * 340, y = 730;
      const b = smallBtn(this, x, y, 290, 60, `${fmtNum(coin)} 金币`, on => {
        if (!on) { toast(this, pd.daily.donated >= 3 ? '今日捐献次数已满' : '金币不足'); return; }
        const q = player.get(); q.coin -= coin; q.sect.exp += exp; q.sect.contrib += ct; q.daily.donated++; q.daily.ups++; player.save(q);
        toast(this, `宗门经验 +${exp}　贡献 +${ct}`); this.time.delayedCall(400, () => this.scene.restart());
      });
      b.setOn(pd.daily.donated < 3 && pd.coin >= coin);
      txt(this, x, y + 46, `经验 +${exp}　贡献 +${ct}`, 15, '#7fe08a');
    });
    // 贡献商店
    panel(800, 300);
    txt(this, 60, 832, '贡献商店（每日限购）', 26, '#ffe7a3', 0);
    SECT_SHOP.forEach((it, i) => {
      const x = 115 + i * 163, y = 945, bought = (pd.sect.bought[pd.daily.date] || {})[it.name] || 0, left = it.limit - bought;
      const ic = this.add.image(x, y - 30, it.icon);
      ic.setScale(70 / ic.height).setAlpha(left ? 1 : 0.4);
      txt(this, x, y + 22, it.name, 18, '#ffffff');
      txt(this, x, y + 46, `剩 ${left}`, 14, '#aab4c8');
      const b = smallBtn(this, x, y + 90, 140, 50, `${it.cost} 贡献`, on => {
        if (!on) { toast(this, left ? '贡献不足' : '今日已买完'); return; }
        const q = player.get(); q.sect.contrib -= it.cost;
        const day = q.sect.bought[q.daily.date] = q.sect.bought[q.daily.date] || {}; day[it.name] = (day[it.name] || 0) + 1;
        const got = grant(q, it.rw); player.save(q);
        toast(this, it.rw.art ? (got ? `获得法宝「${ARTIFACTS[got].name}」` : '法宝已集齐，改得金币×5000') : '兑换成功：' + rwText(it.rw));
        this.time.delayedCall(500, () => this.scene.restart());
      });
      b.setOn(left > 0 && pd.sect.contrib >= it.cost);
    });
  }
}

if (!RELEASE) { // 测试用网址参数（正式版关闭）
{ const m = location.search.match(/[?&]stage=(\d+)/); if (m) { store.set('unlocked', Math.max(1, Math.min(STAGE_MAX + 1, +m[1]))); store.set('diff', 0); history.replaceState(null, '', location.pathname); } } // 测试用：直接开到第 N 关
{ const m = location.search.match(/[?&]realm=(\d+)/); if (m) { const q = player.get(); q.realm = Math.max(0, Math.min(REALM_MAX, +m[1])); q.xp = 0; player.save(q); history.replaceState(null, '', location.pathname); } } // 测试用：直接设境界（0＝练气一层，31＝元婴五层）
{ const m = location.search.match(/[?&]crystal=(\d+)/); if (m) { const q = player.get(); q.crystal = +m[1]; player.save(q); history.replaceState(null, '', location.pathname); } } // 测试用：直接设灵晶
if (/[?&]refill/.test(location.search)) { player.refill(); history.replaceState(null, '', location.pathname); } // 补完把网址清掉，避免重整又补
}
window.__game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#0b0f18',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: W, height: H },
  render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
  scene: [LoadScene, LoginScene, HomeScene, StageMapScene, BattleScene, CultivateScene, SkillScene, ArtifactScene, ShopScene, EventScene, SectScene],
});
