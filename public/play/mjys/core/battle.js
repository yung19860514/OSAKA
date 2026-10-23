// 戰鬥邏輯（不依賴 Phaser）：畫面只負責把這裡的狀態畫出來，tools/sim.mjs 也直接用這份做平衡模擬
import { CFG } from '../cfg.js';
import { TOWERS, TRAIT3 } from '../data/towers.js';
import { ENEMIES } from '../data/enemies.js';
import { buildStage } from '../data/stages.js';
import { makePath } from '../data/paths.js';
import { layoutOf } from '../data/layouts.js';
import { CAPTAINS } from '../data/captains.js';

// 格子座標工具（每章格子位置、大小不同）
export function gridTools(G) {
  return {
    cells: G.cols * G.rows,
    center: i => ({ x: G.x + (i % G.cols + 0.5) * G.cw, y: G.y + (Math.floor(i / G.cols) + 0.5) * G.ch }),
    // 放開手指時找最近的格子（格子小，手機上不用剛好點在框內）
    at(x, y) {
      let best = -1, bd = Infinity;
      for (let i = 0; i < G.cols * G.rows; i++) {
        const cx = G.x + (i % G.cols + 0.5) * G.cw, cy = G.y + (Math.floor(i / G.cols) + 0.5) * G.ch;
        const d = ((x - cx) / G.cw) ** 2 + ((y - cy) / G.ch) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
      return bd <= 0.85 ? best : -1;
    },
  };
}
export const tierOf = lv => (lv >= CFG.tierLv[1] ? 2 : lv >= CFG.tierLv[0] ? 1 : 0);
export const lvMul = lv => Math.pow(CFG.lvAtkMul, lv - 1);
export const towerRange = (def, lv) => def.range * (1 + CFG.lvRangeAdd * (lv - 1));
const MUZZLE_Y = -36; // 子彈從塔中心往上多少像素射出

export class Battle {
  // opt.deck：卡組 5 種；opt.towerMul：{塔id: 局外等級×星級加成倍率}；opt.towerStar：{塔id: 星數}（3 星起有特性）
  // opt.stageDef：活動關（零件工坊、無盡）自己的關卡資料；opt.rng：亂數（模擬用）
  // opt.captain：出戰隊長 id（lia／borg／karl／elsa，預設 lia）；opt.gateBonus／opt.manaBonus：要塞加成
  constructor(stageNo, opt = {}) {
    this.stageNo = stageNo;
    this.stage = opt.stageDef || buildStage(stageNo);
    this.mode = this.stage.mode || 'main';
    this.defs = {};
    this.captain = opt.captain || 'lia';
    for (const id in TOWERS) {
      const star = (opt.towerStar || {})[id] || 1;
      let def = star >= 3 && TRAIT3[id] ? TRAIT3[id].mod(TOWERS[id]) : TOWERS[id];
      // 隊長被動：卡爾＝火系攻擊 +15%、艾莎＝冰霜減速 +10%
      if (this.captain === 'karl' && (id === 'cannon' || id === 'dragon')) def = { ...def, atk: def.atk * 1.15 };
      if (this.captain === 'elsa' && def.kind === 'slow') def = { ...def, slow: Math.min(0.7, def.slow + 0.1) };
      this.defs[id] = def;
    }
    this.energyMax = CAPTAINS[this.captain]?.energy || CFG.captain.energyMax;
    this.layout = opt.layout || layoutOf(this.stage.chapter);
    this.G = this.layout.grid;
    this.gt = gridTools(this.G);
    this.cells = this.gt.cells;
    this.path = makePath(this.layout.path);
    // 路比第 1 章短的章節，怪物走慢一點：每章走完全程的時間差不多（不然短路線的章節難很多）
    this.speedK = Math.min(1, this.path.total / 2900);
    this.deck = opt.deck || CFG.defaultDeck;
    this.towerMul = opt.towerMul || {};
    this.rng = opt.rng || Math.random;
    this.t = 0;
    this.mana = CFG.mana.start + (this.captain === 'lia' ? CFG.captain.startMana : 0) + (opt.manaBonus || 0);
    this.summons = 0;
    this.gate = CFG.gateHp + (opt.gateBonus || 0);
    this.gateMax = this.gate;
    this.grid = new Array(this.cells).fill(null);
    this.aura = new Array(this.cells).fill(0);
    this.auraDirty = true;
    this.enemies = [];
    this.shots = [];
    this.events = [];
    this.wave = 0;                       // 已開始的波數
    this.nextWaveAt = CFG.wave.firstDelay;
    this.queue = [];                     // 等待出生：{ at, type, wave }
    this.energy = 0;
    this.skillUntil = -1;
    this.state = 'play';                 // play / win / lose
    this.kills = 0;
    this.merges = 0;
    this.seen = {};
    this.clouds = [];   // 蘑菇毒霧：{ x, y, r, until, mul }
    this.burnt = {};    // 熔岩惡魔燒掉的格子：{ 格子: 到期時間 }
    this.towerFreezeUntil = -1; // 冰霜巨人：全部塔冰凍到這個時間
    this.uid = 1;
    this.result = null;
  }

  get waveTotal() { return this.stage.endless ? Infinity : this.stage.waves.length; }
  emit(type, data = {}) { this.events.push({ ...data, type }); } // 塔種類用 tower、怪種類用 enemy，別用 type
  drainEvents() { const e = this.events; this.events = []; return e; }

  // ───── 玩家操作 ─────
  summonCost() {
    const c = Math.min(CFG.summon.max, CFG.summon.base + CFG.summon.step * this.summons);
    return this.captain === 'borg' ? Math.round(c * 0.9) : c; // 博格被動：召喚 -10%
  }
  emptyCells() { const r = []; for (let i = 0; i < this.cells; i++) if (!this.grid[i] && !(this.burnt[i] > this.t)) r.push(i); return r; }
  canSummon() { return this.state === 'play' && this.mana >= this.summonCost() && this.emptyCells().length > 0; }
  summon() {
    if (!this.canSummon()) return null;
    const empty = this.emptyCells();
    const cell = empty[Math.floor(this.rng() * empty.length)];
    const type = this.deck[Math.floor(this.rng() * this.deck.length)];
    this.mana -= this.summonCost();
    this.summons++;
    const tw = { id: this.uid++, type, lv: 1, cd: this.rng() * 0.3 };
    this.grid[cell] = tw;
    this.auraDirty = true;
    this.emit('summon', { cell, id: tw.id, tower: type });
    return tw;
  }
  canMerge(a, b) { return !!(a && b && a !== b && a.type === b.type && a.lv === b.lv && a.lv < CFG.maxLevel); }
  // 拖 from 到 to：同種同級 → 合體；有別的塔 → 交換；空格 → 移過去
  move(from, to) {
    if (this.state !== 'play' || from === to || from < 0 || to < 0) return 'none';
    const a = this.grid[from], b = this.grid[to];
    if (!a) return 'none';
    let res;
    if (!b) { this.grid[to] = a; this.grid[from] = null; res = 'move'; }
    else if (this.canMerge(a, b)) {
      b.lv++;
      this.merges++;
      b.cd = Math.min(b.cd, 0.15);
      this.grid[from] = null;
      res = 'merge';
      this.emit('merge', { cell: to, id: b.id, gone: a.id, lv: b.lv, tower: b.type });
    } else { this.grid[to] = a; this.grid[from] = b; res = 'swap'; }
    this.auraDirty = true;
    return res;
  }
  skillReady() { return this.state === 'play' && this.energy >= this.energyMax && !this.skillActive(); }
  skillActive() { return this.t < this.skillUntil; }
  castSkill() {
    if (!this.skillReady()) return false;
    this.energy = 0;
    const c = this.captain;
    if (c === 'lia') this.skillUntil = this.t + CFG.captain.skillDur;   // 攻速 ×2
    else if (c === 'elsa') this.skillUntil = this.t + 4;              // 冰凍 4 秒（moveEnemy 看 skillActive）
    else this.skillUntil = this.t;                                    // 博格、卡爾：立即生效
    if (c === 'borg') { // 隨機一座塔 +1 級
      const list = this.grid.map((tw, i) => [tw, i]).filter(([tw]) => tw && tw.lv < CFG.maxLevel);
      if (list.length) {
        const [tw, i] = list[Math.floor(this.rng() * list.length)];
        tw.lv++;
        this.auraDirty = true;
        this.emit('merge', { cell: i, id: tw.id, lv: tw.lv, tower: tw.type, skill: true });
      }
    }
    if (c === 'karl') for (const e of this.enemies) this.damage(e, e.hp * (e.def.boss ? 0.15 : 0.3), 'skill');
    this.emit('skill', { captain: c });
    return true;
  }
  canSkipWave() { return this.state === 'play' && this.wave < this.waveTotal && this.queue.length === 0; }
  skipWave() {
    if (!this.canSkipWave()) return false;
    this.mana += CFG.wave.skipMana;
    this.startWave();
    return true;
  }

  // ───── 時間推進 ─────
  update(dt) { // dt 已乘上加速倍率；內部切成小步，速度 ×2 也不會穿模
    while (dt > 1e-6 && this.state === 'play') {
      const s = Math.min(dt, 1 / 60);
      this.step(s);
      dt -= s;
    }
  }

  step(dt) {
    this.t += dt;
    this.mana += CFG.mana.perSec * dt;
    if (this.wave < this.waveTotal && this.t >= this.nextWaveAt) this.startWave();
    while (this.queue.length && this.queue[0].at <= this.t) {
      const q = this.queue.shift();
      this.spawn(q.type, q.wave);
    }
    for (const e of this.enemies) if (!e.dead) this.moveEnemy(e, dt);
    if (this.auraDirty) this.calcAura();
    this.updateTowers(dt);
    this.updateShots(dt);
    this.enemies = this.enemies.filter(e => !e.dead);
    this.checkEnd();
  }

  startWave() {
    const def = this.stage.waveAt ? this.stage.waveAt(this.wave + 1) : this.stage.waves[this.wave];
    this.wave++;
    let at = this.t;
    for (const u of def) { this.queue.push({ at, type: u.type, wave: this.wave }); at += u.gap; }
    const lastAt = this.queue.length ? this.queue[this.queue.length - 1].at : this.t;
    this.nextWaveAt = this.wave < this.waveTotal ? Math.max(this.t + CFG.wave.gap, lastAt + CFG.wave.afterSpawn) : Infinity;
    this.emit('wave', { n: this.wave, total: this.waveTotal, boss: def.some(u => ENEMIES[u.type].boss) });
  }

  spawn(type, wave, atD = 0) {
    const def = ENEMIES[type];
    let hp;
    if (this.stage.hpAt) hp = def.hp * this.stage.hpAt(wave); // 無盡：每波自己的倍率
    else {
      const ramp = CFG.stageRamp + (1 - CFG.stageRamp) * wave / this.waveTotal;
      hp = def.hp * (1 + (this.stage.hpMul - 1) * ramp) * CFG.waveHp(wave);
    }
    const p = this.path.at(atD);
    const e = {
      id: this.uid++, type, def, hp, maxHp: hp, d: atD, x: p.x, y: p.y,
      slowUntil: -1, slowAmt: 0, poisonUntil: -1, poisonDps: 0, dotAcc: 0,
      burnUntil: -1, burnDps: 0, burnAcc: 0, stopUntil: -1,
      waitEnd: null, shot: false, charging: false, chargeT: 0, dead: false,
    };
    this.enemies.push(e);
    this.seen[type] = true;
    this.emit('spawn', { id: e.id, enemy: type });
  }

  moveEnemy(e, dt) {
    const def = e.def, t = this.t;
    if (e.poisonUntil > t) {
      const d = e.poisonDps * dt;
      e.dotAcc += d;
      this.damage(e, d, 'dot', true);
      if (e.dead) return;
      if (e.dotAcc >= e.poisonDps * 0.5) { this.emit('hit', { x: e.x, y: e.y, dmg: e.dotAcc, kind: 'dot' }); e.dotAcc = 0; }
    }
    if (e.burnUntil > t) { // 火焰塔燒傷（熔岩系只吃一半，在 damage 裡處理）
      const d = e.burnDps * dt;
      e.burnAcc += d;
      this.damage(e, d, 'burn', true);
      if (e.dead) return;
      if (e.burnAcc >= e.burnDps * 0.5) { this.emit('hit', { x: e.x, y: e.y, dmg: e.burnAcc, kind: 'burn' }); e.burnAcc = 0; }
    }
    let sp = def.speed * CFG.enemySpeedMul * this.speedK;
    if (e.slowUntil > t) sp *= 1 - e.slowAmt;
    if (e.stopUntil > t) sp = 0; // 時間塔：停住
    if (this.captain === 'elsa' && this.skillActive()) sp = 0; // 艾莎：冰凍
    // 弓手：走到 60% 停下來，3 秒後對城門射一箭
    if (def.archer && !e.shot && e.d >= this.path.total * def.archer.at) {
      if (e.waitEnd == null) { e.waitEnd = t + def.archer.wait; this.emit('aim', { id: e.id }); }
      if (t < e.waitEnd) sp = 0;
      else {
        e.shot = true;
        this.gate -= def.archer.dmg;
        this.emit('arrow', { x: e.x, y: e.y, dmg: def.archer.dmg });
      }
    }
    // 沼澤女巫：每 summonEvery 秒在身邊召蘑菇、每 frogEvery 秒把一座塔變青蛙（frogDur 秒不能攻擊）
    if (def.witch) {
      const W = def.witch;
      e.wSum = (e.wSum ?? W.summonEvery * 0.6) - dt;
      e.wFrog = (e.wFrog ?? W.frogEvery * 0.5) - dt;
      if (e.wSum <= 0) {
        e.wSum += W.summonEvery;
        for (let k = 0; k < W.summon; k++) this.spawn('mushroom', Math.max(1, this.wave), Math.max(0, e.d - 40 - k * 50));
        this.emit('witchSummon', { x: e.x, y: e.y });
      }
      if (e.wFrog <= 0) {
        e.wFrog += W.frogEvery;
        const list = this.grid.map((tw, i) => [tw, i]).filter(([tw]) => tw && !(tw.frogUntil > t));
        if (list.length) {
          const [tw, i] = list[Math.floor(this.rng() * list.length)];
          tw.frogUntil = t + W.frogDur;
          this.emit('frog', { cell: i, id: tw.id, x: e.x, y: e.y, dur: W.frogDur });
        }
      }
    }
    // 海盜船長：每 every 秒炮擊 cells 格，上面的塔暈眩 dur 秒
    if (def.cannon) {
      const C = def.cannon;
      e.cT = (e.cT ?? C.every * 0.6) - dt;
      if (e.cT <= 0) {
        e.cT += C.every;
        const list = this.grid.map((tw, i) => [tw, i]).filter(([tw]) => tw);
        for (let k = 0; k < C.cells && list.length; k++) {
          const [tw, i] = list.splice(Math.floor(this.rng() * list.length), 1)[0];
          tw.stunUntil = t + C.dur;
          this.emit('disable', { cell: i, id: tw.id, dur: C.dur, kind: 'stun', x: e.x, y: e.y });
        }
      }
    }
    // 冰霜巨人：每 every 秒冰凍全部塔 dur 秒
    if (def.freeze) {
      const F = def.freeze;
      e.fT = (e.fT ?? F.every * 0.6) - dt;
      if (e.fT <= 0) { e.fT += F.every; this.towerFreezeUntil = t + F.dur; this.emit('freezeAll', { dur: F.dur }); }
    }
    // 熔岩惡魔：每 every 秒燒掉一格（有塔就那座塔停擺；空格 dur 秒不能放塔）
    if (def.burn) {
      const B = def.burn;
      e.bT = (e.bT ?? B.every * 0.6) - dt;
      if (e.bT <= 0) {
        e.bT += B.every;
        const occupied = this.grid.map((tw, i) => (tw ? i : -1)).filter(i => i >= 0 && !(this.burnt[i] > t));
        const pool = occupied.length ? occupied : [...Array(this.cells).keys()].filter(i => !(this.burnt[i] > t));
        if (pool.length) {
          const i = pool[Math.floor(this.rng() * pool.length)];
          this.burnt[i] = t + B.dur;
          this.emit('burn', { cell: i, id: this.grid[i]?.id, dur: B.dur });
        }
      }
    }
    // 熔岩石魔：每 every 秒在身邊召一隻小鬼
    if (def.summon) {
      e.sT = (e.sT ?? def.summon.every) - dt;
      if (e.sT <= 0) { e.sT += def.summon.every; this.spawn(def.summon.type, Math.max(1, this.wave), Math.max(0, e.d - 30)); }
    }
    // 首領：每 6 秒衝刺 1 秒
    if (def.charge) {
      e.chargeT += dt;
      const ph = e.chargeT % def.charge.every;
      const was = e.charging;
      e.charging = ph >= def.charge.every - def.charge.dur;
      if (e.charging) sp *= def.charge.mul;
      if (e.charging && !was) this.emit('charge', { id: e.id, x: e.x, y: e.y });
    }
    e.d += sp * dt;
    if (e.d >= this.path.total) {
      e.dead = true;
      this.gate -= def.leak;
      this.emit('leak', { id: e.id, dmg: def.leak, boss: !!def.boss });
      return;
    }
    const p = this.path.at(e.d);
    e.x = p.x; e.y = p.y; e.dirX = p.dx;
  }

  damage(e, dmg, kind, silent) {
    if (e.dead) return;
    if (e.def.shield && (kind === 'single' || kind === 'chain' || kind === 'slow' || kind === 'assassin' || kind === 'crit')) dmg *= 1 - e.def.shield; // 骷髏海盜舉盾（劍士塔近身砍，不吃盾）
    if (e.def.fireResist && (kind === 'splash' || kind === 'dragon' || kind === 'cone' || kind === 'burn')) dmg *= 0.5; // 熔岩系不怕爆炸、不怕火
    if (e.def.poisonImmune && kind === 'dot') return;
    e.hp -= dmg;
    // 暗影骨王：血量掉到門檻召喚精英＋冰凍塔
    if (e.def.phases) {
      const P = e.def.phases;
      e.phase = e.phase || 0;
      while (e.phase < P.at.length && e.hp / e.maxHp <= P.at[e.phase]) {
        e.phase++;
        for (let k = 0; k < P.count; k++) this.spawn(P.summon[Math.floor(this.rng() * P.summon.length)], Math.max(1, this.wave), Math.max(0, e.d - 40 - k * 45));
        this.towerFreezeUntil = this.t + P.freeze;
        this.emit('phase', { n: e.phase, x: e.x, y: e.y, dur: P.freeze });
      }
    }
    if (!silent) this.emit('hit', { id: e.id, x: e.x, y: e.y, dmg, kind });
    if (e.hp <= 0 && e.def.revive && !e.revived && this.rng() < e.def.revive.chance) { // 骷髏：倒下後爬起來（半血）
      e.revived = true;
      e.hp = e.maxHp * 0.5;
      this.emit('revive', { id: e.id, x: e.x, y: e.y });
      return;
    }
    if (e.hp <= 0) {
      e.dead = true;
      this.kills++;
      this.mana += e.def.mana;
      if (!this.skillActive()) this.energy = Math.min(this.energyMax, this.energy + 1);
      this.emit('kill', { id: e.id, x: e.x, y: e.y, enemy: e.type, mana: e.def.mana });
      if (e.def.deathBlast) { // 熔岩小鬼：死掉爆炸，附近的塔暈眩
        const B = e.def.deathBlast;
        this.grid.forEach((tw, i) => {
          if (!tw) return;
          const c = this.gt.center(i);
          if ((c.x - e.x) ** 2 + (c.y - e.y) ** 2 < B.r * B.r) { tw.stunUntil = Math.max(tw.stunUntil || 0, this.t + B.dur); this.emit('disable', { cell: i, id: tw.id, dur: B.dur, kind: 'stun', quiet: true }); }
        });
        this.emit('blast', { x: e.x, y: e.y, r: B.r });
      }
      if (e.def.sporeCloud) {
        const C = e.def.sporeCloud;
        this.clouds.push({ x: e.x, y: e.y, r: C.r, until: this.t + C.dur, mul: C.mul });
        this.emit('spore', { x: e.x, y: e.y, r: C.r, dur: C.dur });
      }
    }
  }

  calcAura() {
    this.auraDirty = false;
    const G = this.G;
    for (let i = 0; i < this.cells; i++) {
      let best = 0;
      const c = i % G.cols, r = Math.floor(i / G.cols);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const cc = c + dc, rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= G.cols || rr >= G.rows) continue;
        const n = this.grid[rr * G.cols + cc];
        if (n && this.defs[n.type].kind === 'aura') best = Math.max(best, this.defs[n.type].auraPerLv * n.lv);
      }
      this.aura[i] = best; // 同類光環不疊加，取最高
    }
  }

  towerAtk(i, tw) {
    const def = this.defs[tw.type];
    return def.atk * lvMul(tw.lv) * (1 + this.aura[i]) * (this.towerMul[tw.type] || 1);
  }

  updateTowers(dt) {
    const rate = this.captain === 'lia' && this.skillActive() ? CFG.captain.skillRate : 1;
    if (this.clouds.length) this.clouds = this.clouds.filter(c => c.until > this.t);
    for (let i = 0; i < this.cells; i++) {
      const tw = this.grid[i];
      if (!tw) continue;
      if (tw.frogUntil > this.t || tw.stunUntil > this.t || this.towerFreezeUntil > this.t || this.burnt[i] > this.t) continue; // 青蛙、暈眩、冰凍、被燒
      const def = this.defs[tw.type];
      if (def.kind === 'aura') continue;
      if (def.kind === 'mana') { // 煉金：不吃攻速加成
        tw.cd -= dt;
        if (tw.cd <= 0) {
          tw.cd += def.interval;
          const amt = Math.round(def.manaPerLv * tw.lv);
          this.mana += amt;
          this.emit('mana', { cell: i, id: tw.id, amount: amt });
        }
        continue;
      }
      if (def.kind === 'stop') { // 時間塔：範圍內有怪才發動
        tw.cd -= dt;
        if (tw.cd > 0) continue;
        const c = this.gt.center(i), rr = towerRange(def, tw.lv), r2 = rr * rr;
        const hit = this.enemies.filter(e => !e.dead && (e.x - c.x) ** 2 + (e.y - c.y) ** 2 <= r2);
        if (!hit.length) { tw.cd = 0; continue; }
        tw.cd += def.interval;
        const dur = def.stop + def.stopPerLv * (tw.lv - 1);
        for (const e of hit) e.stopUntil = Math.max(e.stopUntil, this.t + (e.def.boss ? dur / 2 : dur));
        this.emit('timestop', { cell: i, id: tw.id, x: c.x, y: c.y, r: rr, dur });
        continue;
      }
      let r = rate;
      if (this.clouds.length) { // 在蘑菇毒霧裡：攻速變慢
        const c = this.gt.center(i);
        for (const cl of this.clouds) if ((c.x - cl.x) ** 2 + (c.y - cl.y) ** 2 < cl.r * cl.r) { r *= cl.mul; break; }
      }
      tw.cd -= dt * r;
      if (tw.cd > 0) continue;
      const target = this.findTarget(i, tw, def);
      if (!target) { tw.cd = 0; continue; }
      tw.cd += def.interval;
      this.fire(i, tw, def, target);
    }
  }

  // 打「走最前面」的怪
  // 劍士塔打不到飛的；暗影刺客打「血最少」的
  findTarget(i, tw, def) {
    const c = this.gt.center(i), r = towerRange(def, tw.lv), r2 = r * r;
    let best = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (def.kind === 'melee' && e.def.flying) continue;
      if ((e.x - c.x) ** 2 + (e.y - c.y) ** 2 > r2) continue;
      if (def.kind === 'assassin') { if (!best || e.hp < best.hp) best = e; }
      else if (!best || e.d > best.d) best = e;
    }
    return best;
  }

  fire(i, tw, def, target) {
    const c = this.gt.center(i);
    const dmg = this.towerAtk(i, tw);
    this.emit('fire', { cell: i, id: tw.id, tower: tw.type, tx: target.x, ty: target.y });
    if (def.kind === 'cone') { // 火焰塔：朝目標噴一道扇形，範圍內全部燒
      const r = towerRange(def, tw.lv), r2 = r * r, ang = Math.atan2(target.y - c.y, target.x - c.x);
      const burn = def.burn * lvMul(tw.lv) * (1 + this.aura[i]) * (this.towerMul[tw.type] || 1);
      this.emit('cone', { cell: i, x: c.x, y: c.y + MUZZLE_Y, ang, r, half: def.cone });
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - c.x, dy = e.y - c.y;
        if (dx * dx + dy * dy > r2) continue;
        let da = Math.abs(Math.atan2(dy, dx) - ang); if (da > Math.PI) da = Math.PI * 2 - da;
        if (da > def.cone && e !== target) continue;
        this.damage(e, dmg, 'cone');
        if (e.dead) continue;
        e.burnDps = e.burnUntil > this.t ? Math.max(e.burnDps, burn) : burn;
        e.burnUntil = this.t + def.burnDur;
      }
      return;
    }
    if (def.kind === 'melee') { // 劍士塔：直接砍（3 星連砍第二隻）
      const hit = [target];
      if (def.cleave > 1) {
        const r = towerRange(def, tw.lv), r2 = r * r;
        const more = this.enemies.filter(e => !e.dead && e !== target && !e.def.flying && (e.x - c.x) ** 2 + (e.y - c.y) ** 2 <= r2).sort((a, b) => b.d - a.d);
        hit.push(...more.slice(0, def.cleave - 1));
      }
      for (const e of hit) { this.emit('slash', { cell: i, x: e.x, y: e.y, fx: c.x, fy: c.y }); this.damage(e, dmg, 'melee'); }
      return;
    }
    if (def.kind === 'chain') {
      const hit = [target], pts = [{ x: c.x, y: c.y + MUZZLE_Y }, { x: target.x, y: target.y }];
      let last = target;
      for (let k = 1; k < def.chain; k++) {
        let nb = null, nd = def.chainRange * def.chainRange;
        for (const e of this.enemies) {
          if (e.dead || hit.includes(e)) continue;
          const d2 = (e.x - last.x) ** 2 + (e.y - last.y) ** 2;
          if (d2 < nd) { nd = d2; nb = e; }
        }
        if (!nb) break;
        hit.push(nb); pts.push({ x: nb.x, y: nb.y }); last = nb;
      }
      this.emit('chain', { points: pts });
      hit.forEach((e, k) => this.damage(e, dmg * Math.pow(def.chainMul, k), 'chain'));
      return;
    }
    const x = c.x, y = c.y + MUZZLE_Y;
    this.shots.push({
      id: this.uid++, type: tw.type, kind: def.kind, lv: tw.lv, x, y, sx: x, sy: y,
      target, tx: target.x, ty: target.y, speed: def.shotSpeed, def,
      ...(def.kind === 'assassin' && this.rng() < def.crit ? { dmg: dmg * def.critMul, crit: true } : { dmg }),
      dot: def.dot ? def.dot * lvMul(tw.lv) * (1 + this.aura[i]) * (this.towerMul[tw.type] || 1) : 0,
      done: false,
    });
  }

  updateShots(dt) {
    for (const s of this.shots) {
      if (!s.target.dead) { s.tx = s.target.x; s.ty = s.target.y; }
      const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy), step = s.speed * dt;
      if (d <= step) { s.x = s.tx; s.y = s.ty; this.impact(s); s.done = true; }
      else { s.x += dx / d * step; s.y += dy / d * step; s.vx = dx / d; s.vy = dy / d; }
    }
    this.shots = this.shots.filter(s => !s.done);
  }

  impact(s) {
    const def = s.def;
    if (s.kind === 'splash' || s.kind === 'dragon') {
      const r2 = def.splash * def.splash;
      this.emit('boom', { x: s.x, y: s.y, r: def.splash, tower: s.type });
      for (const e of this.enemies) {
        if (!e.dead && (e.x - s.x) ** 2 + (e.y - s.y) ** 2 <= r2) this.damage(e, s.dmg, s.kind);
      }
      return;
    }
    const e = s.target;
    if (e.dead) return; // 目標已經死了：單體子彈落空
    this.damage(e, s.dmg, s.crit ? 'crit' : s.kind);
    if (e.dead) return;
    if (s.kind === 'slow') {
      if (!e.def.slowImmune) {
        e.slowUntil = this.t + def.slowDur;
        e.slowAmt = e.def.slowResist ? def.slow / 2 : def.slow; // 不疊加，刷新時間；樹人、冰狼只吃一半
      }
    } else if (s.kind === 'poison' && !e.def.poisonImmune) {
      const active = e.poisonUntil > this.t; // 還在中毒：取較強的那個；刷新時間
      e.poisonDps = active ? Math.max(e.poisonDps, s.dot) : s.dot;
      e.poisonUntil = this.t + def.dotDur;
    }
  }

  checkEnd() {
    if (this.state !== 'play') return;
    if (this.gate <= 0) {
      this.gate = 0;
      this.finish(false);
    } else if (this.wave >= this.waveTotal && !this.queue.length && !this.enemies.length) {
      this.finish(true);
    }
  }

  finish(win) {
    this.state = win ? 'win' : 'lose';
    const st = CFG.stars;
    const stars = !win ? 0 : this.gate >= st.three ? 3 : this.gate >= st.two ? 2 : 1;
    // waves：撐過的波數（無盡模式算分用）
    const waves = win ? this.wave : Math.max(0, this.wave - 1);
    this.result = { win, stars, gate: this.gate, kills: this.kills, time: this.t, stage: this.stageNo, mode: this.mode, level: this.stage.level, waves, merges: this.merges, seen: Object.keys(this.seen) };
    this.emit('end', this.result);
  }

  // ───── 調試用 ─────
  debugKillAll() { for (const e of this.enemies) this.damage(e, e.hp + 1, 'debug'); }
  debugSpawnBoss() { this.spawn(this.stage.boss || 'boss_goblinking', Math.max(1, this.wave)); }
  debugWin() { this.queue = []; this.wave = this.waveTotal; this.enemies.forEach(e => { e.dead = true; }); this.enemies = []; this.checkEnd(); }
}
