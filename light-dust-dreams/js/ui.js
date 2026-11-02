const Art = require('./art');

/**
 * Screens & HUD — title → play → clear / fail → restart.
 */
function UI(width, height) {
  this.width = width;
  this.height = height;
  this.state = 'title'; // title | play | clear | fail
  this.fade = 1;
  this.pulse = 0;
  this.hint = '轻抚光尘，循风织入星座';
}

UI.prototype.setState = function (state) {
  if (this.state === state) return;
  this.state = state;
  this.fade = 0;
};

UI.prototype.update = function (dt) {
  this.pulse += dt;
  this.fade = Math.min(1, this.fade + dt * 1.8);
};

UI.prototype.hitPrimary = function (x, y) {
  const btn = this._primaryBtn();
  return x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h;
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

  // Soft atmospheric haze
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

UI.prototype.drawConstellation = function (ctx, runtime) {
  const nodes = runtime.nodes;
  const edges = runtime.edges;

  // Edges
  for (let i = 0; i < edges.length; i++) {
    const a = nodes[edges[i][0]];
    const b = nodes[edges[i][1]];
    const both = a.locked && b.locked;
    ctx.strokeStyle = both ? Art.lineActive : Art.lineIdle;
    ctx.lineWidth = both ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // Nodes
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const ratio = Math.min(1, n.filled / n.need);

    if (n.locked) {
      // Motion 2: constellation lock-in bloom
      const bloom = 1 + n.lockPulse * 0.8;
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 2.8 * bloom);
      glow.addColorStop(0, Art.starGlow);
      glow.addColorStop(0.5, `rgba(255, 210, 140, ${(0.35 * (1 - n.lockPulse * 0.4)).toFixed(3)})`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 2.8 * bloom, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = Art.starLocked;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 3.2 + n.lockPulse, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = ratio > 0.01 ? Art.starNear : Art.starIdle;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.stroke();

      if (ratio > 0) {
        ctx.fillStyle = `rgba(255, 220, 160, ${(0.15 + ratio * 0.35).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * ratio * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }

      // Tiny core
      ctx.fillStyle = Art.starIdle;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
};

UI.prototype.drawHUD = function (ctx, runtime) {
  if (this.state !== 'play') return;
  ctx.fillStyle = Art.uiMuted;
  ctx.font = '13px "PingFang SC", "Helvetica Neue", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(runtime.level.name, 20, 36);

  ctx.textAlign = 'right';
  const t = Math.ceil(runtime.timeLeft);
  ctx.fillStyle = t <= 10 ? Art.uiAccent : Art.uiMuted;
  ctx.fillText(`${t}s`, this.width - 20, 36);

  // Progress whisper bar
  const p = runtime.progress();
  const bw = this.width * 0.36;
  const bx = (this.width - bw) / 2;
  const by = 28;
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = 'rgba(255, 210, 150, 0.55)';
  ctx.fillRect(bx, by, bw * p, 3);
};

UI.prototype.drawTitle = function (ctx) {
  const a = this.fade;
  ctx.globalAlpha = a;
  ctx.textAlign = 'center';
  ctx.fillStyle = Art.uiSoft;
  ctx.font = '28px "Songti SC", "STSong", "PingFang SC", serif';
  ctx.fillText('光尘织梦', this.width / 2, this.height * 0.36);

  ctx.fillStyle = Art.uiMuted;
  ctx.font = '13px "PingFang SC", "Helvetica Neue", sans-serif';
  ctx.fillText('Light Dust Dreams', this.width / 2, this.height * 0.36 + 28);

  ctx.fillStyle = Art.uiAccent;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.globalAlpha = a * (0.7 + 0.3 * Math.sin(this.pulse * 1.5));
  ctx.fillText(this.hint, this.width / 2, this.height * 0.48);
  ctx.globalAlpha = a;

  this._drawButton(ctx, '开始织梦');
  ctx.globalAlpha = 1;
};

UI.prototype.drawClear = function (ctx) {
  ctx.fillStyle = Art.clearTint;
  ctx.fillRect(0, 0, this.width, this.height);
  ctx.globalAlpha = this.fade;
  ctx.textAlign = 'center';
  ctx.fillStyle = Art.uiSoft;
  ctx.font = '26px "Songti SC", "STSong", "PingFang SC", serif';
  ctx.fillText('星座已成', this.width / 2, this.height * 0.4);
  ctx.fillStyle = Art.uiMuted;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.fillText('光尘归于宁静', this.width / 2, this.height * 0.4 + 32);
  this._drawButton(ctx, '再织一回');
  ctx.globalAlpha = 1;
};

UI.prototype.drawFail = function (ctx) {
  ctx.fillStyle = Art.failTint;
  ctx.fillRect(0, 0, this.width, this.height);
  ctx.globalAlpha = this.fade;
  ctx.textAlign = 'center';
  ctx.fillStyle = Art.uiSoft;
  ctx.font = '26px "Songti SC", "STSong", "PingFang SC", serif';
  ctx.fillText('尘散未聚', this.width / 2, this.height * 0.4);
  ctx.fillStyle = Art.uiMuted;
  ctx.font = '14px "PingFang SC", sans-serif';
  ctx.fillText('风还在，再试一次', this.width / 2, this.height * 0.4 + 32);
  this._drawButton(ctx, '重新开始');
  ctx.globalAlpha = 1;
};

UI.prototype._drawButton = function (ctx, label) {
  const b = this._primaryBtn();
  ctx.strokeStyle = Art.uiAccent;
  ctx.lineWidth = 1;
  ctx.beginPath();
  roundRect(ctx, b.x, b.y, b.w, b.h, 6);
  ctx.stroke();
  ctx.fillStyle = Art.uiText;
  ctx.font = '16px "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x + b.w / 2, b.y + b.h / 2);
  ctx.textBaseline = 'alphabetic';
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
