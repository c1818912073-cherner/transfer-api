/**
 * Constellation goals — star nodes that must gather dust.
 */
function createLevel(width, height, index) {
  const cx = width * 0.5;
  const cy = height * 0.42;
  const s = Math.min(width, height) * 0.28;

  const nodes = [
    { x: cx, y: cy - s * 0.95, r: 26, need: 3, filled: 0, locked: false, lockPulse: 0, fillPulse: 0, lockOrder: -1 },
    { x: cx - s * 0.72, y: cy - s * 0.15, r: 24, need: 2, filled: 0, locked: false, lockPulse: 0, fillPulse: 0, lockOrder: -1 },
    { x: cx + s * 0.72, y: cy - s * 0.15, r: 24, need: 2, filled: 0, locked: false, lockPulse: 0, fillPulse: 0, lockOrder: -1 },
    { x: cx - s * 0.45, y: cy + s * 0.55, r: 22, need: 2, filled: 0, locked: false, lockPulse: 0, fillPulse: 0, lockOrder: -1 },
    { x: cx + s * 0.45, y: cy + s * 0.55, r: 22, need: 2, filled: 0, locked: false, lockPulse: 0, fillPulse: 0, lockOrder: -1 },
    { x: cx, y: cy + s * 0.15, r: 20, need: 2, filled: 0, locked: false, lockPulse: 0, fillPulse: 0, lockOrder: -1 },
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
  this.edgeDraw = level.edges.map(() => 0); // light-thread reveal 0→1
  this.timeLeft = level.timeLimit;
  this.cleared = false;
  this.failed = false;
  this.lockCount = 0;
  this.events = []; // { type: 'enter'|'lock'|'clear'|'fail', index? }
}

LevelRuntime.prototype.reset = function () {
  const base = this.level;
  this.nodes = base.nodes.map((n) => Object.assign({}, n, {
    filled: 0, locked: false, lockPulse: 0, fillPulse: 0, lockOrder: -1,
  }));
  this.edgeDraw = base.edges.map(() => 0);
  this.timeLeft = base.timeLimit;
  this.cleared = false;
  this.failed = false;
  this.lockCount = 0;
  this.events = [];
};

LevelRuntime.prototype.update = function (dt, dust) {
  this.events.length = 0;
  if (this.cleared || this.failed) {
    this._advanceEdges(dt);
    return this.events;
  }

  this.timeLeft -= dt;
  if (this.timeLeft <= 0) {
    this.timeLeft = 0;
    this.failed = true;
    this.events.push({ type: 'fail' });
    return this.events;
  }

  for (let i = 0; i < this.nodes.length; i++) {
    const n = this.nodes[i];
    if (n.locked) {
      n.lockPulse = Math.min(1, n.lockPulse + dt * 1.35);
      n.fillPulse = Math.max(0, n.fillPulse - dt);
      continue;
    }
    const gained = dust.captureNear(n.x, n.y, n.r * 1.35);
    if (gained > 0) {
      n.filled += gained;
      n.fillPulse = 1;
      this.events.push({ type: 'enter', index: i, count: gained });
    } else {
      n.fillPulse = Math.max(0, n.fillPulse - dt * 1.8);
    }
    if (n.filled >= n.need) {
      n.filled = n.need;
      n.locked = true;
      n.lockPulse = 0;
      n.lockOrder = this.lockCount++;
      this.events.push({ type: 'lock', index: i, order: n.lockOrder });
    }
  }

  this._advanceEdges(dt);

  if (this.nodes.every((n) => n.locked)) {
    this.cleared = true;
    this.events.push({ type: 'clear' });
  }
  return this.events;
};

LevelRuntime.prototype._advanceEdges = function (dt) {
  for (let i = 0; i < this.edges.length; i++) {
    const a = this.nodes[this.edges[i][0]];
    const b = this.nodes[this.edges[i][1]];
    const target = a.locked && b.locked ? 1 : a.locked || b.locked ? 0.28 : 0.08;
    const speed = a.locked && b.locked ? 2.2 : 1.2;
    const d = target - this.edgeDraw[i];
    this.edgeDraw[i] += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
  }
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
