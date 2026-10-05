// Dust II-inspired layout built from rectangle operations on a 1m grid.
// z grows southwards: CT side at low z (north), T side at high z (south).
import { WALL_H } from './config.js';

export const MAP_W = 120;
export const MAP_H = 140;

export function buildMapData() {
  const W = MAP_W, H = MAP_H;
  const cells = new Array(W * H);
  for (let i = 0; i < W * H; i++) {
    cells[i] = { wall: true, h: 0, obst: null, obstH: 0, zone: null, top: WALL_H, nav: false, x: i % W, z: (i / W) | 0 };
  }
  const at = (x, z) => cells[z * W + x];
  const rect = (x0, z0, x1, z1, fn) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (x < 0 || z < 0 || x >= W || z >= H) continue;
      fn(at(x, z), x, z);
    }
  };
  const floor = (x0, z0, x1, z1, h = 0) => rect(x0, z0, x1, z1, c => { c.wall = false; c.h = h; c.obst = null; c.obstH = 0; });
  const wall = (x0, z0, x1, z1) => rect(x0, z0, x1, z1, c => { c.wall = true; c.obst = null; c.obstH = 0; c.zone = null; });
  const crate = (x0, z0, x1, z1, h = 1) => rect(x0, z0, x1, z1, c => { if (!c.wall) { c.obst = 'crate'; c.obstH = h; } });
  const halfwall = (x0, z0, x1, z1) => rect(x0, z0, x1, z1, c => { if (!c.wall) { c.obst = 'half'; c.obstH = 1.1; } });
  const zone = (x0, z0, x1, z1, name) => rect(x0, z0, x1, z1, c => { if (!c.wall) c.zone = name; });

  // ---- B site hall
  floor(4, 4, 34, 34);
  wall(24, 22, 30, 30);              // building block at the back of B
  zone(8, 8, 22, 20, 'B');
  crate(9, 9, 10, 10, 2); crate(14, 8, 15, 8, 1); crate(20, 15, 21, 16, 1); crate(6, 24, 7, 25, 1);
  crate(12, 30, 13, 31, 2); crate(31, 6, 32, 7, 1); crate(17, 26, 18, 26, 1); crate(26, 12, 27, 13, 1);
  crate(5, 5, 5, 6, 1);
  halfwall(33, 11, 33, 13);
  // ---- B doors / CT -> B connector
  floor(34, 14, 46, 22);
  wall(40, 14, 40, 16); wall(40, 20, 40, 22);   // double doors
  // ---- CT spawn
  floor(46, 4, 76, 22);
  crate(50, 18, 51, 19, 1); crate(70, 6, 71, 7, 1); crate(62, 16, 63, 16, 1); crate(74, 18, 75, 19, 2);
  crate(47, 5, 48, 6, 2);
  // ---- CT ramp to A (steps up)
  floor(76, 8, 83, 18, 0); floor(84, 8, 85, 18, 0.5); floor(86, 8, 88, 18, 1);
  // ---- A site (raised platform)
  floor(88, 4, 116, 34, 1);
  wall(104, 24, 110, 30);
  zone(94, 8, 108, 20, 'A');
  crate(96, 10, 97, 11, 2); crate(104, 8, 105, 9, 1); crate(100, 16, 101, 17, 1); crate(112, 22, 113, 23, 1);
  crate(90, 6, 91, 7, 1); crate(92, 28, 93, 29, 2); crate(114, 8, 115, 9, 2); crate(99, 4, 100, 5, 1);
  halfwall(94, 33, 97, 33);
  // ---- CT mid + mid doors
  floor(58, 22, 66, 43);
  floor(58, 44, 66, 45); wall(58, 44, 59, 45); wall(65, 44, 66, 45); wall(62, 44, 62, 45);
  // ---- mid
  floor(54, 46, 70, 100);
  crate(66, 52, 67, 53, 2);          // "xbox"
  crate(56, 80, 57, 81, 1); crate(68, 92, 68, 93, 1); halfwall(54, 60, 54, 66);
  crate(69, 70, 70, 71, 1);
  // ---- lower tunnels (mid -> B tunnels)
  floor(28, 70, 54, 76);
  crate(30, 72, 31, 73, 1); crate(44, 70, 45, 70, 1);
  // ---- B tunnels
  floor(20, 34, 28, 96);
  crate(22, 60, 23, 61, 1); crate(26, 88, 27, 89, 2); crate(20, 50, 20, 51, 1);
  // ---- upper tunnels + T spawn
  floor(12, 100, 44, 110);
  crate(16, 100, 17, 101, 1); crate(34, 108, 35, 109, 2);
  floor(44, 100, 92, 130);
  wall(60, 118, 64, 124);
  crate(70, 120, 72, 122, 1); crate(84, 110, 85, 111, 1); crate(48, 126, 49, 127, 2); crate(90, 126, 91, 127, 1);
  // ---- long doors + long A
  floor(92, 104, 102, 110);
  wall(99, 104, 99, 105); wall(99, 109, 99, 110);
  floor(102, 38, 116, 112);
  floor(102, 35, 116, 37, 0.5);
  crate(104, 40, 105, 41, 1); crate(112, 60, 113, 61, 2); crate(106, 80, 107, 81, 1); crate(110, 96, 111, 97, 1);
  halfwall(103, 70, 103, 74);
  // ---- mid -> short -> catwalk -> A
  floor(70, 50, 86, 56);
  floor(80, 48, 86, 49, 0.5);
  floor(80, 24, 86, 47, 1);
  floor(86, 24, 88, 32, 1);
  crate(82, 40, 83, 41, 1);

  // extra cover in open areas
  crate(52, 112, 53, 113, 1); crate(78, 104, 79, 105, 2); crate(56, 6, 57, 7, 1); crate(60, 88, 61, 89, 1);
  crate(114, 44, 115, 45, 1); crate(108, 14, 109, 15, 1); halfwall(46, 118, 46, 121); crate(36, 104, 36, 105, 1);
  crate(64, 36, 65, 37, 1); halfwall(88, 20, 88, 21);

  // finalize
  for (const c of cells) {
    c.top = c.wall ? WALL_H : c.h + c.obstH;
    c.nav = !c.wall && !c.obst;
  }

  const spawns = { T: [], CT: [] };
  for (const x of [56, 60, 64, 68, 72, 76, 80, 84]) spawns.T.push({ x: x + 0.5, z: 126.5 });
  for (const x of [52, 56, 60, 64, 68, 72, 48, 76]) spawns.CT.push({ x: x + 0.5, z: 10.5 });

  const sites = {};
  for (const name of ['A', 'B']) {
    let sx = 0, sz = 0, n = 0, h = 0;
    for (const c of cells) if (c.zone === name && c.nav) { sx += c.x + 0.5; sz += c.z + 0.5; h = c.h; n++; }
    sites[name] = { x: sx / n, z: sz / n, y: h, n };
  }

  // Named landmark positions (used by bots to hold angles)
  const landmarks = {
    A: { entrances: [{ x: 84, z: 13 }, { x: 87, z: 28 }, { x: 109, z: 38 }], holds: [{ x: 92, z: 12 }, { x: 102, z: 6 }, { x: 110, z: 16 }, { x: 98, z: 22 }, { x: 114, z: 30 }] },
    B: { entrances: [{ x: 24, z: 36 }, { x: 36, z: 18 }], holds: [{ x: 8, z: 6 }, { x: 18, z: 10 }, { x: 10, z: 28 }, { x: 32, z: 24 }, { x: 16, z: 18 }] },
    MID: { holds: [{ x: 62, z: 30 }, { x: 60, z: 60 }, { x: 75, z: 53 }] },
    LONG: { holds: [{ x: 108, z: 50 }, { x: 110, z: 100 }] },
    TUNNELS: { holds: [{ x: 24, z: 56 }, { x: 40, z: 73 }] },
  };

  // Roofed corridors (visual only) and lamps inside them
  const roofs = [
    { x0: 20, z0: 36, x1: 28, z1: 96 },     // B tunnels
    { x0: 12, z0: 100, x1: 44, z1: 110 },   // upper tunnels
    { x0: 28, z0: 70, x1: 54, z1: 76 },     // lower tunnels
    { x0: 92, z0: 104, x1: 102, z1: 110 },  // long doors
    { x0: 34, z0: 14, x1: 40, z1: 22 },     // B doors
  ];
  const lamps = [[24, 45], [24, 65], [24, 85], [20, 105], [36, 105], [40, 73], [97, 107], [37, 18]];

  // Named regions for callouts (first match wins)
  const regions = [
    { name: 'A site', x0: 88, z0: 4, x1: 116, z1: 34 },
    { name: 'B site', x0: 4, z0: 4, x1: 34, z1: 34 },
    { name: 'CT spawn', x0: 46, z0: 4, x1: 76, z1: 22 },
    { name: 'B doors', x0: 34, z0: 14, x1: 46, z1: 22 },
    { name: 'CT ramp', x0: 76, z0: 8, x1: 88, z1: 18 },
    { name: 'Catwalk', x0: 80, z0: 24, x1: 88, z1: 49 },
    { name: 'Short', x0: 70, z0: 50, x1: 86, z1: 56 },
    { name: 'Mid', x0: 54, z0: 22, x1: 70, z1: 100 },
    { name: 'Lower tunnels', x0: 28, z0: 70, x1: 54, z1: 76 },
    { name: 'B tunnels', x0: 20, z0: 34, x1: 28, z1: 96 },
    { name: 'Upper tunnels', x0: 12, z0: 96, x1: 44, z1: 110 },
    { name: 'Long doors', x0: 92, z0: 104, x1: 102, z1: 110 },
    { name: 'Long A', x0: 102, z0: 35, x1: 116, z1: 112 },
    { name: 'T spawn', x0: 44, z0: 100, x1: 92, z1: 130 },
  ];
  const regionName = (x, z) => {
    for (const r of regions) if (x >= r.x0 && x <= r.x1 + 1 && z >= r.z0 && z <= r.z1 + 1) return r.name;
    return 'unknown';
  };

  return { W, H, cells, at, spawns, sites, landmarks, roofs, lamps, regions, regionName, name: 'Dust II (browser edition)' };
}
