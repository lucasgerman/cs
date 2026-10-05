// Visual effects: tracers, impact decals, dust puffs, blood, explosions, smoke clouds.
import * as THREE from '../vendor/three.module.min.js';

function circleTex(size, inner, outer, soft = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner); grd.addColorStop(soft ? 0.5 : 0.9, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];     // transient objects {obj, start, dur, update(k)}
    this.decals = [];
    this.decalIndex = 0;
    this.maxDecals = 250;
    this.puffTex = circleTex(64, 'rgba(210,190,150,0.9)', 'rgba(210,190,150,0)');
    this.bloodTex = circleTex(32, 'rgba(160,20,20,1)', 'rgba(120,10,10,0)');
    this.flashTex = circleTex(128, 'rgba(255,240,200,1)', 'rgba(255,200,120,0)');
    this.smokeTex = circleTex(128, 'rgba(230,230,230,1)', 'rgba(230,230,230,0)');
    this.decalTex = circleTex(32, 'rgba(25,20,15,0.85)', 'rgba(25,20,15,0)', false);
    this.decalGeo = new THREE.PlaneGeometry(0.11, 0.11);
    this.decalMat = new THREE.MeshBasicMaterial({ map: this.decalTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    this.tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
    this.puffMat = new THREE.SpriteMaterial({ map: this.puffTex, transparent: true, depthWrite: false });
    this.bloodMat = new THREE.SpriteMaterial({ map: this.bloodTex, transparent: true, depthWrite: false });
    this.flashMat = new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.smokeMat = new THREE.MeshLambertMaterial({ color: 0xdcdcdc, transparent: true, opacity: 0.95, depthWrite: false });
    this.smokeGeo = new THREE.SphereGeometry(1, 12, 10);
    this.sphereGeo = new THREE.SphereGeometry(1, 16, 12);
    this.now = 0;
  }

  add(obj, dur, update, onEnd) {
    this.scene.add(obj);
    this.items.push({ obj, start: this.now, dur, update, onEnd });
  }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(from.x, from.y, from.z), new THREE.Vector3(to.x, to.y, to.z)]);
    const line = new THREE.Line(geo, this.tracerMat.clone());
    this.add(line, 0.07, (k, o) => { o.material.opacity = 0.9 * (1 - k); }, o => { o.geometry.dispose(); o.material.dispose(); });
  }

  impact(hit, big = false) {
    // decal
    let d;
    if (this.decals.length < this.maxDecals) {
      d = new THREE.Mesh(this.decalGeo, this.decalMat);
      this.decals.push(d); this.scene.add(d);
    } else {
      d = this.decals[this.decalIndex]; this.decalIndex = (this.decalIndex + 1) % this.maxDecals;
    }
    d.position.set(hit.x + hit.nx * 0.012, hit.y + hit.ny * 0.012, hit.z + hit.nz * 0.012);
    d.lookAt(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz);
    d.rotateZ(Math.random() * Math.PI * 2);
    d.visible = true;
    // dust puff
    const s = new THREE.Sprite(this.puffMat.clone());
    s.position.set(hit.x + hit.nx * 0.05, hit.y + hit.ny * 0.05, hit.z + hit.nz * 0.05);
    const size = big ? 0.9 : 0.35;
    this.add(s, 0.45, (k, o) => { const sc = size * (0.3 + k); o.scale.set(sc, sc, sc); o.material.opacity = 0.8 * (1 - k); o.position.y += 0.004; }, o => o.material.dispose());
  }

  blood(x, y, z, n = 4) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.bloodMat.clone());
      s.position.set(x, y, z);
      const vx = (Math.random() - 0.5) * 2.5, vy = Math.random() * 2, vz = (Math.random() - 0.5) * 2.5;
      const sc = 0.12 + Math.random() * 0.1;
      s.scale.set(sc, sc, sc);
      this.add(s, 0.5, (k, o, dt) => { o.position.x += vx * dt; o.position.z += vz * dt; o.position.y += (vy - 9 * k) * dt; o.material.opacity = 1 - k; }, o => o.material.dispose());
    }
  }

  muzzle(x, y, z) {
    const s = new THREE.Sprite(this.flashMat);
    s.position.set(x, y, z); s.scale.set(0.35, 0.35, 0.35);
    this.add(s, 0.05, () => {});
    const l = new THREE.PointLight(0xffd080, 6, 7, 2);
    l.position.set(x, y, z);
    this.add(l, 0.05, (k, o) => { o.intensity = 6 * (1 - k); });
  }

  explosion(x, y, z) {
    const m = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.95 }));
    m.position.set(x, y + 0.4, z);
    this.add(m, 0.35, (k, o) => { const sc = 0.5 + k * 5; o.scale.set(sc, sc, sc); o.material.opacity = 0.95 * (1 - k); o.material.color.setHSL(0.08 - k * 0.06, 1, 0.6 - k * 0.3); }, o => o.material.dispose());
    const l = new THREE.PointLight(0xffb060, 60, 30, 2);
    l.position.set(x, y + 1, z);
    this.add(l, 0.4, (k, o) => { o.intensity = 60 * (1 - k); });
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(this.puffMat.clone());
      s.material.color.setHex(0x8a7a60);
      s.position.set(x, y + 0.3, z);
      const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4;
      const vx = Math.cos(a) * sp, vz = Math.sin(a) * sp, vy = 1 + Math.random() * 3;
      this.add(s, 1.6, (k, o, dt) => { o.position.x += vx * dt * (1 - k); o.position.z += vz * dt * (1 - k); o.position.y += vy * dt * (1 - k); const sc = 1 + k * 4; o.scale.set(sc, sc, sc); o.material.opacity = 0.7 * (1 - k); }, o => o.material.dispose());
    }
  }

  bombExplosion(x, y, z) {
    for (let i = 0; i < 4; i++) setTimeout(() => this.explosion(x + (Math.random() - 0.5) * 4, y + Math.random() * 2, z + (Math.random() - 0.5) * 4), i * 90);
    // rising fireball + dark mushroom cloud
    const fire = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: 0xffb040, transparent: true, opacity: 0.95 }));
    fire.position.set(x, y + 2, z);
    this.add(fire, 1.4, (k, o) => { const sc = 2 + k * 10; o.scale.set(sc, sc * 1.3, sc); o.position.y = y + 2 + k * 9; o.material.opacity = 0.9 * (1 - k); o.material.color.setHSL(0.07 - k * 0.05, 1, 0.55 - k * 0.3); }, o => o.material.dispose());
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(this.puffMat.clone());
      s.material.color.setHSL(0.07, 0.3, 0.15 + Math.random() * 0.15);
      const a = Math.random() * Math.PI * 2, r = Math.random() * 3;
      s.position.set(x + Math.cos(a) * r, y + 0.5 + Math.random() * 3, z + Math.sin(a) * r);
      const vx = Math.cos(a) * (2 + Math.random() * 4), vz = Math.sin(a) * (2 + Math.random() * 4), vy = 4 + Math.random() * 6;
      const dur = 4 + Math.random() * 3;
      this.add(s, dur, (k, o, dt) => { const slow = 1 - k * 0.8; o.position.x += vx * dt * slow; o.position.z += vz * dt * slow; o.position.y += vy * dt * slow; const sc = 2 + k * 9; o.scale.set(sc, sc, sc); o.material.opacity = 0.75 * (1 - k * k); }, o => o.material.dispose());
    }
    const l = new THREE.PointLight(0xffc070, 400, 90, 1.5);
    l.position.set(x, y + 3, z);
    this.add(l, 1.2, (k, o) => { o.intensity = 400 * (1 - k); });
  }

  flashBurst(x, y, z) {
    const s = new THREE.Sprite(this.flashMat);
    s.position.set(x, y, z);
    this.add(s, 0.25, (k, o) => { const sc = 1 + k * 6; o.scale.set(sc, sc, sc); });
    const l = new THREE.PointLight(0xffffff, 120, 40, 2);
    l.position.set(x, y, z);
    this.add(l, 0.3, (k, o) => { o.intensity = 120 * (1 - k); });
  }

  // Smoke cloud: returns a group that fades in and out over `dur` seconds.
  smoke(x, y, z, radius, dur) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const blobs = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      m.material.color.setHSL(0, 0, 0.78 + Math.random() * 0.15);
      const a = Math.random() * Math.PI * 2, r = Math.random() * radius * 0.55;
      m.position.set(Math.cos(a) * r, 0.4 + Math.random() * radius * 0.6, Math.sin(a) * r);
      const s = radius * (0.45 + Math.random() * 0.4);
      m.userData.size = s;
      m.scale.set(0.01, 0.01, 0.01);
      g.add(m); blobs.push(m);
    }
    this.add(g, dur, (k, o, dt) => {
      const t = k * dur;
      const grow = Math.min(1, t / 1.2);
      const fade = t > dur - 3 ? (dur - t) / 3 : 1;
      for (const b of blobs) {
        const s = b.userData.size * (0.2 + 0.8 * grow) * (1 + t * 0.01);
        b.scale.set(s, s, s);
        b.material.opacity = 0.95 * grow * fade;
        b.rotation.y += dt * 0.1;
      }
    }, o => { for (const b of blobs) b.material.dispose(); });
    return g;
  }

  // Fire area: returns a group with animated flame sprites; caller removes it.
  fire(x, y, z, radius, dur) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const flames = [];
    const mat = new THREE.SpriteMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xff7a1a });
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(mat.clone());
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius * 0.9;
      s.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
      s.userData = { phase: Math.random() * 6, size: 0.5 + Math.random() * 0.6, hue: Math.random() };
      s.material.color.setHSL(0.03 + s.userData.hue * 0.07, 1, 0.55);
      g.add(s); flames.push(s);
    }
    const light = new THREE.PointLight(0xff8a30, 25, radius * 4, 1.5);
    light.position.y = 1; g.add(light);
    this.add(g, dur, (k, o, dt) => {
      const t = k * dur;
      const fade = t > dur - 1.5 ? (dur - t) / 1.5 : Math.min(1, t * 2);
      for (const f of flames) {
        f.userData.phase += dt * 9;
        const p = f.userData.phase;
        const sc = f.userData.size * fade * (0.8 + 0.3 * Math.sin(p) + 0.15 * Math.sin(p * 2.7));
        f.scale.set(sc, sc * 1.6, sc);
        f.position.y = 0.25 + 0.25 * (0.5 + 0.5 * Math.sin(p * 1.3)) * fade;
        f.material.opacity = 0.85 * fade;
      }
      light.intensity = 25 * fade * (0.85 + 0.15 * Math.sin(t * 20));
      if (Math.random() < dt * 14 * fade) {
        const sm = new THREE.Sprite(this.puffMat.clone());
        sm.material.color.setHex(0x222222);
        sm.position.set(x + (Math.random() - 0.5) * radius, y + 0.8, z + (Math.random() - 0.5) * radius);
        this.add(sm, 1.8, (kk, oo, d2) => { oo.position.y += 1.6 * d2; const sz = 0.6 + kk * 1.8; oo.scale.set(sz, sz, sz); oo.material.opacity = 0.5 * (1 - kk); }, oo => oo.material.dispose());
      }
    }, o => { for (const f of flames) f.material.dispose(); });
    return g;
  }

  update(dt, now) {
    this.now = now;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      const k = (now - it.start) / it.dur;
      if (k >= 1) {
        this.scene.remove(it.obj);
        if (it.onEnd) it.onEnd(it.obj);
        this.items.splice(i, 1);
      } else it.update(k, it.obj, dt);
    }
  }

  remove(obj) {
    const i = this.items.findIndex(it => it.obj === obj);
    if (i >= 0) { const it = this.items[i]; this.scene.remove(it.obj); if (it.onEnd) it.onEnd(it.obj); this.items.splice(i, 1); }
  }

  clearRound() {
    for (const d of this.decals) d.visible = false;
  }
}
