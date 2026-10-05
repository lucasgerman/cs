// First-person player controller: look, CS-style movement, firing, interaction, camera.
import * as THREE from '../vendor/three.module.min.js';
import { PLAYER, ROUND } from './config.js';
import { weaponSpeed } from './weapons.js';

const rad = d => d * Math.PI / 180;

export class PlayerController {
  constructor(game, input) {
    this.game = game; this.input = input;
    this.e = null;
    this.firedPress = false;
    this.stepDist = 0;
    this.shake = 0; this.shakeT = 0;
    this.specIndex = 0; this.specTarget = null; this.specDelay = 0;
    this.freeCam = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 };
    this.mouseDX = 0; this.mouseDY = 0;
    this.visRecoilYaw = 0; this.visRecoilPitch = 0;
    this.lastSlot = 2;
    this.bob = 0;
  }

  attach(e) { this.e = e; this.specTarget = null; }

  look(dx, dy) {
    const e = this.e; if (!e) return;
    const g = this.game;
    const scoped = e.current && e.current.scoped;
    const sens = g.settings.sensitivity * 0.022 * Math.PI / 180 * (scoped ? 0.35 : 1);
    this.mouseDX += dx; this.mouseDY += dy;
    const t = e.alive ? e : this.freeCam;
    if (!e.alive && this.specTarget) return;
    t.yaw -= dx * sens;
    t.pitch = Math.max(-rad(89), Math.min(rad(89), t.pitch - dy * sens));
  }

  update(dt) {
    const e = this.e, g = this.game, inp = this.input;
    if (!e) return;
    if (!e.alive) { this.spectate(dt); this.mouseDX = this.mouseDY = 0; return; }
    const now = g.now;
    const frozen = g.phase === 'freeze' || g.phase === 'matchend';
    const w = e.current;

    // --- weapon selection
    if (inp.pressed('Digit1')) g.selectSlot(e, 1);
    if (inp.pressed('Digit2')) g.selectSlot(e, 2);
    if (inp.pressed('Digit3')) g.selectSlot(e, 3);
    if (inp.pressed('Digit4')) g.selectSlot(e, 4);
    if (inp.pressed('Digit5')) g.selectSlot(e, 4);
    if (inp.pressed('KeyQ')) g.selectLast(e);
    if (inp.wheel !== 0) { g.cycleWeapon(e, inp.wheel > 0 ? 1 : -1); inp.wheel = 0; }
    if (inp.pressed('KeyR') && w) g.startReload(e, w);

    // --- crouch / walk
    e.crouch = inp.down('ControlLeft') || inp.down('ControlRight') || inp.down('KeyC');
    e.walking = inp.down('ShiftLeft') || inp.down('ShiftRight');

    // --- using (plant / defuse / pickup)
    const use = inp.down('KeyE');
    e.useHeld = use;
    if (use) g.playerUse(e, dt); else { e.planting = false; e.defusing = false; e.usePressHandled = false; }
    if (inp.pressed('KeyG')) g.dropWeapon(e);

    // --- movement (CS-like accelerate/friction, in m/s)
    let fx = 0, fz = 0;
    if (inp.down('KeyW')) fz -= 1;
    if (inp.down('KeyS')) fz += 1;
    if (inp.down('KeyA')) fx -= 1;
    if (inp.down('KeyD')) fx += 1;
    const busy = e.planting || e.defusing;
    if (frozen || busy) { fx = 0; fz = 0; }
    const len = Math.hypot(fx, fz);
    if (len > 0) { fx /= len; fz /= len; }
    const sy = Math.sin(e.yaw), cy = Math.cos(e.yaw);
    // forward = (-sin yaw, -cos yaw); right = (cos yaw, -sin yaw)
    const wx = fx * cy + fz * sy, wz = -fx * sy + fz * cy;
    let maxSpeed = weaponSpeed(w);
    if (e.crouch) maxSpeed *= PLAYER.crouchMul; else if (e.walking) maxSpeed *= PLAYER.walkMul;
    if (w && w.def.scope && w.scoped) maxSpeed *= 0.6;
    const v = e.vel;
    if (e.onGround) {
      const sp = Math.hypot(v.x, v.z);
      if (sp > 0) {
        const drop = Math.max(sp, 2.5) * 5.2 * dt;
        const ns = Math.max(0, sp - drop) / sp;
        v.x *= ns; v.z *= ns;
      }
      const cur = v.x * wx + v.z * wz;
      const add = maxSpeed - cur;
      if (add > 0 && len > 0) {
        const acc = Math.min(add, 5.5 * maxSpeed * dt * 1.6);
        v.x += wx * acc; v.z += wz * acc;
      }
      if (inp.down('Space') && !frozen && !busy && !this.jumpLock) {
        v.y = PLAYER.jump; e.onGround = false; e.jumping = true; this.jumpLock = true;
        this.stepDist = 0;
      }
    } else {
      if (len > 0) {
        const cur = v.x * wx + v.z * wz;
        const add = Math.min(PLAYER.airMax, maxSpeed) - cur;
        if (add > 0) {
          const acc = Math.min(add, 12 * maxSpeed * dt);
          v.x += wx * acc; v.z += wz * acc;
        }
      }
    }
    if (!inp.down('Space')) this.jumpLock = false;
    e.landed = 0;
    g.world.moveBody(e, dt);
    if (e.landed > 7) { g.audio.play('land', null, { volume: 0.5 }); g.notifyNoise(e, 12); }
    // footsteps
    const sp = Math.hypot(v.x, v.z);
    if (e.onGround && sp > 2.2 && !e.walking) {
      this.stepDist += sp * dt;
      if (this.stepDist > 2.6) { this.stepDist = 0; g.audio.play('footstep', null, { volume: 0.35 }); g.notifyNoise(e, 14); }
    }

    // --- firing
    const m0 = inp.mouse[0], m2 = inp.mouse[2];
    if (w && w.def.cat === 'grenade') {
      if ((m0 || m2) && !this.firedPress && !frozen) { this.firedPress = true; this.throwType = m2 ? 'under' : 'over'; this.throwAt = now + 0.15; }
      if (this.throwAt && now >= this.throwAt) { g.throwGrenade(e, this.throwType === 'under'); this.throwAt = 0; }
      if (!m0 && !m2) this.firedPress = false;
      e.firing = false;
    } else {
      if (m0 && !frozen && !busy) {
        if (w && (w.def.auto || !this.firedPress)) g.fireWeapon(e);
        this.firedPress = true;
      } else this.firedPress = false;
      if (m2 && w && !this.altPress) {
        this.altPress = true;
        if (w.def.scope) { w.scoped = !w.scoped; g.audio.play('click'); }
        else if (w.def.cat === 'melee') g.fireWeapon(e, true);
      }
      if (!m2) this.altPress = false;
    }
    if (inp.pressed('KeyF')) g.inspect();
    if (inp.pressed('KeyZ')) g.radio('A');
    if (inp.pressed('KeyX')) g.radio('B');
    if (inp.pressed('KeyV')) g.radio('hold');
    if (inp.pressed('KeyT')) g.radio('follow');
    if (inp.pressed('KeyY')) g.radio('report');

    // --- recoil recovery
    this.recoverRecoil(e, dt);
    this.visRecoilYaw += (e.recoilYaw * 0.6 - this.visRecoilYaw) * Math.min(1, dt * 30);
    this.visRecoilPitch += (e.recoilPitch * 0.6 - this.visRecoilPitch) * Math.min(1, dt * 30);
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.bob += dt * sp * 1.6;
  }

  recoverRecoil(e, dt) {
    const w = e.current;
    const since = w ? this.game.now - w.lastShot : 10;
    if (since > 0.08) {
      const k = Math.exp(-dt * 7);
      e.recoilYaw *= k; e.recoilPitch *= k;
    }
  }

  // Camera placement each frame (also used while spectating).
  updateCamera(camera) {
    const e = this.e, g = this.game;
    if (!e) return;
    const scoped = e.alive && e.current && e.current.scope && e.current.scoped;
    const targetFov = scoped ? 22 : g.settings.fov;
    camera.fov += (targetFov - camera.fov) * 0.35;
    camera.updateProjectionMatrix();
    camera.rotation.order = 'YXZ';
    if (e.alive) {
      const eye = e.crouch ? PLAYER.crouchEye : PLAYER.eye;
      this.eyeH = (this.eyeH ?? eye) + (eye - (this.eyeH ?? eye)) * 0.3;
      const bobY = e.onGround ? Math.sin(this.bob) * 0.012 : 0;
      camera.position.set(e.pos.x, e.pos.y + this.eyeH + bobY, e.pos.z);
      let shakeX = 0, shakeY = 0;
      if (this.shakeT > 0) { shakeX = (Math.random() - 0.5) * this.shake * this.shakeT * 0.1; shakeY = (Math.random() - 0.5) * this.shake * this.shakeT * 0.1; }
      camera.rotation.y = e.yaw - rad(this.visRecoilYaw) + shakeX;
      camera.rotation.x = e.pitch + rad(this.visRecoilPitch) + shakeY;
      camera.rotation.z = 0;
    } else if (this.specTarget && this.specTarget.alive) {
      const t = this.specTarget;
      camera.position.set(t.pos.x, t.pos.y + (t.crouch ? PLAYER.crouchEye : PLAYER.eye), t.pos.z);
      camera.rotation.y = t.yaw; camera.rotation.x = t.pitch; camera.rotation.z = 0;
    } else {
      const f = this.freeCam;
      camera.position.set(f.x, f.y, f.z);
      camera.rotation.y = f.yaw; camera.rotation.x = f.pitch; camera.rotation.z = 0;
    }
  }

  onDeath() {
    const e = this.e;
    this.freeCam = { x: e.pos.x, y: e.pos.y + 1.6, z: e.pos.z, yaw: e.yaw, pitch: e.pitch };
    this.specDelay = 2.0;
    this.specTarget = null;
  }

  spectate(dt) {
    const g = this.game, inp = this.input, e = this.e;
    this.specDelay -= dt;
    const mates = g.entities.filter(o => o.alive && o.team === e.team && o !== e);
    if (this.specTarget && !this.specTarget.alive) this.specTarget = null;
    if (!this.specTarget && this.specDelay <= 0 && mates.length) this.specTarget = mates[this.specIndex % mates.length];
    if (inp.mouse[0] && !this.firedPress) {
      this.firedPress = true;
      if (mates.length) {
        this.specIndex = (this.specIndex + 1) % (mates.length + 1);
        this.specTarget = this.specIndex === mates.length ? null : mates[this.specIndex];
        if (!this.specTarget && mates.length) { const m = mates[0]; this.freeCam.x = m.pos.x; this.freeCam.y = m.pos.y + 1.6; this.freeCam.z = m.pos.z; }
      }
    }
    if (!inp.mouse[0]) this.firedPress = false;
    if (!this.specTarget) {
      const f = this.freeCam;
      let fx = 0, fz = 0, fy = 0;
      if (inp.down('KeyW')) fz -= 1; if (inp.down('KeyS')) fz += 1;
      if (inp.down('KeyA')) fx -= 1; if (inp.down('KeyD')) fx += 1;
      if (inp.down('Space')) fy += 1; if (inp.down('ControlLeft')) fy -= 1;
      const sp = 9 * dt;
      const sy = Math.sin(f.yaw), cy = Math.cos(f.yaw);
      f.x += (fx * cy + fz * sy) * sp; f.z += (-fx * sy + fz * cy) * sp; f.y += fy * sp;
    }
    // bots we spectate should not be drawn (we're inside their head)
    for (const o of g.entities) if (o.model) o.model.visible = o !== this.specTarget && !o.isPlayer;
  }

  addShake(a) { this.shake = Math.max(this.shake, a); this.shakeT = 0.5; }
  // aim punch when hit: kicks the view, recovers with the recoil decay
  punch(deg) { const e = this.e; if (!e) return; e.recoilPitch += deg; e.recoilYaw += (Math.random() - 0.5) * deg; }
}
