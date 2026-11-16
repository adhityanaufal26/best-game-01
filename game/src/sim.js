// Tidewarden simulation: pure game logic on a fixed 1/60 s step.
// Rendering lives in render.js; input and screens live in main.js.
import { makeRng } from './rng.js';
import {
  PATH, PLOTS, GLOW_SPOTS, HEART, TOWERS, ENEMIES, BOSS,
  WAVE_COUNT, START_PEARLS, START_LIVES,
  buildWave, waveHpMul, waveSpeedMul, waveBonus,
} from './data.js';

// ---- path geometry: cumulative lengths so enemies walk the channel ----
const SEG = [];
let PATH_LEN = 0;
for (let i = 0; i < PATH.length - 1; i++) {
  const a = PATH[i];
  const b = PATH[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEG.push({ a, b, len, start: PATH_LEN });
  PATH_LEN += len;
}

export function pointAt(dist) {
  const d = Math.max(0, Math.min(PATH_LEN, dist));
  for (const s of SEG) {
    if (d <= s.start + s.len || s === SEG[SEG.length - 1]) {
      const t = s.len === 0 ? 0 : (d - s.start) / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t };
    }
  }
  return { x: PATH[PATH.length - 1].x, y: PATH[PATH.length - 1].y };
}

export function towerDef(id) {
  return TOWERS.find((t) => t.id === id);
}

export function towerStats(def, tier) {
  const mul = [1, 1.45, 2.1][tier];
  return {
    dmg: Math.round(def.dmg * mul),
    range: Math.round(def.range * (1 + tier * 0.12)),
    rate: def.rate * (1 + tier * 0.18),
  };
}

export function upgradeCost(def, tier) {
  return def.upCost[tier] ?? 0;
}

export function sellValue(tower) {
  let invested = tower.def.cost;
  for (let i = 0; i < tower.tier; i++) invested += tower.def.upCost[i];
  return Math.floor(invested * 0.7);
}

// ---- glow: heart pulse + natural springs + Sun Sponge light ----
export function glowZones(state) {
  const zones = GLOW_SPOTS.map((g) => ({ x: g.x, y: g.y, r: g.r }));
  zones.push({ x: HEART.x, y: HEART.y, r: HEART.r * (0.92 + 0.14 * Math.sin(state.time * 1.5)) });
  for (const t of state.towers) {
    if (t.def.id === 'sponge') zones.push({ x: t.x, y: t.y, r: t.def.glowR * (1 + t.tier * 0.25) });
  }
  return zones;
}

export function inGlow(state, x, y) {
  for (const z of glowZones(state)) {
    const dx = x - z.x;
    const dy = y - z.y;
    if (dx * dx + dy * dy <= z.r * z.r) return true;
  }
  return false;
}

// ---- state ----
export function createGame(seed = 20261116) {
  const rng = makeRng(seed);
  return {
    seed,
    rng,
    screen: 'title',
    time: 0,
    pearls: START_PEARLS,
    lives: START_LIVES,
    score: 0,
    kills: 0,
    wave: 0,
    waveActive: false,
    bossWave: false,
    spawnQueue: [],
    spawnTimer: 0,
    betweenWaves: 0,
    enemies: [],
    towers: [],
    projectiles: [],
    particles: [],
    floats: [],
    bubbles: [],
    shake: 0,
    leakFlash: 0,
    boss: null,
    bossPhase: 0,
    bossIntro: 0,
    nextBoss: false,
    banner: null,
    selectedPlot: -1,
    selectedTower: null,
    buildChoice: 'polyp',
    paused: false,
    victoryStars: 0,
    victoryStats: null,
    defeatStats: null,
    stats: { pearlsEarned: 0, shots: 0, damage: 0 },
    decor: buildDecor(rng),
  };
}

// Static reef decoration, seeded once per run so the backdrop is stable.
function buildDecor(rng) {
  const corals = [];
  const kinds = ['branch', 'fan', 'tube', 'rock'];
  for (let i = 0; i < 46; i++) {
    const x = rng.range(20, 1260);
    const y = rng.range(30, 700);
    let nearPath = false;
    for (const p of PATH) if (Math.hypot(p.x - x, p.y - y) < 46) nearPath = true;
    if (nearPath) continue;
    let nearPlot = false;
    for (const p of PLOTS) if (Math.hypot(p.x - x, p.y - y) < 34) nearPlot = true;
    if (nearPlot) continue;
    corals.push({ x, y, kind: kinds[Math.floor(rng.next() * kinds.length)], s: rng.range(0.6, 1.5), hue: rng.range(0, 1) });
  }
  const bubbles = [];
  for (let i = 0; i < 26; i++) bubbles.push({ x: rng.range(0, 1280), y: rng.range(0, 720), r: rng.range(1.5, 4.5), v: rng.range(12, 34) });
  return { corals, bubbles };
}

export function resetRun(state) {
  const fresh = createGame(state.seed);
  fresh.screen = 'play';
  return fresh;
}

export function showBanner(state, text, sub = '', secs = 2.2) {
  state.banner = { text, sub, t: secs, max: secs };
}

export function addFloat(state, x, y, text, color = '#ffe9a8') {
  state.floats.push({ x, y, text, color, life: 1.1, max: 1.1 });
}

export function burst(state, x, y, color, n = 10, speed = 90) {
  for (let i = 0; i < n; i++) {
    const a = state.rng.range(0, Math.PI * 2);
    const v = state.rng.range(speed * 0.3, speed);
    state.particles.push({
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20,
      life: state.rng.range(0.3, 0.8), max: 0.8, color,
      size: state.rng.range(1.5, 4.5),
    });
  }
}

// ---- waves ----
export function startWave(state, n) {
  state.wave = n;
  state.waveActive = true;
  state.bossWave = false;
  state.spawnQueue = [];
  const flat = [];
  for (const [id, count] of buildWave(n)) {
    for (let i = 0; i < count; i++) flat.push(id);
  }
  // Deterministic shuffle: seeded Fisher-Yates.
  for (let i = flat.length - 1; i > 0; i--) {
    const j = Math.floor(state.rng.next() * (i + 1));
    [flat[i], flat[j]] = [flat[j], flat[i]];
  }
  let at = 0.4;
  for (const id of flat) {
    state.spawnQueue.push({ id, at });
    at += Math.max(0.28, 0.85 - n * 0.03);
  }
  state.spawnTimer = 0;
  showBanner(state, `WAVE ${n} / ${WAVE_COUNT}`, waveHint(n), 2.0);
}

function waveHint(n) {
  if (n === 3) return 'Gloom Eels hide in the dark — fight them in the glow';
  if (n === 5) return 'Ink Squids push through in numbers';
  if (n === 8) return 'Murk Jellies mend themselves in shadow';
  if (n === 12) return 'The last wave — hold the reef';
  return 'Defend the Heart Coral';
}

export function startBossWave(state) {
  state.wave = WAVE_COUNT + 1;
  state.waveActive = true;
  state.bossWave = true;
  state.bossIntro = 3.0;
  state.bossPhase = 0;
  showBanner(state, 'THE BLEACH AWAKENS', 'Three phases. No mercy. Hold the reef.', 3.0);
}

function spawnEnemy(state, id, opts = {}) {
  const def = ENEMIES[id];
  const mul = opts.hpMul ?? waveHpMul(state.wave);
  const hp = Math.round(def.hp * mul * (opts.hpScale ?? 1));
  const p = pointAt(0);
  const e = {
    id, def, hp, maxHp: hp,
    dist: 0, x: p.x, y: p.y,
    speed: def.speed * waveSpeedMul(state.wave) * (opts.speedMul ?? 1),
    slowT: 0, slowMul: 1, boss: false, dead: false,
  };
  state.enemies.push(e);
  return e;
}

function spawnBoss(state) {
  const p = pointAt(0);
  const e = {
    id: 'boss', def: BOSS, hp: BOSS.hp, maxHp: BOSS.hp,
    dist: 0, x: p.x, y: p.y, speed: BOSS.speed,
    slowT: 0, slowMul: 1, boss: true, dead: false,
  };
  state.enemies.push(e);
  state.boss = e;
  return e;
}

// ---- economy / building ----
export function placeTower(state, plotIdx, towerId, sound) {
  const plot = PLOTS[plotIdx];
  if (!plot || state.towers.some((t) => t.plot === plotIdx)) return false;
  const def = towerDef(towerId);
  if (!def || state.pearls < def.cost) return false;
  state.pearls -= def.cost;
  state.towers.push({ def, tier: 0, plot: plotIdx, x: plot.x, y: plot.y, cd: 0, angle: -Math.PI / 2, invested: def.cost });
  burst(state, plot.x, plot.y, def.color, 14, 120);
  if (sound) sound.place();
  return true;
}

export function upgradeTower(state, tower, sound) {
  if (!tower || tower.tier >= 2) return false;
  const cost = upgradeCost(tower.def, tower.tier);
  if (state.pearls < cost) return false;
  state.pearls -= cost;
  tower.tier++;
  tower.invested += cost;
  burst(state, tower.x, tower.y, '#ffe066', 18, 140);
  addFloat(state, tower.x, tower.y - 26, tower.def.tierNames[tower.tier] + '!', '#ffe066');
  if (sound) sound.upgrade();
  return true;
}

export function sellTower(state, tower, sound) {
  if (!tower) return false;
  state.pearls += sellValue(tower);
  state.towers = state.towers.filter((t) => t !== tower);
  if (state.selectedTower === tower) state.selectedTower = null;
  burst(state, tower.x, tower.y, '#9fb7c9', 10, 90);
  if (sound) sound.sell();
  return true;
}

// ---- combat ----
function songBuff(state, tower) {
  let mul = 1;
  for (const t of state.towers) {
    if (t === tower || t.def.id !== 'song') continue;
    const d = Math.hypot(t.x - tower.x, t.y - tower.y);
    if (d <= t.def.range * (1 + t.tier * 0.12)) mul = Math.max(mul, 1.25 + t.tier * 0.08);
  }
  return mul;
}

function firstTargetInRange(state, tower, range) {
  let best = null;
  for (const e of state.enemies) {
    if (e.dead) continue;
    const d = Math.hypot(e.x - tower.x, e.y - tower.y);
    if (d <= range && (!best || e.dist > best.dist)) best = e;
  }
  return best;
}

function fireTower(state, tower, sound) {
  const st = towerStats(tower.def, tower.tier);
  const glowing = inGlow(state, tower.x, tower.y);
  const rateMul = (glowing ? 1.5 : 1) * songBuff(state, tower);
  const dmgMul = glowing ? 1.25 : 1;
  const targets = [];
  if (tower.def.kind === 'beam') {
    const inRange = state.enemies.filter((e) => !e.dead && Math.hypot(e.x - tower.x, e.y - tower.y) <= st.range);
    inRange.sort((a, b) => b.dist - a.dist);
    targets.push(...inRange.slice(0, 2 + tower.tier));
  } else {
    const t = firstTargetInRange(state, tower, st.range);
    if (t) targets.push(t);
  }
  if (!targets.length) return;
  tower.angle = Math.atan2(targets[0].y - tower.y, targets[0].x - tower.x);
  tower.cd = 1 / (st.rate * rateMul);
  state.stats.shots += targets.length;
  for (const t of targets) {
    state.projectiles.push({
      x: tower.x, y: tower.y - 8, target: t,
      speed: tower.def.projSpeed, dmg: Math.round(st.dmg * dmgMul),
      kind: tower.def.kind, splashR: tower.def.splashR ?? 0,
      slow: tower.def.slow ?? 0, slowSecs: tower.def.slowSecs ?? 0,
      color: tower.def.color, from: tower.def.id, life: 1.6,
    });
  }
  if (sound) sound.shoot(tower.def.kind === 'beam' ? 'beam' : tower.def.id === 'urchin' ? 'urchin' : tower.def.kind === 'splash' ? 'splash' : 'shot');
}

function damageEnemy(state, e, dmg, sound) {
  if (e.dead) return;
  if (e.def.shadow && !inGlow(state, e.x, e.y)) {
    if (state.rng.chance(0.12)) addFloat(state, e.x, e.y - 18, 'SHADOW', '#8f86c9');
    return;
  }
  e.hp -= dmg;
  state.stats.damage += dmg;
  addFloat(state, e.x + state.rng.range(-8, 8), e.y - 16, String(dmg), '#ffffff');
  burst(state, e.x, e.y, e.def.color, 3, 60);
  if (e.hp <= 0) killEnemy(state, e, sound);
}

function killEnemy(state, e, sound) {
  e.dead = true;
  state.kills++;
  state.score += e.boss ? 500 : 10;
  if (e.boss) {
    state.boss = null;
    state.score += 1000;
    burst(state, e.x, e.y, '#ffffff', 60, 220);
    burst(state, e.x, e.y, '#ff5fa2', 40, 180);
    state.shake = 14;
    state.screen = 'victory';
    state.victoryStars = state.lives >= 15 ? 3 : state.lives >= 8 ? 2 : 1;
    state.victoryStats = {
      score: state.score, waves: WAVE_COUNT, kills: state.kills,
      pearls: state.stats.pearlsEarned, lives: state.lives,
    };
    if (sound) sound.victory();
    return;
  }
  const reward = e.def.reward;
  state.pearls += reward;
  state.stats.pearlsEarned += reward;
  addFloat(state, e.x, e.y - 24, `+${reward} ◉`, '#ffe066');
  burst(state, e.x, e.y, e.def.color, 12, 110);
  if (sound) { sound.pop(); sound.coin(); }
  if (e.def.splits) {
    for (let i = 0; i < 2; i++) {
      const m = spawnEnemy(state, 'mite', { hpMul: waveHpMul(state.wave) });
      m.dist = Math.max(0, e.dist - 14 - i * 10);
      const p = pointAt(m.dist);
      m.x = p.x; m.y = p.y;
    }
  }
}

function leakEnemy(state, e, sound) {
  e.dead = true;
  state.lives -= e.def.leak;
  state.leakFlash = 0.5;
  state.shake = 8;
  burst(state, HEART.x, HEART.y, '#ff5d73', 20, 160);
  addFloat(state, HEART.x, HEART.y - 40, `-${e.def.leak} ♥`, '#ff5d73');
  if (sound) sound.leak();
  if (e.boss) state.boss = null;
  if (state.lives <= 0) {
    state.lives = 0;
    state.screen = 'defeat';
    state.defeatStats = {
      score: state.score, wave: state.wave, kills: state.kills,
      pearls: state.stats.pearlsEarned,
    };
    if (sound) sound.defeat();
  }
}

// ---- main update ----
export function update(state, dt, sound) {
  state.time += dt;
  if (state.banner) {
    state.banner.t -= dt;
    if (state.banner.t <= 0) state.banner = null;
  }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);
  if (state.leakFlash > 0) state.leakFlash = Math.max(0, state.leakFlash - dt);

  // ambient bubbles drift up
  for (const b of state.decor.bubbles) {
    b.y -= b.v * dt;
    if (b.y < -6) { b.y = 726; b.x = state.rng.range(0, 1280); }
  }

  if (state.screen !== 'play' || state.paused) {
    updateFx(state, dt);
    return;
  }

  // boss intro countdown, then the boss itself spawns
  if (state.bossIntro > 0) {
    state.bossIntro -= dt;
    if (state.bossIntro <= 0 && !state.boss && !state.enemies.some((e) => e.boss)) {
      spawnBoss(state);
      if (sound) sound.bossRoar();
    }
  }

  // spawning
  if (state.spawnQueue.length) {
    state.spawnTimer += dt;
    while (state.spawnQueue.length && state.spawnQueue[0].at <= state.spawnTimer) {
      spawnEnemy(state, state.spawnQueue.shift().id);
    }
  }

  // enemies walk the channel
  for (const e of state.enemies) {
    if (e.dead) continue;
    if (e.slowT > 0) e.slowT -= dt;
    const slowMul = e.slowT > 0 ? e.slowMul : 1;
    let sp = e.speed * slowMul;
    if (e.boss) {
      const frac = e.hp / e.maxHp;
      const phase = BOSS.phases.find((p) => frac <= p.at);
      sp *= phase ? phase.speedMul : 1;
      // phase changes: banner + mite burst
      const idx = BOSS.phases.indexOf(phase);
      if (idx > state.bossPhase) {
        state.bossPhase = idx;
        showBanner(state, BOSS.phases[idx].name, 'The Bleach grows paler — and faster', 2.0);
        for (let i = 0; i < 5; i++) {
          const m = spawnEnemy(state, 'mite', { hpMul: 1 });
          m.dist = Math.max(0, e.dist - 20 - i * 12);
          const p = pointAt(m.dist);
          m.x = p.x; m.y = p.y;
        }
        if (sound) sound.bossRoar();
      }
    }
    if (e.def.regen && inGlow(state, e.x, e.y) === false) e.hp = Math.min(e.maxHp, e.hp + e.def.regen * dt);
    e.dist += sp * dt;
    const p = pointAt(e.dist);
    e.x = p.x; e.y = p.y;
    if (e.dist >= PATH_LEN) leakEnemy(state, e, sound);
  }
  state.enemies = state.enemies.filter((e) => !e.dead);

  // towers fire
  for (const t of state.towers) {
    t.cd -= dt;
    if (t.cd <= 0) fireTower(state, t, sound);
  }

  // projectiles home in
  for (const pr of state.projectiles) {
    pr.life -= dt;
    const tgt = pr.target;
    if (!tgt || tgt.dead || pr.life <= 0) { pr.dead = true; continue; }
    const dx = tgt.x - pr.x;
    const dy = tgt.y - pr.y;
    const d = Math.hypot(dx, dy);
    const step = pr.speed * dt;
    if (d <= step + tgt.def.r * 0.5) {
      pr.dead = true;
      if (pr.kind === 'splash') {
        burst(state, tgt.x, tgt.y, pr.color, 12, 130);
        for (const e of state.enemies) {
          if (!e.dead && Math.hypot(e.x - tgt.x, e.y - tgt.y) <= pr.splashR) damageEnemy(state, e, pr.dmg, sound);
        }
      } else {
        if (pr.slow) { tgt.slowT = pr.slowSecs; tgt.slowMul = 1 - pr.slow; }
        damageEnemy(state, tgt, pr.dmg, sound);
      }
    } else {
      pr.x += (dx / d) * step;
      pr.y += (dy / d) * step;
    }
  }
  state.projectiles = state.projectiles.filter((p) => !p.dead);

  // wave cleared?
  if (state.waveActive && !state.spawnQueue.length && !state.enemies.length && state.bossIntro <= 0) {
    state.waveActive = false;
    if (state.bossWave) return; // boss death already handled victory
    const bonus = waveBonus(state.wave);
    state.pearls += bonus;
    state.stats.pearlsEarned += bonus;
    state.score += 100;
    showBanner(state, `WAVE ${state.wave} CLEARED`, `+${bonus} pearls  ·  +100 score`, 2.2);
    if (sound) sound.coin();
    if (state.wave >= WAVE_COUNT) {
      state.betweenWaves = 3.0;
      state.nextBoss = true;
    } else {
      state.betweenWaves = 3.5;
    }
  }

  // countdown to the next wave / boss
  if (!state.waveActive && state.betweenWaves > 0) {
    state.betweenWaves -= dt;
    if (state.betweenWaves <= 0) {
      if (state.nextBoss) {
        state.nextBoss = false;
        startBossWave(state);
        if (sound) sound.horn();
      } else {
        startWave(state, state.wave + 1);
        if (sound) sound.horn();
      }
    }
  }

  updateFx(state, dt);
}

function updateFx(state, dt) {
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const f of state.floats) {
    f.life -= dt;
    f.y -= 34 * dt;
  }
  state.floats = state.floats.filter((f) => f.life > 0);
}
