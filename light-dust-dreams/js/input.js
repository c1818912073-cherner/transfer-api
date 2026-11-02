/**
 * Touch / drag input for brushing luminous dust.
 */
function Input(canvas) {
  this.active = false;
  this.x = 0;
  this.y = 0;
  this.prevX = 0;
  this.prevY = 0;
  this.vx = 0;
  this.vy = 0;
  this._listeners = [];

  const self = this;

  function onStart(e) {
    const t = e.touches[0];
    self.active = true;
    self.x = t.clientX;
    self.y = t.clientY;
    self.prevX = self.x;
    self.prevY = self.y;
    self.vx = 0;
    self.vy = 0;
  }

  function onMove(e) {
    if (!self.active) return;
    const t = e.touches[0];
    self.prevX = self.x;
    self.prevY = self.y;
    self.x = t.clientX;
    self.y = t.clientY;
    self.vx = self.x - self.prevX;
    self.vy = self.y - self.prevY;
  }

  function onEnd() {
    self.active = false;
    self.vx *= 0.3;
    self.vy *= 0.3;
  }

  if (typeof wx !== 'undefined' && wx.onTouchStart) {
    wx.onTouchStart(onStart);
    wx.onTouchMove(onMove);
    wx.onTouchEnd(onEnd);
    wx.onTouchCancel(onEnd);
  } else if (canvas) {
    // Browser / preview fallback
    canvas.addEventListener('mousedown', (e) => {
      self.active = true;
      self.x = e.clientX;
      self.y = e.clientY;
      self.prevX = self.x;
      self.prevY = self.y;
    });
    canvas.addEventListener('mousemove', (e) => {
      if (!self.active) return;
      self.prevX = self.x;
      self.prevY = self.y;
      self.x = e.clientX;
      self.y = e.clientY;
      self.vx = self.x - self.prevX;
      self.vy = self.y - self.prevY;
    });
    window.addEventListener('mouseup', onEnd);
  }
}

Input.prototype.speed = function () {
  return Math.hypot(this.vx, this.vy);
};

module.exports = Input;
