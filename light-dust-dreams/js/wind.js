const Art = require('./art');

/**
 * Soft wind currents that gently deflect dust.
 * Includes a shimmer motion for visual presence.
 */
function WindField(width, height, streams) {
  this.width = width;
  this.height = height;
  this.streams = streams || [];
  this.time = 0;
  this.shimmers = [];
  for (let i = 0; i < 18; i++) {
    this.shimmers.push({
      x: Math.random() * width,
      y: Math.random() * height,
      life: Math.random(),
      speed: 0.35 + Math.random() * 0.55,
      amp: 8 + Math.random() * 18,
    });
  }
}

WindField.prototype.sample = function (x, y) {
  let fx = 0;
  let fy = 0;
  for (let i = 0; i < this.streams.length; i++) {
    const s = this.streams[i];
    const dx = x - s.x;
    const dy = y - s.y;
    // Elliptical falloff along stream axis
    const ca = Math.cos(s.angle);
    const sa = Math.sin(s.angle);
    const localX = dx * ca + dy * sa;
    const localY = -dx * sa + dy * ca;
    const nx = localX / s.length;
    const ny = localY / s.width;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) continue;
    const w = (1 - d2) * (1 - d2) * s.strength;
    const pulse = 1 + 0.12 * Math.sin(this.time * 1.4 + s.phase);
    fx += ca * w * pulse;
    fy += sa * w * pulse;
  }
  return { x: fx, y: fy };
};

WindField.prototype.update = function (dt) {
  this.time += dt;
  for (let i = 0; i < this.shimmers.length; i++) {
    const p = this.shimmers[i];
    p.life += dt * p.speed * 0.35;
    if (p.life > 1) {
      p.life = 0;
      // Respawn near a stream
      if (this.streams.length) {
        const s = this.streams[Math.floor(Math.random() * this.streams.length)];
        const t = Math.random();
        p.x = s.x + Math.cos(s.angle) * (t - 0.5) * s.length * 2;
        p.y = s.y + Math.sin(s.angle) * (t - 0.5) * s.length * 2;
        p.amp = 8 + Math.random() * 18;
      } else {
        p.x = Math.random() * this.width;
        p.y = Math.random() * this.height;
      }
    }
  }
};

WindField.prototype.draw = function (ctx) {
  // Soft stream ribbons
  for (let i = 0; i < this.streams.length; i++) {
    const s = this.streams[i];
    const ca = Math.cos(s.angle);
    const sa = Math.sin(s.angle);
    const hx = ca * s.length;
    const hy = sa * s.length;
    const grad = ctx.createLinearGradient(s.x - hx, s.y - hy, s.x + hx, s.y + hy);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, Art.windTint);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, s.length, s.width * 0.85, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Motion 3: wind shimmer streaks
  for (let i = 0; i < this.shimmers.length; i++) {
    const p = this.shimmers[i];
    const fade = Math.sin(p.life * Math.PI);
    let dirX = 1;
    let dirY = 0;
    if (this.streams.length) {
      const s = this.streams[i % this.streams.length];
      dirX = Math.cos(s.angle);
      dirY = Math.sin(s.angle);
    }
    const len = p.amp * fade;
    ctx.strokeStyle = Art.windShimmer.replace(
      /[\d.]+\)$/,
      `${(0.08 + fade * 0.12).toFixed(3)})`
    );
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p.x - dirX * len * 0.5, p.y - dirY * len * 0.5);
    ctx.lineTo(p.x + dirX * len * 0.5, p.y + dirY * len * 0.5);
    ctx.stroke();
  }
};

module.exports = WindField;
