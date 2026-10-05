// Minimal localization: English and Spanish.
const DICT = {
  en: {
    round: 'Round', secondHalf: ' — Second half', pressB: 'Press B to buy equipment', carryBomb: 'You carry the bomb. Press B to buy.',
    go: 'GO!', roundWon: 'ROUND WON', roundLost: 'ROUND LOST', halftime: 'HALFTIME — Switching sides', overtime: 'OVERTIME', firstTo: 'First to {n}',
    bombPlanted: 'The bomb has been planted', siteSeconds: 'Site {s} — 40 seconds', bombDropped: 'The bomb has been dropped', pickedBomb: 'You picked up the bomb',
    plantHint: 'You must be inside a bomb site (A or B) to plant', buyHint: 'You can only buy in your spawn zone during buy time',
    planting: 'Planting the bomb', defusing: 'Defusing the bomb', defusingKit: 'Defusing (kit)',
    youDead: 'YOU ARE DEAD', killedBy: 'Killed by', headshot: 'headshot', cycleSpec: 'click to cycle spectator targets', youDied: 'You died',
    spectating: 'Spectating', freeCam: 'Free camera — WASD to fly, click to follow a teammate', hpLeft: 'HP left',
    dmgGiven: 'Damage given', dmgTaken: 'Damage taken', inHits: 'in {n} hits', mvp: 'MVP', yourRound: 'Your round', income: 'Income', kills: 'kills',
    deathmatch: 'DEATHMATCH', dmSub: 'Most kills in 10 minutes wins. Buy anywhere with B.', dmLabel: 'Deathmatch', youLeader: 'you / leader', alive: 'alive',
    ctWinElim: 'Counter-Terrorists win — Terrorists eliminated', tWinElim: 'Terrorists win — Counter-Terrorists eliminated', ctWinTime: 'Counter-Terrorists win — Time ran out',
    ctWinDefuse: 'Counter-Terrorists win — Bomb defused', tWinBomb: 'Terrorists win — Target bombed',
    buyMenu: 'BUY MENU', close: 'Close (B)', notNow: 'Cannot buy now', notTeam: 'Not available for your team', haveArmor: 'Already have armor', haveHelmet: 'Already have helmet',
    haveKit: 'Already have a kit', noMoney: 'Not enough money', maxNade: 'Already carrying max', nadeFull: 'Grenade slots full', ownWeapon: 'Already own this weapon',
    pickup: 'Press E to pick up {w}', plantPrompt: 'Hold E to plant the bomb', defusePrompt: 'Hold E to defuse the bomb',
    victory: 'VICTORY', defeat: 'DEFEAT', backMenu: 'Back to menu', youStats: 'You: {k} kills / {d} deaths — {dmg} damage',
    sbPlayer: 'Player', sbTeamCT: 'Counter-Terrorists', sbTeamT: 'Terrorists', sbFirstTo: 'first to {n}', mapClose: 'M to close',
    planting2: 'Planting', paused: 'PAUSED', pausedSub: 'The match keeps running while the menu is open.',
    // bot chat
    cEnemyAt: 'Enemy spotted at {r}', cEnemyDown: 'Enemy down', cHsDown: 'Headshot! Enemy down', cDownAt: '{n} is down at {r}', cLetsGo: "Let's go {s}", cHold: "I'll hold {s}",
    cPlanted: 'Bomb planted at {s}', cDefused: 'Bomb defused!', cGoAll: 'Everyone go {s}!', cRotate: 'Rotate to {s}!', cRoger: 'Roger that', cMoving: 'Moving to {s}',
    cHoldPos: 'Hold your positions', cFollow: 'Follow me', cContact: 'Contact at {r}', cClear: '{r} is clear', you: 'You',
  },
  es: {
    round: 'Ronda', secondHalf: ' — Segunda mitad', pressB: 'Pulsa B para comprar equipo', carryBomb: 'Llevas la bomba. Pulsa B para comprar.',
    go: '¡VAMOS!', roundWon: 'RONDA GANADA', roundLost: 'RONDA PERDIDA', halftime: 'DESCANSO — Cambio de bando', overtime: 'PRÓRROGA', firstTo: 'Primero a {n}',
    bombPlanted: 'La bomba ha sido plantada', siteSeconds: 'Sitio {s} — 40 segundos', bombDropped: 'La bomba ha caído al suelo', pickedBomb: 'Has recogido la bomba',
    plantHint: 'Debes estar dentro de un sitio de bomba (A o B) para plantar', buyHint: 'Solo puedes comprar en tu zona de aparición durante el tiempo de compra',
    planting: 'Plantando la bomba', defusing: 'Desactivando la bomba', defusingKit: 'Desactivando (kit)',
    youDead: 'HAS MUERTO', killedBy: 'Te mató', headshot: 'disparo a la cabeza', cycleSpec: 'clic para cambiar de espectador', youDied: 'Has muerto',
    spectating: 'Espectando a', freeCam: 'Cámara libre — WASD para volar, clic para seguir a un compañero', hpLeft: 'HP restantes',
    dmgGiven: 'Daño causado', dmgTaken: 'Daño recibido', inHits: 'en {n} impactos', mvp: 'MVP', yourRound: 'Tu ronda', income: 'Ingresos', kills: 'bajas',
    deathmatch: 'DEATHMATCH', dmSub: 'Gana quien más bajas haga en 10 minutos. Compra donde quieras con B.', dmLabel: 'Deathmatch', youLeader: 'tú / líder', alive: 'vivos',
    ctWinElim: 'Ganan los Antiterroristas — Terroristas eliminados', tWinElim: 'Ganan los Terroristas — Antiterroristas eliminados', ctWinTime: 'Ganan los Antiterroristas — Se acabó el tiempo',
    ctWinDefuse: 'Ganan los Antiterroristas — Bomba desactivada', tWinBomb: 'Ganan los Terroristas — Objetivo bombardeado',
    buyMenu: 'MENÚ DE COMPRA', close: 'Cerrar (B)', notNow: 'No puedes comprar ahora', notTeam: 'No disponible para tu equipo', haveArmor: 'Ya tienes chaleco', haveHelmet: 'Ya tienes casco',
    haveKit: 'Ya tienes kit', noMoney: 'Dinero insuficiente', maxNade: 'Ya llevas el máximo', nadeFull: 'Huecos de granada llenos', ownWeapon: 'Ya tienes esta arma',
    pickup: 'Pulsa E para recoger {w}', plantPrompt: 'Mantén E para plantar la bomba', defusePrompt: 'Mantén E para desactivar la bomba',
    victory: 'VICTORIA', defeat: 'DERROTA', backMenu: 'Volver al menú', youStats: 'Tú: {k} bajas / {d} muertes — {dmg} de daño',
    sbPlayer: 'Jugador', sbTeamCT: 'Antiterroristas', sbTeamT: 'Terroristas', sbFirstTo: 'primero a {n}', mapClose: 'M para cerrar',
    planting2: 'Plantando', paused: 'PAUSA', pausedSub: 'La partida sigue mientras el menú está abierto.',
    cEnemyAt: 'Enemigo visto en {r}', cEnemyDown: 'Enemigo abatido', cHsDown: '¡A la cabeza! Enemigo abatido', cDownAt: '{n} ha caído en {r}', cLetsGo: 'Vamos a {s}', cHold: 'Yo cubro {s}',
    cPlanted: 'Bomba plantada en {s}', cDefused: '¡Bomba desactivada!', cGoAll: '¡Todos a {s}!', cRotate: '¡Rotad a {s}!', cRoger: 'Recibido', cMoving: 'Voy hacia {s}',
    cHoldPos: 'Mantened posiciones', cFollow: 'Seguidme', cContact: 'Contacto en {r}', cClear: '{r} despejado', you: 'Tú',
  },
};

// Menu / static HTML strings keyed by data-i18n attribute.
const STATIC = {
  en: {
    name: 'Your name', mode: 'Game mode', team: 'Team', difficulty: 'Bot difficulty', players: 'Players per team', sens: 'Mouse sensitivity', volume: 'Volume', fov: 'Field of view',
    language: 'Language', graphics: 'Graphics quality', play: 'PLAY — Dust II', teamT: 'Terrorists', teamCT: 'Counter-Terrorists', random: 'Random', easy: 'Easy', normal: 'Normal', hard: 'Hard',
    modeComp: 'Competitive MR12', modeShort: 'Short MR8', modeDM: 'Deathmatch', gLow: 'Low', gMed: 'Medium', gHigh: 'High',
    c1: '<b>WASD</b> move · <b>Shift</b> walk · <b>Ctrl</b> crouch · <b>Space</b> jump',
    c2: '<b>Mouse</b> aim/fire · <b>RMB</b> scope / underhand throw · <b>R</b> reload · <b>Wheel/1-5/Q</b> weapons',
    c3: '<b>B</b> buy menu · <b>E</b> plant / defuse / pick up · <b>G</b> drop · <b>Tab</b> scoreboard · <b>M</b> map · <b>Esc</b> pause',
    c4: '<b>Z</b> go A · <b>X</b> go B · <b>V</b> hold · <b>T</b> follow me · <b>Y</b> report in (radio commands to bots)',
    c5: 'Competitive · MR12 (first to 13) · 5v5 vs bots · buy time 20s · bomb 40s',
    paused: 'PAUSED', pausedSub: 'The match keeps running while the menu is open.', resume: 'Resume (click)', quit: 'Quit to menu', sensitivity: 'Sensitivity',
  },
  es: {
    name: 'Tu nombre', mode: 'Modo de juego', team: 'Equipo', difficulty: 'Dificultad de los bots', players: 'Jugadores por equipo', sens: 'Sensibilidad del ratón', volume: 'Volumen', fov: 'Campo de visión',
    language: 'Idioma', graphics: 'Calidad gráfica', play: 'JUGAR — Dust II', teamT: 'Terroristas', teamCT: 'Antiterroristas', random: 'Aleatorio', easy: 'Fácil', normal: 'Normal', hard: 'Difícil',
    modeComp: 'Competitivo MR12', modeShort: 'Corto MR8', modeDM: 'Deathmatch', gLow: 'Baja', gMed: 'Media', gHigh: 'Alta',
    c1: '<b>WASD</b> moverse · <b>Shift</b> caminar · <b>Ctrl</b> agacharse · <b>Espacio</b> saltar',
    c2: '<b>Ratón</b> apuntar/disparar · <b>Clic der.</b> mira / lanzamiento suave · <b>R</b> recargar · <b>Rueda/1-5/Q</b> armas',
    c3: '<b>B</b> comprar · <b>E</b> plantar / desactivar / recoger · <b>G</b> soltar · <b>Tab</b> marcador · <b>M</b> mapa · <b>Esc</b> pausa',
    c4: '<b>Z</b> ir a A · <b>X</b> ir a B · <b>V</b> mantener · <b>T</b> seguidme · <b>Y</b> informar (órdenes por radio a los bots)',
    c5: 'Competitivo · MR12 (primero a 13) · 5c5 contra bots · compra 20 s · bomba 40 s',
    paused: 'PAUSA', pausedSub: 'La partida sigue mientras el menú está abierto.', resume: 'Continuar (clic)', quit: 'Salir al menú', sensitivity: 'Sensibilidad',
  },
};

let lang = 'en';
export function setLang(l) { lang = DICT[l] ? l : 'en'; applyStatic(); }
export function getLang() { return lang; }
export function t(key, vars) {
  let s = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
  if (vars) for (const k of Object.keys(vars)) s = s.replace('{' + k + '}', vars[k]);
  return s;
}
export function applyStatic() {
  const d = STATIC[lang] || STATIC.en;
  for (const el of document.querySelectorAll('[data-i18n]')) {
    const k = el.dataset.i18n;
    if (d[k] !== undefined) el.innerHTML = d[k];
  }
}
