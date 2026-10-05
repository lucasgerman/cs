# Counter-Strike 2 — Browser Edition

A playable Counter-Strike 2 style tactical shooter that runs entirely in the browser.
No build step, no external assets: Three.js renders a Dust II–inspired bomb-defusal map,
all textures and sounds are generated procedurally at runtime.

## Run it

Any static file server works (ES modules need `http://`, not `file://`):

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000> and click **PLAY**.

## What's in the game

- **Competitive bomb defusal (MR12)** — first to 13 rounds, side swap at halftime, MR3 overtime, 10 s freeze time, 1:55 rounds, 40 s bomb timer, 10 s / 5 s defuse (with kit).
- **Economy** — $800 start, kill rewards per weapon class, win/loss bonuses with loss streaks, plant bonus, $16k cap.
- **Buy menu (B)** — pistols (Glock, USP-S, P250, Five-SeveN, Tec-9, Desert Eagle), SMGs (MAC-10, MP9, UMP-45), Nova, rifles (Galil, FAMAS, AK-47, M4A4), AWP with scope, HE / flash / smoke grenades, kevlar, helmet, defuse kit. Team-restricted weapons like in CS2.
- **Gunplay** — spray patterns with recoil recovery, movement/jump/crouch inaccuracy, damage falloff, armor penetration, head/body/leg hitboxes, knife backstabs, tracers, impact decals, muzzle flashes.
- **Grenades** — bouncing physics, HE splash damage with line-of-sight, flashbangs that blind players and bots based on view angle, smokes that block bot vision.
- **Bots** — 5v5 with A* pathfinding, team strategies (site rush / split, holds, rotations, retakes), reaction time & aim settling that scale with difficulty, bomb planting/defusing, weapon pickups, economy-aware buying.
- **HUD** — rotating radar with spotted enemies, kill feed, scoreboard (Tab), dynamic crosshair, hit markers, damage direction indicators, bomb status, buy menu, spectator mode after death.
- **Movement** — Source-style ground friction / acceleration with air-strafing, walking (Shift), crouching, jumping onto crates.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Shift / Ctrl / Space | Walk / crouch / jump |
| Mouse 1 / Mouse 2 | Fire / scope (AWP), heavy knife stab, underhand throw |
| R | Reload |
| 1 2 3 4, wheel, Q | Switch weapons |
| B | Buy menu (freeze time + first 20 s of the round, in spawn) |
| E | Plant (in a bomb site) / defuse / pick up weapon |
| G | Drop weapon |
| Tab | Scoreboard |
| Esc | Pause (the match keeps running) |

## Project layout

```
index.html        HUD/menu markup
style.css         HUD styling
vendor/           three.js (MIT)
src/main.js       renderer, menus, pointer lock, main loop
src/game.js       rounds, economy, combat, bomb, buying, pickups
src/mapdata.js    Dust II-style layout on a 1 m grid
src/physics.js    heightfield collision, raycasts, hitboxes, A* nav grid
src/world.js      procedural textures and merged map meshes
src/weapons.js    weapon stats, spray patterns, spread
src/player.js     first-person controller & camera
src/bots.js       bot AI and team plans
src/grenades.js   HE / flash / smoke
src/viewmodel.js  first-person weapon models
src/entities.js   humanoid bot models & animation
src/effects.js    tracers, decals, explosions, smoke
src/hud.js        HUD, radar, buy menu, scoreboard
src/audio.js      procedural WebAudio sound effects
```
