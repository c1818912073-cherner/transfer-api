const Art = require('./art');
const Ease = require('./ease');

/**
 * Soft wind currents — curved shimmer ribbons with authored phase.
 */
function WindField(width, height, streams) {
  this.width = width;
  this.height = height;
  this.streams = streams || [];
  this.time = 0;
  this.shimmers = [];
  this.ribbons = [];

  for (let i = 0; i < 14; i++) {
    this.shimmers.push(this._spawnShimmer());
  }
  for (let i = 0; i < 5; i++) {
    this.ribbons.push(this._spawnRibbon(i));
  }
}

WindField.prototype._spawnShimmer = function () {
  const s = this.streams.length
    ? this.streams[Math.floor(Math.random() * this.streams.length)]
    : null;
  const t = Math.random();
  return {
    stream: s,
    along: t,
    life: Math.random(),
    speed: 0.28 + Math.random() * 0.5,
    amp: 10 + Math.random() * 16,
    side: (Math.random() - 0.5) * 2,
  };
};

WindField.prototype._spawnRibbon = function (i) {
  const s = this.streams[i % Math.max(1, this.streams.length)] || {
    x: this.width * 0.5,
    y: this.height * 0.6,
    angle: -0.4,
    length: this.width * 0.2,
    width: 40,
  };
  return {
    stream: s,
    phase: Math.random() * Math.PI * 2,
    width: 0.55 + Math.random() * 0.4,
    alpha: 0.04 + Math.random() * 0.05,
  };
};

WindField.prototype.sample = function (x, y) {
  let fx = 0;
  let fy = 0;
  for (let i = 0; i < this.streams.length; i++) {
    const s = this.streams[i];
    const dx = x - s.x;
    const dy = y - s.y;
    const ca = Math.cos(s.angle);
    const sa = Math.sin(s.angle);
    const localX = dx * ca + dy * sa;
    const localY = -dx * sa + dy * ca;
    const nx = localX / s.length;
    const ny = localY / s.width;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) continue;
    const w = (1 - d2) * (1 - d2) * s.strength;
    const pulse = 1 + 0.14 * Math.sin(this.time * 1.35 + s.phase);
    fx += ca * w * pulse;
    fy += sa * w * pulse;
  }
  return { x: fx, y: fy };
};

WindField.prototype.strengthAt = function (x, y) {
  const v = this.sample(x, y);
  return Math.hypot(v.x, v.y);
};

WindField.prototype.update = function (dt) {
  this.time += dt;
  for (let i = 0; i < this.shimmers.length; i++) {
    const p = this.shimmers[i];
    p.life += dt * p.speed * 0.4;
    p.along += dt * p.speed * 0.15;
    if (p.life > 1 || p.along > 1.1) {
      this.shimmers[i] = this._spawnShimmer();
    }
  }
  for (let i = 0; i < this.ribbons.length; i++) {
    this.ribbons[i].phase += dt * (0.35 + i * 0.05);
  }
};

WindField.prototype.draw = function (ctx) {
  // Soft elliptical beds
  for (let i = 0; i < this.streams.length; i++) {
    const s = this.streams[i];
    const ca = Math.cos(s.angle);
    const sa = Math.sin(s.angle);
    const hx = ca * s.length;
    const hy = sa * s.length;
    const breathe = 0.85 + 0.15 * Math.sin(this.time * 0.9 + s.phase);
    const grad = ctx.createLinearGradient(s.x - hx, s.y - hy, s.x + hx, s.y + hy);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, Art.windTint);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.globalAlpha = breathe;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.length, s.width * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Curved ribbon strokes (authored wind presence)
  for (let i = 0; i < this.ribbons.length; i++) {
    const rb = this.ribbons[i];
    const s = rb.stream;
    if (!s) continue;
    const ca = Math.cos(s.angle);
    const sa = Math.sin(s.angle);
    const px = -sa;
    const py = ca;
    ctx.beginPath();
    const steps = 18;
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const along = (u - 0.5) * 2;
      const wave = Math.sin(u * Math.PI * 2 + rb.phase) * s.width * 0.35 * rb.width;
      const x = s.x + ca * along * s.length + px * wave;
      const y = s.y + sa * along * s.length + py * wave;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const fade = 0.5 + 0.5 * Math.sin(rb.phase * 0.7);
    ctx.strokeStyle = `rgba(200, 230, 220, ${(rb.alpha * fade).toFixed(3)})`;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // Short shimmer dashes along streams
  for (let i = 0; i < this.shimmers.length; i++) {
    const p = this.shimmers[i];
    const s = p.stream;
    if (!s) continue;
    const fade = Math.sin(Ease.clamp01(p.life) * Math.PI);
    const ca = Math.cos(s.angle);
    const sa = Math.sin(s.angle);
    const along = (p.along - 0.5) * 2;
    const side = p.side * s.width * 0.35;
    const x = s.x + ca * along * s.length - sa * side;
    const y = s.y + sa * along * s.length + ca * side;
    const len = p.amp * fade;
    ctx.strokeStyle = `rgba(210, 235, 225, ${(0.06 + fade * 0.14).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - ca * len * 0.5, y - sa * len * 0.5);
    ctx.lineTo(x + ca * len * 0.5, y + sa * len * 0.5);
    ctx.stroke();
  }
};

module.exports = WindField;
