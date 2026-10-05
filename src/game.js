// Core game state: entities, rounds, economy, combat resolution, bomb logic, buying.
import * as THREE from '../vendor/three.module.min.js';
import { ROUND, ECON, MATCH, PLAYER, BOT_NAMES } from './config.js';
import { buildMapData } from './mapdata.js';
import { World, NavGrid, rayEntity } from './physics.js';
import { buildWorld, setupLighting } from './world.js';
import { WEAPONS, GEAR, makeWeapon, currentSpread, damageAtRange, penetrationPower } from './weapons.js';
import { WALL_H } from './config.js';
import { Effects } from './effects.js';
import { createHumanoid, animateHumanoid } from './entities.js';
import { buildWeaponModel } from './viewmodel.js';
import { GrenadeManager } from './grenades.js';
import { BotAI, TeamPlan } from './bots.js';
import { t } from './i18n.js';

const rad = d => d * Math.PI / 180;
const throughWallKill = () => false;
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Game {
  constructor({ scene, camera, audio, hud, viewModel, settings }) {
    this.scene = scene; this.camera = camera; this.audio = audio; this.hud = hud; this.viewModel = viewModel;
    this.settings = settings;
    this.now = 0;
    this.map = buildMapData();
    this.worldMeshes = buildWorld(scene, this.map);
    setupLighting(scene);
    this.world = new World(this.map);
    this.nav = new NavGrid(this.map);
    this.effects = new Effects(scene);
    this.grenades = new GrenadeManager(this);
    this.entities = [];
    this.player = null;
    this.controller = null;
    this.phase = 'menu';
    this.timer = 0;
    this.round = 0;
    this.score = { T: 0, CT: 0 };
    this.lossStreak = { T: 0, CT: 0 };
    this.target = MATCH.winRounds;
    this.bomb = this._newBombState();
    this.pickups = [];
    this.siteDanger = { A: -100, B: -100 };
    this.tPlan = new TeamPlan(this, 'T');
    this.ctPlan = new TeamPlan(this, 'CT');
    this.roundLog = [];
    this.matchResult = null;
    this.playerTeamStart = 'T';
    this._buildBombMesh();
  }

  // ---------------- setup
  _newBombState() { return { carrier: null, planted: false, pos: null, site: null, dropped: null, explodeAt: 0, plantedAt: 0, defuser: null, beepNext: 0, defusingBy: null }; }

  _buildBombMesh() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.14, 0.22), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.6, metalness: 0.4 }));
    body.position.y = 0.07; body.castShadow = true; g.add(body);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 10), new THREE.MeshStandardMaterial({ color: 0xc9b26b }));
    tube.rotation.z = Math.PI / 2; tube.position.set(0, 0.17, -0.06); g.add(tube);
    const tube2 = tube.clone(); tube2.position.z = 0.02; g.add(tube2);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    led.position.set(0.1, 0.15, 0.08); g.add(led);
    g.visible = false;
    this.scene.add(g);
    this.bombMesh = g; this.bombLed = led;
  }

  createEntity(name, team, isPlayer) {
    const e = {
      id: this.entities.length, name, team, isPlayer,
      pos: { x: 0, y: 0, z: 0 }, vel: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0,
      radius: PLAYER.radius, onGround: true, jumping: false, landed: 0,
      crouch: false, walking: false, hp: 100, armor: 0, helmet: false, kit: false,
      money: ECON.start, alive: false,
      weapons: { 1: null, 2: null, 3: null, 4: [] }, current: null, lastWeapon: null,
      hasBomb: false, kills: 0, deaths: 0, damage: 0, mvp: 0,
      blindUntil: 0, flashDur: 0, lastShotTime: -10, spottedUntil: 0, firing: false,
      planting: false, defusing: false, plantProgress: 0, defuseProgress: 0, useHeld: false,
      recoilYaw: 0, recoilPitch: 0, model: null, bot: null, showGun: true, stepDist: 0,
      lastHitBy: null, lastHitTime: -10, throwing: false,
      roundKills: 0, roundDmgGiven: 0, roundHitsGiven: 0, roundDmgTaken: 0, roundHitsTaken: 0, roundMoneyStart: 0, respawnAt: 0, lastCallout: -10, burningUntil: 0,
    };
    if (!isPlayer) {
      e.model = createHumanoid(team, name);
      this.scene.add(e.model);
      e.bot = new BotAI(e, this);
    }
    this.entities.push(e);
    return e;
  }

  startMatch(controller) {
    this.controller = controller;
    for (const e of this.entities) if (e.model) this.scene.remove(e.model);
    this.entities = [];
    const s = this.settings;
    const pteam = s.team === 'random' ? (Math.random() < 0.5 ? 'T' : 'CT') : s.team;
    this.playerTeamStart = pteam;
    const oteam = pteam === 'T' ? 'CT' : 'T';
    this.player = this.createEntity(s.playerName || 'Player', pteam, true);
    const names = shuffle(BOT_NAMES.slice());
    const n = s.botsPerTeam;
    for (let i = 0; i < n - 1; i++) this.createEntity(names.pop(), pteam, false);
    for (let i = 0; i < n; i++) this.createEntity(names.pop(), oteam, false);
    for (const e of this.entities) e.money = ECON.start;
    controller.attach(this.player);
    this.score = { T: 0, CT: 0 }; this.lossStreak = { T: 0, CT: 0 };
    this.mode = s.mode || 'competitive';
    this.matchCfg = this.mode === 'short' ? { half: 8, win: 9 } : { half: MATCH.halfRounds, win: MATCH.winRounds };
    this.round = 0; this.target = this.matchCfg.win; this.half = 1; this.matchResult = null;
    this.roundLog = [];
    this.hud.killfeedClear(); this.hud.chatClear();
    if (this.mode === 'deathmatch') this.startDeathmatch(); else this.startRound();
  }

  isLive() { return this.phase === 'live' || this.phase === 'planted' || this.phase === 'dm'; }

  // ---------------- deathmatch
  startDeathmatch() {
    this.phase = 'dm'; this.timer = this.settings.dmTime || 600; this.round = 1;
    this.bomb = this._newBombState(); this.bombMesh.visible = false;
    for (const e of this.entities) { e.money = 16000; e.alive = false; this.respawn(e); }
    this.viewModel.setWeapon(this.player.current.def, this.player.team);
    this.audio.play('round_start');
    this.hud.announce(t('deathmatch'), 3, t('dmSub'));
    this.hud.setBuyAllowed(true);
    this.hud.roundStart();
  }

  respawn(e) {
    const enemies = this.entities.filter(o => o.alive && o.team !== e.team);
    const pool = [...this.map.spawns.T, ...this.map.spawns.CT];
    for (const k of Object.keys(this.map.landmarks)) for (const h of this.map.landmarks[k].holds) pool.push({ x: h.x + 0.5, z: h.z + 0.5 });
    // prefer spawns a medium distance from enemies: safe, but fights come quickly
    let best = null, bestScore = -Infinity;
    for (let i = 0; i < 10; i++) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      let md = Infinity;
      for (const o of enemies) md = Math.min(md, Math.hypot(o.pos.x - c.x, o.pos.z - c.z));
      const score = !Number.isFinite(md) ? Math.random() : md < 18 ? -100 + md : -Math.abs(md - 32) + Math.random() * 6;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    const p = this.nav.randomWalkableNear(best.x, best.z, 2);
    e.pos = { x: p.x, y: this.world.floorAt(p.x, p.z), z: p.z };
    e.vel = { x: 0, y: 0, z: 0 }; e.onGround = true;
    e.yaw = Math.random() * Math.PI * 2; e.pitch = 0;
    e.alive = true; e.hp = 100; e.armor = 100; e.helmet = true; e.kit = false;
    e.crouch = false; e.firing = false; e.blindUntil = 0; e.recoilYaw = 0; e.recoilPitch = 0; e.burningUntil = 0;
    e.money = 16000;
    if (e.bot) {
      const T = e.team === 'T';
      const prim = T ? ['ak47', 'galil', 'mac10', 'awp', 'ak47', 'ump45'] : ['m4a4', 'famas', 'mp9', 'awp', 'm4a4', 'ump45'];
      e.weapons = { 1: makeWeapon(prim[Math.floor(Math.random() * prim.length)]), 2: makeWeapon(T ? 'glock' : 'usp'), 3: makeWeapon('knife'), 4: [] };
      if (Math.random() < 0.5) e.weapons[4].push(makeWeapon(Math.random() < 0.5 ? 'he' : 'flash'));
      e.current = e.weapons[1];
      e.bot.onRoundStart();
    } else {
      if (!e.weapons[3]) this.defaultLoadout(e);
      for (const w of [e.weapons[1], e.weapons[2]]) if (w) { w.ammo = w.def.mag; w.reserve = w.def.reserve; w.reloadEnd = 0; }
      if (!e.current || !this.ownsWeapon(e, e.current)) e.current = e.weapons[1] || e.weapons[2];
      this.viewModel.setWeapon(e.current.def, e.team);
      this.controller.specTarget = null;
      this.hud.hideDeathPanel();
    }
    if (e.model) { e.model.visible = true; e.model.userData.deadT = 0; e.model.userData.tag.visible = true; }
  }

  defaultLoadout(e) {
    e.weapons = { 1: null, 2: makeWeapon(e.team === 'T' ? 'glock' : 'usp'), 3: makeWeapon('knife'), 4: [] };
    e.armor = 0; e.helmet = false; e.kit = false;
    e.current = e.weapons[2]; e.lastWeapon = e.weapons[3];
  }

  startRound() {
    this.round++;
    this.phase = 'freeze'; this.timer = ROUND.freeze;
    this.bomb = this._newBombState();
    this.bombMesh.visible = false;
    this.grenades.clear();
    for (const p of this.pickups) this.scene.remove(p.mesh);
    this.pickups = [];
    this.effects.clearRound();
    this.siteDanger = { A: -100, B: -100 };
    const spawns = { T: shuffle(this.map.spawns.T.slice()), CT: shuffle(this.map.spawns.CT.slice()) };
    for (const e of this.entities) {
      if (!e.alive || e.freshLoadout) this.defaultLoadout(e);
      e.freshLoadout = false;
      // refill reserve ammo for survivors
      for (const w of [e.weapons[1], e.weapons[2]]) if (w) { w.reserve = w.def.reserve; w.reloadEnd = 0; w.shots = 0; }
      e.alive = true; e.hp = 100;
      e.crouch = false; e.walking = false; e.firing = false; e.planting = false; e.defusing = false;
      e.plantProgress = 0; e.defuseProgress = 0; e.hasBomb = false; e.blindUntil = 0;
      e.recoilYaw = 0; e.recoilPitch = 0; e.vel = { x: 0, y: 0, z: 0 }; e.onGround = true; e.throwing = false;
      const sp = spawns[e.team].pop() || this.map.spawns[e.team][0];
      e.pos = { x: sp.x, y: this.world.floorAt(sp.x, sp.z), z: sp.z };
      e.yaw = e.team === 'T' ? 0 : Math.PI; e.pitch = 0;
      if (!e.current || !this.ownsWeapon(e, e.current)) e.current = e.weapons[2] || e.weapons[3];
      if (e.model) { e.model.visible = true; e.model.userData.deadT = 0; e.model.userData.tag.visible = true; }
      e.spottedUntil = 0;
      e.roundKills = 0; e.roundDmgGiven = 0; e.roundHitsGiven = 0; e.roundDmgTaken = 0; e.roundHitsTaken = 0; e.roundMoneyStart = e.money; e.burningUntil = 0;
    }
    // bomb carrier
    const ts = this.entities.filter(e => e.team === 'T');
    const carrier = ts[Math.floor(Math.random() * ts.length)];
    if (carrier) { carrier.hasBomb = true; this.bomb.carrier = carrier; }
    this.tPlan.newRound(); this.ctPlan.newRound();
    for (const e of this.entities) if (e.bot) { e.bot.onRoundStart(); this.botBuy(e); }
    this.viewModel.setWeapon(this.player.current.def, this.player.team);
    this.controller.specTarget = null;
    this.controller.visRecoilYaw = this.controller.visRecoilPitch = 0;
    this.audio.play('round_start');
    this.hud.hideDeathPanel(); this.hud.hideRoundEnd();
    // round-start callouts
    if (carrier && carrier.bot && Math.random() < 0.8) this.chat(carrier, t('cLetsGo', { s: carrier.bot.site }));
    const ctTalker = this.entities.find(e => e.bot && e.team === 'CT');
    if (ctTalker && Math.random() < 0.6) this.chat(ctTalker, t('cHold', { s: ctTalker.bot.site }));
    const half = this.round === this.matchCfg.half + 1 ? t('secondHalf') : '';
    this.hud.announce(`${t('round')} ${this.round}${half}`, 3, this.player.hasBomb ? t('carryBomb') : t('pressB'));
    this.hud.setBuyAllowed(true);
    this.hud.roundStart();
  }

  ownsWeapon(e, w) { return e.weapons[1] === w || e.weapons[2] === w || e.weapons[3] === w || e.weapons[4].includes(w); }

  // ---------------- update loop
  update(dt) {
    this.now += dt;
    if (this.phase === 'menu') return;
    this.effects.update(dt, this.now);
    this.updatePhase(dt);
    this.controller.update(dt);
    for (const e of this.entities) {
      if (e.isPlayer || !e.alive) continue;
      e.bot.update(dt);
      if (this.phase !== 'freeze') this.world.moveBody(e, dt);
      // bot footsteps are audible
      const sp = Math.hypot(e.vel.x, e.vel.z);
      if (e.onGround && sp > 2.2) { e.stepDist += sp * dt; if (e.stepDist > 2.6) { e.stepDist = 0; this.audio.play('footstep', e.pos, { volume: 0.5, maxDist: 22 }); this.notifyNoise(e, 14); } }
    }
    // firing (bots and player share the same trigger pipeline)
    for (const e of this.entities) {
      if (!e.alive) continue;
      const w = e.current;
      if (!w) continue;
      if (e.bot && e.firing && this.isLive()) {
        if (w.def.auto || this.now - w.lastShot > 60 / (w.def.rpm || 300)) this.fireWeapon(e);
      }
      // reload completion
      if (w.reloadEnd > 0 && this.now >= w.reloadEnd) {
        if (w.def.reloadShell) {
          w.ammo++; w.reserve--;
          if (w.ammo < w.def.mag && w.reserve > 0 && !e.firing) { w.reloadStart = this.now; w.reloadEnd = this.now + w.def.reload; }
          else { w.reloadEnd = 0; if (e.isPlayer) this.audio.play('reload_end'); }
        } else {
          const need = w.def.mag - w.ammo;
          const take = Math.min(need, w.reserve);
          w.ammo += take; w.reserve -= take; w.reloadEnd = 0;
          if (e.isPlayer) this.audio.play('reload_end');
        }
      }
      // bot recoil recovery
      if (e.bot) { const k = Math.exp(-dt * 8); e.recoilYaw *= k; e.recoilPitch *= k; }
      // spotting for radar (player's own vision)
      if (e.team !== this.player.team && this.player.alive && (this.now * 7 | 0) % 3 === 0) {
        const p = this.player;
        const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z, d = Math.hypot(dx, dz);
        if (d < 70) {
          const cos = (dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw)) / Math.max(0.001, d);
          if (cos > 0.55 && this.world.los(p.pos.x, p.pos.y + 1.6, p.pos.z, e.pos.x, e.pos.y + 1.2, e.pos.z, this.grenades.smokes)) e.spottedUntil = this.now + 2;
        }
      }
    }
    if (this.phase === 'dm') for (const e of this.entities) if (!e.alive && this.now >= e.respawnAt) this.respawn(e);
    for (const e of this.entities) if (e.alive && e.burningUntil > this.now && Math.random() < dt * 6) this.audio.play('burn', e.isPlayer ? null : e.pos, { maxDist: 20, volume: 0.5 });
    this.grenades.update(dt);
    this.updateBomb(dt);
    this.updatePickups();
    for (const e of this.entities) if (e.model) { animateHumanoid(e, dt, this.now); e.model.userData.tag.visible = e.alive && e.team === this.player.team; }
    this.updatePrompts();
    // bomb LED blink
    if (this.bomb.planted) { this.bombLed.visible = (this.now * 4 | 0) % 2 === 0; }
    this.audio.setListener(this.camera.position.x, this.camera.position.y, this.camera.position.z, this.camera.rotation.y);
  }

  updatePhase(dt) {
    switch (this.phase) {
      case 'freeze':
        this.timer -= dt;
        if (this.timer <= 0) { this.phase = 'live'; this.timer = ROUND.live; this.hud.announce(t('go'), 1.2); }
        break;
      case 'live': {
        this.timer -= dt;
        const tAlive = this.aliveCount('T'), cAlive = this.aliveCount('CT');
        if (this.timer <= ROUND.live - ROUND.buyTime) this.hud.setBuyAllowed(false);
        if (tAlive === 0) this.endRound('CT', t('ctWinElim'), 'elim');
        else if (cAlive === 0) this.endRound('T', t('tWinElim'), 'elim');
        else if (this.timer <= 0) this.endRound('CT', t('ctWinTime'), 'time');
        break;
      }
      case 'planted': {
        this.timer = this.bomb.explodeAt - this.now;
        if (this.aliveCount('CT') === 0) this.endRound('T', t('tWinElim'), 'elim');
        else if (this.now >= this.bomb.explodeAt) this.explodeBomb();
        break;
      }
      case 'end':
        this.timer -= dt;
        if (this.timer <= 0) this.nextRound();
        break;
      case 'dm': {
        this.timer -= dt;
        if (this.timer <= 0) {
          const k = team => this.entities.filter(e => e.team === team).reduce((a, e) => a + e.kills, 0);
          this.score = { T: k('T'), CT: k('CT') };
          this.matchEnd(this.score.T === this.score.CT ? (this.player.team) : this.score.T > this.score.CT ? 'T' : 'CT');
        }
        break;
      }
    }
  }

  aliveCount(team) { let n = 0; for (const e of this.entities) if (e.alive && e.team === team) n++; return n; }
  distToPlayer(p) { const e = this.player; return Math.hypot(p.x - e.pos.x, (p.y || 0) - e.pos.y, p.z - e.pos.z); }
  shake(a) { if (a > 0.05) this.controller.addShake(a); }
  inspect() { this.viewModel.inspect(); }

  // ---------------- rounds & economy
  endRound(winner, reason, kind = '') {
    if (this.phase === 'end' || this.phase === 'matchend') return;
    const loser = winner === 'T' ? 'CT' : 'T';
    this.phase = 'end'; this.timer = ROUND.end;
    this.score[winner]++;
    const planted = this.bomb.planted;
    const byBomb = kind === 'bombed' || kind === 'defused';
    for (const e of this.entities) {
      if (e.team === winner) e.money += byBomb ? ECON.winBomb : ECON.win;
      else {
        const idx = Math.min(this.lossStreak[loser], ECON.loss.length - 1);
        e.money += ECON.loss[idx];
        if (loser === 'T' && planted) e.money += ECON.lossPlantBonus;
      }
      e.money = Math.min(ECON.max, e.money);
      e.firing = false; e.planting = false; e.defusing = false;
    }
    this.lossStreak[loser]++;
    this.lossStreak[winner] = Math.max(0, this.lossStreak[winner] - 1);
    this.roundLog.push({ round: this.round, winner, reason });
    const playerWon = this.player.team === winner;
    // MVP: planter/defuser on objective wins, else most kills on the winning team
    let mvp = null, mvpWhy = '';
    const winners = this.entities.filter(e => e.team === winner);
    if (kind === 'bombed' && this.bomb.planter) { mvp = this.bomb.planter; mvpWhy = 'planting the bomb'; }
    else if (kind === 'defused' && this.bomb.defusedBy) { mvp = this.bomb.defusedBy; mvpWhy = 'defusing the bomb'; }
    else { winners.sort((a, b) => b.roundKills - a.roundKills || b.roundDmgGiven - a.roundDmgGiven); if (winners[0] && winners[0].roundKills > 0) { mvp = winners[0]; mvpWhy = `${mvp.roundKills} kill${mvp.roundKills > 1 ? 's' : ''}`; } }
    if (mvp) mvp.mvp++;
    this.hud.showRoundEnd({ won: playerWon, reason, mvp, mvpWhy, moneyDelta: this.player.money - this.player.roundMoneyStart, player: this.player });
    this.audio.play(playerWon ? 'win' : 'lose');
    this.hud.setBuyAllowed(false);
    if (this.bomb.planted) { this.bomb.planted = false; }
  }

  nextRound() {
    // match end?
    const s = this.score;
    if (s.T >= this.target || s.CT >= this.target) {
      const winner = s.T >= this.target ? 'T' : 'CT';
      this.matchEnd(winner);
      return;
    }
    if (s.T === this.target - 1 && s.CT === this.target - 1) {
      // overtime: MR3
      this.target += MATCH.otRounds;
      for (const e of this.entities) e.money = 10000;
      this.hud.announce(t('overtime'), 3, t('firstTo', { n: this.target }));
    }
    if (this.round === this.matchCfg.half) this.swapSides();
    this.startRound();
  }

  swapSides() {
    for (const e of this.entities) {
      e.team = e.team === 'T' ? 'CT' : 'T';
      e.money = ECON.start; e.alive = false; e.freshLoadout = true;
      if (e.model) { this.scene.remove(e.model); e.model = createHumanoid(e.team, e.name); this.scene.add(e.model); }
    }
    this.score = { T: this.score.CT, CT: this.score.T };
    this.lossStreak = { T: 0, CT: 0 };
    this.half = 2;
    this.tPlan = new TeamPlan(this, 'T'); this.ctPlan = new TeamPlan(this, 'CT');
    this.hud.announce(t('halftime'), 3);
  }

  matchEnd(winner) {
    this.phase = 'matchend';
    this.matchResult = { winner, score: { ...this.score }, playerWon: this.player.team === winner };
    this.hud.showMatchEnd(this);
    this.audio.play(this.matchResult.playerWon ? 'win' : 'lose');
  }

  // ---------------- buying
  canBuy(e) {
    if (this.phase === 'freeze' || this.phase === 'dm') return true;
    if (this.phase === 'live' && this.timer > ROUND.live - ROUND.buyTime) {
      const sp = this.map.spawns[e.team];
      for (const s of sp) if (Math.hypot(s.x - e.pos.x, s.z - e.pos.z) < 22) return true;
    }
    return false;
  }

  buy(e, id) {
    if (!e.alive || !this.canBuy(e)) return { ok: false, msg: t('notNow') };
    if (GEAR[id]) {
      const g = GEAR[id];
      if (g.teams && g.teams !== e.team) return { ok: false, msg: t('notTeam') };
      let price = g.price;
      if (id === 'kevlar') { if (e.armor >= 100) return { ok: false, msg: t('haveArmor') }; }
      if (id === 'helmet') { if (e.helmet && e.armor >= 100) return { ok: false, msg: t('haveHelmet') }; if (e.armor >= 100) price = 350; }
      if (id === 'kit') { if (e.kit) return { ok: false, msg: t('haveKit') }; }
      if (e.money < price) return { ok: false, msg: t('noMoney') };
      e.money -= price;
      if (id === 'kevlar') e.armor = 100;
      if (id === 'helmet') { e.armor = 100; e.helmet = true; }
      if (id === 'kit') e.kit = true;
      if (e.isPlayer) this.audio.play('buy');
      return { ok: true };
    }
    const def = WEAPONS[id];
    if (!def) return { ok: false };
    if (def.teams !== 'both' && def.teams !== e.team) return { ok: false, msg: t('notTeam') };
    if (e.money < def.price) return { ok: false, msg: t('noMoney') };
    if (def.slot === 4) {
      const have = e.weapons[4].filter(w => w.def.id === id).length;
      if (have >= def.max) return { ok: false, msg: t('maxNade') };
      if (e.weapons[4].length >= 4) return { ok: false, msg: t('nadeFull') };
      e.money -= def.price;
      e.weapons[4].push(makeWeapon(id));
    } else {
      const old = e.weapons[def.slot];
      if (old && old.def.id === id) return { ok: false, msg: t('ownWeapon') };
      e.money -= def.price;
      if (old) this.dropToGround(e, old);
      const w = makeWeapon(id);
      e.weapons[def.slot] = w;
      this.selectWeapon(e, w);
    }
    if (e.isPlayer) this.audio.play('buy');
    return { ok: true };
  }

  botBuy(e) {
    const T = e.team === 'T';
    const m = () => e.money;
    const buy = id => this.buy(e, id).ok;
    const hasPrimary = !!e.weapons[1];
    const teamAwps = this.entities.filter(o => o.team === e.team && o.weapons[1] && o.weapons[1].def.id === 'awp').length;
    if (!hasPrimary) {
      if (m() >= 5800 && teamAwps < 1 && Math.random() < 0.3) { buy('awp'); buy('helmet'); }
      else if (m() >= (T ? 3700 : 4100)) { buy(T ? 'ak47' : 'm4a4'); buy('helmet'); }
      else if (m() >= (T ? 2450 : 2700) && Math.random() < 0.75) { buy(T ? 'galil' : 'famas'); buy('kevlar'); }
      else if (m() >= 1700 && Math.random() < 0.65) { buy(T ? 'mac10' : 'mp9'); buy('kevlar'); }
      else if (m() >= 1350 && Math.random() < 0.4) { buy('deagle'); buy('kevlar'); }
      else if (m() >= 950 && Math.random() < 0.5) { buy('kevlar'); if (m() >= 300 && Math.random() < 0.5) buy('p250'); }
      else if (m() >= 500 && Math.random() < 0.35) buy(T ? 'tec9' : 'fiveseven');
    } else {
      if (e.armor < 50 && m() >= 1400) buy('helmet');
      else if (e.armor < 50 && m() >= 900) buy('kevlar');
    }
    if (!T && !e.kit && m() >= 1200 && Math.random() < 0.7) buy('kit');
    let tries = 0;
    while (m() > 2200 && e.weapons[4].length < 3 && tries++ < 4) {
      const r = Math.random();
      buy(r < 0.3 ? 'flash' : r < 0.55 ? 'he' : r < 0.78 ? 'smoke' : (T ? 'molotov' : 'incendiary'));
    }
    if (!e.weapons[1] && e.weapons[2]) this.selectWeapon(e, e.weapons[2]);
  }

  // ---------------- weapons & inventory
  selectWeapon(e, w) {
    if (!w || e.current === w) return;
    if (e.current) e.lastWeapon = e.current;
    e.current = w;
    w.scoped = false;
    w.nextShot = Math.max(w.nextShot, this.now + (w.def.cat === 'melee' ? 0.25 : 0.45));
    if (e.isPlayer) { this.viewModel.setWeapon(w.def, e.team); this.audio.play('switch'); }
  }
  selectSlot(e, n) {
    if (n === 4) {
      const list = e.weapons[4]; if (!list.length) return;
      const i = list.indexOf(e.current);
      this.selectWeapon(e, list[(i + 1) % list.length]);
    } else if (e.weapons[n]) this.selectWeapon(e, e.weapons[n]);
  }
  selectLast(e) { if (e.lastWeapon && this.ownsWeapon(e, e.lastWeapon)) this.selectWeapon(e, e.lastWeapon); }
  weaponList(e) { return [e.weapons[1], e.weapons[2], e.weapons[3], ...e.weapons[4]].filter(Boolean); }
  cycleWeapon(e, dir) {
    const list = this.weaponList(e); if (!list.length) return;
    const i = list.indexOf(e.current);
    this.selectWeapon(e, list[(i + dir + list.length) % list.length]);
  }
  startReload(e, w) {
    if (!w || !w.def.mag) return;
    if (w.reloadEnd > 0 || w.ammo >= w.def.mag || w.reserve <= 0) return;
    w.reloadStart = this.now; w.reloadEnd = this.now + w.def.reload;
    w.scoped = false;
    this.audio.play('reload', e.isPlayer ? null : e.pos, { volume: 0.6, maxDist: 20 });
  }

  dropToGround(e, w) {
    if (!w || w.def.slot === 3 || w.def.slot === 4) return;
    const mesh = buildWeaponModel(w.def, e.team);
    mesh.scale.set(1.4, 1.4, 1.4);
    mesh.rotation.set(Math.PI / 2, 0, Math.random() * Math.PI * 2);
    const px = e.pos.x + (Math.random() - 0.5) * 0.4, pz = e.pos.z + (Math.random() - 0.5) * 0.4;
    mesh.position.set(px, this.world.floorAt(px, pz) + 0.06, pz);
    this.scene.add(mesh);
    this.pickups.push({ w, mesh, pos: { x: px, y: mesh.position.y, z: pz }, team: e.team });
    if (e.weapons[w.def.slot] === w) e.weapons[w.def.slot] = null;
    if (e.current === w) e.current = e.weapons[1] || e.weapons[2] || e.weapons[3];
    if (e.isPlayer && e.current) this.viewModel.setWeapon(e.current.def, e.team);
  }
  dropWeapon(e) {
    const w = e.current;
    if (!w || w.def.slot === 3 || w.def.slot === 4) return;
    this.dropToGround(e, w);
  }
  takePickup(e, p) {
    const slot = p.w.def.slot;
    if (e.weapons[slot]) this.dropToGround(e, e.weapons[slot]);
    e.weapons[slot] = p.w;
    p.w.reloadEnd = 0; p.w.shots = 0;
    this.scene.remove(p.mesh);
    this.pickups.splice(this.pickups.indexOf(p), 1);
    if (slot === 1 || !e.weapons[1]) this.selectWeapon(e, p.w);
    if (e.isPlayer) this.audio.play('pickup');
  }
  updatePickups() {
    if (!this.isLive() && this.phase !== 'freeze') return;
    while (this.pickups.length > 24) { const p = this.pickups.shift(); this.scene.remove(p.mesh); }
    for (const e of this.entities) {
      if (!e.alive) continue;
      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) > 1.1 || Math.abs(p.pos.y - e.pos.y) > 1.2) continue;
        if (!e.weapons[p.w.def.slot]) this.takePickup(e, p);
      }
      // dropped bomb pickup
      const b = this.bomb;
      if (b.dropped && !b.carrier && e.team === 'T' && Math.hypot(b.dropped.x - e.pos.x, b.dropped.z - e.pos.z) < 1.2) {
        b.carrier = e; e.hasBomb = true; b.dropped = null; this.bombMesh.visible = false;
        if (e.isPlayer) { this.audio.play('pickup'); this.hud.announce(t('pickedBomb'), 2); }
      }
    }
  }

  // E key for the player: plant / defuse / swap weapon pickup
  playerUse(e, dt) {
    if (!this.isLive()) return;
    if (e.team === 'T' && e.hasBomb && !this.bomb.planted) {
      const cell = this.world.cellAt(e.pos.x, e.pos.z);
      if (cell && cell.zone && e.onGround) { this.plantTick(e, dt); return; }
      else if (!e.useTipT || this.now - e.useTipT > 3) { e.useTipT = this.now; this.hud.hint(t('plantHint'), 2.5); }
    }
    if (e.team === 'CT' && this.bomb.planted) {
      const b = this.bomb;
      if (Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) < 1.5 && Math.abs(b.pos.y - e.pos.y) < 1.5) { this.defuseTick(e, dt); return; }
    }
    // weapon swap pickup (hold-to-use repeated: only once per press)
    if (!e.usePressHandled) {
      e.usePressHandled = true;
      for (const p of this.pickups) {
        if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 1.6) { this.takePickup(e, p); break; }
      }
    }
  }

  plantTick(e, dt) {
    if (this.phase !== 'live' || this.bomb.planted || !e.hasBomb) return;
    if (!e.planting) { e.planting = true; e.plantProgress = 0; this.audio.play('plant', e.isPlayer ? null : e.pos, { maxDist: 25 }); }
    e.plantProgress += dt;
    if (e.isPlayer) this.hud.progress(t('planting'), e.plantProgress / ROUND.plant);
    if (e.plantProgress >= ROUND.plant) this.plantBomb(e);
  }

  plantBomb(e) {
    const cell = this.world.cellAt(e.pos.x, e.pos.z);
    const b = this.bomb;
    b.planted = true; b.site = cell && cell.zone ? cell.zone : 'A';
    b.pos = { x: e.pos.x, y: e.pos.y, z: e.pos.z };
    b.plantedAt = this.now; b.explodeAt = this.now + ROUND.bomb; b.carrier = null; b.beepNext = this.now; b.planter = e;
    e.hasBomb = false; e.planting = false; e.money = Math.min(ECON.max, e.money + ECON.plant);
    this.bombMesh.position.set(b.pos.x, b.pos.y, b.pos.z); this.bombMesh.rotation.y = e.yaw; this.bombMesh.visible = true;
    this.phase = 'planted'; this.timer = ROUND.bomb;
    this.hud.announce(t('bombPlanted'), 3, t('siteSeconds', { s: b.site }));
    if (e.bot) this.chat(e, t('cPlanted', { s: b.site }));
    this.hud.setBuyAllowed(false);
    for (const o of this.entities) if (o.bot) o.bot.onBombPlanted();
  }

  defuseTick(e, dt) {
    if (this.phase !== 'planted') return;
    const b = this.bomb;
    if (b.defusingBy && b.defusingBy !== e && b.defusingBy.alive && b.defusingBy.defusing) return;
    if (!e.defusing) { e.defusing = true; e.defuseProgress = 0; this.audio.play(e.kit ? 'defuse_kit' : 'plant', e.isPlayer ? null : e.pos, { maxDist: 25 }); }
    b.defusingBy = e;
    e.defuseProgress += dt;
    const total = e.kit ? ROUND.defuseKit : ROUND.defuse;
    if (e.isPlayer) this.hud.progress(e.kit ? t('defusingKit') : t('defusing'), e.defuseProgress / total);
    if (e.defuseProgress >= total) {
      e.defusing = false;
      this.audio.play('defused');
      this.bomb.planted = false; this.bombMesh.visible = false; this.bomb.defusedBy = e;
      e.money = Math.min(ECON.max, e.money + 300);
      if (e.bot) this.chat(e, t('cDefused'));
      this.endRound('CT', t('ctWinDefuse'), 'defused');
    }
  }

  updateBomb(dt) {
    const b = this.bomb;
    if (b.dropped) { this.bombMesh.visible = true; this.bombMesh.position.set(b.dropped.x, b.dropped.y, b.dropped.z); }
    if (!b.planted || this.phase !== 'planted') return;
    if (this.now >= b.beepNext) {
      const left = b.explodeAt - this.now;
      const interval = left > 30 ? 1.0 : left > 20 ? 0.7 : left > 10 ? 0.45 : left > 5 ? 0.25 : 0.12;
      b.beepNext = this.now + interval;
      this.audio.play('beep', b.pos, { maxDist: 90, volume: 0.8 });
    }
    // defuse interruption when defuser stopped
    if (b.defusingBy && (!b.defusingBy.alive || !b.defusingBy.defusing)) { b.defusingBy = null; }
  }

  explodeBomb() {
    const b = this.bomb;
    this.effects.explosion(b.pos.x, b.pos.y, b.pos.z);
    this.effects.explosion(b.pos.x + 1, b.pos.y + 1, b.pos.z - 1);
    this.audio.play('bomb_explode', b.pos, { maxDist: 400, volume: 1.2 });
    this.shake(Math.max(0.3, 2.5 - this.distToPlayer(b.pos) / 30));
    const R = 24;
    for (const e of this.entities) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - b.pos.x, e.pos.y - b.pos.y, e.pos.z - b.pos.z);
      if (d > R) continue;
      const dmg = 500 * Math.pow(1 - d / R, 2);
      this.applyDamage(e, null, dmg, 'body', { cat: 'bomb', pen: 0.5, kill: 0, id: 'bomb', name: 'C4' }, b.pos);
    }
    this.bombMesh.visible = false;
    this.bomb.planted = false;
    this.endRound('T', t('tWinBomb'), 'bombed');
  }

  throwGrenade(e, underhand = false) {
    const w = e.current; if (!w || w.def.cat !== 'grenade' || !e.alive) return false;
    if (!this.isLive()) return false;
    const eye = this.eyeOf(e);
    const cp = Math.cos(e.pitch);
    let dx = -Math.sin(e.yaw) * cp, dy = Math.sin(e.pitch) + (underhand ? 0.12 : 0.06), dz = -Math.cos(e.yaw) * cp;
    const n = Math.hypot(dx, dy, dz); dx /= n; dy /= n; dz /= n;
    const speed = underhand ? 7.5 : 19;
    this.grenades.throw(e, w.def.id, eye.x + dx * 0.4, eye.y - 0.05, eye.z + dz * 0.4, dx, dy, dz, speed);
    const list = e.weapons[4];
    list.splice(list.indexOf(w), 1);
    e.current = null;
    const next = list.find(x => x.def.id === w.def.id) || e.weapons[1] || e.weapons[2] || e.weapons[3];
    this.selectWeapon(e, next);
    if (e.isPlayer) this.viewModel.swap = 0.5;
    return true;
  }

  // ---------------- combat
  eyeOf(e) { return { x: e.pos.x, y: e.pos.y + (e.crouch ? PLAYER.crouchEye : PLAYER.eye), z: e.pos.z }; }

  fireWeapon(e, alt = false) {
    const w = e.current; if (!w || !e.alive) return false;
    if (!this.isLive()) return false;
    const now = this.now, def = w.def;
    if (now < w.nextShot) return false;
    if (w.reloadEnd > 0) {
      if (def.reloadShell && w.ammo > 0) { w.reloadEnd = 0; } else return false;
    }
    if (def.cat === 'grenade') return false;
    if (def.cat === 'melee') {
      w.nextShot = now + (alt ? 1.0 : 60 / def.rpm);
      this.knifeAttack(e, w, alt);
      return true;
    }
    if (w.ammo <= 0) {
      if (e.isPlayer) this.audio.play('dryfire');
      w.nextShot = now + 0.25;
      this.startReload(e, w);
      return false;
    }
    w.ammo--; w.nextShot = now + 60 / def.rpm;
    if (now - w.lastShot > 0.45) w.shots = 0;
    w.lastShot = now; e.lastShotTime = now;
    const pat = def.recoil.pattern;
    const idx = Math.min(w.shots, pat.length - 1); w.shots++;
    const recoilMul = e.crouch ? 0.8 : 1;
    e.recoilYaw += pat[idx][0] * recoilMul; e.recoilPitch += pat[idx][1] * recoilMul;
    const spread = currentSpread(e, w);
    const eye = this.eyeOf(e);
    const pellets = def.pellets || 1;
    // bots compensate part of their recoil
    const comp = e.bot ? (e.bot.diff.hsChance >= 0.3 ? 0.75 : e.bot.diff.hsChance >= 0.15 ? 0.5 : 0.2) : 0;
    for (let p = 0; p < pellets; p++) {
      const a = Math.random() * Math.PI * 2, r = spread * Math.sqrt(Math.random());
      const sx = Math.cos(a) * r, sy = Math.sin(a) * r;
      const yaw = e.yaw - rad(e.recoilYaw * (1 - comp) + sx);
      const pitch = e.pitch + rad(e.recoilPitch * (1 - comp) + sy);
      const cp = Math.cos(pitch);
      const dx = -Math.sin(yaw) * cp, dy = Math.sin(pitch), dz = -Math.cos(yaw) * cp;
      this.hitscan(e, w, eye, dx, dy, dz, p === 0);
    }
    // sound + visuals
    const snd = this.audio.shotSound(def);
    this.audio.play(snd, e.isPlayer ? null : e.pos, { maxDist: 160, volume: e.isPlayer ? 0.8 : 1 });
    if (e.isPlayer) {
      this.viewModel.kick(def.cat === 'sniper' ? 2.2 : def.cat === 'shotgun' ? 1.8 : def.cat === 'pistol' ? 0.8 : 1);
      // light up the surroundings
      const f = { x: eye.x - Math.sin(e.yaw) * 0.8, y: eye.y - 0.1, z: eye.z - Math.cos(e.yaw) * 0.8 };
      this.effects.muzzle(f.x, f.y, f.z);
      if (def.scope && w.scoped) w.scoped = false;
    } else {
      const f = { x: e.pos.x - Math.sin(e.yaw) * 0.6, y: e.pos.y + (e.crouch ? 0.9 : 1.3), z: e.pos.z - Math.cos(e.yaw) * 0.6 };
      this.effects.muzzle(f.x, f.y, f.z);
    }
    this.notifyNoise(e, 55, true);
    // site danger tracking (for CT rotations)
    for (const s of ['A', 'B']) {
      const site = this.map.sites[s];
      if (Math.hypot(site.x - e.pos.x, site.z - e.pos.z) < 28) this.siteDanger[s] = now;
    }
    if (def.reloadShell && w.ammo === 0) this.startReload(e, w);
    return true;
  }

  hitscan(e, w, eye, dx, dy, dz, tracer) {
    const def = w.def;
    let origin = { x: eye.x, y: eye.y, z: eye.z };
    let travelled = 0, dmgMul = 1;
    let power = penetrationPower(def);
    const hitEntities = new Set();
    for (let pass = 0; pass < 3; pass++) {
      const maxD = 300 - travelled;
      const wh = this.world.raycast(origin.x, origin.y, origin.z, dx, dy, dz, maxD);
      let tBest = wh ? wh.t : maxD, victim = null, part = null;
      for (const o of this.entities) {
        if (!o.alive || o === e || o.team === e.team || hitEntities.has(o)) continue;
        const h = rayEntity(o, origin.x, origin.y, origin.z, dx, dy, dz, tBest);
        if (h) { tBest = h.t; victim = o; part = h.part; }
      }
      const end = { x: origin.x + dx * tBest, y: origin.y + dy * tBest, z: origin.z + dz * tBest };
      if (pass === 0 && tracer && tBest > 2) {
        let m;
        if (e.isPlayer) m = { x: eye.x + dx * 1.2 + Math.cos(e.yaw) * 0.22, y: eye.y - 0.18 + dy * 1.2, z: eye.z + dz * 1.2 - Math.sin(e.yaw) * 0.22 };
        else m = { x: e.pos.x - Math.sin(e.yaw) * 0.6, y: e.pos.y + (e.crouch ? 0.9 : 1.3), z: e.pos.z - Math.cos(e.yaw) * 0.6 };
        this.effects.tracer(m, end);
      }
      if (victim) {
        const dmg = damageAtRange(def, travelled + tBest) * dmgMul;
        this.applyDamage(victim, e, dmg, part, def, eye, pass > 0);
        this.effects.blood(end.x, end.y, end.z, part === 'head' ? 7 : 4);
        hitEntities.add(victim);
        // bullets keep going through bodies with reduced damage
        travelled += tBest + 0.5; dmgMul *= 0.55;
        origin = { x: end.x + dx * 0.5, y: end.y + dy * 0.5, z: end.z + dz * 0.5 };
        if (dmgMul < 0.2) return;
        continue;
      }
      if (!wh) return;
      this.effects.impact(wh, def.cat === 'sniper');
      if (Math.random() < 0.25) this.audio.play(Math.random() < 0.5 ? 'impact' : 'ricochet', wh, { maxDist: 30, volume: 0.5 });
      else this.audio.play('impact', wh, { maxDist: 30, volume: 0.4 });
      // wall penetration: march through the obstacle and continue if it is thin enough
      const isWall = this.world.cellTop(wh.cx, wh.cz) >= WALL_H;
      if (power <= 0 || (isWall && power < 2)) return;
      const maxThick = isWall ? 1.05 : 1.6;
      let exit = null;
      for (let d = 0.1; d <= maxThick; d += 0.1) {
        const px = wh.x + dx * d, py = wh.y + dy * d, pz = wh.z + dz * d;
        if (py >= this.world.topAt(px, pz)) { exit = { x: px, y: py, z: pz, d }; break; }
      }
      if (!exit) return;
      dmgMul *= isWall ? 0.45 : 0.72;
      power -= isWall ? 2 : 1;
      travelled += wh.t + exit.d;
      origin = { x: exit.x, y: exit.y, z: exit.z };
      this.effects.impact({ x: exit.x, y: exit.y, z: exit.z, nx: dx, ny: dy, nz: dz }, false);
    }
  }

  knifeAttack(e, w, alt) {
    const eye = this.eyeOf(e);
    const cp = Math.cos(e.pitch);
    const dx = -Math.sin(e.yaw) * cp, dy = Math.sin(e.pitch), dz = -Math.cos(e.yaw) * cp;
    this.audio.play('knife', e.isPlayer ? null : e.pos, { maxDist: 12 });
    if (e.isPlayer) this.viewModel.kick(1.5);
    const range = 1.8;
    let victim = null, best = range;
    for (const o of this.entities) {
      if (!o.alive || o === e || o.team === e.team) continue;
      const h = rayEntity(o, eye.x, eye.y, eye.z, dx, dy, dz, best + 0.3);
      if (h && h.t < best + 0.3) { best = h.t; victim = o; }
    }
    if (victim) {
      // backstab: attacker behind the victim
      const vx = -Math.sin(victim.yaw), vz = -Math.cos(victim.yaw);
      const behind = (dx * vx + dz * vz) > 0.5;
      const dmg = alt ? (behind ? 180 : 65) : (behind ? 90 : 40);
      this.applyDamage(victim, e, dmg, 'body', { ...w.def, pen: 0.85, hsMul: 1 }, eye);
      this.audio.play('knife_hit', e.isPlayer ? null : e.pos, { maxDist: 12 });
      this.effects.blood(victim.pos.x, victim.pos.y + 1.1, victim.pos.z, 6);
    }
  }

  applyDamage(victim, attacker, dmg, part, def, srcPos, throughWall = false) {
    if (!victim.alive) return;
    if (attacker && attacker !== victim && attacker.team === victim.team) return; // no friendly fire
    let d = dmg;
    if (part === 'head') d *= def.hsMul || 4;
    else if (part === 'legs') d *= 0.75;
    const armored = victim.armor > 0 && (part === 'body' || (part === 'head' && victim.helmet));
    let hitArmor = false;
    if (armored && def.pen !== undefined) {
      const toHp = d * def.pen;
      const loss = Math.min(victim.armor, (d - toHp) * 0.5);
      victim.armor -= loss;
      d = toHp; hitArmor = true;
    }
    d = Math.max(1, Math.round(d));
    const dealt = Math.min(d, victim.hp);
    victim.hp -= d;
    victim.lastHitBy = attacker; victim.lastHitTime = this.now;
    victim.roundDmgTaken += dealt; victim.roundHitsTaken++;
    if (attacker && attacker !== victim) { attacker.damage += dealt; attacker.roundDmgGiven += dealt; attacker.roundHitsGiven++; }
    if (victim.isPlayer) {
      const ang = srcPos ? Math.atan2(srcPos.x - victim.pos.x, -(srcPos.z - victim.pos.z)) : null;
      this.hud.damageFrom(ang, victim.yaw, d);
      this.audio.play('hurt', null, { volume: 0.7 });
      this.shake(Math.min(1, d / 40));
      if (def.cat !== 'fire') this.controller.punch(d * (victim.armor > 0 ? 0.05 : 0.12));
    }
    if (attacker && attacker.isPlayer && victim !== attacker) {
      this.hud.hitmarker(part === 'head');
      this.audio.play(part === 'head' ? 'headshot' : hitArmor ? 'hit_armor' : 'hit', null, { volume: 0.6 });
    } else if (victim !== attacker) this.audio.play('hit', victim.pos, { maxDist: 25, volume: 0.5 });
    if (victim.bot) { victim.bot.onDamaged(attacker, srcPos); victim.hitFlashUntil = this.now + 0.09; }
    if (victim.hp <= 0) { victim.hp = 0; this.kill(victim, attacker, def, part === 'head'); }
  }

  kill(victim, attacker, def, hs) {
    victim.alive = false; victim.deaths++;
    victim.crouch = false; victim.planting = false; victim.defusing = false; victim.firing = false;
    victim.vel.x = 0; victim.vel.z = 0;
    this.audio.play('death', victim.isPlayer ? null : victim.pos, { maxDist: 30 });
    if (attacker && attacker !== victim && attacker.team !== victim.team) {
      attacker.kills++; attacker.roundKills++;
      attacker.money = Math.min(ECON.max, attacker.money + (def.kill ?? 300));
      if (attacker.bot && Math.random() < 0.25) this.chat(attacker, hs ? t('cHsDown') : t('cEnemyDown'));
    } else if (attacker === victim) victim.money = Math.max(0, victim.money - 300);
    this.hud.killfeed(attacker, victim, def, hs);
    if (this.phase === 'dm') { victim.respawnAt = this.now + 3; victim.hideCorpseAfter = 6; } else victim.hideCorpseAfter = 0;
    // a teammate reports the death
    if (Math.random() < 0.35) {
      const mates = this.entities.filter(o => o.bot && o.alive && o.team === victim.team && o !== victim);
      if (mates.length) this.chat(mates[Math.floor(Math.random() * mates.length)], t('cDownAt', { n: victim.name, r: this.map.regionName(victim.pos.x, victim.pos.z) }));
    }
    if (victim.hasBomb) {
      victim.hasBomb = false; this.bomb.carrier = null;
      this.bomb.dropped = { x: victim.pos.x, y: this.world.floorAt(victim.pos.x, victim.pos.z), z: victim.pos.z };
      if (victim.isPlayer || this.player.team === 'T') this.hud.announce(t('bombDropped'), 2);
    }
    if (victim.weapons[1]) this.dropToGround(victim, victim.weapons[1]);
    if (victim.isPlayer) { this.controller.onDeath(); this.hud.onPlayerDeath(attacker, def, hs, throughWallKill(def)); this.hud.showDeathPanel(victim, attacker, def, hs); }
    if (victim.model) victim.model.userData.deadT = 0;
    if (victim.bot) { victim.bot.target = null; }
    // notify teammate bots of the death location (for rotations)
    for (const s of ['A', 'B']) {
      const site = this.map.sites[s];
      if (Math.hypot(site.x - victim.pos.x, site.z - victim.pos.z) < 28) this.siteDanger[s] = this.now;
    }
  }

  flashEntity(e, dur, by) {
    if (e.isPlayer) {
      e.blindUntil = Math.max(e.blindUntil, this.now + dur); e.flashDur = dur;
      this.audio.play('flash_ring', null, { duration: dur * 0.6, volume: 0.5 });
    } else {
      e.blindUntil = Math.max(e.blindUntil, this.now + dur * (e.bot.diff.hsChance >= 0.3 ? 0.8 : 1));
      e.bot.target = null;
    }
  }

  // Noise alerts enemy bots.
  notifyNoise(src, radius, isShot = false) {
    for (const o of this.entities) {
      if (!o.bot || !o.alive || o.team === src.team) continue;
      const d = Math.hypot(o.pos.x - src.pos.x, o.pos.z - src.pos.z);
      if (d < radius) {
        if (isShot) o.bot.onHearShot(src);
        else if (!o.bot.target && Math.random() < 0.3) { o.bot.lastKnown = { x: src.pos.x, z: src.pos.z }; o.bot.lookAt(src.pos.x, src.pos.y + 1.2, src.pos.z); }
      }
    }
  }

  buyTimeLeft() {
    if (this.phase === 'freeze') return this.timer + ROUND.buyTime;
    if (this.phase === 'live') return Math.max(0, this.timer - (ROUND.live - ROUND.buyTime));
    return 0;
  }

  // Contextual "press E" prompts for the player.
  updatePrompts() {
    const e = this.player; if (!e.alive || !this.isLive()) { this.hud.prompt(''); return; }
    if (e.team === 'T' && e.hasBomb && !this.bomb.planted) { const c = this.world.cellAt(e.pos.x, e.pos.z); if (c && c.zone) { this.hud.prompt(t('plantPrompt')); return; } }
    if (e.team === 'CT' && this.bomb.planted) { const b = this.bomb; if (Math.hypot(b.pos.x - e.pos.x, b.pos.z - e.pos.z) < 1.5) { this.hud.prompt(t('defusePrompt')); return; } }
    for (const p of this.pickups) if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 1.6 && e.weapons[p.w.def.slot]) { this.hud.prompt(t('pickup', { w: p.w.def.name })); return; }
    this.hud.prompt('');
  }

  // Team chat / radio
  chat(e, text) {
    if (!e || !text) return;
    if (e.bot && this.now - e.lastCallout < 4) return;
    e.lastCallout = this.now;
    this.hud.chat(e, text);
    if (e.team === this.player.team) this.audio.play('radio', null, { volume: 0.35 });
  }

  // Player radio commands: steer teammate bots.
  radio(cmd) {
    const p = this.player;
    if (!this.isLive() && this.phase !== 'freeze') return;
    const mates = this.entities.filter(o => o.bot && o.alive && o.team === p.team);
    if (cmd === 'A' || cmd === 'B') {
      this.chat(p, p.team === 'T' ? t('cGoAll', { s: cmd }) : t('cRotate', { s: cmd }));
      if (p.team === 'T') this.tPlan.site = cmd;
      for (const m of mates) {
        const b = m.bot;
        if (b.state === 'plant' || b.state === 'defuse' || (b.target && b.target.alive)) continue;
        b.site = cmd; b.arrived = false; b.investigateUntil = 0; b.investigating = false; b.lateMove = true;
        b.planObjective();
        if (Math.random() < 0.5) setTimeout(() => this.chat(m, Math.random() < 0.5 ? t('cRoger') : t('cMoving', { s: cmd })), 300 + Math.random() * 1200);
      }
    } else if (cmd === 'hold') {
      this.chat(p, t('cHoldPos'));
      for (const m of mates) { const b = m.bot; if (b.state === 'plant' || b.state === 'defuse') continue; b.path = null; b.arrived = true; b.lateMove = true; b.holdAt(m.pos.x, m.pos.z); }
    } else if (cmd === 'follow') {
      this.chat(p, t('cFollow'));
      for (const m of mates) { const b = m.bot; if (b.state === 'plant' || b.state === 'defuse') continue; b.lateMove = true; b.state = 'rush'; b.setGoal(p.pos.x, p.pos.z); b.arrivedAction = () => b.holdAt(m.pos.x, m.pos.z); }
    } else if (cmd === 'report') {
      for (const m of mates) if (Math.random() < 0.7) setTimeout(() => this.chat(m, m.bot.target ? t('cContact', { r: this.map.regionName(m.pos.x, m.pos.z) }) : t('cClear', { r: this.map.regionName(m.pos.x, m.pos.z) })), 200 + Math.random() * 1500);
    }
  }

  // Scoreboard rows
  scoreboard() {
    const rows = team => this.entities.filter(e => e.team === team).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    return { T: rows('T'), CT: rows('CT') };
  }
}
