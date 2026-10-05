// Builds the visual world (merged box meshes with procedural textures) from map data.
import * as THREE from '../vendor/three.module.min.js';
import { WALL_H } from './config.js';

function makeTex(size, draw, repeat = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.repeat.set(repeat, repeat);
  return t;
}

function noise(g, size, amount, alphaMul = 1) {
  const img = g.getImageData(0, 0, size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() * 2 - 1) * amount;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n * 0.8));
  }
  g.putImageData(img, 0, 0);
}

function blotches(g, size, n, color, alpha, rmin, rmax) {
  g.fillStyle = color; g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const r = rmin + Math.random() * (rmax - rmin);
    g.beginPath(); g.ellipse(Math.random() * size, Math.random() * size, r, r * (0.5 + Math.random()), Math.random() * Math.PI, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

export function createTextures() {
  const wall = makeTex(512, (g, s) => {
    g.fillStyle = '#cdb58b'; g.fillRect(0, 0, s, s);
    blotches(g, s, 60, '#b89c70', 0.35, 10, 60);
    blotches(g, s, 30, '#dcc9a3', 0.3, 10, 50);
    noise(g, s, 22);
    // brick courses
    g.strokeStyle = 'rgba(90,70,45,0.28)'; g.lineWidth = 2;
    const rowH = s / 8;
    for (let y = 0; y < s; y += rowH) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke();
      const off = ((y / rowH) % 2) * (s / 8);
      for (let x = off; x < s; x += s / 4) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + rowH); g.stroke(); }
    }
    // grime at the bottom
    const grd = g.createLinearGradient(0, s * 0.75, 0, s);
    grd.addColorStop(0, 'rgba(80,60,40,0)'); grd.addColorStop(1, 'rgba(80,60,40,0.35)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  });
  const floor = makeTex(512, (g, s) => {
    g.fillStyle = '#c4ac7c'; g.fillRect(0, 0, s, s);
    blotches(g, s, 80, '#ad9568', 0.3, 15, 90);
    blotches(g, s, 50, '#d6c197', 0.25, 10, 60);
    blotches(g, s, 300, '#8d7650', 0.15, 1, 4);
    noise(g, s, 18);
  });
  const concrete = makeTex(512, (g, s) => {
    g.fillStyle = '#b3a68e'; g.fillRect(0, 0, s, s);
    blotches(g, s, 60, '#9e9079', 0.3, 15, 80);
    noise(g, s, 16);
    g.strokeStyle = 'rgba(60,50,40,0.35)'; g.lineWidth = 3;
    for (let i = 0; i <= s; i += s / 2) { g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke(); g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke(); }
  });
  const crate = makeTex(256, (g, s) => {
    g.fillStyle = '#a0713f'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? '#96683a' : '#a87847';
      g.fillRect(0, i * s / 6, s, s / 6);
    }
    noise(g, s, 14);
    g.strokeStyle = 'rgba(50,30,15,0.6)'; g.lineWidth = 3;
    for (let i = 0; i <= 6; i++) { g.beginPath(); g.moveTo(0, i * s / 6); g.lineTo(s, i * s / 6); g.stroke(); }
    g.strokeStyle = 'rgba(40,25,10,0.8)'; g.lineWidth = 10; g.strokeRect(5, 5, s - 10, s - 10);
    g.strokeStyle = 'rgba(40,25,10,0.5)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(10, 10); g.lineTo(s - 10, s - 10); g.stroke();
    g.beginPath(); g.moveTo(s - 10, 10); g.lineTo(10, s - 10); g.stroke();
    g.fillStyle = 'rgba(255,230,180,0.5)'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center';
    g.fillText('FRAGILE', s / 2, s / 2 + 10);
  });
  const sandbag = makeTex(256, (g, s) => {
    g.fillStyle = '#9d8f68'; g.fillRect(0, 0, s, s);
    for (let y = 0; y < 4; y++) for (let x = 0; x < 3; x++) {
      g.fillStyle = (x + y) % 2 ? '#a89a73' : '#8f825e';
      g.beginPath(); g.roundRect(x * s / 3 + ((y % 2) * s / 6) - 10, y * s / 4 + 4, s / 3 - 6, s / 4 - 8, 20); g.fill();
    }
    noise(g, s, 14);
  });
  const metal = makeTex(128, (g, s) => {
    g.fillStyle = '#6d7077'; g.fillRect(0, 0, s, s);
    noise(g, s, 10);
  });
  return { wall, floor, concrete, crate, sandbag, metal };
}

// Box geometry with UVs scaled so textures tile every `tile` meters.
function scaledBox(w, h, d, tile) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const faces = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = faces[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * su / tile, uv.getY(i) * sv / tile);
    }
  }
  return geo;
}

function mergeGeoms(geoms) {
  let nv = 0, ni = 0;
  for (const g of geoms) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of geoms) {
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    const gi = g.index.array;
    for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo;
    vo += g.attributes.position.count; io += gi.length;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

function translated(geo, x, y, z) { geo.translate(x, y, z); return geo; }

export function buildWorld(scene, map) {
  const tex = createTextures();
  const W = map.W, H = map.H;
  const group = new THREE.Group();

  // Ground plane
  const groundMat = new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 1, metalness: 0 });
  tex.floor.repeat.set(W / 3, H / 3);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, 0, H / 2);
  ground.receiveShadow = true;
  group.add(ground);

  const exposed = (x, z) => {
    const c = map.at(x, z);
    if (!c.wall) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      if (!map.at(nx, nz).wall) return true;
    }
    return false;
  };

  // Walls: merge horizontal runs of exposed wall cells.
  const wallGeoms = [];
  for (let z = 0; z < H; z++) {
    let x = 0;
    while (x < W) {
      if (!exposed(x, z)) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < W && exposed(x1 + 1, z)) x1++;
      const len = x1 - x + 1;
      wallGeoms.push(translated(scaledBox(len, WALL_H, 1, 2.5), x + len / 2, WALL_H / 2, z + 0.5));
      x = x1 + 1;
    }
  }
  const wallMesh = new THREE.Mesh(mergeGeoms(wallGeoms), new THREE.MeshStandardMaterial({ map: tex.wall, roughness: 0.95 }));
  wallMesh.castShadow = true; wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // Raised floors: runs of equal height.
  const raisedGeoms = [];
  for (let z = 0; z < H; z++) {
    let x = 0;
    while (x < W) {
      const c = map.at(x, z);
      if (c.wall || c.h <= 0) { x++; continue; }
      let x1 = x;
      while (x1 + 1 < W && !map.at(x1 + 1, z).wall && map.at(x1 + 1, z).h === c.h) x1++;
      const len = x1 - x + 1;
      raisedGeoms.push(translated(scaledBox(len, c.h, 1, 2), x + len / 2, c.h / 2, z + 0.5));
      x = x1 + 1;
    }
  }
  if (raisedGeoms.length) {
    const m = new THREE.Mesh(mergeGeoms(raisedGeoms), new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.9 }));
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }

  // Crates and sandbags
  const crateGeoms = [], bagGeoms = [];
  for (const c of map.cells) {
    if (c.wall || !c.obst) continue;
    if (c.obst === 'crate') {
      for (let k = 0; k < c.obstH; k++) crateGeoms.push(translated(scaledBox(0.98, 1, 0.98, 1), c.x + 0.5, c.h + k + 0.5, c.z + 0.5));
    } else if (c.obst === 'half') {
      bagGeoms.push(translated(scaledBox(1, 1.1, 1, 1), c.x + 0.5, c.h + 0.55, c.z + 0.5));
    }
  }
  if (crateGeoms.length) {
    const m = new THREE.Mesh(mergeGeoms(crateGeoms), new THREE.MeshStandardMaterial({ map: tex.crate, roughness: 0.9 }));
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }
  if (bagGeoms.length) {
    const m = new THREE.Mesh(mergeGeoms(bagGeoms), new THREE.MeshStandardMaterial({ map: tex.sandbag, roughness: 1 }));
    m.castShadow = true; m.receiveShadow = true; group.add(m);
  }

  // Bomb site markings
  for (const name of ['A', 'B']) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity, h = 0;
    for (const c of map.cells) if (c.zone === name) { x0 = Math.min(x0, c.x); z0 = Math.min(z0, c.z); x1 = Math.max(x1, c.x + 1); z1 = Math.max(z1, c.z + 1); h = c.h; }
    const t = makeTex(512, (g, s) => {
      g.clearRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,200,60,0.75)'; g.lineWidth = 14; g.setLineDash([40, 24]); g.strokeRect(20, 20, s - 40, s - 40);
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,200,60,0.55)'; g.font = 'bold 300px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(name, s / 2, s / 2 + 20);
    });
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, h + 0.02, (z0 + z1) / 2);
    group.add(m);
  }

  // Decorative: a few lamp posts / barrels at spawns for orientation
  const barrelGeo = new THREE.CylinderGeometry(0.4, 0.4, 1.1, 12);
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3a5a3a, roughness: 0.7, metalness: 0.4 });
  for (const [x, z] of [[46.5, 103.5], [47.5, 104.5], [75.5, 5.5], [35.5, 5.5], [113.5, 110.5], [57.5, 98.5]]) {
    const c = map.at(Math.floor(x), Math.floor(z));
    if (c.wall || c.obst) continue;
    const b = new THREE.Mesh(barrelGeo, barrelMat);
    b.position.set(x, c.h + 0.55, z); b.castShadow = true; group.add(b);
    // make it solid in the heightfield
    c.obst = 'barrel'; c.obstH = 1.1; c.top = c.h + 1.1; c.nav = false;
  }

  scene.add(group);
  return { group, tex };
}

export function setupLighting(scene) {
  scene.background = new THREE.Color(0x9ec4e6);
  scene.fog = new THREE.Fog(0xc9d6e2, 70, 260);
  const hemi = new THREE.HemisphereLight(0xd8ecff, 0x8a7652, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d8, 2.0);
  sun.position.set(60, 110, 110);
  sun.target.position.set(60, 0, 70);
  sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096);
  sun.shadow.camera.left = -95; sun.shadow.camera.right = 95;
  sun.shadow.camera.top = 95; sun.shadow.camera.bottom = -95;
  sun.shadow.camera.near = 10; sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun); scene.add(sun.target);
  return { hemi, sun };
}
