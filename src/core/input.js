// Pointer state shared by scenes: raw + damped NDC, pixel position, velocity, press state.
import { damp } from './engine.js';

export class Pointer {
  constructor({ lambda = 6, target = window } = {}) {
    this.x = 0; this.y = 0;          // raw NDC (-1..1, y up)
    this.sx = 0; this.sy = 0;        // damped NDC
    this.px = innerWidth / 2; this.py = innerHeight / 2; // pixels
    this.vx = 0; this.vy = 0;        // NDC velocity per second (damped)
    this.down = false;
    this.active = false;             // pointer has moved at least once
    this.lambda = lambda;
    this._lx = 0; this._ly = 0;
    this.listeners = { down: [], up: [], move: [] };
    const move = e => {
      const t = e.touches?.[0] ?? e;
      this.px = t.clientX; this.py = t.clientY;
      this.x = (t.clientX / innerWidth) * 2 - 1;
      this.y = -(t.clientY / innerHeight) * 2 + 1;
      this.active = true;
      for (const f of this.listeners.move) f(e, this);
    };
    target.addEventListener('pointermove', move, { passive: true });
    target.addEventListener('pointerdown', e => { move(e); this.down = true; for (const f of this.listeners.down) f(e, this); });
    addEventListener('pointerup', e => { this.down = false; for (const f of this.listeners.up) f(e, this); });
    addEventListener('pointercancel', () => { this.down = false; });
    addEventListener('blur', () => { this.down = false; });
  }

  on(type, f) { this.listeners[type].push(f); }

  update(dt) {
    const nx = damp(this.sx, this.x, this.lambda, dt);
    const ny = damp(this.sy, this.y, this.lambda, dt);
    if (dt > 0) {
      this.vx = damp(this.vx, (nx - this.sx) / dt, 10, dt);
      this.vy = damp(this.vy, (ny - this.sy) / dt, 10, dt);
    }
    this.sx = nx; this.sy = ny;
  }
}
