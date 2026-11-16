// Tidewarden bootstrap: canvas setup, input, the fixed-step loop,
// screen flow (title → play → victory / defeat), and the ?shot=
// deterministic scenes used for screenshots.
import { VIEW_W, VIEW_H, TOWERS, PLOTS, WAVE_COUNT, ENEMIES } from './data.js';
import { createGame, resetRun, startWave, update, placeTower, upgradeTower, sellTower, pointAt } from './sim.js';
import { render, towerCardRect, startWaveRect, panelRect, panelButtons, titleButtons, endButtons } from './render.js';
import { SoundEngine } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const sound = new SoundEngine();

const params = new URLSearchParams(location.search);
const shotScene = params.get('shot');
const seed = parseInt(params.get('seed') || '20261116', 10) || 20261116;

let state;
let best = 0;
try { best = parseInt(localStorage.getItem('tidewarden-best') || '0', 10) || 0; } catch (e) { best = 0; }

const ui = { mouse: { x: -100, y: -100 } };
let shotMode = false;

function saveBest() {
  if (state.score > best) {
    best = state.score;
    try { localStorage.setItem('tidewarden-best', String(best)); } catch (e) { /* storage unavailable */ }
  }
  state.best = best;
}

function newRun() {
  state = resetRun(createGame(seed));
  state.best = best;
  state.screen = 'play';
  state.wave = 0;
  state.betweenWaves = 1.2;
  state.nextBoss = false;
  startWave(state, 1);
  sound.ensure();
}

function toTitle() {
  const keepBest = best;
  state = createGame(seed);
  state.best = keepBest;
  state.screen = 'title';
  seedTitleDemo(state);
}

function seedTitleDemo(s) {
  // A living reef behind the title: a few towers and swimmers.
  s.demoTowers = [
    { def: TOWERS[0], tier: 1, plot: -1, x: 380, y: 210, cd: 0, angle: -1.2, invested: 50 },
    { def: TOWERS[1], tier: 2, plot: -1, x: 540, y: 430, cd: 0, angle: -0.6, invested: 80 },
    { def: TOWERS[5], tier: 1, plot: -1, x: 800, y: 440, cd: 0, angle: -2.2, invested: 150 },
    { def: TOWERS[2], tier: 0, plot: -1, x: 200, y: 210, cd: 0, angle: -0.9, invested: 120 },
  ];
  const mk = (id, dist) => {
    const def = ENEMIES[id];
    const p = pointAt(dist);
    return { id, def, hp: def.hp, maxHp: def.hp, dist, x: p.x, y: p.y, speed: def.speed, slowT: 0, slowMul: 1, boss: false, dead: false };
  };
  s.demoEnemies = [mk('eel', 300), mk('mite', 180), mk('shrimp', 480), mk('spore', 700), mk('jelly', 900)];
}

if (shotScene) {
  shotMode = true;
  state = stageShot(shotScene, seed);
  state.best = shotScene === 'title' ? 9840 : best;
} else {
  state = createGame(seed);
  state.best = best;
  state.screen = 'title';
  seedTitleDemo(state);
}

// ---- input ----
function canvasPos(ev) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - r.left) / r.width) * VIEW_W,
    y: ((ev.clientY - r.top) / r.height) * VIEW_H,
  };
}

function inside(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

canvas.addEventListener('mousemove', (ev) => {
  ui.mouse = canvasPos(ev);
});

canvas.addEventListener('click', (ev) => {
  if (shotMode) return;
  sound.ensure();
  const p = canvasPos(ev);
  handleClick(p);
});

function handleClick(p) {
  if (state.screen === 'title') {
    const b = titleButtons();
    if (inside(p, b.play)) { sound.click(); newRun(); return; }
    if (inside(p, b.how)) { sound.click(); state.screen = 'howto'; return; }
    return;
  }
  if (state.screen === 'howto') {
    if (state.howBackRect && inside(p, state.howBackRect)) { sound.click(); state.screen = 'title'; }
    return;
  }
  if (state.screen === 'victory' || state.screen === 'defeat') {
    const b = endButtons();
    if (inside(p, b.again)) { sound.click(); newRun(); return; }
    if (inside(p, b.title)) { sound.click(); toTitle(); return; }
    return;
  }
  if (state.screen !== 'play') return;
  if (state.paused) {
    if (state.pauseResumeRect && inside(p, state.pauseResumeRect)) { state.paused = false; sound.click(); }
    return;
  }
  // selected-tower panel buttons
  if (state.selectedTower) {
    const b = panelButtons();
    if (inside(p, b.upgrade)) { upgradeTower(state, state.selectedTower, sound); return; }
    if (inside(p, b.sell)) { sellTower(state, state.selectedTower, sound); return; }
    if (inside(p, b.close)) { state.selectedTower = null; return; }
    if (inside(p, panelRect())) return;
  }
  // tower cards
  for (let i = 0; i < TOWERS.length; i++) {
    if (inside(p, towerCardRect(i))) {
      state.buildChoice = TOWERS[i].id;
      state.selectedTower = null;
      sound.click();
      return;
    }
  }
  // start-wave button
  if (inside(p, startWaveRect())) {
    if (!state.waveActive) {
      state.betweenWaves = 0;
      if (state.wave >= WAVE_COUNT && !state.nextBoss && state.waveActive === false) {
        state.nextBoss = true;
        state.betweenWaves = 0.01;
      } else if (state.wave < WAVE_COUNT) {
        state.betweenWaves = 0.01;
      }
      sound.horn();
    }
    return;
  }
  // click a placed tower to select it
  for (const t of state.towers) {
    if (Math.hypot(p.x - t.x, p.y - t.y) <= 24) {
      state.selectedTower = t;
      state.selectedPlot = -1;
      sound.click();
      return;
    }
  }
  // click a plot to build
  for (let i = 0; i < PLOTS.length; i++) {
    const pl = PLOTS[i];
    if (Math.hypot(p.x - pl.x, p.y - pl.y) <= 24) {
      if (state.towers.some((t) => t.plot === i)) return;
      if (placeTower(state, i, state.buildChoice, sound)) {
        state.selectedPlot = -1;
      } else {
        state.selectedPlot = i;
        sound.click();
      }
      return;
    }
  }
  state.selectedTower = null;
  state.selectedPlot = -1;
}

window.addEventListener('keydown', (ev) => {
  if (shotMode) return;
  const k = ev.key.toLowerCase();
  if (k >= '1' && k <= '6') {
    const def = TOWERS[parseInt(k, 10) - 1];
    if (def) { state.buildChoice = def.id; state.selectedTower = null; sound.ensure(); sound.click(); }
    return;
  }
  if (k === ' ') {
    ev.preventDefault();
    if (state.screen === 'play') { state.paused = !state.paused; sound.ensure(); }
    else if (state.screen === 'title') newRun();
    return;
  }
  if (k === 'escape') {
    if (state.screen === 'play') {
      if (state.selectedTower || state.selectedPlot >= 0) { state.selectedTower = null; state.selectedPlot = -1; }
      else state.paused = !state.paused;
    } else if (state.screen === 'howto') state.screen = 'title';
    return;
  }
  if (k === 'r') {
    if (state.screen === 'play' || state.screen === 'victory' || state.screen === 'defeat') newRun();
    return;
  }
  if (k === 'm') {
    sound.ensure();
    sound.setMuted(!sound.muted);
    return;
  }
  if (k === 'enter') {
    if (state.screen === 'title') newRun();
    else if (state.screen === 'victory' || state.screen === 'defeat') newRun();
  }
});

// ---- loop: fixed 1/60 s simulation, render every frame ----
let last = performance.now();
let acc = 0;
let frames = 0;

function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!shotMode) {
    acc += dt;
    const step = 1 / 60;
    let guard = 0;
    while (acc >= step && guard < 5) {
      update(state, step, sound);
      acc -= step;
      guard++;
    }
    if (state.screen === 'victory' || state.screen === 'defeat') {
      if (!state.bestSaved) { saveBest(); state.bestSaved = true; }
      state.best = best;
    }
  }
  render(ctx, state, ui);
  frames++;
  if (shotMode && frames >= 2) {
    window.__shotReady = true;
  }
  requestAnimationFrame(frame);
}

window.__game = { get state() { return state; }, newRun, toTitle, sound };
requestAnimationFrame(frame);
