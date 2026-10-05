// First-person weapon models rendered in an overlay scene (no world clipping).
import * as THREE from '../vendor/three.module.min.js';

const MAT = {
  metal: new THREE.MeshStandardMaterial({ color: 0x4a4d53, roughness: 0.5, metalness: 0.35 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.6, metalness: 0.3 }),
  wood: new THREE.MeshStandardMaterial({ color: 0x6b4426, roughness: 0.8 }),
  tan: new THREE.MeshStandardMaterial({ color: 0x8f8160, roughness: 0.8 }),
  green: new THREE.MeshStandardMaterial({ color: 0x3f5d3a, roughness: 0.8 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.5, metalness: 0.3 }),
  skin: new THREE.MeshStandardMaterial({ color: 0xd9a77a, roughness: 0.9 }),
  glove: new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 }),
  blade: new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 0.25, metalness: 0.9 }),
  glass: new THREE.MeshStandardMaterial({ color: 0x3a6a9a, roughness: 0.1, metalness: 0.8, emissive: 0x112233 }),
  bottle: new THREE.MeshStandardMaterial({ color: 0x7fb070, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.85 }),
  red: new THREE.MeshStandardMaterial({ color: 0x9a2a2a, roughness: 0.5, metalness: 0.3 }),
};

const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mesh.position.set(x, y, z); return mesh; };
const cyl = (r, h, m, x = 0, y = 0, z = 0, rotX = Math.PI / 2) => { const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 14), m); mesh.rotation.x = rotX; mesh.position.set(x, y, z); return mesh; };

function hands(g, sleeve) {
  // right hand on grip, left hand forward under the handguard
  g.add(box(0.065, 0.06, 0.11, MAT.glove, 0.0, -0.085, 0.07));
  const rs = box(0.07, 0.07, 0.2, sleeve, 0.03, -0.12, 0.22); rs.rotation.x = -0.35; g.add(rs);
  g.add(box(0.06, 0.055, 0.1, MAT.glove, -0.03, -0.045, -0.2));
  const ls = box(0.065, 0.065, 0.22, sleeve, -0.08, -0.09, -0.04); ls.rotation.y = 0.35; ls.rotation.x = -0.25; g.add(ls);
}

export function buildWeaponModel(def, team) {
  const g = new THREE.Group();
  const sleeve = new THREE.MeshStandardMaterial({ color: team === 'CT' ? 0x2f4f7f : 0xc8a062, roughness: 0.9 });
  const cat = def.cat;
  if (cat === 'melee') {
    g.add(box(0.08, 0.07, 0.14, MAT.glove, 0, -0.02, 0.04));
    g.add(box(0.09, 0.09, 0.16, sleeve, 0.01, -0.05, 0.18));
    g.add(box(0.03, 0.035, 0.13, MAT.dark, 0, 0.02, -0.02));
    const blade = box(0.008, 0.035, 0.24, MAT.blade, 0, 0.025, -0.2);
    g.add(blade);
    g.add(box(0.04, 0.012, 0.012, MAT.grey, 0, 0.03, -0.09));
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.3);
  } else if (cat === 'pistol') {
    hands(g, sleeve);
    g.add(box(0.035, 0.05, 0.2, MAT.metal, 0, 0.01, -0.07));   // slide
    g.add(box(0.03, 0.03, 0.18, MAT.dark, 0, -0.02, -0.07));
    g.add(box(0.03, 0.1, 0.045, MAT.dark, 0, -0.07, 0.02));   // grip (under hand)
    g.add(box(0.012, 0.02, 0.008, MAT.dark, 0, 0.045, -0.16));  // sight
    g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.18);
  } else if (cat === 'smg') {
    hands(g, sleeve);
    g.add(box(0.05, 0.07, 0.36, MAT.metal, 0, 0, -0.08));
    g.add(cyl(0.012, 0.12, MAT.dark, 0, 0.01, -0.32));
    g.add(box(0.03, 0.16, 0.05, MAT.dark, 0, -0.1, -0.02));    // mag
    g.add(box(0.03, 0.04, 0.2, MAT.dark, 0, 0.0, 0.2));        // stock
    g.add(box(0.012, 0.025, 0.01, MAT.dark, 0, 0.045, -0.22));
    g.userData.muzzle = new THREE.Vector3(0, 0.01, -0.38);
  } else if (cat === 'shotgun') {
    hands(g, sleeve);
    g.add(cyl(0.02, 0.5, MAT.metal, 0, 0.02, -0.2));
    g.add(cyl(0.022, 0.4, MAT.dark, 0, -0.02, -0.18));
    g.add(box(0.045, 0.06, 0.25, MAT.wood, 0, -0.01, 0.1));
    g.add(box(0.05, 0.05, 0.18, MAT.wood, 0, 0.0, 0.3));
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.45);
  } else if (cat === 'sniper') {
    hands(g, sleeve);
    g.add(box(0.05, 0.07, 0.5, MAT.green, 0, 0, 0.0));
    g.add(cyl(0.013, 0.5, MAT.dark, 0, 0.02, -0.5));
    g.add(cyl(0.025, 0.18, MAT.dark, 0, 0.075, -0.05));        // scope
    g.add(cyl(0.03, 0.03, MAT.glass, 0, 0.075, -0.15));
    g.add(box(0.03, 0.12, 0.06, MAT.dark, 0, -0.08, -0.08));   // mag
    g.add(box(0.045, 0.07, 0.22, MAT.green, 0, -0.01, 0.3));   // stock
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.75);
  } else if (cat === 'rifle') {
    hands(g, sleeve);
    const body = def.id === 'ak47' ? MAT.wood : MAT.metal;
    g.add(box(0.05, 0.075, 0.42, MAT.metal, 0, 0, -0.05));     // receiver
    g.add(box(0.05, 0.06, 0.22, body, 0, -0.005, -0.3));        // handguard
    g.add(cyl(0.012, 0.22, MAT.dark, 0, 0.02, -0.5));           // barrel
    const mag = box(0.03, 0.17, 0.065, MAT.dark, 0, -0.1, -0.08); mag.rotation.x = 0.35; g.add(mag);
    g.add(box(0.04, 0.05, 0.22, body, 0, -0.005, 0.26));        // stock
    g.add(box(0.012, 0.03, 0.01, MAT.dark, 0, 0.05, -0.2));     // front sight
    g.add(box(0.03, 0.025, 0.03, MAT.dark, 0, 0.05, 0.05));     // rear sight
    g.userData.muzzle = new THREE.Vector3(0, 0.02, -0.62);
  } else if (cat === 'grenade') {
    g.add(box(0.08, 0.07, 0.14, MAT.glove, 0, -0.02, 0.04));
    g.add(box(0.09, 0.09, 0.16, sleeve, 0.01, -0.05, 0.18));
    if (def.id === 'he') { const s = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), MAT.green); s.position.set(0, 0.03, -0.02); g.add(s); }
    else if (def.id === 'molotov') { g.add(cyl(0.03, 0.12, MAT.bottle, 0, 0.03, -0.02, 0)); g.add(cyl(0.012, 0.06, MAT.bottle, 0, 0.11, -0.02, 0)); g.add(box(0.025, 0.03, 0.025, MAT.tan, 0, 0.145, -0.02)); }
    else if (def.id === 'incendiary') { g.add(cyl(0.03, 0.12, MAT.red, 0, 0.03, -0.02, 0)); }
    else { const c = cyl(0.03, 0.11, def.id === 'flash' ? MAT.grey : MAT.green, 0, 0.03, -0.02, 0); g.add(c); }
    g.add(box(0.02, 0.02, 0.03, MAT.grey, 0, 0.085, -0.02));
    g.userData.muzzle = new THREE.Vector3(0, 0, -0.1);
  }
  return g;
}

export class ViewModel {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 10);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x776655, 1.6));
    const d = new THREE.DirectionalLight(0xfff0dd, 2.2); d.position.set(1, 2, 1); this.scene.add(d);
    const d2 = new THREE.DirectionalLight(0xdde8ff, 0.8); d2.position.set(-1, 0.5, -1); this.scene.add(d2);
    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.model = null; this.def = null; this.team = 'T';
    this.basePos = new THREE.Vector3(0.17, -0.17, -0.36);
    this.root.scale.setScalar(0.62);
    this.kickZ = 0; this.kickRot = 0; this.swap = 0; this.bobT = 0; this.reloadK = 0;
    this.swayX = 0; this.swayY = 0; this.lower = 0;
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd890, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthTest: false }));
    this.flash.scale.set(0.16, 0.16, 0.16);
    this.root.add(this.flash);
    this.flashT = 0;
    this.cache = {};
  }
  setAspect(a) { this.camera.aspect = a; this.camera.updateProjectionMatrix(); }
  setWeapon(def, team) {
    if (this.model) this.root.remove(this.model);
    this.def = def; this.team = team;
    const key = def.id + team;
    if (!this.cache[key]) this.cache[key] = buildWeaponModel(def, team);
    this.model = this.cache[key];
    this.root.add(this.model);
    this.swap = 1;
  }
  kick(amount = 1) {
    this.kickZ = Math.min(0.1, this.kickZ + 0.035 * amount);
    this.kickRot = Math.min(0.25, this.kickRot + 0.06 * amount);
    this.flashT = 0.05;
  }
  update(dt, st) {
    this.bobT += dt * (st.moving ? (st.walking ? 7 : 11) : 2);
    const bobA = st.moving && st.onGround ? (st.walking ? 0.004 : 0.009) : 0.002;
    this.kickZ *= Math.exp(-dt * 14); this.kickRot *= Math.exp(-dt * 12);
    this.swap = Math.max(0, this.swap - dt * 3.2);
    this.swayX += (st.mouseDX * 0.0008 - this.swayX) * Math.min(1, dt * 10);
    this.swayY += (st.mouseDY * 0.0008 - this.swayY) * Math.min(1, dt * 10);
    const targetLower = st.scoped ? 1 : 0;
    this.lower += (targetLower - this.lower) * Math.min(1, dt * 12);
    const r = this.root;
    r.position.copy(this.basePos);
    r.position.x += Math.cos(this.bobT * 0.5) * bobA * 1.2 - this.swayX * 2;
    r.position.y += Math.sin(this.bobT) * bobA - this.swap * 0.35 - this.lower * 0.6 + this.swayY * 1.5;
    r.position.z += this.kickZ;
    r.rotation.set(-this.kickRot + this.swap * 0.6 - this.swayY * 3, this.swayX * 3, 0);
    if (st.reloading) {
      const k = st.reloadK; // 0..1
      const a = Math.sin(Math.min(1, k * 1.15) * Math.PI);
      r.rotation.x -= a * 0.7; r.position.y -= a * 0.12; r.rotation.z -= a * 0.4;
    }
    if (st.crouch) r.position.y += 0.015;
    if (this.model) {
      this.model.visible = !(st.scoped && this.lower > 0.5);
      this.flash.position.copy(this.model.userData.muzzle || new THREE.Vector3());
    }
    this.flashT -= dt;
    this.flash.material.opacity = this.flashT > 0 ? 0.9 : 0;
    if (this.flashT > 0) { const s = 0.12 + Math.random() * 0.12; this.flash.scale.set(s, s, s); }
  }
  render(renderer) {
    renderer.clearDepth();
    renderer.render(this.scene, this.camera);
  }
}
