// DOM-based HUD: stats, timer, radar, killfeed, buy menu, scoreboard, overlays.
import { WEAPONS, GEAR, BUY_MENU, currentSpread } from './weapons.js';
import { ROUND } from './config.js';
import { t } from './i18n.js';

const $ = id => document.getElementById(id);
const fmtTime = s => { s = Math.max(0, Math.ceil(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class HUD {
  constructor() {
    this.game = null;
    this.el = {
      hud: $('hud'), hp: $('hp'), armor: $('armor'), money: $('money'), ammoMag: $('ammo-mag'), ammoRes: $('ammo-res'),
      weaponName: $('weapon-name'), timer: $('round-timer'), roundNum: $('round-num'), scoreT: $('score-t'), scoreCT: $('score-ct'),
      aliveT: $('alive-t'), aliveCT: $('alive-ct'), announce: $('announce'), sub: $('subannounce'), killfeed: $('killfeed'),
      radar: $('radar-canvas'), weaponbar: $('weaponbar'), bomb: $('bombstatus'), progress: $('progress'), progressLabel: $('progress-label'),
      progressFill: $('progress-fill'), hint: $('hint'), buy: $('buymenu'), cursor: $('cursor'), score: $('scoreboard'),
      crosshair: $('crosshair'), hitmarker: $('hitmarker'), vignette: $('damage-vignette'), flash: $('flash-overlay'), scope: $('scope-overlay'),
      spec: $('spectate-info'), timerBox: $('timer-box'), dmgDir: $('damage-dir'), buyMoney: $('buy-money'), buyMsg: $('buy-msg'),
      matchend: $('matchend'), armorIcon: $('armor-icon'), bombIcon: $('bomb-icon'), kitIcon: $('kit-icon'), deathPanel: $('death-panel'),
      chat: $('chat'), roundEnd: $('round-end'), promptEl: $('prompt'), buyTime: $('buy-time'), mates: $('teammates'), deathInfo: $('death-info'), fullmap: $('fullmap'), fullmapCanvas: $('fullmap-canvas'), moneyPop: $('money-pop'), burn: $('burn-overlay'),
    };
    this.lastMoney = null; this.fullmapOpen = false;
    this.announceUntil = 0; this.hintUntil = 0; this.progressT = 0; this.hitT = 0; this.hitHs = false;
    this.vignette = 0; this.buyOpen = false; this.buyAllowed = false; this.cursor = { x: innerWidth / 2, y: innerHeight / 2 };
    this.feed = [];
    this.buildBuyMenu();
    this.lastText = {};
  }

  attach(game) {
    this.game = game;
    this.buildMinimap(game.map);
  }

  setText(key, el, text) { if (this.lastText[key] !== text) { this.lastText[key] = text; el.textContent = text; } }

  // ---------- minimap / radar
  buildMinimap(map) {
    const c = document.createElement('canvas');
    const S = 3; c.width = map.W * S; c.height = map.H * S;
    const g = c.getContext('2d');
    g.fillStyle = '#0b0f14'; g.fillRect(0, 0, c.width, c.height);
    for (const cell of map.cells) {
      if (cell.wall) continue;
      g.fillStyle = cell.zone ? 'rgba(230,180,70,0.55)' : cell.obst ? '#3a3f47' : cell.h > 0.6 ? '#9a9890' : cell.h > 0 ? '#86847c' : '#6f6e68';
      g.fillRect(cell.x * S, cell.z * S, S, S);
    }
    g.font = `bold ${S * 9}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(255,230,120,0.95)';
    for (const n of ['A', 'B']) { const s = map.sites[n]; g.fillText(n, s.x * S, s.z * S); }
    this.minimap = c; this.mmScale = S;
  }

  drawRadar() {
    const g = this.game, cv = this.el.radar, ctx = cv.getContext('2d');
    const p = g.player, cam = g.camera;
    const W = cv.width, H = cv.height;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(5,8,12,0.75)'; ctx.fillRect(0, 0, W, H);
    const cx = cam.position.x, cz = cam.position.z, yaw = cam.rotation.y;
    const zoom = 2.6; // px per meter
    ctx.translate(W / 2, H / 2);
    ctx.rotate(yaw);
    ctx.scale(zoom / this.mmScale, zoom / this.mmScale);
    ctx.translate(-cx * this.mmScale, -cz * this.mmScale);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(this.minimap, 0, 0);
    ctx.globalAlpha = 1;
    const S = this.mmScale;
    const dot = (x, z, color, r, ang) => {
      ctx.save(); ctx.translate(x * S, z * S);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      if (ang !== undefined) { ctx.rotate(-ang); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 2.6); ctx.stroke(); }
      ctx.restore();
    };
    // bomb
    const b = g.bomb;
    if (b.planted || b.dropped) { const bp = b.planted ? b.pos : b.dropped; dot(bp.x, bp.z, '#ff3030', 3.2); }
    for (const e of g.entities) {
      if (!e.alive) { if (e.team === p.team && g.now - e.lastHitTime < 6) dot(e.pos.x, e.pos.z, 'rgba(200,200,200,0.5)', 2); continue; }
      if (e.team === p.team) dot(e.pos.x, e.pos.z, e.isPlayer ? '#ffffff' : (p.team === 'CT' ? '#6fb0ff' : '#ffcc66'), e.isPlayer ? 3 : 2.6, e.yaw);
      else if (e.spottedUntil > g.now) dot(e.pos.x, e.pos.z, '#ff4040', 2.8, e.yaw);
    }
    if (b.carrier && b.carrier.team === p.team && b.carrier.alive) dot(b.carrier.pos.x, b.carrier.pos.z, '#ff9020', 1.6);
    ctx.restore();
    // frame + north marker
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(W / 2, H / 2, W / 2 - 2, 0, Math.PI * 2); ctx.stroke();
  }

  // ---------- buy menu
  buildBuyMenu() {
    const root = this.el.buy;
    root.innerHTML = `<div class="buy-head"><div class="buy-title" data-i18n-key="buyMenu">BUY MENU</div><div class="buy-money">$<span id="buy-money">0</span></div><div class="buy-close" data-close="1">✕ <span data-i18n-key="close">Close (B)</span></div></div><div class="buy-cols"></div><div id="buy-msg"></div>`;
    const cols = root.querySelector('.buy-cols');
    for (const cat of BUY_MENU) {
      const col = document.createElement('div'); col.className = 'buy-col';
      col.innerHTML = `<div class="buy-cat">${cat.title}</div>`;
      for (const id of cat.items) {
        const def = WEAPONS[id] || GEAR[id];
        const it = document.createElement('div'); it.className = 'buy-item'; it.dataset.buy = id;
        it.innerHTML = `<span class="bi-name">${def.name}</span><span class="bi-price">$${def.price}</span><span class="bi-team">${def.teams === 'T' ? 'T' : def.teams === 'CT' ? 'CT' : ''}</span>`;
        col.appendChild(it);
      }
      cols.appendChild(col);
    }
    this.el.buyMoney = $('buy-money'); this.el.buyMsg = $('buy-msg');
  }
  setBuyAllowed(v) { this.buyAllowed = v; if (!v && this.buyOpen) this.closeBuy(); }
  toggleBuy() {
    if (this.buyOpen) { this.closeBuy(); return; }
    const g = this.game;
    if (!g.player.alive) return;
    if (!g.canBuy(g.player)) { this.hint(t('buyHint'), 2); this.game.audio.play('deny'); return; }
    for (const el of this.el.buy.querySelectorAll('[data-i18n-key]')) el.textContent = t(el.dataset.i18nKey);
    this.buyOpen = true; this.el.buy.classList.remove('hidden'); this.el.cursor.classList.remove('hidden');
    this.cursor = { x: innerWidth / 2, y: innerHeight / 2 }; this.moveCursor(0, 0);
    this.refreshBuy();
  }
  closeBuy() { this.buyOpen = false; this.el.buy.classList.add('hidden'); this.el.cursor.classList.add('hidden'); }
  refreshBuy() {
    const e = this.game.player;
    this.el.buyMoney.textContent = e.money;
    for (const it of this.el.buy.querySelectorAll('.buy-item')) {
      const id = it.dataset.buy; const def = WEAPONS[id] || GEAR[id];
      let price = def.price; if (id === 'helmet' && e.armor >= 100) price = 350;
      const wrongTeam = def.teams && def.teams !== 'both' && def.teams !== e.team;
      const owned = (def.slot && def.slot !== 4 && e.weapons[def.slot] && e.weapons[def.slot].def.id === id) || (id === 'kevlar' && e.armor >= 100) || (id === 'helmet' && e.helmet && e.armor >= 100) || (id === 'kit' && e.kit);
      it.classList.toggle('disabled', wrongTeam || e.money < price);
      it.classList.toggle('owned', !!owned);
      it.querySelector('.bi-price').textContent = '$' + price;
    }
  }
  moveCursor(dx, dy) {
    this.cursor.x = Math.max(0, Math.min(innerWidth - 1, this.cursor.x + dx));
    this.cursor.y = Math.max(0, Math.min(innerHeight - 1, this.cursor.y + dy));
    this.el.cursor.style.left = this.cursor.x + 'px'; this.el.cursor.style.top = this.cursor.y + 'px';
    const el = document.elementFromPoint(this.cursor.x, this.cursor.y);
    for (const it of this.el.buy.querySelectorAll('.hover')) it.classList.remove('hover');
    const item = el && el.closest('[data-buy],[data-close]');
    if (item) item.classList.add('hover');
  }
  buyClick() {
    const el = document.elementFromPoint(this.cursor.x, this.cursor.y);
    const item = el && el.closest('[data-buy],[data-close]');
    if (!item) return;
    if (item.dataset.close) { this.closeBuy(); return; }
    const r = this.game.buy(this.game.player, item.dataset.buy);
    this.el.buyMsg.textContent = r.ok ? '' : (r.msg || '');
    if (!r.ok) this.game.audio.play('deny');
    this.refreshBuy();
  }
  buyHotkey(n) {
    // number keys buy the Nth item in the hovered column; simple fallback: nothing
  }

  // ---------- chat / panels
  chat(e, text) {
    const row = document.createElement('div'); row.className = 'chat-row';
    row.innerHTML = `<span class="kf-${e.team}">${e.isPlayer ? t('you') : e.name}</span><span class="chat-sep">:</span><span class="chat-text">${text}</span>`;
    this.el.chat.appendChild(row);
    setTimeout(() => row.classList.add('fade'), 7000);
    setTimeout(() => row.remove(), 8000);
    while (this.el.chat.children.length > 6) this.el.chat.firstChild.remove();
  }
  chatClear() { this.el.chat.innerHTML = ''; }
  showRoundEnd(d) {
    const el = this.el.roundEnd;
    const delta = d.moneyDelta;
    el.innerHTML = `<div class="re-title ${d.won ? 'win' : 'lose'}">${d.won ? t('roundWon') : t('roundLost')}</div>
      <div class="re-reason">${d.reason}</div>
      <div class="re-row"><span class="re-label">${t('mvp')}</span><span>${d.mvp ? `<b class="kf-${d.mvp.team}">${d.mvp.isPlayer ? t('you') : d.mvp.name}</b> — ${d.mvpWhy}` : '—'}</span></div>
      <div class="re-row"><span class="re-label">${t('yourRound')}</span><span>${d.player.roundKills} ${t('kills')} · ${d.player.roundDmgGiven} dmg ${t('inHits', { n: d.player.roundHitsGiven })}</span></div>
      <div class="re-row"><span class="re-label">${t('income')}</span><span class="${delta >= 0 ? 'money-plus' : 'money-minus'}">${delta >= 0 ? '+' : ''}$${delta}</span></div>`;
    el.classList.remove('hidden');
  }
  hideRoundEnd() { this.el.roundEnd.classList.add('hidden'); }
  showDeathPanel(victim, attacker, def, hs) {
    const el = this.el.deathInfo;
    const killer = attacker && attacker !== victim ? attacker : null;
    el.innerHTML = `<div class="di-title">${killer ? `${t('killedBy')} <b class="kf-${killer.team}">${killer.name}</b>` : t('youDied')}</div>
      <div class="di-sub">${def ? def.name : ''}${hs ? ' · ' + t('headshot') : ''}${killer ? ` · ${killer.hp} ${t('hpLeft')}` : ''}</div>
      <div class="di-stats"><span>${t('dmgGiven')}: <b>${victim.roundDmgGiven}</b> ${t('inHits', { n: victim.roundHitsGiven })}</span><span>${t('dmgTaken')}: <b>${victim.roundDmgTaken}</b> ${t('inHits', { n: victim.roundHitsTaken })}</span></div>`;
    el.classList.remove('hidden');
    clearTimeout(this.deathTimer);
    this.deathTimer = setTimeout(() => el.classList.add('hidden'), 7000);
  }
  hideDeathPanel() { this.el.deathInfo.classList.add('hidden'); }
  toggleFullmap(v) {
    this.fullmapOpen = v === undefined ? !this.fullmapOpen : v;
    this.el.fullmap.classList.toggle('hidden', !this.fullmapOpen);
    if (this.fullmapOpen) { this.drawFullmap(); this.el.fullmap.querySelector('.fullmap-hint').textContent = t('mapClose'); }
  }
  drawFullmap() {
    const g = this.game, cv = this.el.fullmapCanvas, ctx = cv.getContext('2d');
    const S = this.mmScale, mapW = this.minimap.width, mapH = this.minimap.height;
    const scale = Math.min(cv.width / mapW, cv.height / mapH);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.save();
    ctx.translate((cv.width - mapW * scale) / 2, (cv.height - mapH * scale) / 2);
    ctx.scale(scale, scale);
    ctx.drawImage(this.minimap, 0, 0);
    const p = g.player;
    const dot = (x, z, color, r, ang) => {
      ctx.save(); ctx.translate(x * S, z * S); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      if (ang !== undefined) { ctx.rotate(-ang); ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -r * 2.5); ctx.stroke(); }
      ctx.restore();
    };
    const b = g.bomb;
    if (b.planted || b.dropped) { const bp = b.planted ? b.pos : b.dropped; dot(bp.x, bp.z, '#ff3030', 5); }
    for (const e of g.entities) {
      if (!e.alive) continue;
      if (e.team === p.team) dot(e.pos.x, e.pos.z, e.isPlayer ? '#ffffff' : (p.team === 'CT' ? '#6fb0ff' : '#ffcc66'), e.isPlayer ? 5 : 4, e.yaw);
      else if (e.spottedUntil > g.now) dot(e.pos.x, e.pos.z, '#ff4040', 4.5, e.yaw);
    }
    // region labels
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = `${S * 4}px sans-serif`; ctx.textAlign = 'center';
    for (const r of g.map.regions) if (!/site/.test(r.name)) ctx.fillText(r.name, (r.x0 + r.x1 + 1) / 2 * S, (r.z0 + r.z1 + 1) / 2 * S);
    ctx.restore();
  }
  prompt(text) { if (this.lastText.prompt !== text) { this.lastText.prompt = text; this.el.promptEl.textContent = text; this.el.promptEl.style.opacity = text ? 1 : 0; } }
  whiteFlash(a) { this.whiteT = performance.now() / 1000 + 0.9; this.whiteA = a; }
  moneyPopup(delta) {
    const el = document.createElement('div'); el.className = 'money-pop-item ' + (delta > 0 ? 'money-plus' : 'money-minus');
    el.textContent = (delta > 0 ? '+' : '') + '$' + delta;
    this.el.moneyPop.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }

  // ---------- messages
  announce(text, dur = 3, sub = '', kind = '') {
    this.el.announce.textContent = text; this.el.announce.className = kind;
    this.el.sub.textContent = sub || '';
    this.announceUntil = performance.now() / 1000 + dur;
    this.el.announce.style.opacity = 1; this.el.sub.style.opacity = 1;
  }
  hint(text, dur = 2) { this.el.hint.textContent = text; this.hintUntil = performance.now() / 1000 + dur; this.el.hint.style.opacity = 1; }
  progress(label, k) { this.progressT = performance.now() / 1000 + 0.15; this.el.progressLabel.textContent = label; this.el.progressFill.style.width = (Math.min(1, k) * 100) + '%'; }
  hitmarker(hs) { this.hitT = performance.now() / 1000 + 0.12; this.hitHs = hs; this.el.hitmarker.classList.toggle('hs', hs); }
  damageFrom(ang, yaw, d) {
    this.vignette = Math.min(1, this.vignette + d / 60 + 0.25);
    if (ang !== null) {
      // angle of the attacker relative to the view direction
      const rel = ang + yaw;
      const el = document.createElement('div'); el.className = 'dmg-arrow';
      el.style.transform = `translate(-50%,-50%) rotate(${rel}rad) translateY(-120px)`;
      this.el.dmgDir.appendChild(el);
      setTimeout(() => el.remove(), 700);
    }
  }
  killfeed(attacker, victim, def, hs) {
    const row = document.createElement('div'); row.className = 'kf-row';
    const a = attacker && attacker !== victim ? `<span class="kf-${attacker.team}">${attacker.name}</span>` : '';
    const w = def ? (def.id === 'bomb' ? '💣' : def.cat === 'melee' ? '🔪' : def.cat === 'fire' ? '🔥' : def.cat === 'grenade' ? '💥' : def.name) : '';
    row.innerHTML = `${a}<span class="kf-w">${w}${hs ? ' <b class="kf-hs">HS</b>' : ''}</span><span class="kf-${victim.team}">${victim.name}</span>`;
    if ((attacker && attacker.isPlayer) || victim.isPlayer) row.classList.add('kf-me');
    this.el.killfeed.appendChild(row);
    setTimeout(() => row.classList.add('fade'), 5500);
    setTimeout(() => row.remove(), 6500);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.firstChild.remove();
  }
  killfeedClear() { this.el.killfeed.innerHTML = ''; }
  onPlayerDeath(attacker, def, hs, _wall) {
    const who = attacker && attacker !== this.game.player ? `${t('killedBy')} ${attacker.name} (${def ? def.name : '?'})${hs ? ' — ' + t('headshot') : ''}` : t('youDied');
    this.announce(t('youDead'), 3, who + ' — ' + t('cycleSpec'), 'lose');
  }
  roundStart() { this.closeBuy(); this.vignette = 0; this.lastMoney = this.game.player.money; this.el.moneyPop.innerHTML = ''; }
  showScoreboard(v) { this.el.score.classList.toggle('hidden', !v); if (v) this.renderScoreboard(); }
  renderScoreboard() {
    const g = this.game, sb = g.scoreboard();
    const team = (tm, rows) => `<div class="sb-team sb-${tm}"><div class="sb-head"><span>${tm === 'CT' ? t('sbTeamCT') : t('sbTeamT')}</span><span class="sb-score">${g.score[tm]}</span></div>
      <table><tr><th>${t('sbPlayer')}</th><th>K</th><th>A</th><th>D</th><th>ADR</th><th>HS%</th><th>★</th><th>$</th></tr>
      ${rows.map(e => `<tr class="${e.alive ? '' : 'dead'} ${e.isPlayer ? 'me' : ''}"><td>${e.name}${e.hasBomb ? ' 💣' : ''}${e.kit ? ' 🧰' : ''}</td><td>${e.kills}</td><td>${e.assists}</td><td>${e.deaths}</td><td>${Math.round(e.damage / Math.max(1, g.phase === 'dm' ? 1 : g.round))}</td><td>${e.kills ? Math.round(100 * e.hsKills / e.kills) : 0}</td><td>${e.mvp || ''}</td><td>${e.team === g.player.team ? '$' + e.money : '—'}</td></tr>`).join('')}</table></div>`;
    this.el.score.innerHTML = `<div class="sb-title">${g.map.name} — ${g.phase === 'dm' ? t('dmLabel') : `${t('round')} ${g.round} — ${t('sbFirstTo', { n: g.target })}`}</div><div class="sb-cols">${team('CT', sb.CT)}${team('T', sb.T)}</div>
      <div class="sb-log">${g.roundLog.slice(-12).map(r => `<span class="rl-${r.winner}" title="${r.reason}">${r.round}</span>`).join('')}</div>`;
  }
  showMatchEnd(g) {
    const r = g.matchResult;
    const el = this.el.matchend;
    el.classList.remove('hidden');
    const me = g.player;
    const rows = g.entities.slice().sort((a, b) => b.kills - a.kills);
    el.innerHTML = `<div class="me-card"><h1 class="${r.playerWon ? 'win' : 'lose'}">${r.playerWon ? t('victory') : t('defeat')}</h1>
      <div class="me-score"><span class="ct">CT ${r.score.CT}</span> : <span class="t">${r.score.T} T</span></div>
      <div class="me-stats">${t('youStats', { k: me.kills, d: me.deaths, dmg: me.damage })}</div>
      <table>${rows.map(e => `<tr class="${e.isPlayer ? 'me' : ''}"><td class="kf-${e.team}">${e.name}</td><td>${e.kills}</td><td>${e.deaths}</td><td>${e.damage}</td></tr>`).join('')}</table>
      <button id="me-menu">${t('backMenu')}</button></div>`;
    el.querySelector('#me-menu').onclick = () => { el.classList.add('hidden'); document.dispatchEvent(new CustomEvent('backToMenu')); };
  }

  applyCrosshair(cfg) {
    const ch = this.el.crosshair;
    ch.style.setProperty('--ch-color', cfg.color);
    ch.style.setProperty('--ch-len', cfg.size + 'px');
    ch.style.setProperty('--ch-thick', cfg.thickness + 'px');
    ch.classList.toggle('dot', !!cfg.dot);
    this.chGapBase = cfg.gap;
  }

  // ---------- per-frame
  update(dt) {
    const g = this.game; if (!g || g.phase === 'menu') return;
    const p = g.player, now = performance.now() / 1000;
    const el = this.el;
    this.setText('hp', el.hp, p.alive ? p.hp : 0);
    this.setText('armor', el.armor, Math.round(p.armor));
    el.armorIcon.textContent = p.helmet ? '⛑' : '⛨';
    this.setText('money', el.money, '$' + p.money);
    if (this.lastMoney !== null && p.money !== this.lastMoney && g.isLive()) this.moneyPopup(p.money - this.lastMoney);
    this.lastMoney = p.money;
    const w = p.current;
    if (w) {
      this.setText('wname', el.weaponName, w.def.name);
      if (w.def.mag) { this.setText('mag', el.ammoMag, w.ammo); this.setText('res', el.ammoRes, w.reserve); el.ammoMag.parentElement.style.display = ''; el.ammoMag.classList.toggle('low', w.ammo <= Math.max(1, w.def.mag * 0.25)); }
      else if (w.def.cat === 'grenade') { const n = p.weapons[4].filter(x => x.def.id === w.def.id).length; this.setText('mag', el.ammoMag, n); this.setText('res', el.ammoRes, '—'); }
      else el.ammoMag.parentElement.style.display = 'none';
    }
    // timer
    let tm = g.timer;
    let cls = '';
    if (g.phase === 'freeze') cls = 'freeze';
    if (g.phase === 'planted') cls = 'planted';
    if (g.phase === 'end') tm = 0;
    this.setText('timer', el.timer, g.phase === 'planted' ? '💣' : fmtTime(tm));
    el.timerBox.className = cls;
    if (g.phase === 'dm') {
      const k = team => g.entities.filter(e => e.team === team).reduce((a, e) => a + e.kills, 0);
      this.setText('round', el.roundNum, t('dmLabel'));
      this.setText('sT', el.scoreT, k('T')); this.setText('sCT', el.scoreCT, k('CT'));
      const leader = g.entities.slice().sort((a, b) => b.kills - a.kills)[0];
      this.setText('aT', el.aliveT, p.kills); this.setText('aCT', el.aliveCT, leader ? leader.kills : 0);
      el.aliveCT.parentElement.querySelector('.vs').textContent = t('youLeader');
    } else {
      this.setText('round', el.roundNum, `${t('round')} ${g.round}`);
      el.aliveCT.parentElement.querySelector('.vs').textContent = t('alive');
      this.setText('sT', el.scoreT, g.score.T); this.setText('sCT', el.scoreCT, g.score.CT);
      this.setText('aT', el.aliveT, g.aliveCount('T')); this.setText('aCT', el.aliveCT, g.aliveCount('CT'));
    }
    el.burn.style.opacity = p.alive && p.burningUntil > g.now ? 0.55 : 0;
    // buy-time countdown
    const bt = g.phase === 'dm' ? 0 : g.buyTimeLeft();
    if (bt > 0 && g.canBuy(p)) { this.setText('bt', el.buyTime, `${t('buyTime')} ${Math.ceil(bt)}s`); el.buyTime.style.display = ''; } else el.buyTime.style.display = 'none';
    // teammates panel (every 0.25 s)
    if ((now * 4 | 0) !== this.mateTick) {
      this.mateTick = now * 4 | 0;
      const mates = g.entities.filter(e => e.team === p.team && e !== p);
      el.mates.innerHTML = mates.map(m => `<div class="mate ${m.alive ? '' : 'dead'}"><span class="mate-name">${m.name}${m.hasBomb ? ' 💣' : ''}</span><span class="mate-w">${m.alive && m.current ? m.current.def.name : ''}</span><span class="mate-hp"><i style="width:${m.alive ? m.hp : 0}%"></i></span><span class="mate-hpn">${m.alive ? m.hp : '✕'}</span></div>`).join('');
    }
    // weapon bar
    const list = g.weaponList(p);
    const key = list.map(x => x.def.id + (x === p.current ? '*' : '')).join(',');
    if (this.lastText.wbar !== key) {
      this.lastText.wbar = key;
      el.weaponbar.innerHTML = list.map(x => `<div class="wb ${x === p.current ? 'active' : ''}"><span class="wb-slot">${x.def.slot}</span>${x.def.name}</div>`).join('');
    }
    // bomb / kit icons
    el.bombIcon.style.display = p.hasBomb ? '' : 'none';
    el.kitIcon.style.display = p.kit ? '' : 'none';
    const b = g.bomb;
    if (b.planted) { const left = Math.max(0, b.explodeAt - g.now); el.bomb.textContent = `💣 BOMB PLANTED — SITE ${b.site} — ${left.toFixed(0)}s`; el.bomb.style.display = ''; el.bomb.classList.toggle('urgent', left < 10); }
    else if (b.dropped && p.team === 'T') { el.bomb.textContent = '💣 Bomb dropped'; el.bomb.style.display = ''; el.bomb.classList.remove('urgent'); }
    else el.bomb.style.display = 'none';
    // overlays
    el.announce.style.opacity = now < this.announceUntil ? 1 : 0; el.sub.style.opacity = now < this.announceUntil ? 1 : 0;
    el.hint.style.opacity = now < this.hintUntil ? 1 : 0;
    el.progress.style.opacity = now < this.progressT ? 1 : 0;
    el.hitmarker.style.opacity = now < this.hitT ? 1 : 0;
    this.vignette = Math.max(0, this.vignette - dt * 1.4);
    el.vignette.style.opacity = this.vignette * 0.85;
    // flash
    const rem = p.blindUntil - g.now;
    let fl = 0;
    if (rem > 0) { const hold = p.flashDur * 0.45; fl = rem > p.flashDur - hold ? 1 : Math.min(1, rem / (p.flashDur - hold)); }
    if (this.whiteT > now) fl = Math.max(fl, this.whiteA * Math.min(1, (this.whiteT - now) / 0.6));
    el.flash.style.opacity = fl;
    // scope
    const scoped = p.alive && w && w.def.scope && w.scoped;
    el.scope.classList.toggle('hidden', !scoped);
    el.crosshair.classList.toggle('hidden', scoped || !p.alive);
    if (p.alive && w && w.def.spread) {
      const spr = currentSpread(p, w);
      const gap = (this.chGapBase ?? 4) + spr * 7;
      el.crosshair.style.setProperty('--gap', gap + 'px');
    }
    // spectating
    const c = g.controller;
    if (!p.alive) {
      const st = c.specTarget;
      this.setText('spec', el.spec, st ? `${t('spectating')} ${st.name} — ${st.current ? st.current.def.name : ''} — ${st.hp} HP` : t('freeCam'));
      el.spec.style.opacity = 1;
    } else el.spec.style.opacity = 0;
    el.deathPanel.classList.toggle('hidden', p.alive);
    if (this.buyOpen) this.refreshBuy();
    if (!el.score.classList.contains('hidden') && (now * 2 | 0) !== this.sbTick) { this.sbTick = now * 2 | 0; this.renderScoreboard(); }
    if (this.fullmapOpen) this.drawFullmap(); else this.drawRadar();
  }
}
