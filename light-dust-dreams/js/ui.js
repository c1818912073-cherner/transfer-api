const Art = require('./art');
const Ease = require('./ease');

/**
 * Screens & HUD — authored title idle, constellation form, win/lose.
 */
function UI(width, height) {
  this.width = width;
  this.height = height;
  this.state = 'title';
  this.prevState = 'title';
  this.fade = 1;
  this.pulse = 0;
  this.hint = '轻抚光尘，循风织入星座';
  this.titleRise = 0;
  this.endRise = 0;
  this.bloom = 0;
  this.vignette = 0;
  this.hudFade = 0;
  this.muteHit = { x: width - 52, y: 18, w: 36, h: 28 };
  this.orbiters = [];
  for (let i = 0; i < 10; i++) {
    this.orbiters.push({
      a: (i / 10) * Math.PI * 2,
      r: 36 + (i % 3) * 14,
      speed: 0.25 + (i % 4) * 0.08,
      warm: i % 2 === 0,
      size: 1.2 + (i % 3) * 0.5,
    });
  }
}

UI.prototype.setState = function (state) {
  if (this.state === state) return;
  this.prevState = this.state;
  this.state = state;
  this.fade = 0;
  this.endRise = 0;
  if (state === 'clear') this.bloom = 0;
  if (state === 'fail') this.vignette = 0;
  if (state === 'play') this.hudFade = 0;
  if (state === 'title') this.titleRise = 0;
};

UI.prototype.update = function (dt) {
  this.pulse += dt;
  this.fade = Math.min(1, this.fade + dt * 1.5);
  this.titleRise = Math.min(1, this.titleRise + dt * 0.85);
  this.endRise = Math.min(1, this.endRise + dt * 1.1);
  if (this.state === 'clear') this.bloom = Math.min(1, this.bloom + dt * 0.7);
  if (this.state === 'fail') this.vignette = Math.min(1, this.vignette + dt * 0.9);
  if (this.state === 'play') this.hudFade = Math.min(1, this.hudFade + dt * 2.2);
  else this.hudFade = Math.max(0, this.hudFade - dt * 2);

  for (let i = 0; i < this.orbiters.length; i++) {
    this.orbiters[i].a += dt * this.orbiters[i].speed;
  }
};

UI.prototype.hitPrimary = function (x, y) {
  const btn = this._primaryBtn();
  return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
};

UI.prototype.hitMute = function (x, y) {
  const b = this.muteHit;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
};

UI.prototype._primaryBtn = function () {
  const w = Math.min(220, this.width * 0.55);
  const h = 48;
  return {
    x: (this.width - w) / 2,
    y: this.height * 0.68,
    w,
    h,
  };
};

UI.prototype.drawSky = function (ctx) {
  const g = ctx.createLinearGradient(0, 0, 0, this.height);
  g.addColorStop(0, Art.skyTop);
  g.addColorStop(0.45, Art.skyMid);
  g.addColorStop(1, Art.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, this.width, this.height);

  const haze = ctx.createRadialGradient(
    this.width * 0.5,
    this.height * 0.35,
    20,
    this.width * 0.5,
    this.height * 0.4,
    this.width * 0.7
  );
  haze.addColorStop(0, Art.haze);
  haze.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, this.width, this.height);
};

UI.prototype.drawFarStars = function (ctx, seedStars) {
  for (let i = 0; i < seedStars.length; i++) {
    const s = seedStars[i];
    const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.pulse * s.tw + s.ph));
    ctx.globalAlpha = twinkle * s.a;
    ctx.fillStyle = '#e8e4d8';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

UI.prototype.drawConstellation = function (ctx, runtime, opts) {
  opts = opts || {};
  const preview = !!opts.preview;
  const nodes = runtime.nodes;
  const edges = runtime.edges;
  const edgeDraw = runtime.edgeDraw || edges.map(() => (preview ? 0.2 : 0));

  // Light threads with staggered reveal
  for (let i = 0; i < edges.length; i++) {
    const a = nodes[edges[i][0]];
    const b = nodes[edges[i][1]];
    const prog = edgeDraw[i] != null ? edgeDraw[i] : 0;
    if (prog < 0.02) continue;

    const both = a.locked && b.locked;
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    // Slight arc for organic thread
    const nx = -(b.y - a.y) * 0.04;
    const ny = (b.x - a.x) * 0.04;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    const ex = a.x + (b.x - a.x) * prog;
    const ey = a.y + (b.y - a.y) * prog;
    const cpx = mx + nx;
    const cpy = my + ny;
    if (prog >= 0.99) {
      ctx.quadraticCurveTo(cpx, cpy, b.x, b.y);
    } else {
      // Partial quadratic approximation
      const t = prog;
      const px = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cpx + t * t * b.x;
      const py = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cpy + t * t * b.y;
      ctx.quadraticCurveTo(
        a.x + (cpx - a.x) * t,
        a.y + (cpy - a.y) * t,
        px,
        py
      );
    }

    if (both) {
      ctx.strokeStyle = Art.lineActive;
      ctx.lineWidth = 1.7;
      ctx.shadowColor = 'rgba(255, 220, 160, 0.35)';
      ctx.shadowBlur = 8;
    } else {
      ctx.strokeStyle = Art.lineIdle;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 0;
    }
    ctx.stroke();
    ctx.restore();

    // Traveling light mote on fully lit threads
    if (both) {
      const t = (this.pulse * 0.35 + i * 0.17) % 1;
      const lx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * cpx + t * t * b.x;
      const ly = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * cpy + t * t * b.y;
      ctx.fillStyle = 'rgba(255, 235, 200, 0.75)';
      ctx.beginPath();
      ctx.arc(lx, ly, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Nodes
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const ratio = Math.min(1, n.filled / n.need);
    const fillPulse = n.fillPulse || 0;

    if (n.locked) {
      // Anticipation already spent; bloom + settle
      const bloom = Ease.backOut(Math.min(1, n.lockPulse * 1.2), 1.35);
      const ring = 1 + bloom * 1.1;
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.6 * ring);
      glow.addColorStop(0, Art.starGlow);
      glow.addColorStop(0.45, `rgba(255, 210, 140, ${(0.4 * (1 - n.lockPulse * 0.35)).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2.6 * ring, 0, Math.PI * 2);
      ctx.fill();

      // Expanding lock ring
      if (n.lockPulse < 0.85) {
        const rt = Ease.cubicOut(n.lockPulse / 0.85);
        ctx.strokeStyle = `rgba(255, 230, 180, ${(1 - rt) * 0.7})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * (0.6 + rt * 1.8), 0, Math.PI * 2);
        ctx.stroke();
      }

      const core = 3.2 + Ease.smoothstep(n.lockPulse) * 1.4;
      ctx.fillStyle = Art.starLocked;
      ctx.beginPath();
      ctx.arc(n.x, n.y, core, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const breathe = 1 + 0.03 * Math.sin(this.pulse * 1.6 + i);
      const pr = n.r * breathe * (preview ? 0.92 : 1);
      ctx.strokeStyle = ratio > 0.01 ? Art.starNear : Art.starIdle;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, pr, 0, Math.PI * 2);
      ctx.stroke();

      if (ratio > 0) {
        const fr = Ease.cubicOut(ratio);
        ctx.fillStyle = `rgba(255, 220, 160, ${(0.12 + fr * 0.4 + fillPulse * 0.2).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pr * fr * 0.88, 0, Math.PI * 2);
        ctx.fill();
      }

      if (fillPulse > 0) {
        ctx.strokeStyle = `rgba(255, 230, 190, ${(fillPulse * 0.55).toFixed(3)})`;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(n.x, n.y, pr * (1 + (1 - fillPulse) * 0.25), 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.fillStyle = Art.starIdle;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

UI.prototype.drawHUD = function (ctx, runtime, muted) {
  this.drawMute(ctx, muted);
  if (this.state !== 'play' && this.hudFade < 0.05) return;
  const a = this.hudFade;
  ctx.globalAlpha = a;
  ctx.fillStyle = Art.uiMuted;
  ctx.font = '13px "PingFang SC", "Helvetica Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(runtime.level.name, 20, 36);

  ctx.textAlign = 'right';
  const t = Math.ceil(runtime.timeLeft);
  ctx.fillStyle = t <= 10 ? Art.uiAccent : Art.uiMuted;
  ctx.fillText(`${t}s`, this.width - 58, 36);

  const p = runtime.progress();
  const bw = this.width * 0.36;
  const bx = (this.width - bw) / 2;
  const by = 28;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = 'rgba(255, 210, 150, 0.55)';
  ctx.fillRect(bx, by, bw * Ease.smoothstep(p), 3);
  ctx.globalAlpha = 1;
};

UI.prototype.drawMute = function (ctx, muted) {
  const b = this.muteHit;
  ctx.strokeStyle = muted ? 'rgba(200,195,180,0.35)' : Art.uiAccent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, b.x, b.y, b.w, b.h, 5);
  ctx.stroke();
  ctx.fillStyle = muted ? Art.uiMuted : Art.uiText;
  ctx.font = '11px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(muted ? '静音' : '声音', b.x + b.w / 2, b.y + b.h / 2);
  ctx.textBaseline = 'alphabetic';
};

UI.prototype.drawTitle = function (ctx) {
  const rise = Ease.cubicOut(this.titleRise);
  const a = this.fade * rise;
  const yOff = (1 - rise) * 18;

  // Orbiting dust around title
  const cx = this.width / 2;
  const cy = this.height * 0.36 - 8 + yOff;
  for (let i = 0; i < this.orbiters.length; i++) {
    const o = this.orbiters[i];
    const ox = cx + Math.cos(o.a) * o.r;
    const oy = cy + Math.sin(o.a) * o.r * 0.55;
    ctx.globalAlpha = a * 0.45;
    ctx.fillStyle = o.warm ? '#ffd9a0' : '#b8ebe4';
    ctx.beginPath();
    ctx.arc(ox, oy, o.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  // Soft title glow
  ctx.shadowColor = 'rgba(255, 220, 170, 0.25)';
  ctx.shadowBlur = 16;
  ctx.fillStyle = Art.uiSoft;
  ctx.font = '28px "Songti SC", "STSong", "PingFang SC", serif';
  const breathe = 1 + 0.012 * Math.sin(this.pulse * 1.2);
  ctx.save();
  ctx.translate(cx, cy + 8);
  ctx.scale(breathe, breathe);
  ctx.fillText('光尘织梦', 0, 0);
  ctx.restore();
  ctx.shadowBlur = 0;

  ctx.fillStyle = Art.uiMuted;
  ctx.font = '13px "PingFang SC", "Helvetica Neue", sans-serif';
  ctx.fillText('Light Dust Dreams', cx, cy + 36);

  ctx.fillStyle = Art.uiAccent;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.globalAlpha = a * (0.65 + 0.35 * Math.sin(this.pulse * 1.4));
  ctx.fillText(this.hint, cx, this.height * 0.48 + yOff * 0.3);
  ctx.globalAlpha = a;

  this._drawButton(ctx, '开始织梦', 0.92 + 0.08 * Math.sin(this.pulse * 1.1));
  ctx.globalAlpha = 1;
};

UI.prototype.drawClear = function (ctx) {
  // Soft luminous bloom veil
  const bloom = Ease.cubicOut(this.bloom);
  ctx.fillStyle = `rgba(255, 230, 180, ${(0.04 + bloom * 0.08).toFixed(3)})`;
  ctx.fillRect(0, 0, this.width, this.height);
  ctx.fillStyle = Art.clearTint;
  ctx.fillRect(0, 0, this.width, this.height);

  const rise = Ease.backOut(this.endRise, 1.15);
  const y = this.height * 0.4 - (1 - rise) * 24;
  ctx.globalAlpha = this.fade * rise;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(255, 220, 160, 0.35)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = Art.uiSoft;
  ctx.font = '26px "Songti SC", "STSong", "PingFang SC", serif';
  ctx.fillText('星座已成', this.width / 2, y);
  ctx.shadowBlur = 0;
  ctx.fillStyle = Art.uiMuted;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.fillText('光尘归于宁静', this.width / 2, y + 32);
  this._drawButton(ctx, '再织一回', rise);
  ctx.globalAlpha = 1;
};

UI.prototype.drawFail = function (ctx) {
  const v = Ease.cubicOut(this.vignette);
  ctx.fillStyle = `rgba(8, 12, 20, ${(0.35 + v * 0.4).toFixed(3)})`;
  ctx.fillRect(0, 0, this.width, this.height);
  // Soft edge vignette
  const g = ctx.createRadialGradient(
    this.width / 2, this.height / 2, this.width * 0.2,
    this.width / 2, this.height / 2, this.width * 0.75
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${(0.25 * v).toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, this.width, this.height);

  const rise = Ease.cubicOut(this.endRise);
  const y = this.height * 0.4 + (1 - rise) * 16;
  ctx.globalAlpha = this.fade * rise;
  ctx.textAlign = 'center';
  ctx.fillStyle = Art.uiSoft;
  ctx.font = '26px "Songti SC", "STSong", "PingFang SC", serif';
  ctx.fillText('尘散未聚', this.width / 2, y);
  ctx.fillStyle = Art.uiMuted;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.fillText('风还在，再试一次', this.width / 2, y + 32);
  this._drawButton(ctx, '重新开始', rise);
  ctx.globalAlpha = 1;
};

UI.prototype._drawButton = function (ctx, label, scale) {
  scale = scale == null ? 1 : scale;
  const b = this._primaryBtn();
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.strokeStyle = Art.uiAccent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, b.x, b.y, b.w, b.h, 6);
  ctx.stroke();
  ctx.fillStyle = Art.uiText;
  ctx.font = '16px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, cy);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

module.exports = UI;
