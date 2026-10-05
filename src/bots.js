// Bot AI: perception, navigation, combat and objective logic for both sides.
import { DIFFICULTY, ROUND } from './config.js';
import { weaponSpeed } from './weapons.js';

const rad = d => d * Math.PI / 180;
const deg = r => r * 180 / Math.PI;
function gauss() { let u = 0, v = 0; while (u === 0) u = Math.random(); while (v === 0) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function wrapAngle(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const EFF_RANGE = { melee: 2, pistol: 22, smg: 28, shotgun: 12, rifle: 55, sniper: 110, grenade: 10 };

export class BotAI {
  constructor(e, game) {
    this.e = e; this.game = game;
    this.diff = DIFFICULTY[game.settings.difficulty] || DIFFICULTY.normal;
    this.skill = 0.7 + Math.random() * 0.6; // individual variation
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.path = null; this.pathI = 0; this.goal = null; this.arrived = false;
    this.target = null; this.targetSeenT = -10; this.lastKnown = null; this.firstSeenT = 0; this.reactAt = 0;
    this.aimErrYaw = 0; this.aimErrPitch = 0; this.aimT = 0;
    this.perceiveT = Math.random() * 0.1;
    this.fireUntil = 0; this.fireCooldown = 0; this.trigger = false;
    this.strafeDir = 0; this.strafeT = 0;
    this.holdPos = null; this.holdYaw = null; this.holdUntil = 0; this.lookT = 0; this.lookYaw = 0;
    this.objective = null; this.site = null;
    this.investigateUntil = 0;
    this.desiredYaw = this.e.yaw; this.desiredPitch = 0;
    this.stuckT = 0; this.lastPos = { x: this.e.pos.x, z: this.e.pos.z }; this.stuckCheckT = 0;
    this.repathT = 0; this.replanT = 0;
    this.e.crouch = false; this.e.walking = false;
    this.rotateT = 0; this.throwPlan = null; this.nadeCooldown = 0;
    this.lateMove = false; this.investigating = false; this.pickupCheckT = 0;
  }

  // ---------- events
  onDamaged(attacker, srcPos) {
    const now = this.game.now;
    if (attacker && attacker.alive && attacker.team !== this.e.team) {
      if (this.target !== attacker) {
        this.lastKnown = { x: attacker.pos.x, z: attacker.pos.z };
        this.investigateUntil = now + 6;
        if (!this.target) this.lookAt(attacker.pos.x, attacker.pos.y + 1.2, attacker.pos.z);
      }
    }
    // being shot interrupts planting/defusing less often for hard bots
    if (this.e.defusing && Math.random() < 0.5) this.e.defusing = false;
  }

  onHearShot(shooter) {
    const now = this.game.now;
    if (!this.e.alive || shooter.team === this.e.team) return;
    if (this.target) return;
    const d = Math.hypot(shooter.pos.x - this.e.pos.x, shooter.pos.z - this.e.pos.z);
    if (d > 40) return;
    this.lastKnown = { x: shooter.pos.x, z: shooter.pos.z };
    if (this.investigateUntil < now && Math.random() < (this.state === 'hold' ? 0.5 : 0.25)) {
      this.investigateUntil = now + 5 + Math.random() * 4;
    }
    if (d < 18 && this.state !== 'plant' && this.state !== 'defuse') this.lookAt(shooter.pos.x, shooter.pos.y + 1.3, shooter.pos.z);
  }

  onRoundStart() {
    this.reset();
    this.planObjective();
  }

  onBombPlanted() {
    this.investigateUntil = 0;
    this.planObjective();
  }

  // ---------- planning
  planObjective() {
    const g = this.game, e = this.e;
    const map = g.map;
    if (e.team === 'T') {
      if (g.bomb.planted) {
        this.site = g.bomb.site;
        this.state = 'defend';
        this.pickHold(g.bomb.pos.x, g.bomb.pos.z, 9);
        return;
      }
      if (!this.site) {
        this.site = g.tPlan.site;
        if (!e.hasBomb && Math.random() < 0.22) this.site = this.site === 'A' ? 'B' : 'A';
      }
      this.state = 'rush';
      const s = map.sites[this.site];
      const h = pick(map.landmarks[this.site].holds);
      this.setGoal(h.x + 0.5, h.z + 0.5);
      this.arrivedAction = () => { this.state = 'hold'; this.pickHold(s.x, s.z, 10); };
    } else {
      if (g.bomb.planted) {
        this.state = 'retake';
        this.setGoal(g.bomb.pos.x, g.bomb.pos.z);
        this.arrivedAction = () => { this.state = 'defuse'; };
        return;
      }
      if (!this.site) this.site = g.ctPlan.assign(e);
      this.state = 'goto';
      const h = pick(map.landmarks[this.site].holds);
      this.setGoal(h.x + 0.5, h.z + 0.5);
      this.arrivedAction = () => { this.state = 'hold'; this.holdAt(this.e.pos.x, this.e.pos.z); };
    }
  }

  pickHold(cx, cz, radius) {
    const p = this.game.nav.randomWalkableNear(cx, cz, radius);
    this.setGoal(p.x, p.z);
    this.arrivedAction = () => { this.holdAt(this.e.pos.x, this.e.pos.z); };
  }

  holdAt(x, z) {
    const g = this.game, map = g.map;
    this.holdPos = { x, z };
    this.state = this.state === 'defend' ? 'defend' : 'hold';
    // face the nearest site entrance (or the bomb approach)
    const site = this.site && map.landmarks[this.site];
    let best = null, bd = Infinity;
    if (site) for (const en of site.entrances) {
      const d = Math.hypot(en.x - x, en.z - z);
      if (d < bd) { bd = d; best = en; }
    }
    if (best) this.holdYaw = Math.atan2(-(best.x - x), -(best.z - z));
    else this.holdYaw = Math.random() * Math.PI * 2;
    this.lookYaw = this.holdYaw;
    this.holdUntil = g.now + 8 + Math.random() * 14;
    this.e.crouch = Math.random() < 0.25 && this.e.team === 'CT';
  }

  setGoal(x, z) {
    const e = this.e;
    this.goal = { x, z };
    this.path = this.game.nav.findPath(e.pos.x, e.pos.z, x, z);
    this.pathI = 0; this.arrived = false;
    if (this.path && this.path.length > 1) {
      const w = this.path[0];
      if (Math.hypot(w.x - e.pos.x, w.z - e.pos.z) < 0.6) this.pathI = 1;
    }
    this.repathT = this.game.now;
  }

  lookAt(x, y, z) {
    const e = this.e;
    const dx = x - e.pos.x, dz = z - e.pos.z, dy = y - (e.pos.y + (e.crouch ? 1.05 : 1.62));
    this.desiredYaw = Math.atan2(-dx, -dz);
    this.desiredPitch = Math.atan2(dy, Math.hypot(dx, dz));
  }

  // ---------- perception
  perceive() {
    const g = this.game, e = this.e, now = g.now;
    if (now < e.blindUntil) { return; }
    const ex = e.pos.x, ey = e.pos.y + (e.crouch ? 1.05 : 1.62), ez = e.pos.z;
    const fx = -Math.sin(e.yaw), fz = -Math.cos(e.yaw);
    let best = null, bestD = Infinity;
    const sight = this.diff.sight;
    for (const o of g.entities) {
      if (!o.alive || o.team === e.team) continue;
      const dx = o.pos.x - ex, dz = o.pos.z - ez;
      const d = Math.hypot(dx, dz);
      if (d > sight + (now - o.lastShotTime < 1.5 ? 30 : 0)) continue;
      const cos = (dx * fx + dz * fz) / Math.max(0.001, d);
      const recentlyLoud = now - o.lastShotTime < 1.0 && d < 25;
      const inFov = cos > 0.45 || d < 3 || recentlyLoud || (this.target === o && cos > -0.2);
      if (!inFov) continue;
      const oy = o.pos.y;
      const vis = g.world.los(ex, ey, ez, o.pos.x, oy + (o.crouch ? 0.7 : 1.1), o.pos.z, g.grenades.smokes) ||
                  g.world.los(ex, ey, ez, o.pos.x, oy + (o.crouch ? 1.05 : 1.62), o.pos.z, g.grenades.smokes);
      if (!vis) continue;
      // further targets are noticed less reliably when at the edge of sight
      if (d > sight * 0.75 && Math.random() < 0.5) continue;
      if (d < bestD) { bestD = d; best = o; }
    }
    if (best) {
      if (this.target !== best) {
        const switching = !!this.target;
        this.target = best;
        this.firstSeenT = now;
        const r = this.diff.reaction * (0.6 + Math.random() * 0.8) / this.skill;
        this.reactAt = now + (switching ? r * 0.5 : r);
        this.aimT = 0;
        best.spottedUntil = now + 3;
      }
      this.targetSeenT = now;
      this.lastKnown = { x: best.pos.x, z: best.pos.z };
      best.spottedUntil = Math.max(best.spottedUntil || 0, now + 2);
    } else if (this.target) {
      if (now - this.targetSeenT > 2.5) {
        this.target = null;
        this.investigateUntil = now + 5;
      }
    }
  }

  // ---------- main update
  update(dt) {
    const g = this.game, e = this.e, now = g.now;
    if (!e.alive) return;
    if (g.phase === 'freeze') { e.vel.x = 0; e.vel.z = 0; this.turnToward(dt, 360); return; }
    if (g.phase === 'end' || g.phase === 'matchend') { e.vel.x = 0; e.vel.z = 0; e.firing = false; return; }

    this.perceiveT -= dt;
    if (this.perceiveT <= 0) { this.perceiveT = 0.12; this.perceive(); }

    this.updateGrenade(dt);
    if (!this.throwPlan) this.manageWeapon();

    const blind = now < e.blindUntil;
    if (blind) {
      e.vel.x = 0; e.vel.z = 0; e.firing = false;
      if (this.target && Math.random() < dt * 2) this.triggerBurst();
      this.fireLogic(dt, true);
      return;
    }

    if (this.target && this.target.alive) {
      this.combat(dt);
    } else {
      e.firing = false;
      this.objectiveUpdate(dt);
    }
    this.turnToward(dt, this.target ? this.diff.turnSpeed * this.skill : 420);
    this.stuckCheck(dt);
  }

  // Pick a grenade to throw: utility on site approach, HE at mid-range targets.
  updateGrenade(dt) {
    const g = this.game, e = this.e, now = g.now;
    if (this.throwPlan) {
      const tp = this.throwPlan;
      if (!e.current || e.current.def.cat !== 'grenade') { this.throwPlan = null; e.throwing = false; return; }
      this.desiredYaw = tp.yaw; this.desiredPitch = tp.pitch;
      if (now >= tp.at) {
        e.yaw = tp.yaw; e.pitch = tp.pitch;
        g.throwGrenade(e, false);
        this.throwPlan = null; e.throwing = false;
        this.nadeCooldown = now + 6;
      }
      return;
    }
    if (g.phase !== 'live' && g.phase !== 'planted') return;
    if ((this.nadeCooldown || 0) > now || !e.weapons[4].length || e.reloadLock) return;
    this.nadeCheckT = (this.nadeCheckT || 0) - dt;
    if (this.nadeCheckT > 0) return;
    this.nadeCheckT = 0.5;
    const have = id => e.weapons[4].find(w => w.def.id === id);
    let choice = null, target = null;
    const t = this.target;
    if (t && t.alive) {
      const d = Math.hypot(t.pos.x - e.pos.x, t.pos.z - e.pos.z);
      if (d > 9 && d < 26 && Math.random() < 0.35) {
        if (have('he')) { choice = 'he'; target = { x: t.pos.x, z: t.pos.z }; }
        else if (have('flash') && Math.random() < 0.5) { choice = 'flash'; target = { x: t.pos.x, z: t.pos.z }; }
      }
    } else if ((this.state === 'rush' || this.state === 'goto' || this.state === 'retake') && this.site) {
      const site = g.bomb.planted && this.state === 'retake' ? g.bomb.pos : g.map.sites[this.site];
      const d = Math.hypot(site.x - e.pos.x, site.z - e.pos.z);
      if (d > 14 && d < 34 && Math.random() < 0.5) {
        if (have('smoke')) { choice = 'smoke'; target = site; }
        else if (have('flash')) { choice = 'flash'; target = site; }
      }
    }
    if (!choice) return;
    const w = have(choice);
    g.selectWeapon(e, w);
    const dx = target.x - e.pos.x, dz = target.z - e.pos.z, d = Math.hypot(dx, dz);
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.min(0.7, 0.15 + d / 60);
    this.throwPlan = { at: now + 0.55, yaw, pitch };
    e.throwing = true;
  }

  manageWeapon() {
    const e = this.e, g = this.game, now = g.now;
    const w = e.current;
    const p = e.weapons[1], s = e.weapons[2];
    const usable = x => x && (x.ammo > 0 || x.reserve > 0);
    let want = null;
    if (this.target && this.target.alive) {
      const d = Math.hypot(this.target.pos.x - e.pos.x, this.target.pos.z - e.pos.z);
      if (usable(p)) want = p; else if (usable(s)) want = s; else want = e.weapons[3];
      if (d < 2.2 && !usable(p) && !usable(s)) want = e.weapons[3];
      // AWP scope
      if (want && want.def.scope) want.scoped = d > 8;
    } else {
      if (usable(p)) want = p; else if (usable(s)) want = s; else want = e.weapons[3];
      if (want && want.def.scope) want.scoped = false;
      // reload when safe
      if (w && w.def.mag && w.ammo < w.def.mag * 0.4 && w.reserve > 0 && w.reloadEnd < now) g.startReload(e, w);
    }
    if (want && want !== w && (!w || w.def.cat !== 'grenade' || !e.throwing)) g.selectWeapon(e, want);
    if (w && w.def.mag && w.ammo === 0 && w.reloadEnd < now) {
      if (w.reserve > 0) g.startReload(e, w);
    }
  }

  combat(dt) {
    const g = this.game, e = this.e, now = g.now, t = this.target;
    const dx = t.pos.x - e.pos.x, dz = t.pos.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    // aim point
    const aimHead = Math.random() < this.diff.hsChance * this.skill;
    this.aimT += dt;
    if ((this.aimT % 0.15) < dt) {
      const settle = Math.max(0.2, 1 - (now - this.firstSeenT) / this.diff.settle);
      const moveFactor = 1 + Math.min(1.5, Math.hypot(t.vel.x, t.vel.z) / 5);
      const sigma = this.diff.aimSigma * settle * moveFactor / this.skill * (e.crouch ? 0.8 : 1);
      this.aimErrYaw = gauss() * sigma;
      this.aimErrPitch = gauss() * sigma * 0.7;
      this.aimHead = aimHead;
    }
    const ty = t.pos.y + (this.aimHead ? (t.crouch ? 1.08 : 1.62) : (t.crouch ? 0.7 : 1.15));
    this.lookAt(t.pos.x, ty, t.pos.z);
    this.desiredYaw += rad(this.aimErrYaw);
    this.desiredPitch += rad(this.aimErrPitch);

    // keep planting / defusing if the enemy is far away
    if (this.state === 'plant' && e.plantProgress > 0 && d > 14 && g.phase === 'live') {
      e.vel.x = 0; e.vel.z = 0; e.firing = false; g.plantTick(e, dt); return;
    }
    if (this.state === 'defuse' && e.defuseProgress > 0 && d > 16 && g.phase === 'planted') {
      e.vel.x = 0; e.vel.z = 0; e.firing = false; g.defuseTick(e, dt); return;
    }
    // movement during combat
    const w = e.current;
    const cat = w ? w.def.cat : 'melee';
    const knife = cat === 'melee';
    const speed = weaponSpeed(w);
    const eff = EFF_RANGE[cat] || 30;
    const holding = this.state === 'hold' || this.state === 'defend';
    const tooFar = d > eff * 1.25 || (d > 18 && now - this.firstSeenT > 7 && !holding && !(cat === 'rifle' || cat === 'sniper'));
    if (knife) {
      const n = Math.max(0.001, d);
      e.vel.x = dx / n * speed; e.vel.z = dz / n * speed;
    } else if (tooFar && !(holding && (cat === 'rifle' || cat === 'sniper') && d < 80)) {
      // out of effective range: keep moving toward the objective (or toward the target)
      if (!this.path) { if (this.goal && !this.arrived) this.setGoal(this.goal.x, this.goal.z); else this.setGoal(t.pos.x, t.pos.z); }
      if (this.path) this.followPath(dt); else { e.vel.x = 0; e.vel.z = 0; }
      e.crouch = false;
    } else {
      this.strafeT -= dt;
      if (this.strafeT <= 0) {
        this.strafeT = 0.3 + Math.random() * 0.8;
        const r = Math.random();
        this.strafeDir = r < 0.35 ? 0 : r < 0.68 ? 1 : -1;
        if (d > 30 && w.def.cat !== 'sniper' && Math.random() < 0.4) this.strafeDir = 2; // advance
        if (e.hp < 35 && Math.random() < 0.3) this.strafeDir = -2; // retreat
      }
      const n = Math.max(0.001, d);
      const fx = dx / n, fz = dz / n;
      const rx = -fz, rz = fx;
      let vx = 0, vz = 0;
      if (this.strafeDir === 1 || this.strafeDir === -1) { vx = rx * this.strafeDir; vz = rz * this.strafeDir; }
      else if (this.strafeDir === 2) { vx = fx; vz = fz; }
      else if (this.strafeDir === -2) { vx = -fx; vz = -fz; }
      // check movement would not walk into a wall
      const nx = e.pos.x + vx * 0.6, nz = e.pos.z + vz * 0.6;
      if (vx !== 0 || vz !== 0) { if (!g.nav.walkable(Math.floor(nx), Math.floor(nz))) { vx = 0; vz = 0; } }
      const sp = this.strafeDir === 0 ? 0 : speed;
      e.vel.x = vx * sp; e.vel.z = vz * sp;
      e.crouch = this.diff.hsChance >= 0.3 && this.strafeDir === 0 && d > 12 && Math.random() < 0.5 ? true : (this.strafeDir === 0 ? e.crouch : false);
    }
    // aiming always overrides the path-following look direction
    this.lookAt(t.pos.x, ty, t.pos.z);
    this.desiredYaw += rad(this.aimErrYaw);
    this.desiredPitch += rad(this.aimErrPitch);
    this.fireLogic(dt, false);
    // engage: cancel plant/defuse
    e.planting = false; e.defusing = false;
  }

  triggerBurst() {
    const w = this.e.current; if (!w) return;
    const cat = w.def.cat;
    const burst = this.diff.burst;
    if (cat === 'rifle' || cat === 'smg') this.fireUntil = this.game.now + 0.12 + Math.random() * burst;
    else this.fireUntil = this.game.now + 0.05;
  }

  fireLogic(dt, blind) {
    const g = this.game, e = this.e, now = g.now, t = this.target;
    const w = e.current;
    if (!w || !t) { e.firing = false; return; }
    if (now < this.reactAt) { e.firing = false; return; }
    // only fire when roughly facing the target
    const dx = t.pos.x - e.pos.x, dz = t.pos.z - e.pos.z;
    const wantYaw = Math.atan2(-dx, -dz);
    const err = Math.abs(wrapAngle(wantYaw - e.yaw));
    const d = Math.hypot(dx, dz);
    const tol = rad(blind ? 25 : Math.max(2.5, 14 / Math.max(1, d / 4)));
    if (err > tol) { e.firing = false; return; }
    if (w.def.cat === 'melee') { e.firing = d < 2.0; return; }
    if (w.def.cat === 'grenade') { e.firing = false; return; }
    if (d > (EFF_RANGE[w.def.cat] || 30) * 1.7) { e.firing = false; return; }
    if (w.reloadEnd > now) { e.firing = false; return; }
    this.fireCooldown -= dt;
    if (now < this.fireUntil) {
      e.firing = true;
    } else {
      e.firing = false;
      if (this.fireCooldown <= 0) {
        this.triggerBurst();
        const cat = w.def.cat;
        this.fireCooldown = cat === 'rifle' || cat === 'smg' ? 0.15 + Math.random() * 0.3 / this.skill
          : cat === 'sniper' ? 0.6 + Math.random() * 0.6 : 0.12 + Math.random() * 0.25;
      }
    }
  }

  objectiveUpdate(dt) {
    const g = this.game, e = this.e, now = g.now;
    e.firing = false;

    // bomb pickup for T
    if (e.team === 'T' && g.bomb.dropped && !g.bomb.carrier && this.state !== 'pickup') {
      const d = Math.hypot(g.bomb.dropped.x - e.pos.x, g.bomb.dropped.z - e.pos.z);
      let nearest = true;
      for (const o of g.entities) if (o !== e && o.alive && o.team === 'T' && !o.isPlayer) {
        if (Math.hypot(g.bomb.dropped.x - o.pos.x, g.bomb.dropped.z - o.pos.z) < d) nearest = false;
      }
      if (nearest) { this.state = 'pickup'; this.setGoal(g.bomb.dropped.x, g.bomb.dropped.z); this.arrivedAction = () => this.planObjective(); }
    }
    if (this.state === 'pickup' && (!g.bomb.dropped || g.bomb.carrier)) this.planObjective();

    // weapon pickup when unarmed
    if (!e.weapons[1] && this.state !== 'plant' && this.state !== 'defuse' && now - (this.pickupCheckT || 0) > 1) {
      this.pickupCheckT = now;
      let best = null, bd = 12;
      for (const p of g.pickups) {
        if (p.w.def.slot !== 1 || p.ignoredBy === e) continue;
        const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z); if (d < bd) { bd = d; best = p; }
      }
      if (best) { const prev = this.state; this.state = 'loot'; this.setGoal(best.pos.x, best.pos.z); this.arrivedAction = () => { best.ignoredBy = e; this.state = prev; this.planObjective(); }; }
    }

    // investigate last known enemy position
    const invDist = this.lastKnown ? Math.hypot(this.lastKnown.x - e.pos.x, this.lastKnown.z - e.pos.z) : 999;
    if (this.investigateUntil > now && this.lastKnown && invDist < 28 && !(e.hasBomb && this.state === 'rush') && this.state !== 'plant' && this.state !== 'defuse' && this.state !== 'retake' && this.state !== 'pickup') {
      if (!this.investigating) { this.investigating = true; this.prevState = this.state; this.setGoal(this.lastKnown.x, this.lastKnown.z); this.arrivedAction = () => { this.investigateUntil = 0; }; }
    } else if (this.investigating) { this.investigating = false; this.planObjective(); }

    // CT rotation decisions
    if (e.team === 'CT' && !g.bomb.planted && this.state === 'hold') {
      this.rotateT -= dt;
      if (this.rotateT <= 0) {
        this.rotateT = 3;
        const other = this.site === 'A' ? 'B' : 'A';
        const danger = g.siteDanger[other] || 0, here = g.siteDanger[this.site] || 0;
        if (danger > here + 1 && now - danger < 6 && Math.random() < 0.5) {
          this.site = other; this.state = 'goto';
          const h = pick(g.map.landmarks[other].holds);
          this.setGoal(h.x + 0.5, h.z + 0.5);
          this.arrivedAction = () => { this.state = 'hold'; this.holdAt(e.pos.x, e.pos.z); };
        }
      }
      // late round: push toward mid/known site if T are hiding
      if (g.timer < 30 && !this.lateMove && Math.random() < dt * 0.1) {
        this.lateMove = true;
        const h = pick(g.map.landmarks.MID.holds);
        this.setGoal(h.x + 0.5, h.z + 0.5);
        this.arrivedAction = () => { this.holdAt(e.pos.x, e.pos.z); };
      }
    }
    // T: late round rush to planted/other site
    if (e.team === 'T' && this.state === 'hold' && !g.bomb.planted && g.timer < 40 && !this.lateMove) {
      this.lateMove = true;
      if (!e.hasBomb) {
        const carrier = g.bomb.carrier;
        if (carrier && carrier.alive) { this.setGoal(carrier.pos.x, carrier.pos.z); this.arrivedAction = () => this.holdAt(e.pos.x, e.pos.z); }
      }
    }
    // T carrier: plant when at site
    if (e.team === 'T' && e.hasBomb && !g.bomb.planted) {
      const cell = g.world.cellAt(e.pos.x, e.pos.z);
      if (cell && cell.zone && (this.state === 'hold' || this.state === 'defend' || this.state === 'plant')) {
        this.state = 'plant';
        e.vel.x = 0; e.vel.z = 0; e.crouch = false;
        g.plantTick(e, dt);
        this.lookYaw = this.holdYaw ?? e.yaw;
        this.desiredYaw = this.lookYaw; this.desiredPitch = -0.3;
        return;
      } else if (this.state === 'hold') {
        // walk into the zone
        const s = g.map.sites[this.site];
        const p = g.nav.randomWalkableNear(s.x, s.z, 5);
        const c = g.world.cellAt(p.x, p.z);
        if (c && c.zone) { this.setGoal(p.x, p.z); this.state = 'rush'; this.arrivedAction = () => { this.state = 'hold'; this.holdYaw = e.yaw; }; }
      }
    }
    // CT: defuse
    if (e.team === 'CT' && g.bomb.planted) {
      if (this.state !== 'retake' && this.state !== 'defuse') { this.planObjective(); }
      const d = Math.hypot(g.bomb.pos.x - e.pos.x, g.bomb.pos.z - e.pos.z);
      if (d < 1.4) {
        this.state = 'defuse';
        e.vel.x = 0; e.vel.z = 0; e.crouch = true;
        g.defuseTick(e, dt);
        this.lookAt(g.bomb.pos.x, g.bomb.pos.y, g.bomb.pos.z);
        return;
      } else if (this.state === 'defuse') { this.state = 'retake'; this.setGoal(g.bomb.pos.x, g.bomb.pos.z); }
      else if (this.state === 'retake' && !this.path && !this.arrived) { this.setGoal(g.bomb.pos.x, g.bomb.pos.z); }
    }

    // movement
    if (this.path) {
      this.followPath(dt);
    } else {
      e.vel.x = 0; e.vel.z = 0;
      if (this.state === 'hold' || this.state === 'defend') this.holdBehavior(dt);
    }
  }

  holdBehavior(dt) {
    const g = this.game, e = this.e, now = g.now;
    // look around: sweep around the hold yaw
    this.lookT -= dt;
    if (this.lookT <= 0) {
      this.lookT = 1.5 + Math.random() * 3;
      this.lookYaw = (this.holdYaw ?? e.yaw) + (Math.random() - 0.5) * 1.2;
      if (Math.random() < 0.15) this.lookYaw += Math.PI * (Math.random() - 0.5);
    }
    this.desiredYaw = this.lookYaw; this.desiredPitch = 0;
    if (now > this.holdUntil) {
      // reposition within the site
      const s = this.state === 'defend' && g.bomb.planted ? g.bomb.pos : g.map.sites[this.site || 'A'];
      this.pickHold(s.x, s.z, this.state === 'defend' ? 9 : 11);
    }
  }

  followPath(dt) {
    const g = this.game, e = this.e;
    const wp = this.path[this.pathI];
    if (!wp) { this.path = null; this.arrived = true; e.vel.x = 0; e.vel.z = 0; if (this.arrivedAction) { const a = this.arrivedAction; this.arrivedAction = null; a(); } return; }
    const dx = wp.x - e.pos.x, dz = wp.z - e.pos.z;
    const d = Math.hypot(dx, dz);
    const last = this.pathI === this.path.length - 1;
    if (d < (last ? 0.35 : 0.55)) { this.pathI++; if (this.pathI >= this.path.length) { this.path = null; this.arrived = true; e.vel.x = 0; e.vel.z = 0; if (this.arrivedAction) { const a = this.arrivedAction; this.arrivedAction = null; a(); } } return; }
    const speed = weaponSpeed(e.current) * (e.walking ? 0.52 : 1);
    let vx = dx / d * speed, vz = dz / d * speed;
    // separation from teammates
    for (const o of g.entities) {
      if (o === e || !o.alive) continue;
      const ox = e.pos.x - o.pos.x, oz = e.pos.z - o.pos.z;
      const od = Math.hypot(ox, oz);
      if (od < 1.0 && od > 0.001) { vx += ox / od * 2.5; vz += oz / od * 2.5; }
    }
    e.vel.x = vx; e.vel.z = vz;
    e.crouch = false;
    // look where we're going, with glances
    const faceYaw = Math.atan2(-vx, -vz);
    this.lookT -= dt;
    if (this.lookT <= 0) { this.lookT = 0.8 + Math.random() * 2; this.lookYaw = (Math.random() - 0.5) * 0.9; }
    this.desiredYaw = faceYaw + this.lookYaw * 0.5;
    this.desiredPitch = 0;
  }

  stuckCheck(dt) {
    const e = this.e, g = this.game, now = g.now;
    this.stuckCheckT -= dt;
    if (this.stuckCheckT > 0) return;
    this.stuckCheckT = 0.7;
    const moved = Math.hypot(e.pos.x - this.lastPos.x, e.pos.z - this.lastPos.z);
    this.lastPos = { x: e.pos.x, z: e.pos.z };
    if (this.path && moved < 0.25) {
      this.stuckT += 0.7;
      if (this.stuckT > 1.2) {
        this.stuckT = 0;
        if (e.onGround) { e.vel.y = 6.5; e.onGround = false; e.jumping = true; }
        if (this.goal) this.setGoal(this.goal.x, this.goal.z);
        e.pos.x += (Math.random() - 0.5) * 0.3; e.pos.z += (Math.random() - 0.5) * 0.3;
      }
    } else this.stuckT = 0;
  }

  turnToward(dt, rateDeg) {
    const e = this.e;
    const maxStep = rad(rateDeg) * dt;
    let dy = wrapAngle(this.desiredYaw - e.yaw);
    dy = Math.max(-maxStep, Math.min(maxStep, dy));
    e.yaw += dy;
    let dp = this.desiredPitch - e.pitch;
    dp = Math.max(-maxStep, Math.min(maxStep, dp));
    e.pitch = Math.max(-1.4, Math.min(1.4, e.pitch + dp));
  }
}

// Team-level plans shared among bots.
export class TeamPlan {
  constructor(game, team) { this.game = game; this.team = team; this.site = 'A'; this.assignments = []; }
  newRound() {
    this.site = Math.random() < 0.5 ? 'A' : 'B';
    this.assignments = [];
  }
  assign(e) {
    // CT: alternate A/B with slight bias to A
    const n = this.assignments.length;
    const site = n % 2 === 0 ? 'A' : 'B';
    this.assignments.push({ e, site });
    return site;
  }
}
