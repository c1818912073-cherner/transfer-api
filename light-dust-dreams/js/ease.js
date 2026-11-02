/**
 * Authored easing — prefer these over linear pops.
 */
function clamp01(t) {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

const Ease = {
  clamp01,
  linear(t) { return clamp01(t); },
  quadIn(t) { t = clamp01(t); return t * t; },
  quadOut(t) { t = clamp01(t); return t * (2 - t); },
  cubicOut(t) { t = clamp01(t); const u = 1 - t; return 1 - u * u * u; },
  cubicInOut(t) {
    t = clamp01(t);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  },
  // Soft overshoot settle (follow-through)
  backOut(t, s) {
    t = clamp01(t);
    s = s == null ? 1.25 : s;
    const u = t - 1;
    return 1 + u * u * ((s + 1) * u + s);
  },
  // Gentle anticipatory dip then rise
  anticipate(t) {
    t = clamp01(t);
    if (t < 0.22) return -0.08 * Math.sin((t / 0.22) * Math.PI);
    return Ease.cubicOut((t - 0.22) / 0.78);
  },
  smoothstep(t) {
    t = clamp01(t);
    return t * t * (3 - 2 * t);
  },
  // Exponential approach toward target (framerate-friendly)
  damp(current, target, lambda, dt) {
    return current + (target - current) * (1 - Math.exp(-lambda * dt));
  },
};

module.exports = Ease;
