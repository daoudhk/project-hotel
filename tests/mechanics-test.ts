// Deterministic checks of core gameplay rules against the pure simulation.
import { World } from '../src/sim/world';
import { emptyInput, InputCommand } from '../src/sim/types';
import { TILE } from '../src/sim/mapTypes';
import { WEAPONS } from '../src/data/weapons';

let fails = 0;
const ok = (cond: boolean, msg: string) => { console.log((cond ? '  ok   ' : '  FAIL ') + msg); if (!cond) fails++; };
const mk = (team: 'AT' | 'GUARD' = 'AT', skills = {}) => new World({ playerTeam: team, difficulty: 'normal', allies: 0, seed: 7, hostages: 3, timeLimit: 480 }, skills);
const step = (w: World, sec: number, inp: Partial<InputCommand> | ((t: number) => Partial<InputCommand>) = {}) => {
  const me = w.actors.find((a) => !a.isBot)!;
  for (let i = 0; i < Math.round(sec * 60); i++) {
    const extra = typeof inp === 'function' ? inp(i / 60) : inp;
    w.step(1 / 60, new Map([[me.id, { ...emptyInput(), aimAngle: me.aim.angle, ...extra }]]));
  }
};
const freezeBots = (w: World) => { for (const [, b] of w.brains) (b as any).update = () => ({ ...emptyInput(), aimAngle: w.actor(b.actorId)!.aim.angle }); };

console.log('Weapons');
ok(Math.ceil(100 / WEAPONS.pistol.damage) === 5, 'pistol needs 5 hits on a standard enemy');
ok(Math.ceil(100 / WEAPONS.deagle.damage) === 2, 'desert eagle needs 2 hits');
{
  const w = mk(); const me = w.actors.find((a) => !a.isBot)!;
  ok(me.inv.slots[1]?.def === 'pistol' && me.inv.slots[1]!.mag === 5 && me.inv.reserve['.45 ACP'] === 0, 'player spawns with pistol holding exactly 5 rounds');
  const wp = w.pickups.filter((p) => p.kind === 'weapon');
  ok(wp.length >= 4 && wp.every((p) => { const t = p.mag! + p.reserve!; return t >= 10 && t <= 30 && p.mag! <= WEAPONS[p.weapon!].magazine; }), `map weapons carry 10-30 rounds within magazine capacity (${wp.map((p) => p.weapon + ':' + p.mag + '+' + p.reserve).join(' ')})`);
}

console.log('Aim attraction');
{
  const w = mk(); freezeBots(w); w.match.briefing = 0; w.match.phase = 'live';
  const me = w.actors.find((a) => !a.isBot)!;
  const g = w.actors.find((a) => a.team === 'GUARD')!;
  // open lobby: put both in the lit lobby centre-west
  // find a duel position with a clear bullet path ~300px apart in the lobby
  [g.x, g.y] = w.map.nearestWalkable(46 * TILE, 41 * TILE);
  [me.x, me.y] = w.map.nearestWalkable(54 * TILE, 47.5 * TILE);
  {
    const a0 = Math.atan2(g.y - me.y, g.x - me.x), d0 = Math.hypot(g.x - me.x, g.y - me.y);
    ok(w.map.traceBullet(me.x, me.y, a0, d0).dist >= d0 - 14, 'test duel has a clear bullet path');
  }
  g.flashlight = true;
  for (const o of w.actors) if (o !== g && o !== me) { o.x = 16; o.y = 16; o.flashlight = false; }
  ok(w.map.lineClear(me.x, me.y, g.x, g.y), 'test duel has line of sight');
  const ang = Math.atan2(g.y - me.y, g.x - me.x);
  me.aim.angle = ang;
  step(w, 0.1, { aimAngle: ang, aimDist: 330 });
  const early = me.aim.lock;
  step(w, 1.6, { aimAngle: ang, aimDist: 300 });
  ok(early > 0 && early < 0.35, `lock builds gradually (after 0.1s: ${early.toFixed(2)})`);
  ok(me.aim.lock > 0.95 && me.aim.lockTarget === g.id, `lock completes on the target (${me.aim.lock.toFixed(2)})`);
  const cd = Math.hypot(me.aim.cx - g.x, me.aim.cy - g.y);
  ok(cd < 12, `crosshair glided onto the enemy (${cd.toFixed(1)}px away)`);
  // aim away -> lock decays
  step(w, 0.6, { aimAngle: ang + 1.2, aimDist: 300 });
  ok(me.aim.lock < 0.2, `lock releases when aiming away (${me.aim.lock.toFixed(2)})`);
  // shoot 5 times with lock re-acquired between shots
  step(w, 1.5, { aimAngle: ang, aimDist: 300 });
  let shots = 0;
  for (let i = 0; i < 5 && g.alive; i++) {
    step(w, 1 / 60, { aimAngle: ang, aimDist: 300, fire: true });
    shots++;
    step(w, 0.9, { aimAngle: ang, aimDist: 300 });
  }
  ok(!g.alive, `enemy eliminated by pistol after ${shots} locked shots (hits ${me.stats.hits}/${me.stats.shots})`);
  const drop = w.pickups.find((p) => p.kind === 'weapon' && Math.hypot(p.x - g.x, p.y - g.y) < 120);
  const gw = g.inv.slots[g.inv.active]!;
  ok(!!drop && drop.weapon === gw.def && drop.mag === gw.mag && drop.reserve === g.inv.reserve[WEAPONS[gw.def].caliber], `enemy dropped ${drop?.weapon} with exactly its remaining ammo (${drop?.mag}+${drop?.reserve})`);
  ok(w.pickups.some((p) => p.kind === 'coin' && p.value === 5), 'enemy dropped a 5-point coin');
  const coins0 = me.stats.coins;
  step(w, 1);
  const coin = w.pickups.find((p) => p.kind === 'coin')!;
  [me.x, me.y] = w.map.nearestWalkable(coin.x + 60, coin.y);
  step(w, 2);
  ok(me.stats.coins === coins0 + 5, `coin collected (+${me.stats.coins - coins0})`);
  // pick up the dropped weapon
  if (drop) {
    step(w, 3, () => { const a = Math.atan2(drop.y - me.y, drop.x - me.x); const d = Math.hypot(drop.y - me.y, drop.x - me.x); return d > 20 ? { moveX: Math.cos(a), moveY: Math.sin(a), aimAngle: ang } : { aimAngle: ang }; });
    const before = me.inv.reserve[WEAPONS[drop.weapon!].caliber];
    step(w, 1 / 60, { interactPressed: true, aimAngle: ang });
    const slot = WEAPONS[drop.weapon!].slot;
    ok(me.inv.slots[slot]?.def === drop.weapon, `picked up ${drop.weapon}`);
    if (drop.weapon !== 'pistol') ok(me.inv.reserve[WEAPONS[drop.weapon!].caliber] === before + drop.reserve!, 'reserve credited by caliber');
  }
}

console.log('Cover');
{
  const w = mk(); freezeBots(w); w.match.phase = 'live';
  const me = w.actors.find((a) => !a.isBot)!;
  const g = w.actors.find((a) => a.team === 'GUARD')!;
  for (const o of w.actors) if (o !== g && o !== me) { o.x = 16; o.y = 16; o.flashlight = false; }
  // guard crouched right behind a lobby sofa, player across the room
  [g.x, g.y] = [41 * TILE, 49.2 * TILE];
  [me.x, me.y] = w.map.nearestWalkable(41 * TILE, 57.5 * TILE);
  g.flashlight = true;
  const ang = Math.atan2(g.y - me.y, g.x - me.x);
  me.aim.angle = ang;
  step(w, 1.5, { aimAngle: ang, aimDist: 400 });
  const d = Math.hypot(g.x - me.x, g.y - me.y);
  ok(me.aim.lineEnd < d - 20, `firing line stops at cover (${me.aim.lineEnd.toFixed(0)} < ${d.toFixed(0)})`);
  ok(me.aim.lock < 0.05, 'crosshair does not attract onto an enemy fully behind cover');
  const hp = g.health;
  for (let i = 0; i < 3; i++) { step(w, 1 / 60, { aimAngle: ang, aimDist: 400, fire: true }); step(w, 0.4, { aimAngle: ang, aimDist: 400 }); }
  ok(g.health === hp, 'cover absorbs the bullets');
}

console.log('Ammo crates & reload');
{
  const w = mk(); freezeBots(w); w.match.phase = 'live';
  const me = w.actors.find((a) => !a.isBot)!;
  const crate = w.pickups.find((p) => p.kind === 'crate')!;
  me.x = crate.x + 20; me.y = crate.y;
  me.inv.slots[0] = { def: 'm4', mag: 30 };
  me.inv.active = 1;
  step(w, 1 / 60, { interactPressed: true });
  ok(me.inv.reserve['.45 ACP'] === 16, `crate gives two pistol magazines (${me.inv.reserve['.45 ACP']})`);
  step(w, 1 / 60, { interactPressed: true });
  ok(me.inv.reserve['.45 ACP'] === 16, 'same caliber cannot be taken twice from one crate');
  step(w, 1 / 60, { switchSlot: 0 }); step(w, 0.6);
  step(w, 1 / 60, { interactPressed: true });
  ok(me.inv.reserve['5.56mm'] === 60, `sidearm and primary ammo collected separately (5.56: ${me.inv.reserve['5.56mm']})`);
  step(w, 1 / 60, { switchSlot: 1 }); step(w, 0.6);
  step(w, 1 / 60, { reload: true });
  ok(me.reloadTimer > 0, 'reload started');
  step(w, 2);
  ok(me.inv.slots[1]!.mag === 8 && me.inv.reserve['.45 ACP'] === 13, `reload fills magazine from reserve (${me.inv.slots[1]!.mag}/${me.inv.reserve['.45 ACP']})`);
}

console.log('Armor plates');
{
  const w = mk(); freezeBots(w); w.match.phase = 'live';
  const me = w.actors.find((a) => !a.isBot)!;
  me.inv.plates = 1;
  step(w, 1 / 60, { applyPlate: true });
  const mag0 = me.inv.slots[1]!.mag;
  step(w, 0.5, { fire: true });
  ok(me.inv.slots[1]!.mag === mag0, 'cannot fire while applying a plate');
  step(w, 2.2);
  ok(me.armor === 50 && me.inv.plates === 0, `plate applied (+${me.armor} armor)`);
  const hp0 = me.health;
  w.damage(me, 20, null, null, 0);
  ok(me.health > hp0 - 20 && me.armor < 50, `armor absorbs damage (hp ${me.health}, armor ${me.armor})`);
}

console.log('Stealth');
{
  const w = mk(); freezeBots(w); w.match.phase = 'live';
  const me = w.actors.find((a) => !a.isBot)!;
  // find a dark corner
  let spot: [number, number] | null = null;
  for (let ty = 2; ty < w.map.h - 2 && !spot; ty++) for (let tx = 2; tx < w.map.w - 2 && !spot; tx++) {
    if (!w.map.isWalkable(tx, ty)) continue;
    me.x = (tx + 0.5) * TILE; me.y = (ty + 0.5) * TILE;
    if (w.hideSpotQuality(me) > 0.6 && w.map.enclosureAt(me.x, me.y) >= 4) spot = [me.x, me.y];
  }
  ok(!!spot, `found a dark corner at ${spot}`);
  for (const o of w.actors) if (o.isBot) { o.x = 16; o.y = 16; o.flashlight = false; }
  step(w, 0.5);
  ok(!me.hidden, 'not hidden before the hide delay');
  step(w, 1.4);
  ok(me.hidden && !me.flashlight, 'auto-hides and switches flashlight off after standing still');
  step(w, 0.1, { moveX: 1 });
  ok(!me.hidden && me.flashlight, 'moving breaks stealth and restores the flashlight');
  step(w, 2.2);
  ok(me.hidden, 'hides again');
  step(w, 1 / 60, { aimMoved: true });
  ok(!me.hidden, 'aiming breaks stealth');
  // open lit area: no hiding
  [me.x, me.y] = w.map.nearestWalkable(41 * TILE, 51 * TILE);
  step(w, 3);
  ok(!me.hidden, 'cannot hide in a lit open area');
  // visibility comparison
  [me.x, me.y] = spot!;
  step(w, 2.2);
  const g = w.actors.find((a) => a.isBot)!;
  g.x = me.x + 140; g.y = me.y; g.aim.angle = Math.PI; g.flashlight = false;
  if (!w.map.lineClear(g.x, g.y, me.x, me.y)) { g.x = me.x; g.y = me.y + 140; g.aim.angle = -Math.PI / 2; }
  ok(me.hidden, 'hidden before visibility comparison');
  const vHidden = w.visibility(g, me);
  me.hidden = false; me.flashlight = true;
  const vLit = w.visibility(g, me);
  ok(vHidden < vLit * 0.25, `hidden player far harder to see (hidden ${vHidden.toFixed(3)} vs light-on ${vLit.toFixed(3)})`);
  const w2 = mk('AT', { 'stealth.shadowstep': 3, 'stealth.conceal': 3 }); const me2 = w2.actors.find((a) => !a.isBot)!;
  ok(me2.mods.hideTime < me.mods.hideTime && me2.mods.concealment < me.mods.concealment, 'stealth skills shorten hide time and improve concealment');
}

console.log('Hostage rescue');
{
  const w = mk(); freezeBots(w); w.match.phase = 'live';
  const me = w.actors.find((a) => !a.isBot)!;
  for (const o of w.actors) if (o.isBot) { o.x = 16; o.y = 16; o.flashlight = false; }
  const h = w.hostages[0];
  me.x = h.x + 30; me.y = h.y;
  step(w, 0.8, { interact: true });
  ok(h.state === 'captive', 'hostage still captive mid-hold');
  step(w, 1.0, { interact: true });
  ok(h.state === 'following' && h.follow === me.id, 'holding E frees the hostage, who follows');
  // walk to extraction along a path
  const ex = w.map.layout.extraction;
  const path = w.nav.findPath(me.x, me.y, (ex.x + ex.w / 2) * TILE, (ex.y + ex.h / 2) * TILE)!;
  let i = 0;
  for (let t = 0; t < 60 * 60 && h.state !== 'rescued'; t++) {
    const p = path[Math.min(i, path.length - 1)];
    const d = Math.hypot(p[0] - me.x, p[1] - me.y);
    if (d < 14 && i < path.length - 1) i++;
    const hd = Math.hypot(h.x - me.x, h.y - me.y);
    const go = hd < 140 || i === path.length - 1;
    w.step(1 / 60, new Map([[me.id, { ...emptyInput(), moveX: go ? (p[0] - me.x) / (d || 1) : 0, moveY: go ? (p[1] - me.y) / (d || 1) : 0 }]]));
  }
  ok(h.state === 'rescued' && w.match.hostagesRescued === 1, 'hostage escorted to the entrance is rescued');
}

console.log('Match rules');
{
  const w = mk(); w.match.phase = 'live';
  for (const a of w.actors) if (a.team === 'GUARD') w.damage(a, 999, w.actors[0], 'pistol', 0);
  step(w, 1 / 60);
  ok(w.match.phase === 'ended' && w.match.winner === 'AT', `eliminating all guards wins for AT (${w.match.reason})`);
  const w2 = mk(); w2.match.phase = 'live';
  const me = w2.actors.find((a) => !a.isBot)!;
  w2.damage(me, 999, null, null, 0);
  step(w2, 1 / 60);
  ok(w2.match.winner === 'GUARD', 'solo player death loses the match');
  const w3 = mk('GUARD'); w3.match.phase = 'live'; (w3 as any).config.timeLimit = 1;
  freezeBots(w3);
  step(w3, 1.2);
  ok(w3.match.winner === 'GUARD' && /Time/.test(w3.match.reason), 'guards win when the timer expires');
}

console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL MECHANICS CHECKS PASSED');
process.exit(fails ? 1 : 0);
