// Weapon definitions (prices, damage, fire rate, recoil) loosely matching CS2.
function genPattern(n, scale) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    let dx, dy;
    if (i === 0) { dx = 0; dy = 0.5; }
    else if (i < 9) { dy = 1.0; dx = Math.sin(i * 0.9) * 0.18; }
    else if (i < 16) { dy = 0.35; dx = -0.8; }
    else if (i < 23) { dy = 0.25; dx = 0.9; }
    else { dy = 0.2; dx = (i % 4 < 2) ? -0.7 : 0.7; }
    pts.push([dx * scale, dy * scale]);
  }
  return pts;
}

const spreadDef = (base, move, air, crouch = 0.75) => ({ base, move, air, crouch });

export const WEAPONS = {
  knife: { id: 'knife', name: 'Knife', slot: 3, cat: 'melee', price: 0, dmg: 40, altDmg: 65, rpm: 140, speed: 250, kill: 1500, teams: 'both' },

  glock: { id: 'glock', name: 'Glock-18', slot: 2, cat: 'pistol', price: 200, dmg: 30, rpm: 400, mag: 20, reserve: 120, reload: 2.2, pen: 0.47, range: 0.75, speed: 240, spread: spreadDef(0.9, 4, 10), recoil: { pattern: genPattern(20, 0.55) }, auto: false, kill: 300, teams: 'T' },
  usp: { id: 'usp', name: 'USP-S', slot: 2, cat: 'pistol', price: 200, dmg: 35, rpm: 352, mag: 12, reserve: 24, reload: 2.2, pen: 0.505, range: 0.79, speed: 240, spread: spreadDef(0.7, 4, 10), recoil: { pattern: genPattern(12, 0.5) }, auto: false, kill: 300, teams: 'CT' },
  p250: { id: 'p250', name: 'P250', slot: 2, cat: 'pistol', price: 300, dmg: 38, rpm: 400, mag: 13, reserve: 26, reload: 2.2, pen: 0.64, range: 0.85, speed: 240, spread: spreadDef(0.9, 4, 10), recoil: { pattern: genPattern(13, 0.6) }, auto: false, kill: 300, teams: 'both' },
  fiveseven: { id: 'fiveseven', name: 'Five-SeveN', slot: 2, cat: 'pistol', price: 500, dmg: 32, rpm: 400, mag: 20, reserve: 100, reload: 2.2, pen: 0.91, range: 0.91, speed: 240, spread: spreadDef(0.8, 4, 10), recoil: { pattern: genPattern(20, 0.55) }, auto: false, kill: 300, teams: 'CT' },
  tec9: { id: 'tec9', name: 'Tec-9', slot: 2, cat: 'pistol', price: 500, dmg: 33, rpm: 500, mag: 18, reserve: 90, reload: 2.4, pen: 0.906, range: 0.91, speed: 240, spread: spreadDef(1.3, 5, 12), recoil: { pattern: genPattern(18, 0.7) }, auto: false, kill: 300, teams: 'T' },
  deagle: { id: 'deagle', name: 'Desert Eagle', slot: 2, cat: 'pistol', price: 700, dmg: 53, rpm: 267, mag: 7, reserve: 35, reload: 2.2, pen: 0.932, range: 0.81, speed: 230, spread: spreadDef(1.0, 6, 14), recoil: { pattern: genPattern(7, 1.6) }, auto: false, kill: 300, teams: 'both', hsMul: 4 },

  mac10: { id: 'mac10', name: 'MAC-10', slot: 1, cat: 'smg', price: 1050, dmg: 29, rpm: 800, mag: 30, reserve: 100, reload: 2.6, pen: 0.575, range: 0.82, speed: 240, spread: spreadDef(1.4, 1.8, 8), recoil: { pattern: genPattern(30, 0.55) }, auto: true, kill: 600, teams: 'T' },
  mp9: { id: 'mp9', name: 'MP9', slot: 1, cat: 'smg', price: 1250, dmg: 26, rpm: 857, mag: 30, reserve: 120, reload: 2.1, pen: 0.6, range: 0.865, speed: 240, spread: spreadDef(1.2, 1.6, 8), recoil: { pattern: genPattern(30, 0.5) }, auto: true, kill: 600, teams: 'CT' },
  ump45: { id: 'ump45', name: 'UMP-45', slot: 1, cat: 'smg', price: 1200, dmg: 35, rpm: 666, mag: 25, reserve: 100, reload: 3.5, pen: 0.65, range: 0.75, speed: 230, spread: spreadDef(1.2, 1.8, 8), recoil: { pattern: genPattern(25, 0.6) }, auto: true, kill: 600, teams: 'both' },
  nova: { id: 'nova', name: 'Nova', slot: 1, cat: 'shotgun', price: 1050, dmg: 26, rpm: 68, mag: 8, reserve: 32, reload: 0.55, reloadShell: true, pen: 0.5, range: 0.45, speed: 220, spread: spreadDef(5.5, 1, 4, 0.9), recoil: { pattern: genPattern(8, 3) }, auto: false, kill: 900, teams: 'both', pellets: 9 },

  galil: { id: 'galil', name: 'Galil AR', slot: 1, cat: 'rifle', price: 1800, dmg: 30, rpm: 666, mag: 35, reserve: 90, reload: 3.0, pen: 0.775, range: 0.98, speed: 215, spread: spreadDef(0.55, 3.0, 12), recoil: { pattern: genPattern(35, 0.62) }, auto: true, kill: 300, teams: 'T' },
  famas: { id: 'famas', name: 'FAMAS', slot: 1, cat: 'rifle', price: 2050, dmg: 30, rpm: 666, mag: 25, reserve: 90, reload: 3.3, pen: 0.7, range: 0.96, speed: 220, spread: spreadDef(0.5, 3.0, 12), recoil: { pattern: genPattern(25, 0.58) }, auto: true, kill: 300, teams: 'CT' },
  ak47: { id: 'ak47', name: 'AK-47', slot: 1, cat: 'rifle', price: 2700, dmg: 36, rpm: 600, mag: 30, reserve: 90, reload: 2.5, pen: 0.775, range: 0.98, speed: 215, spread: spreadDef(0.45, 3.2, 12), recoil: { pattern: genPattern(30, 0.72) }, auto: true, kill: 300, teams: 'T' },
  m4a4: { id: 'm4a4', name: 'M4A4', slot: 1, cat: 'rifle', price: 3100, dmg: 33, rpm: 666, mag: 30, reserve: 90, reload: 3.1, pen: 0.7, range: 0.97, speed: 225, spread: spreadDef(0.4, 3.0, 12), recoil: { pattern: genPattern(30, 0.6) }, auto: true, kill: 300, teams: 'CT' },
  awp: { id: 'awp', name: 'AWP', slot: 1, cat: 'sniper', price: 4750, dmg: 115, rpm: 41, mag: 10, reserve: 30, reload: 3.7, pen: 0.975, range: 0.99, speed: 200, spread: spreadDef(0.05, 8, 20), unscoped: 6, recoil: { pattern: genPattern(10, 3.5) }, auto: false, kill: 100, teams: 'both', scope: true, hsMul: 4 },

  he: { id: 'he', name: 'HE Grenade', slot: 4, cat: 'grenade', price: 300, kill: 300, teams: 'both', max: 1, speed: 245 },
  flash: { id: 'flash', name: 'Flashbang', slot: 4, cat: 'grenade', price: 200, teams: 'both', max: 2, speed: 245 },
  smoke: { id: 'smoke', name: 'Smoke Grenade', slot: 4, cat: 'grenade', price: 300, teams: 'both', max: 1, speed: 245 },
};

export const GEAR = {
  kevlar: { id: 'kevlar', name: 'Kevlar Vest', price: 650 },
  helmet: { id: 'helmet', name: 'Kevlar + Helmet', price: 1000 },
  kit: { id: 'kit', name: 'Defuse Kit', price: 400, teams: 'CT' },
};

export const BUY_MENU = [
  { title: 'Pistols', items: ['glock', 'usp', 'p250', 'fiveseven', 'tec9', 'deagle'] },
  { title: 'SMGs & Heavy', items: ['mac10', 'mp9', 'ump45', 'nova'] },
  { title: 'Rifles', items: ['galil', 'famas', 'ak47', 'm4a4', 'awp'] },
  { title: 'Grenades', items: ['he', 'flash', 'smoke'] },
  { title: 'Gear', items: ['kevlar', 'helmet', 'kit'] },
];

export function makeWeapon(id) {
  const def = WEAPONS[id];
  return { def, ammo: def.mag || 0, reserve: def.reserve || 0, reloadEnd: 0, reloadStart: 0, nextShot: 0, shots: 0, lastShot: -10, scoped: false };
}

export function weaponSpeed(w) {
  const s = w && w.def.speed ? w.def.speed : 250;
  return s / 40; // CS units -> m/s
}

// Angular spread (deg) for a shooter given movement state.
export function currentSpread(e, w) {
  const def = w.def;
  if (!def.spread) return 0;
  const sp = def.spread;
  const speed = Math.hypot(e.vel.x, e.vel.z);
  const maxSpeed = weaponSpeed(w);
  let s = sp.base;
  if (def.scope && !w.scoped) s = def.unscoped;
  s += sp.move * Math.min(1, speed / Math.max(0.1, maxSpeed * 0.34));
  if (!e.onGround) s += sp.air;
  if (e.crouch && e.onGround) s *= sp.crouch;
  // continuous fire inaccuracy
  s += Math.min(w.shots, 10) * (def.cat === 'rifle' ? 0.05 : def.cat === 'smg' ? 0.08 : 0.12);
  return s;
}

export function damageAtRange(def, dist) {
  const r = def.range ?? 1;
  return def.dmg * Math.pow(r, dist / 12.5);
}
