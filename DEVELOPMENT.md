# Development Log — Project Hotel

Status: **first playable milestone (Phases 1–7)**. Single-player against bots is complete and playable
from the main menu through a match to the results screen, with persistent progression.

## Architecture

```
src/
  core/        math, seeded RNG, tiny event bus (no Phaser)
  data/        weapons, skills, difficulty, missions/contracts — pure data tables
  sim/         the game simulation (no Phaser, no DOM): runs in a browser or on a server
    hotelLayout.ts   hand-authored floor plan: rooms, doors, furniture, lights, spawns, routes
    map.ts           tile grid, opacity, furniture index, DDA ray casts, collision, static light grid
    nav.ts           A* on the walkable grid with path smoothing
    world.ts         authoritative match state: actors, weapons, aim, stealth, pickups, hostages, rules
    ai/bot.ts        bot brain: perception (sight, light, sound), roles and combat; outputs InputCommands
    types.ts         Actor, InputCommand (the future network message), SimEvent, MatchState
  render/      Phaser presentation: procedural textures, furniture art, baked map, lighting, views, FX
  audio/       spatial playback of the local WAV assets with volume channels
  progression/ LocalStorage-backed settings and profile (coins, skills, career stats, contracts)
  scenes/      BootScene (assets) and GameScene (glues the sim to rendering, audio, input and HUD)
  ui/          HTML/CSS interface: main menu, HUD, pause, scoreboard, results
tests/         headless simulation tests (npm test)
scripts/       audio synthesizer, test runner
```

Key rules of the architecture:

- The **simulation never imports Phaser**. `World.step(dt, inputs)` advances the match in fixed 1/60 s steps
  from a map of `InputCommand`s, and the presentation reads state and drains `SimEvent`s
  (shots, damage, deaths, pickups, stealth changes…) to drive animation, effects, audio and HUD.
- **Bots are controllers, not special cases.** A `BotBrain` produces the same `InputCommand` a keyboard does,
  and bots perceive the world through the same visibility rules that apply to players.
- **Deterministic RNG** (`core/rng.ts`) is seeded per match so a server can reproduce a match.

### Deviation from the brief: Arcade Physics

The brief asked for Arcade Physics. Collision is instead a small circle-vs-tile/rectangle resolver in
`sim/map.ts`. Arcade Physics lives inside a Phaser scene, which would tie gameplay to the renderer and
prevent the same simulation from running on a headless multiplayer server. The custom resolver gives the
same behaviour (sliding along walls and furniture, no tunnelling thanks to sub-stepping) and is fully tested.

## Completed features

### Phase 1 — Foundation
- Vite + TypeScript + Phaser 3 project, offline (fonts bundled via @fontsource, all assets local).
- 112×76-tile hotel ground floor: main lobby, reception, back office, main corridor, restaurant, private dining,
  kitchen with walk-in freezer, grand ballroom with stage, two storage rooms, staff room, security office,
  lounge bar, service corridor and entrance. 27 doorways give loops and alternative routes.
- Carpets almost everywhere: burgundy damask, deep red lattice, dark blue medallion and a corridor runner, all
  with ornate gold borders; tiled kitchen, utility carpet in service areas, marble entrance.
- Furniture illustrated procedurally with shading: sofas, armchairs, coffee tables, dining and banquet tables with
  place settings, booths, plants, fountain, reception desk, bar with stools, kitchen counters, stoves, sinks,
  fridges, shelving, crates, desks with monitors, security monitor wall, lockers, grand pianos, stage, rugs,
  parquet dance floor, luggage and laundry carts, consoles, benches, safe, server racks, vending machine.
  Wall décor: paintings, mirrors, elevators marked out of service, sconces, exit signs, revolving doors, closed stairs.
- Collision for walls and furniture (round tables/fountain use circular collision); smooth camera with look-ahead.
- Flashlights for every character and the darkness system (see Lighting).
- Bots that patrol.

### Lighting and visibility
- Screen-space light map drawn with Canvas2D each frame and composited with MULTIPLY blending.
- Every flashlight is clipped by a visibility polygon ray-cast against walls and tall furniture → real shadows.
- Smooth radial and angular falloff, soft edges (half-resolution light map + blur on High quality),
  dark blue-grey ambient, warm static hotel lights baked once with shadows, muzzle flashes light the room.
- Enemies are only drawn when in the player's line of sight; their beams remain visible around corners.
- The same light model drives gameplay: `World.lightAt()` combines baked static light with live flashlight cones.

### Phase 2 — Combat
- Signature aiming: a visible firing line toward the mouse with a crosshair that glides along it.
  Enemies entering the line corridor progressively attract the crosshair (never instant); lock speed depends on
  weapon, distance, movement and the weapon's Target Acquisition skill. Recoil kicks the crosshair off the line and
  costs lock; recovery brings it back. The ring shows spread; an arc shows lock progress; brackets mark the target.
- Walls and cover stop the line and the crosshair; aim attraction ignores enemies that bullets cannot reach.
- Four weapons with distinct handling (damage, falloff, rate, recoil, recovery, spread, bloom, lock speed/width,
  lock loss, glide, noise radius):
  - Standard pistol (.45 ACP, semi, 8-round magazine, **5 hits** to kill, spawns with **exactly 5 rounds**)
  - MP5 (9mm, 800 rpm, strong close range with falloff)
  - M4 Carbine (5.56mm, 700 rpm, accurate at range)
  - Desert Eagle (.50 AE, **2 hits** to kill, extreme recoil, slow follow-ups)
- Hitscan bullets with tracers, muzzle flash, shell ejection, wall sparks/dust, blood, armor sparks.
- Reloading with animation (weapon tilt, magazine out/in) and three-stage reload sounds.

### Phase 3 — Stealth and AI
- Automatic stealth: stand still in a dark, enclosed spot with no movement/aim/fire input → flashlight switches off,
  character crouches and darkens, blue concealment glow, HUD eye indicator. Broken by moving, aiming, shooting,
  turning the light on or taking damage; the flashlight returns to its previous state.
- Visibility model: field of view, line of sight, lighting at the target (static + all beams), own flashlight,
  muzzle flash, distance, movement speed, hiding and Concealment skill. Bots accumulate a detection meter over time
  (no instant spotting), shown above them as `?` (suspicious) and `!` (engaged).
- Bot states: patrol, guard (protect hostages), assault (search for hostages), investigate, attack, cover, search,
  rescue, escort, scavenge. Bots react to gunshots, footsteps, impacts and teammate call-outs, notice dead teammates,
  navigate with A*, take cover when hurt or reloading, strafe, fire in bursts, and go to the last known position.
- Easy / Normal / Hard change enemy count, reaction time, aim error, turn rate, detection rate and hearing.

### Phase 4 — Gameplay
- Health and armor (armor absorbs 60% of incoming damage). Armor plates: +50 each, limited capacity,
  ~2.2 s application animation that blocks firing and slows movement.
- Weapon pickups (10–30 rounds, respecting magazine capacity); swapping drops your current weapon with its magazine.
- Enemy weapon drops keep exactly the ammunition the enemy had left.
- Ammo crates at randomized predefined locations: two magazines for the equipped caliber, tracked separately
  per caliber so primary and sidearm ammo are collected independently. Reserve ammo is tracked by caliber.
- Teams: Anti-Terrorist and Hostage Guards, playable from either side with 0–3 AI teammates.
- Three hostages at randomized locations; hold E to free, they follow you (with path-finding) to the entrance.
- Objectives, 8-minute timer, win/lose: all hostages rescued or all guards down (AT); strike team down or time
  expired (Guards). Spectating allies after death.

### Phase 5 — Progression
- Coins: +5 per eliminated enemy (collected from the coin they drop, with magnet and animation),
  +15 for a completed mission (match win), +15 per one-time contract (11 contracts).
- Persistent skill tree (LocalStorage): weapon mastery per weapon (Target Acquisition, Recoil Control, Recovery,
  Steady Hands), stealth mastery (Shadow Step, Concealment, Quiet Feet, Night Adapted), general abilities
  (Conditioning, Plate Drills, Weapon Handling, Plate Carrier). Each has cost, levels, description, unlock
  animation and a real effect via `computeSkillMods`.
- Career statistics, rank/XP, match history, editable callsign.

### Phase 6 — Presentation
- Main menu over a live, slowly panning view of the hotel with patrolling guards: Deploy, Loadout, Skills,
  Missions, Profile, Settings.
- HUD: health, armor, plates, stealth state, location, weapon art, magazine/reserve, caliber, slots, objective,
  hostage pips, hostiles remaining, timer, coins, kill feed, interaction prompt with hold progress, notices,
  directional damage indicators, hit markers, low-health vignette, briefing card and end-of-match banner.
- Animations: continuous 360° walking (lower body follows movement, upper body follows aim), running lean,
  aiming, firing recoil, reload, swap, plate application, damage flash, death fall with spreading pool,
  pickup collection, coin spin, flashlight lens flash, stealth crouch, skill unlock, results count-up.
- Audio (36 synthesized WAVs): hotel ambience loop with distant piano, carpet and tile footsteps, four gunshots,
  reload parts, impacts, flashlight clicks, pickups, coins, armor, detection stinger, mission complete/fail, UI.
  Spatial attenuation and panning; master / effects / ambience / interface volume.

### Phase 7 — Testing and polish
- `npm test` runs 45+ gameplay assertions (`tests/mechanics-test.ts`) and full bot-vs-bot matches on every
  difficulty and side (`tests/sim-test.ts`), plus map connectivity checks for every room and spawn point.
- Playwright sessions were used to drive the real game: menu panels, deploying, combat, pickups, stealth,
  hostages, scoreboard, pause/resume, results and skill purchase, at 1440×900 and 1366×768.

## Screenshots

See `docs/screenshots/` (captured from the running game).

## Performance

Measured in the dev build with the F3 overlay (CPU time per frame): simulation ≈ 0.3 ms, views ≈ 0.4 ms,
lighting ≈ 1 ms with 10+ beams. Bot perception runs at 10 Hz; static lights are baked once; the map is baked into
1024 px chunks; particles and decals are pooled. The test machine has no GPU (software WebGL), so the
real frame rate on laptop hardware has not been measured here. On weaker GPUs, set
Settings → Lighting quality → Performance.

## Known issues and limitations

- **Frame rate not verified on real GPU hardware** (see above).
- Audio is synthesized procedurally. It is functional and consistent but not studio-recorded, and it could not be
  listened to in the headless test environment.
- Characters are procedurally illustrated rotating top-down sprites with procedural animation (continuous
  direction) rather than hand-drawn 8-direction frame sheets. The asset system (`render/textures.ts`) can be
  replaced with image files later.
- Bots only scavenge when completely out of ammunition (nearest weapon or crate); they never pick up armor plates.
- AI teammates act independently (they sweep the hotel for hostages); there are no squad commands.
- Hostages cannot be harmed; friendly fire is off.
- No respawning within a match; one map.
- Abandoning a match from the pause menu does not record anything or award coins (intentional).

## Remaining tasks / next steps

1. Measure and tune frame rate on a range of laptop GPUs; consider a WebGL shader light pass if needed.
2. Replace procedural sprites with commissioned art using the same texture keys.
3. Smarter bot looting (upgrading weapons, plates); squad commands for AI teammates.
4. Additional maps (upper-floor variants) and modes.
5. Online multiplayer (see `NETWORKING.md`).
6. Gamepad support and key rebinding.
