// Procedural ambience — everything synthesised in WebAudio, nothing sampled:
// wind in the birches, birdsong (with a cuckoo, and a corncrake at dusk),
// hearth-fire crackle, a distant cowbell, and — in the manor eras — a far
// church bell. Starts muted until the user enables sound.
export class Ambience {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.era = 1;
    this.sunLow = 0;
    this.hasFire = false;
  }

  init() {
    if (this.ctx) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // --- wind: looping noise through a slow-breathing lowpass
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;                 // pinkish
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;
    const wind = ctx.createBufferSource();
    wind.buffer = buf; wind.loop = true;
    const windLP = ctx.createBiquadFilter();
    windLP.type = 'lowpass'; windLP.frequency.value = 320; windLP.Q.value = 0.4;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.16;
    wind.connect(windLP).connect(this.windGain).connect(this.master);
    wind.start();
    this.windLP = windLP;

    // --- fire crackle bed (gated by era)
    const fire = ctx.createBufferSource();
    fire.buffer = buf; fire.loop = true; fire.playbackRate.value = 0.5;
    const fireBP = ctx.createBiquadFilter();
    fireBP.type = 'bandpass'; fireBP.frequency.value = 2400; fireBP.Q.value = 0.8;
    this.fireGain = ctx.createGain();
    this.fireGain.gain.value = 0;
    fire.connect(fireBP).connect(this.fireGain).connect(this.master);
    fire.start();

    this._schedule();
  }

  toggle() {
    this.init();
    this.enabled = !this.enabled;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.ctx.currentTime, 0.4);
    return this.enabled;
  }

  setScene(era, sunLow, hasFire) { this.era = era; this.sunLow = sunLow; this.hasFire = hasFire; }

  _tone(freq, t0, dur, gain, type = 'sine', glideTo = null) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + dur * 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  _noiseBurst(t0, dur, freq, q, gain) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = 1.5;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t0); s.stop(t0 + dur + 0.05);
  }

  _schedule() {
    const ctx = this.ctx;
    const loop = () => {
      if (this.enabled) {
        const t = ctx.currentTime + 0.05;
        const day = 1 - this.sunLow;
        const r = Math.random();
        // songbirds by day
        if (r < 0.55 * day + 0.08) {
          const base = 2400 + Math.random() * 2400;
          const n = 2 + (Math.random() * 4 | 0);
          for (let i = 0; i < n; i++) {
            this._tone(base * (0.9 + Math.random() * 0.25), t + i * 0.09, 0.07, 0.028, 'sine', base * (0.7 + Math.random() * 0.5));
          }
        }
        // cuckoo, far off
        if (Math.random() < 0.05 * day) {
          this._tone(690, t, 0.22, 0.018, 'sine');
          this._tone(555, t + 0.34, 0.28, 0.018, 'sine');
        }
        // corncrake rasps from the meadows at dusk (once there are meadows)
        if (this.era >= 2 && this.sunLow > 0.5 && Math.random() < 0.3) {
          this._noiseBurst(t, 0.05, 3400, 3, 0.05);
          this._noiseBurst(t + 0.09, 0.05, 3400, 3, 0.05);
        }
        // cowbell
        if (this.era >= 2 && this.era <= 4 && Math.random() < 0.07 * day) {
          this._tone(760 + Math.random() * 120, t, 0.4, 0.014, 'triangle');
        }
        // distant church bell (manor era onward)
        if (this.era >= 3 && Math.random() < 0.012) {
          this._tone(311, t, 2.8, 0.02, 'sine');
          this._tone(466, t, 2.2, 0.008, 'sine');
        }
        // wind breathing + fire bed
        this.windLP.frequency.setTargetAtTime(240 + Math.random() * 260, t, 0.8);
        this.windGain.gain.setTargetAtTime(0.12 + Math.random() * 0.1, t, 1.2);
        this.fireGain.gain.setTargetAtTime(this.hasFire ? 0.05 : 0, t, 0.5);
        if (this.hasFire && Math.random() < 0.4) {
          this._noiseBurst(t + Math.random() * 0.3, 0.03, 3000 + Math.random() * 2000, 2, 0.05);
        }
      }
      this.timer = setTimeout(loop, 380 + Math.random() * 350);
    };
    loop();
  }
}
