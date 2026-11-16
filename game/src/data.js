// Tidewarden game data: the reef channel, build plots, glow springs,
// six tower kinds, nine enemy kinds, the twelve waves and the boss.
// All numbers are the tuning the simulation and the renderer share.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const WAVE_COUNT = 12;
export const START_PEARLS = 200;
export const START_LIVES = 20;

// The reef channel the shadow creatures swim along, left edge to the
// Heart Coral on the right. Enemies travel it waypoint by waypoint.
export const PATH = [
  { x: -30, y: 108 },
  { x: 268, y: 108 },
  { x: 268, y: 302 },
  { x: 636, y: 302 },
  { x: 636, y: 548 },
  { x: 986, y: 548 },
  { x: 986, y: 372 },
  { x: 1124, y: 372 },
];

// Where the Heart Coral stands, and how far its pulse of light reaches.
export const HEART = { x: 1168, y: 372, r: 150 };

// Natural glow springs: towers built inside a glow ring fire faster
// and hit harder, and shadow creatures can only be hurt in the light.
export const GLOW_SPOTS = [
  { x: 200, y: 210, r: 118 },
  { x: 470, y: 420, r: 122 },
  { x: 800, y: 440, r: 118 },
];

// Reef plots where towers can be planted. Kept clear of the channel.
export const PLOTS = [
  { x: 120, y: 210 }, { x: 120, y: 420 }, { x: 268, y: 200 },
  { x: 380, y: 108 }, { x: 380, y: 210 }, { x: 470, y: 302 },
  { x: 380, y: 430 }, { x: 540, y: 200 }, { x: 540, y: 430 },
  { x: 636, y: 420 }, { x: 760, y: 302 }, { x: 760, y: 440 },
  { x: 880, y: 640 }, { x: 880, y: 300 }, { x: 1080, y: 250 },
  { x: 1080, y: 480 }, { x: 760, y: 640 }, { x: 200, y: 620 },
];

// kind: 'shot' single target, 'beam' hits several, 'splash' area,
// 'aura' buffs neighbours (weak attack of its own), 'slow' snares.
// tierNames[0] is the base form, tierNames[2] the final form.
export const TOWERS = [
  {
    id: 'polyp', name: 'Spitter Polyp', key: '1', cost: 50,
    range: 118, dmg: 9, rate: 1.7, kind: 'shot', projSpeed: 420,
    color: '#ff7a59', dark: '#c94b32', tierNames: ['Spitter Polyp', 'Gusher Polyp', 'Grand Polyp'],
    upCost: [45, 80], desc: 'Fast single shots. Cheap and reliable.',
  },
  {
    id: 'anemone', name: 'Prism Anemone', key: '2', cost: 80,
    range: 100, dmg: 6, rate: 2.3, kind: 'beam', projSpeed: 520,
    color: '#ff5fa2', dark: '#b83a72', tierNames: ['Prism Anemone', 'Rainbow Anemone', 'Prism Queen'],
    upCost: [70, 120], desc: 'Rainbow bolts strike up to 3 foes.',
  },
  {
    id: 'urchin', name: 'Harpoon Urchin', key: '3', cost: 120,
    range: 178, dmg: 30, rate: 0.65, kind: 'shot', projSpeed: 640, slow: 0.35, slowSecs: 1.2,
    color: '#ffd166', dark: '#b98a1e', tierNames: ['Harpoon Urchin', 'Longspine Urchin', 'Leviathan Urchin'],
    upCost: [100, 170], desc: 'Slow, heavy harpoons that snare.',
  },
  {
    id: 'song', name: 'Song Coral', key: '4', cost: 100,
    range: 128, dmg: 4, rate: 1.1, kind: 'aura', projSpeed: 380,
    color: '#7ef0d4', dark: '#2f9e86', tierNames: ['Song Coral', 'Choir Coral', 'Grand Choir'],
    upCost: [85, 140], desc: 'Sings: nearby towers fire 25% faster.',
  },
  {
    id: 'kelp', name: 'Ink Kelp', key: '5', cost: 90,
    range: 108, dmg: 5, rate: 1.0, kind: 'splash', projSpeed: 300, splashR: 62,
    color: '#b388ff', dark: '#6d4bb0', tierNames: ['Ink Kelp', 'Abyss Kelp', 'Inkforest Kelp'],
    upCost: [75, 130], desc: 'Ink bursts splash whole groups.',
  },
  {
    id: 'sponge', name: 'Sun Sponge', key: '6', cost: 150,
    range: 138, dmg: 15, rate: 1.1, kind: 'shot', projSpeed: 460, glowR: 96,
    color: '#ffe066', dark: '#c9a227', tierNames: ['Sun Sponge', 'Dawn Sponge', 'Solar Sponge'],
    upCost: [120, 200], desc: 'Burns shadow foes. Casts its own glow.',
  },
];

// shadow: can only be damaged while standing in glow light.
// regen: heals a little every second. splits: births mites on death.
export const ENEMIES = {
  mite:   { name: 'Bleach Mite',   hp: 22,  speed: 58, reward: 4,  leak: 1, r: 11, color: '#e8e4d8', dark: '#9a9484', shadow: false },
  eel:    { name: 'Gloom Eel',     hp: 38,  speed: 78, reward: 6,  leak: 1, r: 12, color: '#5a4a8a', dark: '#33255e', shadow: true },
  shrimp: { name: 'Glass Shrimp',  hp: 28,  speed: 98, reward: 5,  leak: 1, r: 10, color: '#aee9ff', dark: '#5fa8c9', shadow: false },
  spore:  { name: 'Spore Drifter', hp: 52,  speed: 42, reward: 8,  leak: 1, r: 14, color: '#9dff6e', dark: '#4d9e2e', shadow: false, splits: true },
  squid:  { name: 'Ink Squid',     hp: 78,  speed: 62, reward: 10, leak: 1, r: 15, color: '#3d3552', dark: '#171224', shadow: false },
  brute:  { name: 'Brine Brute',   hp: 175, speed: 33, reward: 16, leak: 2, r: 19, color: '#ff8a5c', dark: '#a34a24', shadow: false },
  ray:    { name: 'Thorn Ray',     hp: 95,  speed: 72, reward: 12, leak: 1, r: 14, color: '#ff5d73', dark: '#a32e40', shadow: false },
  jelly:  { name: 'Murk Jelly',    hp: 130, speed: 46, reward: 14, leak: 1, r: 16, color: '#7a6cff', dark: '#453a9e', shadow: true, regen: 2.5 },
  maw:    { name: 'Abyssal Maw',   hp: 340, speed: 29, reward: 40, leak: 3, r: 22, color: '#1c2438', dark: '#05070f', shadow: false },
};

export const BOSS = {
  name: 'The Bleach', hp: 2800, speed: 24, reward: 500, leak: 10, r: 46,
  color: '#f2ead8', dark: '#8a8272',
  phases: [
    { at: 1.0, name: 'Phase I — Pale Tide', speedMul: 1.0 },
    { at: 0.66, name: 'Phase II — Bleach Bloom', speedMul: 1.35 },
    { at: 0.33, name: 'Phase III — Whiteout', speedMul: 1.7 },
  ],
};

// Wave composition: [enemyId, count] pairs. Counts grow with the wave;
// hit points scale by 1 + (wave-1) * 0.14 and speed by 1 + (wave-1) * 0.02.
export function buildWave(n) {
  const w = [];
  const add = (id, count) => { if (count > 0) w.push([id, count]); };
  add('mite', 6 + n * 2);
  add('shrimp', n >= 2 ? 3 + n : 0);
  add('eel', n >= 3 ? 2 + n : 0);
  add('spore', n >= 4 ? 2 + Math.floor(n / 2) : 0);
  add('squid', n >= 5 ? 2 + Math.floor(n / 2) : 0);
  add('ray', n >= 6 ? 2 + Math.floor(n / 3) : 0);
  add('brute', n >= 7 ? 1 + Math.floor(n / 3) : 0);
  add('jelly', n >= 8 ? 1 + Math.floor(n / 3) : 0);
  add('maw', n >= 9 ? Math.floor((n - 8) / 2) + (n === 12 ? 1 : 0) : 0);
  return w;
}

export function waveHpMul(n) {
  return 1 + (n - 1) * 0.14;
}

export function waveSpeedMul(n) {
  return 1 + (n - 1) * 0.02;
}

export function waveBonus(n) {
  return 40 + n * 6;
}
