// Tidewarden renderer: everything the player sees, drawn on one canvas.
// The reef is painted fresh every frame from the seeded decoration so
// screenshots are stable for a given seed.
import { VIEW_W, VIEW_H, PATH, PLOTS, HEART, TOWERS, WAVE_COUNT, START_LIVES } from './data.js';
import { pointAt, glowZones, inGlow, towerStats, upgradeCost, sellValue } from './sim.js';

export const HUD_H = 56;
export const BAR_Y = 648;
export const CARD_W = 148;
export const CARD_GAP = 10;
export const CARD_X0 = 28;

export function towerCardRect(i) {
  return { x: CARD_X0 + i * (CARD_W + CARD_GAP), y: BAR_Y + 8, w: CARD_W, h: 56 };
}

export function startWaveRect() {
  return { x: VIEW_W - 228, y: BAR_Y + 8, w: 200, h: 56 };
}

export function panelRect() {
  return { x: 996, y: 84, w: 256, h: 218 };
}

export function panelButtons() {
  const p = panelRect();
  return {
    upgrade: { x: p.x + 14, y: p.y + 138, w: 106, h: 34 },
    sell: { x: p.x + 136, y: p.y + 138, w: 106, h: 34 },
    close: { x: p.x + 222, y: p.y + 8, w: 26, h: 26 },
  };
}

export function titleButtons() {
  return {
    play: { x: VIEW_W / 2 - 150, y: 430, w: 300, h: 64 },
    how: { x: VIEW_W / 2 - 150, y: 508, w: 300, h: 48 },
  };
}

export function endButtons() {
  return {
    again: { x: VIEW_W / 2 - 150, y: 540, w: 300, h: 60 },
    title: { x: VIEW_W / 2 - 150, y: 612, w: 300, h: 40 },
  };
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(ctx, s, x, y, size, color, align = 'left', weight = 700) {
  ctx.font = `${weight} ${size}px Trebuchet MS, Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function textShadow(ctx, s, x, y, size, color, align = 'left', weight = 800) {
  ctx.font = `${weight} ${size}px Trebuchet MS, Verdana, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(2,20,28,0.85)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

// ---- backdrop ----
function drawBackground(ctx, state) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, '#062e3d');
  g.addColorStop(0.55, '#0a4a5e');
  g.addColorStop(1, '#04222e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // sun shafts from the surface
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = '#bff3ff';
  for (let i = 0; i < 5; i++) {
    const x = 120 + i * 260 + Math.sin(state.time * 0.2 + i) * 20;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 90, 0);
    ctx.lineTo(x + 190, VIEW_H);
    ctx.lineTo(x + 60, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // sandy floor patches
  ctx.fillStyle = 'rgba(214,178,120,0.16)';
  for (const s of [[90, 640, 260, 46], [560, 660, 300, 40], [1020, 620, 200, 44], [300, 60, 220, 30]]) {
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], s[2] / 2, s[3] / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // seeded reef decoration
  for (const c of state.decor.corals) {
    drawCoral(ctx, c.x, c.y, c.s, c.kind, c.hue, state.time);
  }

  // the channel: dark water lane with sandy rims
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = 'rgba(220,190,130,0.55)';
  ctx.lineWidth = 46;
  ctx.stroke();
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = '#0d3a4a';
  ctx.lineWidth = 36;
  ctx.stroke();
  ctx.beginPath();
  PATH.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.setLineDash([10, 16]);
  ctx.strokeStyle = 'rgba(140,220,240,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // glow zones: soft light pools on the reef
  for (const z of glowZones(state)) {
    const rg = ctx.createRadialGradient(z.x, z.y, 4, z.x, z.y, z.r);
    rg.addColorStop(0, 'rgba(255,240,170,0.30)');
    rg.addColorStop(0.6, 'rgba(120,230,200,0.14)');
    rg.addColorStop(1, 'rgba(120,230,200,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // bubbles
  ctx.fillStyle = 'rgba(190,235,255,0.35)';
  for (const b of state.decor.bubbles) {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCoral(ctx, x, y, s, kind, hue, t) {
  const cols = ['#ff7a59', '#ff5fa2', '#7ef0d4', '#b388ff', '#ffd166'];
  const col = cols[Math.floor(hue * cols.length) % cols.length];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.globalAlpha = 0.75;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 3;
  if (kind === 'branch') {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(i * 7, -14 - Math.abs(i) * 2, i * 11, -26 - Math.abs(i) * 3);
      ctx.stroke();
    }
  } else if (kind === 'fan') {
    ctx.beginPath();
    ctx.arc(0, 0, 16, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-16, 0);
    ctx.lineTo(16, 0);
    ctx.lineTo(0, 0);
    ctx.fill();
  } else if (kind === 'tube') {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(i * 9, -10, 4, 12 + Math.sin(t + i) * 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.ellipse(0, -4, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ---- the Heart Coral ----
function drawHeart(ctx, state) {
  const pulse = 1 + 0.06 * Math.sin(state.time * 1.5);
  const x = HEART.x;
  const y = HEART.y;
  const rg = ctx.createRadialGradient(x, y, 6, x, y, 90 * pulse);
  rg.addColorStop(0, 'rgba(255,120,160,0.55)');
  rg.addColorStop(1, 'rgba(255,120,160,0)');
  ctx.fillStyle = rg;
  ctx.beginPath();
  ctx.arc(x, y, 90 * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#ff5f8f';
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + state.time * 0.1;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * 20, Math.sin(a) * 20 - 4, 12, 20, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(0, -4, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(0, -4, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  text(ctx, '♥ HEART CORAL', x, y + 58, 13, '#ffb3c6', 'center');
}

// ---- towers ----
function drawTower(ctx, state, t, hover) {
  const st = towerStats(t.def, t.tier);
  const glowing = inGlow(state, t.x, t.y);
  if (hover) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, st.range, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,240,170,0.10)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,170,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (glowing) {
    const rg = ctx.createRadialGradient(t.x, t.y, 4, t.x, t.y, 44);
    rg.addColorStop(0, 'rgba(255,240,170,0.4)');
    rg.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(t.x, t.y, 44, 0, Math.PI * 2);
    ctx.fill();
  }
  // plot base
  ctx.fillStyle = '#0a3542';
  ctx.beginPath();
  ctx.ellipse(t.x, t.y + 12, 22, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(140,220,240,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.save();
  ctx.translate(t.x, t.y);
  const col = t.def.color;
  const dark = t.def.dark;
  if (t.def.id === 'polyp') {
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(0, 2, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, 14, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.sin(state.time * 2 + i) * 0.15;
      ctx.fillStyle = '#ffd9c9';
      ctx.beginPath(); ctx.arc(Math.cos(a) * 17, Math.sin(a) * 17 - 2, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#3d0a0a';
    ctx.beginPath(); ctx.arc(Math.cos(t.angle) * 6, Math.sin(t.angle) * 6, 5, 0, Math.PI * 2); ctx.fill();
  } else if (t.def.id === 'anemone') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + state.time * 0.4;
      ctx.fillStyle = i % 2 ? '#ff8fb8' : col;
      ctx.beginPath(); ctx.ellipse(Math.cos(a) * 14, Math.sin(a) * 14, 5, 10, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
  } else if (t.def.id === 'urchin') {
    ctx.fillStyle = dark;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24);
      ctx.lineTo(Math.cos(a + 0.12) * 8, Math.sin(a + 0.12) * 8);
      ctx.fill();
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
  } else if (t.def.id === 'song') {
    ctx.strokeStyle = col;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 8);
      ctx.quadraticCurveTo(i * 8, -8, i * 12, -22 - Math.abs(i) * -2 + Math.sin(state.time * 3 + i) * 2);
      ctx.stroke();
    }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(0, 8, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 15px Trebuchet MS, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('♪', 14, -18 + Math.sin(state.time * 2) * 3);
  } else if (t.def.id === 'kelp') {
    ctx.strokeStyle = col;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      const sway = Math.sin(state.time * 1.8 + i * 1.3) * 6;
      ctx.beginPath();
      ctx.moveTo(i * 7, 10);
      ctx.quadraticCurveTo(i * 7 + sway, -10, i * 9 + sway * 1.4, -26);
      ctx.stroke();
    }
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.ellipse(0, 10, 16, 6, 0, 0, Math.PI * 2); ctx.fill();
  } else {
    // sponge
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark;
    for (const [hx, hy] of [[-7, -5], [6, -7], [0, 4], [-2, -11], [9, 5]]) {
      ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(-5, -8, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();

  // tier pips
  for (let i = 0; i <= t.tier; i++) {
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.arc(t.x - 10 + i * 10, t.y + 24, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (t.def.id === 'song') {
    ctx.strokeStyle = 'rgba(126,240,212,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(t.x, t.y, st.range, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ---- enemies ----
function drawEnemy(ctx, state, e) {
  const d = e.def;
  const wob = Math.sin(state.time * 6 + e.dist * 0.05) * 2;
  ctx.save();
  ctx.translate(e.x, e.y + wob * 0.4);
  if (d.shadow && !inGlow(state, e.x, e.y)) {
    ctx.globalAlpha = 0.55;
    ctx.shadowColor = '#7a6cff';
    ctx.shadowBlur = 14;
  }
  if (e.boss) {
    const frac = e.hp / e.maxHp;
    ctx.fillStyle = frac > 0.66 ? d.color : frac > 0.33 ? '#e8dcc8' : '#ffffff';
    ctx.beginPath(); ctx.arc(0, 0, e.def.r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8a8272';
    ctx.lineWidth = 4;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + state.time * 0.15;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 30);
      ctx.lineTo(Math.cos(a) * 58, Math.sin(a) * 58);
      ctx.stroke();
    }
    ctx.fillStyle = '#1c2438';
    ctx.beginPath(); ctx.arc(-14, -8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -8, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5d73';
    ctx.beginPath(); ctx.arc(-14, -8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(14, -8, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c2438';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 12, 16, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  } else if (e.id === 'eel') {
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 6; i++) {
      const px = -16 + i * 5.5;
      const py = Math.sin(state.time * 8 + i * 0.9 + e.dist * 0.08) * 5;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = '#e8e4ff';
    ctx.beginPath(); ctx.arc(17, 0, 3, 0, Math.PI * 2); ctx.fill();
  } else if (e.id === 'shrimp') {
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-20, -6); ctx.lineTo(-20, 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#062e3d';
    ctx.beginPath(); ctx.arc(8, -2, 2, 0, Math.PI * 2); ctx.fill();
  } else if (e.id === 'squid') {
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(0, -2, 13, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 3;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 3.5, 6);
      ctx.quadraticCurveTo(i * 4.5, 14, i * 3 + Math.sin(state.time * 5 + i) * 3, 19);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-5, -4, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -4, 2.5, 0, Math.PI * 2); ctx.fill();
  } else if (e.id === 'ray') {
    const flap = Math.sin(state.time * 7 + e.dist * 0.06) * 6;
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.quadraticCurveTo(-20, -14 - flap, -26, 2);
    ctx.quadraticCurveTo(-10, 8, 0, 6);
    ctx.quadraticCurveTo(10, 8, 26, 2);
    ctx.quadraticCurveTo(20, -14 - flap, 0, -6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(6, -2, 2, 0, Math.PI * 2); ctx.fill();
  } else if (e.id === 'jelly') {
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(0, 0, 14, Math.PI, 0); ctx.fill();
    ctx.strokeStyle = d.dark;
    ctx.lineWidth = 2.5;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5, 10);
      ctx.quadraticCurveTo(i * 6 + Math.sin(state.time * 4 + i) * 4, 18, i * 5, 24);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.beginPath(); ctx.arc(-4, -3, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -5, 2, 0, Math.PI * 2); ctx.fill();
  } else if (e.id === 'maw') {
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff5d73';
    ctx.beginPath(); ctx.arc(4, 2, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 9 + 4, Math.sin(a) * 9 + 2, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(-8, -8, 3, 0, Math.PI * 2); ctx.fill();
  } else {
    // mite / spore / brute: round body, spikes for brute, dots for spore
    ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(0, 0, d.r, 0, Math.PI * 2); ctx.fill();
    if (e.id === 'brute') {
      ctx.strokeStyle = d.dark;
      ctx.lineWidth = 3;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
        ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(-6, -4, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(7, -4, 3, 0, Math.PI * 2); ctx.fill();
    } else if (e.id === 'spore') {
      ctx.fillStyle = d.dark;
      for (const [sx, sy] of [[-5, -4], [5, 3], [0, -8]]) {
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = d.dark;
      ctx.beginPath(); ctx.arc(-4, -3, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, -3, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  // slow tint
  if (e.slowT > 0) {
    ctx.strokeStyle = 'rgba(140,220,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, d.r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }
  // hp bar for hurt foes
  if (e.hp < e.maxHp) {
    const w = e.boss ? 90 : 30;
    const frac = Math.max(0, e.hp / e.maxHp);
    ctx.fillStyle = 'rgba(2,20,28,0.8)';
    ctx.fillRect(e.x - w / 2, e.y - e.def.r - 12, w, 5);
    ctx.fillStyle = frac > 0.5 ? '#7ef0d4' : frac > 0.25 ? '#ffd166' : '#ff5d73';
    ctx.fillRect(e.x - w / 2, e.y - e.def.r - 12, w * frac, 5);
  }
}

// ---- HUD ----
function drawHud(ctx, state) {
  ctx.fillStyle = 'rgba(3,26,36,0.88)';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = 'rgba(126,240,212,0.25)';
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);

  text(ctx, '◉ ' + state.pearls, 24, 30, 22, '#ffe066');
  text(ctx, 'PEARLS', 24, 48, 10, '#9fb7c9');
  text(ctx, '♥'.repeat(Math.min(state.lives, 20)) + (state.lives > 20 ? ` ${state.lives}` : ''), 190, 26, 20, '#ff5f8f');
  text(ctx, `LIVES ${state.lives}`, 190, 48, 10, '#9fb7c9');
  text(ctx, state.bossWave ? 'BOSS' : `WAVE ${Math.max(1, state.wave)}/${WAVE_COUNT}`, 470, 30, 22, '#ffffff');
  text(ctx, state.waveActive ? 'ENEMIES INCOMING' : state.betweenWaves > 0 ? `NEXT WAVE IN ${Math.ceil(state.betweenWaves)}` : 'READY', 470, 48, 10, '#9fb7c9');
  text(ctx, 'SCORE ' + state.score, 700, 30, 22, '#ffffff');
  text(ctx, `KILLS ${state.kills}  ·  BEST ${state.best}`, 700, 48, 10, '#9fb7c9');
  text(ctx, 'TIDEWARDEN', 1000, 26, 20, '#7ef0d4');
  text(ctx, 'defend the last coral reef', 1000, 46, 11, '#9fb7c9');

  // boss hp bar
  if (state.bossWave && state.boss) {
    const bw = 520;
    const bx = VIEW_W / 2 - bw / 2;
    const by = HUD_H + 12;
    const frac = Math.max(0, state.boss.hp / state.boss.maxHp);
    ctx.fillStyle = 'rgba(2,20,28,0.85)';
    rr(ctx, bx - 6, by - 6, bw + 12, 34, 8);
    ctx.fill();
    ctx.fillStyle = '#2a1a24';
    rr(ctx, bx, by, bw, 16, 6);
    ctx.fill();
    const bg = ctx.createLinearGradient(bx, by, bx + bw, by);
    bg.addColorStop(0, '#ff5d73');
    bg.addColorStop(1, '#ffd166');
    ctx.fillStyle = bg;
    if (frac > 0) { rr(ctx, bx, by, bw * frac, 16, 6); ctx.fill(); }
    text(ctx, `THE BLEACH  ·  ${Math.ceil(state.boss.hp)} / ${state.boss.maxHp}`, VIEW_W / 2, by + 8, 13, '#ffffff', 'center');
  }
}

function trunc(ctx, s, maxW) {
  if (ctx.measureText(s).width <= maxW) return s;
  let out = s;
  while (out.length > 1 && ctx.measureText(out + '…').width > maxW) out = out.slice(0, -1);
  return out + '…';
}

function drawBuildBar(ctx, state, ui) {
  ctx.fillStyle = 'rgba(3,26,36,0.88)';
  ctx.fillRect(0, BAR_Y, VIEW_W, VIEW_H - BAR_Y);
  ctx.fillStyle = 'rgba(126,240,212,0.25)';
  ctx.fillRect(0, BAR_Y, VIEW_W, 2);
  TOWERS.forEach((def, i) => {
    const r = towerCardRect(i);
    const afford = state.pearls >= def.cost;
    const sel = state.buildChoice === def.id;
    const hov = ui.mouse.x >= r.x && ui.mouse.x <= r.x + r.w && ui.mouse.y >= r.y && ui.mouse.y <= r.y + r.h;
    ctx.fillStyle = sel ? 'rgba(126,240,212,0.28)' : hov ? 'rgba(126,240,212,0.14)' : 'rgba(10,53,66,0.9)';
    rr(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.strokeStyle = sel ? '#7ef0d4' : 'rgba(140,220,240,0.3)';
    ctx.lineWidth = sel ? 2.5 : 1.5;
    ctx.stroke();
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(r.x + 20, r.y + 18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#062e3d';
    ctx.font = '800 11px Trebuchet MS, Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.key, r.x + 20, r.y + 18);
    ctx.font = '700 12.5px Trebuchet MS, Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(trunc(ctx, def.name, r.w - 44), r.x + 36, r.y + 15);
    text(ctx, `◉ ${def.cost}  ·  R${def.range} D${def.dmg}`, r.x + 36, r.y + 32, 11, afford ? '#ffe066' : '#ff8a8a');
    ctx.font = '400 10.5px Trebuchet MS, Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#9fb7c9';
    ctx.fillText(trunc(ctx, def.desc, r.w - 16), r.x + 10, r.y + 47);
  });
  const sw = startWaveRect();
  const canStart = !state.waveActive && state.screen === 'play';
  ctx.fillStyle = canStart ? '#ff7a59' : 'rgba(60,80,90,0.9)';
  rr(ctx, sw.x, sw.y, sw.w, sw.h, 8);
  ctx.fill();
  text(ctx, state.waveActive ? 'WAVE RUNNING…' : state.wave >= WAVE_COUNT ? 'SUMMON THE BLEACH' : `START WAVE ${state.wave + 1}`, sw.x + sw.w / 2, sw.y + 28, 15, '#ffffff', 'center');
}

function drawSelectedPanel(ctx, state, ui) {
  const t = state.selectedTower;
  if (!t) return;
  const p = panelRect();
  const b = panelButtons();
  ctx.fillStyle = 'rgba(3,26,36,0.92)';
  rr(ctx, p.x, p.y, p.w, p.h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(126,240,212,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, t.def.tierNames[t.tier], p.x + 14, p.y + 24, 17, '#ffffff');
  text(ctx, `Tier ${t.tier + 1} / 3  ·  ${t.def.name}`, p.x + 14, p.y + 46, 11, '#9fb7c9');
  const st = towerStats(t.def, t.tier);
  text(ctx, `Damage ${st.dmg}   Range ${st.range}`, p.x + 14, p.y + 72, 13, '#bfe9d8');
  text(ctx, `Rate ${st.rate.toFixed(1)}/s   Invested ◉${t.invested}`, p.x + 14, p.y + 94, 13, '#bfe9d8');
  text(ctx, inGlow(state, t.x, t.y) ? '✦ IN THE GLOW — +50% fire rate, +25% damage' : '○ Outside the glow — build near light', p.x + 14, p.y + 116, 11, inGlow(state, t.x, t.y) ? '#ffe066' : '#9fb7c9');
  const upCost = t.tier < 2 ? upgradeCost(t.def, t.tier) : null;
  const affordUp = upCost !== null && state.pearls >= upCost;
  ctx.fillStyle = upCost === null ? 'rgba(60,80,90,0.9)' : affordUp ? '#2f9e86' : 'rgba(120,60,60,0.9)';
  rr(ctx, b.upgrade.x, b.upgrade.y, b.upgrade.w, b.upgrade.h, 6);
  ctx.fill();
  text(ctx, upCost === null ? 'MAX TIER' : `UPGRADE ◉${upCost}`, b.upgrade.x + b.upgrade.w / 2, b.upgrade.y + 17, 12, '#ffffff', 'center');
  ctx.fillStyle = '#8a5a2e';
  rr(ctx, b.sell.x, b.sell.y, b.sell.w, b.sell.h, 6);
  ctx.fill();
  text(ctx, `SELL ◉${sellValue(t)}`, b.sell.x + b.sell.w / 2, b.sell.y + 17, 12, '#ffffff', 'center');
  text(ctx, '×', b.close.x + 13, b.close.y + 13, 16, '#9fb7c9', 'center');
  text(ctx, 'Click a tower to select it · Esc to close', p.x + 14, p.y + 196, 10.5, '#9fb7c9');
}

function drawBanner(ctx, state) {
  if (!state.banner) return;
  const a = Math.min(1, state.banner.t / 0.4, (state.banner.max - state.banner.t) / 0.25 + 0.2);
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  textShadow(ctx, state.banner.text, VIEW_W / 2, 190, 44, '#ffffff', 'center');
  if (state.banner.sub) textShadow(ctx, state.banner.sub, VIEW_W / 2, 232, 18, '#ffe066', 'center');
  ctx.restore();
}

function drawPlots(ctx, state, ui) {
  for (let i = 0; i < PLOTS.length; i++) {
    const p = PLOTS[i];
    const occupied = state.towers.some((t) => t.plot === i);
    if (occupied) continue;
    const hov = ui.mouse.x >= p.x - 22 && ui.mouse.x <= p.x + 22 && ui.mouse.y >= p.y - 22 && ui.mouse.y <= p.y + 22;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 10, 20, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = hov ? 'rgba(126,240,212,0.35)' : 'rgba(10,53,66,0.8)';
    ctx.fill();
    ctx.strokeStyle = hov ? '#7ef0d4' : 'rgba(140,220,240,0.35)';
    ctx.lineWidth = hov ? 2.5 : 1.5;
    ctx.stroke();
    text(ctx, '+', p.x, p.y + 9, 18, hov ? '#7ef0d4' : 'rgba(160,210,225,0.7)', 'center');
    if (state.selectedPlot === i) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 30, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

// ---- screens ----
function drawTitle(ctx, state, ui) {
  drawBackground(ctx, state);
  // demo reef: a few towers and swimmers drift behind the title
  for (const t of state.demoTowers || []) drawTower(ctx, state, t, false);
  for (const e of state.demoEnemies || []) drawEnemy(ctx, state, e);
  ctx.fillStyle = 'rgba(3,20,28,0.45)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  textShadow(ctx, 'TIDEWARDEN', VIEW_W / 2, 170, 84, '#7ef0d4', 'center');
  textShadow(ctx, 'DEFEND THE LAST CORAL REEF', VIEW_W / 2, 238, 26, '#ffe066', 'center');
  textShadow(ctx, 'Shadow creatures swim the channel to bleach the Heart Coral.', VIEW_W / 2, 300, 18, '#ffffff', 'center');
  textShadow(ctx, 'Build glowing towers. Hold 12 waves. Face The Bleach.', VIEW_W / 2, 330, 18, '#ffffff', 'center');
  const b = titleButtons();
  const hovPlay = ui.mouse.x >= b.play.x && ui.mouse.x <= b.play.x + b.play.w && ui.mouse.y >= b.play.y && ui.mouse.y <= b.play.y + b.play.h;
  ctx.fillStyle = hovPlay ? '#ff8a66' : '#ff7a59';
  rr(ctx, b.play.x, b.play.y, b.play.w, b.play.h, 12);
  ctx.fill();
  text(ctx, '▶  PLAY', b.play.x + b.play.w / 2, b.play.y + 33, 26, '#ffffff', 'center');
  ctx.fillStyle = 'rgba(10,53,66,0.9)';
  rr(ctx, b.how.x, b.how.y, b.how.w, b.how.h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(126,240,212,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, 'HOW TO PLAY', b.how.x + b.how.w / 2, b.how.y + 25, 17, '#7ef0d4', 'center');
  if (state.best > 0) text(ctx, `BEST SCORE  ${state.best}`, VIEW_W / 2, 596, 17, '#ffe066', 'center');
  text(ctx, 'Mouse to build · Keys 1–6 pick a tower · Space pauses · M mutes', VIEW_W / 2, 640, 14, '#9fb7c9', 'center');
}

function drawHowTo(ctx, state, ui) {
  drawBackground(ctx, state);
  ctx.fillStyle = 'rgba(3,20,28,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const px = 290;
  const py = 110;
  const pw = 700;
  const ph = 480;
  ctx.fillStyle = 'rgba(3,26,36,0.95)';
  rr(ctx, px, py, pw, ph, 14);
  ctx.fill();
  ctx.strokeStyle = 'rgba(126,240,212,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, 'HOW TO PLAY', VIEW_W / 2, py + 36, 28, '#7ef0d4', 'center');
  const lines = [
    ['GOAL', 'Stop the shadow creatures before they reach the Heart Coral. Lose all 20 lives and the reef bleaches.'],
    ['BUILD', 'Click a glowing reef plot, then click a tower card (or press 1–6). Towers cost pearls.'],
    ['GLOW', 'Towers inside golden glow fire 50% faster and hit 25% harder. Gloom Eels and Murk Jellies can ONLY be hurt in the glow.'],
    ['ECONOMY', 'Kills pay pearls. Clearing a wave pays a bonus. Click a tower to upgrade it twice or sell it back.'],
    ['WAVES', '12 waves, then The Bleach — a three-phase boss. Beat it to win. Stars depend on lives left.'],
    ['KEYS', '1–6 towers · Space pause · Esc deselect · R restart · M mute'],
  ];
  let y = py + 84;
  for (const [h, body] of lines) {
    text(ctx, h, px + 30, y, 15, '#ffe066');
    ctx.font = '400 14.5px Trebuchet MS, Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#d7ecf2';
    wrapText(ctx, body, px + 110, y, pw - 140, 19);
    y += 62;
  }
  const back = { x: VIEW_W / 2 - 110, y: py + ph - 58, w: 220, h: 44 };
  ctx.fillStyle = '#ff7a59';
  rr(ctx, back.x, back.y, back.w, back.h, 10);
  ctx.fill();
  text(ctx, '←  BACK', back.x + back.w / 2, back.y + 23, 17, '#ffffff', 'center');
  state.howBackRect = back;
}

function wrapText(ctx, s, x, y, maxW, lh) {
  const words = s.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = w;
      yy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, yy);
}

function drawEndScreen(ctx, state, ui, win) {
  ctx.fillStyle = 'rgba(3,20,28,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const px = 340;
  const py = 96;
  const pw = 600;
  const ph = 520;
  ctx.fillStyle = 'rgba(3,26,36,0.96)';
  rr(ctx, px, py, pw, ph, 16);
  ctx.fill();
  ctx.strokeStyle = win ? 'rgba(255,224,102,0.6)' : 'rgba(255,93,115,0.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  text(ctx, win ? 'THE REEF LIVES!' : 'THE REEF HAS BLEACHED', VIEW_W / 2, py + 44, 32, win ? '#ffe066' : '#ff5d73', 'center');
  if (win) {
    let stars = '';
    for (let i = 0; i < 3; i++) stars += i < state.victoryStars ? '★' : '☆';
    text(ctx, stars, VIEW_W / 2, py + 108, 54, '#ffe066', 'center');
    text(ctx, state.victoryStars === 3 ? 'Flawless guardian — the coral sings again.' : state.victoryStars === 2 ? 'A hard-won dawn for the reef.' : 'The reef survives — barely.', VIEW_W / 2, py + 152, 16, '#bfe9d8', 'center');
  } else {
    text(ctx, 'The light went out. The reef remembers those who tried.', VIEW_W / 2, py + 108, 16, '#bfe9d8', 'center');
  }
  const s = win ? state.victoryStats : state.defeatStats;
  const rows = win
    ? [['FINAL SCORE', String(s.score)], ['WAVES CLEARED', `${s.waves} / ${WAVE_COUNT} + boss`], ['CREATURES STOPPED', String(s.kills)], ['PEARLS EARNED', `◉ ${s.pearls}`], ['LIVES REMAINING', `${s.lives} / ${START_LIVES}`]]
    : [['SCORE', String(s.score)], ['WAVE REACHED', `${Math.min(s.wave, WAVE_COUNT)} / ${WAVE_COUNT}`], ['CREATURES STOPPED', String(s.kills)], ['PEARLS EARNED', `◉ ${s.pearls}`]];
  let y = py + (win ? 196 : 168);
  for (const [k, v] of rows) {
    text(ctx, k, px + 60, y, 15, '#9fb7c9');
    text(ctx, v, px + pw - 60, y, 17, '#ffffff', 'right');
    y += 40;
  }
  const b = endButtons();
  ctx.fillStyle = '#ff7a59';
  rr(ctx, b.again.x, b.again.y, b.again.w, b.again.h, 12);
  ctx.fill();
  text(ctx, win ? '↻  PLAY AGAIN' : '↻  RETRY', b.again.x + b.again.w / 2, b.again.y + 31, 22, '#ffffff', 'center');
  ctx.fillStyle = 'rgba(10,53,66,0.9)';
  rr(ctx, b.title.x, b.title.y, b.title.w, b.title.h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(126,240,212,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  text(ctx, 'TITLE SCREEN', b.title.x + b.title.w / 2, b.title.y + 21, 15, '#7ef0d4', 'center');
}

function drawPause(ctx, state) {
  ctx.fillStyle = 'rgba(3,20,28,0.66)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  textShadow(ctx, 'PAUSED', VIEW_W / 2, 300, 56, '#ffffff', 'center');
  text(ctx, 'Space to resume · R to restart · Esc to resume', VIEW_W / 2, 360, 17, '#bfe9d8', 'center');
  const b = { x: VIEW_W / 2 - 130, y: 400, w: 260, h: 52 };
  ctx.fillStyle = '#ff7a59';
  rr(ctx, b.x, b.y, b.w, b.h, 10);
  ctx.fill();
  text(ctx, '▶  RESUME', b.x + b.w / 2, b.y + 27, 19, '#ffffff', 'center');
  state.pauseResumeRect = b;
}

// ---- main entry ----
export function render(ctx, state, ui) {
  ctx.save();
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (state.shake > 0) {
    const s = state.shake;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  if (state.screen === 'title' || state.screen === 'howto') {
    if (state.screen === 'title') drawTitle(ctx, state, ui);
    else drawHowTo(ctx, state, ui);
    ctx.restore();
    return;
  }

  drawBackground(ctx, state);
  drawHeart(ctx, state);
  drawPlots(ctx, state, ui);
  for (const t of state.towers) drawTower(ctx, state, t, state.selectedTower === t || (ui.mouse.x >= t.x - 20 && ui.mouse.x <= t.x + 20 && ui.mouse.y >= t.y - 20 && ui.mouse.y <= t.y + 20));
  for (const e of state.enemies) drawEnemy(ctx, state, e);

  // projectiles
  for (const pr of state.projectiles) {
    ctx.fillStyle = pr.color;
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, pr.kind === 'splash' ? 7 : 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(pr.x, pr.y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // particles
  for (const p of state.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // floating texts
  for (const f of state.floats) {
    ctx.globalAlpha = Math.max(0, f.life / f.max);
    text(ctx, f.text, f.x, f.y, 14, f.color, 'center');
  }
  ctx.globalAlpha = 1;

  drawHud(ctx, state);
  drawBuildBar(ctx, state, ui);
  drawSelectedPanel(ctx, state, ui);
  drawBanner(ctx, state);

  if (state.leakFlash > 0) {
    ctx.fillStyle = `rgba(255,60,90,${state.leakFlash * 0.35})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (state.paused) drawPause(ctx, state);
  if (state.screen === 'victory') drawEndScreen(ctx, state, ui, true);
  if (state.screen === 'defeat') drawEndScreen(ctx, state, ui, false);
  ctx.restore();
}
