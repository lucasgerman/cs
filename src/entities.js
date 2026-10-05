// Humanoid models for bots (and the player when spectated), with simple animation.
import * as THREE from '../vendor/three.module.min.js';
import { buildWeaponModel } from './viewmodel.js';

const COLORS = {
  T: { shirt: 0xc8a062, pants: 0x5b4b36, skin: 0xd9a77a, head: 0x3b2f27, boots: 0x2a2320, vest: 0x8a7046 },
  CT: { shirt: 0x2f4f7f, pants: 0x3a4250, skin: 0xd9a77a, head: 0x1d2735, boots: 0x1d1d1d, vest: 0x22364f },
};

export function createHumanoid(team, name) {
  const c = COLORS[team];
  const mats = {
    shirt: new THREE.MeshLambertMaterial({ color: c.shirt }),
    pants: new THREE.MeshLambertMaterial({ color: c.pants }),
    skin: new THREE.MeshLambertMaterial({ color: c.skin }),
    head: new THREE.MeshLambertMaterial({ color: c.head }),
    boots: new THREE.MeshLambertMaterial({ color: c.boots }),
    vest: new THREE.MeshLambertMaterial({ color: c.vest }),
    gun: new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  };
  const box = (w, h, d, m) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.castShadow = true; return mesh; };
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);

  // legs: pivot at hip (y=0.8)
  const mkLeg = (x) => {
    const piv = new THREE.Group(); piv.position.set(x, 0.82, 0);
    const leg = box(0.17, 0.78, 0.2, mats.pants); leg.position.y = -0.39; piv.add(leg);
    const boot = box(0.18, 0.1, 0.26, mats.boots); boot.position.set(0, -0.77, -0.03); piv.add(boot);
    return piv;
  };
  const lLeg = mkLeg(-0.11), rLeg = mkLeg(0.11);
  body.add(lLeg, rLeg);
  const torso = box(0.46, 0.62, 0.26, mats.shirt); torso.position.y = 1.13; body.add(torso);
  const vest = box(0.48, 0.4, 0.3, mats.vest); vest.position.y = 1.15; body.add(vest);
  const head = box(0.26, 0.28, 0.26, mats.head); head.position.y = 1.65; body.add(head);
  const face = box(0.2, 0.14, 0.05, mats.skin); face.position.set(0, 1.63, -0.14); body.add(face);
  const visor = box(0.28, 0.06, 0.04, mats.boots); visor.position.set(0, 1.72, -0.14); body.add(visor);
  // arms: pivot at shoulder (y=1.4)
  const mkArm = (x) => {
    const piv = new THREE.Group(); piv.position.set(x, 1.4, 0);
    const arm = box(0.12, 0.55, 0.14, mats.shirt); arm.position.y = -0.27; piv.add(arm);
    const hand = box(0.11, 0.1, 0.12, mats.skin); hand.position.y = -0.58; piv.add(hand);
    return piv;
  };
  const lArm = mkArm(-0.3), rArm = mkArm(0.3);
  body.add(lArm, rArm);
  // weapon held in front (actual model swapped in by animateHumanoid)
  const gun = new THREE.Group();
  gun.position.set(0.12, 1.3, -0.32);
  body.add(gun);
  // name tag
  const tag = makeTag(name, team);
  tag.position.y = 2.05;
  g.add(tag);

  g.userData = { body, lLeg, rLeg, lArm, rArm, head, gun, torso, mats, tag, phase: Math.random() * 6, dead: false, deadT: 0, gunId: null, team, flash: false };
  return g;
}

function makeTag(name, team) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.font = 'bold 34px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.45)'; g.fillRect(20, 8, 216, 48);
  g.fillStyle = team === 'CT' ? '#9fc4ff' : '#ffd27f';
  g.fillText(name, 128, 32);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.set(1.4, 0.35, 1);
  return s;
}

// Pose the model for an entity each frame.
export function animateHumanoid(e, dt, now = 0) {
  const m = e.model; if (!m) return;
  const u = m.userData;
  m.position.set(e.pos.x, e.pos.y, e.pos.z);
  // hit flash: brief red tint on the whole body
  const flashing = e.hitFlashUntil > now;
  if (flashing !== u.flash) {
    u.flash = flashing;
    for (const k of Object.keys(u.mats)) u.mats[k].emissive.setHex(flashing ? 0x5a0000 : 0x000000);
  }
  // show the weapon the bot actually carries
  const wid = e.current ? e.current.def.id : null;
  if (wid !== u.gunId) {
    u.gunId = wid;
    while (u.gun.children.length) u.gun.remove(u.gun.children[0]);
    if (e.current) {
      const wm = buildWeaponModel(e.current.def, u.team, false);
      wm.scale.setScalar(1.15);
      wm.traverse(o => { if (o.isMesh) o.castShadow = true; });
      u.gun.add(wm);
    }
  }
  if (!e.alive) {
    // fall over, then fade in deathmatch to avoid clutter
    u.deadT += dt;
    const k = Math.min(1, u.deadT / 0.4);
    u.body.rotation.x = -Math.PI / 2 * k;
    u.body.position.y = 0.18 * k;
    u.body.rotation.y = e.yaw;
    u.tag.visible = false;
    if (e.hideCorpseAfter && u.deadT > e.hideCorpseAfter) m.visible = false;
    return;
  }
  u.body.rotation.y = e.yaw;
  const speed = Math.hypot(e.vel.x, e.vel.z);
  u.phase += dt * Math.min(14, speed * 2.4);
  const swing = Math.min(1, speed / 2) * 0.7;
  u.lLeg.rotation.x = Math.sin(u.phase) * swing;
  u.rLeg.rotation.x = -Math.sin(u.phase) * swing;
  // arms hold the weapon forward
  const aim = 1.3 + e.pitch * 0.6;
  u.rArm.rotation.set(aim, 0, 0); u.lArm.rotation.set(aim + 0.1, 0, 0);
  u.lArm.position.x = -0.22; u.rArm.position.x = 0.28;
  u.gun.rotation.x = e.pitch;
  u.gun.visible = !!e.showGun && !!e.current && e.current.def.cat !== 'melee' || (e.current && e.current.def.cat === 'melee');
  const crouch = e.crouch ? 0.68 : 1;
  u.body.scale.y += (crouch - u.body.scale.y) * Math.min(1, dt * 12);
  u.body.rotation.x = 0;
  u.body.position.y = 0;
}

export function setModelVisible(e, v) { if (e.model) e.model.visible = v; }
