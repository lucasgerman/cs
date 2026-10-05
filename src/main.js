// Entry point: renderer, menus, pointer lock, main loop.
import * as THREE from '../vendor/three.module.min.js';
import { Game } from './game.js';
import { HUD } from './hud.js';
import { Input } from './input.js';
import { AudioManager } from './audio.js';
import { ViewModel } from './viewmodel.js';
import { PlayerController } from './player.js';
import { DIFFICULTY } from './config.js';

const $ = id => document.getElementById(id);

const settings = {
  team: 'T', difficulty: 'normal', botsPerTeam: 5, sensitivity: 2.0, volume: 0.7, fov: 74, playerName: 'Player', mode: 'competitive',
};
try { Object.assign(settings, JSON.parse(localStorage.getItem('cs2web-settings') || '{}')); } catch (e) { /* ignore */ }
const saveSettings = () => { try { localStorage.setItem('cs2web-settings', JSON.stringify(settings)); } catch (e) { /* ignore */ } };

const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.autoClear = false;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(settings.fov, innerWidth / innerHeight, 0.05, 400);
const audio = new AudioManager();
const hud = new HUD();
const viewModel = new ViewModel();
viewModel.setAspect(innerWidth / innerHeight);
const input = new Input();
const game = new Game({ scene, camera, audio, hud, viewModel, settings });
hud.attach(game);
const controller = new PlayerController(game, input);
window.__DIFF = DIFFICULTY;
window.__cs = { game, input, controller, hud, settings, camera, renderer, setUI: v => { ui = v; }, getUI: () => ui };

// Initial camera: overview of the map for the menu background
camera.position.set(60, 60, 150); camera.lookAt(60, 0, 70);

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  viewModel.setAspect(innerWidth / innerHeight);
});

// ---------- UI state
let ui = 'menu'; // menu | play | pause
const menu = $('menu'), pause = $('pause');

function applyMenuSettings() {
  settings.team = document.querySelector('input[name=team]:checked').value;
  settings.mode = document.querySelector('input[name=mode]:checked').value;
  settings.difficulty = document.querySelector('input[name=difficulty]:checked').value;
  settings.botsPerTeam = parseInt($('opt-bots').value, 10);
  settings.sensitivity = parseFloat($('opt-sens').value);
  settings.volume = parseFloat($('opt-vol').value);
  settings.fov = parseInt($('opt-fov').value, 10);
  settings.playerName = ($('opt-name').value || 'Player').slice(0, 14);
  saveSettings();
}
function fillMenu() {
  document.querySelector(`input[name=team][value=${settings.team}]`).checked = true;
  (document.querySelector(`input[name=mode][value=${settings.mode}]`) || document.querySelector('input[name=mode]')).checked = true;
  document.querySelector(`input[name=difficulty][value=${settings.difficulty}]`).checked = true;
  $('opt-bots').value = settings.botsPerTeam;
  $('opt-sens').value = settings.sensitivity; $('opt-sens-v').textContent = settings.sensitivity.toFixed(2);
  $('opt-vol').value = settings.volume; $('opt-vol-v').textContent = Math.round(settings.volume * 100) + '%';
  $('opt-fov').value = settings.fov; $('opt-fov-v').textContent = settings.fov;
  $('opt-name').value = settings.playerName;
}
fillMenu();
$('opt-sens').oninput = e => { $('opt-sens-v').textContent = parseFloat(e.target.value).toFixed(2); settings.sensitivity = parseFloat(e.target.value); };
$('opt-vol').oninput = e => { $('opt-vol-v').textContent = Math.round(e.target.value * 100) + '%'; settings.volume = parseFloat(e.target.value); audio.setVolume(settings.volume); };
$('opt-fov').oninput = e => { $('opt-fov-v').textContent = e.target.value; settings.fov = parseInt(e.target.value, 10); };
$('p-sens').oninput = e => { settings.sensitivity = parseFloat(e.target.value); $('p-sens-v').textContent = settings.sensitivity.toFixed(2); saveSettings(); };
$('p-vol').oninput = e => { settings.volume = parseFloat(e.target.value); $('p-vol-v').textContent = Math.round(settings.volume * 100) + '%'; audio.setVolume(settings.volume); saveSettings(); };

function requestLock() {
  audio.init(); audio.resume();
  if (document.pointerLockElement !== canvas) {
    const p = canvas.requestPointerLock({ unadjustedMovement: true });
    if (p && p.catch) p.catch(() => canvas.requestPointerLock());
  }
}

$('btn-play').onclick = () => {
  applyMenuSettings();
  audio.init(); audio.setVolume(settings.volume);
  menu.classList.add('hidden');
  $('hud').classList.remove('hidden');
  game.startMatch(controller);
  ui = 'play';
  requestLock();
};
$('btn-resume').onclick = () => { requestLock(); };
$('btn-quit').onclick = () => { backToMenu(); };
document.addEventListener('backToMenu', backToMenu);
function backToMenu() {
  ui = 'menu';
  game.phase = 'menu';
  pause.classList.add('hidden'); $('hud').classList.add('hidden'); $('matchend').classList.add('hidden');
  menu.classList.remove('hidden');
  hud.closeBuy(); hud.showScoreboard(false); hud.toggleFullmap(false); hud.hideRoundEnd(); hud.hideDeathPanel();
  if (document.pointerLockElement === canvas) document.exitPointerLock();
  camera.position.set(60, 60, 150); camera.lookAt(60, 0, 70); camera.fov = settings.fov; camera.updateProjectionMatrix();
}

document.addEventListener('pointerlockchange', () => {
  input.locked = document.pointerLockElement === canvas;
  if (input.locked) { ui = 'play'; pause.classList.add('hidden'); }
  else if (ui === 'play') { ui = 'pause'; pause.classList.remove('hidden'); hud.closeBuy(); hud.showScoreboard(false); $('p-sens').value = settings.sensitivity; $('p-sens-v').textContent = settings.sensitivity.toFixed(2); $('p-vol').value = settings.volume; $('p-vol-v').textContent = Math.round(settings.volume * 100) + '%'; }
});
document.addEventListener('pointerlockerror', () => { if (ui !== 'menu') { ui = 'pause'; pause.classList.remove('hidden'); } });
canvas.addEventListener('click', () => { if (ui === 'pause') requestLock(); });

input.onLook = (dx, dy) => {
  if (ui !== 'play') return;
  if (hud.buyOpen) { hud.moveCursor(dx, dy); return; }
  controller.look(dx, dy);
};
input.onMouseDown = (btn) => {
  if (hud.buyOpen && btn === 0) hud.buyClick();
};
input.onKey = (code, e) => {
  if (ui !== 'play') return;
  if (code === 'KeyB') hud.toggleBuy();
  if (code === 'Tab') hud.showScoreboard(true);
  if (code === 'KeyM') hud.toggleFullmap();
};
window.addEventListener('keyup', e => { if (e.code === 'Tab') hud.showScoreboard(false); });

// ---------- main loop
let last = performance.now();
let fpsT = 0, frames = 0;
function loop(t) {
  requestAnimationFrame(loop);
  let dt = (t - last) / 1000; last = t;
  if (dt > 0.05) dt = 0.05;
  if (ui === 'play' || ui === 'pause') {
    // When paused (pointer unlocked) keep simulating so bots play on, like a real server
    const inputBlocked = ui === 'pause' || hud.buyOpen;
    if (inputBlocked) { input.keys.clear(); input.mouse = [false, false, false]; }
    game.update(dt);
    controller.updateCamera(camera);
    hud.update(dt);
  } else {
    // slow orbit for the menu background
    const a = t * 0.00005;
    camera.position.set(60 + Math.cos(a) * 90, 55, 70 + Math.sin(a) * 90); camera.lookAt(60, 0, 70);
    game.effects.update(dt, game.now);
  }
  renderer.clear();
  renderer.render(scene, camera);
  if (ui !== 'menu' && game.player && game.player.alive) {
    const e = game.player, w = e.current;
    const moving = Math.hypot(e.vel.x, e.vel.z) > 0.5;
    viewModel.update(dt, {
      moving, walking: e.walking, onGround: e.onGround, crouch: e.crouch,
      reloading: w && w.reloadEnd > game.now, reloadK: w && w.reloadEnd > game.now ? (game.now - w.reloadStart) / (w.reloadEnd - w.reloadStart) : 0,
      scoped: w && w.def.scope && w.scoped, mouseDX: controller.mouseDX, mouseDY: controller.mouseDY,
    });
    controller.mouseDX = controller.mouseDY = 0;
    viewModel.render(renderer);
  }
  input.endFrame();
  frames++; fpsT += dt;
  if (fpsT > 1) { $('fps').textContent = frames + ' fps'; frames = 0; fpsT = 0; }
}
requestAnimationFrame(loop);
