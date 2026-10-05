// Keyboard / mouse state with per-frame "pressed" edge detection.
export class Input {
  constructor() {
    this.keys = new Set(); this.pressedKeys = new Set();
    this.mouse = [false, false, false]; this.wheel = 0;
    this.locked = false;
    this.onLook = null; this.onKey = null; this.onMouseDown = null;
    window.addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code); this.pressedKeys.add(e.code);
      if (this.onKey) this.onKey(e.code, e);
      if (['Tab', 'Space', 'KeyB', 'KeyE', 'KeyQ', 'KeyR', 'KeyF', 'KeyG', 'ControlLeft', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'KeyZ', 'KeyX', 'KeyV', 'KeyT', 'KeyY', 'KeyM'].includes(e.code) && this.locked) e.preventDefault();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse = [false, false, false]; });
    window.addEventListener('mousedown', e => { if (!this.locked) return; if (e.target.closest && e.target.closest('input,button,select,label,a')) return; this.mouse[e.button] = true; if (this.onMouseDown) this.onMouseDown(e.button); e.preventDefault(); });
    window.addEventListener('mouseup', e => { this.mouse[e.button] = false; });
    window.addEventListener('contextmenu', e => { if (this.locked) e.preventDefault(); });
    window.addEventListener('wheel', e => { if (this.locked) this.wheel += Math.sign(e.deltaY); }, { passive: true });
    window.addEventListener('mousemove', e => { if (this.locked && this.onLook) this.onLook(e.movementX, e.movementY); });
  }
  down(code) { return this.keys.has(code); }
  pressed(code) { return this.pressedKeys.has(code); }
  endFrame() { this.pressedKeys.clear(); }
}
