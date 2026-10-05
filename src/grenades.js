// Thrown grenades: HE, flashbang, smoke. Physics against the heightfield.
import * as THREE from '../vendor/three.module.min.js';
import { GRAVITY } from './config.js';
import { WEAPONS } from './weapons.js';

export class GrenadeManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.smokes = [];       // active smoke volumes for LOS {x,y,z,r,end}
    this.fires = [];        // burning areas {x,y,z,r,end,owner,group}
    this.geo = {
      he: new THREE.SphereGeometry(0.07, 10, 8),
      flash: new THREE.CylinderGeometry(0.045, 0.045, 0.14, 10),
      smoke: new THREE.CylinderGeometry(0.05, 0.05, 0.15, 10),
      molotov: new THREE.CylinderGeometry(0.04, 0.05, 0.2, 10),
      incendiary: new THREE.CylinderGeometry(0.05, 0.05, 0.16, 10),
    };
    this.mat = {
      he: new THREE.MeshLambertMaterial({ color: 0x3f5d3a }),
      flash: new THREE.MeshLambertMaterial({ color: 0x8a8d90 }),
      smoke: new THREE.MeshLambertMaterial({ color: 0x4a6a44 }),
      molotov: new THREE.MeshLambertMaterial({ color: 0x6a9a5a, transparent: true, opacity: 0.85 }),
      incendiary: new THREE.MeshLambertMaterial({ color: 0x9a2a2a }),
    };
  }

  throw(owner, type, ox, oy, oz, dx, dy, dz, speed) {
    const mesh = new THREE.Mesh(this.geo[type], this.mat[type]);
    mesh.castShadow = true;
    mesh.position.set(ox, oy, oz);
    this.game.scene.add(mesh);
    const g = {
      type, owner, mesh,
      pos: { x: ox, y: oy, z: oz },
      vel: { x: dx * speed + owner.vel.x * 0.5, y: dy * speed + owner.vel.y * 0.5, z: dz * speed + owner.vel.z * 0.5 },
      born: this.game.now, restT: 0, done: false,
      spin: { x: Math.random() * 6, y: Math.random() * 6 },
    };
    this.list.push(g);
    this.game.audio.play('pin', g.pos);
    return g;
  }

  update(dt) {
    const w = this.game.world, now = this.game.now;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const g = this.list[i];
      const p = g.pos, v = g.vel;
      const r = 0.07;
      v.y -= GRAVITY * dt;
      // X
      let nx = p.x + v.x * dt;
      if (w.maxTopInBox(nx - r, p.z - r, nx + r, p.z + r) > p.y) { v.x *= -0.45; v.z *= 0.8; this._bounce(g); } else p.x = nx;
      let nz = p.z + v.z * dt;
      if (w.maxTopInBox(p.x - r, nz - r, p.x + r, nz + r) > p.y) { v.z *= -0.45; v.x *= 0.8; this._bounce(g); } else p.z = nz;
      const ground = w.maxTopInBox(p.x - r, p.z - r, p.x + r, p.z + r);
      p.y += v.y * dt;
      if (p.y <= ground) {
        p.y = ground; g.touchedGround = true;
        if (v.y < -1.5) { v.y *= -0.35; v.x *= 0.7; v.z *= 0.7; this._bounce(g); }
        else { v.y = 0; v.x *= Math.exp(-dt * 4); v.z *= Math.exp(-dt * 4); }
      }
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed < 0.3 && p.y <= ground + 0.001) g.restT += dt; else g.restT = 0;
      g.mesh.position.set(p.x, p.y + 0.07, p.z);
      if (speed > 0.5) { g.mesh.rotation.x += g.spin.x * dt; g.mesh.rotation.y += g.spin.y * dt; }
      const age = now - g.born;
      let detonate = false;
      if (g.type === 'he' && age > 1.7) detonate = true;
      if (g.type === 'flash' && age > 1.6) detonate = true;
      if (g.type === 'smoke' && (age > 3.5 || (age > 1.0 && g.restT > 0.4))) detonate = true;
      if ((g.type === 'molotov' || g.type === 'incendiary') && (g.touchedGround || age > 2.2)) detonate = true;
      if (detonate) {
        this.detonate(g);
        this.game.scene.remove(g.mesh);
        this.list.splice(i, 1);
      }
    }
    for (let i = this.smokes.length - 1; i >= 0; i--) if (this.smokes[i].end < now) this.smokes.splice(i, 1);
    // burning areas damage whoever stands in them
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      if (f.end < now) { this.fires.splice(i, 1); continue; }
      f.tick = (f.tick || 0) - dt;
      if (f.tick > 0) continue;
      f.tick = 0.2;
      for (const e of this.game.entities) {
        if (!e.alive) continue;
        const d = Math.hypot(e.pos.x - f.x, e.pos.z - f.z);
        if (d > f.r || Math.abs(e.pos.y - f.y) > 1.2) continue;
        this.game.applyDamage(e, f.owner, 8, 'legs', { id: f.type, name: f.type === 'molotov' ? 'Molotov' : 'Incendiary', cat: 'fire', pen: 1, kill: 300, hsMul: 1 }, { x: f.x, y: f.y, z: f.z });
        e.burningUntil = now + 0.5;
        if (e.bot) e.bot.onBurning(f);
      }
    }
  }

  inFire(x, z) {
    for (const f of this.fires) if (Math.hypot(x - f.x, z - f.z) < f.r + 0.6) return f;
    return null;
  }

  extinguish(x, z, r) {
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      if (Math.hypot(x - f.x, z - f.z) < r + f.r * 0.5) { f.end = 0; if (f.group) this.game.effects.remove(f.group); this.fires.splice(i, 1); }
    }
  }

  _bounce(g) {
    const sp = Math.hypot(g.vel.x, g.vel.y, g.vel.z);
    if (sp > 1.5 && this.game.now - (g.lastBounce || 0) > 0.12) { g.lastBounce = this.game.now; this.game.audio.play('bounce', g.pos, { volume: Math.min(1, sp / 10) }); }
  }

  detonate(g) {
    const game = this.game, p = g.pos;
    if (g.type === 'he') {
      game.effects.explosion(p.x, p.y, p.z);
      game.audio.play('explosion', p, { maxDist: 120 });
      game.shake(Math.max(0, 1 - game.distToPlayer(p) / 20) * 1.5);
      const R = 9.5;
      for (const e of game.entities) {
        if (!e.alive) continue;
        const cx = e.pos.x, cy = e.pos.y + 1.0, cz = e.pos.z;
        const d = Math.hypot(cx - p.x, cy - (p.y + 0.3), cz - p.z);
        if (d > R) continue;
        if (!game.world.los(p.x, p.y + 0.3, p.z, cx, cy, cz)) continue;
        const dmg = 98 * Math.pow(Math.max(0, 1 - d / R), 1.3);
        if (dmg >= 1) game.applyDamage(e, g.owner, dmg, 'body', WEAPONS.he, { x: p.x, y: p.y, z: p.z });
      }
    } else if (g.type === 'flash') {
      game.effects.flashBurst(p.x, p.y + 0.3, p.z);
      game.audio.play('flash_explode', p, { maxDist: 120 });
      for (const e of game.entities) {
        if (!e.alive) continue;
        const ex = e.pos.x, ey = e.pos.y + (e.crouch ? 1.05 : 1.62), ez = e.pos.z;
        const dx = p.x - ex, dy = (p.y + 0.3) - ey, dz = p.z - ez;
        const d = Math.hypot(dx, dy, dz);
        if (d > 30) continue;
        if (!game.world.los(ex, ey, ez, p.x, p.y + 0.3, p.z, this.smokes)) continue;
        const fx = Math.cos(e.pitch) * -Math.sin(e.yaw), fy = Math.sin(e.pitch), fz = Math.cos(e.pitch) * -Math.cos(e.yaw);
        const dot = (dx * fx + dy * fy + dz * fz) / d;
        let dur = dot > 0.6 ? 4.5 : dot > 0.2 ? 3.0 : dot > -0.3 ? 1.6 : 0.6;
        if (d > 15) dur *= 0.6;
        game.flashEntity(e, dur, g.owner);
      }
    } else if (g.type === 'smoke') {
      game.audio.play('smoke_pop', p, { maxDist: 80 });
      const dur = 18;
      game.effects.smoke(p.x, p.y, p.z, 3.4, dur);
      this.smokes.push({ x: p.x, y: p.y + 1.3, z: p.z, r: 3.2, end: game.now + dur - 1.5 });
      this.extinguish(p.x, p.z, 3.4);
    } else if (g.type === 'molotov' || g.type === 'incendiary') {
      // smoke prevents the fire from spreading
      for (const s of this.smokes) if (Math.hypot(p.x - s.x, p.z - s.z) < s.r + 1) { game.audio.play('smoke_pop', p, { maxDist: 40, volume: 0.4 }); return; }
      game.audio.play('fire_start', p, { maxDist: 90 });
      const dur = 7;
      const ground = game.world.floorAt(p.x, p.z);
      const group = game.effects.fire(p.x, ground, p.z, 3.4, dur);
      this.fires.push({ x: p.x, y: ground, z: p.z, r: 3.4, end: game.now + dur, owner: g.owner, type: g.type, group });
    }
  }

  clear() {
    for (const g of this.list) this.game.scene.remove(g.mesh);
    this.list.length = 0; this.smokes.length = 0;
    for (const f of this.fires) if (f.group) this.game.effects.remove(f.group);
    this.fires.length = 0;
  }
}
