const Input = require('./input');
const DustSystem = require('./particles');
const WindField = require('./wind');
const { createLevel, LevelRuntime } = require('./levels');
const UI = require('./ui');
const AudioWorld = require('./audio');

function Main() {
  this.canvas = typeof wx !== 'undefined' && wx.createCanvas
    ? wx.createCanvas()
    : document.createElement('canvas');

  const sys = typeof wx !== 'undefined' && wx.getSystemInfoSync
    ? wx.getSystemInfoSync()
    : { windowWidth: 375, windowHeight: 667, pixelRatio: 2 };

  this.width = sys.windowWidth;
  this.height = sys.windowHeight;
  this.dpr = Math.min(sys.pixelRatio || 2, 3);

  this.canvas.width = this.width * this.dpr;
  this.canvas.height = this.height * this.dpr;

  this.ctx = this.canvas.getContext('2d');
  this.ctx.scale(this.dpr, this.dpr);

  this.input = new Input(this.canvas);
  this.ui = new UI(this.width, this.height);
  this.audio = new AudioWorld();
  this.farStars = this._makeFarStars(48);

  this.levelDef = createLevel(this.width, this.height, 0);
  this.runtime = new LevelRuntime(this.levelDef);
  this.dust = new DustSystem(this.width, this.height, this.levelDef.dustCount);
  this.wind = new WindField(this.width, this.height, this.levelDef.streams);

  this._wasBrushing = false;
  this.lastTs = Date.now();
  this._bindInput();
  this.loop = this.loop.bind(this);
  this.loop();
}

Main.prototype._makeFarStars = function (n) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    arr.push({
      x: Math.random() * this.width,
      y: Math.random() * this.height * 0.9,
      r: Math.random() * 1.2 + 0.3,
      a: 0.25 + Math.random() * 0.55,
      tw: 0.4 + Math.random() * 1.8,
      ph: Math.random() * Math.PI * 2,
    });
  }
  return arr;
};

Main.prototype._bindInput = function () {
  const self = this;

  const onEnd = (x, y) => {
    self.audio.unlock();
    if (self.ui.state === 'title') self.audio.setMode('title');

    if (self.ui.hitMute(x, y)) {
      self.audio.toggleMute();
      return;
    }

    if (self.ui.state === 'title' || self.ui.state === 'clear' || self.ui.state === 'fail') {
      const inLower = y > self.height * 0.55;
      if (self.ui.hitPrimary(x, y) || inLower) {
        self.startRound();
      }
    }
  };

  if (typeof wx !== 'undefined' && wx.onTouchEnd) {
    wx.onTouchStart(function () {
      self.audio.unlock();
      if (self.ui.state === 'title') self.audio.setMode('title');
    });
    wx.onTouchEnd((e) => {
      const t = e.changedTouches && e.changedTouches[0];
      if (!t) return;
      onEnd(t.clientX, t.clientY);
    });
  }
};

Main.prototype.startRound = function () {
  this.audio.unlock();
  this.levelDef = createLevel(this.width, this.height, 0);
  this.runtime = new LevelRuntime(this.levelDef);
  this.dust = new DustSystem(this.width, this.height, this.levelDef.dustCount);
  this.wind = new WindField(this.width, this.height, this.levelDef.streams);
  this.ui.setState('play');
  this.audio.setMode('play');
  this._wasBrushing = false;
};

Main.prototype.loop = function () {
  const now = Date.now();
  let dt = (now - this.lastTs) / 1000;
  this.lastTs = now;
  if (dt > 0.05) dt = 0.05;

  this.update(dt);
  this.draw();

  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(this.loop);
  } else {
    setTimeout(this.loop, 16);
  }
};

Main.prototype.update = function (dt) {
  this.ui.update(dt);
  this.wind.update(dt);

  if (this.ui.state === 'play') {
    this.dust.update(dt, this.input, this.wind);

    // Brush audio + wind whoosh when crossing strong current
    if (this.input.active) {
      if (this.dust.brushStrength > 0.08) {
        this.audio.brush(this.dust.brushStrength);
      }
      if (this.wind.strengthAt(this.input.x, this.input.y) > 28) {
        this.audio.windWhoosh();
      }
      this._wasBrushing = true;
    } else {
      this._wasBrushing = false;
    }

    const events = this.runtime.update(dt, this.dust);
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (ev.type === 'enter') this.audio.dustEnter();
      else if (ev.type === 'lock') this.audio.lockIn(ev.order);
      else if (ev.type === 'clear') {
        this.ui.setState('clear');
        this.audio.clear();
      } else if (ev.type === 'fail') {
        this.dust.triggerScatter();
        this.ui.setState('fail');
        this.audio.fail();
      }
    }
  } else if (this.ui.state === 'title') {
    const idleInput = { active: false, x: 0, y: 0, vx: 0, vy: 0 };
    this.dust.update(dt * 0.55, idleInput, this.wind);
    this.runtime._advanceEdges(dt * 0.35);
  } else if (this.ui.state === 'fail') {
    // Keep scatter residual motion
    const idleInput = { active: false, x: 0, y: 0, vx: 0, vy: 0 };
    this.dust.update(dt, idleInput, this.wind);
  } else if (this.ui.state === 'clear') {
    const idleInput = { active: false, x: 0, y: 0, vx: 0, vy: 0 };
    this.dust.update(dt * 0.4, idleInput, this.wind);
    this.runtime._advanceEdges(dt);
  }
};

Main.prototype.draw = function () {
  const ctx = this.ctx;
  this.ui.drawSky(ctx);
  this.ui.drawFarStars(ctx, this.farStars);
  this.wind.draw(ctx);

  this.ui.drawConstellation(ctx, this.runtime, {
    preview: this.ui.state === 'title',
  });

  this.dust.draw(ctx);
  this.ui.drawHUD(ctx, this.runtime, this.audio.muted);

  if (this.ui.state === 'title') this.ui.drawTitle(ctx);
  else if (this.ui.state === 'clear') this.ui.drawClear(ctx);
  else if (this.ui.state === 'fail') this.ui.drawFail(ctx);

  // Finger aura — anticipates brush presence
  if (this.ui.state === 'play' && this.input.active) {
    const pulse = 70 + this.dust.brushStrength * 18;
    const g = ctx.createRadialGradient(
      this.input.x, this.input.y, 0,
      this.input.x, this.input.y, pulse
    );
    g.addColorStop(0, `rgba(255, 230, 180, ${(0.1 + this.dust.brushStrength * 0.1).toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.input.x, this.input.y, pulse, 0, Math.PI * 2);
    ctx.fill();
  }
};

module.exports = Main;
