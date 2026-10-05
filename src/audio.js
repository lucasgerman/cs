// Procedural sound effects via WebAudio. No external assets.
export class AudioManager {
  constructor() {
    this.ctx = null; this.master = null; this.volume = 0.7; this.listener = { x: 0, y: 0, z: 0, yaw: 0 };
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = this._noiseBuffer(2);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  _noiseBuffer(sec) {
    const n = Math.floor(this.ctx.sampleRate * sec);
    const b = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  setListener(x, y, z, yaw) { this.listener.x = x; this.listener.y = y; this.listener.z = z; this.listener.yaw = yaw; }

  // Spatialize: returns {gain, pan} for a world position (or null for 2D).
  _spatial(pos, maxDist = 60) {
    if (!pos) return { gain: 1, pan: 0 };
    const l = this.listener;
    const dx = pos.x - l.x, dz = pos.z - l.z, dy = (pos.y || 0) - l.y;
    const d = Math.hypot(dx, dy, dz);
    if (d > maxDist) return null;
    const gain = 1 / (1 + (d / 8) * (d / 8) * 0.6);
    // right vector of listener: yaw rotation
    const rx = Math.cos(l.yaw), rz = -Math.sin(l.yaw);
    let pan = d > 0.5 ? (dx * rx + dz * rz) / d : 0;
    pan = Math.max(-0.9, Math.min(0.9, pan));
    return { gain, pan };
  }
  _out(gainVal, pan, t) {
    const g = this.ctx.createGain(); g.gain.value = gainVal;
    const p = this.ctx.createStereoPanner(); p.pan.value = pan;
    g.connect(p); p.connect(this.master);
    return g;
  }
  _noise(dur, filterType, freq, q, gainEnv, out, t0) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; f.Q.value = q || 0.7;
    const g = ctx.createGain();
    src.connect(f); f.connect(g); g.connect(out);
    gainEnv(g.gain, t0);
    src.start(t0); src.stop(t0 + dur + 0.05);
    return { src, f, g };
  }
  _tone(type, freq, dur, env, out, t0, freqEnd) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    const g = ctx.createGain(); o.connect(g); g.connect(out);
    env(g.gain, t0);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  play(name, pos, opts = {}) {
    if (!this.ctx) return;
    const sp = this._spatial(pos, opts.maxDist || 70);
    if (!sp) return;
    const t = this.ctx.currentTime;
    const vol = (opts.volume ?? 1) * sp.gain;
    if (!Number.isFinite(vol) || !Number.isFinite(sp.pan)) return;
    const out = this._out(vol, sp.pan, t);
    const ctx = this.ctx;
    const env = (a, d, peak = 1) => (g, t0) => { g.setValueAtTime(0.0001, t0); g.exponentialRampToValueAtTime(peak, t0 + a); g.exponentialRampToValueAtTime(0.0001, t0 + a + d); };
    switch (name) {
      case 'shot_rifle':
        this._noise(0.25, 'lowpass', 2200, 0.8, env(0.003, 0.22, 1.0), out, t);
        this._noise(0.08, 'highpass', 3000, 0.5, env(0.001, 0.06, 0.5), out, t);
        this._tone('sine', 120, 0.12, env(0.002, 0.1, 0.9), out, t, 40);
        break;
      case 'shot_pistol':
        this._noise(0.14, 'lowpass', 2800, 0.8, env(0.002, 0.12, 0.9), out, t);
        this._tone('triangle', 200, 0.08, env(0.002, 0.07, 0.6), out, t, 60);
        break;
      case 'shot_smg':
        this._noise(0.12, 'bandpass', 1800, 0.6, env(0.002, 0.1, 0.8), out, t);
        this._tone('sine', 150, 0.07, env(0.002, 0.06, 0.6), out, t, 50);
        break;
      case 'shot_awp':
        this._noise(0.6, 'lowpass', 1400, 0.9, env(0.004, 0.55, 1.2), out, t);
        this._tone('sine', 90, 0.35, env(0.003, 0.3, 1.0), out, t, 30);
        this._noise(0.1, 'highpass', 4000, 0.5, env(0.001, 0.08, 0.5), out, t);
        break;
      case 'shot_shotgun':
        this._noise(0.4, 'lowpass', 1600, 0.9, env(0.004, 0.35, 1.1), out, t);
        this._tone('sine', 80, 0.25, env(0.003, 0.2, 0.9), out, t, 30);
        break;
      case 'knife':
        this._noise(0.15, 'bandpass', 900, 1.5, env(0.02, 0.12, 0.4), out, t);
        break;
      case 'knife_hit':
        this._noise(0.12, 'lowpass', 600, 0.8, env(0.004, 0.1, 0.8), out, t);
        break;
      case 'dryfire':
        this._tone('square', 1200, 0.03, env(0.002, 0.025, 0.25), out, t);
        break;
      case 'reload':
        this._tone('square', 900, 0.03, env(0.002, 0.03, 0.3), out, t);
        this._noise(0.06, 'highpass', 2500, 0.8, env(0.002, 0.05, 0.3), out, t + 0.05);
        this._tone('square', 700, 0.04, env(0.002, 0.04, 0.3), out, t + 0.6);
        this._noise(0.08, 'bandpass', 1500, 1, env(0.002, 0.06, 0.35), out, t + 0.62);
        break;
      case 'reload_end':
        this._tone('square', 1100, 0.03, env(0.002, 0.03, 0.35), out, t);
        this._noise(0.05, 'highpass', 3000, 0.8, env(0.002, 0.04, 0.3), out, t + 0.03);
        break;
      case 'footstep':
        this._noise(0.07, 'lowpass', 500 + Math.random() * 300, 0.9, env(0.004, 0.06, 0.45), out, t);
        break;
      case 'land':
        this._noise(0.15, 'lowpass', 400, 0.9, env(0.004, 0.12, 0.8), out, t);
        break;
      case 'hit':
        this._noise(0.1, 'lowpass', 900, 0.9, env(0.002, 0.08, 0.9), out, t);
        this._tone('sine', 220, 0.08, env(0.002, 0.07, 0.5), out, t, 100);
        break;
      case 'hit_armor':
        this._tone('triangle', 900, 0.06, env(0.002, 0.05, 0.4), out, t, 300);
        this._noise(0.08, 'bandpass', 2500, 2, env(0.002, 0.06, 0.5), out, t);
        break;
      case 'headshot':
        this._tone('sine', 1500, 0.15, env(0.002, 0.13, 0.5), out, t, 1200);
        this._noise(0.1, 'lowpass', 900, 0.9, env(0.002, 0.08, 0.8), out, t);
        break;
      case 'hurt':
        this._noise(0.15, 'lowpass', 700, 0.9, env(0.003, 0.12, 0.9), out, t);
        this._tone('sawtooth', 180, 0.12, env(0.003, 0.1, 0.3), out, t, 80);
        break;
      case 'death':
        this._noise(0.4, 'lowpass', 500, 0.9, env(0.01, 0.35, 0.8), out, t);
        this._tone('sawtooth', 160, 0.3, env(0.01, 0.25, 0.3), out, t, 50);
        break;
      case 'impact':
        this._noise(0.05, 'highpass', 2500, 0.8, env(0.001, 0.04, 0.5), out, t);
        break;
      case 'ricochet':
        this._tone('sine', 2500 + Math.random() * 1500, 0.15, env(0.002, 0.13, 0.25), out, t, 600);
        break;
      case 'bounce':
        this._tone('square', 500, 0.04, env(0.002, 0.03, 0.3), out, t, 200);
        break;
      case 'pin':
        this._tone('square', 1800, 0.03, env(0.002, 0.03, 0.3), out, t);
        this._tone('square', 1400, 0.03, env(0.002, 0.03, 0.3), out, t + 0.07);
        break;
      case 'explosion':
        this._noise(1.4, 'lowpass', 900, 0.8, env(0.01, 1.3, 1.4), out, t);
        this._tone('sine', 70, 0.9, env(0.01, 0.8, 1.2), out, t, 25);
        this._noise(0.3, 'highpass', 1500, 0.8, env(0.005, 0.25, 0.7), out, t);
        break;
      case 'bomb_explode':
        this._noise(3.0, 'lowpass', 700, 0.8, env(0.02, 2.8, 1.6), out, t);
        this._tone('sine', 55, 2.0, env(0.02, 1.8, 1.4), out, t, 20);
        this._noise(0.6, 'highpass', 1200, 0.8, env(0.005, 0.5, 0.8), out, t);
        break;
      case 'flash_explode':
        this._noise(0.35, 'highpass', 2000, 0.8, env(0.003, 0.3, 1.2), out, t);
        this._tone('sine', 1200, 0.25, env(0.003, 0.2, 0.9), out, t, 400);
        break;
      case 'flash_ring':
        this._tone('sine', 3200, opts.duration || 2.5, env(0.01, (opts.duration || 2.5) - 0.02, 0.35), out, t, 2800);
        break;
      case 'fire_start':
        this._noise(1.6, 'bandpass', 900, 0.5, env(0.02, 1.5, 0.9), out, t);
        this._noise(0.3, 'highpass', 2500, 0.8, env(0.005, 0.25, 0.7), out, t);
        this._tone('sine', 140, 0.4, env(0.01, 0.35, 0.5), out, t, 60);
        break;
      case 'burn':
        this._noise(0.25, 'bandpass', 1200, 0.6, env(0.01, 0.22, 0.35), out, t);
        break;
      case 'smoke_pop':
        this._noise(1.2, 'lowpass', 1200, 0.8, env(0.02, 1.1, 0.6), out, t);
        break;
      case 'beep':
        this._tone('square', 1400, 0.08, env(0.002, 0.07, 0.4), out, t);
        break;
      case 'plant':
        this._tone('square', 900, 0.05, env(0.002, 0.04, 0.35), out, t);
        break;
      case 'defuse_kit':
        this._noise(0.2, 'bandpass', 3000, 2, env(0.005, 0.18, 0.3), out, t);
        break;
      case 'defused':
        this._tone('sine', 660, 0.25, env(0.01, 0.22, 0.5), out, t);
        this._tone('sine', 880, 0.35, env(0.01, 0.32, 0.5), out, t + 0.2);
        break;
      case 'round_start':
        this._tone('triangle', 520, 0.18, env(0.01, 0.16, 0.4), out, t);
        this._tone('triangle', 780, 0.3, env(0.01, 0.28, 0.4), out, t + 0.18);
        break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => this._tone('triangle', f, 0.45, env(0.01, 0.4, 0.4), out, t + i * 0.12));
        break;
      case 'lose':
        [440, 415, 392, 349].forEach((f, i) => this._tone('sawtooth', f, 0.5, env(0.01, 0.45, 0.25), out, t + i * 0.16));
        break;
      case 'radio':
        this._noise(0.05, 'bandpass', 2200, 3, env(0.002, 0.04, 0.5), out, t);
        this._tone('square', 1800, 0.04, env(0.002, 0.035, 0.2), out, t + 0.06);
        break;
      case 'buy':
        this._tone('sine', 1000, 0.08, env(0.002, 0.07, 0.4), out, t);
        this._tone('sine', 1500, 0.1, env(0.002, 0.09, 0.4), out, t + 0.08);
        break;
      case 'deny':
        this._tone('square', 300, 0.12, env(0.002, 0.1, 0.3), out, t);
        break;
      case 'click':
        this._tone('square', 2000, 0.02, env(0.001, 0.02, 0.25), out, t);
        break;
      case 'switch':
        this._noise(0.06, 'bandpass', 2000, 1.5, env(0.002, 0.05, 0.35), out, t);
        break;
      case 'pickup':
        this._tone('triangle', 700, 0.06, env(0.002, 0.05, 0.4), out, t);
        this._tone('triangle', 1000, 0.08, env(0.002, 0.07, 0.4), out, t + 0.05);
        break;
    }
  }
  shotSound(def) {
    switch (def.cat) {
      case 'pistol': return 'shot_pistol';
      case 'smg': return 'shot_smg';
      case 'sniper': return 'shot_awp';
      case 'shotgun': return 'shot_shotgun';
      default: return 'shot_rifle';
    }
  }
}
