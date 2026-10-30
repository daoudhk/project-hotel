// Headless simulation smoke test: runs matches without any rendering.
import { World } from '../src/sim/world';
import { HotelMap } from '../src/sim/map';
import { TILE } from '../src/sim/mapTypes';
import { emptyInput } from '../src/sim/types';

const map = new HotelMap();
// connectivity: BFS from AT spawn over walkable tiles
const [sx, sy] = map.layout.spawnsAT[0];
const seen = new Uint8Array(map.w * map.h);
const q = [[Math.floor(sx), Math.floor(sy)]];
seen[Math.floor(sy) * map.w + Math.floor(sx)] = 1;
while (q.length) {
  const [x, y] = q.pop()!;
  for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
    const nx = x + dx, ny = y + dy;
    if (map.isWalkable(nx, ny) && !seen[ny * map.w + nx]) { seen[ny * map.w + nx] = 1; q.push([nx, ny]); }
  }
}
let problems = 0;
for (const r of map.rooms) {
  let reach = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (seen[y * map.w + x]) reach++;
  if (!reach) { console.log('UNREACHABLE ROOM', r.name); problems++; }
}
const check = (label: string, x: number, y: number) => {
  const [wx, wy] = map.nearestWalkable(x * TILE, y * TILE);
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  const moved = Math.hypot(wx - x * TILE, wy - y * TILE);
  if (!seen[ty * map.w + tx]) { console.log('unreachable spot', label, x, y); problems++; }
  else if (moved > 40) console.log('spot nudged', label, x, y, Math.round(moved) + 'px');
};
map.layout.hostageSpots.forEach((s) => check('hostage ' + s.room, s.x, s.y));
map.layout.weaponSpots.forEach((s) => check('weapon ' + s.weapon, s.x, s.y));
map.layout.crateSpots.forEach((s) => check('crate', s[0], s[1]));
map.layout.plateSpots.forEach((s) => check('plate', s[0], s[1]));
map.layout.patrolRoutes.forEach((r, i) => r.forEach((p) => check('route' + i, p[0], p[1])));
map.layout.spawnsAT.forEach((s) => check('spawnAT', s[0], s[1]));
let dark = 0, total = 0;
for (let i = 0; i < map.light.length; i++) if (map.walkable[i]) { total++; if (map.light[i] < 0.26) dark++; }
console.log(`map ok: ${problems} problems, dark walkable tiles ${dark}/${total}`);

for (const diff of ['easy', 'normal', 'hard'] as const) for (const team of ['AT', 'GUARD'] as const) {
  const w = new World({ playerTeam: team, difficulty: diff, allies: 2, seed: 42, hostages: 3, timeLimit: 480 });
  const player = w.actors.find((a) => !a.isBot)!;
  player.health = 1e9; player.x = 16; player.y = 16; player.flashlight = false; // park the player outside the building: bots play it out
  const t0 = performance.now();
  let steps = 0, shots = 0, deaths = 0, states: Record<string, number> = {};
  while (w.match.phase !== 'ended' && steps < 60 * 490) {
    w.step(1 / 60, new Map([[player.id, emptyInput()]])); player.x = 16; player.y = 16;
    for (const e of w.drainEvents()) { if (e.type === 'shot') shots++; if (e.type === 'death') deaths++; }
    steps++;
    if (steps % 600 === 0) for (const [, b] of w.brains) states[b.state] = (states[b.state] ?? 0) + 1;
    for (const a of w.actors) if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) throw new Error('NaN position ' + a.name);
  }
  const ms = performance.now() - t0;
  console.log(`${diff}/${team}: ${(steps / 60).toFixed(0)}s sim in ${ms.toFixed(0)}ms (${(ms / steps).toFixed(3)}ms/step) winner=${w.match.winner} (${w.match.reason}) shots=${shots} deaths=${deaths} rescued=${w.match.hostagesRescued}`, JSON.stringify(states));
}
