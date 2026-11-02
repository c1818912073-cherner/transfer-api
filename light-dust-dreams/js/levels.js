/**
 * Constellation goals — star nodes that must gather dust.
 */
function createLevel(width, height, index) {
  // Single short round for the prototype — elegant 6-star "lantern" shape
  const cx = width * 0.5;
  const cy = height * 0.42;
  const s = Math.min(width, height) * 0.28;

  const nodes = [
    { x: cx, y: cy - s * 0.95, r: 26, need: 3, filled: 0, locked: false, lockPulse: 0 },
    { x: cx - s * 0.72, y: cy - s * 0.15, r: 24, need: 2, filled: 0, locked: false, lockPulse: 0 },
    { x: cx + s * 0.72, y: cy - s * 0.15, r: 24, need: 2, filled: 0, locked: false, lockPulse: 0 },
    { x: cx - s * 0.45, y: cy + s * 0.55, r: 22, need: 2, filled: 0, locked: false, lockPulse: 0 },
    { x: cx + s * 0.45, y: cy + s * 0.55, r: 22, need: 2, filled: 0, locked: false, lockPulse: 0 },
    { x: cx, y: cy + s * 0.15, r: 20, need: 2, filled: 0, locked: false, lockPulse: 0 },
  ];

  const edges = [
    [0, 1], [0, 2], [1, 5], [2, 5], [1, 3], [2, 4], [3, 5], [4, 5], [3, 4],
  ];

  const streams = [
    {
      x: width * 0.28,
      y: height * 0.62,
      angle: -0.55,
      length: width * 0.22,
      width: 48,
      strength: 55,
      phase: 0.2,
    },
    {
      x: width * 0.72,
      y: height * 0.58,
      angle: Math.PI + 0.4,
      length: width * 0.2,
      width: 42,
      strength: 48,
      phase: 1.1,
    },
    {
      x: width * 0.5,
      y: height * 0.78,
      angle: -Math.PI / 2 + 0.15,
      length: height * 0.12,
      width: 36,
      strength: 38,
      phase: 2.0,
    },
  ];

  return {
    id: index || 0,
    name: '初织 · 灯笼座',
    timeLimit: 70,
    dustCount: 56,
    nodes,
    edges,
    streams,
  };
}

function LevelRuntime(level) {
  this.level = level;
  this.nodes = level.nodes.map((n) => Object.assign({}, n));
  this.edges = level.edges;
  this.timeLeft = level.timeLimit;
  this.cleared = false;
  this.failed = false;
}

LevelRuntime.prototype.reset = function () {
  const base = this.level;
  this.nodes = base.nodes.map((n) => Object.assign({}, n, { filled: 0, locked: false, lockPulse: 0 }));
  this.timeLeft = base.timeLimit;
  this.cleared = false;
  this.failed = false;
};

LevelRuntime.prototype.update = function (dt, dust) {
  if (this.cleared || this.failed) return;

  this.timeLeft -= dt;
  if (this.timeLeft <= 0) {
    this.timeLeft = 0;
    this.failed = true;
    return;
  }

  for (let i = 0; i < this.nodes.length; i++) {
    const n = this.nodes[i];
    if (n.locked) {
      n.lockPulse = Math.min(1, n.lockPulse + dt * 1.5);
      continue;
    }
    const gained = dust.captureNear(n.x, n.y, n.r * 1.35);
    if (gained > 0) n.filled += gained;
    if (n.filled >= n.need) {
      n.filled = n.need;
      n.locked = true;
      n.lockPulse = 0;
    }
  }

  this.cleared = this.nodes.every((n) => n.locked);
};

LevelRuntime.prototype.progress = function () {
  let have = 0;
  let need = 0;
  for (let i = 0; i < this.nodes.length; i++) {
    have += Math.min(this.nodes[i].filled, this.nodes[i].need);
    need += this.nodes[i].need;
  }
  return need ? have / need : 0;
};

module.exports = { createLevel, LevelRuntime };
