/**
 * 光尘织梦 — cohesive generative sound world (WebAudio).
 * Soft, airy, slightly magical. Composed phrases — not random beeps.
 *
 * Palette (approx.): D mixolydian / suspended color
 *   D3 A3 · D4 E4 F#4 A4 · C5 E5
 */

function AudioWorld() {
  this.ctx = null;
  this.master = null;
  this.bgmGain = null;
  this.sfxGain = null;
  this.muted = false;
  this.started = false;
  this._bgmTimer = null;
  this._phrase = 0;
  this._brushLast = 0;
  this._windLast = 0;
  this._duckUntil = 0;
  this._bgmBase = 0.085;
  this._mode = 'title'; // title | play | clear | fail
}

AudioWorld.prototype._createContext = function () {
  if (this.ctx) return this.ctx;
  try {
    if (typeof wx !== 'undefined' && typeof wx.createWebAudioContext === 'function') {
      this.ctx = wx.createWebAudioContext();
    } else {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
  } catch (e) {
    this.ctx = null;
  }
  if (!this.ctx) return null;

  this.master = this.ctx.createGain();
  this.master.gain.value = 1;
  this.master.connect(this.ctx.destination);

  this.bgmGain = this.ctx.createGain();
  this.bgmGain.gain.value = this._bgmBase;
  this.bgmGain.connect(this.master);

  this.sfxGain = this.ctx.createGain();
  this.sfxGain.gain.value = 0.55;
  this.sfxGain.connect(this.master);

  return this.ctx;
};

AudioWorld.prototype.unlock = function () {
  if (this.started) return;
  const ctx = this._createContext();
  if (!ctx) return;
  const resume = ctx.resume && ctx.resume();
  const self = this;
  Promise.resolve(resume).then(function () {
    self.started = true;
    self._startBgmScheduler();
  }).catch(function () {
    self.started = true;
    self._startBgmScheduler();
  });
};

AudioWorld.prototype.setMuted = function (muted) {
  this.muted = !!muted;
  if (!this.master || !this.ctx) return;
  const now = this.ctx.currentTime;
  this.master.gain.cancelScheduledValues(now);
  this.master.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.04);
};

AudioWorld.prototype.toggleMute = function () {
  this.setMuted(!this.muted);
  return this.muted;
};

AudioWorld.prototype.setMode = function (mode) {
  this._mode = mode;
  if (!this.bgmGain || !this.ctx) return;
  const now = this.ctx.currentTime;
  let target = this._bgmBase;
  if (mode === 'play') target = 0.1;
  else if (mode === 'clear') target = 0.07;
  else if (mode === 'fail') target = 0.045;
  else target = 0.08;
  this.bgmGain.gain.setTargetAtTime(target, now, 0.6);
};

AudioWorld.prototype._duck = function (seconds) {
  if (!this.bgmGain || !this.ctx || this.muted) return;
  const now = this.ctx.currentTime;
  this._duckUntil = Math.max(this._duckUntil, now + seconds);
  const cur = this.bgmGain.gain.value;
  this.bgmGain.gain.cancelScheduledValues(now);
  this.bgmGain.gain.setValueAtTime(cur, now);
  this.bgmGain.gain.linearRampToValueAtTime(Math.min(cur, 0.035), now + 0.05);
  this.bgmGain.gain.linearRampToValueAtTime(
    this._mode === 'play' ? 0.1 : this._bgmBase,
    now + seconds
  );
};

// --- tone helpers ---------------------------------------------------------

AudioWorld.prototype._envGain = function (t0, a, d, s, r, peak) {
  const g = this.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), t0 + a);
  g.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * s), t0 + a + d);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
  return g;
};

AudioWorld.prototype._tone = function (freq, t0, dur, opts) {
  opts = opts || {};
  const type = opts.type || 'sine';
  const peak = opts.peak == null ? 0.12 : opts.peak;
  const dest = opts.dest || this.sfxGain;
  const o = this.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (opts.detune) o.detune.setValueAtTime(opts.detune, t0);
  if (opts.slideTo) {
    o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur * 0.85);
  }
  const g = this._envGain(
    t0,
    opts.attack == null ? 0.02 : opts.attack,
    opts.decay == null ? 0.08 : opts.decay,
    opts.sustain == null ? 0.45 : opts.sustain,
    opts.release == null ? Math.max(0.05, dur * 0.55) : opts.release,
    peak
  );
  let node = o;
  if (opts.filterFreq) {
    const f = this.ctx.createBiquadFilter();
    f.type = opts.filterType || 'lowpass';
    f.frequency.setValueAtTime(opts.filterFreq, t0);
    f.Q.value = opts.Q == null ? 0.7 : opts.Q;
    o.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(dest);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
  return o;
};

AudioWorld.prototype._noiseBurst = function (t0, dur, opts) {
  opts = opts || {};
  const rate = this.ctx.sampleRate;
  const n = Math.max(1, Math.floor(rate * dur));
  const buf = this.ctx.createBuffer(1, n, rate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  const src = this.ctx.createBufferSource();
  src.buffer = buf;
  const filter = this.ctx.createBiquadFilter();
  filter.type = opts.filterType || 'bandpass';
  filter.frequency.setValueAtTime(opts.freq || 800, t0);
  filter.Q.value = opts.Q == null ? 1.2 : opts.Q;
  if (opts.freqTo) {
    filter.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
  }
  const g = this._envGain(
    t0,
    opts.attack == null ? 0.01 : opts.attack,
    opts.decay == null ? 0.05 : opts.decay,
    opts.sustain == null ? 0.35 : opts.sustain,
    opts.release == null ? dur * 0.7 : opts.release,
    opts.peak == null ? 0.08 : opts.peak
  );
  src.connect(filter);
  filter.connect(g);
  g.connect(opts.dest || this.sfxGain);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
};

// --- BGM: composed looping phrase ----------------------------------------

AudioWorld.prototype._startBgmScheduler = function () {
  if (this._bgmTimer) return;
  const self = this;
  // Phrase length ~8s at gentle pace; schedule ahead for seamless loop
  const tick = function () {
    if (!self.ctx || !self.started) return;
    self._schedulePhrase(self.ctx.currentTime + 0.05);
    self._phrase++;
  };
  tick();
  this._bgmTimer = setInterval(tick, 8000);
};

AudioWorld.prototype._schedulePhrase = function (t0) {
  if (!this.ctx || !this.bgmGain) return;
  // Soft pad bed
  const padNotes = [146.83, 220.0, 293.66]; // D3 A3 D4
  for (let i = 0; i < padNotes.length; i++) {
    this._tone(padNotes[i], t0, 7.6, {
      type: i === 0 ? 'triangle' : 'sine',
      peak: i === 0 ? 0.045 : 0.028,
      attack: 1.4,
      decay: 1.2,
      sustain: 0.7,
      release: 2.2,
      filterFreq: 900 - i * 120,
      dest: this.bgmGain,
      detune: (i - 1) * 4,
    });
  }

  // Airy high shimmer tone (very quiet)
  this._tone(880, t0 + 0.4, 6.5, {
    type: 'sine',
    peak: 0.012,
    attack: 2.0,
    decay: 1.5,
    sustain: 0.5,
    release: 2.5,
    filterFreq: 2400,
    dest: this.bgmGain,
  });

  // Composed arpeggio motif (not random): D–A–E–F#–A–E–C–A
  const motif = [293.66, 440.0, 659.25, 739.99, 440.0, 659.25, 523.25, 440.0];
  const step = 0.95;
  for (let i = 0; i < motif.length; i++) {
    const when = t0 + 0.35 + i * step;
    // Slight variation by phrase index for life without chaos
    const accent = (i === 0 || i === 3) ? 1.15 : 1;
    this._tone(motif[i], when, 1.35, {
      type: 'sine',
      peak: 0.022 * accent,
      attack: 0.08,
      decay: 0.25,
      sustain: 0.35,
      release: 0.9,
      filterFreq: 1800,
      dest: this.bgmGain,
    });
    // Soft fifth ghost
    if (i % 2 === 0) {
      this._tone(motif[i] * 1.5, when + 0.04, 1.1, {
        type: 'sine',
        peak: 0.008,
        attack: 0.12,
        decay: 0.3,
        sustain: 0.3,
        release: 0.8,
        dest: this.bgmGain,
      });
    }
  }

  // Occasional soft wind bed in BGM (phrase-linked)
  if (this._phrase % 2 === 1) {
    this._noiseBurst(t0 + 2.2, 3.5, {
      filterType: 'bandpass',
      freq: 420,
      freqTo: 680,
      Q: 0.6,
      peak: 0.018,
      attack: 0.8,
      decay: 0.6,
      sustain: 0.5,
      release: 1.6,
      dest: this.bgmGain,
    });
  }
};

// --- SFX identities -------------------------------------------------------

/** Soft grain whisper while brushing dust */
AudioWorld.prototype.brush = function (intensity) {
  if (!this.started || this.muted || !this.ctx) return;
  const now = this.ctx.currentTime;
  if (now - this._brushLast < 0.055) return;
  this._brushLast = now;
  const i = Math.max(0.15, Math.min(1, intensity || 0.4));
  this._noiseBurst(now, 0.09 + i * 0.06, {
    filterType: 'bandpass',
    freq: 1400 + i * 900,
    freqTo: 900 + i * 400,
    Q: 2.2,
    peak: 0.028 * i,
    attack: 0.005,
    decay: 0.03,
    sustain: 0.25,
    release: 0.07,
  });
  this._tone(1200 + i * 400, now, 0.08, {
    type: 'sine',
    peak: 0.012 * i,
    attack: 0.004,
    decay: 0.02,
    sustain: 0.2,
    release: 0.05,
    filterFreq: 3000,
  });
};

/** Dust settles into a star node */
AudioWorld.prototype.dustEnter = function () {
  if (!this.started || this.muted || !this.ctx) return;
  const t = this.ctx.currentTime;
  this._duck(0.25);
  this._tone(523.25, t, 0.35, {
    type: 'sine',
    peak: 0.09,
    attack: 0.01,
    decay: 0.08,
    sustain: 0.35,
    release: 0.22,
  });
  this._tone(783.99, t + 0.03, 0.4, {
    type: 'triangle',
    peak: 0.05,
    attack: 0.015,
    decay: 0.1,
    sustain: 0.3,
    release: 0.25,
  });
};

/** Constellation node lock-in — crystalline bloom */
AudioWorld.prototype.lockIn = function (index) {
  if (!this.started || this.muted || !this.ctx) return;
  const t = this.ctx.currentTime;
  this._duck(0.55);
  const root = 392.0; // G4 family, luminous
  const chord = [root, root * 5 / 4, root * 3 / 2, root * 2];
  const stagger = (index || 0) % 4;
  for (let i = 0; i < chord.length; i++) {
    this._tone(chord[i], t + i * 0.045 + stagger * 0.01, 0.85, {
      type: i % 2 ? 'triangle' : 'sine',
      peak: 0.07 - i * 0.01,
      attack: 0.02,
      decay: 0.15,
      sustain: 0.4,
      release: 0.55,
      filterFreq: 2200,
    });
  }
  this._noiseBurst(t, 0.25, {
    filterType: 'highpass',
    freq: 1800,
    freqTo: 3200,
    Q: 0.8,
    peak: 0.04,
    attack: 0.005,
    release: 0.18,
  });
};

/** Soft wind whoosh when brushing through a current */
AudioWorld.prototype.windWhoosh = function () {
  if (!this.started || this.muted || !this.ctx) return;
  const now = this.ctx.currentTime;
  if (now - this._windLast < 1.4) return;
  this._windLast = now;
  this._noiseBurst(now, 0.85, {
    filterType: 'bandpass',
    freq: 280,
    freqTo: 920,
    Q: 0.9,
    peak: 0.07,
    attack: 0.08,
    decay: 0.2,
    sustain: 0.4,
    release: 0.45,
  });
  this._tone(180, now, 0.7, {
    type: 'sine',
    peak: 0.03,
    attack: 0.1,
    decay: 0.2,
    sustain: 0.35,
    release: 0.4,
    slideTo: 140,
  });
};

/** Clear — ascending luminous resolve */
AudioWorld.prototype.clear = function () {
  if (!this.started || this.muted || !this.ctx) return;
  const t = this.ctx.currentTime;
  this._duck(1.4);
  this.setMode('clear');
  const notes = [293.66, 369.99, 440.0, 587.33, 739.99, 880.0];
  for (let i = 0; i < notes.length; i++) {
    this._tone(notes[i], t + i * 0.12, 1.1, {
      type: 'sine',
      peak: 0.085 - i * 0.006,
      attack: 0.02,
      decay: 0.15,
      sustain: 0.45,
      release: 0.7,
      filterFreq: 2600,
    });
  }
  this._tone(146.83, t + 0.2, 2.2, {
    type: 'triangle',
    peak: 0.06,
    attack: 0.3,
    decay: 0.4,
    sustain: 0.55,
    release: 1.2,
    dest: this.sfxGain,
  });
};

/** Fail — soft scatter, airy descent (no harsh game-over) */
AudioWorld.prototype.fail = function () {
  if (!this.started || this.muted || !this.ctx) return;
  const t = this.ctx.currentTime;
  this._duck(1.0);
  this.setMode('fail');
  const notes = [440.0, 392.0, 329.63, 293.66];
  for (let i = 0; i < notes.length; i++) {
    this._tone(notes[i], t + i * 0.16, 0.7, {
      type: 'sine',
      peak: 0.055,
      attack: 0.03,
      decay: 0.12,
      sustain: 0.3,
      release: 0.45,
      filterFreq: 1400,
    });
  }
  this._noiseBurst(t + 0.05, 1.1, {
    filterType: 'bandpass',
    freq: 700,
    freqTo: 220,
    Q: 0.7,
    peak: 0.06,
    attack: 0.05,
    decay: 0.2,
    sustain: 0.35,
    release: 0.7,
  });
};

module.exports = AudioWorld;
