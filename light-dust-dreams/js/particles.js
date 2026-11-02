const Art = require('./art');
const Ease = require('./ease');

/**
 * Luminous dust — brush ribbons, settle arcs, scatter bursts.
 */
function DustSystem(width, height, count) {
  this.width = width;
  this.height = height;
  this.particles = [];
  this.trails = [];
  this.sparks = [];
  this.rings = [];
  this.maxTrails = 280;
  this.brushStrength = 0;
  this.justEntered = 0;
  this.scatterT = 0;

  for (let i = 0; i < count; i++) {
    this.particles.push(this._spawn(true));
  }
}

DustSystem.prototype._spawn = function (scatter) {
  const warm = Math.random() > 0.42;
  const palette = warm ? Art.dustWarm : Art.dustCool;
  return {
    x: scatter ? Math.random() * this.width : this.width * 0.5,
    y: scatter ? Math.random() * this.height * 0.85 + this.height * 0.05 : this.height * 0.55,
    vx: (Math.random() - 0.5) * 12,
    vy: (Math.random() - 0.5) * 12,
    r: 1.2 + Math.random() * 2.4,
    warm,
    color: palette[Math.floor(Math.random() * palette.length)],
    glow: 0.45 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2,
    captured: false,
    captureT: 0,
    settleFromX: 0,
    settleFromY: 0,
  };
};

DustSystem.prototype.reset = function () {
  for (let i = 0; i < this.particles.length; i++) {
    this.particles[i] = this._spawn(true);
  }
  this.trails.length = 0;
  this.sparks.length = 0;
  this.rings.length = 0;
  this.brushStrength = 0;
  this.justEntered = 0;
  this.scatterT = 0;
};

DustSystem.prototype.triggerScatter = function () {
  this.scatterT = 1;
  for (let i = 0; i < this.particles.length; i++) {
    const p = this.particles[i];
    if (p.captured) continue;
    const a = Math.random() * Math.PI * 2;
    const f = 80 + Math.random() * 160;
    p.vx += Math.cos(a) * f;
    p.vy += Math.sin(a) * f;
    p.glow = 1.4;
  }
  // Burst sparks
  for (let i = 0; i < 28; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
    this.sparks.push({
      x: this.width * 0.5 + (Math.random() - 0.5) * 80,
      y: this.height * 0.42 + (Math.random() - 0.5) * 80,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 1,
      warm: Math.random() > 0.5,
      r: 1 + Math.random() * 2,
    });
  }
};

DustSystem.prototype.update = function (dt, input, wind) {
  const brushR = 78;
  const brushR2 = brushR * brushR;
  let brushed = 0;
  this.justEntered = 0;

  if (this.scatterT > 0) this.scatterT = Math.max(0, this.scatterT - dt * 0.7);

  for (let i = 0; i < this.particles.length; i++) {
    const p = this.particles[i];
    if (p.captured) {
      // Follow-through settle with soft overshoot feel via ease
      p.captureT = Math.min(1, p.captureT + dt * 1.55);
      const e = Ease.backOut(p.captureT, 1.1);
      p.x = p.settleFromX + (p._cx - p.settleFromX) * e;
      p.y = p.settleFromY + (p._cy - p.settleFromY) * e;
      continue;
    }

    if (input.active) {
      const dx = input.x - p.x;
      const dy = input.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < brushR2 && d2 > 0.5) {
        const d = Math.sqrt(d2);
        const fall = 1 - d / brushR;
        const pull = fall * fall * 105;
        p.vx += (dx / d) * pull * dt;
        p.vy += (dy / d) * pull * dt;
        p.vx += input.vx * 9 * fall * dt;
        p.vy += input.vy * 9 * fall * dt;
        p.glow = Math.min(1.55, p.glow + fall * dt * 2.4);
        brushed += fall;

        // Authored ribbon trail (velocity-aligned)
        const spd = Math.hypot(p.vx, p.vy);
        if (Math.random() < fall * 0.85) {
          this.trails.push({
            x: p.x,
            y: p.y,
            vx: p.vx,
            vy: p.vy,
            life: 1,
            warm: p.warm,
            r: p.r * 0.75,
            len: Math.min(18, 4 + spd * 0.06),
          });
        }
        // Occasional sparkle mote
        if (Math.random() < fall * 0.12) {
          this.sparks.push({
            x: p.x + (Math.random() - 0.5) * 6,
            y: p.y + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 20,
            vy: (Math.random() - 0.5) * 20 - 10,
            life: 1,
            warm: p.warm,
            r: 0.8 + Math.random(),
          });
        }
      }
    }

    const w = wind.sample(p.x, p.y);
    p.vx += w.x * dt;
    p.vy += w.y * dt;

    p.phase += dt * 1.2;
    p.vx += Math.sin(p.phase) * 2.5 * dt;
    p.vy += Math.cos(p.phase * 0.9) * 2.2 * dt;

    p.vx *= Math.pow(0.92, dt * 60);
    p.vy *= Math.pow(0.92, dt * 60);

    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 240) {
      p.vx = (p.vx / sp) * 240;
      p.vy = (p.vy / sp) * 240;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.glow = Math.max(0.4, p.glow - dt * 0.25);

    if (p.x < 8) { p.x = 8; p.vx *= -0.4; }
    if (p.x > this.width - 8) { p.x = this.width - 8; p.vx *= -0.4; }
    if (p.y < 8) { p.y = 8; p.vy *= -0.4; }
    if (p.y > this.height - 8) { p.y = this.height - 8; p.vy *= -0.4; }
  }

  this.brushStrength = Ease.damp(this.brushStrength, Math.min(1, brushed * 0.35), 8, dt);

  // Age trails / sparks / rings
  for (let i = this.trails.length - 1; i >= 0; i--) {
    const t = this.trails[i];
    t.life -= dt * 1.35;
    t.x += t.vx * dt * 0.15;
    t.y += t.vy * dt * 0.15;
    if (t.life <= 0) this.trails.splice(i, 1);
  }
  while (this.trails.length > this.maxTrails) this.trails.shift();

  for (let i = this.sparks.length - 1; i >= 0; i--) {
    const s = this.sparks[i];
    s.life -= dt * 1.8;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy += 20 * dt;
    if (s.life <= 0) this.sparks.splice(i, 1);
  }

  for (let i = this.rings.length - 1; i >= 0; i--) {
    this.rings[i].t += dt / this.rings[i].dur;
    if (this.rings[i].t >= 1) this.rings.splice(i, 1);
  }
};

DustSystem.prototype.captureNear = function (tx, ty, radius) {
  const r2 = radius * radius;
  let n = 0;
  for (let i = 0; i < this.particles.length; i++) {
    const p = this.particles[i];
    if (p.captured) continue;
    const dx = p.x - tx;
    const dy = p.y - ty;
    if (dx * dx + dy * dy <= r2) {
      p.captured = true;
      p.captureT = 0;
      p.settleFromX = p.x;
      p.settleFromY = p.y;
      p.vx = 0;
      p.vy = 0;
      p._cx = tx + (Math.random() - 0.5) * 4;
      p._cy = ty + (Math.random() - 0.5) * 4;
      n++;
      this.justEntered++;
      // Soft fill pulse ring
      this.rings.push({ x: tx, y: ty, t: 0, dur: 0.55, maxR: radius * 1.6, warm: p.warm });
    }
  }
  return n;
};

DustSystem.prototype.draw = function (ctx) {
  // Ribbon trails
  for (let i = 0; i < this.trails.length; i++) {
    const t = this.trails[i];
    const sp = Math.hypot(t.vx, t.vy) || 1;
    const ux = t.vx / sp;
    const uy = t.vy / sp;
    const half = t.len * t.life * 0.5;
    const alpha = t.life * (t.warm ? 0.32 : 0.26);
    ctx.strokeStyle = t.warm
      ? `rgba(255, 200, 120, ${alpha.toFixed(3)})`
      : `rgba(140, 220, 210, ${alpha.toFixed(3)})`;
    ctx.lineWidth = t.r * (0.5 + t.life);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(t.x - ux * half, t.y - uy * half);
    ctx.lineTo(t.x + ux * half, t.y + uy * half);
    ctx.stroke();
  }

  // Fill rings (node enter pulse)
  for (let i = 0; i < this.rings.length; i++) {
    const r = this.rings[i];
    const e = Ease.cubicOut(r.t);
    const rad = r.maxR * (0.35 + e * 0.9);
    const a = (1 - e) * 0.45;
    ctx.strokeStyle = r.warm
      ? `rgba(255, 210, 140, ${a.toFixed(3)})`
      : `rgba(160, 230, 220, ${a.toFixed(3)})`;
    ctx.lineWidth = 1.5 * (1 - e * 0.6);
    ctx.beginPath();
    ctx.arc(r.x, r.y, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Sparks
  for (let i = 0; i < this.sparks.length; i++) {
    const s = this.sparks[i];
    ctx.globalAlpha = s.life * 0.85;
    ctx.fillStyle = s.warm ? '#ffd9a0' : '#b8ebe4';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < this.particles.length; i++) {
    const p = this.particles[i];
    const x = p.x;
    const y = p.y;
    let alpha = 0.75 + p.glow * 0.25;
    let radius = p.r;

    if (p.captured) {
      const e = Ease.backOut(Math.min(1, p.captureT), 1.05);
      alpha = 0.5 + e * 0.5;
      radius = p.r * (1 + e * 0.4);
    }

    const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 4.8);
    g.addColorStop(0, p.color);
    g.addColorStop(0.35, p.warm ? 'rgba(255, 200, 120, 0.35)' : 'rgba(140, 220, 210, 0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

module.exports = DustSystem;
