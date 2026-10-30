# Multiplayer Plan — Project Hotel

Online multiplayer is **not implemented** in this milestone and the project has no networking dependencies.
The code is structured so it can be added without rewriting gameplay. This document explains how.

## What already makes it possible

| Concern | Where it lives | Why it is network-ready |
| --- | --- | --- |
| Game simulation | `src/sim/world.ts` | Pure TypeScript, no Phaser/DOM. Can run in Node. Fixed 60 Hz `step(dt, inputs)`. |
| Player input | `InputCommand` in `src/sim/types.ts` | A small, serializable message: movement axes, aim angle/distance, buttons, edges. |
| Bots | `src/sim/ai/bot.ts` | Produce `InputCommand`s like humans; a human simply replaces a bot slot. |
| Match rules | `World.checkMatchEnd`, `MatchState` | Team-based, not "the player"-based; any number of humans per team. |
| Outputs | `SimEvent` queue (`world.drainEvents()`) | Already a stream of discrete facts (shot, damage, death, pickup…) the client renders. |
| Randomness | `core/rng.ts` seeded per match | Server-authoritative and reproducible. |
| Progression | `src/progression/profile.ts` | Rewards are computed from per-actor `stats`, which the server can report. |

Presentation (`render/`, `scenes/GameScene.ts`, `ui/`) only *reads* the world and the event stream.

## Recommended approach: Colyseus authoritative server

1. **Server package** (`server/`): a Colyseus `Room` that owns one `World`.
   - `onCreate(options)`: build `new World(matchConfig)`; for each seat not taken by a human, keep the bot.
   - `onJoin(client)`: assign the client to a team seat; convert that seat's bot actor into a human actor
     (`isBot = false`, remove its `BotBrain`) or create a new actor.
   - `onMessage('input', (client, cmd: InputCommand & { seq: number }))`: store the latest command per actor
     (validate ranges, clamp `aimDist`, rate-limit edges).
   - A `setSimulationInterval` at 60 Hz calls `world.step(1/60, inputs)`.
   - Every 50 ms (20 Hz) broadcast a **snapshot** and the drained **events**.
2. **Snapshot schema** (Colyseus `@colyseus/schema` or plain JSON):
   - actors: id, team, x, y, aim angle, recoil, health, armor, flashlight, hidden, alive, active weapon, mag,
     reload/plate/swap progress, speed, moveAngle
   - hostages: id, x, y, state, follow
   - pickups: id, kind, x, y, weapon, (mag/reserve only for nearby players)
   - match: phase, timeLeft, rescued counts, winner
   - Per-client filtering: hide enemy actors outside the receiving player's line of sight (`map.lineClear`),
     which also prevents wall-hack cheats. Flashlight beams can still be sent (they are visible around corners).
3. **Client changes**:
   - Add `NetWorld` implementing the read API `GameScene` uses (`actors`, `hostages`, `pickups`, `match`,
     `map`, `interactable`, `lightAt`) backed by interpolated snapshots (render ~100 ms behind).
   - Keep the local `HotelMap` (static data) for rendering and lighting.
   - **Client-side prediction** for the local actor: run `World.updateActor` logic for that one actor with the
     local inputs, then reconcile against server state using the `seq` of the last processed input.
   - The aim attraction uses only state the client already has (visible enemies), so the crosshair can be predicted
     locally; the server re-validates the shot direction against its own crosshair state.
   - Play `SimEvent`s received from the server through the existing `processEvents` switch.
4. **Progression**: the server reports end-of-match `stats` per player; a small HTTP endpoint or the room itself
   signs the reward so it cannot be forged. Until accounts exist, `profile.recordMatch` stays client-side.

## Steps in order

1. Extract a `WorldView` interface from what `GameScene` reads; make `World` implement it.
2. Add `server/` with Colyseus, reuse `src/sim` and `src/data` via a shared tsconfig path.
3. Implement snapshot encoding and per-client visibility filtering.
4. Implement `NetWorld` with interpolation and local prediction; add a "Play online" entry to the Deploy panel.
5. Lag-compensate hits (rewind enemy positions by the shooter's latency, capped at ~200 ms).
6. Load-test with bots filling empty seats.

No part of the current gameplay code needs to be rewritten for this; the work is additive.
