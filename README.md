# Project Hotel

A 2D top-down tactical shooter set on the darkened ground floor of a luxury hotel.
Find and rescue three hostages (Anti-Terrorist) or hold them against a strike team (Hostage Guards),
using flashlights, darkness, automatic stealth and a gliding crosshair that attracts onto targets.

Built with Phaser 3, TypeScript and Vite. Everything runs locally and offline: all graphics are
illustrated procedurally at load time, and all audio is synthesized into WAV files in `public/audio`.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5173 in a desktop browser (Chrome, Edge or Firefox).

Other scripts:

| Command | What it does |
| --- | --- |
| `npm run build` | Type-checks and builds a static bundle into `dist/` (open with `npm run preview`) |
| `npm test` | Runs the headless simulation and gameplay-rule tests (no browser needed) |
| `npm run gen:audio` | Re-synthesizes every sound effect into `public/audio/*.wav` |

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Shift | Run (louder footsteps) |
| Mouse | Aim — the firing line follows the mouse |
| Space | Fire |
| E | Interact: pick up weapons, take ammo from crates, hold to free hostages |
| R | Reload |
| 1 / 2 | Primary / sidearm (mouse wheel also swaps) |
| F | Toggle flashlight |
| Q | Apply an armor plate |
| Tab (hold) | Inventory and scoreboard |
| Esc | Pause |
| F3 | Development FPS counter with per-system timings |

## How to play

- **The crosshair glides along your firing line.** When an enemy you can see enters the line, the crosshair
  is gradually pulled onto them. The ring around it fills as the lock builds and turns red when it is complete.
  Shots fired at full lock are the most accurate. Recoil knocks the crosshair off and costs some lock.
- **Walls and cover matter.** The firing line stops at walls, tall furniture and cover such as sofas and counters.
  The crosshair will not attract onto an enemy you cannot actually hit.
- **The hotel is dark.** Everyone carries a flashlight, and its beam is visible to everyone, you included.
- **Hide automatically.** Stop in a dark corner next to a wall or furniture and stay still. After about 1.6 seconds
  your flashlight switches off and you crouch into the shadows. Moving, aiming, firing or turning the light on breaks it.
- **Start light.** You deploy with a pistol holding five rounds plus one spare magazine (three hits drop a guard). Find weapons, ammo crates (two magazines per
  caliber per crate) and armor plates, or take weapons from fallen enemies.
- **Coins** drop from eliminated enemies (+5 each) and are paid for missions and contracts (+15). Spend them on
  the persistent skill tree.

See `DEVELOPMENT.md` for the feature status and architecture, and `NETWORKING.md` for the multiplayer plan.
