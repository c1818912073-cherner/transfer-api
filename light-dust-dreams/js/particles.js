const Art = require('./art');

/**
 * Luminous dust particles — finger brush + trail glow.
 */
function DustSystem(width, height, count) {
  this.width = width;
  this.height = height;
  this.particles = [];
  this.trails = [];
  this.maxTrails = 220;

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
  };
};

DustSystem.prototype.reset = function () {
  for (let i = 0; i < this.particles.length; i++) {
    this.particles[i] = this._spawn(true);
  }
  this.trails.length = 0;
};

DustSystem.prototype.update = function (dt, input, wind) {
  const brushR = 72;
  const brushR2 = brushR * brushR;

  for (let i = 0; i < this.particles.length; i++) {
    const p = this.particles[i];
    if (p.captured) {
      p.captureT = Math.min(1, p.captureT + dt * 1.8);
      continue;
    }

    // Finger brush — soft attract + velocity transfer
    if (input.active) {
      const dx = input.x - p.x;
      const dy = input.y - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < brushR2 && d2 > 0.5) {
        const d = Math.sqrt(d2);
        const fall = 1 - d / brushR;
        const pull = fall * fall * 95;
        p.vx += (dx / d) * pull * dt;
        p.vy += (dy / d) * pull * dt;
        p.vx += input.vx * 8 * fall * dt;
        p.vy += input.vy * 8 * fall * dt;
        p.glow = Math.min(1.4, p.glow + fall * dt * 2);

        // Motion 1: dust trail
        if (Math.random() < fall * 0.7) {
          this.trails.push({
            x: p.x,
            y: p.y,
            life: 1,
            warm: p.warm,
            r: p.r * 0.7,
          });
        }
      }
    }

    const w = wind.sample(p.x, p.y);
    p.vx += w.x * dt;
    p.vy += w.y * dt;

    // Soft drift / breathing
    p.phase += dt * 1.2;
    p.vx += Math.sin(p.phase) * 2.5 * dt;
    p.vy += Math.cos(p.phase * 0.9) * 2.2 * dt;

    // Damping
    p.vx *= Math.pow(0.92, dt * 60);
    p.vy *= Math.pow(0.92, dt * 60);

    // Speed clamp
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 220) {
      p.vx = (p.vx / sp) * 220;
      p.vy = (p.vy / sp) * 220;
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.glow = Math.max(0.4, p.glow - dt * 0.25);

    // Soft wrap / bounce at edges
    if (p.x < 8) { p.x = 8; p.vx *= -0.4; }
    if (p.x > this.width - 8) { p.x = this.width - 8; p.vx *= -0.4; }
    if (p.y < 8) { p.y = 8; p.vy *= -0.4; }
    if (p.y > this.height - 8) { p.y = this.height - 8; p.vy *= -0.4; }
  }

  // Age trails
  for (let i = this.trails.length - 1; i >= 0; i--) {
    this.trails[i].life -= dt * 1.6;
    if (this.trails[i].life <= 0) this.trails.splice(i, 1);
  }
  while (this.trails.length > this.maxTrails) this.trails.shift();
};

DustSystem.prototype.freeParticles = function () {
  return this.particles.filter((p) => !p.captured);
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
      p.vx = 0;
      p.vy = 0;
      // Snap gently toward target over time via captureT
      p._cx = tx;
      p._cy = ty;
      n++;
    }
  }
  return n;
};

DustSystem.prototype.draw = function (ctx) {
  // Trails first
  for (let i = 0; i < this.trails.length; i++) {
    const t = this.trails[i];
    ctx.beginPath();
    ctx.fillStyle = t.warm
      ? `rgba(255, 200, 120, ${(t.life * 0.28).toFixed(3)})`
      : `rgba(140, 220, 210, ${(t.life * 0.22).toFixed(3)})`;
    ctx.arc(t.x, t.y, t.r * (0.6 + t.life * 0.6), 0, Math.PI * 2);
    ctx.fill();
  }

  for (let i = 0; i < this.particles.length; i++) {
    const p = this.particles[i];
    let x = p.x;
    let y = p.y;
    let alpha = 0.75 + p.glow * 0.25;
    let radius = p.r;

    if (p.captured) {
      const ease = 1 - Math.pow(1 - p.captureT, 3);
      x = p.x + (p._cx - p.x) * ease;
      y = p.y + (p._cy - p.y) * ease;
      p.x = x;
      p.y = y;
      alpha = 0.55 + ease * 0.45;
      radius = p.r * (1 + ease * 0.35);
    }

    // Soft glow halo
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius * 4.5);
    g.addColorStop(0, p.color);
    g.addColorStop(0.35, p.warm ? 'rgba(255, 200, 120, 0.35)' : 'rgba(140, 220, 210, 0.3)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha * 0.85;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4.5, 0, Math.PI * 2);
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
