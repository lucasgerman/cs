// Heightfield world: every 1m cell has a "top" height (wall = WALL_H).
// Movement, raycasts and line-of-sight all run against this grid.
import { WALL_H, STEP_H, GRAVITY } from './config.js';

export class World {
  constructor(map) {
    this.map = map;
    this.W = map.W; this.H = map.H;
    this.tops = new Float32Array(map.W * map.H);
    for (let i = 0; i < map.cells.length; i++) this.tops[i] = map.cells[i].top;
  }

  cellTop(cx, cz) {
    if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) return WALL_H;
    return this.tops[cz * this.W + cx];
  }
  topAt(x, z) { return this.cellTop(Math.floor(x), Math.floor(z)); }
  floorAt(x, z) {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) return 0;
    const c = this.map.cells[cz * this.W + cx];
    return c.wall ? 0 : c.h;
  }
  cellAt(x, z) {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= this.W || cz >= this.H) return null;
    return this.map.cells[cz * this.W + cx];
  }

  maxTopInBox(x0, z0, x1, z1) {
    const cx0 = Math.floor(x0), cz0 = Math.floor(z0);
    const cx1 = Math.floor(x1 - 1e-4), cz1 = Math.floor(z1 - 1e-4);
    let m = -Infinity;
    for (let cz = cz0; cz <= cz1; cz++) for (let cx = cx0; cx <= cx1; cx++) {
      const t = this.cellTop(cx, cz);
      if (t > m) m = t;
    }
    return m;
  }

  groundAt(x, z, r) { return this.maxTopInBox(x - r, z - r, x + r, z + r); }

  // Is a body of radius r able to stand at (x,z) with feet at y (no step-up)?
  fits(x, z, y, r) { return this.maxTopInBox(x - r, z - r, x + r, z + r) <= y + 1e-3; }

  // Integrate a body with axis-separated collision against the heightfield.
  moveBody(b, dt) {
    const r = b.radius;
    const canStep = b.onGround ? STEP_H : 0.02;
    const p = b.pos, v = b.vel;
    if (v.x !== 0) {
      const nx = p.x + v.x * dt;
      const t = this.maxTopInBox(nx - r, p.z - r, nx + r, p.z + r);
      if (t > p.y + canStep) v.x = 0; else p.x = nx;
    }
    if (v.z !== 0) {
      const nz = p.z + v.z * dt;
      const t = this.maxTopInBox(p.x - r, nz - r, p.x + r, nz + r);
      if (t > p.y + canStep) v.z = 0; else p.z = nz;
    }
    const g = this.maxTopInBox(p.x - r, p.z - r, p.x + r, p.z + r);
    const wasGround = b.onGround;
    v.y -= GRAVITY * dt;
    p.y += v.y * dt;
    if (p.y <= g) {
      if (!wasGround && v.y < -8) b.landed = -v.y; // hard landing event
      p.y = g; v.y = 0; b.onGround = true;
    } else if (wasGround && v.y <= 0 && p.y - g <= STEP_H && !b.jumping) {
      p.y = g; v.y = 0; b.onGround = true;      // stick to ground on small steps down
    } else {
      b.onGround = false;
    }
    b.jumping = false;
  }

  // DDA raycast through the heightfield. dir must be normalized.
  // Returns { t, x,y,z, nx,ny,nz } or null.
  raycast(ox, oy, oz, dx, dy, dz, maxDist) {
    let cx = Math.floor(ox), cz = Math.floor(oz);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const adx = Math.abs(dx), adz = Math.abs(dz);
    const tDeltaX = adx > 1e-9 ? 1 / adx : Infinity;
    const tDeltaZ = adz > 1e-9 ? 1 / adz : Infinity;
    let tMaxX = adx > 1e-9 ? ((dx > 0 ? (cx + 1 - ox) : (ox - cx)) / adx) : Infinity;
    let tMaxZ = adz > 1e-9 ? ((dz > 0 ? (cz + 1 - oz) : (oz - cz)) / adz) : Infinity;
    let tEnter = 0, axis = -1;
    for (let iter = 0; iter < 600; iter++) {
      const top = this.cellTop(cx, cz);
      const tExit = Math.min(tMaxX, tMaxZ, maxDist);
      const yEnter = oy + dy * tEnter;
      if (yEnter < top) {
        let nx = 0, ny = 0, nz = 0;
        if (axis === 0) nx = -stepX; else if (axis === 2) nz = -stepZ; else { nx = -dx; ny = -dy; nz = -dz; }
        return { t: tEnter, x: ox + dx * tEnter, y: yEnter, z: oz + dz * tEnter, nx, ny, nz, cx, cz };
      }
      const yExit = oy + dy * tExit;
      if (yExit < top) {
        const t = (top - oy) / dy;
        return { t, x: ox + dx * t, y: top, z: oz + dz * t, nx: 0, ny: 1, nz: 0, cx, cz };
      }
      if (tExit >= maxDist) return null;
      if (tMaxX < tMaxZ) { tEnter = tMaxX; tMaxX += tDeltaX; cx += stepX; axis = 0; }
      else { tEnter = tMaxZ; tMaxZ += tDeltaZ; cz += stepZ; axis = 2; }
    }
    return null;
  }

  // Line of sight between two points (optionally blocked by smoke spheres).
  los(ax, ay, az, bx, by, bz, smokes) {
    let dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.hypot(dx, dy, dz);
    if (d < 1e-4) return true;
    dx /= d; dy /= d; dz /= d;
    if (this.raycast(ax, ay, az, dx, dy, dz, d)) return false;
    if (smokes) for (const s of smokes) {
      if (raySphere(ax, ay, az, dx, dy, dz, s.x, s.y, s.z, s.r) < d) return false;
    }
    return true;
  }
}

// Returns t of ray/sphere intersection or Infinity.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  const r2 = r * r;
  if (d2 > r2) return Infinity;
  const thc = Math.sqrt(r2 - d2);
  const t0 = tca - thc, t1 = tca + thc;
  if (t0 >= 0) return t0;
  if (t1 >= 0) return 0;
  return Infinity;
}

// Returns t of ray/AABB intersection or Infinity.
export function rayAABB(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = 0, tmax = Infinity;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < lo[i] || o[i] > hi[i]) return Infinity;
    } else {
      let t1 = (lo[i] - o[i]) / d[i], t2 = (hi[i] - o[i]) / d[i];
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return Infinity;
    }
  }
  return tmin;
}

// Hitboxes of a humanoid entity. Returns { t, part } or null.
export function rayEntity(e, ox, oy, oz, dx, dy, dz, maxT) {
  const f = e.pos.y, x = e.pos.x, z = e.pos.z;
  const crouch = e.crouch;
  const headY = f + (crouch ? 1.08 : 1.62);
  let best = Infinity, part = null;
  let t = raySphere(ox, oy, oz, dx, dy, dz, x, headY, z, 0.17);
  if (t < best) { best = t; part = 'head'; }
  const bodyY0 = f + (crouch ? 0.45 : 0.78), bodyY1 = f + (crouch ? 0.95 : 1.45);
  t = rayAABB(ox, oy, oz, dx, dy, dz, x - 0.26, bodyY0, z - 0.26, x + 0.26, bodyY1, z + 0.26);
  if (t < best) { best = t; part = 'body'; }
  t = rayAABB(ox, oy, oz, dx, dy, dz, x - 0.22, f, z - 0.22, x + 0.22, bodyY0, z + 0.22);
  if (t < best) { best = t; part = 'legs'; }
  if (best < maxT) return { t: best, part };
  return null;
}

// ----- A* pathfinding over the nav grid (8-connected, no corner cutting)
export class NavGrid {
  constructor(map) {
    this.map = map; this.W = map.W; this.H = map.H;
    this.nav = new Uint8Array(map.W * map.H);
    this.h = new Float32Array(map.W * map.H);
    for (let i = 0; i < map.cells.length; i++) { this.nav[i] = map.cells[i].nav ? 1 : 0; this.h[i] = map.cells[i].h; }
    this.cost = new Float32Array(map.W * map.H); // extra cost near walls (keeps bots off corners)
    for (let z = 0; z < this.H; z++) for (let x = 0; x < this.W; x++) {
      const i = z * this.W + x;
      if (!this.nav[i]) continue;
      let near = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        if (!this.walkable(x + dx, z + dz)) near++;
      }
      this.cost[i] = near * 0.6;
    }
  }
  walkable(x, z) { return x >= 0 && z >= 0 && x < this.W && z < this.H && this.nav[z * this.W + x] === 1; }
  canStep(x0, z0, x1, z1) {
    if (!this.walkable(x1, z1)) return false;
    const dh = Math.abs(this.h[z1 * this.W + x1] - this.h[z0 * this.W + x0]);
    return dh <= STEP_H;
  }
  nearestWalkable(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (this.walkable(x, z)) return { x, z };
    for (let r = 1; r < 12; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        if (this.walkable(x + dx, z + dz)) return { x: x + dx, z: z + dz };
      }
    }
    return null;
  }
  // Returns array of {x,z} cell centers (world coords) from start to goal, or null.
  findPath(sx, sz, gx, gz) {
    const s = this.nearestWalkable(sx, sz), g = this.nearestWalkable(gx, gz);
    if (!s || !g) return null;
    const W = this.W, N = W * this.H;
    const si = s.z * W + s.x, gi = g.z * W + g.x;
    if (si === gi) return [{ x: g.x + 0.5, z: g.z + 0.5 }];
    const gScore = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new MinHeap();
    gScore[si] = 0;
    heap.push(si, this.heur(s.x, s.z, g.x, g.z));
    const dirs = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let expanded = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === gi) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++expanded > 40000) break;
      const cx = cur % W, cz = (cur / W) | 0;
      for (const [dx, dz, cst] of dirs) {
        const nx = cx + dx, nz = cz + dz;
        if (!this.canStep(cx, cz, nx, nz)) continue;
        if (dx !== 0 && dz !== 0 && (!this.walkable(cx + dx, cz) || !this.walkable(cx, cz + dz))) continue;
        const ni = nz * W + nx;
        if (closed[ni]) continue;
        const ng = gScore[cur] + cst + this.cost[ni];
        if (ng < gScore[ni]) {
          gScore[ni] = ng; came[ni] = cur;
          heap.push(ni, ng + this.heur(nx, nz, g.x, g.z));
        }
      }
    }
    if (came[gi] === -1) return null;
    const path = [];
    let i = gi;
    while (i !== -1) { path.push({ x: (i % W) + 0.5, z: ((i / W) | 0) + 0.5 }); i = came[i]; }
    path.reverse();
    return this.smooth(path);
  }
  heur(x0, z0, x1, z1) { const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0); return Math.max(dx, dz) + 0.414 * Math.min(dx, dz); }
  // Drop waypoints that are collinear-ish to produce fewer, longer segments.
  smooth(path) {
    if (path.length < 3) return path;
    const out = [path[0]];
    for (let i = 1; i < path.length - 1; i++) {
      const a = out[out.length - 1], b = path[i], c = path[i + 1];
      const d1x = b.x - a.x, d1z = b.z - a.z, d2x = c.x - b.x, d2z = c.z - b.z;
      if (Math.abs(d1x * d2z - d1z * d2x) > 1e-6) out.push(b);
    }
    out.push(path[path.length - 1]);
    return out;
  }
  randomWalkableNear(x, z, radius) {
    for (let i = 0; i < 20; i++) {
      const rx = x + (Math.random() * 2 - 1) * radius, rz = z + (Math.random() * 2 - 1) * radius;
      if (this.walkable(Math.floor(rx), Math.floor(rz))) return { x: Math.floor(rx) + 0.5, z: Math.floor(rz) + 0.5 };
    }
    const n = this.nearestWalkable(x, z);
    return n ? { x: n.x + 0.5, z: n.z + 0.5 } : { x, z };
  }
}

class MinHeap {
  constructor() { this.keys = []; this.vals = []; }
  get size() { return this.keys.length; }
  push(v, k) {
    const ks = this.keys, vs = this.vals;
    ks.push(k); vs.push(v);
    let i = ks.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (ks[p] <= ks[i]) break;
      [ks[p], ks[i]] = [ks[i], ks[p]]; [vs[p], vs[i]] = [vs[i], vs[p]]; i = p;
    }
  }
  pop() {
    const ks = this.keys, vs = this.vals;
    const top = vs[0];
    const lk = ks.pop(), lv = vs.pop();
    if (ks.length) {
      ks[0] = lk; vs[0] = lv;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < ks.length && ks[l] < ks[m]) m = l;
        if (r < ks.length && ks[r] < ks[m]) m = r;
        if (m === i) break;
        [ks[m], ks[i]] = [ks[i], ks[m]]; [vs[m], vs[i]] = [vs[i], vs[m]]; i = m;
      }
    }
    return top;
  }
}
