// Deterministic screenshot scenes for Tidewarden.
// ?shot=title|play|boss|victory&seed=<n> builds the scene from the
// seeded RNG, runs a fixed amount of simulated time, and leaves the
// game in a stable, readable frame. main.js sets window.__shotReady
// once the frame has been painted.
import { createGame, startWave, startBossWave, update, showBanner } from './sim.js';
import { pointAt } from './sim.js';
import { TOWERS, ENEMIES, PLOTS } from './data.js';

// place towers by plot index + tower id, with free pearls for staging
function stageTowers(state, placements) {
  state.pearls = 100000;
  for (const [plotIdx, towerId, tier] of placements) {
    const def = TOWERS.find((t) => t.id === towerId);
    const plot = PLOTS[plotIdx];
    if (!def || !plot) continue;
    state.pearls -= def.cost;
    const tower = { def, tier: tier || 0, plot: plotIdx, x: plot.x, y: plot.y, cd: 0, angle: -Math.PI / 2, invested: def.cost };
    state.towers.push(tower);
  }
  state.pearls = 640;
}

function spawnAt(state, id, dist, hpMul = 1) {
  const def = ENEMIES[id];
  const hp = Math.round(def.hp * hpMul);
  const p = pointAt(dist);
  const e = { id, def, hp, maxHp: hp, dist, x: p.x, y: p.y, speed: def.speed, slowT: 0, slowMul: 1, boss: false, dead: false };
  state.enemies.push(e);
  return e;
}

function step(state, seconds) {
  const dt = 1 / 60;
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) update(state, dt, null);
}

// A busy mid-wave-7 reef: towers everywhere, enemies all along the
// channel, projectiles in the air, glow visible.
function stagePlay(state) {
  state.screen = 'play';
  stageTowers(state, [
    [0, 'polyp', 1], [2, 'anemone', 2], [3, 'polyp', 0], [4, 'urchin', 1],
    [5, 'song', 1], [6, 'kelp', 2], [7, 'anemone', 0], [8, 'sponge', 1],
    [9, 'urchin', 2], [10, 'kelp', 1], [11, 'polyp', 2], [13, 'song', 0],
    [14, 'sponge', 2], [15, 'anemone', 1], [16, 'urchin', 0],
  ]);
  state.wave = 7;
  state.waveActive = true;
  state.pearls = 486;
  state.lives = 17;
  state.score = 2840;
  state.kills = 213;
  const line = ['mite', 'eel', 'shrimp', 'spore', 'squid', 'ray', 'brute', 'jelly', 'mite', 'eel', 'shrimp', 'spore', 'squid', 'ray', 'mite', 'brute', 'jelly', 'eel', 'shrimp', 'spore', 'mite', 'squid', 'ray', 'eel'];
  line.forEach((id, i) => spawnAt(state, id, 50 + i * 62, 1.9));
  showBanner(state, 'WAVE 7 / 12', 'Gloom Eels hide in the dark — fight them in the glow', 2.5);
  step(state, 2.2);
  state.banner = { text: 'WAVE 7 / 12', sub: 'Gloom Eels hide in the dark — fight them in the glow', t: 2.0, max: 2.5 };
}

// The boss fight: The Bleach at half health mid-channel, heavy action.
function stageBoss(state) {
  state.screen = 'play';
  stageTowers(state, [
    [0, 'polyp', 2], [2, 'anemone', 2], [3, 'urchin', 2], [4, 'song', 2],
    [5, 'kelp', 2], [6, 'sponge', 2], [7, 'anemone', 1], [8, 'urchin', 1],
    [9, 'kelp', 1], [10, 'polyp', 1], [11, 'sponge', 1], [13, 'song', 1],
    [14, 'urchin', 2], [15, 'anemone', 2], [16, 'kelp', 0],
  ]);
  state.wave = 13;
  state.waveActive = true;
  state.bossWave = true;
  state.bossPhase = 1;
  state.pearls = 372;
  state.lives = 14;
  state.score = 6120;
  state.kills = 486;
  const p = pointAt(620);
  const boss = { id: 'boss', def: null, hp: 1540, maxHp: 2800, dist: 620, x: p.x, y: p.y, speed: 24, slowT: 0, slowMul: 1, boss: true, dead: false };
  boss.def = { name: 'The Bleach', hp: 2800, speed: 24, reward: 500, leak: 10, r: 46, color: '#f2ead8', dark: '#8a8272', shadow: false };
  state.enemies.push(boss);
  state.boss = boss;
  ['mite', 'mite', 'eel', 'mite', 'jelly', 'mite'].forEach((id, i) => spawnAt(state, id, 420 + i * 60, 2.2));
  showBanner(state, 'PHASE II — BLEACH BLOOM', 'The Bleach grows paler — and faster', 2.5);
  step(state, 1.2);
  state.banner = { text: 'PHASE II — BLEACH BLOOM', sub: 'The Bleach grows paler — and faster', t: 2.0, max: 2.5 };
  state.boss.hp = 1540; // keep the bar at 55% after the simulated skirmish
}

// The win screen: three stars, full stats, Play Again.
function stageVictory(state) {
  state.screen = 'victory';
  state.victoryStars = 3;
  state.victoryStats = { score: 9840, waves: 12, kills: 512, pearls: 4210, lives: 18 };
  state.score = 9840;
  state.kills = 512;
  state.lives = 18;
  state.wave = 12;
}

// The title screen, with a living reef behind it.
function stageTitle(state) {
  state.screen = 'title';
  state.best = 9840;
  state.time = 6.0;
  const demoTowers = [
    { def: TOWERS[0], tier: 1, plot: -1, x: 380, y: 210, cd: 0, angle: -1.2, invested: 50 },
    { def: TOWERS[1], tier: 2, plot: -1, x: 540, y: 430, cd: 0, angle: -0.6, invested: 80 },
    { def: TOWERS[5], tier: 1, plot: -1, x: 800, y: 440, cd: 0, angle: -2.2, invested: 150 },
    { def: TOWERS[2], tier: 0, plot: -1, x: 200, y: 210, cd: 0, angle: -0.9, invested: 120 },
  ];
  state.demoTowers = demoTowers;
  const mk = (id, dist) => {
    const def = ENEMIES[id];
    const p = pointAt(dist);
    return { id, def, hp: def.hp, maxHp: def.hp, dist, x: p.x, y: p.y, speed: def.speed, slowT: 0, slowMul: 1, boss: false, dead: false };
  };
  state.demoEnemies = [mk('eel', 300), mk('mite', 180), mk('shrimp', 480), mk('spore', 700), mk('jelly', 900)];
}

export function stageShot(scene, seed = 20261116) {
  const state = createGame(seed);
  state.best = 0;
  switch (scene) {
    case 'play': stagePlay(state); break;
    case 'boss': stageBoss(state); break;
    case 'victory': stageVictory(state); break;
    case 'title':
    default: stageTitle(state); break;
  }
  return state;
}
