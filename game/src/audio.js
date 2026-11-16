// Tidewarden sound: generative WebAudio only — no audio files, no
// network. A slow underwater pad with a pentatonic tide-melody, plus
// short synth blips for every game action. Silent until the player
// interacts (browsers block audio before a gesture).

const MELODY = [0, 3, 5, 7, 10, 12, 10, 7, 5, 3, 0, -2];
const ROOT = 196.0; // G3

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.muted = false;
    this.step = 0;
    this.nextNoteAt = 0;
    this.timer = null;
  }

  // Call from a user gesture (click / key). Safe to call repeatedly.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.16;
      this.musicGain.connect(this.master);
      this.startMusic();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  noise(dur, vol, lowpass = 1200) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filt = this.ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(filt);
    filt.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  // ---- game sound effects ----
  shoot(kind) {
    if (kind === 'urchin') this.tone(320, 0.12, 'square', 0.10, 0, 140);
    else if (kind === 'beam') this.tone(880, 0.08, 'sine', 0.08, 0, 1320);
    else if (kind === 'splash') this.tone(240, 0.16, 'triangle', 0.10, 0, 90);
    else this.tone(520 + Math.random() * 120, 0.07, 'sine', 0.07);
  }
  pop() { this.tone(180, 0.09, 'triangle', 0.12, 0, 60); }
  coin() { this.tone(990, 0.07, 'sine', 0.09); this.tone(1320, 0.1, 'sine', 0.08, 0.06); }
  leak() { this.tone(220, 0.4, 'sawtooth', 0.14, 0, 70); this.noise(0.25, 0.1, 500); }
  place() { this.tone(392, 0.1, 'sine', 0.12); this.tone(523, 0.14, 'sine', 0.1, 0.08); }
  upgrade() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.12, 'sine', 0.1, i * 0.07)); }
  sell() { this.tone(660, 0.08, 'sine', 0.09, 0, 440); }
  horn() { this.tone(147, 0.5, 'sawtooth', 0.12); this.tone(220, 0.5, 'sawtooth', 0.08, 0.02); }
  bossRoar() { this.noise(0.9, 0.22, 700); this.tone(98, 0.9, 'sawtooth', 0.16, 0, 49); }
  victory() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.11, i * 0.11)); }
  defeat() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.11, i * 0.16)); }
  click() { this.tone(700, 0.05, 'sine', 0.07); }

  // ---- generative music: pad chord + wandering pentatonic plucks ----
  startMusic() {
    if (!this.ctx || this.timer) return;
    const pad = (freqs, dur) => {
      if (!this.ctx || this.muted) return;
      const t0 = this.ctx.currentTime + 0.05;
      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.5, t0 + dur * 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(t0);
        osc.stop(t0 + dur + 0.1);
      }
    };
    const chords = [
      [130.81, 196.0, 246.94],
      [116.54, 174.61, 220.0],
      [98.0, 146.83, 196.0],
      [110.0, 164.81, 207.65],
    ];
    let ci = 0;
    const tick = () => {
      if (!this.ctx) return;
      pad(chords[ci % chords.length], 7.5);
      ci++;
      // two plucked melody notes per chord
      for (let k = 0; k < 2; k++) {
        const deg = MELODY[this.step % MELODY.length];
        const f = ROOT * Math.pow(2, deg / 12) * (k === 1 ? 2 : 1);
        this.pluck(f, 0.5 + k * 2.1);
        this.step++;
      }
    };
    tick();
    this.timer = setInterval(tick, 7500);
  }

  pluck(freq, delaySec) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delaySec;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
    osc.connect(g);
    g.connect(this.musicGain);
    osc.start(t0);
    osc.stop(t0 + 1.6);
  }
}
